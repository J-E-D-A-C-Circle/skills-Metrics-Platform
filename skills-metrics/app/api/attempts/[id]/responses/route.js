// Route PUT /api/attempts/:id/responses · save (autosave) or clear the answer to one question
// =============================================================================
// Used by: components/SMTake.jsx (every answer is saved as soon as it is chosen)
// Depends on: lib/server/{session,results,http}, zod
// Sections (search for these markers): SAVE ANSWER · Input, SAVE ANSWER · Save
// Needs "Take assessments"; only the account's own attempt, while it is in progress and before the deadline.
// Sending no option and no text clears the answer.
// =============================================================================
import { z } from 'zod';
import { requirePermission } from '@/lib/server/session';
import { saveAnswer } from '@/lib/server/results';
import { json, handle, readBody, ApiError } from '@/lib/server/http';

// ===== SAVE ANSWER · Input =====
const Body = z.object({
  questionId: z.number().int().positive(),
  optionId: z.number().int().positive().nullable().optional(),
  optionIds: z.array(z.number().int().positive()).max(50).optional(),
  textAnswer: z.string().max(10000).nullable().optional(),
});

// ===== SAVE ANSWER · Save =====
export const PUT = handle(async (req, { params }) => {
  const ctx = await requirePermission('assessments.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Attempt not found.');
  const b = await readBody(req, Body);
  return json(await saveAnswer({ ctx, attemptId: id, b }));
});
