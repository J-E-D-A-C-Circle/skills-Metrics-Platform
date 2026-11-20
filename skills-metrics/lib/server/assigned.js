// =============================================================================
// assigned.js · Who an assessment is assigned to, each person's dates and attempt limit, and their progress
// Screen / URL: none; server only. One definition used by My Assessments, Assignments, dashboards and reports,
//   so "outstanding", "overdue" and "completion rate" mean the same thing everywhere.
// Used by: app/api/** (assignments, my assessments, attempts, dashboards, reports)   Depends on: lib/server/db.js
// Sections (search for these markers): ASSIGNED · Who is covered, ASSIGNED · One person's assessments,
//   ASSIGNED · Deadlines & extensions, ASSIGNED · Progress status, ASSIGNED · Result release
// Rules:
//   - An assignment targets one person, a department, a grade, a station or a location. A person is covered when
//     their CURRENT staff record matches (ACTIVE staff only).
//   - When the same assessment reaches a person through several assignments, they get one entry: the earliest
//     start, the latest deadline and the highest attempt limit (so overlapping groups never double-count anyone).
//   - The deadline is the assignment's deadline, replaced by the newest extension for that person or for the
//     whole assignment (whichever is later).
//   - Attempt limit: the assignment's maxAttempts, else the assessment's maxAttempts (3 by default).
// =============================================================================
import 'server-only';
import { db } from './db';

// ===== ASSIGNED · Who is covered =====
// Prisma `where` for the StaffRecords an assignment covers.
export function coveredWhere(a) {
  const base = { status: 'ACTIVE' };
  switch (a.targetType) {
    case 'INDIVIDUAL': return { ...base, id: a.staffId };
    case 'DEPARTMENT': return { ...base, departmentId: a.departmentId };
    case 'GRADE': return { ...base, gradeId: a.gradeId };
    case 'STATION': return { ...base, stationId: a.stationId };
    case 'LOCATION': return { ...base, station: { locationId: a.locationId } };
    default: return { id: -1 };
  }
}
// The reverse: Prisma `where` for AssessmentAssignment rows that cover one staff record.
export function assignmentsCoveringWhere(staff) {
  const or = [{ targetType: 'INDIVIDUAL', staffId: staff.id }];
  if (staff.departmentId) or.push({ targetType: 'DEPARTMENT', departmentId: staff.departmentId });
  if (staff.gradeId) or.push({ targetType: 'GRADE', gradeId: staff.gradeId });
  if (staff.stationId) or.push({ targetType: 'STATION', stationId: staff.stationId });
  const loc = staff.station?.locationId;
  if (loc) or.push({ targetType: 'LOCATION', locationId: loc });
  return { OR: or };
}

// ===== ASSIGNED · Deadlines & extensions =====
// Effective deadline for one person on one assignment (assignment.extensions must be loaded).
export function deadlineFor(a, staffId) {
  let d = new Date(a.deadline);
  for (const x of a.extensions || []) if ((x.staffId == null || x.staffId === staffId) && new Date(x.newDeadline) > d) d = new Date(x.newDeadline);
  return d;
}
const limitOf = a => a.maxAttempts ?? a.assessment?.maxAttempts ?? 3;

// ===== ASSIGNED · One person's assessments =====
// Returns [{ assessment, assessmentId, assignmentIds, startsAt, deadline, maxAttempts }], one per assessment.
// Only PUBLISHED (or ARCHIVED, for history) assessments are returned. `staff` needs id, departmentId, gradeId,
// stationId and station.locationId (include: { station: true }).
export async function assessmentsForStaff(staff, tx = db) {
  const rows = await tx.assessmentAssignment.findMany({
    where: { ...assignmentsCoveringWhere(staff), assessment: { status: { in: ['PUBLISHED', 'ARCHIVED'] } } },
    include: { extensions: true, assessment: true },
  });
  const by = new Map();
  for (const a of rows) {
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
// One person's entry for one assessment, or null when it isn't assigned to them.
export async function assignmentFor(staff, assessmentId, tx = db) {
  return (await assessmentsForStaff(staff, tx)).find(x => x.assessmentId === assessmentId) || null;
}

// ===== ASSIGNED · Progress status =====
// status for one person and one assessment, from their attempts (any order):
//   UPCOMING (not open yet) · NOT_STARTED · IN_PROGRESS · COMPLETED (at least one completed attempt) ·
//   OVERDUE (deadline passed with no completed attempt).
// "Completed" for completion rates = at least one COMPLETED attempt. Denominator = active staff with the
// assessment assigned and already open (startsAt <= now).
export function progressStatus(entry, attempts, now = new Date()) {
  const done = attempts.filter(a => a.status === 'COMPLETED').length;
  const open = attempts.some(a => a.status === 'IN_PROGRESS');
  if (done > 0) return 'COMPLETED';
  if (now < entry.startsAt) return 'UPCOMING';
  if (now > entry.deadline) return 'OVERDUE';
  return open ? 'IN_PROGRESS' : 'NOT_STARTED';
}
export const PROGRESS_LABEL = { UPCOMING: 'Upcoming', NOT_STARTED: 'Not started', IN_PROGRESS: 'In progress', COMPLETED: 'Completed', OVERDUE: 'Overdue' };
// Attempts used = every attempt started (completed, submitted, pending, in progress, abandoned, expired all use
// one of the allowed attempts, so refreshing or opening new tabs can never create extra tries).
export const attemptsUsed = attempts => attempts.length;
export const attemptsCompleted = attempts => attempts.filter(a => a.status === 'COMPLETED').length;

// ===== ASSIGNED · Result release =====
// May a member of staff see their OWN results for this assessment yet? (Supervisors and admins with the right
// permission always see results in their scope.) entry = this person's entry from assessmentsForStaff (its
// deadline includes extensions), or null when the assessment is no longer assigned to them.
//   IMMEDIATE: as soon as an attempt is completed · AFTER_DEADLINE: once their deadline has passed ·
//   MANUAL: once an administrator has released results (Assessment.resultsReleasedAt).
export function resultsReleased(assessment, entry, now = new Date()) {
  if (assessment.resultRelease === 'MANUAL') return !!assessment.resultsReleasedAt;
  if (assessment.resultRelease === 'AFTER_DEADLINE') return !!assessment.resultsReleasedAt || (entry ? now > entry.deadline : true);
  return true;
}
