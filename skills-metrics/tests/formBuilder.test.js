// =============================================================================
// formBuilder.test.js · Tests for the Form Builder canvas model (lib/formBuilder.js), the server's question
//   re-ordering rule (lib/server/content.js arrangePlan) and the planned audience: its checks and the assignments
//   made when a version is published (lib/server/audience.js), with an in-memory stand-in for the database
// Run: npm test
// Sections (search for these markers): TEST · Canvas & sections, TEST · Moves, TEST · What to save,
//   TEST · Arranging questions, TEST · Planned audience checks, TEST · Assigning on publish
// =============================================================================
import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));
const { itemsFromQuestions, areaAt, moveTo, step, layoutOf, layoutChanged, payloadOf, problemsOf, blankQuestion, isDirty } = await import('../lib/formBuilder.js');
const { arrangePlan, audienceProblems } = await import('../lib/server/content.js');
const { assignPlannedAudience } = await import('../lib/server/audience.js');

const q = (id, skillArea, extra = {}) => ({ id, order: id, type: 'SINGLE_CHOICE', text: 'Question ' + id, skillArea, points: 1, options: [{ text: 'A', isCorrect: true }, { text: 'B', isCorrect: false }], competencies: [{ competencyId: 1, weight: 1 }], ...extra });
const kinds = items => items.map(it => (it.kind === 'section' ? 'S:' + it.title : 'Q' + it.id)).join(' ');

// ===== TEST · Canvas & sections =====
describe('canvas from saved questions', () => {
  it('starts a section card wherever the skill area changes', () => {
    const items = itemsFromQuestions([q(1, null), q(2, 'Service'), q(3, 'Service'), q(4, 'Safety'), q(5, null)]);
    expect(kinds(items)).toBe('Q1 S:Service Q2 Q3 S:Safety Q4 S: Q5');
  });
  it('gives every question the title of the section above it', () => {
    const items = itemsFromQuestions([q(1, 'Service'), q(2, 'Service'), q(3, 'Safety')]);
    expect(items.map((it, i) => (it.kind === 'question' ? areaAt(items, i) : null)).filter(x => x !== null)).toEqual(['Service', 'Service', 'Safety']);
  });
  it('round-trips: the layout of an untouched canvas matches what is stored', () => {
    const stored = [q(1, null), q(2, 'Service'), q(3, 'Service'), q(4, null)];
    expect(layoutChanged(itemsFromQuestions(stored), stored)).toBe(false);
  });
});

// ===== TEST · Moves =====
describe('drag and drop', () => {
  const items = itemsFromQuestions([q(1, 'A'), q(2, 'A'), q(3, 'B'), q(4, 'B')]);
  it('moves a question into another section, which changes its skill area', () => {
    const moved = moveTo(items, 1, 6); // Q1 (index 1) to the end, under section B
    expect(kinds(moved)).toBe('S:A Q2 S:B Q3 Q4 Q1');
    expect(layoutOf(moved)).toEqual([{ id: 2, skillArea: 'A' }, { id: 3, skillArea: 'B' }, { id: 4, skillArea: 'B' }, { id: 1, skillArea: 'B' }]);
  });
  it('carries a section card\'s questions with it', () => {
    expect(kinds(moveTo(items, 3, 0))).toBe('S:B Q3 Q4 S:A Q1 Q2');
  });
  it('ignores a drop onto itself', () => {
    expect(moveTo(items, 1, 1)).toBe(items);
    expect(moveTo(items, 1, 2)).toBe(items);
  });
  it('moves blocks and questions with the up / down buttons', () => {
    expect(kinds(step(items, 3, -1))).toBe('S:B Q3 Q4 S:A Q1 Q2');
    expect(kinds(step(items, 0, 1))).toBe('S:B Q3 Q4 S:A Q1 Q2');
    expect(kinds(step(items, 2, 1))).toBe('S:A Q1 S:B Q2 Q3 Q4');
    expect(step(items, 0, -1)).toEqual(items);
  });
  it('deleting a section card puts its questions in the section above', () => {
    const without = items.filter(it => !(it.kind === 'section' && it.title === 'B'));
    expect(layoutOf(without).map(x => x.skillArea)).toEqual(['A', 'A', 'A', 'A']);
  });
});

