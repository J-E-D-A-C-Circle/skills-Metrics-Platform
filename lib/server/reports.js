// =============================================================================
// reports.js · The Reports module: every report is built here once, and the screen, Excel, PDF and CSV all use it
// Screen / URL: /reports (components/SMReports.jsx); JSON from GET /api/reports/:key, files from /api/reports/:key/export
// Used by: app/api/reports/**, tests/reports.test.js
// Depends on: lib/server/{db,scope,assigned,http}.js, lib/scoring.js (the one scoring engine)
// Sections (search for these markers): REPORTS · Labels, REPORTS · Catalogue, REPORTS · Access, REPORTS · Filters,
//   REPORTS · Scoring helpers (pure), REPORTS · Grouping (pure), REPORTS · Assignments (pure),
//   REPORTS · Table helpers (pure), REPORTS · Loading data, REPORTS · Individual reports, REPORTS · Result reports,
//   REPORTS · Performance reports, REPORTS · Gap & proficiency reports, REPORTS · Completion reports,
//   REPORTS · Administration reports, REPORTS · Run a report
// Rules (Skills Metrics prompt sections 12 to 14, 16 and 18):
//   - Results come from FinalCompetencyResult (the cached average of COMPLETED attempts only). Classifications are
//     worked out again here with lib/scoring.js and the newest active ScoringConfig, from the UNROUNDED average.
//   - A person's result for a competency across several assessments = the average of every completed attempt that
//     assessed it (each assessment's average weighted by its number of completed attempts). With an assessment
//     filter it is simply that assessment's final average.
//   - A group's average for a competency = the mean of its people's final averages for that competency.
//   - Missing results are null ("Not assessed"), never 0.
//   - Progress, overdue and completion use lib/server/assigned.js (progressStatus, deadlineFor). Completion rate =
//     staff with at least one completed attempt / active staff with the assessment assigned and already open.
//   - Every staff-based query goes through lib/server/scope.js, so a supervisor never sees anyone outside their
//     departments or direct reports, on screen or in an export.
// =============================================================================
import 'server-only';
import { z } from 'zod';
import { db } from './db';
import { staffWhere, assertStaffVisible } from './scope';
import { assessmentsForStaff, progressStatus, deadlineFor, PROGRESS_LABEL } from './assigned';
import { ApiError, badRequest, forbidden } from './http';
import { DEFAULT_CONFIG, competencyStatus, gapStatus, gapValue, formatAverage, COMPETENCY_LABEL, GAP_LABEL } from '../scoring';

