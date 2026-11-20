// Route GET /api/dashboard/priorities/export · download Development Priorities (CSV or Excel)
// =============================================================================
// Used by: components/SMPriorities.jsx (Export)
// Depends on: lib/server/{session,analytics,audit,http}
// Sections (search for these markers): PRIORITIES EXPORT · Build file
// Needs "Export priorities". Same scope, filters and ranking as GET /api/dashboard/priorities: one row per
// competency and person who needs development (Critical or Moderate Gap). format = csv | xlsx. Audited.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { loadScope, filtersFrom, statsFor, rankPriorities, needingDevelopment, fileResponse } from '@/lib/server/analytics';
import { formatAverage, GAP_LABEL, COMPETENCY_LABEL } from '@/lib/scoring';
import { audit } from '@/lib/server/audit';
import { handle, clientIp } from '@/lib/server/http';

// ===== PRIORITIES EXPORT · Build file =====
export const GET = handle(async req => {
  const ctx = await requirePermission('training.export');
  const url = new URL(req.url), f = filtersFrom(url), format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const d = await loadScope(ctx, { departmentId: f.departmentId, gradeId: f.gradeId, stationId: f.stationId, assessmentId: f.assessmentId });
  const ranked = rankPriorities(statsFor(d.people, d.competencies, d.cfg));
  const rows = ranked.flatMap(s => needingDevelopment(d.people, s.competencyId).map(p => ({
    Rank: s.rank, Competency: s.name, Category: s.category || '', 'People assessed': s.assessed, 'Group average': formatAverage(s.average), 'Critical Gaps': s.critical, 'Moderate Gaps': s.moderate,
    'Staff ID': p.staffNo, Name: p.name, Department: p.department || '', Grade: p.grade || '', 'Final average': p.display, 'Attempts included': p.attemptsIncluded,
    'Competency status': COMPETENCY_LABEL[p.competencyStatus], 'Gap status': GAP_LABEL[p.gapStatus],
  })));
  const headers = ['Rank', 'Competency', 'Category', 'People assessed', 'Group average', 'Critical Gaps', 'Moderate Gaps', 'Staff ID', 'Name', 'Department', 'Grade', 'Final average', 'Attempts included', 'Competency status', 'Gap status'];
  await audit({ actorId: ctx.account.id, action: 'export.development-priorities', entityType: 'Export', entityId: 'development-priorities', after: { format, filters: f, rows: rows.length }, ip: clientIp(req) });
  return fileResponse('development-priorities-' + new Date().toISOString().slice(0, 10), headers, rows, format);
});
