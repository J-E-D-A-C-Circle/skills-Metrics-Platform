// Route POST /api/jobs/reminders · send deadline reminders now ("closes soon" and "has closed")
// =============================================================================
// Used by: a scheduler (cron) with the x-jobs-secret header, and the Assignments page ("Send reminders now")
// Depends on: lib/server/{reminders,session,audit,http}
// Sections (search for these markers): JOB · Who may run it, JOB · Run
// Allowed with header x-jobs-secret equal to JOBS_SECRET (refused when JOBS_SECRET is not set), or by a signed-in
// person with "Change dates & attempt limits". Schedule, e.g. every hour:
//   0 * * * * curl -fsS -X POST -H "x-jobs-secret: $JOBS_SECRET" https://<host>/api/jobs/reminders
// =============================================================================
import { createHash, timingSafeEqual } from 'node:crypto';
import { runReminders } from '@/lib/server/reminders';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, unauthorized, clientIp } from '@/lib/server/http';

// ===== JOB · Who may run it =====
// Compares hashes so the check takes the same time whatever was sent. JOBS_SECRET must be at least 16 characters.
const sha = v => createHash('sha256').update(String(v)).digest();
function secretOk(sent) {
  const want = process.env.JOBS_SECRET;
  if (!want || want.length < 16 || !sent) return false;
  return timingSafeEqual(sha(sent), sha(want));
}

// ===== JOB · Run =====
// Audit keys avoid the word "passed": audit.js blanks any key matching /pass/ as if it were a password.
export const POST = handle(async req => {
  const sent = req.headers.get('x-jobs-secret');
  let actorId = null;
  if (sent != null) { if (!secretOk(sent)) throw unauthorized('The job secret is missing or wrong.'); }
  else actorId = (await requirePermission('cycles.edit')).account.id;
  const counts = await runReminders(new Date());
  await audit({ actorId, action: 'jobs.reminders', entityType: 'Job', entityId: 'reminders', after: { checked: counts.checked, closingSoon: counts.soon, closed: counts.passed, skipped: counts.skipped, failed: counts.failed, by: actorId ? 'user' : 'scheduler' }, ip: clientIp(req) });
  return json(counts);
});