// ===== TEST · What to save =====
describe('what is saved', () => {
  const comps = new Map([[1, { id: 1, name: 'Service', active: true }]]);
  it('a new question is not saved until it is complete', () => {
    const fresh = { key: 'n', kind: 'question', id: null, q: blankQuestion('SINGLE_CHOICE', [{ competencyId: 1, weight: 1 }]), saved: null };
    expect(isDirty(fresh)).toBe(true);
    expect(problemsOf(payloadOf([fresh], 0), comps)).toContain('Mark the correct answer.');
    const done = { ...fresh, q: { ...fresh.q, options: fresh.q.options.map((o, i) => ({ ...o, isCorrect: i === 0 })) } };
    expect(problemsOf(payloadOf([done], 0), comps)).toEqual([]);
  });
  it('true / false and open text start in the stored shape', () => {
    expect(blankQuestion('TRUE_FALSE').options.map(o => o.text)).toEqual(['True', 'False']);
    expect(blankQuestion('TEXT').options).toEqual([]);
    expect(blankQuestion('MULTIPLE_CHOICE').type).toBe('MULTIPLE_CHOICE');
  });
  it('sends the section title as the skill area', () => {
    const items = itemsFromQuestions([q(1, 'Front desk')]);
    expect(payloadOf(items, 1).skillArea).toBe('Front desk');
  });
});

// ===== TEST · Arranging questions =====
describe('arranging questions on the server', () => {
  const current = [{ id: 10, order: 1, skillArea: null }, { id: 11, order: 2, skillArea: 'A' }, { id: 12, order: 3, skillArea: 'A' }];
  it('changes only what moved', () => {
    expect(arrangePlan(current, [{ id: 10, skillArea: null }, { id: 12, skillArea: 'A' }, { id: 11, skillArea: 'A' }]).changes).toEqual([{ id: 12, order: 2, skillArea: 'A' }, { id: 11, order: 3, skillArea: 'A' }]);
    expect(arrangePlan(current, [{ id: 10, skillArea: '' }, { id: 11, skillArea: 'A' }, { id: 12, skillArea: ' B ' }]).changes).toEqual([{ id: 12, order: 3, skillArea: 'B' }]);
    expect(arrangePlan(current, current).changes).toEqual([]);
  });
  it('refuses a list that does not match the version exactly', () => {
    expect(arrangePlan(current, [{ id: 10 }, { id: 11 }]).error).toMatch(/changed/);
    expect(arrangePlan(current, [{ id: 10 }, { id: 11 }, { id: 11 }]).error).toMatch(/changed/);
    expect(arrangePlan(current, [{ id: 10 }, { id: 11 }, { id: 99 }]).error).toMatch(/changed/);
    expect(arrangePlan(current, [{ id: 10 }, { id: 11 }, { id: 12, skillArea: 'x'.repeat(200) }]).error).toMatch(/too long/);
  });
});

// ===== TEST · Planned audience checks =====
const NOW = new Date('2026-10-20T10:00:00Z');
const plan = (o = {}) => ({ targetType: 'DEPARTMENT', targetIds: [1, 2], startsAt: '2026-10-21T00:00:00Z', deadline: '2026-11-04T23:59:00Z', ...o });
describe('planned audience checks', () => {
  it('accepts a complete plan', () => { expect(audienceProblems(plan(), NOW)).toEqual([]); });
  it('needs a target, at least one choice and sensible dates', () => {
    expect(audienceProblems(plan({ targetType: 'TEAM' }), NOW)[0]).toMatch(/Choose who/);
    expect(audienceProblems(plan({ targetIds: [] }), NOW)[0]).toMatch(/at least one department/);
    expect(audienceProblems(plan({ deadline: '2026-10-20T00:00:00Z', startsAt: '2026-10-19T00:00:00Z' }), NOW)[0]).toMatch(/future/);
    expect(audienceProblems(plan({ deadline: '2026-10-21T00:00:00Z', startsAt: '2026-10-22T00:00:00Z' }), NOW)[0]).toMatch(/after the start/);
  });
});

