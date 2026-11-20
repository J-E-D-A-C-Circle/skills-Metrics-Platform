// Route GET /api/audit · the audit log, newest first, with filters and paging
// =============================================================================
// Used by: components/SMSettings.jsx (Settings > Audit Log)
// Depends on: lib/server/{db,session,settings,http}
// Sections (search for these markers): AUDIT LOG · Read
// Needs "Audit log" (settings.audit). Read-only: the AuditLog table is append-only (a database trigger refuses
// UPDATE and DELETE), and no route changes it.
// Filters: q, actor (name / username, or "system"), action (prefix, e.g. "ticket."), entity, outcome, from, to
//   (YYYY-MM-DD), page, size.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { json, handle, badRequest } from '@/lib/server/http';
import { AuditQuery, auditWhere, auditRow, OUTCOMES } from '@/lib/server/settings';

// ===== AUDIT LOG · Read =====
// Also returns the actions and record types present, for the filter drop-downs.
export const GET = handle(async req => {
  const ctx = await requirePermission('settings.audit');
  const p = AuditQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) throw badRequest('Some filters are not valid.', { fields: p.error.flatten().fieldErrors });
  const f = p.data, where = auditWhere(f, { visibleDepartmentIds: ctx.visibleDepartmentIds, selfId: ctx.account.id });
  const [rows, total, actions, entities] = await Promise.all([
    db.auditLog.findMany({ where, orderBy: [{ at: 'desc' }, { id: 'desc' }], skip: (f.page - 1) * f.size, take: f.size, include: { actor: { select: { id: true, displayName: true, username: true } } } }),
    db.auditLog.count({ where }),
    db.auditLog.groupBy({ by: ['action'], orderBy: { action: 'asc' }, take: 300 }),
    db.auditLog.groupBy({ by: ['entityType'], where: { entityType: { not: null } }, orderBy: { entityType: 'asc' }, take: 100 }),
  ]);
  return json({ items: rows.map(auditRow), total, page: f.page, size: f.size, actions: actions.map(a => a.action), entities: entities.map(e => e.entityType), outcomes: OUTCOMES });
});
