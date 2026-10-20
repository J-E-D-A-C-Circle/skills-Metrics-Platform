// =============================================================================
// notify.js · In-app notifications from the templates in NotificationTemplate (Settings > Notification templates)
// Screen / URL: the header bell (GET /api/notifications)
// Used by: assignment, deadline, extension, attempt, results, content review and ticket routes
// Depends on: lib/server/db.js
// Sections (search for these markers): NOTIFY · Fill a template, NOTIFY · Send
// Email / SMS are only used when configured (NOTIFY_EMAIL=on); until then every delivery is recorded as in-app only.
// =============================================================================
import 'server-only';
import { db } from './db';

// ===== NOTIFY · Fill a template =====
// "{title} closes {deadline}" + { title: 'X', deadline: '...' } -> "X closes ...". Unknown placeholders stay blank.
export const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
const when = d => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDate = when;

// ===== NOTIFY · Send =====
// notify({ accountIds, key, vars, link, dedupe }, tx?)
//   key: template key (e.g. "assessment.assigned"); vars fill its {placeholders}.
//   dedupe: a string unique to this event (e.g. "assigned:12"); with it, sending the same event twice to the
//   same account does nothing (Notification.dedupeKey is unique), so reminders and retries never duplicate.
// Returns how many notifications were created.
export async function notify({ accountIds, key, vars = {}, link = null, dedupe = null }, tx = db) {
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const t = await tx.notificationTemplate.findUnique({ where: { key } });
  const title = fill(t ? t.title : key, vars), body = fill(t ? t.body : '', vars);
  let made = 0;
  for (const accountId of ids) {
    const dedupeKey = dedupe ? dedupe + ':' + accountId : null;
    if (dedupeKey && (await tx.notification.findUnique({ where: { dedupeKey } }))) continue;
    await tx.notification.create({ data: { accountId, type: key, title, body, link, dedupeKey, deliveries: { create: [{ channel: 'in_app', status: 'SENT' }] } } });
    made++;
  }
  return made;
}
// Login accounts (not deleted) that belong to the given staff records, for notifying staff.
export async function accountsForStaff(staffIds, tx = db) {
  if (!staffIds.length) return [];
  const rows = await tx.account.findMany({ where: { staffId: { in: staffIds }, status: { in: ['ACTIVE', 'MUST_CHANGE_PASSWORD'] } }, select: { id: true } });
  return rows.map(r => r.id);
}
// Every active Administrator account (for "content submitted for review" and new tickets).
export async function adminAccounts(tx = db) {
  const rows = await tx.account.findMany({ where: { status: { in: ['ACTIVE', 'MUST_CHANGE_PASSWORD'] }, roles: { some: { role: 'ADMIN' } } }, select: { id: true } });
  return rows.map(r => r.id);
}
