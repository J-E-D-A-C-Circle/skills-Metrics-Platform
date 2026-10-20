// Route GET /api/reports/:key/export?format=xlsx|pdf|csv · download a report (same filters as the screen)
// =============================================================================
// Used by: components/SMReports.jsx (Export Excel / PDF / CSV buttons)
// Depends on: lib/server/{session,reports,exporters,audit,http}
// Sections (search for these markers): EXPORT ROUTE · Checks, EXPORT ROUTE · Build the file, EXPORT ROUTE · Audit & reply
// Needs "View reports" and "Export reports" (plus the extra permission of the administration reports). Every export
// is written to the audit log (who, which report, filters, format, row count); refused exports are logged as DENIED.
// The file is built from runReport(), the same function behind the on-screen table, so the numbers always match.
// =============================================================================
import { requireUser } from '@/lib/server/session';
import { runReport, reportDef } from '@/lib/server/reports';
import { toCsv, toXlsx, toPdf, FORMATS, fileName } from '@/lib/server/exporters';
import { audit } from '@/lib/server/audit';
import { handle, badRequest, ApiError, clientIp } from '@/lib/server/http';

export const GET = handle(async (req, { params }) => {
  // ===== EXPORT ROUTE · Checks =====
  const ctx = await requireUser();
  const { key } = await params, sp = new URLSearchParams(req.nextUrl.searchParams);
  const format = sp.get('format') || 'xlsx'; sp.delete('format'); sp.delete('page'); sp.delete('pageSize');
  if (!FORMATS[format]) throw badRequest('Choose Excel, PDF or CSV.');
  const ip = clientIp(req), filters = Object.fromEntries(sp.entries());
  let rep;
  try {
    rep = await runReport(ctx, key, sp, { exporting: true });
  } catch (e) {
    if (e instanceof ApiError && e.status === 403 && reportDef(key)) await audit({ actorId: ctx.account.id, action: 'report.export', entityType: 'Report', entityId: key, outcome: 'DENIED', after: { format, filters }, ip });
    throw e;
  }

  // ===== EXPORT ROUTE · Build the file =====
  const body = format === 'csv' ? toCsv(rep) : format === 'xlsx' ? toXlsx(rep) : await toPdf(rep);

  // ===== EXPORT ROUTE · Audit & reply =====
  await audit({ actorId: ctx.account.id, action: 'report.export', entityType: 'Report', entityId: key, after: { report: rep.report.title, format, filters: rep.filtersUsed, rows: rep.total }, ip });
  return new Response(body, { status: 200, headers: {
    'Content-Type': FORMATS[format].mime, 'Content-Disposition': 'attachment; filename="' + fileName(rep, format) + '"',
    'Content-Length': String(body.length), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Report-Rows': String(rep.total),
  } });
});
