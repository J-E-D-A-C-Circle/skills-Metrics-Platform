// Route GET /api/org/staff/template · the Excel template for bulk staff import (Staff sheet + Lists + Example)
// =============================================================================
// Used by: components/SMOrganisation.jsx (Staff Records > Import staff > Download template)
// Depends on: xlsx, lib/server/{db,session,http,org}
// Sections (search for these markers): IMPORT TEMPLATE · Build
// Needs "Manage staff records". The Lists sheet shows the active departments, grades and stations to copy from.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { handle } from '@/lib/server/http';
import { IMPORT_COLUMNS } from '@/lib/server/org';

// ===== IMPORT TEMPLATE · Build =====
export const GET = handle(async () => {
  const ctx = await requirePermission('org.staff');
  const XLSX = await import('xlsx');
  const where = { active: true };
  const [departments, grades, stations] = await Promise.all([
    db.department.findMany({ where: ctx.visibleDepartmentIds === null ? where : { ...where, id: { in: ctx.visibleDepartmentIds } }, orderBy: { name: 'asc' } }),
    db.grade.findMany({ where, orderBy: { rank: 'asc' } }),
    db.station.findMany({ where, orderBy: { name: 'asc' }, include: { location: true } }),
  ]);
  const head = IMPORT_COLUMNS.map(c => c[1]);
  const wb = XLSX.utils.book_new();
  const staff = XLSX.utils.aoa_to_sheet([head]);
  staff['!cols'] = head.map(h => ({ wch: Math.max(14, h.length + 4) }));
  XLSX.utils.book_append_sheet(wb, staff, 'Staff');
  const n = Math.max(departments.length, grades.length, stations.length);
  const lists = [['Department', 'Department code', 'Grade', 'Station', 'Station (Location)', 'Status']];
  for (let i = 0; i < Math.max(n, 3); i++) lists.push([departments[i]?.name || '', departments[i]?.code || '', grades[i]?.name || '', stations[i]?.name || '', stations[i] ? (stations[i].name === stations[i].location.name ? stations[i].name : stations[i].name + ' (' + stations[i].location.name + ')') : '', ['Active', 'Inactive', 'Left'][i] || '']);
  const ls = XLSX.utils.aoa_to_sheet(lists); ls['!cols'] = lists[0].map(() => ({ wch: 32 }));
  XLSX.utils.book_append_sheet(wb, ls, 'Lists');
  const ex = XLSX.utils.aoa_to_sheet([head,
    ['DV-1001', 'Ama', 'Mensah', '', 'ama.mensah@dvla.gov.gh', 'Officer', departments[0]?.name || 'IT Department', grades[1]?.name || '', stations[0]?.name || '', '', 'Active'],
    ['DV-1002', 'Kofi', 'Ofori', 'Yaw', '', 'Assistant Officer', departments[0]?.code || 'IT', grades[0]?.name || '', stations[0]?.name || '', 'DV-1001', 'Active'],
    [], ['Notes: Staff ID, First name and Last name are required. Department may be the name or the code. Supervisor Staff ID may be an existing Staff ID or one further down the same file. Only the Staff sheet is imported.']]);
  ex['!cols'] = head.map(() => ({ wch: 20 }));
  XLSX.utils.book_append_sheet(wb, ex, 'Example');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="staff-import-template.xlsx"', 'Cache-Control': 'no-store' } });
});
