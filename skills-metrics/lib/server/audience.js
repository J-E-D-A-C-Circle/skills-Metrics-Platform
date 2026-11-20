// =============================================================================
// audience.js · The planned audience of an assessment ("who it is for"), chosen in the New assessment step before
//   the questions are built, and turned into real assignments when a version is published
// Screen / URL: Assessment Content > New assessment and the Settings tab (/forms); Assignments (/cycles) shows the
//   assignments it makes
// Used by: app/api/content/route.js (create), app/api/content/[id]/route.js (read / change),
//   app/api/content/[id]/action/route.js (publish)
// Depends on: lib/server/{http,content}, app/api/assignments/{create,rules,progress}.js
// Sections (search for these markers): AUDIENCE · Input, AUDIENCE · Saving a plan, AUDIENCE · Names for the screen,
//   AUDIENCE · On publish
// Rules (the safe choices):
//   - A plan is stored on Assessment.plannedAssignment. Creating or changing it assigns nothing and tells nobody.
//   - Individual people can only be picked by someone allowed to assign (cycles.assign), within their scope.
//   - On publish, the PUBLISHER's own assignment rights apply (the same checks as the Assignments page). A target that
//     no longer qualifies (inactive, outside their scope, already assigned) is skipped and listed; a plan whose
//     deadline has passed assigns nothing. Publishing itself never fails because of the plan.
//   - Once used, the plan is marked done ({ done: { at, by, assignmentIds, skipped } }) so later versions don't assign
//     it again. Changes after that are made on the Assignments page.
// =============================================================================
import 'server-only';
import { z } from 'zod';
import { badRequest, forbidden, ApiError } from './http';
import { AUDIENCE_TARGETS, AUDIENCE_LABEL, audienceProblems } from './content';
import { checkTarget, saveAssignments, TARGET_MODEL } from '@/app/api/assignments/create';
import { TARGET_FIELD, targetAllowed } from '@/app/api/assignments/rules';
import { staffName, plain } from '@/app/api/assignments/progress';

// ===== AUDIENCE · Input =====
// null / omitted = "decide later on the Assignments page".
export const AudienceBody = z.object({
  targetType: z.enum(AUDIENCE_TARGETS), targetIds: z.array(z.number().int().positive()).min(1).max(100),
  startsAt: z.coerce.date(), deadline: z.coerce.date(),
}).nullable().optional();

// ===== AUDIENCE · Saving a plan =====
// Checks a plan before it is stored and returns the JSON to store (or null). Every target must exist and be active.
export async function checkedPlan(tx, ctx, p) {
  if (!p) return null;
  const targetIds = [...new Set(p.targetIds)];
  const problems = audienceProblems({ ...p, targetIds });
  if (problems.length) throw badRequest(problems[0], { fields: { audience: problems } });
  if (p.targetType === 'INDIVIDUAL') {
    if (!ctx.user.perms.includes('cycles.assign')) throw forbidden('Only people who can assign assessments may pick individual staff. Choose a department, grade, station or location instead.');
    for (const id of targetIds) await checkTarget(tx, ctx, 'INDIVIDUAL', id);
  } else {
    // Same department rule as the Assignments page: only departments the person can see, and grade, station or
    // location (which reach across departments) only for someone who sees every department.
    if (targetIds.some(id => !targetAllowed(ctx.visibleDepartmentIds, p.targetType, id))) throw forbidden(p.targetType === 'DEPARTMENT' ? 'You can only choose departments you can see.' : 'Only people who can see every department can choose a grade, station or location.');
    const rows = await tx[TARGET_MODEL[p.targetType]].findMany({ where: { id: { in: targetIds } }, select: { id: true, name: true, active: true } });
    if (rows.length !== targetIds.length) throw badRequest('One of the chosen ' + AUDIENCE_LABEL[p.targetType].toLowerCase() + 's was not found.');
    const off = rows.find(r => r.active === false);
    if (off) throw badRequest(off.name + ' is inactive, so it cannot be chosen.');
  }
  return plain({ targetType: p.targetType, targetIds, startsAt: p.startsAt, deadline: p.deadline });
}

// ===== AUDIENCE · Names for the screen =====
// The plan with the target names. Staff names are only shown to people who may assign (others see a count).
export async function describePlan(tx, ctx, plan) {
  if (!plan || !plan.targetType) return null;
  let names = [];
  if (plan.targetType === 'INDIVIDUAL') {
    if (ctx.user.perms.includes('cycles.assign')) names = (await tx.staffRecord.findMany({ where: { id: { in: plan.targetIds } }, select: { id: true, firstName: true, lastName: true, otherNames: true, staffNo: true } })).map(s => ({ id: s.id, name: staffName(s) + ' (' + s.staffNo + ')' }));
  } else names = await tx[TARGET_MODEL[plan.targetType]].findMany({ where: { id: { in: plan.targetIds } }, select: { id: true, name: true } });
  return { ...plan, label: AUDIENCE_LABEL[plan.targetType], names };
}

// ===== AUDIENCE · On publish =====
// Called inside the publish transaction after the version is live. ctx = the publisher. Returns null when there is
// no plan (or it was used already), else { created, covered, notified, skipped: [message] }.
export async function assignPlannedAudience(tx, ctx, assessment, ip, now = new Date()) {
  const plan = assessment.plannedAssignment;
  if (!plan || !plan.targetType || plan.done) return null;
  const skipped = [];
  const problems = audienceProblems(plan, now);
  let ids = [];
  if (problems.length) skipped.push('Nothing was assigned: ' + problems.join(' ') + ' Assign it on the Assignments page.');
  else {
    const field = TARGET_FIELD[plan.targetType];
    const existing = new Set((await tx.assessmentAssignment.findMany({ where: { assessmentId: assessment.id, targetType: plan.targetType, [field]: { in: plan.targetIds } }, select: { [field]: true } })).map(r => r[field]));
    for (const id of plan.targetIds) {
      if (existing.has(id)) { skipped.push('Already assigned to one of the chosen ' + (plan.targetType === 'INDIVIDUAL' ? 'people' : AUDIENCE_LABEL[plan.targetType].toLowerCase() + 's') + ' (skipped).'); continue; }
      try { await checkTarget(tx, ctx, plan.targetType, id); ids.push(id); }
      catch (e) { if (e instanceof ApiError) skipped.push(e.message + ' (skipped)'); else throw e; }
    }
  }
  const made = ids.length ? await saveAssignments(tx, ctx, assessment, { targetType: plan.targetType, targetIds: ids, startsAt: new Date(plan.startsAt), deadline: new Date(plan.deadline), maxAttempts: null, source: 'planned audience' }, ip) : { created: [], covered: 0, notified: 0 };
  await tx.assessment.update({ where: { id: assessment.id }, data: { plannedAssignment: { ...plan, done: plain({ at: now, by: ctx.account.id, assignmentIds: made.created, skipped }) } } });
  return { ...made, skipped: [...new Set(skipped)] };
}
