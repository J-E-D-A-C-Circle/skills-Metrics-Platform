// =============================================================================
// org.test.js · Tests for lib/server/org.js (Organisation CMS and Competency Framework rules)
// Run: npm test
// Sections (search for these markers): TEST · Input checks, TEST · Scope, TEST · Placement moves, TEST · Bulk import,
//   TEST · Structure, TEST · Supervisors, TEST · Friendly errors
// =============================================================================
import { describe, it, expect } from 'vitest';
import { StaffInput, StaffPatch, CompetencyInput, DepartmentInput, deptInScope, placementChanged, movePlacement, validateImport, mapHeaders,
  IMPORT_COLUMNS, inUse, inUseText, rankPlan, createsLoop, duplicateMessage, codeFrom, staffFilter } from '../lib/server/org.js';

// ===== TEST · Input checks =====
describe('staff input', () => {
  it('accepts a full record and turns blanks into null', () => {
    const r = StaffInput.parse({ staffNo: 'DV-0042', firstName: ' Ama ', lastName: 'Owusu', email: 'AMA@dvla.gov.gh', otherNames: '', departmentId: '3', stationId: '' });
    expect(r).toMatchObject({ staffNo: 'DV-0042', firstName: 'Ama', email: 'ama@dvla.gov.gh', otherNames: null, departmentId: 3, stationId: null, status: 'ACTIVE' });
  });
  it('refuses bad Staff IDs, emails and statuses', () => {
    expect(StaffInput.safeParse({ staffNo: 'x', firstName: 'A', lastName: 'B' }).success).toBe(false);
    expect(StaffInput.safeParse({ staffNo: 'DV 1', firstName: 'A', lastName: 'B' }).success).toBe(false);
    expect(StaffInput.safeParse({ staffNo: 'DV1', firstName: 'A', lastName: 'B', email: 'nope' }).success).toBe(false);
    expect(StaffInput.safeParse({ staffNo: 'DV1', firstName: 'A', lastName: 'B', status: 'GONE' }).success).toBe(false);
  });
  it('an edit leaves missing fields alone but clears fields sent empty', () => {
    const r = StaffPatch.parse({ designation: 'Officer', supervisorId: '' });
    expect(r.departmentId).toBeUndefined();
    expect(r.status).toBeUndefined();
    expect(r.supervisorId).toBeNull();
  });
  it('competency levels stay on the 0-5 scale and importance on 1-5', () => {
    const ok = { name: 'Data Analysis', categoryId: 1, importance: 4, requiredLevel: 4.5 };
    expect(CompetencyInput.parse(ok).skillAreas).toEqual([]);
    expect(CompetencyInput.safeParse({ ...ok, requiredLevel: 5.5 }).success).toBe(false);
    expect(CompetencyInput.safeParse({ ...ok, importance: 0 }).success).toBe(false);
    expect(codeFrom('Leadership & Management')).toBe('leadership-management');
  });
  it('department codes are upper-cased', () => {
    expect(DepartmentInput.parse({ code: 'fin', name: 'Finance' }).code).toBe('FIN');
  });
});

// ===== TEST · Scope =====
describe('department scope', () => {
  it('everyone-scope may use any department; others only their own list', () => {
    expect(deptInScope({ visibleDepartmentIds: null }, 4)).toBe(true);
    expect(deptInScope({ visibleDepartmentIds: null }, null)).toBe(true);
    expect(deptInScope({ visibleDepartmentIds: [1] }, 1)).toBe(true);
    expect(deptInScope({ visibleDepartmentIds: [1] }, 2)).toBe(false);
    expect(deptInScope({ visibleDepartmentIds: [1] }, null)).toBe(false);
  });
  it('builds search filters from the query string', () => {
    expect(staffFilter({ departmentId: '2', status: 'LEFT', supervisorId: 'none' })).toEqual([{ departmentId: 2 }, { supervisorId: null }, { status: 'LEFT' }]);
    expect(staffFilter({ status: 'WHATEVER', gradeId: 'abc' })).toEqual([]);
  });
});

