// Route PUT /api/settings/templates/:key · change a notification template's title, message and channels
// =============================================================================
// Used by: components/SMSettings.jsx (Settings > Notifications > Edit)
// Depends on: lib/server/{db,session,settings,audit,http}
// Sections (search for these markers): TEMPLATE · Save
// Needs "Notification templates" (settings.notifications). Only the template's listed {placeholders} may be used;
// in-app is always on; email / SMS only when configured on the server (NOTIFY_EMAIL / NOTIFY_SMS). Audited.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp, ApiError } from '@/lib/server/http';
import { TemplateInput, templateProblems, channelsAvailable } from '@/lib/server/settings';

// ===== TEMPLATE · Save =====
export const PUT = handle(async (req, { params }) => {
  const ctx = await requirePermission('settings.notifications'), key = decodeURIComponent((await params).key || '');
  const b = await readBody(req, TemplateInput);
  const t = await db.notificationTemplate.findUnique({ where: { key } });
  if (!t) throw new ApiError(404, 'Template not found.');
  const channels = ['in_app', 'email', 'sms'].filter(c => b.channels.includes(c));
  const errs = templateProblems(key, { ...b, channels }, channelsAvailable());
  if (errs.length) throw badRequest(errs.join(' '), { problems: errs });
  if (t.title === b.title && t.body === b.body && t.channels.join() === channels.join()) throw badRequest('Nothing has changed.');
  const saved = await db.$transaction(async tx => {
    const s = await tx.notificationTemplate.update({ where: { key }, data: { title: b.title, body: b.body, channels } });
    await audit({ actorId: ctx.account.id, action: 'settings.template.update', entityType: 'NotificationTemplate', entityId: key, before: { title: t.title, body: t.body, channels: t.channels }, after: { title: s.title, body: s.body, channels: s.channels }, ip: clientIp(req) }, tx);
    return s;
  });
  return json({ template: { key: saved.key, title: saved.title, body: saved.body, channels: saved.channels, updatedAt: saved.updatedAt } });
});
