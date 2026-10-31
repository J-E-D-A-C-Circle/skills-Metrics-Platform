// =============================================================================
// notify.js · In-app & Email notifications from the templates in NotificationTemplate
// Screen / URL: the header bell (GET /api/notifications), Webmail inbox (webmail.dvla.gov.gh)
// Used by: assignment, deadline, extension, attempt, results, content review and ticket routes
// Depends on: lib/server/db.js, lib/server/mailer.js, lib/server/calendar.js
// =============================================================================
import 'server-only';
import { db } from './db';
import { sendEmail } from './mailer';
import { buildIcsCalendar } from './calendar';

// ===== NOTIFY · Fill a template =====
// "{title} closes {deadline}" + { title: 'X', deadline: '...' } -> "X closes ...". Unknown placeholders stay blank.
export const fill = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
const when = d => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const fmtDate = when;

const isEmailOn = () => {
  const v = (process.env.NOTIFY_EMAIL || '').toLowerCase().trim();
  return v === 'on' || v === 'true' || v === '1' || v === 'yes';
};

// ===== NOTIFY · Send =====
// notify({ accountIds, key, vars, link, dedupe, calendarEvent }, tx?)
//   key: template key (e.g. "assessment.assigned"); vars fill its {placeholders}.
//   calendarEvent: optional { assessmentId, title, startsAt, deadline } to generate .ics invite
//   dedupe: a string unique to this event (e.g. "assigned:12"); with it, sending the same event twice to the
//   same account does nothing (Notification.dedupeKey is unique), so reminders and retries never duplicate.
// Returns how many notifications were created.
export async function notify({ accountIds, key, vars = {}, link = null, dedupe = null, calendarEvent = null }, tx = db) {
  const ids = [...new Set((accountIds || []).filter(Boolean))];
  if (!ids.length) return 0;
  const t = await tx.notificationTemplate.findUnique({ where: { key } });
  const title = fill(t ? t.title : key, vars), body = fill(t ? t.body : '', vars);
  let made = 0;

  const emailEnabled = isEmailOn();

  for (const accountId of ids) {
    const dedupeKey = dedupe ? dedupe + ':' + accountId : null;
    if (dedupeKey && (await tx.notification.findUnique({ where: { dedupeKey } }))) continue;

    const deliveries = [{ channel: 'in_app', status: 'SENT' }];

    // If email delivery is configured, transmit email notification & optional .ics invite
    if (emailEnabled) {
      try {
        const acc = await tx.account.findUnique({
          where: { id: accountId },
          select: { email: true, displayName: true, staff: { include: { station: true } } },
        });

        if (acc?.email) {
          let icsContent = null;
          if (calendarEvent && calendarEvent.deadline) {
            icsContent = buildIcsCalendar({
              tests: [{
                assessmentId: calendarEvent.assessmentId || 0,
                title: calendarEvent.title || title,
                startsAt: calendarEvent.startsAt || null,
                deadline: calendarEvent.deadline,
                durationMinutes: calendarEvent.durationMinutes || 60,
                maxAttempts: vars.max || 3,
                attemptsUsed: vars.used || 0,
                attemptsRemaining: Math.max(0, (vars.max || 3) - (vars.used || 0)),
                progressLabel: 'Scheduled',
                description: body,
              }],
              staff: { id: acc.staff?.id || accountId, staffNo: acc.staff?.staffNo || 'DVLA', email: acc.email, name: acc.displayName },
            });
          }

          const html = `
            <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <div style="background: #006747; color: #ffffff; padding: 16px 20px;">
                <h2 style="margin: 0; font-size: 18px; color: #ffffff;">DVLA Skill Matrix Notification</h2>
                <div style="font-size: 12px; opacity: 0.9; margin-top: 4px;">Driver and Vehicle Licensing Authority</div>
              </div>
              <div style="padding: 24px 20px;">
                <h3 style="margin: 0 0 12px 0; font-size: 16px; color: #0f172a;">${title}</h3>
                <p style="font-size: 14px; line-height: 1.5; color: #334155;">${body}</p>
                ${link ? `
                  <div style="margin: 24px 0;">
                    <a href="${process.env.APP_URL || 'https://skillmatrix.dvla.gov.gh'}${link}" style="background: #006747; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: bold; font-size: 13px; display: inline-block;">
                      Open Skill Matrix
                    </a>
                  </div>
                ` : ''}
                ${icsContent ? `
                  <div style="margin-top: 18px; padding: 12px; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; font-size: 12px; color: #166534;">
                    📅 <strong>Calendar invite attached:</strong> An Outlook appointment has been included. Click "Accept" in Outlook to automatically add this assessment deadline to your calendar with 24-hour and 2-hour reminders.
                  </div>
                ` : ''}
              </div>
              <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px 20px; font-size: 11px; color: #64748b; text-align: center;">
                This automated message was sent to ${acc.email} by the DVLA Skill Matrix Platform.
              </div>
            </div>
          `;

          const emailRes = await sendEmail({
            to: acc.email,
            subject: `[DVLA Skill Matrix] ${title}`,
            text: body,
            html,
            icsContent,
            filename: `dvla-assessment-${calendarEvent?.assessmentId || 'schedule'}.ics`,
          });

          deliveries.push({
            channel: 'email',
            status: emailRes.success ? 'SENT' : 'FAILED',
            error: emailRes.error || null,
          });
        }
      } catch (err) {
        console.error('[notify] email delivery error:', err);
        deliveries.push({ channel: 'email', status: 'FAILED', error: err.message });
      }
    }

    await tx.notification.create({
      data: {
        accountId,
        type: key,
        title,
        body,
        link,
        dedupeKey,
        deliveries: { create: deliveries },
      },
    });
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