// ===== REPORTS · Labels =====
// Words shown for the status codes stored in the database.
export const ATTEMPT_LABEL = { IN_PROGRESS: 'In progress', SUBMITTED: 'Submitted', PENDING_MARKING: 'Pending marking', COMPLETED: 'Completed', ABANDONED: 'Abandoned', EXPIRED: 'Expired' };
export const REVIEW_LABEL = { SUBMIT: 'Submitted for review', APPROVE: 'Approved', REJECT: 'Rejected', RETURN: 'Returned for changes', PUBLISH: 'Published', ARCHIVE: 'Archived' };
export const TICKET_LABEL = { OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', PENDING_USER: 'Waiting for requester', RESOLVED: 'Resolved', CLOSED: 'Closed' };
export const ASSESSMENT_LABEL = { DRAFT: 'Draft', SUBMITTED: 'Awaiting review', RETURNED: 'Returned', REJECTED: 'Rejected', APPROVED: 'Approved', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const opts = m => Object.entries(m);

// ===== REPORTS · Catalogue =====
// One entry per report in section 18. `filters` lists the filters the report takes (keys of FILTER_FIELDS);
// `status` lists the allowed values of its Status filter; `perm` is an extra permission (see REPORTS · Access).
const PLACE = ['department', 'grade', 'station', 'location'];
export const REPORTS = [
  { key: 'staff-profile', group: 'Individual staff', title: 'Staff competency profile', description: 'Every competency for one person: final average across completed attempts, Competent / Proficient status and gap.', filters: ['staff', 'assessment', 'competency'], needsStaff: true },
  { key: 'attempt-history', group: 'Individual staff', title: 'Attempt history', description: 'Each attempt on its own, with its status, dates, active time and competency scores. Only completed attempts count towards final averages.', filters: ['staff', 'assessment', ...PLACE, 'status', 'from', 'to'], status: opts(ATTEMPT_LABEL), dateLabel: 'Started' },
  { key: 'final-averages', group: 'Results', title: 'Final averages', description: 'Final average per person, assessment and competency: the average of all completed attempts.', filters: ['assessment', 'competency', ...PLACE, 'status'], status: [...opts(COMPETENCY_LABEL), ...opts(GAP_LABEL)] },
  { key: 'department', group: 'Performance', title: 'Departmental performance', description: 'Average result and status counts per department and competency (mean of each person\'s final average).', filters: ['assessment', 'competency', ...PLACE] },
  { key: 'location', group: 'Performance', title: 'Station and location performance', description: 'Average result and status counts per station and competency.', filters: ['assessment', 'competency', ...PLACE] },
  { key: 'grade', group: 'Performance', title: 'Grade-based performance', description: 'Average result and status counts per grade and competency.', filters: ['assessment', 'competency', ...PLACE] },
  { key: 'gap-analysis', group: 'Gaps & proficiency', title: 'Competency gap analysis', description: 'For each competency: how many people have a Critical, Moderate or No Gap, ranked by priority.', filters: ['assessment', 'competency', ...PLACE] },
  { key: 'gaps', group: 'Gaps & proficiency', title: 'Critical and Moderate Gaps', description: 'Every person and competency with a Critical Gap (below 2.50) or a Moderate Gap (2.50 to 4.99).', filters: ['assessment', 'competency', ...PLACE, 'status'], status: [['CRITICAL', GAP_LABEL.CRITICAL], ['MODERATE', GAP_LABEL.MODERATE]] },
  { key: 'proficiency', group: 'Gaps & proficiency', title: 'Proficiency attainment', description: 'Per person: competencies assessed and how many reached the required proficiency level (5.00).', filters: ['assessment', 'competency', ...PLACE, 'status'], status: [['ATTAINED', 'Attained in every competency'], ['NOT_ATTAINED', 'Not yet attained'], ['NOT_ASSESSED', 'Not assessed']] },
  { key: 'completion', group: 'Completion', title: 'Completion and non-completion', description: 'Each person and assigned assessment with its progress. Completion rate = completed / assigned and already open.', filters: ['assessment', ...PLACE, 'status', 'from', 'to'], status: opts(PROGRESS_LABEL), dateLabel: 'Deadline' },
  { key: 'overdue', group: 'Completion', title: 'Overdue assessments', description: 'Assigned assessments whose deadline (with any extension) has passed with no completed attempt.', filters: ['assessment', ...PLACE, 'from', 'to'], dateLabel: 'Deadline' },
  { key: 'content-approvals', group: 'Administration', title: 'Content approval history', description: 'Every submission, approval, rejection, return, publication and archive of assessment content.', filters: ['assessment', 'status', 'from', 'to'], status: opts(REVIEW_LABEL), perm: 'forms.view', dateLabel: 'Date' },
  { key: 'creator-activity', group: 'Administration', title: 'Assessment Creator activity', description: 'Per creator: assessments created, their current status, submissions and review outcomes.', filters: ['from', 'to'], perm: 'forms.review', dateLabel: 'Activity' },
  { key: 'tickets', group: 'Administration', title: 'Support ticket statistics', description: 'Tickets by category with open, resolved and closed counts and average time to resolve.', filters: ['status', 'from', 'to'], status: opts(TICKET_LABEL), perm: 'tickets.manage', dateLabel: 'Raised' },
  { key: 'org-changes', group: 'Administration', title: 'Organisational mapping changes', description: 'Staff placement history (department and station moves) and changes to departments, grades, stations and locations.', filters: ['department', 'from', 'to'], perm: 'org.view', dateLabel: 'Changed' },
];
export const reportDef = key => REPORTS.find(r => r.key === key) || null;

// ===== REPORTS · Access =====
// reports.view opens a report; reports.export downloads it. Both are checked by the routes.
// The four administration reports are not about staff results, so department scope cannot narrow them in a
// meaningful way (content, creators and tickets belong to the whole organisation). Instead each one also needs the
// permission that already opens the same records elsewhere in the app:
//   content approval history -> forms.view (anyone who may open assessment content and its review history)
//   Assessment Creator activity -> forms.review (Administrators only: lib/permissions.js keeps review for admins)
//   support ticket statistics -> tickets.manage (people who see every ticket, not resolvers of their own)
//   organisational mapping changes -> org.view, and it is still limited to staff in the person's scope (see below).
// A supervisor holds none of these by default, so these reports are refused (403) for them.
export function mayRun(user, def) {
  if (!def || !user.perms.includes('reports.view')) return false;
  return !def.perm || user.perms.includes(def.perm);
}
export function assertReportAccess(ctx, def, { exporting = false } = {}) {
  if (!def) throw new ApiError(404, 'Report not found.');
  if (!mayRun(ctx.user, def)) throw forbidden("You don't have permission to open this report.");
  if (exporting && !ctx.user.perms.includes('reports.export')) throw forbidden("You don't have permission to export reports.");
}

// ===== REPORTS · Filters =====
// The query string -> clean filter values. Ids are whole numbers; dates are YYYY-MM-DD; anything a report does not
// take is dropped. Ids from the browser are never trusted: staff queries always add the scope filter as well.
export const FILTER_FIELDS = { staff: 'staffId', assessment: 'assessmentId', competency: 'competencyId', department: 'departmentId', grade: 'gradeId', station: 'stationId', location: 'locationId', status: 'status', from: 'from', to: 'to' };
const idField = z.coerce.number().int().positive().max(2147483647).optional();
const dateField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => !Number.isNaN(Date.parse(s + 'T00:00:00Z')), 'Not a date').optional();
const FilterSchema = z.object({
  staffId: idField, assessmentId: idField, competencyId: idField, departmentId: idField, gradeId: idField, stationId: idField, locationId: idField,
  status: z.string().max(40).regex(/^[A-Z_]+$/).optional(), from: dateField, to: dateField,
  q: z.string().trim().max(100).optional(), sort: z.string().max(40).regex(/^[a-zA-Z]+$/).optional(), dir: z.enum(['asc', 'desc']).optional(),
  page: z.coerce.number().int().min(1).max(1000000).optional(), pageSize: z.coerce.number().int().min(1).max(100).optional(),
});
export function parseFilters(def, params) {
  const raw = {};
  for (const [k, v] of params instanceof URLSearchParams ? params.entries() : Object.entries(params || {})) if (v !== '' && v != null && k in FilterSchema.shape) raw[k] = v;
  const r = FilterSchema.safeParse(raw);
  if (!r.success) throw badRequest('Some filters are not valid.', { fields: r.error.flatten().fieldErrors });
  const f = r.data, allowed = new Set((def.filters || []).map(k => FILTER_FIELDS[k]));
  Object.values(FILTER_FIELDS).forEach(k => { if (!allowed.has(k)) delete f[k]; });
  if (f.status && !(def.status || []).some(([v]) => v === f.status)) throw badRequest('That status is not available for this report.');
  if (f.from && f.to && f.from > f.to) throw badRequest('The "from" date must be on or before the "to" date.');
  if (!f.q) delete f.q;
  return f;
}
// Inclusive date range -> Prisma condition, or undefined when no dates are set.
export function dateRange(f) {
  if (!f.from && !f.to) return undefined;
  const c = {};
  if (f.from) c.gte = new Date(f.from + 'T00:00:00.000Z');
  if (f.to) c.lte = new Date(f.to + 'T23:59:59.999Z');
  return c;
}
const inRange = (d, f) => { const c = dateRange(f); if (!c) return true; if (!d) return false; const t = new Date(d); return (!c.gte || t >= c.gte) && (!c.lte || t <= c.lte); };

// ===== REPORTS · Scoring helpers (pure) =====
// Two-decimal number for tables and spreadsheets (the classification always uses the unrounded value).
export const round2 = n => (n == null || !Number.isFinite(n) ? null : Number(formatAverage(n)));
export const pct = (part, whole) => (whole ? Math.round((part / whole) * 1000) / 10 : null);
export const toConfig = c => (c ? { requiredLevel: +c.requiredLevel, competentFrom: +c.competentFrom, proficientFrom: +c.proficientFrom, moderateGapFrom: +c.moderateGapFrom, noGapFrom: +c.noGapFrom, defaultMaxAttempts: c.defaultMaxAttempts } : { ...DEFAULT_CONFIG });
// Average -> what a results row shows. null average stays null ("Not assessed").
export function classify(average, cfg = DEFAULT_CONFIG) {
  if (average == null || !Number.isFinite(average)) return { average: null, competency: null, competencyCode: null, gap: null, gapStatus: null, gapCode: null };
  const cs = competencyStatus(average, cfg), gs = gapStatus(average, cfg);
  return { average: round2(average), competency: COMPETENCY_LABEL[cs], competencyCode: cs, gap: round2(gapValue(average, cfg)), gapStatus: GAP_LABEL[gs], gapCode: gs };
}
// finals: [{ staffId, assessmentId, competencyId, average, attemptsIncluded }] -> one value per person and competency.
// Across assessments the result is the average of every completed attempt (weights = attempts included).
export function personCompetencyValues(finals) {
  const by = new Map();
  for (const r of finals) {
    const n = Number(r.attemptsIncluded) || 0, avg = Number(r.average);
    if (!n || !Number.isFinite(avg)) continue;
    const k = r.staffId + ':' + r.competencyId;
    const cur = by.get(k) || { staffId: r.staffId, competencyId: r.competencyId, sum: 0, attemptsIncluded: 0, assessments: [] };
    cur.sum += avg * n; cur.attemptsIncluded += n; cur.assessments.push(r.assessmentId);
    by.set(k, cur);
  }
  return [...by.values()].map(v => ({ staffId: v.staffId, competencyId: v.competencyId, average: v.sum / v.attemptsIncluded, attemptsIncluded: v.attemptsIncluded, assessments: v.assessments }));
}

// ===== REPORTS · Grouping (pure) =====
// values: personCompetencyValues(); groupOf(staffId) -> { key, cells: {..columns for the group} } or null.
// One row per group and competency: people assessed, mean of their final averages, and status counts.
export function groupPerformance(values, groupOf, compById, cfg = DEFAULT_CONFIG) {
  const by = new Map();
  for (const v of values) {
    const g = groupOf(v.staffId); if (!g) continue;
    const k = g.key + '|' + v.competencyId;
    const cur = by.get(k) || { g, competencyId: v.competencyId, list: [] };
    cur.list.push(v.average); by.set(k, cur);
  }
  return [...by.values()].map(({ g, competencyId, list }) => {
    const mean = list.reduce((a, b) => a + b, 0) / list.length, c = compById.get(competencyId) || {};
    const cs = list.map(a => competencyStatus(a, cfg)), gs = list.map(a => gapStatus(a, cfg)), cnt = (arr, s) => arr.filter(x => x === s).length;
    return { ...g.cells, competency: c.name || 'Competency ' + competencyId, category: c.category || '—', assessed: list.length, average: round2(mean), gap: round2(gapValue(mean, cfg)),
      proficient: cnt(cs, 'PROFICIENT'), competent: cnt(cs, 'COMPETENT'), notCompetent: cnt(cs, 'NOT_COMPETENT'), critical: cnt(gs, 'CRITICAL'), moderate: cnt(gs, 'MODERATE'), noGap: cnt(gs, 'NONE'),
      proficientPct: pct(cnt(cs, 'PROFICIENT'), list.length) };
  });
}
// Per competency across everyone in the values list, ranked: most Critical Gaps, then most Moderate, then lowest average.
export function gapAnalysis(values, compById, cfg = DEFAULT_CONFIG) {
  const rows = groupPerformance(values, () => ({ key: 'all', cells: {} }), compById, cfg)
    .map(r => ({ competency: r.competency, category: r.category, assessed: r.assessed, average: r.average, gap: r.gap, critical: r.critical, moderate: r.moderate, noGap: r.noGap, withGapPct: pct(r.critical + r.moderate, r.assessed) }));
  rows.sort((a, b) => b.critical - a.critical || b.moderate - a.moderate || a.average - b.average || a.competency.localeCompare(b.competency));
  return rows.map((r, i) => ({ priority: i + 1, ...r }));
}
// Per person: how many assessed competencies are Proficient / Competent / Not Competent. Staff with no result
// are kept with 0 assessed and "Not assessed" (never counted as failing).
export function proficiencyRow(values, cfg = DEFAULT_CONFIG) {
  const cs = values.map(v => competencyStatus(v.average, cfg)), cnt = s => cs.filter(x => x === s).length;
  const assessed = values.length, prof = cnt('PROFICIENT');
  const code = !assessed ? 'NOT_ASSESSED' : prof === assessed ? 'ATTAINED' : 'NOT_ATTAINED';
  return { assessed, proficient: prof, competent: cnt('COMPETENT'), notCompetent: cnt('NOT_COMPETENT'), proficientPct: pct(prof, assessed), attained: { ATTAINED: 'Yes', NOT_ATTAINED: 'No', NOT_ASSESSED: 'Not assessed' }[code], attainedCode: code };
}

// ===== REPORTS · Assignments (pure) =====
// The same result as assigned.js assessmentsForStaff(), worked out in memory for many people at once from the
// assignment rows (with extensions and assessment loaded). Kept in step with coveredWhere() / assessmentsForStaff().
export function coversStaff(a, s) {
  if (s.status !== 'ACTIVE') return false;
  switch (a.targetType) {
    case 'INDIVIDUAL': return a.staffId === s.id;
    case 'DEPARTMENT': return a.departmentId != null && a.departmentId === s.departmentId;
    case 'GRADE': return a.gradeId != null && a.gradeId === s.gradeId;
    case 'STATION': return a.stationId != null && a.stationId === s.stationId;
    case 'LOCATION': return a.locationId != null && a.locationId === (s.station ? s.station.locationId : null);
    default: return false;
  }
}
export function entriesFor(assignments, staff) {
  const by = new Map();
  for (const a of assignments) {
    if (!coversStaff(a, staff)) continue;
    const cur = by.get(a.assessmentId), dl = deadlineFor(a, staff.id), lim = a.maxAttempts ?? a.assessment?.maxAttempts ?? 3;
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
// Completion figures for a list of completion rows ({ statusCode, startsAt }). Denominator = already open.
export function completionSummary(rows, now = new Date()) {
  const open = rows.filter(r => new Date(r.startsAt) <= now), done = open.filter(r => r.statusCode === 'COMPLETED');
  return { assignedOpen: open.length, completed: done.length, notCompleted: open.length - done.length, overdue: rows.filter(r => r.statusCode === 'OVERDUE').length, upcoming: rows.filter(r => r.statusCode === 'UPCOMING').length, rate: pct(done.length, open.length) };
}

// ===== REPORTS · Table helpers (pure) =====
// Column types: text, int, avg (2 decimals, null = "Not assessed"), num (2 decimals), pct, date, datetime,
// and the label columns comp / gapst / progress (shown as coloured badges on screen, plain words in files).
export const col = (key, label, type = 'text', extra) => ({ key, label, type, ...(extra || {}) });
const fmtDay = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '');
const fmtTime = d => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : '');
// The text of one cell, as files and searches show it.
export function cellText(c, v) {
  if (v == null || v === '') return c.empty || '—';
  switch (c.type) {
    case 'avg': case 'num': return Number(v).toFixed(2);
    case 'pct': return Number(v).toFixed(1) + '%';
    case 'date': return fmtDay(v);
    case 'datetime': return fmtTime(v);
    default: return String(v);
  }
}
const NUMERIC = new Set(['int', 'avg', 'num', 'pct']);
export const isNumeric = c => NUMERIC.has(c.type);
export function searchRows(rows, columns, q) {
  const t = String(q || '').trim().toLowerCase();
  if (!t) return rows;
  return rows.filter(r => columns.some(c => cellText(c, r[c.key]).toLowerCase().includes(t)));
}
// Missing values always sort last, whichever way.
export function sortRows(rows, columns, key, dir = 'asc') {
  const c = columns.find(x => x.key === key);
  if (!c) return rows;
  const m = dir === 'desc' ? -1 : 1;
  const val = r => r[c.key];
  return [...rows].sort((a, b) => {
    const x = val(a), y = val(b);
    if (x == null || x === '') return y == null || y === '' ? 0 : 1;
    if (y == null || y === '') return -1;
    if (isNumeric(c)) return (Number(x) - Number(y)) * m;
    if (c.type === 'date' || c.type === 'datetime') return (new Date(x) - new Date(y)) * m;
    return String(x).localeCompare(String(y)) * m;
  });
}
export function pageRows(rows, page = 1, pageSize = 25) {
  const pages = Math.max(1, Math.ceil(rows.length / pageSize)), p = Math.min(Math.max(1, page), pages);
  return { rows: rows.slice((p - 1) * pageSize, p * pageSize), page: p, pageSize, pages, total: rows.length };
}
const fullName = s => [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(' ');
// The usual "who is this" columns for a staff row.
const PERSON_COLS = [col('staffNo', 'Staff ID'), col('name', 'Name'), col('department', 'Department'), col('grade', 'Grade'), col('station', 'Station')];
const personCells = s => ({ staffId: s.id, staffNo: s.staffNo, name: fullName(s), department: s.department?.name || null, grade: s.grade?.name || null, station: s.station?.name || null, location: s.station?.location?.name || null });
const daysBetween = (a, b) => Math.floor((new Date(b) - new Date(a)) / 86400e3);

// ===== REPORTS · Loading data =====
async function activeConfig() {
  return toConfig(await db.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } }));
}
const STAFF_SELECT = { id: true, staffNo: true, firstName: true, lastName: true, otherNames: true, status: true, departmentId: true, gradeId: true, stationId: true, supervisorId: true,
  department: { select: { name: true } }, grade: { select: { name: true, rank: true } }, station: { select: { name: true, locationId: true, location: { select: { name: true } } } } };
