// =============================================================================
// org.js · Shared rules for the Organisation CMS and Competency Framework routes: input checks, placement moves,
//   bulk staff import checks, structure "in use" checks and friendly duplicate messages
// Screen / URL: Organisation (/organisation?tab=staff|departments|grades|stations|supervisors) and Competency
//   Framework (/framework); server only, but kept free of database imports so the rules can be unit-tested
//   (tests/org.test.js). Functions that write take the Prisma client or transaction (`tx`) as an argument.
// Used by: app/api/org/**, app/api/competencies/**   Depends on: zod
// Sections (search for these markers): ORG · Input checks, ORG · Scope checks, ORG · Placement moves,
//   ORG · Staff list rows, ORG · Bulk import, ORG · Structure, ORG · Supervisors, ORG · Friendly errors
// =============================================================================
import { z } from 'zod';

// ===== ORG · Input checks =====
// zod schemas for every form. Empty strings from the screens become null so optional fields can be cleared.
const blank = v => (typeof v === 'string' && v.trim() === '' ? null : v);
const optText = max => z.preprocess(blank, z.string().trim().max(max).nullable().optional());
// A missing id stays undefined (left unchanged on edit); '' or null clears it.
const optId = z.preprocess(v => (v === '' ? null : v), z.coerce.number().int().positive().nullable().optional());
export const STAFF_STATUS = ['ACTIVE', 'INACTIVE', 'LEFT'];
export const STATUS_LABEL = { ACTIVE: 'Active', INACTIVE: 'Inactive', LEFT: 'Left' };
export const STAFF_NO = /^[A-Za-z0-9][A-Za-z0-9_\-/.]{1,29}$/;

export const StaffInput = z.object({
  staffNo: z.string().trim().regex(STAFF_NO, 'Use 2 to 30 letters, numbers, dashes, underscores, dots or slashes.'),
  firstName: z.string().trim().min(1, 'Enter the first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter the last name.').max(80),
  otherNames: optText(120),
  email: z.preprocess(blank, z.string().trim().toLowerCase().email('Enter a valid email address.').max(200).nullable().optional()),
  designation: optText(120),
  departmentId: optId, gradeId: optId, stationId: optId, supervisorId: optId,
  status: z.enum(STAFF_STATUS).default('ACTIVE'),
  reason: optText(300), // why a department / station changed (kept on the placement history row)
});
export const StaffPatch = StaffInput.partial();

const name = (max = 120) => z.string().trim().min(2, 'Enter at least 2 characters.').max(max);
export const DepartmentInput = z.object({ code: z.string().trim().toUpperCase().regex(/^[A-Z0-9&-]{2,12}$/, 'Use 2 to 12 letters or numbers.'), name: name(), active: z.boolean().optional() });
export const GradeInput = z.object({ name: name(), active: z.boolean().optional() });
export const LocationInput = z.object({ name: name(), region: optText(80), active: z.boolean().optional() });
export const StationInput = z.object({ name: name(), locationId: z.coerce.number().int().positive(), active: z.boolean().optional() });
export const GradeOrder = z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(200) });

export const SupervisorAssignmentInput = z.object({ accountId: z.coerce.number().int().positive(), departmentId: z.coerce.number().int().positive() });
export const GradeMappingInput = z.object({ gradeId: z.coerce.number().int().positive(), stationId: optId, roleLabel: z.string().trim().min(2).max(80) });
export const SupervisorLinkInput = z.object({ staffIds: z.array(z.coerce.number().int().positive()).min(1).max(500), supervisorId: optId });

export const CompetencyInput = z.object({
  code: z.preprocess(blank, z.string().trim().toLowerCase().regex(/^[a-z0-9_.-]{2,30}$/, 'Use 2 to 30 lower-case letters, numbers, dots, dashes or underscores.').nullable().optional()),
  name: name(160), short: z.preprocess(blank, z.string().trim().max(60).nullable().optional()),
  categoryId: z.coerce.number().int().positive(), departmentId: optId,
  importance: z.coerce.number().int().min(1).max(5), requiredLevel: z.coerce.number().min(0).max(5).multipleOf(0.01),
  skillAreas: z.array(z.string().trim().min(1).max(120)).max(40).default([]), active: z.boolean().optional(),
});
export const CompetencyPatch = CompetencyInput.partial();
export const CategoryInput = z.object({ name: z.string().trim().min(2).max(60), group: z.string().trim().min(2).max(120), active: z.boolean().optional() });

