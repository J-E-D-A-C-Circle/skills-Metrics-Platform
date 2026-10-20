// Route POST /api/accounts/:id/password · give a user a new temporary password (Reset password)
// =============================================================================
// Used by: components/SMSystem.jsx (Reset password row button)
// Depends on: lib/server/{db,session,password,accounts,audit,http}
// Needs "Reset passwords". The server makes the password, returns it once for the administrator to pass on, signs
// the user out everywhere, and asks them to set their own at next sign-in. A suspended account stays suspended.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { hashPassword } from '@/lib/server/password';
import { findAccount, canSeeAccount, tempPassword } from '@/lib/server/accounts';
import { audit } from '@/lib/server/audit';
import { json, handle, forbidden, clientIp, ApiError } from '@/lib/server/http';

export const POST = handle(async (req, { params }) => {
  const ctx = await requirePermission('settings.password'), id = Number((await params).id);
  const a = Number.isInteger(id) ? await findAccount(id) : null;
  if (!a || !canSeeAccount(ctx, a)) throw new ApiError(404, 'User not found.');
  if (a.id === ctx.account.id) throw forbidden('Use My Profile to change your own password.');
  const password = tempPassword(), passwordHash = await hashPassword(password);
  await db.$transaction(async tx => {
    await tx.account.update({ where: { id: a.id }, data: { passwordHash, passwordSetAt: null, status: a.status === 'SUSPENDED' ? 'SUSPENDED' : 'MUST_CHANGE_PASSWORD' } });
    await tx.session.updateMany({ where: { accountId: a.id, revokedAt: null }, data: { revokedAt: new Date() } });
    await tx.loginAttempt.deleteMany({ where: { identifier: { in: [a.username, a.email] } } });
    await audit({ actorId: ctx.account.id, action: 'account.password.reset', entityType: 'Account', entityId: a.id, ip: clientIp(req) }, tx);
  });
  return json({ password });
});
