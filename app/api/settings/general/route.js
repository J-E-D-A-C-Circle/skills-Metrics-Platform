// Route GET /api/settings/general · system settings (organisation name, result-release, deadline and reminder policy)
// Route PUT /api/settings/general · save them (audited with before and after)
// =============================================================================
// Used by: components/SMSettings.jsx (Settings > General)
// Depends on: lib/server/{db,session,settings,audit,http}
// Sections (search for these markers): GENERAL SETTINGS · Read, GENERAL SETTINGS · Save
// Needs "System settings" (settings.general). Other routes read the values with getGeneralSettings(db).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { GENERAL_KEY, GENERAL_DEFAULTS, GeneralSchema, RESULT_RELEASE, RESULT_RELEASE_LABEL, mergeGeneral, sessionTimeoutMinutes } from '@/lib/server/settings';

async function current() {
  const row = await db.systemSetting.findUnique({ where: { key: GENERAL_KEY }, include: { updatedBy: { select: { displayName: true } } } });
  return { settings: mergeGeneral(row?.value), updatedAt: row?.updatedAt || null, updatedBy: row?.updatedBy?.displayName || null };
}

// ===== GENERAL SETTINGS · Read =====
export const GET = handle(async () => {
  await requirePermission('settings.general');
  return json({ ...(await current()), defaults: GENERAL_DEFAULTS, resultRelease: RESULT_RELEASE.map(k => ({ key: k, label: RESULT_RELEASE_LABEL[k] })), sessionTimeoutMinutes: sessionTimeoutMinutes() });
});

// ===== GENERAL SETTINGS · Save =====
export const PUT = handle(async req => {
  const ctx = await requirePermission('settings.general'), b = await readBody(req, GeneralSchema);
  const before = (await current()).settings;
  if (Object.keys(b).every(k => before[k] === b[k])) throw badRequest('Nothing has changed.');
  await db.$transaction(async tx => {
    await tx.systemSetting.upsert({ where: { key: GENERAL_KEY }, update: { value: b, updatedById: ctx.account.id }, create: { key: GENERAL_KEY, value: b, updatedById: ctx.account.id } });
    await audit({ actorId: ctx.account.id, action: 'settings.general.update', entityType: 'SystemSetting', entityId: GENERAL_KEY, before, after: b, ip: clientIp(req) }, tx);
  });
  return json(await current());
});
