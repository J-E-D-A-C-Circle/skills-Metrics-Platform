// Route POST /api/content/[id]/questions · add a question to the end of the author's editable version
// =============================================================================
// Used by: components/SMContent.jsx (question editor: "Add question")
// Depends on: lib/server/{db,session,audit,http,content}, app/api/content/_shared.js
// Sections (search for these markers): ADD QUESTION · Save
// Needs "Edit & submit drafts". Only the version's author may add to a Draft / Returned / Rejected version.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp } from '@/lib/server/http';
import { questionCreate } from '@/lib/server/content';
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