// Prisma `where` for the staff a report covers: the person's scope AND every place filter. Active staff only,
// unless activeOnly is false (attempt history keeps people who have since left).
export function staffFilterWhere(ctx, f, { activeOnly = true } = {}) {
  const and = [staffWhere(ctx)];
  if (activeOnly) and.push({ status: 'ACTIVE' });
  if (f.staffId) and.push({ id: f.staffId });
  if (f.departmentId) and.push({ departmentId: f.departmentId });
  if (f.gradeId) and.push({ gradeId: f.gradeId });
  if (f.stationId) and.push({ stationId: f.stationId });
  if (f.locationId) and.push({ station: { locationId: f.locationId } });
  return { AND: and };
}
async function loadStaff(ctx, f, o) {
  return db.staffRecord.findMany({ where: staffFilterWhere(ctx, f, o), select: STAFF_SELECT, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] });
}
async function loadCompetencies() {
  const rows = await db.competency.findMany({ select: { id: true, name: true, category: { select: { name: true, group: true } } } });
  return new Map(rows.map(c => [c.id, { id: c.id, name: c.name, category: c.category ? c.category.name + ' · ' + c.category.group : null }]));
}
async function loadFinals(ctx, f) {
  const rows = await db.finalCompetencyResult.findMany({
    where: { staff: staffFilterWhere(ctx, f), ...(f.assessmentId ? { assessmentId: f.assessmentId } : {}), ...(f.competencyId ? { competencyId: f.competencyId } : {}) },
    select: { staffId: true, assessmentId: true, competencyId: true, average: true, attemptsIncluded: true },
  });
  return rows.map(r => ({ ...r, average: Number(r.average) }));
}
// Staff, competencies, config and per-person values: what every results report starts from.
async function resultBase(ctx, f) {
  const [staff, finals, compById, cfg] = await Promise.all([loadStaff(ctx, f), loadFinals(ctx, f), loadCompetencies(), activeConfig()]);
  const staffById = new Map(staff.map(s => [s.id, s]));
  const values = personCompetencyValues(finals.filter(r => staffById.has(r.staffId)));
  return { staff, staffById, finals, values, compById, cfg };
}
const assessmentTitles = async () => new Map((await db.assessment.findMany({ select: { id: true, title: true } })).map(a => [a.id, a.title]));

