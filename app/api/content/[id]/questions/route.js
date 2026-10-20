// Route POST /api/content/[id]/questions · add a question to the end of the author's editable version
// Route PUT /api/content/[id]/questions · set the order and sections (skill areas) of every question at once
//   (Form Builder drag and drop, section moves and renames)
// =============================================================================
// Used by: components/SMContent.jsx and components/SMFormBuilder.jsx (Form Builder canvas)
// Depends on: lib/server/{db,session,audit,http,content}, app/api/content/_shared.js
// Sections (search for these markers): ADD QUESTION · Save, ARRANGE QUESTIONS · Input, ARRANGE QUESTIONS · Save
// Needs "Edit & submit drafts". Only the version's author may change a Draft / Returned / Rejected version.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp, ApiError } from '@/lib/server/http';
import { questionCreate, arrangePlan, LIMITS } from '@/lib/server/content';
import { getAssessment, editableVersion, idParam, QuestionBody, checkedQuestion } from '../../_shared';

// ===== ADD QUESTION · Save =====
export const POST = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.edit');
  const id = await idParam(params);
  const body = await readBody(req, QuestionBody);
  const q = await checkedQuestion(body);
  const made = await db.$transaction(async tx => {
    const a = await getAssessment(ctx, id, tx);
    const v = await editableVersion(ctx, a, { req, action: 'assessment.question.add' });
    const last = await tx.question.findFirst({ where: { versionId: v.id }, orderBy: { order: 'desc' }, select: { order: true } });
    const created = await tx.question.create({ data: questionCreate(v.id, (last?.order || 0) + 1, q) });
    await tx.assessment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
    await audit({ actorId: ctx.account.id, action: 'assessment.question.add', entityType: 'Question', entityId: created.id, after: { assessmentId: a.id, versionNo: v.versionNo, order: created.order, ...q }, ip: clientIp(req) }, tx);
    return created;
  });
  return json({ id: made.id, order: made.order }, 201);
});

// ===== ARRANGE QUESTIONS · Input =====
// Every question of the version, in the new order, with its section title (null = no section).
const Arrange = z.object({
  questions: z.array(z.object({ id: z.number().int().positive(), skillArea: z.string().max(LIMITS.skillArea + 20).nullable().optional() })).max(2000),
});
// Lift every order out of the way first so the unique (versionId, order) rule never trips mid-update.
const LIFT = 1000000;

// ===== ARRANGE QUESTIONS · Save =====
export const PUT = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.edit');
  const id = await idParam(params);
  const b = await readBody(req, Arrange);
  const out = await db.$transaction(async tx => {
    const a = await getAssessment(ctx, id, tx);
    const v = await editableVersion(ctx, a, { req, action: 'assessment.questions.arrange' });
    const current = await tx.question.findMany({ where: { versionId: v.id }, orderBy: { order: 'asc' }, select: { id: true, order: true, skillArea: true } });
    const plan = arrangePlan(current, b.questions);
    if (plan.error) throw new ApiError(409, plan.error);
    if (!plan.changes.length) return { changed: 0 };
    const moved = new Set(plan.changes.map(c => c.id));
    await tx.question.updateMany({ where: { id: { in: [...moved] } }, data: { order: { increment: LIFT } } });
    for (const c of plan.changes) await tx.question.update({ where: { id: c.id }, data: { order: c.order, skillArea: c.skillArea } });
    await tx.assessment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
    await audit({ actorId: ctx.account.id, action: 'assessment.questions.arrange', entityType: 'AssessmentVersion', entityId: v.id,
      before: { order: current.map(q => [q.id, q.skillArea]) }, after: { assessmentId: a.id, versionNo: v.versionNo, changes: plan.changes }, ip: clientIp(req) }, tx);
    return { changed: plan.changes.length };
  });
  return json({ ok: true, ...out });
});
