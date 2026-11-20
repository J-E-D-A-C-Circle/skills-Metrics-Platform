// Route GET /api/reports/staff · the staff a person may pick for the individual reports (their scope only)
// =============================================================================
// Used by: components/SMReports.jsx (Staff member filter)
// Depends on: lib/server/{db,session,scope,http}
// Sections (search for these markers): REPORT STAFF · Read
// Needs "View reports". Filtered through lib/server/scope.js, so a supervisor only sees their departments and
// direct reports. Includes people who have left (their history is still reportable). ?q= narrows by name or Staff ID.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { staffWhere } from '@/lib/server/scope';
import { json, handle } from '@/lib/server/http';

// ===== REPORT STAFF · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('reports.view');
  const q = (req.nextUrl.searchParams.get('q') || '').trim().slice(0, 60);
  const and = [staffWhere(ctx)];
  if (q) and.push({ OR: [{ firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } }, { staffNo: { contains: q, mode: 'insensitive' } }] });
  const rows = await db.staffRecord.findMany({ where: { AND: and }, take: 1000, orderBy: [{ firstName: 'asc' }, { lastName: 'asc' }],
    select: { id: true, staffNo: true, firstName: true, lastName: true, status: true, department: { select: { name: true } } } });
  return json({ staff: rows.map(s => ({ id: s.id, staffNo: s.staffNo, name: s.firstName + ' ' + s.lastName, department: s.department?.name || null, status: s.status })) });
});
