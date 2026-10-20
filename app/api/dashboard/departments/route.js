// Route GET /api/dashboard/departments · Dashboards > Departments: every department in scope side by side
// =============================================================================
// Used by: components/SMOrgDashboard.jsx (Departments tab)
// Depends on: lib/server/{session,analytics,http}, lib/scoring.js
// Sections (search for these markers): DEPARTMENTS · Read
// Needs "Department breakdown". Only departments (and direct reports) in the person's scope. Query: assessmentId.
// Per department: staff, completion (denominator = assigned and open), overdue, overall average (mean of every
// person × competency final average), gap and status counts, and each competency's group average.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { loadScope, filtersFrom, groupPeople, groupSummary, GROUP_KEYS, assessmentOptions } from '@/lib/server/analytics';
import { formatAverage } from '@/lib/scoring';
import { json, handle } from '@/lib/server/http';

// ===== DEPARTMENTS · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('analytics.departments');
  const f = filtersFrom(new URL(req.url));
  const d = await loadScope(ctx, { assessmentId: f.assessmentId });
  const all = groupSummary(d.people);
  return json({ assessments: await assessmentOptions(), departments: groupPeople(d.people, GROUP_KEYS.department, d.competencies, d.cfg), competencies: d.competencies, total: { ...all, overallDisplay: formatAverage(all.results.overall) } });
});
