// =============================================================================
// rules.js · Assignment rules with no database code: targets and scope, one person's merged dates, progress
//   counts, assignment state, reminder timing and paging
// Screen / URL: none; used by the Assignments routes (/api/assignments/**) and the reminders job
// Used by: app/api/assignments/**, lib/server/reminders.js, tests/assignments.test.js   Depends on: nothing
// Sections (search for these markers): RULES · Targets & scope, RULES · Dates, RULES · One person's entry,
//   RULES · Progress counts, RULES · Assignment state, RULES · Reminders, RULES · Filtering & paging
// Kept free of database and server imports so it can be unit-tested. The merge below mirrors
// lib/server/assigned.js assessmentsForStaff (earliest start, latest deadline, highest attempt limit).
// =============================================================================

// ===== RULES · Targets & scope =====
// Which column of AssessmentAssignment holds the target id, and the words shown for each target type.
export const TARGETS = ['INDIVIDUAL', 'DEPARTMENT', 'GRADE', 'STATION', 'LOCATION'];
export const TARGET_FIELD = { INDIVIDUAL: 'staffId', DEPARTMENT: 'departmentId', GRADE: 'gradeId', STATION: 'stationId', LOCATION: 'locationId' };
export const TARGET_LABEL = { INDIVIDUAL: 'Individual', DEPARTMENT: 'Department', GRADE: 'Grade', STATION: 'Station', LOCATION: 'Location' };
export const targetIdOf = a => a[TARGET_FIELD[a.targetType]] ?? null;
// May someone with this department scope (null = every department) assign to / manage this kind of target?
// Departments must be inside their scope; grade, station and location targets reach across departments, so only
// people who see every department may use them (unless they are a Station Manager managing their own station target).
// Individuals are checked against the staff record separately.
export function targetAllowed(visibleDepartmentIds, targetType, targetId, stationId = null) {
  if (visibleDepartmentIds === null) return true;
  if (targetType === 'DEPARTMENT') return visibleDepartmentIds.includes(targetId);
  if (targetType === 'STATION' && stationId != null) return targetId === stationId;
  if (targetType === 'INDIVIDUAL') return true; // checked with assertStaffVisible on the staff record
  return false;
}

// ===== RULES · Dates =====
// Returns an error message, or null when the dates are fine.
export function checkDates(startsAt, deadline) {
  const s = new Date(startsAt), d = new Date(deadline);
  if (isNaN(s) || isNaN(d)) return 'Enter a valid start date and deadline.';
  if (d <= s) return 'The deadline must be after the start date.';
  return null;
}
// An extension must move the deadline later than it is now for that person (or the whole assignment) and into the future.
export function checkExtension(current, next, now = new Date()) {
  const c = new Date(current), n = new Date(next);
  if (isNaN(n)) return 'Enter a valid new deadline.';
  if (n <= c) return 'The new deadline must be later than the current deadline.';
  if (n <= now) return 'The new deadline must be in the future.';
  return null;
}
// Attempt limit for one assignment: its own override, else the assessment's limit, else 3 (same as assigned.js).
export const limitOf = a => a.maxAttempts ?? a.assessment?.maxAttempts ?? 3;

// ===== RULES · One person's entry =====
// parts: [{ assignmentId, startsAt, deadline (already including extensions), maxAttempts }] for every assignment
// of ONE assessment that covers ONE person. Returns one entry, so overlapping assignments never double-count:
// { startsAt (earliest), deadline (latest), maxAttempts (highest), assignmentIds, deadlineAssignmentId }.
export function mergeEntry(parts) {
  if (!parts.length) return null;
  const e = { startsAt: new Date(parts[0].startsAt), deadline: new Date(parts[0].deadline), maxAttempts: parts[0].maxAttempts, assignmentIds: [], deadlineAssignmentId: parts[0].assignmentId };
  for (const p of parts) {
    e.assignmentIds.push(p.assignmentId);
    if (new Date(p.startsAt) < e.startsAt) e.startsAt = new Date(p.startsAt);
    if (new Date(p.deadline) > e.deadline) { e.deadline = new Date(p.deadline); e.deadlineAssignmentId = p.assignmentId; }
    if (p.maxAttempts > e.maxAttempts) e.maxAttempts = p.maxAttempts;
  }
  return e;
}

