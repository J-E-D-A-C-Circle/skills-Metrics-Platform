// Route POST /api/competencies/categories · add a competency category (name, e.g. "Technical", and group,
//   e.g. "Cybersecurity")
// =============================================================================
// Used by: components/SMCompetencies.jsx (Add category)
// Depends on: lib/server/{db,session,audit,http,org}
// Sections (search for these markers): NEW CATEGORY · Save
// Needs "Edit competencies". The name + group pair is unique.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { CategoryInput, duplicateMessage } from '@/lib/server/org';

// ===== NEW CATEGORY · Save =====
export const POST = handle(async req => {
  const ctx = await requirePermission('framework.competencies');
  const b = await readBody(req, CategoryInput);
  if (await db.competencyCategory.findFirst({ where: { name: { equals: b.name, mode: 'insensitive' }, group: { equals: b.group, mode: 'insensitive' } } })) throw badRequest('The category ' + b.name + ' · ' + b.group + ' already exists.');
  try {
    const row = await db.$transaction(async tx => {
      const r = await tx.competencyCategory.create({ data: { name: b.name, group: b.group } });
      await audit({ actorId: ctx.account.id, action: 'competency-category.create', entityType: 'CompetencyCategory', entityId: r.id, after: r, ip: clientIp(req) }, tx);
      return r;
    });
    return json({ row: { ...row, competencies: 0, active: true } }, 201);
  } catch (e) { const m = duplicateMessage(e, 'category'); if (m) throw badRequest(m); throw e; }
});
