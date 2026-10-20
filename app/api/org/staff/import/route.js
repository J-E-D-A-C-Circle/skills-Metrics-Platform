// Route POST /api/org/staff/import · bulk staff import from Excel / CSV: check every row (mode=check), then save
//   all rows in one transaction (mode=import) only when no row has an error
// =============================================================================
// Used by: components/SMOrganisation.jsx (Staff Records > Import staff)
// Depends on: zod, lib/server/{db,session,audit,http,org}
// Sections (search for these markers): IMPORT · Reading the file, IMPORT · Checking rows, IMPORT · Saving
// Needs "Manage staff records". Body (JSON): { mode: 'check' | 'import', fileName, sheetName, sheet: [[cell, ...], ...] }.
// The browser reads the Excel / CSV file and sends only its cell text, so the server never parses an uploaded
// binary file (the installed xlsx library has known problems with crafted files). Sizes are capped below.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { z } from 'zod';
import { json, handle, badRequest, clientIp, readBody } from '@/lib/server/http';
import { validateImport } from '@/lib/server/org';

// ===== IMPORT · Reading the file =====
// At most 5,000 rows of 40 cells, each cell at most 500 characters.
const Body = z.object({
  mode: z.enum(['check', 'import']).default('check'), fileName: z.string().trim().max(200).default('upload'), sheetName: z.string().trim().max(100).default(''),
  sheet: z.array(z.array(z.union([z.string().max(500), z.number(), z.boolean(), z.null()]).transform(v => (v == null ? '' : String(v)))).max(40)).max(5001),
});
async function readSheet(req) {
  const b = await readBody(req, Body);
  if (!b.sheet.length) throw badRequest('The file has no rows.');
  return { sheet: b.sheet, mode: b.mode, fileName: b.fileName, sheetName: b.sheetName };
}

export const POST = handle(async req => {
  const ctx = await requirePermission('org.staff');
  const { sheet, mode, fileName, sheetName } = await readSheet(req);

  // ===== IMPORT · Checking rows =====
  const [departments, grades, stations, existingStaff] = await Promise.all([
    db.department.findMany(), db.grade.findMany(), db.station.findMany({ include: { location: true } }),
    db.staffRecord.findMany({ select: { id: true, staffNo: true, email: true } }),
  ]);
  const { fileErrors, rows } = validateImport(sheet, { departments, grades, stations, existingStaff, allowedDeptIds: ctx.visibleDepartmentIds });
  const invalid = rows.filter(r => r.errors.length).length;
  const summary = { fileName, sheetName, total: rows.length, valid: rows.length - invalid, invalid, fileErrors, rows: rows.map(({ row, staffNo, name, errors }) => ({ row, staffNo, name, errors })) };
  if (mode === 'check' || fileErrors.length || invalid) {
    if (mode === 'import') await audit({ actorId: ctx.account.id, action: 'staff.import', entityType: 'StaffRecord', outcome: 'FAILURE', after: { fileName, total: rows.length, invalid, fileErrors }, ip: clientIp(req) });
    return json({ ...summary, imported: 0 }, mode === 'import' ? 400 : 200);
  }

  // ===== IMPORT · Saving =====
  // All or nothing: records first, then supervisors named further down the file, then placement history and one
  // audit row listing the Staff IDs.
  const created = await db.$transaction(async tx => {
    const byNo = new Map();
    for (const r of rows) {
      const { supervisorNo, ...data } = r.data;
      const s = await tx.staffRecord.create({ data });
      byNo.set(s.staffNo.toLowerCase(), s);
      if (s.departmentId != null || s.stationId != null) await tx.staffPlacementHistory.create({ data: { staffId: s.id, departmentId: s.departmentId, stationId: s.stationId, reason: 'Bulk import (' + fileName + ')', changedById: ctx.account.id } });
    }
    for (const r of rows) if (r.data.supervisorNo) await tx.staffRecord.update({ where: { id: byNo.get(r.staffNo.toLowerCase()).id }, data: { supervisorId: byNo.get(r.data.supervisorNo.toLowerCase()).id } });
    await audit({ actorId: ctx.account.id, action: 'staff.import', entityType: 'StaffRecord', after: { fileName, count: rows.length, staffNos: rows.map(r => r.staffNo) }, ip: clientIp(req) }, tx);
    return rows.length;
  }, { timeout: 120000, maxWait: 10000 });
  return json({ ...summary, imported: created }, 201);
});
