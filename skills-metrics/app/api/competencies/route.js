// Route GET /api/competencies · the Competency Framework: competencies (with filters) and categories
// Route POST /api/competencies · add a competency
// =============================================================================
// Used by: components/SMCompetencies.jsx (Competency Framework page)
// Depends on: lib/server/{db,session,audit,http,org}, app/api/competencies/_lib.js
// Sections (search for these markers): FRAMEWORK · Read, NEW COMPETENCY · Save
// Reading needs "View framework"; adding needs "Edit competencies". No personal data is returned (only counts).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { CompetencyInput, duplicateMessage } from '@/lib/server/org';
import { COMP_INCLUDE, compRow, auditComp, inactiveCategories, freeCode } from './_lib';

// ===== FRAMEWORK · Read =====
// ?q=&departmentId=(id|general)&categoryId=&status=(active|inactive|all, default all)&skillType=(all|technical|general)
export const GET = handle(async req => {
  await requirePermission('framework.view');
  const p = Object.fromEntries(req.nextUrl.searchParams), and = [];
  const q = (p.q || '').trim();
  if (q) and.push({ OR: [{ name: { contains: q, mode: 'insensitive' } }, { short: { contains: q, mode: 'insensitive' } }, { code: { contains: q, mode: 'insensitive' } }, { category: { group: { contains: q, mode: 'insensitive' } } }] });
  if (p.departmentId === 'general' || p.skillType === 'general') and.push({ departmentId: null });
  else if (/^\d+$/.test(p.departmentId || '')) and.push({ departmentId: Number(p.departmentId) });
  else if (p.skillType === 'technical') and.push({ departmentId: { not: null } });
  if (/^\d+$/.test(p.categoryId || '')) and.push({ categoryId: Number(p.categoryId) });
  if (p.status === 'active') and.push({ active: true }); else if (p.status === 'inactive') and.push({ active: false });
  const [rows, categories, departments, off, total, allComps] = await Promise.all([
    db.competency.findMany({ where: { AND: and }, include: COMP_INCLUDE, orderBy: [{ category: { name: 'asc' } }, { category: { group: 'asc' } }, { name: 'asc' }] }),
    db.competencyCategory.findMany({ include: { _count: { select: { competencies: true } } }, orderBy: [{ name: 'asc' }, { group: 'asc' }] }),
    db.department.findMany({ select: { id: true, name: true, code: true, active: true }, orderBy: { name: 'asc' } }),
    inactiveCategories(), db.competency.count(),
    db.competency.findMany({ select: { id: true, departmentId: true, skillAreas: true, active: true } }),
  ]);

  let totalSkillAreas = 0;
  let generalCompetencies = 0;
  let generalSkillAreas = 0;
  let technicalCompetencies = 0;
  let technicalSkillAreas = 0;

  for (const c of allComps) {
    const areas = Array.isArray(c.skillAreas) ? c.skillAreas.length : 0;
    totalSkillAreas += areas;
    if (c.departmentId == null) {
      generalCompetencies++;
      generalSkillAreas += areas;
    } else {
      technicalCompetencies++;
      technicalSkillAreas += areas;
    }
  }

  const metrics = {
    totalCompetencies: allComps.length,
    totalSkillAreas,
    generalCompetencies,
    generalSkillAreas,
    technicalCompetencies,
    technicalSkillAreas,
  };

  return json({
    rows: rows.map(compRow), total, metrics,
    categories: categories.map(c => ({ id: c.id, name: c.name, group: c.group, competencies: c._count.competencies, active: !off.includes(c.id) })),
    departments,
  });
});

// ===== NEW COMPETENCY · Save =====
export const POST = handle(async req => {
  const ctx = await requirePermission('framework.competencies');
  const b = await readBody(req, CompetencyInput);
  const [cat, off] = await Promise.all([db.competencyCategory.findUnique({ where: { id: b.categoryId } }), inactiveCategories()]);
  if (!cat) throw badRequest('Category not found.', { fields: { categoryId: ['Not found.'] } });
  if (off.includes(cat.id)) throw badRequest('That category is no longer active. Pick another or reactivate it.', { fields: { categoryId: ['Inactive.'] } });
  if (b.departmentId != null) { const d = await db.department.findUnique({ where: { id: b.departmentId } }); if (!d || !d.active) throw badRequest('Pick an active department, or "All departments".', { fields: { departmentId: ['Inactive or not found.'] } }); }
  if (b.code && await db.competency.findUnique({ where: { code: b.code } })) throw badRequest('The code ' + b.code + ' is already in use.', { fields: { code: ['Already in use.'] } });
  try {
    const c = await db.$transaction(async tx => {
      const code = b.code || await freeCode(b.name, tx);
      const r = await tx.competency.create({ data: { code, name: b.name, short: b.short || b.name.slice(0, 60), categoryId: b.categoryId, departmentId: b.departmentId ?? null, importance: b.importance, requiredLevel: b.requiredLevel, skillAreas: b.skillAreas, active: b.active ?? true }, include: COMP_INCLUDE });
      await audit({ actorId: ctx.account.id, action: 'competency.create', entityType: 'Competency', entityId: r.id, after: auditComp(r), ip: clientIp(req) }, tx);
      return r;
    });
    return json({ row: compRow(c) }, 201);
  } catch (e) { const m = duplicateMessage(e, 'competency'); if (m) throw badRequest(m); throw e; }
});