// ===== REPORTS · Individual reports =====
// Staff competency profile: every competency in this person's assigned assessments, including ones not yet assessed.
async function staffProfile(ctx, f) {
  const columns = [col('assessment', 'Assessment'), col('competency', 'Competency'), col('category', 'Category'), col('attemptsIncluded', 'Completed attempts', 'int'), col('attemptScores', 'Attempt scores'),
    col('average', 'Final average', 'avg', { empty: 'Not assessed' }), col('competencyStatus', 'Competency status', 'comp', { empty: 'Not assessed' }), col('gap', 'Gap', 'num'), col('gapStatus', 'Gap status', 'gapst', { empty: 'Not assessed' })];
  if (!f.staffId) return { columns, rows: [], summary: [], notes: ['Choose a staff member to see their profile.'] };
  const s = await db.staffRecord.findUnique({ where: { id: f.staffId }, select: { ...STAFF_SELECT, station: { select: { name: true, locationId: true, location: { select: { name: true } } } } } });
  const [entries, finals, attempts, compById, cfg, titles] = await Promise.all([
    assessmentsForStaff(s), db.finalCompetencyResult.findMany({ where: { staffId: s.id } }),
    db.attempt.findMany({ where: { staffId: s.id, status: 'COMPLETED' }, select: { assessmentId: true, attemptNo: true, results: { select: { competencyId: true, score: true } } }, orderBy: { attemptNo: 'asc' } }),
    loadCompetencies(), activeConfig(), assessmentTitles(),
  ]);
  const ids = [...new Set([...entries.map(e => e.assessmentId), ...finals.map(r => r.assessmentId)])].filter(id => !f.assessmentId || id === f.assessmentId);
  const mapped = await db.questionCompetency.findMany({ where: { question: { version: { assessmentId: { in: ids }, status: { in: ['PUBLISHED', 'ARCHIVED'] } } } }, select: { competencyId: true, question: { select: { version: { select: { assessmentId: true } } } } } });
  const pairs = new Set([...mapped.map(m => m.question.version.assessmentId + ':' + m.competencyId), ...finals.map(r => r.assessmentId + ':' + r.competencyId)]);
  const rows = [];
  for (const p of pairs) {
    const [aId, cId] = p.split(':').map(Number);
    if (!ids.includes(aId) || (f.competencyId && cId !== f.competencyId)) continue;
    const fr = finals.find(r => r.assessmentId === aId && r.competencyId === cId), c = compById.get(cId) || {};
    const scores = attempts.filter(a => a.assessmentId === aId).map(a => a.results.find(r => r.competencyId === cId)).filter(Boolean).map(r => formatAverage(Number(r.score)));
    const k = classify(fr ? Number(fr.average) : null, cfg);
    rows.push({ assessment: titles.get(aId) || 'Assessment ' + aId, competency: c.name, category: c.category, attemptsIncluded: fr ? fr.attemptsIncluded : 0, attemptScores: scores.length ? scores.join(', ') : null,
      average: k.average, competencyStatus: k.competency, gap: k.gap, gapStatus: k.gapStatus });
  }
  rows.sort((a, b) => a.assessment.localeCompare(b.assessment) || String(a.competency).localeCompare(String(b.competency)));
  const n = st => rows.filter(r => r.competencyStatus === st).length, g = st => rows.filter(r => r.gapStatus === st).length;
  const p = personCells(s);
  return { columns, rows, summary: [
    { label: 'Staff member', value: p.name + ' (' + p.staffNo + ')', sub: [p.department, p.grade, p.station].filter(Boolean).join(' · ') },
    { label: 'Competencies assessed', value: rows.filter(r => r.average != null).length, sub: rows.filter(r => r.average == null).length + ' not assessed yet' },
    { label: 'Proficient', value: n(COMPETENCY_LABEL.PROFICIENT), sub: n(COMPETENCY_LABEL.COMPETENT) + ' Competent · ' + n(COMPETENCY_LABEL.NOT_COMPETENT) + ' Not Competent' },
    { label: 'Critical Gaps', value: g(GAP_LABEL.CRITICAL), sub: g(GAP_LABEL.MODERATE) + ' Moderate · ' + g(GAP_LABEL.NONE) + ' No Gap', tone: g(GAP_LABEL.CRITICAL) ? 'bad' : undefined },
  ] };
}

