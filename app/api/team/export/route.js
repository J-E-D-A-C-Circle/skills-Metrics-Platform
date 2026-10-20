// Route GET /api/team/export · download Team Results (CSV or Excel) with the same filters as the screen
// =============================================================================
// Used by: components/SMTeamResults.jsx (Export CSV / Export Excel)
// Depends on: lib/server/{session,analytics,audit,http}
// Sections (search for these markers): TEAM EXPORT · Build file
// Needs "Export team results". Same scope and filters as GET /api/team (never wider). format = csv | xlsx.
// Every export is written to the audit log (who, filters, number of rows).
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { teamData, filtersFrom, personRow, exportRow, fileResponse } from '@/lib/server/analytics';
import { audit } from '@/lib/server/audit';
import { handle, clientIp } from '@/lib/server/http';

// ===== TEAM EXPORT · Build file =====
export const GET = handle(async req => {
  const ctx = await requirePermission('staff-evals.export');
  const url = new URL(req.url), f = filtersFrom(url), format = url.searchParams.get('format') === 'xlsx' ? 'xlsx' : 'csv';
  const d = await teamData(ctx, f, { sort: url.searchParams.get('sort') || 'name', dir: url.searchParams.get('dir') === 'desc' ? 'desc' : 'asc' });
  const comps = f.competencyId ? d.competencies.filter(c => c.id === f.competencyId) : d.competencies;
  const rows = d.people.map(p => exportRow(personRow(p), comps, f));
  const headers = rows.length ? Object.keys(rows[0]) : ['Staff ID', 'Name', 'Department'];
  await audit({ actorId: ctx.account.id, action: 'export.team-results', entityType: 'Export', entityId: 'team-results', after: { format, filters: f, rows: rows.length }, ip: clientIp(req) });
  return fileResponse('team-results-' + new Date().toISOString().slice(0, 10), headers, rows, format);
});