// ===== RULES · Progress counts =====
// statuses: one progress status per person (UPCOMING | NOT_STARTED | IN_PROGRESS | COMPLETED | OVERDUE).
// Completion rate = completed / people whose assessment has opened (assigned.js: denominator excludes UPCOMING).
// rate is null when nobody's assessment has opened yet (shown as "—", never 0%).
export function summarize(statuses) {
  const c = { total: statuses.length, UPCOMING: 0, NOT_STARTED: 0, IN_PROGRESS: 0, COMPLETED: 0, OVERDUE: 0 };
  for (const s of statuses) c[s] = (c[s] || 0) + 1;
  const open = c.total - c.UPCOMING;
  return { ...c, open, rate: open ? c.COMPLETED / open : null };
}

// ===== RULES · Assignment state =====
// Upcoming (not open yet), Open, or Closed (its latest deadline, counting every extension, has passed).
export function latestDeadline(a) {
  let d = new Date(a.deadline);
  for (const x of a.extensions || []) if (new Date(x.newDeadline) > d) d = new Date(x.newDeadline);
  return d;
}
export function assignmentState(a, now = new Date()) {
  if (now < new Date(a.startsAt)) return 'UPCOMING';
  return now > latestDeadline(a) ? 'CLOSED' : 'OPEN';
}
export const STATE_LABEL = { UPCOMING: 'Upcoming', OPEN: 'Open', CLOSED: 'Closed' };

// ===== RULES · Reminders =====
// Returns true if the person has made 0% progress on an assessment (no completed or in-progress attempts).
export function isZeroProgress(attempts) {
  if (!attempts || !attempts.length) return true;
  return !attempts.some(a => a.status === 'COMPLETED' || a.status === 'IN_PROGRESS');
}

// Which reminder (if any) one person should get now. entry = their merged entry; attempts = their attempts on it.
//   'soon'   deadline within the next `soonHours` (48), not completed, open, and an attempt is still possible.
//   'passed' deadline has passed (within the last `passedDays`, 14, so a first run never floods people about
//            long-closed assessments), not completed.
export const SOON_HOURS = 48, PASSED_DAYS = 14;
export function reminderKind(entry, attempts, now = new Date(), { soonHours = SOON_HOURS, passedDays = PASSED_DAYS } = {}) {
  if (!entry || attempts.some(a => a.status === 'COMPLETED')) return null;
  const t = now.getTime(), start = new Date(entry.startsAt).getTime(), dl = new Date(entry.deadline).getTime();
  if (t < start) return null;
  if (dl < t) return t - dl <= passedDays * 864e5 ? 'passed' : null;
  if (dl - t <= soonHours * 3600e3) {
    const canTry = attempts.some(a => a.status === 'IN_PROGRESS') || attempts.length < entry.maxAttempts;
    return canTry ? 'soon' : null;
  }
  return null;
}
// One key per person + assignment + deadline: re-running never repeats, but a new deadline (extension) can
// remind again. notify() adds the account id on the end.
export const reminderDedupe = (kind, assignmentId, staffId, deadline) => 'deadline.' + kind + ':' + assignmentId + ':' + staffId + ':' + new Date(deadline).getTime();

// ===== RULES · Filtering & paging =====
// rows: people with { name, staffNo, department, status }. status 'ALL' or one progress status.
export function filterPeople(rows, { status = 'ALL', q = '' } = {}) {
  const t = String(q || '').trim().toLowerCase();
  return rows.filter(r => (status === 'ALL' || r.status === status) && (!t || (r.name + ' ' + r.staffNo + ' ' + (r.department || '')).toLowerCase().includes(t)));
}
export function pageOf(rows, page = 1, pageSize = 25) {
  const size = Math.min(Math.max(1, Number(pageSize) || 25), 200), pages = Math.max(1, Math.ceil(rows.length / size));
  const p = Math.min(Math.max(1, Number(page) || 1), pages);
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pageSize: size, pages, total: rows.length };
}
