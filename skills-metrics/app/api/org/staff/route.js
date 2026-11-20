// Route GET /api/org/staff · Staff Records list: search, filters, sort and pages (or every match with all=1 for export)
// Route POST /api/org/staff · add a staff record
// =============================================================================
// Used by: components/SMOrganisation.jsx (Staff Records tab, staff pickers on the Supervisors tab)
// Depends on: lib/server/{db,session,scope,audit,http,org}, app/api/org/_lib.js
// Sections (search for these markers): STAFF LIST · Read, NEW STAFF · Save
// Listing needs "View organisation" and only returns staff in the person's department scope (plus their direct
// reports). Adding needs "Manage staff records" and the department must be one the editor can see.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { staffWhere } from '@/lib/server/scope';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { StaffInput, STAFF_INCLUDE, staffRow, staffFilter, STAFF_SORT, auditStaff, duplicateMessage } from '@/lib/server/org';
import { checkStaffRefs } from '../_lib';

// ===== STAFF LIST · Read =====
// ?q=&departmentId=(id|none)&gradeId=&stationId=&locationId=&supervisorId=(id|none)&status=&sort=&page=&pageSize=&all=1
export const GET = handle(async req => {
  const ctx = await requirePermission('org.view');
  const p = Object.fromEntries(req.nextUrl.searchParams);
  const where = { AND: [staffWhere(ctx, { includeSelf: true }), ...staffFilter(p)] };
  const all = p.all === '1';
  const pageSize = all ? 5000 : Math.min(Math.max(Number(p.pageSize) || 25, 1), 100);
  const page = all ? 1 : Math.max(Number(p.page) || 1, 1);
  const [total, rows] = await Promise.all([
    db.staffRecord.count({ where }),
    db.staffRecord.findMany({ where, include: STAFF_INCLUDE, orderBy: [...(STAFF_SORT[p.sort] || STAFF_SORT.name), { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  if (all) await audit({ actorId: ctx.account.id, action: 'staff.export', entityType: 'StaffRecord', after: { filters: p, rows: rows.length }, ip: clientIp(req) });
  return json({ rows: rows.map(staffRow), total, page, pageSize });
});

// ===== NEW STAFF · Save =====
// Creates the record and its first placement history row together, then audits it.
export const POST = handle(async req => {
  const ctx = await requirePermission('org.staff');
  const b = await readBody(req, StaffInput);
  await checkStaffRefs(ctx, b);
  if (await db.staffRecord.findFirst({ where: { staffNo: { equals: b.staffNo, mode: 'insensitive' } } })) throw badRequest('Staff ID ' + b.staffNo + ' is already in use.', { fields: { staffNo: ['Already in use.'] } });
  if (b.email && await db.staffRecord.findFirst({ where: { email: { equals: b.email, mode: 'insensitive' } } })) throw badRequest('That email address already belongs to another staff record.', { fields: { email: ['Already in use.'] } });
  const { reason, ...data } = b;
  try {
    const s = await db.$transaction(async tx => {
      const r = await tx.staffRecord.create({ data, include: STAFF_INCLUDE });
      if (r.departmentId != null || r.stationId != null) await tx.staffPlacementHistory.create({ data: { staffId: r.id, departmentId: r.departmentId, stationId: r.stationId, reason: reason || 'New staff record', changedById: ctx.account.id } });
      await audit({ actorId: ctx.account.id, action: 'staff.create', entityType: 'StaffRecord', entityId: r.id, after: auditStaff(r), ip: clientIp(req) }, tx);
      return r;
    });
    return json({ row: staffRow(s) }, 201);
  } catch (e) { const m = duplicateMessage(e, 'staff record'); if (m) throw badRequest(m); throw e; }
});
