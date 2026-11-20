// Route PATCH /api/content/[id]/questions/[qid] · change a question (text, type, options, answer key, points,
//   skill area, competency mapping) or move it up / down
// Route DELETE /api/content/[id]/questions/[qid] · remove a question (the ones after it move up one place)
// =============================================================================
// Used by: components/SMContent.jsx (question editor and question list)
// Depends on: lib/server/{db,session,audit,http,content}, app/api/content/_shared.js
// Sections (search for these markers): EDIT QUESTION · Find, EDIT QUESTION · Move, EDIT QUESTION · Save, DELETE QUESTION · Remove
// Needs "Edit & submit drafts". Only questions of the author's Draft / Returned / Rejected version can change, so a
// question that attempts were scored against (published versions) is never edited.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp, ApiError } from '@/lib/server/http';
import { plainQuestion, QUESTION_INCLUDE } from '@/lib/server/content';
import { getAssessment, editableVersion, idParam, QuestionBody, checkedQuestion } from '../../../_shared';

// ===== EDIT QUESTION · Find =====
// The question, its version checked as editable by this person.
async function findEditable(ctx, req, params, tx, action) {
  const id = await idParam(params), qid = await idParam(params, 'qid');
  const a = await getAssessment(ctx, id, tx);
  const v = await editableVersion(ctx, a, { req, action });
  const q = await tx.question.findFirst({ where: { id: qid, versionId: v.id }, include: QUESTION_INCLUDE });
  if (!q) throw new ApiError(404, 'Question not found in the version you are editing.');
  return { a, v, q };
}
// Renumbers questions after `order` (one place up) without breaking the unique (versionId, order) rule:
// lift them out of the way (+1,000,000), then drop them back one place lower.
const LIFT = 1000000;
async function closeGap(tx, versionId, order) {
  await tx.question.updateMany({ where: { versionId, order: { gt: order } }, data: { order: { increment: LIFT } } });
  await tx.question.updateMany({ where: { versionId, order: { gt: LIFT } }, data: { order: { decrement: LIFT + 1 } } });
}

const Move = z.object({ move: z.enum(['up', 'down']) });

export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.edit');
  let raw; try { raw = await req.json(); } catch (e) { throw new ApiError(400, 'The request was not valid JSON.'); }

  // ===== EDIT QUESTION · Move =====
  if (raw && raw.move) {
    const m = Move.safeParse(raw);
    if (!m.success) throw new ApiError(400, 'Move a question up or down.');
    const { move } = m.data;
    await db.$transaction(async tx => {
      const { a, v, q } = await findEditable(ctx, req, params, tx, 'assessment.question.move');
      const other = await tx.question.findFirst({ where: { versionId: v.id, order: move === 'up' ? q.order - 1 : q.order + 1 } });
      if (!other) return;
      await tx.question.update({ where: { id: q.id }, data: { order: -1 } });
      await tx.question.update({ where: { id: other.id }, data: { order: q.order } });
      await tx.question.update({ where: { id: q.id }, data: { order: other.order } });
      await tx.assessment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
      await audit({ actorId: ctx.account.id, action: 'assessment.question.move', entityType: 'Question', entityId: q.id, before: { order: q.order }, after: { order: other.order }, ip: clientIp(req) }, tx);
    });
    return json({ ok: true });
  }

  // ===== EDIT QUESTION · Save =====
  const r = QuestionBody.safeParse(raw);
  if (!r.success) throw new ApiError(400, 'Some details are missing or invalid.', { fields: r.error.flatten().fieldErrors });
  const next = await checkedQuestion(r.data);
  await db.$transaction(async tx => {
    const { a, q } = await findEditable(ctx, req, params, tx, 'assessment.question.edit');
    await tx.answerOption.deleteMany({ where: { questionId: q.id } });
    await tx.questionCompetency.deleteMany({ where: { questionId: q.id } });
    await tx.question.update({ where: { id: q.id }, data: {
      type: next.type, text: next.text, skillArea: next.skillArea, points: next.points,
      options: { create: next.options.map((o, j) => ({ order: j + 1, text: o.text, isCorrect: o.isCorrect })) },
      competencies: { create: next.competencies.map(c => ({ competencyId: c.competencyId, weight: c.weight })) },
    } });
    await tx.assessment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
    const before = plainQuestion(q);
    await audit({ actorId: ctx.account.id, action: 'assessment.question.edit', entityType: 'Question', entityId: q.id, before: { ...before, options: before.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })) }, after: next, ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});

// ===== DELETE QUESTION · Remove =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.edit');
  await db.$transaction(async tx => {
    const { a, v, q } = await findEditable(ctx, req, params, tx, 'assessment.question.delete');
    await tx.question.delete({ where: { id: q.id } });
    await closeGap(tx, v.id, q.order);
    await tx.assessment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
    await audit({ actorId: ctx.account.id, action: 'assessment.question.delete', entityType: 'Question', entityId: q.id, before: { assessmentId: a.id, versionNo: v.versionNo, order: q.order, text: q.text }, ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
