// Route PATCH /api/accounts/:id · change an account (details, status, role, permission ticks, departments)
// Route DELETE /api/accounts/:id · delete an account
// =============================================================================
// Used by: components/SMSystem.jsx (Edit user dialog, role dropdown, Suspend / Activate, Delete)
// Depends on: lib/server/{db,session,accounts,audit,http}
// Sections (search for these markers): EDIT ACCOUNT · Input, EDIT ACCOUNT · Who may change what, EDIT ACCOUNT · Save,
//   DELETE ACCOUNT
// Details and status need "Edit users"; role, ticks and departments need "Change roles & permissions" and can never
// be changed on your own account. There must always be an active Administrator left.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { movePlacement } from '@/lib/server/org';
import { ACCOUNT_INCLUDE, findAccount, toRow, rolesFor, STATUS_DB, departmentIds, SCOPE_DB, checkScope, canSeeAccount, cleanPerms, checkNotLockedOut } from '@/lib/server/accounts';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, forbidden, clientIp, ApiError } from '@/lib/server/http';

const idOf = async params => { const id = Number((await params).id); if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'User not found.'); return id; };
async function target(ctx, id) {
  const a = await findAccount(id);
  if (!a || !canSeeAccount(ctx, a)) throw new ApiError(404, 'User not found.');
  return a;
}

// ===== EDIT ACCOUNT · Input =====
// Every field is optional; only the ones sent are changed.
const Body = z.object({
  name: z.string().trim().min(3).max(120).optional(), email: z.string().trim().toLowerCase().email().max(200).optional(),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/).optional(), dept: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['Active', 'Must change password', 'Suspended']).optional(),
  role: z.string().optional(), perms: z.array(z.string()).max(100).optional(), scope: z.enum(['all', 'own', 'some']).optional(), depts: z.array(z.string()).max(50).optional(),
});

