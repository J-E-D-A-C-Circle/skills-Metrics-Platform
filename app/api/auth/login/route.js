// Route POST /api/auth/login · checks username/email + password, starts a session cookie
// =============================================================================
// Used by: components/SMSignIn.jsx (Sign-in check)
// Depends on: lib/server/{db,password,session,rateLimit,audit,http}
// Sections (search for these markers): LOGIN · Input, LOGIN · Lock-out, LOGIN · Password check, LOGIN · Start session
// The same message is shown for an unknown user and a wrong password, so usernames can't be guessed.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { verifyPassword, dummyVerify } from '@/lib/server/password';
import { createSession, toUser } from '@/lib/server/session';
import { isLockedOut, recordAttempt, LOCKOUT_MINUTES } from '@/lib/server/rateLimit';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp, userAgent } from '@/lib/server/http';

// ===== LOGIN · Input =====
const Body = z.object({ identifier: z.string().trim().min(1).max(200), password: z.string().min(1).max(200) });
const WRONG = 'The username/email or password is incorrect.';

export const POST = handle(async req => {
  const { identifier, password } = await readBody(req, Body);
  const ident = identifier.toLowerCase(), ip = clientIp(req);

  // ===== LOGIN · Lock-out =====
  if (await isLockedOut(ident, ip)) {
    await recordAttempt(ident, ip, false, 'locked');
    await audit({ action: 'auth.login', entityType: 'Account', entityId: ident, outcome: 'DENIED', after: { reason: 'locked out' }, ip });
    return json({ error: 'Too many wrong attempts. Try again in ' + LOCKOUT_MINUTES + ' minutes or ask your administrator.' }, 429);
  }

  // ===== LOGIN · Password check =====
  const account = await db.account.findFirst({
    where: { OR: [{ username: ident }, { email: ident }] },
    include: { roles: true, permissions: true, scopeDepartments: { include: { department: true } }, staff: { include: { department: true, grade: true, station: { include: { location: true } } } } },
  });
  const ok = account ? await verifyPassword(password, account.passwordHash) : await dummyVerify(password);
  if (!ok) {
    await recordAttempt(ident, ip, false, account ? 'wrong password' : 'unknown user');
    await audit({ actorId: account?.id ?? null, action: 'auth.login', entityType: 'Account', entityId: account?.id ?? ident, outcome: 'FAILURE', ip });
    return json({ error: WRONG }, 401);
  }
  if (account.status === 'SUSPENDED' || account.status === 'DISABLED') {
    await recordAttempt(ident, ip, false, 'suspended');
    await audit({ actorId: account.id, action: 'auth.login', entityType: 'Account', entityId: account.id, outcome: 'DENIED', after: { reason: 'account ' + account.status.toLowerCase() }, ip });
    return json({ error: 'This account is suspended. Contact your administrator.' }, 403);
  }

  // ===== LOGIN · Start session =====
  // Accounts on a temporary password get a session that can only set a new password (see /api/auth/password).
  await createSession(account.id, { ip, userAgent: userAgent(req) });
  await db.account.update({ where: { id: account.id }, data: { lastLoginAt: new Date() } });
  await recordAttempt(ident, ip, true, null);
  await audit({ actorId: account.id, action: 'auth.login', entityType: 'Account', entityId: account.id, ip });
  return json({ user: toUser(account) });
});