// ===== TEST · Placement moves =====
// A fake transaction that records the calls.
function fakeTx(open) {
  const calls = [];
  return { calls, staffPlacementHistory: {
    findMany: async () => open, updateMany: async a => { calls.push(['close', a]); return { count: open.length }; },
    create: async a => { calls.push(['create', a.data]); return a.data; } } };
}
describe('placement moves', () => {
  it('only a department or station change counts as a move', () => {
    const b = { departmentId: 1, stationId: 2 };
    expect(placementChanged(b, { departmentId: 1, stationId: 2 })).toBe(false);
    expect(placementChanged(b, { designation: 'x' })).toBe(false);
    expect(placementChanged(b, { departmentId: 3 })).toBe(true);
    expect(placementChanged(b, { stationId: null })).toBe(true);
  });
  it('closes the open row and opens a new one', async () => {
    const tx = fakeTx([{ id: 9 }]), at = new Date('2026-10-01');
    await movePlacement(tx, { staff: { id: 5, departmentId: 1, stationId: 2 }, departmentId: 3, stationId: 2, actorId: 1, reason: 'Transfer', at });
    expect(tx.calls[0][0]).toBe('close');
    expect(tx.calls[0][1].data.toDate).toBe(at);
    expect(tx.calls[1]).toEqual(['create', { staffId: 5, departmentId: 3, stationId: 2, fromDate: at, reason: 'Transfer', changedById: 1 }]);
  });
  it('keeps the old placement when there was no history yet', async () => {
    const tx = fakeTx([]), at = new Date('2026-10-01'), created = new Date('2025-01-01');
    await movePlacement(tx, { staff: { id: 5, departmentId: 1, stationId: 2, createdAt: created }, departmentId: 3, stationId: 4, actorId: 1, at });
    expect(tx.calls[0][1]).toMatchObject({ departmentId: 1, stationId: 2, fromDate: created, toDate: at });
    expect(tx.calls[1][1]).toMatchObject({ departmentId: 3, stationId: 4, fromDate: at });
  });
});