// Attempt history: one row per attempt (all statuses), newest first.
async function attemptHistory(ctx, f) {
  const columns = [...PERSON_COLS.slice(0, 3), col('assessment', 'Assessment'), col('attemptNo', 'Attempt', 'int'), col('status', 'Status'), col('startedAt', 'Started', 'datetime'), col('completedAt', 'Completed', 'datetime'),
    col('activeMinutes', 'Active time (min)', 'int'), col('counted', 'Counts towards final average'), col('scores', 'Competency scores (this attempt)')];
  const where = { staff: staffFilterWhere(ctx, f, { activeOnly: false }) };
  if (f.assessmentId) where.assessmentId = f.assessmentId;
  if (f.status) where.status = f.status;
  const range = dateRange(f); if (range) where.startedAt = range;
  const [list, compById] = await Promise.all([
    db.attempt.findMany({ where, orderBy: [{ startedAt: 'desc' }], take: 20000, select: { id: true, attemptNo: true, status: true, startedAt: true, completedAt: true, submittedAt: true, activeSeconds: true,
      assessment: { select: { title: true } }, staff: { select: STAFF_SELECT }, results: { select: { competencyId: true, score: true } } } }),
    loadCompetencies(),
  ]);
  const rows = list.map(a => ({ ...personCells(a.staff), assessment: a.assessment.title, attemptNo: a.attemptNo, status: ATTEMPT_LABEL[a.status] || a.status, startedAt: a.startedAt, completedAt: a.completedAt || a.submittedAt,
    activeMinutes: Math.round((a.activeSeconds || 0) / 60), counted: a.status === 'COMPLETED' ? 'Yes' : 'No',
    scores: a.status === 'COMPLETED' && a.results.length ? a.results.map(r => ({ n: compById.get(r.competencyId)?.name || 'Competency ' + r.competencyId, s: formatAverage(Number(r.score)) })).sort((x, y) => x.n.localeCompare(y.n)).map(x => x.n + ' ' + x.s).join('; ') : null }));
  const done = list.filter(a => a.status === 'COMPLETED').length;
  return { columns, rows, summary: [
    { label: 'Attempts', value: list.length, sub: new Set(list.map(a => a.staff.id)).size + ' staff' },
    { label: 'Completed', value: done, sub: 'Counted in final averages' },
    { label: 'Not counted', value: list.length - done, sub: 'In progress, abandoned or expired' },
  ] };
}

// ===== REPORTS · Result reports =====
// Final averages per person, assessment and competency, straight from FinalCompetencyResult.
async function finalAverages(ctx, f) {
  const columns = [...PERSON_COLS, col('assessment', 'Assessment'), col('competency', 'Competency'), col('attemptsIncluded', 'Completed attempts', 'int'), col('average', 'Final average', 'avg', { empty: 'Not assessed' }),
    col('competencyStatus', 'Competency status', 'comp'), col('gap', 'Gap', 'num'), col('gapStatus', 'Gap status', 'gapst')];
  const [{ staffById, finals, compById, cfg }, titles] = await Promise.all([resultBase(ctx, f), assessmentTitles()]);
  let rows = finals.filter(r => staffById.has(r.staffId)).map(r => {
    const k = classify(r.average, cfg);
    return { ...personCells(staffById.get(r.staffId)), assessment: titles.get(r.assessmentId), competency: compById.get(r.competencyId)?.name, attemptsIncluded: r.attemptsIncluded, average: k.average, competencyStatus: k.competency, gap: k.gap, gapStatus: k.gapStatus, _c: k.competencyCode, _g: k.gapCode };
  });
  if (f.status) rows = rows.filter(r => r._c === f.status || r._g === f.status);
  rows.sort((a, b) => a.name.localeCompare(b.name) || a.assessment.localeCompare(b.assessment) || String(a.competency).localeCompare(String(b.competency)));
  rows = rows.map(({ _c, _g, ...r }) => r);
  const c = st => rows.filter(r => r.competencyStatus === st).length, g = st => rows.filter(r => r.gapStatus === st).length;
  return { columns, rows, summary: [
    { label: 'Results', value: rows.length, sub: new Set(rows.map(r => r.staffId)).size + ' staff' },
    { label: 'Proficient', value: c(COMPETENCY_LABEL.PROFICIENT), sub: c(COMPETENCY_LABEL.COMPETENT) + ' Competent' },
    { label: 'Not Competent', value: c(COMPETENCY_LABEL.NOT_COMPETENT) },
    { label: 'Critical Gaps', value: g(GAP_LABEL.CRITICAL), sub: g(GAP_LABEL.MODERATE) + ' Moderate Gaps', tone: g(GAP_LABEL.CRITICAL) ? 'bad' : undefined },
  ] };
}

// ===== REPORTS · Performance reports =====
// Department / station / grade x competency. Shared columns after the group columns.
const PERF_COLS = [col('competency', 'Competency'), col('category', 'Category'), col('assessed', 'Staff assessed', 'int'), col('average', 'Average (mean of final averages)', 'avg', { empty: 'Not assessed' }), col('gap', 'Average gap', 'num'),
  col('proficient', 'Proficient', 'int'), col('competent', 'Competent', 'int'), col('notCompetent', 'Not Competent', 'int'), col('critical', 'Critical Gap', 'int'), col('moderate', 'Moderate Gap', 'int'), col('noGap', 'No Gap', 'int'), col('proficientPct', 'Proficient %', 'pct')];
function perfSummary(staff, values, rows, groupWord) {
  const assessed = new Set(values.map(v => v.staffId)).size, sum = k => rows.reduce((a, r) => a + r[k], 0);
  const groups = new Set(rows.map(r => r._group)).size;
  return [
    { label: groupWord, value: groups },
    { label: 'Staff assessed', value: assessed, sub: 'of ' + staff.length + ' active staff in scope' },
    { label: 'Proficient results', value: sum('proficient'), sub: sum('competent') + ' Competent · ' + sum('notCompetent') + ' Not Competent' },
    { label: 'Critical Gaps', value: sum('critical'), sub: sum('moderate') + ' Moderate Gaps', tone: sum('critical') ? 'bad' : undefined },
  ];
}
async function performance(ctx, f, kind) {
  const { staff, staffById, values, compById, cfg } = await resultBase(ctx, f);
  const G = {
    department: { cols: [col('department', 'Department')], word: 'Departments', of: s => ({ key: 'd' + (s.departmentId ?? 0), cells: { department: s.department?.name || 'No department' } }) },
    location: { cols: [col('location', 'Location'), col('station', 'Station')], word: 'Stations', of: s => ({ key: 's' + (s.stationId ?? 0), cells: { location: s.station?.location?.name || 'No location', station: s.station?.name || 'No station' } }) },
    grade: { cols: [col('grade', 'Grade')], word: 'Grades', of: s => ({ key: 'g' + (s.gradeId ?? 0), cells: { grade: s.grade?.name || 'No grade', _rank: s.grade?.rank ?? 99 } }) },
  }[kind];
  const rows = groupPerformance(values, id => { const s = staffById.get(id); if (!s) return null; const g = G.of(s); return { key: g.key, cells: { ...g.cells, _group: g.key } }; }, compById, cfg);
  rows.sort((a, b) => (kind === 'grade' ? a._rank - b._rank : 0) || G.cols.map(c => String(a[c.key]).localeCompare(String(b[c.key]))).find(x => x) || a.competency.localeCompare(b.competency));
  const summary = perfSummary(staff, values, rows, G.word);
  return { columns: [...G.cols, ...PERF_COLS], rows: rows.map(({ _group, _rank, ...r }) => r), summary };
}

