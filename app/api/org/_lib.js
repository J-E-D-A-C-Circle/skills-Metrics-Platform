// =============================================================================
// _lib.js · Database helpers shared by the Organisation routes (not a route itself: Next.js ignores files that are
//   not named route.js, and the leading underscore marks it private)
// Screen / URL: Organisation (/organisation?tab=staff|departments|grades|stations|supervisors)
// Used by: app/api/org/**   Depends on: lib/server/{db,scope,audit,http,org}
// Sections (search for these markers): ORG LIB · Ids, ORG LIB · Staff in scope, ORG LIB · Reference checks,
//   ORG LIB · Structure list / create / edit / delete
// =============================================================================
import 'server-only';
import { db } from '@/lib/server/db';
import { assertStaffVisible } from '@/lib/server/scope';
import { audit } from '@/lib/server/audit';
import { json, badRequest, forbidden, clientIp, ApiError } from '@/lib/server/http';
import { STRUCTURE, inUse, inUseText, duplicateMessage, createsLoop, deptInScope } from '@/lib/server/org';

// ===== ORG LIB · Ids =====
// The :id from the URL as a positive whole number, or a 404.
export const idOf = async (params, what = 'Record') => { const id = Number((await params).id); if (!Number.isInteger(id) || id < 1) throw new ApiError(404, what + ' not found.'); return id; };

// ===== ORG LIB · Staff in scope =====
// Loads a staff record and checks the signed-in person may see it (404 otherwise, so ids can't be probed).
export async function visibleStaff(ctx, id, include) {
  const s = await db.staffRecord.findUnique({ where: { id }, include });
  assertStaffVisible(ctx, s);
  return s;
}
// Editors with a department scope may only change staff whose current department they can see.
export function assertCanEdit(ctx, staff) {
  if (!deptInScope(ctx, staff.departmentId)) throw forbidden('You can only change staff in departments you can see.');
}

// ===== ORG LIB · Reference checks =====
// The department, grade, station and supervisor picked on a staff form must exist; a newly picked one must also be
// active. `changed` lists the fields that are actually changing (unchanged inactive values may stay).
export async function checkStaffRefs(ctx, b, { staffId = null, changed = new Set(Object.keys(b)) } = {}) {
  const fields = {};
  const one = async (key, model, label) => {
    if (b[key] == null || !changed.has(key)) return;
    const r = await db[model].findUnique({ where: { id: b[key] } });
    if (!r) fields[key] = [label + ' not found.'];
    else if (!r.active) fields[key] = ['This ' + label.toLowerCase() + ' is no longer active.'];
  };
  await one('departmentId', 'department', 'Department');
  await one('gradeId', 'grade', 'Grade');
  await one('stationId', 'station', 'Station');
  if (changed.has('departmentId') && !deptInScope(ctx, b.departmentId ?? null)) throw forbidden('You can only put staff in departments you can see.');
  if (b.supervisorId != null && changed.has('supervisorId')) {
    if (b.supervisorId === staffId) fields.supervisorId = ['A person cannot be their own supervisor.'];
    else {
      const sup = await db.staffRecord.findUnique({ where: { id: b.supervisorId } });
      if (!sup) fields.supervisorId = ['Supervisor not found.'];
      else {
        assertStaffVisible(ctx, sup);
        if (sup.status !== 'ACTIVE') fields.supervisorId = ['The supervisor\'s staff record is not active.'];
        else if (staffId && await loops(staffId, b.supervisorId)) fields.supervisorId = ['That would make a loop: this person already supervises the chosen supervisor (directly or further up).'];
      }
    }
  }
  if (Object.keys(fields).length) throw badRequest(Object.values(fields)[0][0], { fields });
}
// Walks up the supervisor chain from the proposed supervisor.
export async function loops(staffId, supervisorId) {
  const chain = new Map(); let cur = supervisorId;
  for (let i = 0; cur != null && i < 50 && !chain.has(cur); i++) {
    const s = await db.staffRecord.findUnique({ where: { id: cur }, select: { supervisorId: true } });
    chain.set(cur, s?.supervisorId ?? null); cur = s?.supervisorId ?? null;
  }
  return createsLoop(staffId, supervisorId, chain);
}