// "Leadership & Management" -> "leadership-management"; used when a new competency has no code typed.
export const codeFrom = s => String(s).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'comp';

// ===== ORG · Scope checks =====
// ctx.visibleDepartmentIds is null for "every department". Someone with a narrower scope may only put staff in,
// or move staff out of, departments they can see; staff with no department need "every department".
export const deptInScope = (ctx, departmentId) => ctx.visibleDepartmentIds === null || (departmentId != null && ctx.visibleDepartmentIds.includes(departmentId));

// ===== ORG · Placement moves =====
// A move is a change of department or station. Earlier results keep where they came from because the old
// placement row is closed (toDate) rather than changed, and a new open row starts now.
export const placementChanged = (before, after) =>
  (after.departmentId !== undefined && (after.departmentId ?? null) !== (before.departmentId ?? null)) ||
  (after.stationId !== undefined && (after.stationId ?? null) !== (before.stationId ?? null));

// Closes the open placement row(s) and opens a new one, inside the caller's transaction. When a person has no
// history yet (records loaded before history was kept) their previous placement is written as a closed row first,
// starting from when the record was created, so the old department / station is not lost.
export async function movePlacement(tx, { staff, departmentId, stationId, actorId, reason, at = new Date() }) {
  const open = await tx.staffPlacementHistory.findMany({ where: { staffId: staff.id, toDate: null } });
  if (open.length) await tx.staffPlacementHistory.updateMany({ where: { staffId: staff.id, toDate: null }, data: { toDate: at } });
  else if (staff.departmentId != null || staff.stationId != null) {
    await tx.staffPlacementHistory.create({ data: { staffId: staff.id, departmentId: staff.departmentId, stationId: staff.stationId, fromDate: staff.createdAt || at, toDate: at, reason: 'Placement before history was recorded', changedById: actorId } });
  }
  return tx.staffPlacementHistory.create({ data: { staffId: staff.id, departmentId: departmentId ?? null, stationId: stationId ?? null, fromDate: at, reason: reason || null, changedById: actorId } });
}

// ===== ORG · Staff list rows =====
// The Prisma include and the row shape the Staff Records table uses. No account secrets are ever selected.
export const STAFF_INCLUDE = {
  department: { select: { id: true, name: true, code: true } }, grade: { select: { id: true, name: true } },
  station: { select: { id: true, name: true, location: { select: { id: true, name: true } } } },
  supervisor: { select: { id: true, staffNo: true, firstName: true, lastName: true } },
  _count: { select: { attempts: true, finalResults: true, accounts: true, reports: true } },
};
export const fullName = s => (s ? [s.firstName, s.otherNames, s.lastName].filter(Boolean).join(' ') : null);
export function staffRow(s) {
  return {
    id: s.id, staffNo: s.staffNo, firstName: s.firstName, lastName: s.lastName, otherNames: s.otherNames, name: fullName(s), email: s.email,
    designation: s.designation, status: s.status, departmentId: s.departmentId, gradeId: s.gradeId, stationId: s.stationId, supervisorId: s.supervisorId,
    department: s.department?.name || null, grade: s.grade?.name || null, station: s.station?.name || null, location: s.station?.location?.name || null,
    supervisor: s.supervisor ? { id: s.supervisor.id, staffNo: s.supervisor.staffNo, name: fullName(s.supervisor) } : null,
    attempts: s._count?.attempts ?? 0, results: s._count?.finalResults ?? 0, accounts: s._count?.accounts ?? 0, reports: s._count?.reports ?? 0,
    updatedAt: s.updatedAt,
  };
}
// The fields compared for the audit before/after of a staff change.
export const auditStaff = s => ({ staffNo: s.staffNo, firstName: s.firstName, lastName: s.lastName, otherNames: s.otherNames, email: s.email, designation: s.designation,
  departmentId: s.departmentId, gradeId: s.gradeId, stationId: s.stationId, supervisorId: s.supervisorId, status: s.status });

