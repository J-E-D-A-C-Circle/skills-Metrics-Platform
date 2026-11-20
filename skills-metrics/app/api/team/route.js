// Route GET /api/team · Team Results: everyone in the signed-in person's scope with progress and final results
// =============================================================================
// Used by: components/SMTeamResults.jsx (table and matrix), components/SMOrgDashboard.jsx (heatmap drill-down)
// Depends on: lib/server/{session,analytics,http}
// Sections (search for these markers): TEAM RESULTS · Read
// Needs "View team results". Staff come from lib/server/scope.js (departments the person can see plus direct
// reports), so the filters below can only narrow that list. Query: assessmentId, departmentId, gradeId, stationId,
// locationId, competencyId, status, gap, q, sort, dir, page, pageSize (max 100).
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { teamData, filtersFrom, personRow, assessmentOptions, num } from '@/lib/server/analytics';
import { formatAverage } from '@/lib/scoring';
import { json, handle } from '@/lib/server/http';

// ===== TEAM RESULTS · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('staff-evals.view');
  const url = new URL(req.url), f = filtersFrom(url), p = url.searchParams;
  const pageSize = Math.min(100, num(p.get('pageSize')) || 25), page = num(p.get('page')) || 1;
  const sort = p.get('sort') || 'name', dir = p.get('dir') === 'desc' ? 'desc' : 'asc';
  const [d, assessments] = await Promise.all([teamData(ctx, f, { sort, dir }), assessmentOptions()]);
  const total = d.people.length, pages = Math.max(1, Math.ceil(total / pageSize)), at = Math.min(page, pages);
  const s = d.summary;
  return json({
    rows: d.people.slice((at - 1) * pageSize, at * pageSize).map(personRow), total, page: at, pages, pageSize,
    competencies: d.competencies, assessments,
    summary: { ...s, results: { ...s.results, overallDisplay: formatAverage(s.results.overall) } },
  });
});
