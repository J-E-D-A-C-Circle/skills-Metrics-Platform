// =============================================================================
// Route GET /api/lookups · Names and ids for the drop-down lists (departments, grades, stations, locations,
//   competency categories and competencies)
// =============================================================================
// Used by: filters and forms on most screens (assignments, reports, dashboards, content, organisation)
// Depends on: lib/server/{db,session,http}
// Sections (search for these markers): LOOKUPS · Read
// Any signed-in person may read these lists: they hold no personal data. Staff lists are NOT here; they are
// scoped per person and come from the organisation / team routes.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { json, handle } from '@/lib/server/http';

// ===== LOOKUPS · Read =====
// Inactive departments / grades / stations / competencies are included with active:false so old results still
// show their names; screens should only offer active ones for new records.
export const GET = handle(async () => {
  await requireUser();
  const [departments, grades, locations, stations, categories, competencies, config] = await Promise.all([
    db.department.findMany({ orderBy: { name: 'asc' } }),
    db.grade.findMany({ orderBy: { name: 'asc' } }),
    db.location.findMany({ orderBy: { name: 'asc' } }),
    db.station.findMany({ orderBy: { name: 'asc' } }),
    db.competencyCategory.findMany({ orderBy: [{ name: 'asc' }, { group: 'asc' }] }),
    db.competency.findMany({ orderBy: { name: 'asc' }, select: { id: true, code: true, name: true, short: true, categoryId: true, departmentId: true, active: true } }),
    db.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } }),
  ]);
  // Thresholds for the Help > Rating Scales tab (the newest active scoring version; numbers only, nothing personal).
  const scoring = config ? { version: config.version, requiredLevel: +config.requiredLevel, competentFrom: +config.competentFrom, proficientFrom: +config.proficientFrom,
    moderateGapFrom: +config.moderateGapFrom, noGapFrom: +config.noGapFrom, defaultMaxAttempts: config.defaultMaxAttempts } : null;
  return json({ departments, grades, locations, stations, categories, competencies, scoring });
});