// ===== TEST · Assigning on publish =====
// An in-memory stand-in with just the tables assignPlannedAudience touches.
function fakeDb({ departments = [], existing = [], staff = [], accounts = [] } = {}) {
  const made = [], notes = [], audits = [], updates = [];
  const tx = {
    department: { findUnique: async ({ where }) => departments.find(d => d.id === where.id) || null },
    assessmentAssignment: {
      findMany: async () => existing,
      create: async ({ data }) => { const a = { id: 100 + made.length, ...data }; made.push(a); return a; },
    },
    staffRecord: { findMany: async ({ where }) => staff.filter(s => s.departmentId === where.departmentId) },
    account: { findMany: async ({ where }) => accounts.filter(a => where.staffId.in.includes(a.staffId)) },
    notificationTemplate: { findUnique: async () => ({ title: 'New assessment: {title}', body: 'Due {deadline}' }) },
    notification: { findUnique: async () => null, create: async ({ data }) => { notes.push(data); return data; } },
    auditLog: { create: async ({ data }) => { audits.push(data); return data; } },
    assessment: { update: async a => { updates.push(a); return a; } },
  };
  return { tx, made, notes, audits, updates };
}
const admin = { account: { id: 1, staffId: null }, user: { perms: ['forms.publish', 'cycles.assign'] }, visibleDepartmentIds: null };
const supervisor = { account: { id: 2, staffId: null }, user: { perms: ['cycles.assign'] }, visibleDepartmentIds: [1] };
const staffAcct = (id, staffId) => ({ id, staffId, roles: [{ role: 'STAFF' }], permissions: [] });
describe('assigning the planned audience on publish', () => {
  const depts = [{ id: 1, name: 'IT', active: true }, { id: 2, name: 'HR', active: true }];
  const people = [{ id: 7, departmentId: 1 }, { id: 8, departmentId: 2 }];
  it('makes one assignment per target, tells the staff and marks the plan done', async () => {
    const f = fakeDb({ departments: depts, staff: people, accounts: [staffAcct(70, 7), staffAcct(80, 8)] });
    const r = await assignPlannedAudience(f.tx, admin, { id: 5, title: 'Front desk', plannedAssignment: plan() }, null, NOW);
    expect(f.made.map(a => [a.assessmentId, a.targetType, a.departmentId])).toEqual([[5, 'DEPARTMENT', 1], [5, 'DEPARTMENT', 2]]);
    expect(r.created).toHaveLength(2);
    expect(r.covered).toBe(2);
    expect(f.notes.map(n => n.accountId).sort()).toEqual([70, 80]);
    expect(f.updates[0].data.plannedAssignment.done.assignmentIds).toEqual(r.created);
  });
  it('does nothing when there is no plan or it was used already', async () => {
    const f = fakeDb({ departments: depts });
    expect(await assignPlannedAudience(f.tx, admin, { id: 5, title: 'X', plannedAssignment: null }, null, NOW)).toBeNull();
    expect(await assignPlannedAudience(f.tx, admin, { id: 5, title: 'X', plannedAssignment: plan({ done: { at: NOW } }) }, null, NOW)).toBeNull();
    expect(f.made).toHaveLength(0);
  });
  it('uses the publisher\'s scope and skips (never fails on) targets they may not use or already assigned', async () => {
    const f = fakeDb({ departments: depts, staff: people, existing: [], accounts: [] });
    const r = await assignPlannedAudience(f.tx, supervisor, { id: 5, title: 'X', plannedAssignment: plan() }, null, NOW);
    expect(f.made.map(a => a.departmentId)).toEqual([1]);
    expect(r.skipped[0]).toMatch(/only assign to departments you manage/);
    const g = fakeDb({ departments: depts, existing: [{ departmentId: 1 }], staff: people });
    const r2 = await assignPlannedAudience(g.tx, admin, { id: 5, title: 'X', plannedAssignment: plan() }, null, NOW);
    expect(g.made.map(a => a.departmentId)).toEqual([2]);
    expect(r2.skipped[0]).toMatch(/Already assigned/);
  });
  it('assigns nothing once the planned deadline has passed, and says so', async () => {
    const f = fakeDb({ departments: depts });
    const r = await assignPlannedAudience(f.tx, admin, { id: 5, title: 'X', plannedAssignment: plan({ deadline: '2026-10-19T00:00:00Z', startsAt: '2026-10-01T00:00:00Z' }) }, null, NOW);
    expect(f.made).toHaveLength(0);
    expect(r.skipped[0]).toMatch(/Nothing was assigned/);
    expect(f.updates[0].data.plannedAssignment.done).toBeTruthy();
  });
  it('skips an inactive department', async () => {
    const f = fakeDb({ departments: [{ id: 1, name: 'IT', active: false }, { id: 2, name: 'HR', active: true }], staff: people });
    const r = await assignPlannedAudience(f.tx, admin, { id: 5, title: 'X', plannedAssignment: plan() }, null, NOW);
    expect(f.made.map(a => a.departmentId)).toEqual([2]);
    expect(r.skipped[0]).toMatch(/IT is inactive/);
  });
});
