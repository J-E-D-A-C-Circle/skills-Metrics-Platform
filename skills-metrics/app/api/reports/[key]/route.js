// Route GET /api/reports/:key · one report as JSON for the screen: summary, columns and one page of rows
// =============================================================================
// Used by: components/SMReports.jsx (report table)
// Depends on: lib/server/{session,reports,http}
// Sections (search for these markers): REPORT · Read
// Needs "View reports" (plus the extra permission of the administration reports). Query: the report's filters
// (assessmentId, competencyId, departmentId, gradeId, stationId, locationId, staffId, status, from, to), q (search),
// sort / dir, page / pageSize (at most 100). The exports use the very same runReport() call.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { runReport, pageRows } from '@/lib/server/reports';
import { json, handle } from '@/lib/server/http';

// ===== REPORT · Read =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requirePermission('reports.view');
  const { key } = await params;
  const rep = await runReport(ctx, key, req.nextUrl.searchParams);
  const p = pageRows(rep.rows, rep.filters.page || 1, rep.filters.pageSize || 25);
  return json({ ...rep, rows: p.rows, page: p.page, pageSize: p.pageSize, pages: p.pages, total: p.total });
});