// Search, filters and sort for GET /api/org/staff (the scope filter is added by the route).
export function staffFilter(p) {
  const and = [];
  const q = (p.q || '').trim();
  if (q) and.push({ OR: [{ staffNo: { contains: q, mode: 'insensitive' } }, { firstName: { contains: q, mode: 'insensitive' } }, { lastName: { contains: q, mode: 'insensitive' } },
    { otherNames: { contains: q, mode: 'insensitive' } }, { email: { contains: q, mode: 'insensitive' } }, { designation: { contains: q, mode: 'insensitive' } }] });
  const id = v => (v && /^\d+$/.test(v) ? Number(v) : null);
  if (p.departmentId === 'none') and.push({ departmentId: null }); else if (id(p.departmentId)) and.push({ departmentId: id(p.departmentId) });
  if (id(p.gradeId)) and.push({ gradeId: id(p.gradeId) });
  if (id(p.stationId)) and.push({ stationId: id(p.stationId) });
  if (id(p.locationId)) and.push({ station: { locationId: id(p.locationId) } });
  if (p.supervisorId === 'none') and.push({ supervisorId: null }); else if (id(p.supervisorId)) and.push({ supervisorId: id(p.supervisorId) });
  if (STAFF_STATUS.includes(p.status)) and.push({ status: p.status });
  return and;
}
export const STAFF_SORT = {
  name: [{ lastName: 'asc' }, { firstName: 'asc' }], staffNo: [{ staffNo: 'asc' }], department: [{ department: { name: 'asc' } }, { lastName: 'asc' }],
  updated: [{ updatedAt: 'desc' }],
};

// ===== ORG · Bulk import =====
// Template columns (in order) and the header spellings accepted for each.
export const IMPORT_COLUMNS = [
  ['staffNo', 'Staff ID', ['staff id', 'staffid', 'staff no', 'staff number', 'staffno', 'id']],
  ['firstName', 'First name', ['first name', 'firstname', 'forename']],
  ['lastName', 'Last name', ['last name', 'lastname', 'surname']],
  ['otherNames', 'Other names', ['other names', 'other name', 'middle name', 'middle names']],
  ['email', 'Email', ['email', 'email address', 'e-mail']],
  ['designation', 'Designation', ['designation', 'job title', 'position']],
  ['department', 'Department', ['department', 'dept']],
  ['grade', 'Grade', ['grade', 'job level']],
  ['station', 'Station', ['station', 'office']],
  ['supervisorNo', 'Supervisor Staff ID', ['supervisor staff id', 'supervisor id', 'supervisor']],
  ['status', 'Status', ['status']],
];
export const IMPORT_MAX_ROWS = 2000;
export const IMPORT_MAX_BYTES = 2 * 1024 * 1024;
const norm = s => String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Finds which column holds which field. Returns { map: {field: index}, missing: [labels] }.
export function mapHeaders(headerRow) {
  const map = {};
  (headerRow || []).forEach((h, i) => { const n = norm(h).replace(/[*:]/g, '').trim(); const col = IMPORT_COLUMNS.find(([, , names]) => names.includes(n)); if (col && map[col[0]] == null) map[col[0]] = i; });
  const missing = IMPORT_COLUMNS.slice(0, 3).filter(([k]) => map[k] == null).map(([, label]) => label);
  return { map, missing };
}

