// Route POST /api/auth/password · the signed-in person sets a new password (forced after a temporary one)
// =============================================================================
// Used by: components/SMSignIn.jsx (Set your password)
// Depends on: lib/passwordRules.js, lib/server/{db,password,session,audit,http}
// Sections (search for these markers): PASSWORD CHANGE · Input, PASSWORD CHANGE · Checks, PASSWORD CHANGE · Save
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { hashPassword, verifyPassword } from '@/lib/server/password';
import { requireUser, endOtherSessions, toUser } from '@/lib/server/session';
import { failedPasswordRules } from '@/lib/passwordRules';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp } from '@/lib/server/http';

// ===== PASSWORD CHANGE · Input =====
const Body = z.object({ currentPassword: z.string().min(1).max(200), newPassword: z.string().min(1).max(200) });

export const POST = handle(async req => {
  const { account } = await requireUser({ allowMustChange: true });
  const { currentPassword, newPassword } = await readBody(req, Body);

  // ===== PASSWORD CHANGE · Checks =====
  if (!(await verifyPassword(currentPassword, account.passwordHash))) return json({ error: 'Your current password is incorrect.' }, 400);
  const failed = failedPasswordRules(newPassword, currentPassword);
  if (failed.length) return json({ error: 'Your new password needs to meet every rule.', failed }, 400);

  // ===== PASSWORD CHANGE · Save =====
  // Clears "must change password" and signs out every other browser using this account.
  const updated = await db.account.update({
    where: { id: account.id },
    data: { passwordHash: await hashPassword(newPassword), passwordSetAt: new Date(), status: account.status === 'MUST_CHANGE_PASSWORD' ? 'ACTIVE' : account.status },
    include: { roles: true, permissions: true, scopeDepartments: { include: { department: true } }, staff: { include: { department: true, grade: true, station: { include: { location: true } } } } },
  });
  await endOtherSessions(account.id);
  await audit({ actorId: account.id, action: 'auth.password.change', entityType: 'Account', entityId: account.id, ip: clientIp(req) });
  return json({ user: toUser(updated) });
});
