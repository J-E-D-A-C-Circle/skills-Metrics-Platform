// Route GET /api/staff/:id · one person's Competency Profile: details, assessments, attempt history, final results
// =============================================================================
// Used by: components/SMStaffProfile.jsx (/report?id=<staff id>)
// Depends on: lib/server/{db,session,scope,analytics,http}
// Sections (search for these markers): STAFF PROFILE · Access, STAFF PROFILE · Read
// Needs "Open competency profiles" for anyone else's record, and the record must be in scope
// (lib/server/scope.js assertStaffVisible: 404 outside it, so ids can't be probed). A person may always open their
// own record when they take assessments; their own results then follow the result-release rules.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { assertStaffVisible } from '@/lib/server/scope';
import { personProfile } from '@/lib/server/analytics';
import { json, handle, forbidden, ApiError } from '@/lib/server/http';

// ===== STAFF PROFILE · Access =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Staff member not found.');
  const perms = ctx.user.perms, own = ctx.account.staffId === id;
  if (own ? !(perms.includes('assessments.view') || perms.includes('staff-evals.report')) : !perms.includes('staff-evals.report')) throw forbidden();
  const s = await db.staffRecord.findUnique({ where: { id }, select: { id: true, departmentId: true, supervisorId: true } });
  assertStaffVisible(ctx, s);

  // ===== STAFF PROFILE · Read =====
  const profile = await personProfile(id, { own });
  return json({ profile, own });
});
