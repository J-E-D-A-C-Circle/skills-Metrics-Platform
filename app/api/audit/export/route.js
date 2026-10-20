// Route GET /api/audit/export · download the filtered audit log as CSV (the export itself is audited)
// =============================================================================
// Used by: components/SMSettings.jsx (Settings > Audit Log > Export CSV)
// Depends on: lib/server/{db,session,settings,audit,http}
// Sections (search for these markers): AUDIT EXPORT · Download
// Needs "Export audit log" (settings.audit-export). Same filters as GET /api/audit; at most 50,000 rows.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { handle, badRequest, clientIp } from '@/lib/server/http';
import { AuditQuery, auditWhere, toCsv } from '@/lib/server/settings';

const MAX_ROWS = 50000;

// ===== AUDIT EXPORT · Download =====
export const GET = handle(async req => {
  const ctx = await requirePermission('settings.audit-export');
  const p = AuditQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) throw badRequest('Some filters are not valid.', { fields: p.error.flatten().fieldErrors });
  const { page, size, ...filters } = p.data;
  const rows = await db.auditLog.findMany({ where: auditWhere(filters), orderBy: [{ at: 'desc' }, { id: 'desc' }], take: MAX_ROWS, include: { actor: { select: { displayName: true, username: true } } } });
  const csv = toCsv(['When (UTC)', 'Actor', 'Username', 'Action', 'Record type', 'Record id', 'Outcome', 'IP address', 'Before', 'After'],
    rows.map(r => [r.at.toISOString(), r.actor?.displayName || 'System', r.actor?.username || '', r.action, r.entityType, r.entityId, r.outcome, r.ip, r.before, r.after]));
  await audit({ actorId: ctx.account.id, action: 'audit.export', entityType: 'AuditLog', after: { filters, rows: rows.length, format: 'csv' }, ip: clientIp(req) });
  const name = 'audit-log-' + new Date().toISOString().slice(0, 10) + '.csv';
  return new Response('﻿' + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${name}"`, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });
});
