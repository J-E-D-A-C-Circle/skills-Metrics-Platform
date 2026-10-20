// =============================================================================
// analytics.js · Team, department and organisation figures: who is in scope, their progress on assigned
//   assessments, their final competency results, and the group totals the dashboards show
// Screen / URL: none; server only. Feeds Home (/), Team Results (/staff-evals), Dashboards (/analytics),
//   Development Priorities (/training), Competency Profile (/report?id=) and My Profile (/profile)
// Used by: app/api/dashboard/**, app/api/team/**, app/api/staff/**, app/api/me/**, tests/analytics.test.js
// Depends on: lib/server/{db,scope,assigned}.js, lib/scoring.js
// Sections (search for these markers): ANALYTICS · Scoring configuration, ANALYTICS · Assignment cover (bulk),
//   ANALYTICS · Progress, ANALYTICS · Person results, ANALYTICS · Group figures, ANALYTICS · Rows & filters,
//   ANALYTICS · Loading a scope, ANALYTICS · Team Results, ANALYTICS · One person's profile, ANALYTICS · CSV / Excel
// Rules used everywhere (keep Reports in step with these):
//   - Results come from FinalCompetencyResult (the cached average of COMPLETED attempts, lib/scoring.js).
//   - A person's result for a competency across several assessments = the average of every completed attempt
//     that assessed it = Σ(average × attemptsIncluded) / Σ attemptsIncluded. With an assessment filter, only
//     that assessment's row is used.
//   - GROUP AVERAGE RULE: a group's (team, department, grade, station, organisation) average for a competency
//     = the plain mean of each person's final average for that competency. People without a result are left
//     out (never counted as 0). A group's "overall average" = the plain mean of every person × competency
//     final average in the group.
//   - Competent / Proficient and gap status are worked out from the UNROUNDED average with the newest active
//     ScoringConfig (lib/scoring.js), so every screen classifies a value the same way.
//   - Progress (Not started / In progress / Completed / Overdue / Upcoming), deadlines with extensions and the
//     completion-rate denominator follow lib/server/assigned.js: completion rate = people-assessments with at
//     least one completed attempt ÷ people-assessments assigned and already open (start date reached).
// =============================================================================
import 'server-only';
import { db } from './db';
import { staffWhere } from './scope';
import { deadlineFor, progressStatus, attemptsUsed, attemptsCompleted, resultsReleased, assessmentsForStaff, PROGRESS_LABEL } from './assigned';
import { competencyStatus, gapStatus, gapValue, formatAverage, DEFAULT_CONFIG, COMPETENCY_LABEL, GAP_LABEL } from '../scoring';

// ===== ANALYTICS · Scoring configuration =====
// The newest active ScoringConfig as plain numbers (falls back to the defaults in lib/scoring.js).
export async function activeConfig(tx = db) {
  const c = await tx.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } });
  if (!c) return { ...DEFAULT_CONFIG, id: null, version: null };
  return { id: c.id, version: c.version, requiredLevel: Number(c.requiredLevel), competentFrom: Number(c.competentFrom), proficientFrom: Number(c.proficientFrom), moderateGapFrom: Number(c.moderateGapFrom), noGapFrom: Number(c.noGapFrom), defaultMaxAttempts: c.defaultMaxAttempts };
}

