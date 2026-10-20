// Route GET /api/my/assessments/:id · one of the signed-in person's assessments, with full results when released
// =============================================================================
// Used by: components/SMTake.jsx (intro and results screens), components/SMMyAssessments.jsx (View results)
// Depends on: lib/server/{session,results,http}
// Sections (search for these markers): MY ASSESSMENT · Read
// Needs "Take assessments". :id is the assessment id; only the account's own staff record is read. Results
// (final average per competency, Competent / Proficient, gap status, each attempt's scores) are included only
// when resultsReleased() allows it.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { myAssessments } from '@/lib/server/results';
import { json, handle, ApiError } from '@/lib/server/http';

// ===== MY ASSESSMENT · Read =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requirePermission('assessments.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'This assessment is not assigned to you.');
  const [item] = await myAssessments(ctx, { assessmentId: id, withResults: true });
  return json({ item });
});
