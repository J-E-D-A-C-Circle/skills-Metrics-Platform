// =============================================================================
// permissions.js · Who may do what, worked out from an account's roles, saved ticks and department scope
// Screen / URL: none; the server checks these on every request (lib/server/session.js); kept free of database
//   code so the rules can be unit-tested (tests/permissions.test.js)
// Used by: lib/server/session.js, app/api/**   Depends on: components/smAccess.js (permission keys & role defaults)
// Sections (search for these markers): PERMISSIONS · Role names, PERMISSIONS · Effective permissions,
//   PERMISSIONS · Hard rules, PERMISSIONS · Department scope, PERMISSIONS · Checks
// =============================================================================
import { PERM_INFO, ROLE_PERMS } from '../components/smAccess.js';

// ===== PERMISSIONS · Role names =====
// Database role -> the role label the screens use. The first role in ROLE_ORDER is the one shown.
export const ROLE_LABEL = {
  ADMIN: 'Administrator',
  CREATOR: 'Assessment Creator',
  SUPERVISOR: 'Manager / Supervisor',
  STATION_MANAGER: 'Station Manager / Regional Coordinator',
  STAFF: 'Participant',
  TICKET_RESOLVER: 'Ticket Resolver',
};
export const LABEL_ROLE = {
  Administrator: 'ADMIN',
  'Assessment Creator': 'CREATOR',
  'Manager / Supervisor': 'SUPERVISOR',
  'Station Manager / Regional Coordinator': 'STATION_MANAGER',
  Participant: 'STAFF',
  'Ticket Resolver': 'TICKET_RESOLVER',
};
const ROLE_ORDER = ['ADMIN', 'CREATOR', 'SUPERVISOR', 'STATION_MANAGER', 'TICKET_RESOLVER', 'STAFF'];
export const primaryRole = roles => ROLE_ORDER.find(r => (roles || []).includes(r)) || 'STAFF';

// ===== PERMISSIONS · Effective permissions =====
// account: { roles: ['ADMIN', ...], permissions: ['forms.view', ...] | null }
// Saved ticks win when the account has any; otherwise every role's default ticks are combined.
export function effectivePermissions(account) {
  const roles = account.roles || [];
  const saved = Array.isArray(account.permissions) && account.permissions.length ? account.permissions : null;
  const base = saved || [...new Set(roles.flatMap(r => ROLE_PERMS[ROLE_LABEL[r]] || []))];
  return applyHardRules(base.filter(k => PERM_INFO[k]), roles);
}

// ===== PERMISSIONS · Hard rules =====
// Rules from the Skills Metrics prompt (section 5) that no tick can override:
//   - An Administrator account never takes assessments (a separate staff account is used for that).
//   - An Assessment Creator only takes assessments when the account also holds the Staff role.
//   - Only an Administrator can review (approve / reject / return) or publish assessment content, so a creator
//     can never approve or publish their own work.
//   - Staff grades never grant administration rights (permissions come from roles and ticks only).
export function applyHardRules(keys, roles) {
  const has = r => roles.includes(r);
  return keys.filter(k => {
    if (k === 'assessments.view' && (has('ADMIN') || (has('CREATOR') && !has('STAFF')))) return false;
    if ((k === 'forms.publish' || k === 'forms.review') && !has('ADMIN')) return false;
    return true;
  });
}

// ===== PERMISSIONS · Department scope =====
// scope: 'ALL' | 'OWN' | 'SELECTED'. Returns the department ids the account may see, or null for every department.
// A Supervisor is never widened to all departments just by holding the role: with no department of their own
// and none selected, they see nothing.
export function visibleDepartmentIds(account) {
  const scope = account.deptScope || 'OWN';
  if (scope === 'ALL') return null;
  const own = account.ownDepartmentId != null ? [account.ownDepartmentId] : [];
  if (scope === 'SELECTED') return [...new Set([...(account.selectedDepartmentIds || []), ...own])];
  return own;
}
export function canSeeDepartment(account, departmentId) {
  const ids = visibleDepartmentIds(account);
  return ids === null || ids.includes(departmentId);
}

// ===== PERMISSIONS · Checks =====
export const hasPermission = (account, key) => effectivePermissions(account).includes(key);
// What a person may hand to someone else: only what they hold themselves, plus taking assessments.
export const mayGrant = (account, key) => key === 'assessments.view' || hasPermission(account, key);
