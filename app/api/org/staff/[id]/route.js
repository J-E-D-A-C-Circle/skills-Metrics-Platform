// Route GET /api/org/staff/:id · one staff record with placement history, linked login accounts and direct reports
// Route PATCH /api/org/staff/:id · edit a staff record (details, Staff ID, department, grade, station, supervisor, status)
// Route DELETE /api/org/staff/:id · delete a staff record that has no attempts, results, assignments or accounts
// =============================================================================
// Used by: components/SMOrganisation.jsx (Staff Records tab: staff drawer, Edit, Deactivate, Delete)
// Depends on: lib/server/{db,session,audit,http,org}, app/api/org/_lib.js
// Sections (search for these markers): STAFF RECORD · Read, EDIT STAFF · Checks, EDIT STAFF · Save, DELETE STAFF
// Reading needs "View organisation" and the record must be in scope. Changing needs "Manage staff records" and the
// record's current and new department must be ones the editor can see. A department or station change closes the
// open placement history row and opens a new one in the same transaction, so earlier results keep where they came from.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp, ApiError } from '@/lib/server/http';
import { StaffPatch, STAFF_INCLUDE, staffRow, auditStaff, placementChanged, movePlacement, duplicateMessage, fullName } from '@/lib/server/org';
import { idOf, visibleStaff, assertCanEdit, checkStaffRefs } from '../../_lib';

// ===== STAFF RECORD · Read =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.view');
  const id = await idOf(params, 'Staff member');
  const s = await visibleStaff(ctx, id, {
    ...STAFF_INCLUDE,
    placements: { orderBy: [{ fromDate: 'desc' }, { id: 'desc' }], include: { department: { select: { name: true } }, station: { select: { name: true, location: { select: { name: true } } } }, changedBy: { select: { displayName: true } } } },
    accounts: { select: { id: true, username: true, status: true, roles: { select: { role: true } } } },
    reports: { select: { id: true, staffNo: true, firstName: true, lastName: true, otherNames: true, status: true }, orderBy: { lastName: 'asc' } },
  });
  return json({
    row: staffRow(s),
    placements: s.placements.map(p => ({ id: p.id, department: p.department?.name || null, station: p.station?.name || null, location: p.station?.location?.name || null, fromDate: p.fromDate, toDate: p.toDate, reason: p.reason, changedBy: p.changedBy?.displayName || null })),
    accounts: s.accounts.map(a => ({ id: a.id, username: a.username, status: a.status, roles: a.roles.map(r => r.role) })),
    reports: s.reports.map(r => ({ id: r.id, staffNo: r.staffNo, name: fullName(r), status: r.status })),
  });
});

// ===== EDIT STAFF · Checks =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.staff');
  const id = await idOf(params, 'Staff member');
  const before = await visibleStaff(ctx, id);
  assertCanEdit(ctx, before);
  const b = await readBody(req, StaffPatch);
  const { reason, ...wanted } = b;
  const changed = new Set(Object.keys(wanted).filter(k => wanted[k] !== undefined && (wanted[k] ?? null) !== (before[k] ?? null)));
  if (!changed.size) return json({ row: staffRow(await db.staffRecord.findUnique({ where: { id }, include: STAFF_INCLUDE })), unchanged: true });
  await checkStaffRefs(ctx, wanted, { staffId: id, changed });
  if (changed.has('staffNo') && await db.staffRecord.findFirst({ where: { staffNo: { equals: wanted.staffNo, mode: 'insensitive' }, NOT: { id } } })) throw badRequest('Staff ID ' + wanted.staffNo + ' is already in use.', { fields: { staffNo: ['Already in use.'] } });
  if (changed.has('email') && wanted.email && await db.staffRecord.findFirst({ where: { email: { equals: wanted.email, mode: 'insensitive' }, NOT: { id } } })) throw badRequest('That email address already belongs to another staff record.', { fields: { email: ['Already in use.'] } });
  const data = Object.fromEntries([...changed].map(k => [k, wanted[k] ?? null]));
  const moved = placementChanged(before, data);

  // ===== EDIT STAFF · Save =====
  // One transaction: the record, the placement history (when moved) and the audit rows succeed or fail together.
  try {
    const s = await db.$transaction(async tx => {
      const r = await tx.staffRecord.update({ where: { id }, data, include: STAFF_INCLUDE });
      const ip = clientIp(req), pick = o => Object.fromEntries([...changed].map(k => [k, o[k] ?? null]));
      if (moved) {
        await movePlacement(tx, { staff: before, departmentId: r.departmentId, stationId: r.stationId, actorId: ctx.account.id, reason });
        const names = async (d, st) => ({ departmentId: d, department: d ? (await tx.department.findUnique({ where: { id: d } }))?.name : null, stationId: st, station: st ? (await tx.station.findUnique({ where: { id: st } }))?.name : null });
        await audit({ actorId: ctx.account.id, action: 'staff.placement.change', entityType: 'StaffRecord', entityId: id, before: await names(before.departmentId, before.stationId), after: { ...(await names(r.departmentId, r.stationId)), reason: reason || null }, ip }, tx);
      }
      const action = changed.has('status') && changed.size === 1 ? 'staff.status.change' : 'staff.update';
      await audit({ actorId: ctx.account.id, action, entityType: 'StaffRecord', entityId: id, before: pick(auditStaff(before)), after: pick(auditStaff(r)), ip }, tx);
      return r;
    });
    return json({ row: staffRow(s), moved });
  } catch (e) { const m = duplicateMessage(e, 'staff record'); if (m) throw badRequest(m); throw e; }
});

// ===== DELETE STAFF =====
// Only a record entered by mistake can be deleted. Anyone with attempts, results, assignments, extensions, login
// accounts or people reporting to them is kept for history: set them Inactive or Left instead.
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.staff');
  const id = await idOf(params, 'Staff member');
  const s = await visibleStaff(ctx, id, { _count: { select: { attempts: true, finalResults: true, assignments: true, extensions: true, accounts: true, reports: true } } });
  assertCanEdit(ctx, s);
  const c = s._count;
  if (c.attempts || c.finalResults || c.assignments || c.extensions || c.accounts || c.reports) {
    const why = [c.attempts && c.attempts + ' attempts', c.finalResults && 'results', c.assignments && 'individual assignments', c.extensions && 'deadline extensions', c.accounts && 'a login account', c.reports && c.reports + ' people reporting to them'].filter(Boolean).join(', ');
    throw new ApiError(409, 'This staff record has ' + why + ', so it cannot be deleted. Set the status to Inactive or Left instead.');
  }
  await db.$transaction(async tx => {
    await tx.staffPlacementHistory.deleteMany({ where: { staffId: id } });
    await tx.staffRecord.delete({ where: { id } });
    await audit({ actorId: ctx.account.id, action: 'staff.delete', entityType: 'StaffRecord', entityId: id, before: auditStaff(s), ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
