// Route PATCH /api/competencies/categories/:id · rename a category, or deactivate / reactivate it
// =============================================================================
// Used by: components/SMCompetencies.jsx (category header > Edit)
// Depends on: lib/server/{db,session,audit,http,org}, app/api/competencies/_lib.js
// Sections (search for these markers): EDIT CATEGORY · Save
// Needs "Edit competencies". Deactivating a category also deactivates its active competencies (results already saved
// are not touched); reactivating it leaves its competencies as they are, to be reactivated one by one.
// The inactive list lives in SystemSetting "framework.inactiveCategories" (the table has no active column).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp, ApiError } from '@/lib/server/http';
import { CategoryInput, duplicateMessage } from '@/lib/server/org';
import { inactiveCategories, setInactiveCategories } from '../../_lib';

// ===== EDIT CATEGORY · Save =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('framework.competencies');
  const id = Number((await params).id);
  const before = Number.isInteger(id) && id > 0 ? await db.competencyCategory.findUnique({ where: { id } }) : null;
  if (!before) throw new ApiError(404, 'Category not found.');
  const b = await readBody(req, CategoryInput.partial());
  const name = b.name ?? before.name, group = b.group ?? before.group;
  if ((name !== before.name || group !== before.group) && await db.competencyCategory.findFirst({ where: { name: { equals: name, mode: 'insensitive' }, group: { equals: group, mode: 'insensitive' }, NOT: { id } } })) throw badRequest('The category ' + name + ' · ' + group + ' already exists.');
  const off = await inactiveCategories(), wasActive = !off.includes(id);
  try {
    const out = await db.$transaction(async tx => {
      const r = await tx.competencyCategory.update({ where: { id }, data: { name, group } });
      let retired = 0;
      if (b.active === false && wasActive) {
        await setInactiveCategories(tx, [...off, id], ctx.account.id);
        retired = (await tx.competency.updateMany({ where: { categoryId: id, active: true }, data: { active: false } })).count;
      } else if (b.active === true && !wasActive) await setInactiveCategories(tx, off.filter(x => x !== id), ctx.account.id);
      const active = b.active ?? wasActive;
      const action = active !== wasActive ? (active ? 'competency-category.reactivate' : 'competency-category.deactivate') : 'competency-category.update';
      await audit({ actorId: ctx.account.id, action, entityType: 'CompetencyCategory', entityId: id, before: { ...before, active: wasActive }, after: { ...r, active, competenciesDeactivated: retired }, ip: clientIp(req) }, tx);
      return { row: { ...r, active }, retired };
    });
    return json(out);
  } catch (e) { const m = duplicateMessage(e, 'category'); if (m) throw badRequest(m); throw e; }
});
