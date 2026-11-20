// Route GET /api/me · My Profile: the signed-in account, its staff record, and (for staff) their results and history
// =============================================================================
// Used by: components/SMProfile.jsx (Account, Skill Profile and Assessment History tabs)
// Depends on: lib/server/{db,session,analytics,http}, lib/permissions.js
// Sections (search for these markers): MY PROFILE · Read
// Any signed-in account. Results and history are only included for accounts that take assessments
// ("Take assessments"): administrators never do, and an Assessment Creator without the Staff role doesn't get a
// participant view of their own scores. Results follow the result-release rules (own = true).
// Password changes use POST /api/auth/password.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { personProfile } from '@/lib/server/analytics';
import { ROLE_LABEL } from '@/lib/permissions';
import { json, handle } from '@/lib/server/http';

// ===== MY PROFILE · Read =====
export const GET = handle(async () => {
  const ctx = await requireUser();
  const a = await db.account.findUnique({ where: { id: ctx.account.id }, select: { username: true, email: true, displayName: true, status: true, lastLoginAt: true, passwordSetAt: true, createdAt: true, deptScope: true } });
  const participant = !!ctx.account.staffId && ctx.user.perms.includes('assessments.view');
  const profile = participant ? await personProfile(ctx.account.staffId, { own: true }) : null;
  let staff = profile?.staff || null;
  if (!staff && ctx.account.staffId) {
    const u = ctx.user;
    staff = { id: u.staffId, staffNo: u.staffNo, name: u.name, department: u.dept, grade: u.grade, station: u.station, location: u.location, designation: u.designation };
  }
  return json({
    account: { username: a.username, email: a.email, name: a.displayName, status: ctx.user.status, roles: ctx.user.roles.map(r => ROLE_LABEL[r] || r), lastLoginAt: a.lastLoginAt, passwordSetAt: a.passwordSetAt, createdAt: a.createdAt,
      scope: a.deptScope === 'ALL' ? 'All departments' : a.deptScope === 'SELECTED' ? 'Selected departments: ' + (ctx.user.depts.join(', ') || '—') : 'Own department' },
    staff, participant, profile,
  });
});
