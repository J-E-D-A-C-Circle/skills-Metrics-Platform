// =============================================================================
// reports.test.js · Tests for the pure parts of the Reports module (lib/server/reports.js, lib/server/exporters.js)
// Run: npm test
// Sections (search for these markers): TEST · Setup, TEST · Person results across assessments, TEST · Classification,
//   TEST · Group averages, TEST · Gap analysis & proficiency, TEST · Assignments & completion, TEST · Table helpers,
//   TEST · Filters, TEST · Exports
// No database: the server-only marker and the Prisma client are replaced with empty stand-ins.
// =============================================================================
import { describe, it, expect, vi } from 'vitest';
import * as XLSX from 'xlsx';

// ===== TEST · Setup =====
vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));
const R = await import('../lib/server/reports.js');
const X = await import('../lib/server/exporters.js');
const comps = new Map([[1, { id: 1, name: 'Planning', category: 'General' }], [2, { id: 2, name: 'Reporting', category: 'General' }]]);

// ===== TEST · Person results across assessments =====
describe('personCompetencyValues', () => {
  it('averages every completed attempt across assessments (weighted by attempts), not the assessment averages', () => {
    const v = R.personCompetencyValues([
      { staffId: 1, assessmentId: 10, competencyId: 1, average: 3, attemptsIncluded: 3 },
      { staffId: 1, assessmentId: 11, competencyId: 1, average: 5, attemptsIncluded: 1 },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].average).toBeCloseTo(3.5, 10);
    expect(v[0].attemptsIncluded).toBe(4);
  });
  it('keeps people and competencies apart and skips rows with no completed attempts', () => {
    const v = R.personCompetencyValues([
      { staffId: 1, assessmentId: 10, competencyId: 1, average: 4, attemptsIncluded: 1 },
      { staffId: 2, assessmentId: 10, competencyId: 1, average: 2, attemptsIncluded: 2 },
      { staffId: 1, assessmentId: 10, competencyId: 2, average: 0, attemptsIncluded: 1 },
      { staffId: 3, assessmentId: 10, competencyId: 2, average: 4, attemptsIncluded: 0 },
    ]);
    expect(v).toHaveLength(3);
    expect(v.find(x => x.staffId === 1 && x.competencyId === 2).average).toBe(0); // a real 0 stays 0
  });
});

// ===== TEST · Classification =====
describe('classify', () => {
  it('a missing result is null (Not assessed), never 0', () => {
    expect(R.classify(null)).toMatchObject({ average: null, competency: null, gapStatus: null, gap: null });
  });
  it.each([
    [4, 4, 'Competent', 'Moderate Gap', 1],
    [5, 5, 'Proficient', 'No Gap', 0],
    [2.49, 2.49, 'Not Competent', 'Critical Gap', 2.51],
    [2.5, 2.5, 'Not Competent', 'Moderate Gap', 2.5],
    [13 / 3, 4.33, 'Competent', 'Moderate Gap', 0.67],
  ])('%s -> %s, %s, %s', (avg, shown, comp, gap, g) => {
    const k = R.classify(avg);
    expect(k.average).toBe(shown); expect(k.competency).toBe(comp); expect(k.gapStatus).toBe(gap); expect(k.gap).toBe(g);
  });
  it('classifies the unrounded value: 4.996 shows 5.00 but is Competent with a Moderate Gap', () => {
    const k = R.classify(4.996);
    expect(k.average).toBe(5); expect(k.competency).toBe('Competent'); expect(k.gapStatus).toBe('Moderate Gap');
  });
  it('uses the configured thresholds', () => {
    expect(R.classify(3.6, { ...R.toConfig(null), competentFrom: 3.5 }).competency).toBe('Competent');
  });
});

// ===== TEST · Group averages =====
describe('groupPerformance', () => {
  const values = [
    { staffId: 1, competencyId: 1, average: 3 }, { staffId: 2, competencyId: 1, average: 5 },
    { staffId: 3, competencyId: 1, average: 2 }, { staffId: 1, competencyId: 2, average: 4 },
  ];
  const dept = { 1: 'IT', 2: 'IT', 3: 'HR' };
  const rows = R.groupPerformance(values, id => ({ key: dept[id], cells: { department: dept[id] } }), comps);
  it('group average = mean of the people\'s final averages for that competency', () => {
    const it1 = rows.find(r => r.department === 'IT' && r.competency === 'Planning');
    expect(it1.average).toBe(4); expect(it1.assessed).toBe(2); expect(it1.gap).toBe(1);
    expect(it1.proficient).toBe(1); expect(it1.notCompetent).toBe(1); expect(it1.moderate).toBe(1); expect(it1.noGap).toBe(1);
    expect(it1.proficientPct).toBe(50);
  });
  it('one row per group and competency', () => {
    expect(rows).toHaveLength(3);
    expect(rows.find(r => r.department === 'HR').critical).toBe(1);
  });
  it('people outside every group are left out', () => {
    expect(R.groupPerformance(values, id => (id === 3 ? null : { key: 'x', cells: {} }), comps).reduce((a, r) => a + r.assessed, 0)).toBe(3);
  });
});

