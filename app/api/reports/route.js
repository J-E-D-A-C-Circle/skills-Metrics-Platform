// Route GET /api/reports · the reports this person may open, with the options for the report filters
// =============================================================================
// Used by: components/SMReports.jsx (report picker and filter drop-downs)
// Depends on: lib/server/{db,session,reports,http}
// Sections (search for these markers): REPORT LIST · Read
// Needs "View reports". Only the reports the person may open are listed (see lib/server/reports.js REPORTS · Access).
// Assessment titles hold no personal data; staff for the person picker come from /api/reports/staff (scoped).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { REPORTS, mayRun } from '@/lib/server/reports';
import { json, handle } from '@/lib/server/http';

// ===== REPORT LIST · Read =====
export const GET = handle(async () => {
  const ctx = await requirePermission('reports.view');
  const assessments = await db.assessment.findMany({ select: { id: true, title: true, status: true }, orderBy: { title: 'asc' } });
  return json({
    reports: REPORTS.filter(r => mayRun(ctx.user, r)).map(({ key, group, title, description, filters, status, dateLabel, needsStaff }) => ({ key, group, title, description, filters, status: status || [], dateLabel: dateLabel || 'Date', needsStaff: !!needsStaff })),
    assessments, canExport: ctx.user.perms.includes('reports.export'),
  });
});
