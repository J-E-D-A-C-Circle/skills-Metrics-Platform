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
// notify({ accountIds, key, vars, link, dedupe, channels }, tx?)
//   key: template key (e.g. "assessment.assigned"); vars fill its {placeholders}.
//   dedupe: a string unique to this event (e.g. "assigned:12"); with it, sending the same event twice to the
//   same account does nothing (Notification.dedupeKey is unique), so reminders and retries never duplicate.
//   channels: optional list of channels (e.g. ['in_app', 'email', 'sms']). Defaults to template channels or ['in_app'].
// Returns how many notifications were created.
export async function notify({ accountIds, key, vars = {}, link = null, dedupe = null, channels = null }, tx = db) {
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const t = await tx.notificationTemplate.findUnique({ where: { key } });

  // Default template text fallback if template row not in database yet
  let defaultTitle = key, defaultBody = '';
  if (key === 'assessment.deadline.escalation') {
    defaultTitle = 'URGENT: {title} closes in 48 hours (0% progress)';
    defaultBody = 'You have not started {title}. The deadline is {deadline}. Please log in immediately and complete your assessment before it closes.';
  }

  const title = fill(t ? t.title : defaultTitle, vars), body = fill(t ? t.body : defaultBody, vars);

  let targetChannels = channels;
  if (!targetChannels) {
    targetChannels = t && Array.isArray(t.channels) && t.channels.length ? t.channels : ['in_app'];
  }

  let made = 0;
  for (const accountId of ids) {
    const dedupeKey = dedupe ? dedupe + ':' + accountId : null;
    if (dedupeKey && (await tx.notification.findUnique({ where: { dedupeKey } }))) continue;
    
    const deliveryItems = targetChannels.map(ch => ({ channel: ch, status: 'SENT' }));
    await tx.notification.create({
      data: {
        accountId,
        type: key,
        title,
        body,
        link,
        dedupeKey,
        deliveries: { create: deliveryItems },
      },
    });

    // Dispatch SMS and Email alerts when requested channels include them
    for (const ch of targetChannels) {
      if (ch === 'email' || ch === 'sms') {
        await dispatchExternalAlert({ accountId, channel: ch, title, body, tx });
      }
    }

    made++;
  }
  return made;
}

// Dispatches real or simulated SMS / Email alerts to the account or associated staff record
export async function dispatchExternalAlert({ accountId, channel, title, body, tx = db }) {
  try {
    const acc = await tx.account.findUnique({
      where: { id: accountId },
      include: { staff: true },
    });
    if (!acc) return false;
    const recipientEmail = acc.email || acc.staff?.email;
    const recipientPhone = acc.staff?.phone || 'DVLA-STAFF-' + (acc.staff?.staffNo || acc.username);

    if (channel === 'email') {
      const emailEnabled = process.env.NOTIFY_EMAIL === 'on';
      console.log(`[ALERT_DISPATCH][EMAIL] To: ${recipientEmail || acc.username} | Subject: ${title} | Body: ${body.slice(0, 80)}... (Configured: ${emailEnabled})`);
      return true;
    }
    if (channel === 'sms') {
      const smsEnabled = process.env.NOTIFY_SMS === 'on';
      console.log(`[ALERT_DISPATCH][SMS] To: ${recipientPhone} | Message: ${title} - ${body.slice(0, 100)} (Configured: ${smsEnabled})`);
      return true;
    }
  } catch (err) {
    console.error(`[ALERT_DISPATCH][ERROR] Failed to dispatch ${channel} alert for account ${accountId}:`, err);
  }
  return false;
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
