// Route GET /api/accounts · the User Management list (accounts in the database only)
// Route POST /api/accounts · create an account (Settings > User Management > Add user)
// =============================================================================
// Used by: components/SMSystem.jsx (User Management tab)
// Depends on: lib/server/{db,session,password,accounts,audit,http}
// Sections (search for these markers): ACCOUNTS LIST · Read, NEW ACCOUNT · Input, NEW ACCOUNT · Checks, NEW ACCOUNT · Save
// Needs "View users" to list and "Add users" to create. The editor only sees accounts in departments they can see.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { hashPassword } from '@/lib/server/password';
import { requirePermission } from '@/lib/server/session';
import { ACCOUNT_INCLUDE, LISTED, toRow, rolesFor, departmentIds, SCOPE_DB, checkScope, canSeeAccount, cleanPerms, tempPasswordOk } from '@/lib/server/accounts';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';

// ===== ACCOUNTS LIST · Read =====
// Newest first. Deleted accounts (DISABLED) are left out.
export const GET = handle(async () => {
  const ctx = await requirePermission('settings.users');
  const rows = await db.account.findMany({ where: LISTED, include: ACCOUNT_INCLUDE, orderBy: { createdAt: 'desc' } });
  return json({ users: rows.filter(a => canSeeAccount(ctx, a)).map(toRow) });
});

// ===== NEW ACCOUNT · Input =====
const Body = z.object({
  name: z.string().trim().min(3).max(120), email: z.string().trim().toLowerCase().email().max(200),
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/), dept: z.string().trim().min(1).max(120),
  role: z.string(), perms: z.array(z.string()).max(100), scope: z.enum(['all', 'own', 'some']), depts: z.array(z.string()).max(50),
  password: z.string().min(1).max(200), mustChange: z.boolean(),
});

export const POST = handle(async req => {
  const ctx = await requirePermission('settings.add-user');
  const b = await readBody(req, Body);

  // ===== NEW ACCOUNT · Checks =====
  if (b.name.split(/\s+/).length < 2) throw badRequest('Enter both the first and last name.');
  if (!tempPasswordOk(b.password)) throw badRequest('The temporary password needs at least 8 characters with uppercase, lowercase and a number.');
  if (await db.account.findFirst({ where: { username: b.username } })) throw badRequest('This username is already taken.', { fields: { username: ['taken'] } });
  if (await db.account.findFirst({ where: { email: b.email } })) throw badRequest('A user with this email already exists.', { fields: { email: ['taken'] } });
  const roles = rolesFor(b.role);
  const [deptId] = await departmentIds([b.dept]);
  const scopeIds = b.scope === 'some' ? await departmentIds(b.depts) : [];
  if (b.scope === 'some' && !scopeIds.length) throw badRequest('Tick at least one department under Selected departments.');
  checkScope(ctx, b.scope, [deptId, ...scopeIds]);
  const perms = cleanPerms(ctx, b.perms);

  // ===== NEW ACCOUNT · Save =====
  // A staff record holds the department. Its staff number is a placeholder (NEW-<username>) until HR staff
  // numbers are loaded with the organisation data.
  const parts = b.name.split(/\s+/), passwordHash = await hashPassword(b.password);
  const created = await db.$transaction(async tx => {
    const staff = await tx.staffRecord.create({ data: { staffNo: 'NEW-' + b.username, firstName: parts[0], lastName: parts[parts.length - 1], otherNames: parts.slice(1, -1).join(' ') || null, email: b.email, departmentId: deptId } });
    const a = await tx.account.create({ data: {
      username: b.username, email: b.email, displayName: parts.join(' '), passwordHash,
      status: b.mustChange ? 'MUST_CHANGE_PASSWORD' : 'ACTIVE', passwordSetAt: b.mustChange ? null : new Date(), staffId: staff.id, deptScope: SCOPE_DB[b.scope],
      roles: { create: roles.map(role => ({ role })) }, permissions: { create: perms.map(key => ({ key })) },
      scopeDepartments: { create: scopeIds.map(departmentId => ({ departmentId })) },
    }, include: ACCOUNT_INCLUDE });
    await audit({ actorId: ctx.account.id, action: 'account.create', entityType: 'Account', entityId: a.id, after: { username: a.username, roles, perms, scope: b.scope, depts: b.depts, dept: b.dept }, ip: clientIp(req) }, tx);
    return a;
  });
  return json({ user: toRow(created) }, 201);
});
