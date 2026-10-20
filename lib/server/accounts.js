// =============================================================================
// accounts.js · Shared code for the User Management routes: the list row, role/department mapping, checks
// Screen / URL: Settings > User Management (/settings?tab=users)
// Used by: app/api/accounts/route.js, app/api/accounts/[id]/route.js, app/api/accounts/[id]/password/route.js
// Depends on: lib/server/{db,session,http}, lib/permissions.js, components/smAccess.js
// Sections (search for these markers): ACCOUNTS · Loading, ACCOUNTS · List row, ACCOUNTS · Roles & status,
//   ACCOUNTS · Departments & scope, ACCOUNTS · Permission ticks, ACCOUNTS · Safety checks, ACCOUNTS · Temporary passwords
// =============================================================================
import 'server-only';
import { randomInt } from 'node:crypto';
import { db } from './db';
import { toUser } from './session';
import { badRequest, forbidden } from './http';
import { LABEL_ROLE, mayGrant, effectivePermissions } from '../permissions';
import { PERM_INFO, FREE_TO_GRANT } from '../../components/smAccess.js';

// ===== ACCOUNTS · Loading =====
// Same include as the signed-in user (lib/server/session.js), so toUser() works on every row.
export const ACCOUNT_INCLUDE = { roles: true, permissions: true, scopeDepartments: { include: { department: true } }, staff: { include: { department: true, grade: true, station: { include: { location: true } } } } };
// Deleted accounts are kept (status DISABLED) so the audit log still points at them, but never listed.
export const LISTED = { status: { not: 'DISABLED' } };
export const findAccount = id => db.account.findFirst({ where: { id, ...LISTED }, include: ACCOUNT_INCLUDE });

// ===== ACCOUNTS · List row =====
// The shape the users table already uses: name, email, username, dept, role, perms, scope, depts, status, last.
function lastSeen(d) {
  if (!d) return 'Never signed in';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 2) return 'Now';
  if (mins < 60) return mins + ' min ago';
  if (mins < 24 * 60) return Math.round(mins / 60) + ' h ago';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export function toRow(a) {
  const u = toUser(a);
  return { id: u.id, name: u.name, email: u.email, username: u.username, dept: u.dept || '—', role: u.role, perms: u.perms, scope: u.scope, depts: u.depts,
    status: a.status === 'SUSPENDED' ? 'Suspended' : u.status, mustChange: u.mustChange, last: lastSeen(a.lastLoginAt) };
}

// ===== ACCOUNTS · Roles & status =====
// Role label from the screen -> database roles. A Manager / Supervisor also takes assessments as staff;
// an Assessment Creator does not unless given the Staff role separately (prompt section 5.3).
export function rolesFor(label) {
  const r = LABEL_ROLE[label];
  if (!r) throw badRequest('Pick a role.');
  // A Ticket Resolver is a member of staff who also handles assigned tickets.
  return r === 'SUPERVISOR' ? ['SUPERVISOR', 'STAFF'] : r === 'TICKET_RESOLVER' ? ['TICKET_RESOLVER', 'STAFF'] : [r];
}
export const STATUS_DB = { Active: 'ACTIVE', 'Must change password': 'MUST_CHANGE_PASSWORD', Suspended: 'SUSPENDED' };

// ===== ACCOUNTS · Departments & scope =====
// Department names from the screen -> ids. Unknown names are refused.
export async function departmentIds(names) {
  if (!names.length) return [];
  const rows = await db.department.findMany({ where: { name: { in: names } } });
  if (rows.length !== new Set(names).size) throw badRequest('One of the departments was not found.');
  return rows.map(d => d.id);
}
export const SCOPE_DB = { all: 'ALL', own: 'OWN', some: 'SELECTED' };
// Someone who does not see every department can only give "own" or departments they can see themselves.
export function checkScope(ctx, scope, deptIds) {
  const mine = ctx.visibleDepartmentIds;
  if (mine === null) return;
  if (scope === 'all') throw forbidden('You can only give access to the departments you can see yourself.');
  if (deptIds.some(id => !mine.includes(id))) throw forbidden('You can only give access to the departments you can see yourself.');
}
// The editor may only list and change accounts in departments they can see (accounts with no department need "all").
export function canSeeAccount(ctx, a) {
  const mine = ctx.visibleDepartmentIds;
  return mine === null || (a.staff?.departmentId != null && mine.includes(a.staff.departmentId));
}

// ===== ACCOUNTS · Permission ticks =====
// Only real keys are kept. A tick the editor doesn't hold can't be added or removed by them, so those keep their
// previous value (the same rule the dialog applies with its greyed-out ticks).
export function cleanPerms(ctx, wanted, before = []) {
  const may = k => FREE_TO_GRANT.includes(k) || mayGrant(ctx.access, k);
  const keep = before.filter(k => !may(k));
  const add = (wanted || []).filter(k => PERM_INFO[k] && may(k));
  return [...new Set([...keep, ...add])];
}

// ===== ACCOUNTS · Safety checks =====
// After a change there must still be an active Administrator, and an active account that can manage access,
// otherwise nobody could ever fix permissions again. `change` = { id, roles, perms, status } for the account being changed.
export async function checkNotLockedOut(change) {
  const others = await db.account.findMany({ where: { id: { not: change.id }, status: { in: ['ACTIVE', 'MUST_CHANGE_PASSWORD'] } }, include: { roles: true, permissions: true } });
  const all = others.map(a => ({ roles: a.roles.map(r => r.role), perms: effectivePermissions({ roles: a.roles.map(r => r.role), permissions: a.permissions.map(p => p.key) }) }));
  if (change.status !== 'SUSPENDED' && change.status !== 'DISABLED') all.push({ roles: change.roles, perms: effectivePermissions({ roles: change.roles, permissions: change.perms }) });
  if (!all.some(a => a.roles.includes('ADMIN'))) throw badRequest('There must always be at least one active Administrator. Make someone else an Administrator first.');
  if (!all.some(a => a.perms.includes('settings.users') && a.perms.includes('settings.access'))) throw badRequest('At least one active user must keep "View users" and "Change roles & permissions", or nobody could manage access.');
}

// ===== ACCOUNTS · Temporary passwords =====
// 12 characters with an uppercase letter, a lowercase letter, a number and a symbol (meets every rule on the
// Set your password screen). Uses the crypto random generator, not Math.random.
export function tempPassword() {
  const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghijkmnpqrstuvwxyz', n = '23456789', y = '!@#$%&*?', all = U + l + n + y;
  const pick = s => s[randomInt(s.length)];
  const a = [pick(U), pick(l), pick(n), pick(y)];
  while (a.length < 12) a.push(pick(all));
  for (let i = a.length - 1; i > 0; i--) { const j = randomInt(i + 1); [a[i], a[j]] = [a[j], a[i]]; }
  return a.join('');
}
// Temporary passwords typed by an administrator: at least 8 characters with uppercase, lowercase and a number.
export const tempPasswordOk = p => p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /\d/.test(p);