// ===== TEST · Gap analysis & proficiency =====
describe('gap analysis and proficiency', () => {
  it('ranks competencies by Critical Gaps, then Moderate, then lowest average', () => {
    const rows = R.gapAnalysis([
      { staffId: 1, competencyId: 1, average: 4 }, { staffId: 2, competencyId: 1, average: 4.5 },
      { staffId: 1, competencyId: 2, average: 1 }, { staffId: 2, competencyId: 2, average: 5 },
    ], comps);
    expect(rows.map(r => r.competency)).toEqual(['Reporting', 'Planning']);
    expect(rows[0]).toMatchObject({ priority: 1, critical: 1, noGap: 1, withGapPct: 50 });
  });
  it('proficiency attainment: all Proficient = attained; nobody assessed = Not assessed (not a failure)', () => {
    expect(R.proficiencyRow([{ average: 5 }, { average: 5 }])).toMatchObject({ assessed: 2, proficient: 2, attained: 'Yes', proficientPct: 100 });
    expect(R.proficiencyRow([{ average: 5 }, { average: 4.99 }])).toMatchObject({ proficient: 1, competent: 1, attained: 'No' });
    expect(R.proficiencyRow([])).toMatchObject({ assessed: 0, attained: 'Not assessed', proficientPct: null });
  });
});

// ===== TEST · Assignments & completion =====
describe('assignments and completion', () => {
  const staff = { id: 7, status: 'ACTIVE', departmentId: 1, gradeId: 2, stationId: 3, station: { locationId: 4 } };
  const a = (id, extra) => ({ id, assessmentId: 100, assessment: { title: 'A', maxAttempts: 3 }, startsAt: '2026-10-01', deadline: '2026-10-20', maxAttempts: null, extensions: [], ...extra });
  it('covers by person, department, grade, station and location; never inactive staff', () => {
    expect(R.coversStaff(a(1, { targetType: 'LOCATION', locationId: 4 }), staff)).toBe(true);
    expect(R.coversStaff(a(1, { targetType: 'DEPARTMENT', departmentId: 2 }), staff)).toBe(false);
    expect(R.coversStaff(a(1, { targetType: 'INDIVIDUAL', staffId: 7 }), { ...staff, status: 'LEFT' })).toBe(false);
  });
  it('several assignments of one assessment merge into one entry (earliest start, latest deadline with extensions, highest limit)', () => {
    const e = R.entriesFor([
      a(1, { targetType: 'DEPARTMENT', departmentId: 1, startsAt: '2026-10-05' }),
      a(2, { targetType: 'GRADE', gradeId: 2, startsAt: '2026-10-02', maxAttempts: 5, extensions: [{ staffId: 7, newDeadline: '2026-11-01' }, { staffId: 8, newDeadline: '2026-12-01' }] }),
    ], staff);
    expect(e).toHaveLength(1);
    expect(e[0].startsAt.toISOString().slice(0, 10)).toBe('2026-10-02');
    expect(e[0].deadline.toISOString().slice(0, 10)).toBe('2026-11-01');
    expect(e[0].maxAttempts).toBe(5);
  });
  it('completion rate = completed / assigned and already open (upcoming not counted)', () => {
    const now = new Date('2026-10-19');
    const s = R.completionSummary([
      { statusCode: 'COMPLETED', startsAt: '2026-10-01' }, { statusCode: 'OVERDUE', startsAt: '2026-10-01' },
      { statusCode: 'NOT_STARTED', startsAt: '2026-10-01' }, { statusCode: 'UPCOMING', startsAt: '2026-11-01' },
    ], now);
    expect(s).toMatchObject({ assignedOpen: 3, completed: 1, notCompleted: 2, overdue: 1, upcoming: 1, rate: 33.3 });
    expect(R.completionSummary([], now).rate).toBe(null);
  });
});

