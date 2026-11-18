// =============================================================================
// assignments.test.js · Tests for the Assignments rules (app/api/assignments/rules.js) and the shared progress
//   helpers they rely on (lib/server/assigned.js deadlineFor / progressStatus, no database needed)
// Run: npm test
// Sections (search for these markers): TEST · Targets & scope, TEST · Dates & extensions, TEST · Overlapping assignments,
//   TEST · Progress counts, TEST · Assignment state, TEST · Reminders, TEST · Filtering & paging
// =============================================================================
import { describe, it, expect, vi } from 'vitest';

// assigned.js is server-only and imports the database client; neither is needed for its pure helpers.
vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));
const { deadlineFor, progressStatus } = await import('../lib/server/assigned.js');
const { targetAllowed, targetIdOf, checkDates, checkExtension, limitOf, mergeEntry, summarize, latestDeadline, assignmentState, reminderKind, reminderDedupe, filterPeople, pageOf, isZeroProgress } = await import('../app/api/assignments/rules.js');

const D = s => new Date(s);
const NOW = D('2026-10-19T12:00:00Z');

// ===== TEST · Targets & scope =====
describe('targets and scope', () => {
  it('everything is allowed with every department in scope', () => {
    for (const t of ['INDIVIDUAL', 'DEPARTMENT', 'GRADE', 'STATION', 'LOCATION']) expect(targetAllowed(null, t, 9)).toBe(true);
  });
  it('a supervisor may only assign to departments in their scope', () => {
    expect(targetAllowed([1], 'DEPARTMENT', 1)).toBe(true);
    expect(targetAllowed([1], 'DEPARTMENT', 2)).toBe(false);
  });
  it('grade, station and location reach across departments, so scoped users may not use them', () => {
    expect(targetAllowed([1, 2], 'GRADE', 1)).toBe(false);
    expect(targetAllowed([1, 2], 'STATION', 1)).toBe(false);
    expect(targetAllowed([1, 2], 'LOCATION', 1)).toBe(false);
    // Station manager may assign to their own station target
    expect(targetAllowed([1, 2], 'STATION', 5, 5)).toBe(true);
    expect(targetAllowed([1, 2], 'STATION', 6, 5)).toBe(false);
  });
  it('reads the target id from the right column', () => {
    expect(targetIdOf({ targetType: 'GRADE', gradeId: 4, departmentId: 1 })).toBe(4);
    expect(targetIdOf({ targetType: 'INDIVIDUAL', staffId: 7 })).toBe(7);
  });
});

// ===== TEST · Dates & extensions =====
describe('dates and extensions', () => {
  it('the deadline must come after the start', () => {
    expect(checkDates('2026-11-01', '2026-11-02')).toBeNull();
    expect(checkDates('2026-11-02', '2026-11-02')).toMatch(/after the start/);
    expect(checkDates('nonsense', '2026-11-02')).toMatch(/valid/);
  });
  it('an extension must be later than the current deadline and in the future', () => {
    expect(checkExtension('2026-11-02', '2026-11-10', NOW)).toBeNull();
    expect(checkExtension('2026-11-02', '2026-11-01', NOW)).toMatch(/later than the current/);
    expect(checkExtension('2026-10-01', '2026-10-10', NOW)).toMatch(/in the future/);
  });
  const a = { deadline: '2026-11-02T00:00:00Z', extensions: [
    { staffId: 3, newDeadline: '2026-12-15T00:00:00Z' },
    { staffId: null, newDeadline: '2026-11-20T00:00:00Z' },
    { staffId: 4, newDeadline: '2026-11-10T00:00:00Z' } ] };
  it('a personal extension moves only that person, a whole-assignment one moves everyone, the latest wins', () => {
    expect(deadlineFor(a, 3).toISOString()).toBe('2026-12-15T00:00:00.000Z');
    expect(deadlineFor(a, 4).toISOString()).toBe('2026-11-20T00:00:00.000Z'); // whole-assignment beats their earlier one
    expect(deadlineFor(a, 9).toISOString()).toBe('2026-11-20T00:00:00.000Z');
    expect(latestDeadline(a).toISOString()).toBe('2026-12-15T00:00:00.000Z');
  });
  it('attempt limit: assignment override, else the assessment, else 3', () => {
    expect(limitOf({ maxAttempts: 5, assessment: { maxAttempts: 3 } })).toBe(5);
    expect(limitOf({ maxAttempts: null, assessment: { maxAttempts: 2 } })).toBe(2);
    expect(limitOf({})).toBe(3);
  });
});

