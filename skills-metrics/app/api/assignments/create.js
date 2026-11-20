// =============================================================================
// create.js · Checks and saves new assignments: one place for the rules, used by the Assignments page and by
//   publishing an assessment that has a planned audience (lib/server/audience.js)
// Screen / URL: none; server only (not a route: Next only serves files named route.js)
// Used by: app/api/assignments/route.js (POST), lib/server/audience.js (publish)
// Depends on: lib/server/{scope,audit,notify,http,assigned}, ./progress.js, ./rules.js
// Sections (search for these markers): CREATE · Target checks, CREATE · Save & notify
// =============================================================================
import 'server-only';
import { assertStaffVisible } from '@/lib/server/scope';
import { audit } from '@/lib/server/audit';
import { notify, fmtDate } from '@/lib/server/notify';
import { coveredWhere } from '@/lib/server/assigned';
import { badRequest, forbidden } from '@/lib/server/http';
import { takerAccounts, plain } from './progress';
import { TARGET_FIELD, TARGET_LABEL, targetAllowed } from './rules';

export const TARGET_MODEL = { DEPARTMENT: 'department', GRADE: 'grade', STATION: 'station', LOCATION: 'location' };

// ===== CREATE · Target checks =====
// Throws a 400 / 403 / 404 with a message that is safe to show when one target may not be used by this person
// (scope rules from rules.js targetAllowed; individuals through lib/server/scope.js and must be active staff).
export async function checkTarget(tx, ctx, targetType, id) {
  if (targetType === 'INDIVIDUAL') {
    const s = await tx.staffRecord.findUnique({ where: { id }, select: { id: true, status: true, departmentId: true, supervisorId: true } });
    assertStaffVisible(ctx, s);
    if (s.status !== 'ACTIVE') throw badRequest('Only active staff can be given an assessment.');
    return;
  }
  if (!targetAllowed(ctx.visibleDepartmentIds, targetType, id, ctx.stationId)) throw forbidden(targetType === 'DEPARTMENT' ? 'You can only assign to departments you manage.' : (targetType === 'STATION' ? 'You can only assign to your own station.' : 'Only people who can see every department can assign by grade, station or location.'));
  const t = await tx[TARGET_MODEL[targetType]].findUnique({ where: { id } });
  if (!t) throw badRequest('That ' + TARGET_LABEL[targetType].toLowerCase() + ' was not found.');
  if (t.active === false) throw badRequest(t.name + ' is inactive, so it cannot be assigned to.');
}

// ===== CREATE · Save & notify =====
// One assignment per target id. Everyone covered is told once (people reached by two of the new targets get one
// message). b: { targetType, targetIds, startsAt, deadline, maxAttempts }. Returns { created, covered, notified }.
export async function saveAssignments(tx, ctx, assessment, b, ip) {
  const field = TARGET_FIELD[b.targetType];
  const created = [], told = new Set();
  let notified = 0;
  for (const id of b.targetIds) {
    const a = await tx.assessmentAssignment.create({ data: { assessmentId: assessment.id, targetType: b.targetType, [field]: id, startsAt: b.startsAt, deadline: b.deadline, maxAttempts: b.maxAttempts ?? null, createdById: ctx.account.id } });
    await audit({ actorId: ctx.account.id, action: 'assignment.create', entityType: 'AssessmentAssignment', entityId: a.id, after: plain({ assessmentId: assessment.id, title: assessment.title, targetType: b.targetType, targetId: id, startsAt: b.startsAt, deadline: b.deadline, maxAttempts: b.maxAttempts ?? null, source: b.source }), ip }, tx);
    const covered = (await tx.staffRecord.findMany({ where: coveredWhere(a), select: { id: true } })).map(s => s.id).filter(sid => !told.has(sid));
    covered.forEach(sid => told.add(sid));
    const accounts = [...(await takerAccounts(covered, tx)).values()].flat();
    notified += await notify({ accountIds: accounts, key: 'assessment.assigned', vars: { title: assessment.title, startsAt: fmtDate(b.startsAt), deadline: fmtDate(b.deadline) }, link: '/assessments', dedupe: 'assigned:' + a.id }, tx);
    created.push(a.id);
  }
  return { created, covered: told.size, notified };
}