// ===== ANALYTICS · Assignment cover (bulk) =====
// In-memory twin of assignmentsCoveringWhere / assessmentsForStaff (lib/server/assigned.js) so a whole team is
// worked out from one query instead of one query per person. Same merge rule: one entry per assessment with the
// earliest start, the latest deadline (extensions included, via deadlineFor) and the highest attempt limit.
export function coversStaff(a, s) {
  switch (a.targetType) {
    case 'INDIVIDUAL': return a.staffId === s.id;
    case 'DEPARTMENT': return s.departmentId != null && a.departmentId === s.departmentId;
    case 'GRADE': return s.gradeId != null && a.gradeId === s.gradeId;
    case 'STATION': return s.stationId != null && a.stationId === s.stationId;
    case 'LOCATION': return s.station?.locationId != null && a.locationId === s.station.locationId;
    default: return false;
  }
}
const limitOf = a => a.maxAttempts ?? a.assessment?.maxAttempts ?? 3;
export function entriesFor(staff, assignments) {
  const by = new Map();
  for (const a of assignments) {
    if (!coversStaff(a, staff)) continue;
    const cur = by.get(a.assessmentId), dl = deadlineFor(a, staff.id), lim = limitOf(a);
    if (!cur) by.set(a.assessmentId, { assessment: a.assessment, assessmentId: a.assessmentId, assignmentIds: [a.id], startsAt: new Date(a.startsAt), deadline: dl, maxAttempts: lim });
    else {
      cur.assignmentIds.push(a.id);
      if (new Date(a.startsAt) < cur.startsAt) cur.startsAt = new Date(a.startsAt);
      if (dl > cur.deadline) cur.deadline = dl;
      if (lim > cur.maxAttempts) cur.maxAttempts = lim;
    }
  }
  return [...by.values()];
}

// ===== ANALYTICS · Progress =====
// One person's progress on each assigned assessment. attempts = that person's attempts (any assessment).
// remaining = attempts that can still be started: none once the deadline (with extensions) has passed.
export function progressFor(entries, attempts, now = new Date()) {
  return entries.map(e => {
    const mine = attempts.filter(a => a.assessmentId === e.assessmentId);
    const used = attemptsUsed(mine), done = attemptsCompleted(mine);
    const status = progressStatus(e, mine, now);
    return { assessmentId: e.assessmentId, title: e.assessment?.title || 'Assessment', startsAt: e.startsAt, deadline: e.deadline, maxAttempts: e.maxAttempts,
      used, completed: done, remaining: now > e.deadline ? 0 : Math.max(0, e.maxAttempts - used), status, statusLabel: PROGRESS_LABEL[status] };
  });
}
// A person's overall status across their assessments (used by the Status filter and the Team Results badge).
// Someone who has completed one assessment and not started another is "In progress" overall (work outstanding).
export function overallStatus(progress) {
  if (!progress.length) return 'NOT_ASSIGNED';
  const has = s => progress.some(p => p.status === s);
  if (has('OVERDUE')) return 'OVERDUE';
  if (progress.every(p => p.status === 'COMPLETED')) return 'COMPLETED';
  if (has('IN_PROGRESS') || (has('COMPLETED') && has('NOT_STARTED'))) return 'IN_PROGRESS';
  if (has('NOT_STARTED')) return 'NOT_STARTED';
  return has('COMPLETED') ? 'IN_PROGRESS' : 'UPCOMING';
}
export const STATUS_LABEL = { ...PROGRESS_LABEL, NOT_ASSIGNED: 'Not assigned' };
// Completion figures for a list of progress items (people × assessments). Denominator: items already open.
export function completionStats(items) {
  const n = s => items.filter(p => p.status === s).length;
  const open = items.filter(p => p.status !== 'UPCOMING').length, completed = n('COMPLETED');
  return { assigned: items.length, open, completed, inProgress: n('IN_PROGRESS'), notStarted: n('NOT_STARTED'), overdue: n('OVERDUE'), upcoming: n('UPCOMING'),
    outstanding: n('IN_PROGRESS') + n('NOT_STARTED') + n('OVERDUE'), rate: open ? completed / open : null };
}

