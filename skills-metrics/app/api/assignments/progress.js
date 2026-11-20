// =============================================================================
// progress.js · Loads assignments with the people they cover, each person's merged dates and their progress
// Screen / URL: none; server only. Feeds the Assignments page (/cycles) and the reminders job.
// Used by: app/api/assignments/**, lib/server/reminders.js
// Depends on: lib/server/{db,assigned,scope,http}, lib/permissions.js, ./rules.js
// Sections (search for these markers): PROGRESS · Load, PROGRESS · Visibility & management checks,
//   PROGRESS · Who gets notified, PROGRESS · Row shapes
// One person appears once per assessment however many assignments reach them (rules.js mergeEntry), and their
// status comes from lib/server/assigned.js progressStatus, so the numbers match My Assessments and the dashboards.
// =============================================================================
import 'server-only';
import { db } from '@/lib/server/db';
import { coveredWhere, deadlineFor, progressStatus, attemptsUsed, attemptsCompleted, PROGRESS_LABEL } from '@/lib/server/assigned';
import { staffWhere, assertStaffVisible } from '@/lib/server/scope';
import { forbidden, ApiError } from '@/lib/server/http';
import { effectivePermissions } from '@/lib/permissions';
import { mergeEntry, limitOf, targetAllowed, TARGET_LABEL } from './rules';

const STAFF_SELECT = { id: true, staffNo: true, firstName: true, lastName: true, otherNames: true, departmentId: true, gradeId: true, stationId: true, supervisorId: true,
  department: { select: { name: true } }, grade: { select: { name: true } }, station: { select: { name: true } } };
