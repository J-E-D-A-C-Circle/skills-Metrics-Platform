// Route POST /api/assignments/release · release results held back for a MANUAL-release assessment
// =============================================================================
// Used by: components/SMAssignments.jsx ("Results waiting for release" card)
// Depends on: lib/server/{db,session,audit,notify,http,assigned}, ../progress.js
// Sections (search for these markers): RELEASE · Input, RELEASE · Checks, RELEASE · Save & notify
// Needs "Release results" and sight of every department (it releases results for everyone the assessment covers).
// Sets Assessment.resultsReleasedAt, which lib/server/assigned.js resultsReleased() reads.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { coveredWhere } from '@/lib/server/assigned';
import { json, handle, readBody, badRequest, forbidden, clientIp } from '@/lib/server/http';
import { takerAccounts, allAccounts, plain } from '../progress';

// ===== RELEASE · Input =====
const Body = z.object({ assessmentId: z.number().int().positive() });

export const POST = handle(async req => {
  const ctx = await requirePermission('cycles.release');
  const b = await readBody(req, Body);

  // ===== RELEASE · Checks =====
  if (ctx.visibleDepartmentIds !== null) throw forbidden('Releasing results affects every department, so it needs access to all departments.');
  const as = await db.assessment.findUnique({ where: { id: b.assessmentId }, include: { assignments: true } });
  if (!as) throw badRequest('Assessment not found.');
  if (as.resultRelease !== 'MANUAL') throw badRequest('This assessment releases its results automatically, so there is nothing to release.');
  if (as.resultsReleasedAt) throw badRequest('Results for this assessment were already released.');
  if (!['PUBLISHED', 'ARCHIVED'].includes(as.status)) throw badRequest('Only published or archived assessments have results to release.');

  // ===== RELEASE · Save & notify =====
  // Everyone the assessment is assigned to is told (one message each, however many assignments reach them).
  const result = await db.$transaction(async tx => {
    const releasedAt = new Date();
    await tx.assessment.update({ where: { id: as.id }, data: { resultsReleasedAt: releasedAt } });
    await audit({ actorId: ctx.account.id, action: 'results.release', entityType: 'Assessment', entityId: as.id, before: { resultsReleasedAt: null }, after: plain({ title: as.title, resultsReleasedAt: releasedAt }), ip: clientIp(req) }, tx);
    const people = new Set();
    for (const a of as.assignments) (await tx.staffRecord.findMany({ where: coveredWhere(a), select: { id: true } })).forEach(s => people.add(s.id));
    const notified = await notify({ accountIds: allAccounts(await takerAccounts([...people], tx)), key: 'results.released', vars: { title: as.title }, link: '/assessments', dedupe: 'released:' + as.id }, tx);
    return { releasedAt, people: people.size, notified };
  }, { timeout: 30000 });
  return json(result);
});
