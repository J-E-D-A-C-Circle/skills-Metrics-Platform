// Route GET /api/competencies/:id · one competency with the assessments whose questions use it
// Route PATCH /api/competencies/:id · edit a competency (name, category, department, importance, required level,
//   skill areas) or deactivate / reactivate it
// =============================================================================
// Used by: components/SMCompetencies.jsx (competency drawer)
// Depends on: lib/server/{db,session,audit,http,org}, app/api/competencies/_lib.js
// Sections (search for these markers): COMPETENCY · Read, EDIT COMPETENCY · Save
// Reading needs "View framework"; editing needs "Edit competencies". Deactivating only stops the competency being
// used for new content: attempt scores and final results already saved are never changed or recalculated.
// The code is fixed once results exist, because exports and question uploads refer to it.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp, ApiError } from '@/lib/server/http';
import { CompetencyPatch, duplicateMessage } from '@/lib/server/org';
import { COMP_INCLUDE, compRow, auditComp, inactiveCategories } from '../_lib';

const idOf = async params => { const id = Number((await params).id); if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Competency not found.'); return id; };

// ===== COMPETENCY · Read =====
export const GET = handle(async (req, { params }) => {
  await requirePermission('framework.view');
  const id = await idOf(params);
  const c = await db.competency.findUnique({ where: { id }, include: COMP_INCLUDE });
  if (!c) throw new ApiError(404, 'Competency not found.');
  const versions = await db.assessmentVersion.findMany({ where: { questions: { some: { competencies: { some: { competencyId: id } } } } }, select: { versionNo: true, status: true, assessment: { select: { id: true, title: true, status: true } } }, orderBy: { assessmentId: 'asc' } });
  const byAssessment = new Map();
  versions.forEach(v => { const a = byAssessment.get(v.assessment.id) || { id: v.assessment.id, title: v.assessment.title, status: v.assessment.status, versions: [] }; a.versions.push(v.versionNo); byAssessment.set(a.id, a); });
  return json({ row: compRow(c), assessments: [...byAssessment.values()] });
});

// ===== EDIT COMPETENCY · Save =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('framework.competencies');
  const id = await idOf(params);
  const before = await db.competency.findUnique({ where: { id }, include: COMP_INCLUDE });
  if (!before) throw new ApiError(404, 'Competency not found.');
  const b = await readBody(req, CompetencyPatch);
  const data = {};
  if (b.code != null && b.code !== before.code) {
    if (before._count.attemptResults || before._count.finalResults) throw badRequest('The code cannot change once results exist for this competency.', { fields: { code: ['Fixed.'] } });
    if (await db.competency.findUnique({ where: { code: b.code } })) throw badRequest('The code ' + b.code + ' is already in use.', { fields: { code: ['Already in use.'] } });
    data.code = b.code;
  }
  if (b.categoryId !== undefined && b.categoryId !== before.categoryId) {
    const cat = await db.competencyCategory.findUnique({ where: { id: b.categoryId } });
    if (!cat) throw badRequest('Category not found.', { fields: { categoryId: ['Not found.'] } });
    if ((await inactiveCategories()).includes(cat.id)) throw badRequest('That category is no longer active.', { fields: { categoryId: ['Inactive.'] } });
    data.categoryId = b.categoryId;
  }
  if (b.departmentId !== undefined && (b.departmentId ?? null) !== before.departmentId) {
    if (b.departmentId != null) { const d = await db.department.findUnique({ where: { id: b.departmentId } }); if (!d || !d.active) throw badRequest('Pick an active department, or "All departments".', { fields: { departmentId: ['Inactive or not found.'] } }); }
    data.departmentId = b.departmentId ?? null;
  }
  ['name', 'importance', 'requiredLevel', 'skillAreas', 'active'].forEach(k => { if (b[k] !== undefined) data[k] = b[k]; });
  if (b.short !== undefined) data.short = b.short || (b.name || before.name).slice(0, 60);
  try {
    const c = await db.$transaction(async tx => {
      const r = await tx.competency.update({ where: { id }, data, include: COMP_INCLUDE });
      const action = data.active === false && before.active ? 'competency.deactivate' : data.active === true && !before.active ? 'competency.reactivate' : 'competency.update';
      await audit({ actorId: ctx.account.id, action, entityType: 'Competency', entityId: id, before: auditComp(before), after: auditComp(r), ip: clientIp(req) }, tx);
      return r;
    });
    return json({ row: compRow(c) });
  } catch (e) { const m = duplicateMessage(e, 'competency'); if (m) throw badRequest(m); throw e; }
});
