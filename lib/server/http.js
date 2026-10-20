// =============================================================================
// http.js · Small helpers shared by the API routes: JSON replies, errors, client IP, body checks
// Screen / URL: none; server only
// Used by: every app/api/** route   Depends on: next/server, zod
// Sections (search for these markers): HTTP · Replies, HTTP · Errors, HTTP · Request details, HTTP · Reading the body
// =============================================================================
import 'server-only';
import { NextResponse } from 'next/server';

// ===== HTTP · Replies =====
// no-store: responses can carry personal data, so browsers and proxies must not cache them.
export const json = (data, status = 200, headers = {}) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

// ===== HTTP · Errors =====
// ApiError carries a status and a message that is safe to show. Anything else becomes a plain 500 with no details,
// so stack traces and database messages never reach the browser.
export class ApiError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}
export const unauthorized = (m = 'Please sign in.') => new ApiError(401, m);
export const forbidden = (m = "You don't have permission to do that.") => new ApiError(403, m);
export const badRequest = (m, extra) => new ApiError(400, m, extra);

// Changes (POST / PUT / PATCH / DELETE) coming from another website are refused: when the browser sends an Origin
// header it must match this site's own host. Backs up the SameSite=Lax session cookie.
const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);
function crossSite(req) {
  if (SAFE.has(req.method)) return false;
  const origin = req.headers.get('origin');
  if (!origin) return false;
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try { return new URL(origin).host !== host; } catch (e) { return true; }
}

export function handle(fn) {
  return async (req, ctx) => {
    try {
      if (crossSite(req)) return json({ error: 'This request came from another website and was refused.' }, 403);
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return json({ error: e.message, ...(e.extra || {}) }, e.status);
      console.error('[api]', req.method, req.nextUrl?.pathname, e);
      return json({ error: 'Something went wrong. Please try again.' }, 500);
    }
  };
}

// ===== HTTP · Request details =====
export function clientIp(req) {
  const f = req.headers.get('x-forwarded-for');
  return (f ? f.split(',')[0].trim() : req.headers.get('x-real-ip')) || null;
}
export const userAgent = req => (req.headers.get('user-agent') || '').slice(0, 300) || null;

// ===== HTTP · Reading the body =====
// Parses JSON and checks it against a zod schema; returns the clean values or throws a 400 with field messages.
export async function readBody(req, schema) {
  let raw;
  try { raw = await req.json(); } catch (e) { throw badRequest('The request was not valid JSON.'); }
  const r = schema.safeParse(raw);
  if (!r.success) throw badRequest('Some details are missing or invalid.', { fields: r.error.flatten().fieldErrors });
  return r.data;
}