// ===== ANALYTICS · Person results =====
// rows: FinalCompetencyResult rows for ONE person ({ competencyId, assessmentId, average, attemptsIncluded }).
// Returns { [competencyId]: { average, attemptsIncluded, assessments, competencyStatus, gapStatus, gap } }.
// Several assessments of the same competency are combined as the average of all their completed attempts.
export function personResults(rows, cfg = DEFAULT_CONFIG) {
  const acc = {};
  for (const r of rows) {
    const avg = Number(r.average), n = Number(r.attemptsIncluded) || 0;
    if (!Number.isFinite(avg) || n <= 0) continue;
    const a = acc[r.competencyId] || (acc[r.competencyId] = { sum: 0, n: 0, assessments: [] });
    a.sum += avg * n; a.n += n; a.assessments.push(r.assessmentId);
  }
  const out = {};
  for (const [cid, a] of Object.entries(acc)) {
    const average = a.sum / a.n;
    out[cid] = { average, attemptsIncluded: a.n, assessments: a.assessments, competencyStatus: competencyStatus(average, cfg), gapStatus: gapStatus(average, cfg), gap: gapValue(average, cfg) };
  }
  return out;
}
// Counts for one person's results map: { assessed, critical, moderate, none, notCompetent, competent, proficient, overall }.
// overall = plain mean of the person's competency averages (shown as "Overall average", labelled separately).
export function resultCounts(results) {
  const list = Object.values(results || {});
  const c = { assessed: list.length, critical: 0, moderate: 0, none: 0, notCompetent: 0, competent: 0, proficient: 0, overall: null };
  for (const r of list) {
    if (r.gapStatus === 'CRITICAL') c.critical++; else if (r.gapStatus === 'MODERATE') c.moderate++; else if (r.gapStatus === 'NONE') c.none++;
    if (r.competencyStatus === 'NOT_COMPETENT') c.notCompetent++; else if (r.competencyStatus === 'COMPETENT') c.competent++; else if (r.competencyStatus === 'PROFICIENT') c.proficient++;
  }
  if (list.length) c.overall = list.reduce((s, r) => s + r.average, 0) / list.length;
  return c;
}

// ===== ANALYTICS · Group figures =====
// people: [{ results: { [cid]: personResult } }]. GROUP AVERAGE RULE (see the file header): the mean of the
// people's final averages for that competency; people not assessed are left out.
export function competencyStats(people, competencyId, cfg = DEFAULT_CONFIG) {
  const s = { competencyId: Number(competencyId), assessed: 0, average: null, critical: 0, moderate: 0, none: 0, notCompetent: 0, competent: 0, proficient: 0 };
  let sum = 0;
  for (const p of people) {
    const r = p.results && p.results[competencyId];
    if (!r) continue;
    s.assessed++; sum += r.average;
    if (r.gapStatus === 'CRITICAL') s.critical++; else if (r.gapStatus === 'MODERATE') s.moderate++; else if (r.gapStatus === 'NONE') s.none++;
    if (r.competencyStatus === 'NOT_COMPETENT') s.notCompetent++; else if (r.competencyStatus === 'COMPETENT') s.competent++; else if (r.competencyStatus === 'PROFICIENT') s.proficient++;
  }
  if (s.assessed) {
    s.average = sum / s.assessed;
    s.competencyStatus = competencyStatus(s.average, cfg); s.gapStatus = gapStatus(s.average, cfg); s.gap = gapValue(s.average, cfg);
  }
  return s;
}
// Every competency that has at least one result among the people.
export const competencyIdsOf = people => [...new Set(people.flatMap(p => Object.keys(p.results || {}).map(Number)))];
// Totals for a group: result counts over every person × competency result, people with a critical gap, the
// overall average (mean of every person × competency average) and completion figures.
export function groupSummary(people) {
  const all = people.flatMap(p => Object.values(p.results || {}));
  const c = resultCounts(Object.fromEntries(all.map((r, i) => [i, r])));
  return {
    people: people.length, peopleAssessed: people.filter(p => Object.keys(p.results || {}).length).length,
    peopleWithCritical: people.filter(p => Object.values(p.results || {}).some(r => r.gapStatus === 'CRITICAL')).length,
    peopleAllProficient: people.filter(p => { const v = Object.values(p.results || {}); return v.length && v.every(r => r.competencyStatus === 'PROFICIENT'); }).length,
    results: c, completion: completionStats(people.flatMap(p => p.progress || [])),
  };
}
// Priority ranking for development needs (the same order as the Reports gap analysis): most Critical Gaps first,
// then most Moderate Gaps, then the lower group average. Competencies where nobody has a gap are left out.
export function rankPriorities(stats) {
  return [...stats].filter(s => s.assessed && s.critical + s.moderate > 0)
    .sort((a, b) => b.critical - a.critical || b.moderate - a.moderate || (a.average ?? 9) - (b.average ?? 9) || a.competencyId - b.competencyId)
    .map((s, i) => ({ ...s, rank: i + 1, needDevelopment: s.critical + s.moderate, needShare: s.assessed ? (s.critical + s.moderate) / s.assessed : null }));
}