// ===== REPORTS · Gap & proficiency reports =====
async function gapAnalysisReport(ctx, f) {
  const { staff, values, compById, cfg } = await resultBase(ctx, f);
  const rows = gapAnalysis(values, compById, cfg);
  const top = rows[0];
  return { columns: [col('priority', 'Priority', 'int'), col('competency', 'Competency'), col('category', 'Category'), col('assessed', 'Staff assessed', 'int'), col('average', 'Average (mean of final averages)', 'avg'), col('gap', 'Average gap', 'num'),
    col('critical', 'Critical Gap', 'int'), col('moderate', 'Moderate Gap', 'int'), col('noGap', 'No Gap', 'int'), col('withGapPct', 'Staff with a gap', 'pct')], rows, summary: [
    { label: 'Competencies with results', value: rows.length },
    { label: 'Staff assessed', value: new Set(values.map(v => v.staffId)).size, sub: 'of ' + staff.length + ' active staff in scope' },
    { label: 'Critical Gaps', value: rows.reduce((a, r) => a + r.critical, 0), sub: rows.reduce((a, r) => a + r.moderate, 0) + ' Moderate Gaps', tone: rows.some(r => r.critical) ? 'bad' : undefined },
    { label: 'Top priority', value: top ? top.competency : '—', sub: top ? top.critical + ' Critical · ' + top.moderate + ' Moderate' : 'No results yet' },
  ] };
}
async function gapsReport(ctx, f) {
  const { staffById, values, compById, cfg } = await resultBase(ctx, f);
  const rows = [];
  for (const v of values) {
    const k = classify(v.average, cfg);
    if (!['CRITICAL', 'MODERATE'].includes(k.gapCode) || (f.status && k.gapCode !== f.status)) continue;
    rows.push({ ...personCells(staffById.get(v.staffId)), competency: compById.get(v.competencyId)?.name, attemptsIncluded: v.attemptsIncluded, average: k.average, gap: k.gap, gapStatus: k.gapStatus, competencyStatus: k.competency, _o: k.gapCode === 'CRITICAL' ? 0 : 1, _a: v.average });
  }
  rows.sort((a, b) => a._o - b._o || a._a - b._a || a.name.localeCompare(b.name));
  const crit = rows.filter(r => r._o === 0);
  return { columns: [...PERSON_COLS, col('competency', 'Competency'), col('attemptsIncluded', 'Completed attempts', 'int'), col('average', 'Final average', 'avg'), col('gap', 'Gap', 'num'), col('gapStatus', 'Gap status', 'gapst'), col('competencyStatus', 'Competency status', 'comp')],
    rows: rows.map(({ _o, _a, ...r }) => r), summary: [
      { label: 'Critical Gaps', value: crit.length, sub: new Set(crit.map(r => r.staffId)).size + ' staff', tone: crit.length ? 'bad' : undefined },
      { label: 'Moderate Gaps', value: rows.length - crit.length, sub: new Set(rows.filter(r => r._o === 1).map(r => r.staffId)).size + ' staff' },
      { label: 'Competencies affected', value: new Set(rows.map(r => r.competency)).size },
    ] };
}
async function proficiencyReport(ctx, f) {
  const { staff, values, cfg } = await resultBase(ctx, f);
  const byStaff = new Map();
  values.forEach(v => { (byStaff.get(v.staffId) || byStaff.set(v.staffId, []).get(v.staffId)).push(v); });
  let rows = staff.map(s => ({ ...personCells(s), ...proficiencyRow(byStaff.get(s.id) || [], cfg) }));
  if (f.status) rows = rows.filter(r => r.attainedCode === f.status);
  rows = rows.map(({ attainedCode, ...r }) => r);
  const assessed = rows.filter(r => r.assessed > 0), attained = rows.filter(r => r.attained === 'Yes');
  return { columns: [...PERSON_COLS, col('assessed', 'Competencies assessed', 'int'), col('proficient', 'Proficient', 'int'), col('competent', 'Competent', 'int'), col('notCompetent', 'Not Competent', 'int'), col('proficientPct', 'Proficient %', 'pct'), col('attained', 'Proficient in every competency assessed')],
    rows, summary: [
      { label: 'Staff', value: rows.length, sub: assessed.length + ' with results' },
      { label: 'Attained proficiency', value: attained.length, sub: 'Proficient (5.00) in every competency assessed' },
      { label: 'Proficient results', value: rows.reduce((a, r) => a + r.proficient, 0), sub: 'of ' + rows.reduce((a, r) => a + r.assessed, 0) + ' competency results' },
      { label: 'Not assessed', value: rows.length - assessed.length },
    ] };
}

// ===== REPORTS · Completion reports =====
// One row per person and assigned assessment, using assigned.js rules for dates, limits and progress.
async function completionRows(ctx, f) {
  const [staff, assignments] = await Promise.all([
    loadStaff(ctx, f),
    db.assessmentAssignment.findMany({ where: { assessment: { status: { in: ['PUBLISHED', 'ARCHIVED'] } }, ...(f.assessmentId ? { assessmentId: f.assessmentId } : {}) }, include: { extensions: true, assessment: true } }),
  ]);
  const attempts = await db.attempt.findMany({ where: { staff: staffFilterWhere(ctx, f), ...(f.assessmentId ? { assessmentId: f.assessmentId } : {}) }, select: { staffId: true, assessmentId: true, status: true, startedAt: true, completedAt: true } });
  const by = new Map();
  attempts.forEach(a => { const k = a.staffId + ':' + a.assessmentId; (by.get(k) || by.set(k, []).get(k)).push(a); });
  const now = new Date(), rows = [];
  for (const s of staff) for (const e of entriesFor(assignments, s)) {
    const list = by.get(s.id + ':' + e.assessmentId) || [], code = progressStatus(e, list, now);
    const last = list.reduce((m, a) => { const d = a.completedAt || a.startedAt; return !m || d > m ? d : m; }, null);
    rows.push({ ...personCells(s), assessment: e.assessment.title, startsAt: e.startsAt, deadline: e.deadline, status: PROGRESS_LABEL[code], statusCode: code,
      attemptsUsed: list.length, maxAttempts: e.maxAttempts, completedAttempts: list.filter(a => a.status === 'COMPLETED').length, lastActivity: last,
      daysOverdue: code === 'OVERDUE' ? daysBetween(e.deadline, now) : null });
  }
  return rows.filter(r => inRange(r.deadline, f)).sort((a, b) => a.name.localeCompare(b.name) || a.assessment.localeCompare(b.assessment));
}
async function completionReport(ctx, f) {
  let rows = await completionRows(ctx, f);
  if (f.status) rows = rows.filter(r => r.statusCode === f.status);
  const s = completionSummary(rows);
  return { columns: [...PERSON_COLS, col('assessment', 'Assessment'), col('startsAt', 'Opens', 'date'), col('deadline', 'Deadline', 'date'), col('status', 'Status', 'progress'), col('attemptsUsed', 'Attempts used', 'int'), col('maxAttempts', 'Attempt limit', 'int'), col('completedAttempts', 'Completed attempts', 'int'), col('lastActivity', 'Last activity', 'date')],
    rows: rows.map(({ statusCode, daysOverdue, ...r }) => r), summary: [
      { label: 'Completion rate', value: s.rate == null ? '—' : s.rate.toFixed(1) + '%', sub: s.completed + ' of ' + s.assignedOpen + ' assigned and open' },
      { label: 'Completed', value: s.completed },
      { label: 'Not completed', value: s.notCompleted, sub: s.upcoming + ' not open yet (not counted)' },
      { label: 'Overdue', value: s.overdue, tone: s.overdue ? 'bad' : undefined },
    ], notes: ['Completion rate = staff with at least one completed attempt ÷ active staff with the assessment assigned and already open.'] };
}
async function overdueReport(ctx, f) {
  const rows = (await completionRows(ctx, f)).filter(r => r.statusCode === 'OVERDUE').sort((a, b) => b.daysOverdue - a.daysOverdue || a.name.localeCompare(b.name));
  const avg = rows.length ? rows.reduce((a, r) => a + r.daysOverdue, 0) / rows.length : null;
  return { columns: [...PERSON_COLS, col('assessment', 'Assessment'), col('deadline', 'Deadline (with extensions)', 'date'), col('daysOverdue', 'Days overdue', 'int'), col('attemptsUsed', 'Attempts used', 'int'), col('maxAttempts', 'Attempt limit', 'int'), col('status', 'Status', 'progress')],
    rows: rows.map(({ statusCode, startsAt, completedAttempts, lastActivity, ...r }) => r), summary: [
      { label: 'Overdue assessments', value: rows.length, tone: rows.length ? 'bad' : undefined },
      { label: 'Staff affected', value: new Set(rows.map(r => r.staffId)).size },
      { label: 'Average days overdue', value: avg == null ? '—' : avg.toFixed(1) },
    ] };
}

