// Route GET /api/settings/templates · notification templates with their allowed {placeholders}, example values
//   for the preview, and which channels this server can use
// =============================================================================
// Used by: components/SMSettings.jsx (Settings > Notifications)
// Depends on: lib/server/{db,session,settings,tickets,http}
// Sections (search for these markers): TEMPLATES · Read
// Needs "Notification templates" (settings.notifications).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { json, handle } from '@/lib/server/http';
import { TEMPLATE_INFO, channelsAvailable } from '@/lib/server/settings';
import { ensureTicketTemplates } from '@/lib/server/tickets';

// ===== TEMPLATES · Read =====
// The ticket templates are created here too if missing, so every template can be reworded before first use.
export const GET = handle(async () => {
  await requirePermission('settings.notifications');
  await ensureTicketTemplates(db);
  const rows = await db.notificationTemplate.findMany({ orderBy: { key: 'asc' } });
  const order = Object.keys(TEMPLATE_INFO), pos = k => (order.indexOf(k) + 1 || 999);
  const templates = rows.sort((a, b) => pos(a.key) - pos(b.key)).map(t => {
    const info = TEMPLATE_INFO[t.key];
    return { key: t.key, title: t.title, body: t.body, channels: t.channels, updatedAt: t.updatedAt,
      label: info?.label || t.key, to: info?.to || '', placeholders: info ? Object.keys(info.vars) : null, examples: info?.vars || {} };
  });
  return json({ templates, channels: channelsAvailable() });
});