// Participation per assessment across the people: completion figures and the next deadline still outstanding.
export function byAssessment(people, now = new Date()) {
  const m = new Map();
  for (const p of people) for (const x of p.progress || []) {
    const cur = m.get(x.assessmentId) || { id: x.assessmentId, title: x.title, items: [], nextDeadline: null };
    cur.items.push(x);
    if (['NOT_STARTED', 'IN_PROGRESS'].includes(x.status) && x.deadline > now && (!cur.nextDeadline || x.deadline < cur.nextDeadline)) cur.nextDeadline = x.deadline;
    m.set(x.assessmentId, cur);
  }
  return [...m.values()].map(a => ({ id: a.id, title: a.title, nextDeadline: a.nextDeadline, ...completionStats(a.items) })).sort((a, b) => a.title.localeCompare(b.title));
}
// Per-competency figures for every competency (with names), in the order given.
export function statsFor(people, competencies, cfg = DEFAULT_CONFIG) {
  return competencies.map(c => ({ ...competencyStats(people, c.id, cfg), name: c.name, short: c.short, category: c.category, group: c.group }));
}
// People split into groups (department, grade, station ...): keyOf(person) -> [key, label]; people with no key are
// grouped under "Not set". Each group gets its summary and per-competency figures.
export function groupPeople(people, keyOf, competencies, cfg = DEFAULT_CONFIG) {
  const m = new Map();
  for (const p of people) {
    const [k, label] = keyOf(p);
    const key = k ?? 'none', g = m.get(key) || { id: k ?? null, name: label || 'Not set', people: [] };
    g.people.push(p); m.set(key, g);
  }
  return [...m.values()].map(g => {
    const sum = groupSummary(g.people);
    return { id: g.id, name: g.name, ...sum, overallDisplay: formatAverage(sum.results.overall), competencies: Object.fromEntries(statsFor(g.people, competencies, cfg).map(s => [s.competencyId, s])) };
  }).sort((a, b) => String(a.name).localeCompare(String(b.name)));
}
export const GROUP_KEYS = {
  department: p => [p.departmentId, p.department], grade: p => [p.gradeId, p.grade], station: p => [p.stationId, p.station ? p.station + (p.location ? ' · ' + p.location : '') : null],
};
// People needing development in one competency: Critical first, then Moderate, lowest average first.
export function needingDevelopment(people, competencyId) {
  return people.filter(p => ['CRITICAL', 'MODERATE'].includes(p.results[competencyId]?.gapStatus))
    .map(p => { const r = p.results[competencyId]; return { id: p.id, staffNo: p.staffNo, name: p.name, department: p.department, grade: p.grade, average: r.average, display: formatAverage(r.average), gapStatus: r.gapStatus, competencyStatus: r.competencyStatus, attemptsIncluded: r.attemptsIncluded }; })
    .sort((a, b) => (a.gapStatus === b.gapStatus ? 0 : a.gapStatus === 'CRITICAL' ? -1 : 1) || a.average - b.average || a.name.localeCompare(b.name));
}

