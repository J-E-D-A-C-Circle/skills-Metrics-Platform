// =============================================================================
// password.js · Password hashing (scrypt, built into Node, no extra packages)
// Screen / URL: none; server only
// Used by: app/api/auth/login, app/api/auth/password, prisma/seed.mjs (same format)   Depends on: node:crypto
// Sections (search for these markers): PASSWORD · Settings, PASSWORD · Hash, PASSWORD · Verify
// Stored format: "scrypt$<N>$<r>$<p>$<salt base64>$<hash base64>". Plain passwords are never stored or logged.
// =============================================================================
import { scrypt, randomBytes, timingSafeEqual } from 'node:crypto';

// ===== PASSWORD · Settings =====
const N = 32768, R = 8, P = 1, KEYLEN = 64;
const MAXMEM = 64 * 1024 * 1024; // scrypt needs 128 * N * r bytes (32 MB here)
const run = (pw, salt, n, r, p, len) => new Promise((ok, bad) => scrypt(pw, salt, len, { N: n, r, p, maxmem: MAXMEM }, (e, k) => (e ? bad(e) : ok(k))));

// ===== PASSWORD · Hash =====
export async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await run(String(plain), salt, N, R, P, KEYLEN);
  return ['scrypt', N, R, P, salt.toString('base64'), key.toString('base64')].join('$');
}

// ===== PASSWORD · Verify =====
// Constant-time compare. A malformed hash simply fails.
export async function verifyPassword(plain, stored) {
  try {
    const [alg, n, r, p, saltB64, keyB64] = String(stored).split('$');
    if (alg !== 'scrypt') return false;
    const want = Buffer.from(keyB64, 'base64');
    const got = await run(String(plain), Buffer.from(saltB64, 'base64'), Number(n), Number(r), Number(p), want.length);
    return got.length === want.length && timingSafeEqual(got, want);
  } catch (e) {
    return false;
  }
}

// A real hash of a random value, used when the username doesn't exist so the reply takes the same time
// (stops people finding valid usernames by timing the sign-in).
let dummy = null;
export async function dummyVerify(plain) {
  if (!dummy) dummy = await hashPassword(randomBytes(12).toString('hex'));
  await verifyPassword(plain, dummy);
  return false;
}
