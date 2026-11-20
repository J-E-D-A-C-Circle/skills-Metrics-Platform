import { NextRequest, NextResponse } from "next/server";
import {
  hmacSha256,
  bytesToBase64Url,
  base64UrlEncode,
  base64UrlDecode,
  timingSafeEqualStrings,
} from "./crypto-portable";

export type UserRole = "ADMINISTRATOR" | "TECHNICAL_OFFICER" | "COMPLIANCE_OFFICER";

export interface SessionPayload {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  region: string;
  stationLocation: string;
  staffId?: string | null;
  phone: string;
  exp: number; // unix timestamp in ms
}

export const AUTH_COOKIE_NAME = "dvla_session_token";
export const SESSION_EXPIRY_HOURS = 12;
export const JWT_SECRET = process.env.SESSION_SECRET || "dvla-secret-encryption-key-ghana-2026-v2-secure";

/**
 * Generates an HMAC-SHA256 signed session token
 */
export function createSessionToken(user: {
  id: string;
  email: string;
  fullName: string;
  role: string;
  region: string;
  stationLocation: string;
  staffId?: string | null;
  phone: string;
}): string {
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as UserRole,
    region: user.region,
    stationLocation: user.stationLocation,
    staffId: user.staffId,
    phone: user.phone,
    exp: Date.now() + SESSION_EXPIRY_HOURS * 60 * 60 * 1000,
  };

  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const sigBytes = hmacSha256(JWT_SECRET, payloadB64);
  const signature = bytesToBase64Url(sigBytes);
  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes a signed session token (Compatible with Edge Runtime & Node.js)
 */
export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const [payloadB64, signature] = token.split(".");
    if (!payloadB64 || !signature) return null;

    const sigBytes = hmacSha256(JWT_SECRET, payloadB64);
    const expectedSig = bytesToBase64Url(sigBytes);
    if (!timingSafeEqualStrings(signature, expectedSig)) {
      return null;
    }

    const jsonStr = base64UrlDecode(payloadB64);
    const payload: SessionPayload = JSON.parse(jsonStr);
    if (payload.exp < Date.now()) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Retrieves authenticated user from a NextRequest instance (for API routes & middleware)
 */
export function getSessionUserFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Attaches the auth cookie to a NextResponse
 */
export function setAuthCookie(res: NextResponse, token: string): void {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_EXPIRY_HOURS * 60 * 60,
  });
}

/**
 * Clears the auth cookie on logout
 */
export function clearAuthCookie(res: NextResponse): void {
  res.cookies.set({
    name: AUTH_COOKIE_NAME,
    value: "",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Resolves the primary dashboard redirect route for a given role
 */
export function getDashboardRouteForRole(role: UserRole | string): string {
  switch (role) {
    case "ADMINISTRATOR":
      return "/admin";
    case "TECHNICAL_OFFICER":
      return "/technical-officer";
    case "COMPLIANCE_OFFICER":
    case "COMPLIANCE_MANAGER":
      return "/compliance";
    default:
      return "/";
  }
}
