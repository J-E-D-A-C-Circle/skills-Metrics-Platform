// Route GET /api/dashboard/heatmap · Dashboards > Heatmap: group average per competency for each department,
//   grade or station
// =============================================================================
// Used by: components/SMOrgDashboard.jsx (Heatmap tab)
// Depends on: lib/server/{session,analytics,http}
// Sections (search for these markers): HEATMAP · Read
// Needs "Gap heatmap". People in scope only. Query: by = department | grade | station, assessmentId, departmentId.
// Each cell = mean of the people's final averages for that competency (lib/server/analytics.js), with how many
// people it covers and its Critical / Moderate / No Gap counts. Empty cells are "Not assessed", never 0.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { loadScope, filtersFrom, groupPeople, GROUP_KEYS, assessmentOptions } from '@/lib/server/analytics';
import { json, handle } from '@/lib/server/http';

// ===== HEATMAP · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('analytics.heatmap');
  const url = new URL(req.url), f = filtersFrom(url), by = GROUP_KEYS[url.searchParams.get('by')] ? url.searchParams.get('by') : 'department';
  const d = await loadScope(ctx, { assessmentId: f.assessmentId, departmentId: f.departmentId });
  const rows = groupPeople(d.people, GROUP_KEYS[by], d.competencies, d.cfg).map(g => ({ id: g.id, name: g.name, people: g.people, peopleAssessed: g.peopleAssessed, overall: g.results.overall, overallDisplay: g.overallDisplay, cells: g.competencies }));
  return json({ assessments: await assessmentOptions(), by, rows, competencies: d.competencies });
});