// ===== ORG LIB · Structure list / create / edit / delete =====
// Departments, grades, locations and stations share the same rules: list with "in use" counts, add, rename,
// deactivate / reactivate, and delete only when nothing points at the record. Every change is audited.
const ENTITY = { department: 'Department', grade: 'Grade', location: 'Location', station: 'Station' };
const withCounts = (kind, extra = {}) => ({ ...extra, _count: { select: STRUCTURE[kind].count } });
export const structureRow = r => { const { _count, ...rest } = r; return { ...rest, counts: _count, inUse: inUse(_count) }; };

export async function listStructure(kind, include = {}) {
  const rows = await db[STRUCTURE[kind].model].findMany({ orderBy: STRUCTURE[kind].order, include: withCounts(kind, include) });
  return rows.map(structureRow);
}
function saveError(e, kind) {
  const m = duplicateMessage(e, STRUCTURE[kind].label);
  if (m) return badRequest(m);
  return e;
}
// Names (and department codes) must differ by more than upper / lower case. Stations only within their location.
async function assertUnique(kind, data, id = null, before = {}) {
  const model = STRUCTURE[kind].model, not = id ? { NOT: { id } } : {};
  const has = async where => !!(await db[model].findFirst({ where: { ...where, ...not } }));
  if (data.name) {
    const where = { name: { equals: data.name, mode: 'insensitive' } };
    if (kind === 'station') where.locationId = data.locationId ?? before.locationId;
    if (await has(where)) throw badRequest('A ' + STRUCTURE[kind].label + ' called ' + data.name + ' already exists' + (kind === 'station' ? ' at that location.' : '.'), { fields: { name: ['Already in use.'] } });
  }
  if (data.code && await has({ code: { equals: data.code, mode: 'insensitive' } })) throw badRequest('The code ' + data.code + ' is already in use.', { fields: { code: ['Already in use.'] } });
}
const clean = r => { const { _count, createdAt, updatedAt, location, ...rest } = r; return rest; };
export async function createStructure(ctx, req, kind, data, include = {}) {
  await assertUnique(kind, data);
  try {
    const row = await db.$transaction(async tx => {
      const r = await tx[STRUCTURE[kind].model].create({ data, include: withCounts(kind, include) });
      await audit({ actorId: ctx.account.id, action: kind + '.create', entityType: ENTITY[kind], entityId: r.id, after: clean(r), ip: clientIp(req) }, tx);
      return r;
    });
    return json({ row: structureRow(row) }, 201);
  } catch (e) { throw saveError(e, kind); }
}
export async function updateStructure(ctx, req, kind, id, data, include = {}) {
  const model = STRUCTURE[kind].model;
  const before = await db[model].findUnique({ where: { id } });
  if (!before) throw new ApiError(404, ENTITY[kind] + ' not found.');
  await assertUnique(kind, { name: data.name && data.name !== before.name ? data.name : undefined, code: data.code && data.code !== before.code ? data.code : undefined, locationId: data.locationId }, id, before);
  if (kind === 'station' && data.locationId && data.locationId !== before.locationId && !data.name) await assertUnique(kind, { name: before.name, locationId: data.locationId }, id, before);
  try {
    const row = await db.$transaction(async tx => {
      const r = await tx[model].update({ where: { id }, data, include: withCounts(kind, include) });
      const action = data.active === false && before.active ? '.deactivate' : data.active === true && !before.active ? '.reactivate' : '.update';
      await audit({ actorId: ctx.account.id, action: kind + action, entityType: ENTITY[kind], entityId: id, before: clean(before), after: clean(r), ip: clientIp(req) }, tx);
      return r;
    });
    return json({ row: structureRow(row) });
  } catch (e) { throw saveError(e, kind); }
}
export async function deleteStructure(ctx, req, kind, id) {
  const model = STRUCTURE[kind].model;
  const r = await db[model].findUnique({ where: { id }, include: withCounts(kind) });
  if (!r) throw new ApiError(404, ENTITY[kind] + ' not found.');
  if (inUse(r._count)) throw new ApiError(409, 'This ' + STRUCTURE[kind].label + ' is in use (' + inUseText(r._count) + '), so it cannot be deleted. Deactivate it instead: old records keep its name.');
  await db.$transaction(async tx => {
    await tx[model].delete({ where: { id } });
    await audit({ actorId: ctx.account.id, action: kind + '.delete', entityType: ENTITY[kind], entityId: id, before: clean(r), ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
}