export const PATCH = handle(async (req, { params }) => {
  const ctx = await requireUser(), id = await idOf(params), a = await target(ctx, id), b = await readBody(req, Body);
  const has = k => ctx.user.perms.includes(k), self = a.id === ctx.account.id;

  // ===== EDIT ACCOUNT · Who may change what =====
  const details = ['name', 'email', 'username', 'dept', 'status'].some(k => b[k] !== undefined);
  const access = ['role', 'perms', 'scope', 'depts'].some(k => b[k] !== undefined);
  if (details && !has('settings.edit-user')) throw forbidden();
  if (access && !has('settings.access')) throw forbidden();
  if (access && self) throw forbidden('You cannot change your own role or permissions. Another user with "Change roles & permissions" must do it.');
  if (b.status !== undefined && self && STATUS_DB[b.status] !== a.status) throw forbidden('You cannot change the status of your own account.');
  if (b.name && b.name.split(/\s+/).length < 2) throw badRequest('Enter both the first and last name.');
  if (b.username && b.username !== a.username && await db.account.findFirst({ where: { username: b.username } })) throw badRequest('This username is already taken.', { fields: { username: ['taken'] } });
  if (b.email && b.email !== a.email && await db.account.findFirst({ where: { email: b.email } })) throw badRequest('A user with this email already exists.', { fields: { email: ['taken'] } });

  const beforeRoles = a.roles.map(r => r.role), beforePerms = a.permissions.map(p => p.key);
  const roles = b.role !== undefined ? rolesFor(b.role) : beforeRoles;
  const perms = b.perms !== undefined ? cleanPerms(ctx, b.perms, beforePerms) : beforePerms;
  const status = b.status !== undefined ? STATUS_DB[b.status] : a.status;
  const [deptId] = b.dept !== undefined ? await departmentIds([b.dept]) : [a.staff?.departmentId ?? null];
  const scope = b.scope ?? { ALL: 'all', OWN: 'own', SELECTED: 'some' }[a.deptScope];
  const scopeIds = b.scope !== undefined || b.depts !== undefined ? (scope === 'some' ? await departmentIds(b.depts || []) : []) : a.scopeDepartments.map(d => d.departmentId);
  if (scope === 'some' && !scopeIds.length) throw badRequest('Tick at least one department under Selected departments.');
  if (access || b.dept !== undefined) checkScope(ctx, b.scope !== undefined ? scope : 'own', [deptId, ...scopeIds].filter(x => x != null));
  await checkNotLockedOut({ id: a.id, roles, perms, status });

  // ===== EDIT ACCOUNT · Save =====
  // Suspending signs the person out everywhere straight away.
  const parts = (b.name || a.displayName).split(/\s+/);
  const updated = await db.$transaction(async tx => {
    let staffId = a.staffId;
    if (b.dept !== undefined || b.name !== undefined || b.email !== undefined) {
      const staffData = { firstName: parts[0], lastName: parts[parts.length - 1], otherNames: parts.slice(1, -1).join(' ') || null, email: b.email || a.email, departmentId: deptId };
      if (staffId) {
        // A department change also moves the placement history (as Organisation > Staff Records does), so earlier
        // results keep the department they were achieved in.
        if (a.staff && a.staff.departmentId !== deptId) await movePlacement(tx, { staff: a.staff, departmentId: deptId, stationId: a.staff.stationId, actorId: ctx.account.id, reason: 'Department changed in User Management' });
        await tx.staffRecord.update({ where: { id: staffId }, data: staffData });
      }
      else staffId = (await tx.staffRecord.create({ data: { staffNo: 'NEW-' + (b.username || a.username), ...staffData } })).id;
    }
    if (b.role !== undefined) { await tx.accountRole.deleteMany({ where: { accountId: a.id } }); await tx.accountRole.createMany({ data: [{ accountId: a.id, role: roles[0] }] }); }
    if (b.perms !== undefined) { await tx.accountPermission.deleteMany({ where: { accountId: a.id } }); await tx.accountPermission.createMany({ data: perms.map(key => ({ accountId: a.id, key })) }); }
    if (b.scope !== undefined || b.depts !== undefined) { await tx.accountScopeDepartment.deleteMany({ where: { accountId: a.id } }); await tx.accountScopeDepartment.createMany({ data: scopeIds.map(departmentId => ({ accountId: a.id, departmentId })) }); }
    const u = await tx.account.update({ where: { id: a.id }, include: ACCOUNT_INCLUDE, data: {
      username: b.username, email: b.email, displayName: b.name ? parts.join(' ') : undefined, status, staffId, deptScope: SCOPE_DB[scope],
      ...(b.role !== undefined ? { role: roles[0] } : {}),
    } });
    if (status === 'SUSPENDED' && a.status !== 'SUSPENDED') await tx.session.updateMany({ where: { accountId: a.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ actorId: ctx.account.id, action: 'account.update', entityType: 'Account', entityId: a.id, ip: clientIp(req),
      before: { username: a.username, email: a.email, name: a.displayName, status: a.status, roles: beforeRoles, perms: beforePerms, scope: a.deptScope },
      after: { username: u.username, email: u.email, name: u.displayName, status: u.status, roles, perms, scope: u.deptScope, dept: b.dept } }, tx);
    return u;
  });
  return json({ user: toRow(updated) });
});

// ===== DELETE ACCOUNT =====
// The account is switched off (DISABLED), signed out and hidden from the list rather than erased, so the audit log
// and any results keep pointing at it. Its username and email are freed for reuse. Not allowed on your own account
// or on the last Administrator.
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requireUser(), id = await idOf(params);
  if (!ctx.user.perms.includes('settings.delete-user')) throw forbidden();
  const a = await target(ctx, id);
  if (a.id === ctx.account.id) throw forbidden('You cannot delete your own account while signed in.');
  await checkNotLockedOut({ id: a.id, roles: [], perms: [], status: 'DISABLED' });
  await db.$transaction(async tx => {
    await tx.account.update({ where: { id: a.id }, data: { status: 'DISABLED', username: a.username + '.deleted.' + a.id, email: a.email + '.deleted.' + a.id } });
    await tx.session.updateMany({ where: { accountId: a.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit({ actorId: ctx.account.id, action: 'account.delete', entityType: 'Account', entityId: a.id, before: { username: a.username, email: a.email, name: a.displayName }, ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