// ===== TEST · Overlapping assignments =====
describe('overlapping assignments give one entry per person', () => {
  const e = mergeEntry([
    { assignmentId: 1, startsAt: '2026-09-21', deadline: '2026-11-02', maxAttempts: 3 },
    { assignmentId: 10, startsAt: '2026-10-19', deadline: '2026-11-30', maxAttempts: 4 },
    { assignmentId: 12, startsAt: '2026-09-01', deadline: '2026-11-15', maxAttempts: 2 }]);
  it('earliest start, latest deadline, highest limit', () => {
    expect(e.startsAt.toISOString().slice(0, 10)).toBe('2026-09-01');
    expect(e.deadline.toISOString().slice(0, 10)).toBe('2026-11-30');
    expect(e.maxAttempts).toBe(4);
    expect(e.assignmentIds).toEqual([1, 10, 12]);
    expect(e.deadlineAssignmentId).toBe(10);
  });
  it('nothing covering them = no entry', () => expect(mergeEntry([])).toBeNull());
});

// ===== TEST · Progress counts =====
describe('progress status and completion rate', () => {
  const entry = { startsAt: D('2026-10-01'), deadline: D('2026-10-25') };
  it('uses the shared status rules', () => {
    expect(progressStatus(entry, [], NOW)).toBe('NOT_STARTED');
    expect(progressStatus(entry, [{ status: 'IN_PROGRESS' }], NOW)).toBe('IN_PROGRESS');
    expect(progressStatus(entry, [{ status: 'ABANDONED' }, { status: 'COMPLETED' }], NOW)).toBe('COMPLETED');
    expect(progressStatus({ ...entry, startsAt: D('2026-10-20') }, [], NOW)).toBe('UPCOMING');
    expect(progressStatus({ ...entry, deadline: D('2026-10-18') }, [{ status: 'IN_PROGRESS' }], NOW)).toBe('OVERDUE');
  });
  it('completion rate leaves out people whose assessment has not opened', () => {
    const s = summarize(['COMPLETED', 'COMPLETED', 'NOT_STARTED', 'OVERDUE', 'UPCOMING']);
    expect(s.total).toBe(5); expect(s.open).toBe(4); expect(s.rate).toBe(0.5); expect(s.OVERDUE).toBe(1);
  });
  it('no one open yet = no rate (shown as a dash, never 0%)', () => {
    expect(summarize(['UPCOMING']).rate).toBeNull();
    expect(summarize([]).rate).toBeNull();
  });
});

// ===== TEST · Assignment state =====
describe('assignment state', () => {
  it('upcoming, open and closed, counting extensions', () => {
    expect(assignmentState({ startsAt: '2026-10-20', deadline: '2026-11-01' }, NOW)).toBe('UPCOMING');
    expect(assignmentState({ startsAt: '2026-10-01', deadline: '2026-11-01' }, NOW)).toBe('OPEN');
    expect(assignmentState({ startsAt: '2026-10-01', deadline: '2026-10-10' }, NOW)).toBe('CLOSED');
    expect(assignmentState({ startsAt: '2026-10-01', deadline: '2026-10-10', extensions: [{ staffId: 3, newDeadline: '2026-10-30' }] }, NOW)).toBe('OPEN');
  });
});

