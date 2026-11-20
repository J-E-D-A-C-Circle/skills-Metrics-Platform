// Route POST /api/attempts/:id/time · record slices of active page time (page visible and in front)
// =============================================================================
// Used by: components/SMTake.jsx (sent every 15 seconds and when the page is hidden or closed)
// Depends on: lib/server/{session,results,http}, zod
// Sections (search for these markers): ACTIVE TIME · Input, ACTIVE TIME · Save
// Needs "Take assessments"; only the account's own attempt while in progress (later slices are ignored).
// tabId is a random id per browser tab. Overlapping slices from several tabs are counted once, and each slice is
// moved onto the server clock and clamped (lib/server/results.js recordTime). Time never affects scores.
// =============================================================================
import { z } from 'zod';
import { requirePermission } from '@/lib/server/session';
import { recordTime } from '@/lib/server/results';
import { json, handle, readBody, ApiError } from '@/lib/server/http';

// ===== ACTIVE TIME · Input =====
const Slice = z.object({ questionId: z.number().int().positive().nullable().optional(), start: z.number().finite(), end: z.number().finite() });
const Body = z.object({ tabId: z.string().trim().min(4).max(64).regex(/^[A-Za-z0-9_-]+$/), sentAt: z.number().finite(), slices: z.array(Slice).max(200) });

// ===== ACTIVE TIME · Save =====
export const POST = handle(async (req, { params }) => {
  const ctx = await requirePermission('assessments.view');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Attempt not found.');
  const b = await readBody(req, Body);
  const r = await recordTime({ ctx, attemptId: id, tabId: b.tabId, sentAt: b.sentAt, slices: b.slices });
  return json({ ok: true, stored: r.stored || 0, ignored: !!r.ignored });
});
