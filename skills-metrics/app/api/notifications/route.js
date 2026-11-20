// Route GET /api/notifications · the signed-in person's own notifications (newest 50) and their unread count
// Route POST /api/notifications · mark own notifications read: { read: [ids] } or { readAll: true }
// =============================================================================
// Used by: components/SkillMatrixApp.jsx (header bell: loadNotifs, openNotif)
// Depends on: lib/server/{db,session,http}
// Sections (search for these markers): NOTIFICATIONS · Read, NOTIFICATIONS · Mark read
// Any signed-in person. Only ever touches rows whose accountId is the signed-in account, so ids from the browser
// can't reach anyone else's notifications.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { json, handle, readBody } from '@/lib/server/http';

const unreadOf = accountId => db.notification.count({ where: { accountId, readAt: null } });

// ===== NOTIFICATIONS · Read =====
export const GET = handle(async () => {
  const ctx = await requireUser(), accountId = ctx.account.id;
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { accountId }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 50 }),
    unreadOf(accountId),
  ]);
  const items = rows.map(n => ({ id: n.id, type: n.type, title: n.title, body: n.body, link: n.link, read: !!n.readAt, readAt: n.readAt, createdAt: n.createdAt }));
  return json({ items, unread });
});

// ===== NOTIFICATIONS · Mark read =====
const Body = z.union([
  z.object({ read: z.array(z.number().int().positive()).min(1).max(200) }).strict(),
  z.object({ readAll: z.literal(true) }).strict(),
]);
export const POST = handle(async req => {
  const ctx = await requireUser(), accountId = ctx.account.id, b = await readBody(req, Body);
  const where = { accountId, readAt: null, ...(b.read ? { id: { in: b.read } } : {}) };
  const r = await db.notification.updateMany({ where, data: { readAt: new Date() } });
  return json({ marked: r.count, unread: await unreadOf(accountId) });
});