// ===== TEST · Reminders =====
describe('deadline reminders', () => {
  const e = (deadline, extra = {}) => ({ startsAt: D('2026-10-01'), deadline: D(deadline), maxAttempts: 3, ...extra });
  it('"closes soon" inside 48 hours when not completed', () => {
    expect(reminderKind(e('2026-10-20T12:00:00Z'), [], NOW)).toBe('soon');
    expect(reminderKind(e('2026-10-21T12:00:00Z'), [], NOW)).toBe('soon');
    expect(reminderKind(e('2026-10-21T12:00:01Z'), [], NOW)).toBeNull();
  });
  it('nothing once they have completed an attempt', () => {
    expect(reminderKind(e('2026-10-20T12:00:00Z'), [{ status: 'COMPLETED' }], NOW)).toBeNull();
    expect(reminderKind(e('2026-10-18T12:00:00Z'), [{ status: 'COMPLETED' }], NOW)).toBeNull();
  });
  it('no "closes soon" when every attempt is used and none is open', () => {
    const used = [{ status: 'ABANDONED' }, { status: 'EXPIRED' }, { status: 'ABANDONED' }];
    expect(reminderKind(e('2026-10-20T12:00:00Z'), used, NOW)).toBeNull();
    expect(reminderKind(e('2026-10-20T12:00:00Z'), [...used.slice(0, 2), { status: 'IN_PROGRESS' }], NOW)).toBe('soon');
  });
  it('"has closed" after the deadline, but not for deadlines long gone', () => {
    expect(reminderKind(e('2026-10-18T12:00:00Z'), [], NOW)).toBe('passed');
    expect(reminderKind(e('2026-09-01T12:00:00Z', { startsAt: D('2026-08-01') }), [], NOW)).toBeNull();
  });
  it('nothing before the assessment opens', () => {
    expect(reminderKind(e('2026-10-20T12:00:00Z', { startsAt: D('2026-10-19T18:00:00Z') }), [], NOW)).toBeNull();
  });
  it('one key per person, assignment and deadline: an extension can remind again', () => {
    const a = reminderDedupe('soon', 5, 3, '2026-10-20T12:00:00Z');
    expect(a).toBe(reminderDedupe('soon', 5, 3, D('2026-10-20T12:00:00Z')));
    expect(a).not.toBe(reminderDedupe('soon', 5, 3, '2026-10-22T12:00:00Z'));
    expect(a).not.toBe(reminderDedupe('passed', 5, 3, '2026-10-20T12:00:00Z'));
    expect(a).not.toBe(reminderDedupe('soon', 5, 4, '2026-10-20T12:00:00Z'));
  });
  it('identifies 0% progress for escalation alerts', () => {
    expect(isZeroProgress([])).toBe(true);
    expect(isZeroProgress([{ status: 'NOT_STARTED' }])).toBe(true);
    expect(isZeroProgress([{ status: 'IN_PROGRESS' }])).toBe(false);
    expect(isZeroProgress([{ status: 'COMPLETED' }])).toBe(false);
  });
});

// ===== TEST · Filtering & paging =====
describe('filtering and paging', () => {
  const rows = Array.from({ length: 53 }, (_, i) => ({ name: 'Person ' + i, staffNo: 'DEMO-' + String(i).padStart(4, '0'), department: i % 2 ? 'IT Department' : 'Human Resources', status: i % 3 ? 'COMPLETED' : 'OVERDUE' }));
  it('filters by status and by name, staff ID or department', () => {
    expect(filterPeople(rows, { status: 'OVERDUE' }).length).toBe(18);
    expect(filterPeople(rows, { q: 'demo-0052' }).length).toBe(1);
    expect(filterPeople(rows, { q: 'human', status: 'OVERDUE' }).every(r => r.department === 'Human Resources' && r.status === 'OVERDUE')).toBe(true);
  });
  it('pages, keeping the page inside range', () => {
    const p = pageOf(rows, 3, 25);
    expect(p.rows.length).toBe(3); expect(p.pages).toBe(3); expect(p.total).toBe(53);
    expect(pageOf(rows, 99, 25).page).toBe(3);
    expect(pageOf(rows, 'x', 'y').pageSize).toBe(25);
    expect(pageOf([], 1, 25)).toMatchObject({ page: 1, pages: 1, total: 0 });
  });
});
