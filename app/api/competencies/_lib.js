// =============================================================================
// _lib.js · Database helpers shared by the Competency Framework routes (not a route itself)
// Screen / URL: Competency Framework (/framework)
// Used by: app/api/competencies/**   Depends on: lib/server/{db,org}
// Sections (search for these markers): FRAMEWORK LIB · Rows, FRAMEWORK LIB · Inactive categories, FRAMEWORK LIB · Codes
// =============================================================================
import 'server-only';
import { db } from '@/lib/server/db';
import { codeFrom } from '@/lib/server/org';

// ===== FRAMEWORK LIB · Rows =====
// The shape the Competency Framework screen uses. requiredLevel is a Decimal in the database, a number here.
export const COMP_INCLUDE = { category: true, department: { select: { id: true, name: true, code: true, active: true } }, _count: { select: { questions: true, attemptResults: true, finalResults: true } } };
export const compRow = c => ({
  id: c.id, code: c.code, name: c.name, short: c.short, categoryId: c.categoryId, category: c.category ? { id: c.category.id, name: c.category.name, group: c.category.group } : null,
  departmentId: c.departmentId, department: c.department || null, importance: c.importance, requiredLevel: Number(c.requiredLevel),
  skillAreas: Array.isArray(c.skillAreas) ? c.skillAreas : [], active: c.active, updatedAt: c.updatedAt,
  questions: c._count?.questions ?? 0, attemptResults: c._count?.attemptResults ?? 0, finalResults: c._count?.finalResults ?? 0,
});
export const auditComp = c => ({ code: c.code, name: c.name, short: c.short, categoryId: c.categoryId, departmentId: c.departmentId, importance: c.importance, requiredLevel: Number(c.requiredLevel), skillAreas: c.skillAreas, active: c.active });

// ===== FRAMEWORK LIB · Inactive categories =====
// CompetencyCategory has no "active" column, so retired category ids are kept in SystemSetting
// "framework.inactiveCategories" (a JSON list of ids). Retired categories are not offered for new competencies.
export const INACTIVE_KEY = 'framework.inactiveCategories';
export async function inactiveCategories(tx = db) {
  const s = await tx.systemSetting.findUnique({ where: { key: INACTIVE_KEY } });
  return Array.isArray(s?.value) ? s.value.filter(n => Number.isInteger(n)) : [];
}
export async function setInactiveCategories(tx, ids, actorId) {
  const value = [...new Set(ids)].sort((a, b) => a - b);
  await tx.systemSetting.upsert({ where: { key: INACTIVE_KEY }, create: { key: INACTIVE_KEY, value, updatedById: actorId }, update: { value, updatedById: actorId } });
}

// ===== FRAMEWORK LIB · Codes =====
// A free code made from the name ("data-analysis", "data-analysis-2", ...) when none is typed.
export async function freeCode(name, tx = db) {
  const base = codeFrom(name);
  for (let i = 1; i < 500; i++) { const c = i === 1 ? base : base + '-' + i; if (!(await tx.competency.findUnique({ where: { code: c } }))) return c; }
  return base + '-' + Date.now();
}