// ===== ANALYTICS · Rows & filters =====
export const fullName = s => [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(' ');
// Status filter: a progress status (that assessment's, or the person's overall status).
// Gap filter: CRITICAL / MODERATE / NONE = has at least one such result (or, with a competency chosen, that
// competency's result is that); NOT_ASSESSED = no result.
export function matchesFilters(p, f) {
  if (f.status && p.status !== f.status) return false;
  if (f.gap) {
    const list = f.competencyId ? [p.results[f.competencyId]].filter(Boolean) : Object.values(p.results);
    if (f.gap === 'NOT_ASSESSED') { if (list.length) return false; }
    else if (!list.some(r => r.gapStatus === f.gap)) return false;
  }
  if (f.q) {
    const t = f.q.toLowerCase();
    if (!(p.name + ' ' + p.staffNo + ' ' + (p.department || '') + ' ' + (p.designation || '')).toLowerCase().includes(t)) return false;
  }
  return true;
}
const SORTS = {
  name: p => p.name.toLowerCase(), staffNo: p => p.staffNo, department: p => (p.department || '').toLowerCase(),
  average: p => (p.counts.overall ?? -1), critical: p => p.counts.critical, moderate: p => p.counts.moderate, status: p => p.status,
  competency: (p, f) => (p.results[f.competencyId]?.average ?? -1),
};
export function sortPeople(list, key = 'name', dir = 'asc', f = {}) {
  const get = SORTS[key] || SORTS.name, m = dir === 'desc' ? -1 : 1;
  return [...list].sort((a, b) => { const x = get(a, f), y = get(b, f); return (x < y ? -1 : x > y ? 1 : 0) * m || a.name.localeCompare(b.name); });
}
// The JSON row for one person (results keyed by competency id, values ready to show).
export function personRow(p) {
  const results = Object.fromEntries(Object.entries(p.results).map(([cid, r]) => [cid, { average: r.average, display: formatAverage(r.average), attemptsIncluded: r.attemptsIncluded, competencyStatus: r.competencyStatus, gapStatus: r.gapStatus, gap: r.gap }]));
  const outstanding = p.progress.filter(x => ['NOT_STARTED', 'IN_PROGRESS', 'OVERDUE'].includes(x.status));
  const nextDeadline = outstanding.map(x => x.deadline).sort((a, b) => a - b)[0] || null;
  return { id: p.id, staffNo: p.staffNo, name: p.name, designation: p.designation, department: p.department, departmentId: p.departmentId, grade: p.grade, gradeId: p.gradeId, station: p.station, location: p.location,
    status: p.status, statusLabel: STATUS_LABEL[p.status], progress: p.progress, assigned: p.progress.length, completed: p.progress.filter(x => x.status === 'COMPLETED').length,
    outstanding: outstanding.length, overdue: p.progress.filter(x => x.status === 'OVERDUE').length, nextDeadline,
    counts: { ...p.counts, overallDisplay: formatAverage(p.counts.overall) }, results };
}

// ===== ANALYTICS · Loading a scope =====
// Everyone the signed-in person may see (lib/server/scope.js), narrowed by filters, with progress and results.
// filters: { assessmentId, departmentId, gradeId, stationId, locationId, competencyId, includeSelf }
// Supervisors and administrators see results in their scope whether or not they are released to the staff member.
export async function loadScope(ctx, filters = {}, tx = db) {
  const f = filters, now = new Date();
  const where = { AND: [staffWhere(ctx, { includeSelf: !!f.includeSelf }), { status: 'ACTIVE' }] };
  if (f.departmentId) where.AND.push({ departmentId: f.departmentId });
  if (f.gradeId) where.AND.push({ gradeId: f.gradeId });
  if (f.stationId) where.AND.push({ stationId: f.stationId });
  if (f.locationId) where.AND.push({ station: { locationId: f.locationId } });
  const [cfg, staff, assignments] = await Promise.all([
    activeConfig(tx),
    tx.staffRecord.findMany({ where, include: { department: true, grade: true, station: { include: { location: true } } }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    tx.assessmentAssignment.findMany({ where: { ...(f.assessmentId ? { assessmentId: f.assessmentId } : {}), assessment: { status: { in: ['PUBLISHED', 'ARCHIVED'] } } },
      include: { extensions: true, assessment: { select: { id: true, title: true, status: true, maxAttempts: true, resultRelease: true, resultsReleasedAt: true } } } }),
  ]);
  const ids = staff.map(s => s.id);
  const [attempts, finals] = ids.length ? await Promise.all([
    tx.attempt.findMany({ where: { staffId: { in: ids }, ...(f.assessmentId ? { assessmentId: f.assessmentId } : {}) }, select: { id: true, staffId: true, assessmentId: true, status: true, attemptNo: true, startedAt: true, completedAt: true } }),
    tx.finalCompetencyResult.findMany({ where: { staffId: { in: ids }, ...(f.assessmentId ? { assessmentId: f.assessmentId } : {}), ...(f.competencyId ? { competencyId: f.competencyId } : {}) }, select: { staffId: true, assessmentId: true, competencyId: true, average: true, attemptsIncluded: true } }),
  ]) : [[], []];
  const attemptsBy = groupBy(attempts, 'staffId'), finalsBy = groupBy(finals, 'staffId');
  const people = staff.map(s => {
    const progress = progressFor(entriesFor(s, assignments), attemptsBy.get(s.id) || [], now);
    const results = personResults(finalsBy.get(s.id) || [], cfg);
    return { id: s.id, staffNo: s.staffNo, name: fullName(s), designation: s.designation, department: s.department?.name || null, departmentId: s.departmentId, grade: s.grade?.name || null, gradeId: s.gradeId,
      station: s.station?.name || null, stationId: s.stationId, location: s.station?.location?.name || null, supervisorId: s.supervisorId,
      progress, status: overallStatus(progress), results, counts: resultCounts(results), attempts: attemptsBy.get(s.id) || [] };
  });
  const cids = competencyIdsOf(people);
  const competencies = cids.length ? await tx.competency.findMany({ where: { id: { in: cids } }, include: { category: true }, orderBy: { name: 'asc' } }) : [];
  return { cfg, people, competencies: competencies.map(c => ({ id: c.id, code: c.code, name: c.name, short: c.short, category: c.category?.name, group: c.category?.group, departmentId: c.departmentId })), now };
}
function groupBy(list, k) { const m = new Map(); for (const x of list) { const a = m.get(x[k]); if (a) a.push(x); else m.set(x[k], [x]); } return m; }
// Number from a query-string value (blank / bad -> undefined).
export const num = v => { const n = Number(v); return v != null && v !== '' && Number.isInteger(n) && n > 0 ? n : undefined; };
// The usual filters from a request URL.
export function filtersFrom(url) {
  const p = url.searchParams, up = v => (v ? String(v).toUpperCase() : undefined);
  const status = up(p.get('status')), gap = up(p.get('gap'));
  return { assessmentId: num(p.get('assessmentId')), departmentId: num(p.get('departmentId')), gradeId: num(p.get('gradeId')), stationId: num(p.get('stationId')), locationId: num(p.get('locationId')), competencyId: num(p.get('competencyId')),
    status: ['UPCOMING', 'NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'NOT_ASSIGNED'].includes(status) ? status : undefined,
    gap: ['CRITICAL', 'MODERATE', 'NONE', 'NOT_ASSESSED'].includes(gap) ? gap : undefined,
    q: (p.get('q') || '').trim().slice(0, 100) || undefined };
}

// Assessments people can be filtered by: published or archived ones that have been assigned.
export async function assessmentOptions(tx = db) {
  const list = await tx.assessment.findMany({ where: { status: { in: ['PUBLISHED', 'ARCHIVED'] }, assignments: { some: {} } }, select: { id: true, title: true, status: true }, orderBy: { title: 'asc' } });
  return list.map(a => ({ id: a.id, title: a.title + (a.status === 'ARCHIVED' ? ' (archived)' : '') }));
}

// ===== ANALYTICS · Team Results =====
// Everyone in scope after the filters, sorted, with the group summary (same list for the screen and the export).
export async function teamData(ctx, f, { sort = 'name', dir = 'asc' } = {}, tx = db) {
  const scope = await loadScope(ctx, f, tx);
  const people = sortPeople(scope.people.filter(p => matchesFilters(p, f)), sort, dir, f);
  const cids = new Set(competencyIdsOf(people));
  return { ...scope, people, competencies: scope.competencies.filter(c => cids.has(c.id)), summary: groupSummary(people) };
}
// One flat export row per person (and, with a competency chosen, that competency's result).
export function exportRow(r, competencies, f) {
  const row = { 'Staff ID': r.staffNo, Name: r.name, Department: r.department || '', Grade: r.grade || '', Station: r.station || '', Location: r.location || '',
    Status: r.statusLabel, 'Assessments assigned': r.assigned, Completed: r.completed, Outstanding: r.outstanding, Overdue: r.overdue,
    'Next deadline': r.nextDeadline ? new Date(r.nextDeadline).toISOString().slice(0, 10) : '',
    'Competencies assessed': r.counts.assessed, 'Overall average': r.counts.assessed ? r.counts.overallDisplay : 'Not assessed',
    'Critical Gaps': r.counts.critical, 'Moderate Gaps': r.counts.moderate, 'No Gap': r.counts.none, Competent: r.counts.competent, Proficient: r.counts.proficient };
  for (const c of competencies) {
    const x = r.results[c.id];
    row[c.name] = x ? x.display + ' · ' + COMPETENCY_LABEL[x.competencyStatus] + ' · ' + GAP_LABEL[x.gapStatus] : 'Not assessed';
  }
  return row;
}

// ===== ANALYTICS · One person's profile =====
// Details, assessments with progress, attempt history with per-competency scores, and final results.
// own = the person is looking at their own record: results of an assessment are only shown once released
// (lib/server/assigned.js resultsReleased). Others with permission see results in their scope at once.
export async function personProfile(staffId, { own = false } = {}, tx = db) {
  const s = await tx.staffRecord.findUnique({ where: { id: staffId }, include: { department: true, grade: true, station: { include: { location: true } }, supervisor: true } });
  if (!s) return null;
  const now = new Date();
  const [cfg, entries, attempts, finals] = await Promise.all([
    activeConfig(tx), assessmentsForStaff(s, tx),
    tx.attempt.findMany({ where: { staffId }, orderBy: [{ startedAt: 'desc' }], include: { assessment: { select: { id: true, title: true, resultRelease: true, resultsReleasedAt: true } }, version: { select: { versionNo: true } }, results: true } }),
    tx.finalCompetencyResult.findMany({ where: { staffId }, select: { assessmentId: true, competencyId: true, average: true, attemptsIncluded: true, computedAt: true } }),
  ]);
  const progress = progressFor(entries, attempts, now);
  const entryOf = id => entries.find(e => e.assessmentId === id) || null;
  const asmts = new Map();
  for (const e of entries) asmts.set(e.assessmentId, e.assessment);
  for (const a of attempts) if (!asmts.has(a.assessmentId)) asmts.set(a.assessmentId, a.assessment);
  const released = id => !own || resultsReleased(asmts.get(id), entryOf(id), now);
  const visibleFinals = finals.filter(r => released(r.assessmentId));
  const cids = [...new Set([...finals.map(r => r.competencyId), ...attempts.flatMap(a => a.results.map(r => r.competencyId))])];
  const comps = cids.length ? await tx.competency.findMany({ where: { id: { in: cids } }, include: { category: true } }) : [];
  const compOf = Object.fromEntries(comps.map(c => [c.id, { id: c.id, name: c.name, short: c.short, category: c.category?.name, group: c.category?.group, importance: c.importance, requiredLevel: c.requiredLevel == null ? null : Number(c.requiredLevel) }]));
  const show = r => ({ average: r.average, display: formatAverage(r.average), attemptsIncluded: r.attemptsIncluded, competencyStatus: r.competencyStatus, gapStatus: r.gapStatus, gap: r.gap,
    competencyLabel: COMPETENCY_LABEL[r.competencyStatus], gapLabel: GAP_LABEL[r.gapStatus] });
  // Combined over every (released) assessment, one row per competency.
  const combined = personResults(visibleFinals, cfg);
  const results = Object.entries(combined).map(([cid, r]) => ({ competency: compOf[cid] || { id: Number(cid), name: 'Competency ' + cid }, ...show(r) }))
    .sort((a, b) => a.average - b.average || a.competency.name.localeCompare(b.competency.name));
  // Per assessment: progress, attempts and that assessment's final results.
  const assessments = [...asmts.entries()].map(([id, asm]) => {
    const p = progress.find(x => x.assessmentId === id);
    const mine = attempts.filter(a => a.assessmentId === id);
    const ok = released(id);
    const rows = ok ? Object.entries(personResults(finals.filter(r => r.assessmentId === id), cfg)).map(([cid, r]) => ({ competency: compOf[cid] || { id: Number(cid), name: 'Competency ' + cid }, ...show(r) })).sort((a, b) => a.competency.name.localeCompare(b.competency.name)) : [];
    return { id, title: asm?.title || 'Assessment', assigned: !!p, status: p ? p.status : (mine.some(a => a.status === 'COMPLETED') ? 'COMPLETED' : 'NOT_ASSIGNED'),
      statusLabel: p ? p.statusLabel : 'No longer assigned', startsAt: p?.startsAt || null, deadline: p?.deadline || null, maxAttempts: p?.maxAttempts ?? null,
      used: attemptsUsed(mine), completed: attemptsCompleted(mine), remaining: p ? p.remaining : 0, released: ok, results: rows,
      resultRelease: asm?.resultRelease || 'IMMEDIATE', resultsReleasedAt: asm?.resultsReleasedAt || null };
  }).sort((a, b) => a.title.localeCompare(b.title));
  const history = attempts.map(a => {
    const ok = released(a.assessmentId) && a.status === 'COMPLETED';
    return { id: a.id, assessmentId: a.assessmentId, title: a.assessment?.title || 'Assessment', attemptNo: a.attemptNo, versionNo: a.version?.versionNo ?? null, status: a.status,
      startedAt: a.startedAt, submittedAt: a.submittedAt, completedAt: a.completedAt, activeSeconds: a.activeSeconds, elapsedSeconds: a.elapsedSeconds, released: released(a.assessmentId),
      scores: ok ? a.results.map(r => ({ competency: compOf[r.competencyId] || { id: r.competencyId, name: 'Competency ' + r.competencyId }, score: Number(r.score), display: formatAverage(Number(r.score)), asked: r.asked, correct: r.correct }))
        .sort((x, y) => x.competency.name.localeCompare(y.competency.name)) : [] };
  });
  return {
    staff: { id: s.id, staffNo: s.staffNo, name: fullName(s), email: s.email, designation: s.designation, status: s.status, department: s.department?.name || null, departmentId: s.departmentId,
      grade: s.grade?.name || null, station: s.station?.name || null, location: s.station?.location?.name || null, supervisor: s.supervisor ? fullName(s.supervisor) : null },
    config: { version: cfg.version, requiredLevel: cfg.requiredLevel, competentFrom: cfg.competentFrom, proficientFrom: cfg.proficientFrom, moderateGapFrom: cfg.moderateGapFrom, noGapFrom: cfg.noGapFrom },
    counts: { ...resultCounts(combined), overallDisplay: formatAverage(resultCounts(combined).overall) }, completion: completionStats(progress),
    results, assessments, history, pendingRelease: assessments.filter(a => !a.released && a.completed > 0).length,
  };
}

// ===== ANALYTICS · CSV / Excel =====
// Builds a download Response. format: 'csv' | 'xlsx'. rows: [{ header: value }].
const cell = v => { const s = String(v == null ? '' : v); return '"' + (/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };
export async function fileResponse(name, headers, rows, format = 'csv') {
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers });
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Data');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return new Response(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="' + name + '.xlsx"', 'Cache-Control': 'no-store' } });
  }
  const text = '﻿' + [headers.map(cell).join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\r\n');
  return new Response(text, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="' + name + '.csv"', 'Cache-Control': 'no-store' } });
}
