// Route GET /api/auth/me · who is signed in (profile, role, permissions, department scope), or 401
// Used by: components/SkillMatrixApp.jsx (restore sign-in on load)   Depends on: lib/server/{session,http}
import { requireUser } from '@/lib/server/session';
import { json, handle } from '@/lib/server/http';

export const GET = handle(async () => {
  const { user } = await requireUser({ allowMustChange: true });
  return json({ user });
});