// ===== REPORTS · Administration reports =====
async function contentApprovals(ctx, f) {
  const where = {};
  if (f.assessmentId) where.version = { assessmentId: f.assessmentId };
  if (f.status) where.action = f.status;
  const range = dateRange(f); if (range) where.at = range;
  const list = await db.assessmentReviewEvent.findMany({ where, orderBy: { at: 'desc' }, take: 20000, include: { actor: { select: { displayName: true } }, version: { select: { versionNo: true, assessment: { select: { title: true, status: true } } } } } });
  const rows = list.map(e => ({ at: e.at, assessment: e.version.assessment.title, version: e.version.versionNo, action: REVIEW_LABEL[e.action] || e.action, by: e.actor.displayName, feedback: e.feedback || null, current: ASSESSMENT_LABEL[e.version.assessment.status] }));
  const n = a => list.filter(e => e.action === a).length;
  return { columns: [col('at', 'Date', 'datetime'), col('assessment', 'Assessment'), col('version', 'Version', 'int'), col('action', 'Action'), col('by', 'By'), col('feedback', 'Feedback'), col('current', 'Current status')], rows, summary: [
    { label: 'Review events', value: list.length, sub: new Set(list.map(e => e.version.assessment.title)).size + ' assessments' },
    { label: 'Submitted', value: n('SUBMIT') }, { label: 'Approved', value: n('APPROVE'), sub: n('PUBLISH') + ' published' },
    { label: 'Rejected or returned', value: n('REJECT') + n('RETURN') },
  ] };
}
async function creatorActivity(ctx, f) {
  const range = dateRange(f);
  const [creators, assessments, events] = await Promise.all([
    db.account.findMany({ where: { OR: [{ roles: { some: { role: 'CREATOR' } } }, { createdAssessments: { some: {} } }] }, select: { id: true, displayName: true, username: true } }),
    db.assessment.findMany({ where: range ? { createdAt: range } : {}, select: { id: true, createdById: true, status: true, createdAt: true, updatedAt: true } }),
    db.assessmentReviewEvent.findMany({ where: range ? { at: range } : {}, select: { action: true, actorId: true, at: true, version: { select: { assessment: { select: { createdById: true } } } } } }),
  ]);
  const rows = creators.map(c => {
    const mine = assessments.filter(a => a.createdById === c.id), ev = events.filter(e => e.version.assessment.createdById === c.id), st = s => mine.filter(a => a.status === s).length, ac = a => ev.filter(e => e.action === a).length;
    const last = [...mine.map(a => a.updatedAt), ...ev.filter(e => e.actorId === c.id).map(e => e.at)].reduce((m, d) => (!m || d > m ? d : m), null);
    return { creator: c.displayName, username: c.username, created: mine.length, drafts: st('DRAFT'), awaiting: st('SUBMITTED'), returned: st('RETURNED') + st('REJECTED'), approved: st('APPROVED'), published: st('PUBLISHED'), archived: st('ARCHIVED'),
      submissions: ac('SUBMIT'), approvals: ac('APPROVE'), rejections: ac('REJECT') + ac('RETURN'), lastActivity: last };
  }).filter(r => r.created || r.submissions || !range).sort((a, b) => b.created - a.created || a.creator.localeCompare(b.creator));
  const sum = k => rows.reduce((a, r) => a + r[k], 0);
  return { columns: [col('creator', 'Creator'), col('username', 'Username'), col('created', 'Assessments created', 'int'), col('drafts', 'Drafts', 'int'), col('awaiting', 'Awaiting review', 'int'), col('returned', 'Returned or rejected', 'int'), col('approved', 'Approved', 'int'),
    col('published', 'Published', 'int'), col('archived', 'Archived', 'int'), col('submissions', 'Submissions', 'int'), col('approvals', 'Approvals received', 'int'), col('rejections', 'Rejections and returns received', 'int'), col('lastActivity', 'Last activity', 'date')], rows, summary: [
    { label: 'Creators', value: rows.length }, { label: 'Assessments created', value: sum('created'), sub: sum('published') + ' published' },
    { label: 'Awaiting review', value: sum('awaiting') }, { label: 'Submissions', value: sum('submissions'), sub: sum('approvals') + ' approved · ' + sum('rejections') + ' rejected or returned' },
  ] };
}
async function ticketStats(ctx, f) {
  const where = {}; const range = dateRange(f);
  if (range) where.createdAt = range;
  if (f.status) where.status = f.status;
  const list = await db.ticket.findMany({ where, select: { id: true, category: true, status: true, priority: true, assigneeId: true, createdAt: true, events: { where: { field: 'status', toVal: 'RESOLVED' }, select: { at: true }, orderBy: { at: 'asc' }, take: 1 } } });
  const OPEN = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER'], by = new Map();
  list.forEach(t => { (by.get(t.category) || by.set(t.category, []).get(t.category)).push(t); });
  const resolveDays = ts => { const d = ts.filter(t => t.events.length).map(t => (t.events[0].at - t.createdAt) / 86400e3); return d.length ? Math.round((d.reduce((a, b) => a + b, 0) / d.length) * 100) / 100 : null; };
  const rows = [...by.entries()].map(([category, ts]) => ({ category, total: ts.length, open: ts.filter(t => OPEN.includes(t.status)).length, unassigned: ts.filter(t => !t.assigneeId && OPEN.includes(t.status)).length,
    resolved: ts.filter(t => t.status === 'RESOLVED').length, closed: ts.filter(t => t.status === 'CLOSED').length, urgent: ts.filter(t => t.priority === 'URGENT').length, high: ts.filter(t => t.priority === 'HIGH').length, avgDays: resolveDays(ts) }))
    .sort((a, b) => b.total - a.total || a.category.localeCompare(b.category));
  const all = resolveDays(list);
  return { columns: [col('category', 'Category'), col('total', 'Tickets', 'int'), col('open', 'Open', 'int'), col('unassigned', 'Open and unassigned', 'int'), col('resolved', 'Resolved', 'int'), col('closed', 'Closed', 'int'), col('urgent', 'Urgent', 'int'), col('high', 'High priority', 'int'), col('avgDays', 'Average days to resolve', 'num')], rows, summary: [
    { label: 'Tickets', value: list.length, sub: rows.length + ' categories' },
    { label: 'Open', value: list.filter(t => OPEN.includes(t.status)).length, sub: list.filter(t => !t.assigneeId && OPEN.includes(t.status)).length + ' unassigned' },
    { label: 'Resolved or closed', value: list.filter(t => !OPEN.includes(t.status)).length },
    { label: 'Average days to resolve', value: all == null ? '—' : all.toFixed(2) },
  ] };
}
// Placement history rows are limited to staff in scope. Audit entries about a staff record are limited the same
// way; entries about departments, grades, stations and locations are only shown to people who see every department.
const ORG_ENTITIES = ['StaffRecord', 'Department', 'Grade', 'Station', 'Location', 'GradeSupervisoryMapping', 'SupervisorAssignment', 'StaffPlacementHistory'];
const short = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s == null ? '—' : s.length > 60 ? s.slice(0, 57) + '…' : s; };
export function auditDetail(before, after) {
  const b = before && typeof before === 'object' ? before : {}, a = after && typeof after === 'object' ? after : {};
  const keys = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(k => JSON.stringify(b[k]) !== JSON.stringify(a[k]));
  return keys.length ? keys.slice(0, 6).map(k => k + ': ' + (k in b ? short(b[k]) : '—') + ' → ' + (k in a ? short(a[k]) : '—')).join('; ') : null;
}
async function orgChanges(ctx, f) {
  const range = dateRange(f), all = ctx.visibleDepartmentIds === null;
  const placeWhere = { staff: staffFilterWhere(ctx, {}, { activeOnly: false }) };
  if (f.departmentId) placeWhere.departmentId = f.departmentId;
  if (range) placeWhere.fromDate = range;
  const [places, visible] = await Promise.all([
    db.staffPlacementHistory.findMany({ where: placeWhere, orderBy: { fromDate: 'desc' }, take: 20000, include: { staff: { select: STAFF_SELECT }, department: { select: { name: true } }, station: { select: { name: true, location: { select: { name: true } } } }, changedBy: { select: { displayName: true } } } }),
    db.staffRecord.findMany({ where: staffFilterWhere(ctx, { departmentId: f.departmentId }, { activeOnly: false }), select: { id: true, staffNo: true, firstName: true, lastName: true, otherNames: true, department: { select: { name: true } } } }),
  ]);
  const vis = new Map(visible.map(s => [String(s.id), s]));
  const auditWhere = { OR: [{ entityType: { in: ORG_ENTITIES } }, { action: { startsWith: 'org.' } }, { action: { startsWith: 'staff.' } }] };
  if (range) auditWhere.at = range;
  const audits = (await db.auditLog.findMany({ where: auditWhere, orderBy: { at: 'desc' }, take: 20000, include: { actor: { select: { displayName: true } } } }))
    .filter(e => (e.entityType === 'StaffRecord' ? vis.has(String(e.entityId)) : all && !f.departmentId) && e.entityType !== 'StaffPlacementHistory');
  const rows = [
    ...places.map(p => ({ at: p.fromDate, change: 'Placement', staffNo: p.staff.staffNo, record: fullName(p.staff), department: p.department?.name || null, station: p.station ? p.station.name : null,
      detail: (p.toDate ? 'Until ' + fmtDay(p.toDate) + '. ' : 'Current placement. ') + (p.reason || ''), by: p.changedBy?.displayName || 'System' })),
    ...audits.map(e => { const s = e.entityType === 'StaffRecord' ? vis.get(String(e.entityId)) : null;
      return { at: e.at, change: e.action, staffNo: s ? s.staffNo : null, record: s ? fullName(s) : (e.entityType || 'Record') + (e.entityId ? ' #' + e.entityId : ''), department: s ? s.department?.name || null : null, station: null,
        detail: [e.outcome !== 'SUCCESS' ? e.outcome : '', auditDetail(e.before, e.after)].filter(Boolean).join(' ') || null, by: e.actor?.displayName || 'System' }; }),
  ].sort((a, b) => new Date(b.at) - new Date(a.at));
  return { columns: [col('at', 'Date', 'datetime'), col('change', 'Change'), col('staffNo', 'Staff ID'), col('record', 'Staff member or record'), col('department', 'Department'), col('station', 'Station'), col('detail', 'Details'), col('by', 'Changed by')], rows, summary: [
    { label: 'Changes', value: rows.length }, { label: 'Placements', value: places.length, sub: new Set(places.map(p => p.staffId)).size + ' staff' },
    { label: 'Other organisation changes', value: audits.length, sub: all ? 'Departments, grades, stations, staff records' : 'Staff records in your departments' },
  ] };
}

