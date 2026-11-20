import crypto from "crypto";
import { cookies } from "next/headers";
import {
  UserRole,
  SessionPayload,
  AUTH_COOKIE_NAME,
  SESSION_EXPIRY_HOURS,
  JWT_SECRET,
  createSessionToken,
  verifySessionToken,
  getSessionUserFromRequest,
  setAuthCookie,
  clearAuthCookie,
  getDashboardRouteForRole,
} from "./session";

export type { UserRole, SessionPayload };
export {
  AUTH_COOKIE_NAME,
  SESSION_EXPIRY_HOURS,
  JWT_SECRET,
  createSessionToken,
  verifySessionToken,
  getSessionUserFromRequest,
  setAuthCookie,
  clearAuthCookie,
  getDashboardRouteForRole,
};

/**
 * Derives a secure password hash with a random salt using PBKDF2 (SHA-512)
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Validates password against salted PBKDF2 hash using timing-safe comparison
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    const [salt, expectedHash] = parts;
    const calculatedHash = crypto.pbkdf2Sync(password, salt, 100000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(calculatedHash), Buffer.from(expectedHash));
  } catch {
    return false;
  }
}

/**
 * Retrieves the current authenticated user from request cookies or Next.js headers (Node.js runtime)
 */
export async function getSessionUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
