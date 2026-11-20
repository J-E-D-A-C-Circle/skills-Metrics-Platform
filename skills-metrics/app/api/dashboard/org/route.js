// Route GET /api/dashboard/org · Dashboards > Overview: KPIs, completion, competency and gap figures, trend
// =============================================================================
// Used by: components/SMOrgDashboard.jsx (Overview tab)
// Depends on: lib/server/{db,session,analytics,http}, lib/scoring.js
// Sections (search for these markers): ORG DASHBOARD · Read, ORG DASHBOARD · Trend
// Needs "Organisation dashboard". Everything is limited to the person's scope (lib/server/scope.js via
// loadScope). Query: departmentId, assessmentId. Group averages follow the rule in lib/server/analytics.js.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { loadScope, filtersFrom, groupSummary, byAssessment, statsFor, rankPriorities, assessmentOptions } from '@/lib/server/analytics';
import { formatAverage } from '@/lib/scoring';
import { json, handle } from '@/lib/server/http';

// ===== ORG DASHBOARD · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('analytics.view');
  const f = filtersFrom(new URL(req.url));
  const d = await loadScope(ctx, { departmentId: f.departmentId, assessmentId: f.assessmentId });
  const sum = groupSummary(d.people), stats = statsFor(d.people, d.competencies, d.cfg);
  return json({ assessments: await assessmentOptions(),
    summary: { ...sum, overallDisplay: formatAverage(sum.results.overall) }, participation: byAssessment(d.people, d.now),
    competencies: stats.map(s => ({ ...s, display: formatAverage(s.average) })), priorities: rankPriorities(stats).slice(0, 8),
    trend: await trend(d.people.map(p => p.id), f.assessmentId),
  });
});

// ===== ORG DASHBOARD · Trend =====
// Per month (last 12): completed attempts and the mean competency score in those attempts (attempt-level, so it
// shows movement over time; it is not a final average).
async function trend(ids, assessmentId) {
  if (!ids.length) return [];
  const since = new Date(); since.setMonth(since.getMonth() - 11, 1); since.setHours(0, 0, 0, 0);
  const attempts = await db.attempt.findMany({ where: { staffId: { in: ids }, status: 'COMPLETED', completedAt: { gte: since }, ...(assessmentId ? { assessmentId } : {}) }, select: { completedAt: true, results: { select: { score: true } } } });
  const m = new Map();
  for (const a of attempts) {
    const k = a.completedAt.toISOString().slice(0, 7), cur = m.get(k) || { month: k, attempts: 0, sum: 0, n: 0 };
    cur.attempts++; for (const r of a.results) { cur.sum += Number(r.score); cur.n++; }
    m.set(k, cur);
  }
  return [...m.values()].sort((a, b) => a.month.localeCompare(b.month)).map(x => ({ month: x.month, attempts: x.attempts, average: x.n ? x.sum / x.n : null, display: x.n ? formatAverage(x.sum / x.n) : '—' }));
}