// ===== TEST · Table helpers =====
describe('table helpers', () => {
  const cols = [R.col('name', 'Name'), R.col('average', 'Final average', 'avg', { empty: 'Not assessed' }), R.col('pct', 'Pct', 'pct'), R.col('when', 'When', 'date')];
  const rows = [{ name: 'Bea', average: 4 }, { name: 'Ama', average: null }, { name: 'Cee', average: 2.5 }];
  it('cell text: 2 decimals, Not assessed for missing, percent and date', () => {
    expect(R.cellText(cols[1], 4)).toBe('4.00');
    expect(R.cellText(cols[1], null)).toBe('Not assessed');
    expect(R.cellText(cols[1], 0)).toBe('0.00');
    expect(R.cellText(cols[2], 33.3)).toBe('33.3%');
    expect(R.cellText(cols[3], '2026-10-19T10:00:00Z')).toBe('19 Oct 2026');
  });
  it('sorting keeps missing values last both ways', () => {
    expect(R.sortRows(rows, cols, 'average', 'asc').map(r => r.name)).toEqual(['Cee', 'Bea', 'Ama']);
    expect(R.sortRows(rows, cols, 'average', 'desc').map(r => r.name)).toEqual(['Bea', 'Cee', 'Ama']);
  });
  it('search looks at the shown text; paging clamps to the last page', () => {
    expect(R.searchRows(rows, cols, 'not assessed').map(r => r.name)).toEqual(['Ama']);
    expect(R.pageRows(rows, 9, 2)).toMatchObject({ page: 2, pages: 2, total: 3, rows: [{ name: 'Cee' }] });
  });
});

// ===== TEST · Filters =====
describe('parseFilters', () => {
  const def = R.reportDef('gaps');
  it('keeps the report\'s filters, drops the others and turns ids into numbers', () => {
    const f = R.parseFilters(def, new URLSearchParams('departmentId=2&status=CRITICAL&from=2026-01-01&staffId=4&q=%20'));
    expect(f).toEqual({ departmentId: 2, status: 'CRITICAL' });
  });
  it('refuses a status the report does not have, bad ids and back-to-front dates', () => {
    expect(() => R.parseFilters(def, new URLSearchParams('status=OVERDUE'))).toThrow();
    expect(() => R.parseFilters(def, new URLSearchParams('departmentId=abc'))).toThrow();
    expect(() => R.parseFilters(R.reportDef('completion'), new URLSearchParams('from=2026-05-01&to=2026-04-01'))).toThrow();
  });
  it('administration reports need their extra permission as well as reports.view', () => {
    const sup = { perms: ['reports.view', 'reports.export'] }, admin = { perms: ['reports.view', 'forms.view', 'forms.review', 'tickets.manage', 'org.view'] };
    ['content-approvals', 'creator-activity', 'tickets', 'org-changes'].forEach(k => { expect(R.mayRun(sup, R.reportDef(k))).toBe(false); expect(R.mayRun(admin, R.reportDef(k))).toBe(true); });
    expect(R.mayRun(sup, R.reportDef('department'))).toBe(true);
    expect(R.mayRun({ perms: ['assessments.view'] }, R.reportDef('department'))).toBe(false);
  });
  it('audit details list only the fields that changed', () => {
    expect(R.auditDetail({ dept: 'IT', grade: 'A' }, { dept: 'HR', grade: 'A' })).toBe('dept: IT → HR');
  });
});

// ===== TEST · Exports =====
describe('exporters', () => {
  const rep = {
    report: { key: 'gaps', title: 'Critical and Moderate Gaps', description: 'Test' },
    columns: [R.col('name', 'Name'), R.col('average', 'Final average', 'avg', { empty: 'Not assessed' }), R.col('n', 'Count', 'int'), R.col('p', 'Share', 'pct')],
    rows: [{ name: 'Ama Owusu', average: 4.33, n: 3, p: 50 }, { name: '=HYPERLINK("x")', average: null, n: 0, p: null }],
    total: 2, summary: [{ label: 'Critical Gaps', value: 1 }], notes: [], filtersUsed: [['Department', 'IT Department']],
    generatedAt: '2026-10-19T12:00:00.000Z', generatedBy: 'Test User (test)',
  };
  it('CSV: byte-order mark, 2-decimal averages, Not assessed, and formula cells neutralised', () => {
    const s = X.toCsv(rep).toString('utf8');
    expect(s.charCodeAt(0)).toBe(0xfeff);
    const lines = s.slice(1).trim().split('\r\n');
    expect(lines[0]).toBe('Name,Final average,Count,Share');
    expect(lines[1]).toBe('Ama Owusu,4.33,3,50.0%');
    expect(lines[2]).toBe('"\'=HYPERLINK(""x"")",Not assessed,0,—');
  });
  it('Excel: the table reads back with the same numbers and an About sheet', () => {
    const wb = XLSX.read(X.toXlsx(rep), { cellNF: true });
    expect(wb.SheetNames).toEqual(['Report', 'About this report']);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets.Report, { header: 1 });
    expect(rows[1]).toEqual(['Ama Owusu', 4.33, 3, 50]);
    expect(rows[2][1]).toBe('Not assessed');
    expect(wb.Sheets.Report.B2.z).toBe('0.00');
  });
  it('PDF: a real PDF document', async () => {
    const b = await X.toPdf(rep);
    expect(b.subarray(0, 5).toString()).toBe('%PDF-');
    expect(b.length).toBeGreaterThan(1000);
  });
  it('file names carry the report and date', () => {
    expect(X.fileName(rep, 'xlsx')).toBe('dvla-gaps-report-2026-10-19.xlsx');
  });
});