// Checks every row before anything is saved. sheet = array of arrays (first row = headers).
// lookups: { departments, grades, stations (with location), existingStaff: [{id, staffNo, email}], allowedDeptIds (null = all) }
// Returns { fileErrors: [], rows: [{ row, staffNo, name, errors: [], data }] }; data holds ids ready to save.
export function validateImport(sheet, lookups) {
  const fileErrors = [];
  const [header, ...body] = sheet || [];
  const { map, missing } = mapHeaders(header);
  if (missing.length) fileErrors.push('The first row must hold the column headings. Missing: ' + missing.join(', ') + '. Download the template to see the layout.');
  const lines = body.map((cells, i) => ({ row: i + 2, cells })).filter(l => (l.cells || []).some(c => String(c ?? '').trim() !== ''));
  if (!lines.length && !missing.length) fileErrors.push('The file has no staff rows under the headings.');
  if (lines.length > IMPORT_MAX_ROWS) fileErrors.push('The file has ' + lines.length + ' rows; import at most ' + IMPORT_MAX_ROWS + ' at a time.');
  if (fileErrors.length) return { fileErrors, rows: [] };

  const byName = (list, v, extra = () => false) => list.filter(x => norm(x.name) === norm(v) || extra(x));
  const existingNo = new Map(lookups.existingStaff.map(s => [norm(s.staffNo), s]));
  const existingEmail = new Map(lookups.existingStaff.filter(s => s.email).map(s => [norm(s.email), s]));
  const seenNo = new Map(), seenEmail = new Map();
  const get = (cells, k) => (map[k] == null ? '' : String(cells[map[k]] ?? '').trim());

  const rows = lines.map(({ row, cells }) => {
    const raw = Object.fromEntries(IMPORT_COLUMNS.map(([k]) => [k, get(cells, k)]));
    const errors = [];
    const status = raw.status ? STAFF_STATUS.find(s => norm(s) === norm(raw.status)) : 'ACTIVE';
    if (!status) errors.push('Status "' + raw.status + '" is not one of Active, Inactive or Left.');
    const parsed = StaffInput.safeParse({ staffNo: raw.staffNo, firstName: raw.firstName, lastName: raw.lastName, otherNames: raw.otherNames, email: raw.email, designation: raw.designation, status: status || 'ACTIVE' });
    if (!parsed.success) Object.entries(parsed.error.flatten().fieldErrors).forEach(([f, m]) => errors.push((IMPORT_COLUMNS.find(c => c[0] === f) || [, f])[1] + ': ' + m[0]));
    const data = parsed.success ? { ...parsed.data } : {};
    delete data.reason;
    // Duplicates against the database and within the file.
    const no = norm(raw.staffNo);
    if (no) {
      if (existingNo.has(no)) errors.push('Staff ID ' + raw.staffNo + ' already exists.');
      if (seenNo.has(no)) errors.push('Staff ID ' + raw.staffNo + ' is also on row ' + seenNo.get(no) + '.'); else seenNo.set(no, row);
    }
    const em = norm(raw.email);
    if (em) {
      if (existingEmail.has(em)) errors.push('Email ' + raw.email + ' already belongs to Staff ID ' + existingEmail.get(em).staffNo + '.');
      if (seenEmail.has(em)) errors.push('Email ' + raw.email + ' is also on row ' + seenEmail.get(em) + '.'); else seenEmail.set(em, row);
    }
    // Department (name or code), grade, station ("Name" or "Name (Location)").
    if (raw.department) {
      const d = byName(lookups.departments, raw.department, x => norm(x.code) === norm(raw.department));
      if (!d.length) errors.push('Department "' + raw.department + '" was not found.');
      else if (!d[0].active) errors.push('Department "' + d[0].name + '" is no longer active.');
      else data.departmentId = d[0].id;
    }
    if (lookups.allowedDeptIds && !(data.departmentId && lookups.allowedDeptIds.includes(data.departmentId)) && !errors.some(e => e.startsWith('Department'))) errors.push('You can only add staff to departments you can see.');
    if (raw.grade) {
      const g = byName(lookups.grades, raw.grade);
      if (!g.length) errors.push('Grade "' + raw.grade + '" was not found.'); else if (!g[0].active) errors.push('Grade "' + g[0].name + '" is no longer active.'); else data.gradeId = g[0].id;
    }
    if (raw.station) {
      const m = raw.station.match(/^(.*)\(([^)]*)\)\s*$/);
      let st = lookups.stations.filter(s => norm(s.name) === norm(raw.station));
      if (!st.length && m) st = lookups.stations.filter(s => norm(s.name) === norm(m[1]) && norm(s.location?.name) === norm(m[2]));
      if (!st.length) errors.push('Station "' + raw.station + '" was not found.');
      else if (st.length > 1) errors.push('Station "' + raw.station + '" is at more than one location; write it as "Station (Location)".');
      else if (!st[0].active) errors.push('Station "' + st[0].name + '" is no longer active.');
      else data.stationId = st[0].id;
    }
    if (raw.supervisorNo) {
      const sn = norm(raw.supervisorNo);
      if (sn === no) errors.push('A person cannot be their own supervisor.');
      else if (existingNo.has(sn)) data.supervisorId = existingNo.get(sn).id;
      else data.supervisorNo = raw.supervisorNo; // checked against the other rows below
    }
    return { row, staffNo: raw.staffNo, name: [raw.firstName, raw.lastName].filter(Boolean).join(' '), errors, data };
  });
  // Supervisors who are new in the same file.
  const inFile = new Set(rows.map(r => norm(r.staffNo)));
  rows.forEach(r => { if (r.data.supervisorNo && !inFile.has(norm(r.data.supervisorNo))) r.errors.push('Supervisor Staff ID ' + r.data.supervisorNo + ' was not found.'); });
  return { fileErrors, rows };
}

