// Route POST /api/attempts/:id/submit · submit an attempt: mark it, score each competency, update final results
// =============================================================================
// Used by: components/SMTake.jsx (Submit, after the review screen and confirmation)
// Depends on: lib/server/{session,results,http}
// Sections (search for these markers): SUBMIT ATTEMPT · Save
// Needs "Take assessments"; only the account's own attempt, before the deadline. One transaction (see
// lib/server/results.js submitAttempt). Submitting again is safe: the reply says already: true and nothing changes.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { submitAttempt } from '@/lib/server/results';
import { json, handle, clientIp, ApiError } from '@/lib/server/http';

// ===== SUBMIT ATTEMPT · Save =====
export const POST = handle(async (req, { params }) => {
  const ctx = await requirePermission('assessments.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Attempt not found.');
  return json(await submitAttempt({ ctx, attemptId: id, ip: clientIp(req) }));
});