// ===== TEST · Bulk import =====
const LOOK = {
  departments: [{ id: 1, code: 'IT', name: 'IT Department', active: true }, { id: 2, code: 'HR', name: 'Human Resources', active: true }, { id: 3, code: 'OLD', name: 'Old Unit', active: false }],
  grades: [{ id: 1, name: 'Assistant Officer', active: true }],
  stations: [{ id: 1, name: 'Head Office', active: true, location: { name: 'Accra' } }, { id: 2, name: 'Main', active: true, location: { name: 'Tema' } }, { id: 3, name: 'Main', active: true, location: { name: 'Ho' } }],
  existingStaff: [{ id: 50, staffNo: 'DEMO-0001', email: 'joseph@dvla.gov.gh' }], allowedDeptIds: null,
};
const HEAD = IMPORT_COLUMNS.map(c => c[1]);
const row = o => IMPORT_COLUMNS.map(([k]) => o[k] || '');
describe('bulk staff import', () => {
  it('reads the template headings and alternative spellings', () => {
    expect(mapHeaders(HEAD).missing).toEqual([]);
    expect(mapHeaders(['Surname', 'Staff No', 'First Name']).map).toMatchObject({ lastName: 0, staffNo: 1, firstName: 2 });
    expect(mapHeaders(['Name']).missing).toEqual(['Staff ID', 'First name', 'Last name']);
  });
  it('accepts good rows and resolves names to ids, including a supervisor further down the file', () => {
    const r = validateImport([HEAD,
      row({ staffNo: 'N1', firstName: 'Ama', lastName: 'Mensah', department: 'it', grade: 'assistant officer', station: 'Head Office', supervisorNo: 'N2' }),
      row({ staffNo: 'N2', firstName: 'Kofi', lastName: 'Ofori', department: 'Human Resources', station: 'Main (Tema)', supervisorNo: 'DEMO-0001', status: 'inactive' })], LOOK);
    expect(r.fileErrors).toEqual([]);
    expect(r.rows.map(x => x.errors)).toEqual([[], []]);
    expect(r.rows[0].data).toMatchObject({ departmentId: 1, gradeId: 1, stationId: 1, supervisorNo: 'N2' });
    expect(r.rows[1].data).toMatchObject({ departmentId: 2, stationId: 2, supervisorId: 50, status: 'INACTIVE' });
  });
  it('reports every problem row by row', () => {
    const r = validateImport([HEAD,
      row({ staffNo: 'DEMO-0001', firstName: 'A', lastName: 'B' }),
      row({ staffNo: 'N3', firstName: 'C', lastName: 'D', email: 'joseph@dvla.gov.gh', department: 'Finance' }),
      row({ staffNo: 'N3', firstName: '', lastName: 'F', department: 'Old Unit', station: 'Main', supervisorNo: 'ZZZ' }),
      row({}),
    ], LOOK);
    expect(r.rows).toHaveLength(3); // blank row skipped
    expect(r.rows[0].errors.join()).toMatch(/already exists/);
    expect(r.rows[1].errors.join()).toMatch(/already belongs to Staff ID DEMO-0001/);
    expect(r.rows[1].errors.join()).toMatch(/Department "Finance" was not found/);
    const third = r.rows[2].errors.join(' | ');
    expect(third).toMatch(/also on row 3/);
    expect(third).toMatch(/First name/);
    expect(third).toMatch(/no longer active/);
    expect(third).toMatch(/more than one location/);
    expect(third).toMatch(/Supervisor Staff ID ZZZ was not found/);
    expect(r.rows[2].row).toBe(4);
  });
  it('keeps a scoped importer inside their departments', () => {
    const r = validateImport([HEAD, row({ staffNo: 'N9', firstName: 'A', lastName: 'B', department: 'HR' }), row({ staffNo: 'N8', firstName: 'A', lastName: 'B' })], { ...LOOK, allowedDeptIds: [1] });
    expect(r.rows[0].errors).toEqual(['You can only add staff to departments you can see.']);
    expect(r.rows[1].errors).toEqual(['You can only add staff to departments you can see.']);
  });
  it('refuses a file without headings or rows', () => {
    expect(validateImport([['a', 'b']], LOOK).fileErrors[0]).toMatch(/Missing: Staff ID/);
    expect(validateImport([HEAD], LOOK).fileErrors[0]).toMatch(/no staff rows/);
  });
});

// ===== TEST · Structure =====
describe('structure', () => {
  it('in use when anything points at it', () => {
    expect(inUse({ staff: 0, assignments: 0 })).toBe(false);
    expect(inUse({ staff: 2, assignments: 0 })).toBe(true);
    expect(inUseText({ staff: 2, assignments: 1, competencies: 0 })).toBe('2 staff records, 1 assessment assignments');
  });
  it('grade re-order must list every grade once', () => {
    expect(rankPlan([1, 2, 3], [3, 1, 2])).toEqual([{ id: 3, rank: 0 }, { id: 1, rank: 1 }, { id: 2, rank: 2 }]);
    expect(rankPlan([1, 2, 3], [3, 1])).toBeNull();
    expect(rankPlan([1, 2, 3], [3, 1, 1])).toBeNull();
  });
});

// ===== TEST · Supervisors =====
describe('supervisor links', () => {
  it('spots loops', () => {
    const chain = new Map([[2, 1], [3, 2]]); // 1 supervises 2, 2 supervises 3
    expect(createsLoop(1, 3, chain)).toBe(true);
    expect(createsLoop(4, 3, chain)).toBe(false);
    expect(createsLoop(5, 5, chain)).toBe(true);
  });
});

// ===== TEST · Friendly errors =====
describe('duplicate messages', () => {
  it('turns unique-constraint errors into plain English', () => {
    expect(duplicateMessage({ code: 'P2002', meta: { target: ['staffNo'] } })).toBe('That Staff ID is already in use.');
    expect(duplicateMessage({ code: 'P2002', meta: { target: ['name'] } }, 'department')).toBe('A department with that name already exists.');
    expect(duplicateMessage({ code: 'P2025' })).toBeNull();
  });
});