// ===== ORG · Structure =====
// What may point at a department / grade / station / location. A hard delete is refused when any count is above 0;
// deactivating is always allowed and keeps old results' names.
export const STRUCTURE = {
  department: { model: 'department', label: 'department', count: { staff: true, competencies: true, assignments: true, locationHistory: true, scopeAccounts: true, supervisorLinks: true }, order: { name: 'asc' } },
  grade: { model: 'grade', label: 'grade', count: { staff: true, assignments: true, supervisoryMapping: true }, order: { rank: 'asc' } },
  location: { model: 'location', label: 'location', count: { stations: true, assignments: true }, order: { name: 'asc' } },
  station: { model: 'station', label: 'station', count: { staff: true, assignments: true, placementHistory: true, supervisoryMapping: true }, order: { name: 'asc' } },
};
export const inUse = counts => Object.values(counts || {}).reduce((a, b) => a + b, 0) > 0;
export const COUNT_LABEL = { staff: 'staff records', competencies: 'competencies', assignments: 'assessment assignments', locationHistory: 'placement history rows', placementHistory: 'placement history rows',
  scopeAccounts: 'account access settings', supervisorLinks: 'supervisor assignments', supervisoryMapping: 'supervisory mappings', stations: 'stations' };
export const inUseText = counts => Object.entries(counts || {}).filter(([, n]) => n > 0).map(([k, n]) => n + ' ' + (COUNT_LABEL[k] || k)).join(', ');

// New ranks for a grade re-order: ids in the order given get 0, 1, 2 ... Every existing grade must be listed once.
export function rankPlan(allIds, orderedIds) {
  const set = new Set(orderedIds);
  if (set.size !== orderedIds.length || orderedIds.length !== allIds.length || allIds.some(id => !set.has(id))) return null;
  return orderedIds.map((id, rank) => ({ id, rank }));
}

// ===== ORG · Supervisors =====
// Would making `supervisorId` the supervisor of `staffId` create a loop (A supervises B supervises A)?
// chain: Map staffId -> supervisorId for everyone involved.
export function createsLoop(staffId, supervisorId, chain) {
  let cur = supervisorId; const seen = new Set();
  while (cur != null) { if (cur === staffId) return true; if (seen.has(cur)) return false; seen.add(cur); cur = chain.get(cur) ?? null; }
  return false;
}

// ===== ORG · Friendly errors =====
// Prisma unique-constraint error (P2002) -> a message people understand, or null for any other error.
export function duplicateMessage(e, what = 'record') {
  if (!e || e.code !== 'P2002') return null;
  const t = [].concat(e.meta?.target || []).join(',');
  if (/staffNo/.test(t)) return 'That Staff ID is already in use.';
  if (/email/.test(t)) return 'That email address already belongs to another staff record.';
  if (/code/.test(t)) return 'That code is already in use.';
  if (/rank/.test(t)) return 'Two grades cannot share the same position.';
  if (/name/.test(t)) return 'A ' + what + ' with that name already exists.';
  return 'This ' + what + ' already exists.';
}
