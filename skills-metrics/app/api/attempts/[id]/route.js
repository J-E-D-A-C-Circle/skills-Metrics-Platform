// Route GET /api/attempts/:id · one of the signed-in person's attempts: its questions, saved answers and position
// =============================================================================
// Used by: components/SMTake.jsx (answering and resuming)   Depends on: lib/server/{db,session,results,assigned,http}
// Sections (search for these markers): ATTEMPT · Read, ATTEMPT · Resume position
// Needs "Take assessments"; only the account's own staff record's attempts (anyone else's is "not found").
// Questions come from the version the attempt started on. Correct answers are never sent to the browser.
// An attempt still in progress after the deadline is closed (EXPIRED) here. Active time is only sent once the
// attempt is no longer in progress.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { myStaff, expireOverdue, chosenIds } from '@/lib/server/results';
import { assignmentFor } from '@/lib/server/assigned';
import { json, handle, ApiError } from '@/lib/server/http';

// ===== ATTEMPT · Read =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requirePermission('assessments.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Attempt not found.');
  const out = await db.$transaction(async tx => {
    const at = await tx.attempt.findUnique({ where: { id }, include: { assessment: true } });
    if (!at || at.staffId !== ctx.account.staffId) throw new ApiError(404, 'Attempt not found.');
    const staff = await myStaff(ctx, tx), entry = await assignmentFor(staff, at.assessmentId, tx);
    await expireOverdue(tx, entry, [at]);
    const questions = await tx.question.findMany({ where: { versionId: at.versionId }, orderBy: { order: 'asc' }, include: { options: { orderBy: { order: 'asc' }, select: { id: true, order: true, text: true } } } });
    const responses = await tx.attemptResponse.findMany({ where: { attemptId: id } });

    // ===== ATTEMPT · Resume position =====
    // The question last looked at (newest time slice) or last answered, whichever is more recent.
    const seg = await tx.activeTimeSegment.findFirst({ where: { attemptId: id, questionId: { not: null } }, orderBy: { endedAt: 'desc' } });
    const last = responses.reduce((m, r) => (!m || r.savedAt > m.savedAt ? r : m), null);
    const posQ = seg && (!last || seg.endedAt > last.savedAt) ? seg.questionId : last ? last.questionId : null;
    const position = Math.max(0, questions.findIndex(q => q.id === posQ));
    const open = at.status === 'IN_PROGRESS';
    return {
      attempt: { id: at.id, attemptNo: at.attemptNo, status: at.status, startedAt: at.startedAt, submittedAt: at.submittedAt, activeSeconds: open ? null : at.activeSeconds, elapsedSeconds: open ? null : at.elapsedSeconds, deadline: entry ? entry.deadline : null, maxAttempts: entry ? entry.maxAttempts : null },
      assessment: { id: at.assessment.id, title: at.assessment.title, instructions: at.assessment.instructions, description: at.assessment.description },
      questions: questions.map(q => ({ id: q.id, order: q.order, type: q.type, text: q.text, skillArea: q.skillArea, options: q.options })),
      answers: Object.fromEntries(responses.map(r => [r.questionId, { optionIds: chosenIds(r), textAnswer: r.textAnswer && !/^\s*\[/.test(r.textAnswer) ? r.textAnswer : null, savedAt: r.savedAt }])),
      position,
    };
  });
  return json(out);
});
