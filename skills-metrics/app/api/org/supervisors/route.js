// Route GET /api/org/supervisors · the Supervisors tab: department supervisor / HoD assignments, the accounts that can
//   be assigned, grade-to-station-manager mappings, and who supervises how many staff
// =============================================================================
// Used by: components/SMOrganisation.jsx (Supervisors tab)
// Depends on: lib/server/{db,session,scope,http,org}
// Sections (search for these markers): SUPERVISORS · Read
// Needs "View organisation". Someone with a department scope only sees assignments, accounts and staff in the
// departments they can see.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { staffWhere } from '@/lib/server/scope';
import { json, handle } from '@/lib/server/http';
import { fullName } from '@/lib/server/org';

// ===== SUPERVISORS · Read =====
export const GET = handle(async () => {
  const ctx = await requirePermission('org.view');
  const ids = ctx.visibleDepartmentIds, inScope = ids === null ? {} : { departmentId: { in: ids } };
  const acct = { id: true, username: true, displayName: true, status: true, deptScope: true, staff: { select: { id: true, staffNo: true, department: { select: { id: true, name: true } } } } };
  const [assignments, candidates, mappings, supervisors, noSupervisor, inScopeTotal] = await Promise.all([
    db.supervisorAssignment.findMany({ where: inScope, include: { account: { select: acct }, department: { select: { id: true, name: true, active: true } } }, orderBy: [{ department: { name: 'asc' } }, { id: 'asc' }] }),
    db.account.findMany({ where: { status: { not: 'DISABLED' }, roles: { some: { role: 'SUPERVISOR' } }, ...(ids === null ? {} : { staff: { departmentId: { in: ids } } }) }, select: acct, orderBy: { displayName: 'asc' } }),
    db.gradeSupervisoryMapping.findMany({ include: { grade: { select: { id: true, name: true, rank: true } }, station: { select: { id: true, name: true, location: { select: { name: true } } } } }, orderBy: [{ grade: { rank: 'desc' } }, { id: 'asc' }] }),
    db.staffRecord.findMany({ where: { AND: [staffWhere(ctx, { includeSelf: true }), { reports: { some: {} } }] }, select: { id: true, staffNo: true, firstName: true, lastName: true, otherNames: true, status: true, department: { select: { name: true } }, _count: { select: { reports: true } } }, orderBy: { lastName: 'asc' } }),
    db.staffRecord.count({ where: { AND: [staffWhere(ctx), { supervisorId: null, status: 'ACTIVE' }] } }),
    db.staffRecord.count({ where: { AND: [staffWhere(ctx), { status: 'ACTIVE' }] } }),
  ]);
  const accountRow = a => ({ id: a.id, username: a.username, name: a.displayName, status: a.status, scope: a.deptScope, staffNo: a.staff?.staffNo || null, department: a.staff?.department?.name || null });
  return json({
    assignments: assignments.map(s => ({ id: s.id, account: accountRow(s.account), department: s.department, createdAt: s.createdAt })),
    candidates: candidates.map(accountRow),
    mappings: mappings.map(m => ({ id: m.id, roleLabel: m.roleLabel, grade: m.grade, station: m.station ? { id: m.station.id, name: m.station.name, location: m.station.location?.name } : null })),
    supervisors: supervisors.map(s => ({ id: s.id, staffNo: s.staffNo, name: fullName(s), status: s.status, department: s.department?.name || null, reports: s._count.reports })),
    noSupervisor, activeStaff: inScopeTotal,
  });
});
