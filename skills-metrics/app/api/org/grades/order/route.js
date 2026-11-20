// Route PUT /api/org/grades/order · save a new grade order (most junior first)
// =============================================================================
// Used by: components/SMOrganisation.jsx (Grades tab, up / down arrows)
// Depends on: lib/server/{db,session,audit,http,org}
// Sections (search for these markers): GRADE ORDER · Save
// Needs "Manage structure". Body { ids: [every grade id, most junior first] }. Ranks are unique, so they are first
// moved out of the way (negative) and then set, all in one transaction.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { GradeOrder, rankPlan } from '@/lib/server/org';

// ===== GRADE ORDER · Save =====
export const PUT = handle(async req => {
  const ctx = await requirePermission('org.structure');
  const { ids } = await readBody(req, GradeOrder);
  const grades = await db.grade.findMany({ orderBy: { rank: 'asc' } });
  const plan = rankPlan(grades.map(g => g.id), ids);
  if (!plan) throw badRequest('The list of grades has changed. Reload the page and try again.');
  await db.$transaction(async tx => {
    for (const g of grades) await tx.grade.update({ where: { id: g.id }, data: { rank: -1 - g.id } });
    for (const p of plan) await tx.grade.update({ where: { id: p.id }, data: { rank: p.rank } });
    await audit({ actorId: ctx.account.id, action: 'grade.reorder', entityType: 'Grade', before: grades.map(g => ({ id: g.id, name: g.name, rank: g.rank })), after: plan.map(p => ({ id: p.id, name: grades.find(g => g.id === p.id).name, rank: p.rank })), ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
