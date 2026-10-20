// =============================================================================
// attempts.test.js · Tests for starting attempts and active page time (lib/server/results.js)
// Run: npm test
// Sections (search for these markers): TEST · Setup, TEST · Start rules, TEST · Active time slices
// =============================================================================
import { describe, it, expect, vi } from 'vitest';

// ===== TEST · Setup =====
vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));
const { startDecision, cleanSlices, subtractCovered, newPieces, MAX_SLICE_MS } = await import('../lib/server/results.js');

const DAY = 864e5, now = new Date('2026-10-19T12:00:00Z');
const entry = (o = {}) => ({ assessment: { status: 'PUBLISHED' }, startsAt: new Date(now - 10 * DAY), deadline: new Date(+now + 10 * DAY), maxAttempts: 3, ...o });
const tries = (...statuses) => statuses.map((status, i) => ({ id: 100 + i, attemptNo: i + 1, status }));

// ===== TEST · Start rules =====
describe('starting an attempt', () => {
  it('first start creates attempt 1', () => expect(startDecision({ entry: entry(), attempts: [], now })).toEqual({ action: 'create', attemptNo: 1 }));
  it('an attempt in progress is resumed, never duplicated', () => {
    const d = startDecision({ entry: entry(), attempts: tries('COMPLETED', 'IN_PROGRESS'), now });
    expect(d.action).toBe('resume');
    expect(d.attempt.id).toBe(101);
  });
  it('every started attempt uses one of the allowed attempts (abandoned and expired too)', () => {
    expect(startDecision({ entry: entry(), attempts: tries('COMPLETED', 'ABANDONED'), now })).toEqual({ action: 'create', attemptNo: 3 });
    expect(startDecision({ entry: entry(), attempts: tries('COMPLETED', 'EXPIRED', 'COMPLETED'), now })).toMatchObject({ action: 'refuse', code: 'LIMIT' });
  });
  it('a 4th start is refused when the limit is 3', () => {
    expect(startDecision({ entry: entry(), attempts: tries('COMPLETED', 'COMPLETED', 'COMPLETED'), now })).toMatchObject({ action: 'refuse', status: 409, code: 'LIMIT' });
  });
  it('a higher limit set on the assignment is respected', () => {
    expect(startDecision({ entry: entry({ maxAttempts: 4 }), attempts: tries('COMPLETED', 'COMPLETED', 'COMPLETED'), now })).toEqual({ action: 'create', attemptNo: 4 });
  });
  it('refuses when not assigned, not published, not open yet or past the deadline', () => {
    expect(startDecision({ entry: null, attempts: [], now })).toMatchObject({ action: 'refuse', status: 403, code: 'NOT_ASSIGNED' });
    expect(startDecision({ entry: entry({ assessment: { status: 'ARCHIVED' } }), attempts: [], now })).toMatchObject({ code: 'NOT_PUBLISHED' });
    expect(startDecision({ entry: entry({ startsAt: new Date(+now + DAY) }), attempts: [], now })).toMatchObject({ code: 'NOT_OPEN' });
    expect(startDecision({ entry: entry({ deadline: new Date(now - 1000) }), attempts: [], now })).toMatchObject({ code: 'PAST_DEADLINE' });
  });
  it('an extended deadline (already in entry.deadline) lets a new attempt start', () => {
    expect(startDecision({ entry: entry({ deadline: new Date(+now + 1000) }), attempts: [], now }).action).toBe('create');
  });
});

// ===== TEST · Active time slices =====
describe('active page time', () => {
  const t0 = 1_000_000, opts = { nowMs: t0 + 600e3, attemptStartMs: t0 };
  it('moves slices onto the server clock', () => {
    expect(cleanSlices([{ questionId: 1, start: t0 + 1000, end: t0 + 6000 }], { ...opts, offsetMs: 500 })).toEqual([{ questionId: 1, start: t0 + 1500, end: t0 + 6500 }]);
  });
  it('clamps absurd values: before the start, in the future, too long, backwards or tiny', () => {
    const r = cleanSlices([
      { questionId: 1, start: 0, end: t0 + 10e3 }, // starts before the attempt
      { questionId: 2, start: t0 + 300e3, end: t0 + 99e9 }, // ends in the future, very long
      { questionId: 3, start: t0 + 20e3, end: t0 + 10e3 }, // backwards
      { questionId: 4, start: t0 + 30e3, end: t0 + 30e3 + 50 }, // 50 ms
      { questionId: 5, start: NaN, end: t0 },
    ], opts);
    expect(r).toEqual([{ questionId: 1, start: t0, end: t0 + 10e3 }, { questionId: 2, start: opts.nowMs - MAX_SLICE_MS, end: opts.nowMs }]);
  });
  it('subtracts covered time', () => {
    expect(subtractCovered({ start: 0, end: 10e3 }, [{ start: 2e3, end: 4e3 }, { start: 8e3, end: 12e3 }])).toEqual([{ start: 0, end: 2e3 }, { start: 4e3, end: 8e3 }]);
    expect(subtractCovered({ start: 0, end: 10e3 }, [{ start: -1, end: 11e3 }])).toEqual([]);
  });
  it('two tabs open at the same time are never double counted', () => {
    const tabA = [{ questionId: 1, start: 0, end: 10e3 }], tabB = [{ questionId: 2, start: 5e3, end: 15e3 }];
    const storedA = newPieces(tabA, []);
    const storedB = newPieces(tabB, storedA);
    const total = [...storedA, ...storedB].reduce((s, p) => s + p.end - p.start, 0);
    expect(total).toBe(15e3);
    expect(storedB).toEqual([{ questionId: 2, start: 10e3, end: 15e3 }]);
  });
  it('sending the same slice twice (a retry) stores nothing new', () => {
    const s = [{ questionId: 1, start: 0, end: 10e3 }];
    expect(newPieces(s, newPieces(s, []))).toEqual([]);
  });
  it('overlapping slices inside one batch count once', () => {
    const p = newPieces([{ questionId: 1, start: 0, end: 10e3 }, { questionId: 1, start: 5e3, end: 12e3 }], []);
    expect(p.reduce((s, x) => s + x.end - x.start, 0)).toBe(12e3);
  });
});
