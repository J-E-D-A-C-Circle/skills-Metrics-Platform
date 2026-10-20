// Route GET /api/assignments/staff · staff picker for "Assign to individual staff" (only people the user may see)
// =============================================================================
// Used by: components/SMAssignments.jsx (New assignment drawer)
// Depends on: lib/server/{db,session,scope,http}, ../progress.js
// Sections (search for these markers): STAFF PICKER · Read
// Needs "Assign assessments". Filtered through lib/server/scope.js, so a supervisor only finds staff in their
// departments or who report to them. Returns names and IDs only (no contact details or results).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { staffWhere } from '@/lib/server/scope';
import { json, handle } from '@/lib/server/http';
import { staffName } from '../progress';

// ===== STAFF PICKER · Read =====
// Query: q (name or staff ID, 0-80 characters), departmentId. At most 30 matches, active staff only.
export const GET = handle(async req => {
  const ctx = await requirePermission('cycles.assign');
  const p = req.nextUrl.searchParams, q = (p.get('q') || '').trim().slice(0, 80), dept = Number(p.get('departmentId')) || null;
  const and = [staffWhere(ctx), { status: 'ACTIVE' }];
  if (dept) and.push({ departmentId: dept });
  for (const w of q.split(/\s+/).filter(Boolean)) and.push({ OR: [{ firstName: { contains: w, mode: 'insensitive' } }, { lastName: { contains: w, mode: 'insensitive' } }, { otherNames: { contains: w, mode: 'insensitive' } }, { staffNo: { contains: w, mode: 'insensitive' } }] });
  const rows = await db.staffRecord.findMany({ where: { AND: and }, take: 30, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    select: { id: true, staffNo: true, firstName: true, lastName: true, otherNames: true, department: { select: { name: true } }, grade: { select: { name: true } } } });
  return json({ staff: rows.map(s => ({ id: s.id, staffNo: s.staffNo, name: staffName(s), department: s.department?.name || null, grade: s.grade?.name || null })) });
});
