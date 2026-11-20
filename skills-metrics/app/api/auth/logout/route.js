// Route POST /api/auth/logout · ends this browser's session and clears the cookie
// Used by: components/SkillMatrixApp.jsx (Sign out)   Depends on: lib/server/{session,audit,http}
import { readSession, endSession } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, clientIp } from '@/lib/server/http';

export const POST = handle(async req => {
  const s = await readSession();
  await endSession();
  if (s) await audit({ actorId: s.accountId, action: 'auth.logout', entityType: 'Account', entityId: s.accountId, ip: clientIp(req) });
  return json({ ok: true });
});
