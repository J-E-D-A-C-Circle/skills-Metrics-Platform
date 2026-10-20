// Route GET /api/org/grades · grades in rank order (0 = most junior) with how many records point at each
// Route POST /api/org/grades · add a grade at the top of the order
// =============================================================================
// Used by: components/SMOrganisation.jsx (Grades tab)
// Depends on: lib/server/{db,session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): GRADES · List, GRADES · Add
// Listing needs "View organisation"; adding needs "Manage structure". A grade never grants permissions.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { json, handle, readBody } from '@/lib/server/http';
import { GradeInput } from '@/lib/server/org';
import { listStructure, createStructure } from '../_lib';

// ===== GRADES · List =====
export const GET = handle(async () => {
  await requirePermission('org.view');
  return json({ rows: await listStructure('grade') });
});

// ===== GRADES · Add =====
// New grades go above the most senior one; use the arrows on the Grades tab to move them.
export const POST = handle(async req => {
  const ctx = await requirePermission('org.structure');
  const b = await readBody(req, GradeInput);
  const top = await db.grade.aggregate({ _max: { rank: true } });
  return createStructure(ctx, req, 'grade', { name: b.name, rank: (top._max.rank ?? -1) + 1, active: b.active ?? true });
});
