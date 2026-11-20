// =============================================================================
// rateLimit.js · Sign-in lock-out after repeated wrong passwords (uses the LoginAttempt table)
// Screen / URL: /signin
// Used by: app/api/auth/login/route.js   Depends on: lib/server/db.js
// Sections (search for these markers): RATE LIMIT · Settings, RATE LIMIT · Check, RATE LIMIT · Record
// =============================================================================
import 'server-only';
import { db } from './db';

// ===== RATE LIMIT · Settings =====
const WINDOW_MIN = 15; // look back this many minutes
const MAX_PER_ACCOUNT = 5; // wrong passwords for one username/email in the window
const MAX_PER_IP = 30; // wrong passwords from one network address in the window

// ===== RATE LIMIT · Check =====
// Returns true when sign-in should be refused for now.
export async function isLockedOut(identifier, ip) {
  const since = new Date(Date.now() - WINDOW_MIN * 60e3);
  const [byId, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { identifier, success: false, at: { gte: since } } }),
    ip ? db.loginAttempt.count({ where: { ip, success: false, at: { gte: since } } }) : 0,
  ]);
  return byId >= MAX_PER_ACCOUNT || byIp >= MAX_PER_IP;
}
export const LOCKOUT_MINUTES = WINDOW_MIN;

// ===== RATE LIMIT · Record =====
export const recordAttempt = (identifier, ip, success, reason) => db.loginAttempt.create({ data: { identifier, ip, success, reason } });
