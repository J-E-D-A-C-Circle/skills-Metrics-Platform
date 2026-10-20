// Route GET /api/my/assessments · the signed-in person's assigned assessments (My Assessments)
// =============================================================================
// Used by: components/SMMyAssessments.jsx   Depends on: lib/server/{session,results,http}
// Sections (search for these markers): MY ASSESSMENTS · Read
// Needs "Take assessments" (assessments.view; administrators never have it). Uses the account's own staff record only.
// Each entry: dates (deadline with extensions), attempts used / remaining, progress, attempt history, whether
// Start / Resume is allowed, and a results summary once results are released.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { myAssessments } from '@/lib/server/results';
import { json, handle } from '@/lib/server/http';

// ===== MY ASSESSMENTS · Read =====
export const GET = handle(async () => {
  const ctx = await requirePermission('assessments.view');
  return json({ items: await myAssessments(ctx) });
});
