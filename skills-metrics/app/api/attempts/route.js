// Route POST /api/attempts · start a new attempt, or resume the one already in progress
// =============================================================================
// Used by: components/SMTake.jsx (Start / Resume / Retake)   Depends on: lib/server/{session,results,http}, zod
// Sections (search for these markers): START ATTEMPT · Input, START ATTEMPT · Save
// Needs "Take assessments". The attempt belongs to the account's own staff record. Refused when the assessment is
// not assigned, not published, not open yet, past the deadline, or every allowed attempt has been used. Double
// clicks and two tabs get the same attempt back (see lib/server/results.js startAttempt).
// =============================================================================
import { z } from 'zod';
import { requirePermission } from '@/lib/server/session';
import { startAttempt } from '@/lib/server/results';
import { json, handle, readBody, clientIp } from '@/lib/server/http';

// ===== START ATTEMPT · Input =====
const Body = z.object({ assessmentId: z.number().int().positive() });

// ===== START ATTEMPT · Save =====
export const POST = handle(async req => {
  const ctx = await requirePermission('assessments.view');
  const b = await readBody(req, Body);
  const r = await startAttempt({ ctx, assessmentId: b.assessmentId, ip: clientIp(req) });
  return json({ attemptId: r.attempt.id, attemptNo: r.attempt.attemptNo, resumed: r.resumed }, r.resumed ? 200 : 201);
});
