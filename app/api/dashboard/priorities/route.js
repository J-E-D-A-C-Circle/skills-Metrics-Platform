// Route GET /api/dashboard/priorities · Development Priorities: competencies with the biggest gaps in scope and the
//   people who need development in each
// =============================================================================
// Used by: components/SMPriorities.jsx (All Needs and Top Training Needs tabs)
// Depends on: lib/server/{session,analytics,http}, lib/scoring.js
// Sections (search for these markers): PRIORITIES · Read
// Needs "Development priorities"; view=top also needs "Top priorities". People in scope only.
// Query: view (all | top), departmentId, gradeId, stationId, assessmentId.
// Ranking (same as the Reports gap analysis): most Critical Gaps, then most Moderate Gaps, then the lower average.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { loadScope, filtersFrom, statsFor, rankPriorities, needingDevelopment, groupPeople, GROUP_KEYS, assessmentOptions } from '@/lib/server/analytics';
import { formatAverage } from '@/lib/scoring';
import { json, handle, forbidden } from '@/lib/server/http';

// ===== PRIORITIES · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('training.view');
  const url = new URL(req.url), f = filtersFrom(url), top = url.searchParams.get('view') === 'top';
  if (top && !ctx.user.perms.includes('training.top')) throw forbidden();
  const d = await loadScope(ctx, { departmentId: f.departmentId, gradeId: f.gradeId, stationId: f.stationId, assessmentId: f.assessmentId });
  const all = statsFor(d.people, d.competencies, d.cfg).map(s => ({ ...s, display: formatAverage(s.average) }));
  const ranked = rankPriorities(all);
  const assessments = await assessmentOptions();
  if (top) {
    // Top 10 overall, plus each department's three biggest needs.
    const depts = groupPeople(d.people, GROUP_KEYS.department, d.competencies, d.cfg).map(g => ({ id: g.id, name: g.name, people: g.people,
      top: rankPriorities(Object.values(g.competencies).map(s => ({ ...s, name: d.competencies.find(c => c.id === s.competencyId)?.name, display: formatAverage(s.average) }))).slice(0, 3) }));
    return json({ top: ranked.slice(0, 10), departments: depts, people: d.people.length, assessments });
  }
  return json({
    priorities: ranked.map(s => ({ ...s, people: needingDevelopment(d.people, s.competencyId) })),
    noGap: all.filter(s => s.assessed && s.critical + s.moderate === 0), people: d.people.length,
    peopleNeeding: d.people.filter(p => Object.values(p.results).some(r => r.gapStatus !== 'NONE')).length, assessments,
  });
});