export const ASSIGNMENT_INCLUDE = {
  assessment: { select: { id: true, title: true, status: true, maxAttempts: true, resultRelease: true, resultsReleasedAt: true } },
  extensions: { orderBy: { at: 'desc' }, include: { approvedBy: { select: { displayName: true } }, staff: { select: { staffNo: true, firstName: true, lastName: true } } } },
  staff: { select: { id: true, staffNo: true, firstName: true, lastName: true, departmentId: true, supervisorId: true } },
  department: { select: { name: true } }, grade: { select: { name: true } }, station: { select: { name: true } }, location: { select: { name: true } },
  createdBy: { select: { displayName: true } },
};
// audit.js scrub() turns Date objects into {}, so before/after values are passed as plain JSON (dates as ISO text).
export const plain = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
export const staffName = s => [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(' ');

// ===== PROGRESS · Load =====
// For the given assessments: every assignment, and for each person covered (only people the viewer may see when
// ctx is given; everyone when ctx is null, for the reminders job) their merged entry, attempts and status.
// Returns { assignments, people: Map('assessmentId:staffId' -> person), coveredBy: Map(assignmentId -> [staffId]) }.
export async function loadProgress(assessmentIds, ctx, now = new Date(), tx = db) {
  const assignments = await tx.assessmentAssignment.findMany({ where: { assessmentId: { in: assessmentIds } }, include: ASSIGNMENT_INCLUDE, orderBy: { id: 'asc' } });
  const scope = ctx ? staffWhere(ctx) : {};
  const coveredBy = new Map(), staffById = new Map(), parts = new Map();
  for (const a of assignments) {
    const staff = await tx.staffRecord.findMany({ where: { AND: [coveredWhere(a), scope] }, select: STAFF_SELECT });
    coveredBy.set(a.id, staff.map(s => s.id));
    for (const s of staff) {
      staffById.set(s.id, s);
      const k = a.assessmentId + ':' + s.id;
      if (!parts.has(k)) parts.set(k, []);
      parts.get(k).push({ assignmentId: a.id, startsAt: a.startsAt, deadline: deadlineFor(a, s.id), maxAttempts: limitOf(a) });
    }
  }
  const staffIds = [...staffById.keys()];
  const attempts = staffIds.length ? await tx.attempt.findMany({ where: { assessmentId: { in: assessmentIds }, staffId: { in: staffIds } }, select: { assessmentId: true, staffId: true, status: true, attemptNo: true } }) : [];
  const byPair = new Map();
  for (const t of attempts) { const k = t.assessmentId + ':' + t.staffId; if (!byPair.has(k)) byPair.set(k, []); byPair.get(k).push(t); }
  const people = new Map();
  for (const [k, list] of parts) {
    const [assessmentId, staffId] = k.split(':').map(Number);
    const entry = mergeEntry(list), mine = byPair.get(k) || [];
    const status = progressStatus(entry, mine, now);
    people.set(k, { assessmentId, staffId, staff: staffById.get(staffId), entry, attempts: mine, status });
  }
  return { assignments, people, coveredBy };
}

// ===== PROGRESS · Visibility & management checks =====
// A scoped viewer sees an assignment when it covers someone they can see, or its target is inside their scope.
export function canSeeAssignment(ctx, a, coveredIds) {
  if (ctx.visibleDepartmentIds === null) return true;
  if (ctx.stationId && a.targetType === 'STATION' && a.stationId === ctx.stationId) return true;
  if ((coveredIds || []).length) return true;
  if (a.targetType === 'DEPARTMENT') return ctx.visibleDepartmentIds.includes(a.departmentId);
  if (a.targetType === 'INDIVIDUAL' && a.staff) { try { assertStaffVisible(ctx, a.staff); return true; } catch (e) { return false; } }
  return false;
}
// Changing an assignment, extending it for everyone or cancelling it needs the same reach as creating it.
export function assertCanManage(ctx, a) {
  if (a.targetType === 'INDIVIDUAL') { assertStaffVisible(ctx, a.staff); return; }
  if (ctx.stationId && a.targetType === 'STATION' && a.stationId === ctx.stationId) return;
  const targetId = a[a.targetType?.toLowerCase() + 'Id'] ?? a.departmentId;
  if (!targetAllowed(ctx.visibleDepartmentIds, a.targetType, targetId, ctx.stationId)) throw forbidden('This assignment covers departments outside the ones you can manage.');
}
export async function findAssignment(id, tx = db) {
  const a = await tx.assessmentAssignment.findUnique({ where: { id }, include: ASSIGNMENT_INCLUDE });
  if (!a) throw new ApiError(404, 'Assignment not found.');
  return a;
}

// ===== PROGRESS · Who gets notified =====
// Login accounts for these staff records that can take assessments (an Assessment Creator without the Staff
// role, or a suspended account, is not told to take one). Returns Map(staffId -> [accountId]).
export async function takerAccounts(staffIds, tx = db) {
  const out = new Map();
  if (!staffIds.length) return out;
  const rows = await tx.account.findMany({ where: { staffId: { in: staffIds }, status: { in: ['ACTIVE', 'MUST_CHANGE_PASSWORD'] } }, select: { id: true, staffId: true, roles: { select: { role: true } }, permissions: { select: { key: true } } } });
  for (const r of rows) {
    if (!effectivePermissions({ roles: r.roles.map(x => x.role), permissions: r.permissions.map(x => x.key) }).includes('assessments.view')) continue;
    if (!out.has(r.staffId)) out.set(r.staffId, []);
    out.get(r.staffId).push(r.id);
  }
  return out;
}
export const allAccounts = map => [...map.values()].flat();

// ===== PROGRESS · Row shapes =====
// What the browser gets for an assignment and for a person. No contact details or results, only progress.
export function targetName(a) {
  if (a.targetType === 'INDIVIDUAL') return a.staff ? staffName(a.staff) + ' (' + a.staff.staffNo + ')' : 'Staff member';
  const t = { DEPARTMENT: a.department, GRADE: a.grade, STATION: a.station, LOCATION: a.location }[a.targetType];
  return t ? t.name : '—';
}
export function assignmentRow(a) {
  return {
    id: a.id, assessmentId: a.assessmentId, assessment: a.assessment.title, assessmentStatus: a.assessment.status,
    resultRelease: a.assessment.resultRelease, resultsReleasedAt: a.assessment.resultsReleasedAt,
    targetType: a.targetType, targetLabel: TARGET_LABEL[a.targetType], target: targetName(a),
    startsAt: a.startsAt, deadline: a.deadline, maxAttempts: a.maxAttempts, limit: limitOf(a), createdBy: a.createdBy?.displayName || null, createdAt: a.createdAt,
    wholeExtension: deadlineFor(a, null) > new Date(a.deadline) ? deadlineFor(a, null) : null, extensions: a.extensions.length,
  };
}
export function personRow(p, a) {
  const s = p.staff;
  return {
    staffId: s.id, staffNo: s.staffNo, name: staffName(s), department: s.department?.name || null, grade: s.grade?.name || null, station: s.station?.name || null,
    status: p.status, statusLabel: PROGRESS_LABEL[p.status], used: attemptsUsed(p.attempts), completed: attemptsCompleted(p.attempts), limit: p.entry.maxAttempts,
    startsAt: p.entry.startsAt, deadline: p.entry.deadline,
    // deadline on THIS assignment (with extensions) and whether this person has an extension of their own on it
    ownDeadline: a ? deadlineFor(a, s.id) : null, personalExtension: a ? a.extensions.some(x => x.staffId === s.id) : false,
    otherAssignments: p.entry.assignmentIds.length - 1,
  };
}
