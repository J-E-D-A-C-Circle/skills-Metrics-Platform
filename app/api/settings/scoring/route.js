// Route GET /api/settings/scoring · the active scoring configuration and every earlier version
// Route POST /api/settings/scoring · save new thresholds as a NEW version (old rows are never edited)
// =============================================================================
// Used by: components/SMSettings.jsx (Settings > Scoring & Attempts)
// Depends on: lib/server/{db,session,settings,audit,http}, lib/scoring.js (validateConfig through settings.js)
// Sections (search for these markers): SCORING CONFIG · Read, SCORING CONFIG · Save new version
// Needs "Scoring thresholds" (settings.scoring). Results already worked out keep the scoringConfigId they used, so
// earlier reports can be reproduced; new results use the newest active version.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { ScoringInput, SCORING_FIELDS, plainConfig, scoringProblems, sameConfig } from '@/lib/server/settings';
import { DEFAULT_CONFIG } from '@/lib/scoring';

async function snapshot() {
  const rows = await db.scoringConfig.findMany({ orderBy: { version: 'desc' }, include: { createdBy: { select: { displayName: true } }, _count: { select: { finalResults: true, versions: true } } } });
  const history = rows.map(r => ({ ...plainConfig(r), createdBy: r.createdBy?.displayName || 'System', results: r._count.finalResults, assessmentVersions: r._count.versions }));
  return { active: history.find(h => h.active) || null, history, defaults: DEFAULT_CONFIG };
}

// ===== SCORING CONFIG · Read =====
export const GET = handle(async () => {
  await requirePermission('settings.scoring');
  return json(await snapshot());
});

// ===== SCORING CONFIG · Save new version =====
// The advisory lock stops two administrators saving at once from both taking the same version number.
export const POST = handle(async req => {
  const ctx = await requirePermission('settings.scoring'), b = await readBody(req, ScoringInput);
  const errs = scoringProblems(b);
  if (errs.length) throw badRequest(errs.join('. ') + '.', { problems: errs });
  const ip = clientIp(req);
  await db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('skm-scoring-config'))`;
    const active = plainConfig(await tx.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } }));
    if (sameConfig(active, b)) throw badRequest('These are already the thresholds in use. Change at least one value.');
    const last = await tx.scoringConfig.findFirst({ orderBy: { version: 'desc' }, select: { version: true } });
    const data = Object.fromEntries(SCORING_FIELDS.map(k => [k, b[k]]));
    const row = await tx.scoringConfig.create({ data: { ...data, version: (last?.version || 0) + 1, reason: b.reason, createdById: ctx.account.id, active: true } });
    await audit({ actorId: ctx.account.id, action: 'settings.scoring.new-version', entityType: 'ScoringConfig', entityId: row.id,
      before: active ? { version: active.version, ...Object.fromEntries(SCORING_FIELDS.map(k => [k, active[k]])) } : null,
      after: { version: row.version, ...data, reason: b.reason }, ip }, tx);
  });
  return json(await snapshot(), 201);
});