// ===== REPORTS · Run a report =====
const BUILDERS = {
  'staff-profile': staffProfile, 'attempt-history': attemptHistory, 'final-averages': finalAverages,
  department: (c, f) => performance(c, f, 'department'), location: (c, f) => performance(c, f, 'location'), grade: (c, f) => performance(c, f, 'grade'),
  'gap-analysis': gapAnalysisReport, gaps: gapsReport, proficiency: proficiencyReport, completion: completionReport, overdue: overdueReport,
  'content-approvals': contentApprovals, 'creator-activity': creatorActivity, tickets: ticketStats, 'org-changes': orgChanges,
};
// The "filters used" lines for the screen and file headers, with names instead of ids.
async function describeFilters(ctx, def, f) {
  const out = [], name = async (model, id, pick = r => r.name) => { const r = await db[model].findUnique({ where: { id } }); return r ? pick(r) : 'Unknown'; };
  if (f.staffId) { const s = await db.staffRecord.findUnique({ where: { id: f.staffId } }); out.push(['Staff member', s ? fullName(s) + ' (' + s.staffNo + ')' : 'Unknown']); }
  if (f.assessmentId) out.push(['Assessment', await name('assessment', f.assessmentId, r => r.title)]);
  if (f.competencyId) out.push(['Competency', await name('competency', f.competencyId)]);
  if (f.departmentId) out.push(['Department', await name('department', f.departmentId)]);
  if (f.gradeId) out.push(['Grade', await name('grade', f.gradeId)]);
  if (f.stationId) out.push(['Station', await name('station', f.stationId)]);
  if (f.locationId) out.push(['Location', await name('location', f.locationId)]);
  if (f.status) out.push(['Status', (def.status.find(([v]) => v === f.status) || [])[1] || f.status]);
  if (f.from || f.to) out.push([(def.dateLabel || 'Date') + ' range', (f.from ? fmtDay(f.from) : 'any time') + ' to ' + (f.to ? fmtDay(f.to) : 'today')]);
  if (f.q) out.push(['Search', f.q]);
  if (!def.perm || def.key === 'org-changes') {
    const ids = ctx.visibleDepartmentIds;
    const scope = ids === null ? 'All departments' : (await db.department.findMany({ where: { id: { in: ids } }, select: { name: true } })).map(d => d.name).join(', ') || 'Your direct reports only';
    out.push(['Departments covered', scope + (ids !== null && ctx.account.staffId ? ' (plus your direct reports)' : '')]);
  }
  return out;
}
// The one function behind the screen and every export: the full, filtered, searched and sorted report.
export async function runReport(ctx, key, filters, { exporting = false } = {}) {
  const def = reportDef(key);
  assertReportAccess(ctx, def, { exporting });
  const f = filters instanceof URLSearchParams ? parseFilters(def, filters) : filters;
  if (f.staffId) assertStaffVisible(ctx, await db.staffRecord.findUnique({ where: { id: f.staffId }, select: { id: true, departmentId: true, supervisorId: true } }));
  const built = await BUILDERS[key](ctx, f);
  let rows = built.rows;
  if (f.q) rows = searchRows(rows, built.columns, f.q);
  if (f.sort) rows = sortRows(rows, built.columns, f.sort, f.dir);
  return {
    report: { key: def.key, title: def.title, description: def.description, group: def.group },
    columns: built.columns.map(c => ({ key: c.key, label: c.label, type: c.type, empty: c.empty })),
    rows, total: rows.length, summary: built.summary || [], notes: built.notes || [],
    filtersUsed: await describeFilters(ctx, def, f), filters: f, generatedAt: new Date().toISOString(),
    generatedBy: ctx.user.name + ' (' + ctx.user.username + ')',
  };
}
