// =============================================================================
// scope.js · Which staff records and results the signed-in person may see (department scope + their own record)
// Screen / URL: none; server only. Every route that returns staff or results filters through these helpers,
//   including exports, so a supervisor never sees departments they were not given.
// Used by: app/api/** (team results, dashboards, reports, organisation, assignments)   Depends on: lib/server/http.js
// Sections (search for these markers): SCOPE · Staff filter, SCOPE · Single record check
// =============================================================================
import 'server-only';
import { ApiError } from './http';

// ===== SCOPE · Staff filter =====
// A Prisma `where` for StaffRecord: every record (scope ALL), or those in the visible departments plus the
// person's direct reports (staff whose supervisor is this person's staff record) or station colleagues for Station Managers.
// ctx is what requireUser() / requirePermission() return. `includeSelf` adds the person's own staff record.
export function staffWhere(ctx, { includeSelf = false } = {}) {
  const ids = ctx.visibleDepartmentIds;
  if (ids === null && !ctx.stationId) return {};
  const or = [];
  if (ids !== null) or.push({ departmentId: { in: ids } });
  if (ctx.stationId != null) or.push({ stationId: ctx.stationId });
  if (ctx.account?.staffId) or.push({ supervisorId: ctx.account.staffId });
  if (includeSelf && ctx.account?.staffId) or.push({ id: ctx.account.staffId });
  return or.length ? { OR: or } : {};
}
// The same filter for tables that point at a staff record (Attempt, FinalCompetencyResult, ...): { staff: staffWhere }.
export const viaStaff = (ctx, opts) => { const w = staffWhere(ctx, opts); return Object.keys(w).length ? { staff: w } : {}; };

// ===== SCOPE · Single record check =====
// Throws 404 (not 403, so it doesn't reveal the record exists) when the staff record is outside the person's scope.
export function assertStaffVisible(ctx, staff, { allowSelf = true } = {}) {
  if (!staff) throw new ApiError(404, 'Staff member not found.');
  if (allowSelf && ctx.account?.staffId === staff.id) return;
  const ids = ctx.visibleDepartmentIds;
  if (ids === null && !ctx.stationId) return;
  if (ctx.account?.staffId && staff.supervisorId === ctx.account.staffId) return;
  if (ctx.stationId != null && staff.stationId === ctx.stationId) return;
  if (ids !== null && (staff.departmentId == null || !ids.includes(staff.departmentId))) throw new ApiError(404, 'Staff member not found.');
}
