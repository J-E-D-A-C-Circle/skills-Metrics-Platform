// =============================================================================
// session.js · Signed-in sessions: create, read, end, and the "who is this and what may they do" check
// Screen / URL: none; server only. Cookie "skm_session" (httpOnly, SameSite=Lax, Secure in production)
// Used by: app/api/auth/*, and every later API route through requireUser() / requirePermission()
// Depends on: lib/server/db.js, lib/permissions.js
// Sections (search for these markers): SESSION · Settings, SESSION · Create, SESSION · Read, SESSION · End,
//   SESSION · Signed-in user profile, SESSION · Guards
// The cookie holds a random 256-bit token; the database stores only its SHA-256, so a database leak can't be
// used to sign in.
// =============================================================================
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { db } from './db';
import { effectivePermissions, primaryRole, ROLE_LABEL, visibleDepartmentIds } from '../permissions';
import { unauthorized, forbidden } from './http';

// ===== SESSION · Settings =====
export const COOKIE = 'skm_session';
const ABSOLUTE_HOURS = Number(process.env.SESSION_MAX_HOURS || 12); // signed out after this, however active
const IDLE_MINUTES = Number(process.env.SESSION_IDLE_MINUTES || 60); // signed out after this long with no requests
const sha = t => createHash('sha256').update(t).digest('hex');

// ===== SESSION · Create =====
export async function createSession(accountId, { ip, userAgent } = {}) {
  const token = randomBytes(32).toString('base64url');
  const sessionId = randomBytes(16).toString('hex');
  const expiresAt = new Date(Date.now() + ABSOLUTE_HOURS * 3600e3);
  await db.session.create({ data: { id: sessionId, tokenHash: sha(token), accountId, expiresAt, ip, userAgent } });
  const isSecure = process.env.COOKIE_SECURE === 'true';
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: isSecure, path: '/', expires: expiresAt });
}

// ===== SESSION · Read =====
// Returns the session row with its account, or null when missing, expired, idle too long, revoked, or the
// account is suspended / disabled.
const ACCOUNT_INCLUDE = { roles: true, permissions: true, scopeDepartments: { include: { department: true } }, staff: { include: { department: true, grade: true, station: { include: { location: true } } } } };
export async function readSession() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { tokenHash: sha(token) }, include: { account: { include: ACCOUNT_INCLUDE } } });
  const now = Date.now();
  if (!s || s.revokedAt || s.expiresAt.getTime() <= now || now - s.lastSeenAt.getTime() > IDLE_MINUTES * 60e3) return null;
  if (['SUSPENDED', 'DISABLED'].includes(s.account.status)) return null;
  // Touch at most once a minute to keep writes low.
  if (now - s.lastSeenAt.getTime() > 60e3) await db.session.update({ where: { id: s.id }, data: { lastSeenAt: new Date() } });
  return s;
}

// ===== SESSION · End =====
export async function endSession() {
  const jar = await cookies(), token = jar.get(COOKIE)?.value;
  if (token) await db.session.updateMany({ where: { tokenHash: sha(token), revokedAt: null }, data: { revokedAt: new Date() } });
  jar.delete(COOKIE);
}
// Used when a password changes: every other browser signed in as this account is signed out.
export async function endOtherSessions(accountId) {
  const token = (await cookies()).get(COOKIE)?.value, keep = token ? sha(token) : '';
  await db.session.updateMany({ where: { accountId, revokedAt: null, NOT: { tokenHash: keep } }, data: { revokedAt: new Date() } });
}

// ===== SESSION · Signed-in user profile =====
// The shape the screens already use for a user (name, email, role label, dept, perms, scope, depts) plus the
// server ids. Never includes the password hash.
export function toUser(a) {
  const roles = a.role ? [a.role] : (a.roles ? a.roles.map(r => r.role) : ['STAFF']);
  const perms = effectivePermissions({ roles, permissions: (a.permissions || []).map(p => p.key) });
  const scopeMap = { ALL: 'all', OWN: 'own', SELECTED: 'some' };
  const staff = a.staff;
  return {
    id: a.id, username: a.username, name: a.displayName, email: a.email,
    role: ROLE_LABEL[primaryRole(roles)], roles, perms,
    scope: scopeMap[a.deptScope], depts: (a.scopeDepartments || []).map(d => d.department?.name).filter(Boolean),
    dept: staff?.department?.name || null, departmentId: staff?.departmentId ?? null,
    // The department ids this person may see (null = every department), so screens offer only what the server allows.
    deptIds: visibleDepartmentIds(accessOf(a)),
    staffId: staff?.id ?? null, staffNo: staff?.staffNo ?? null, grade: staff?.grade?.name ?? null,
    station: staff?.station?.name ?? null, location: staff?.station?.location?.name ?? null, designation: staff?.designation ?? null,
    status: a.status === 'MUST_CHANGE_PASSWORD' ? 'Must change password' : a.status === 'ACTIVE' ? 'Active' : a.status,
    mustChange: a.status === 'MUST_CHANGE_PASSWORD',
  };
}
// The fields lib/permissions.js needs for its checks.
export function accessOf(a) {
  const roles = a.role ? [a.role] : (a.roles ? a.roles.map(r => r.role) : ['STAFF']);
  return {
    roles, permissions: (a.permissions || []).map(p => p.key), deptScope: a.deptScope,
    ownDepartmentId: a.staff?.departmentId ?? null, selectedDepartmentIds: (a.scopeDepartments || []).map(d => d.departmentId),
  };
}

// ===== SESSION · Guards =====
// requireUser: any signed-in account that has finished setting its password.
// requirePermission: also needs the permission key (e.g. "staff-evals.view").
export async function requireUser({ allowMustChange = false } = {}) {
  const s = await readSession();
  if (!s) throw unauthorized();
  if (!allowMustChange && s.account.status === 'MUST_CHANGE_PASSWORD') throw forbidden('Please set a new password first.');
  const access = accessOf(s.account);
  return { session: s, account: s.account, access, user: toUser(s.account), visibleDepartmentIds: visibleDepartmentIds(access) };
}
export async function requirePermission(key) {
  const ctx = await requireUser();
  if (!ctx.user.perms.includes(key)) throw forbidden();
  return ctx;
}
