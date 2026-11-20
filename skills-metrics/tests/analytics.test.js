// =============================================================================
// analytics.test.js · Tests for the pure figures in lib/server/analytics.js (team, department and organisation)
// Run: npm test
// Sections (search for these markers): TEST · Person results across assessments, TEST · Group averages,
//   TEST · Completion & progress, TEST · Assignment cover, TEST · Filters & ranking
// No database: server-only and the Prisma client are replaced with empty stand-ins.
// =============================================================================
import { describe, it, expect, vi } from 'vitest';
vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));
import { personResults, resultCounts, competencyStats, groupSummary, completionStats, progressFor, overallStatus, entriesFor, coversStaff, matchesFilters, rankPriorities, sortPeople } from '../lib/server/analytics.js';

const fr = (competencyId, average, attemptsIncluded = 1, assessmentId = 1) => ({ competencyId, average, attemptsIncluded, assessmentId });

// ===== TEST · Person results across assessments =====
describe('person results', () => {
  it('uses the cached final average and classifies the unrounded value', () => {
    const r = personResults([fr(1, 4), fr(2, 3.999999), fr(3, 5), fr(4, 2.49)]);
    expect(r[1]).toMatchObject({ competencyStatus: 'COMPETENT', gapStatus: 'MODERATE', attemptsIncluded: 1 });
    expect(r[2]).toMatchObject({ competencyStatus: 'NOT_COMPETENT', gapStatus: 'MODERATE' });
    expect(r[3]).toMatchObject({ competencyStatus: 'PROFICIENT', gapStatus: 'NONE', gap: 0 });
    expect(r[4]).toMatchObject({ competencyStatus: 'NOT_COMPETENT', gapStatus: 'CRITICAL' });
  });
  it('combines assessments as the average of every completed attempt (weighted by attempts)', () => {
    // assessment 1: attempts 3, 5 (avg 4, 2 attempts); assessment 2: attempt 5 -> (3 + 5 + 5) / 3 = 4.33
    const r = personResults([fr(7, 4, 2, 1), fr(7, 5, 1, 2)]);
    expect(r[7].average).toBeCloseTo(13 / 3, 9);
    expect(r[7].attemptsIncluded).toBe(3);
    expect(r[7].assessments).toEqual([1, 2]);
  });
  it('a real 0 is a result; a missing competency is not', () => {
    const r = personResults([fr(1, 0)]);
    expect(r[1].average).toBe(0);
    expect(r[1].gapStatus).toBe('CRITICAL');
    expect(r[2]).toBeUndefined();
    expect(resultCounts({}).overall).toBeNull();
  });
  it('counts statuses and the overall average', () => {
    const c = resultCounts(personResults([fr(1, 5), fr(2, 4), fr(3, 2)]));
    expect(c).toMatchObject({ assessed: 3, critical: 1, moderate: 1, none: 1, notCompetent: 1, competent: 1, proficient: 1 });
    expect(c.overall).toBeCloseTo(11 / 3, 9);
  });
});

// ===== TEST · Group averages =====
describe('group averages', () => {
  const people = [
    { results: personResults([fr(1, 5), fr(2, 2)]) },
    { results: personResults([fr(1, 3)]) },
    { results: {} }, // not assessed: left out, never 0
  ];
  it('is the mean of the people’s final averages', () => {
    const s = competencyStats(people, 1);
    expect(s.assessed).toBe(2);
    expect(s.average).toBe(4);
    expect(s).toMatchObject({ none: 1, moderate: 1, critical: 0, proficient: 1, notCompetent: 1, competencyStatus: 'COMPETENT', gapStatus: 'MODERATE' });
  });
  it('a competency nobody took has no average', () => {
    expect(competencyStats(people, 9)).toMatchObject({ assessed: 0, average: null });
  });
  it('summarises the group', () => {
    const g = groupSummary(people);
    expect(g).toMatchObject({ people: 3, peopleAssessed: 2, peopleWithCritical: 1, peopleAllProficient: 0 });
    expect(g.results.overall).toBeCloseTo((5 + 2 + 3) / 3, 9);
  });
});

// ===== TEST · Completion & progress =====
describe('completion and progress', () => {
  const now = new Date('2026-10-19T12:00:00Z');
  const entry = (assessmentId, startsAt, deadline, maxAttempts = 3) => ({ assessmentId, assessment: { title: 'A' + assessmentId }, startsAt: new Date(startsAt), deadline: new Date(deadline), maxAttempts });
  it('works out each status, attempts used and remaining', () => {
    const entries = [entry(1, '2026-10-01', '2026-11-01'), entry(2, '2026-10-01', '2026-10-10'), entry(3, '2026-11-01', '2026-12-01'), entry(4, '2026-10-01', '2026-11-01'), entry(5, '2026-10-01', '2026-11-01')];
    const attempts = [{ assessmentId: 1, status: 'COMPLETED' }, { assessmentId: 1, status: 'ABANDONED' }, { assessmentId: 4, status: 'IN_PROGRESS' }];
    const p = progressFor(entries, attempts, now);
    expect(p.map(x => x.status)).toEqual(['COMPLETED', 'OVERDUE', 'UPCOMING', 'IN_PROGRESS', 'NOT_STARTED']);
    expect(p[0]).toMatchObject({ used: 2, completed: 1, remaining: 1 });
    expect(p[1]).toMatchObject({ used: 0, remaining: 0 }); // deadline passed: nothing left to start
    const c = completionStats(p);
    // Denominator = assigned and already open (the upcoming one is left out): 1 of 4.
    expect(c).toMatchObject({ assigned: 5, open: 4, completed: 1, overdue: 1, outstanding: 3, upcoming: 1 });
    expect(c.rate).toBe(0.25);
    expect(overallStatus(p)).toBe('OVERDUE');
  });
  it('no assessments -> not assigned and no rate', () => {
    expect(overallStatus([])).toBe('NOT_ASSIGNED');
    expect(completionStats([]).rate).toBeNull();
    expect(overallStatus([{ status: 'COMPLETED' }, { status: 'COMPLETED' }])).toBe('COMPLETED');
    expect(overallStatus([{ status: 'COMPLETED' }, { status: 'NOT_STARTED' }])).toBe('IN_PROGRESS');
    expect(overallStatus([{ status: 'UPCOMING' }])).toBe('UPCOMING');
  });
});

// ===== TEST · Assignment cover =====
describe('assignment cover (same rules as lib/server/assigned.js)', () => {
  const staff = { id: 3, departmentId: 1, gradeId: 2, stationId: 5, station: { locationId: 9 } };
  const asg = (o) => ({ id: o.id, assessmentId: o.assessmentId || 1, targetType: o.t, staffId: o.staffId, departmentId: o.departmentId, gradeId: o.gradeId, stationId: o.stationId, locationId: o.locationId,
    startsAt: o.startsAt || '2026-10-01', deadline: o.deadline || '2026-11-01', maxAttempts: o.max ?? null, extensions: o.ext || [], assessment: { maxAttempts: 3 } });
  it('matches each target type', () => {
    expect(coversStaff(asg({ t: 'INDIVIDUAL', staffId: 3 }), staff)).toBe(true);
    expect(coversStaff(asg({ t: 'DEPARTMENT', departmentId: 2 }), staff)).toBe(false);
    expect(coversStaff(asg({ t: 'GRADE', gradeId: 2 }), staff)).toBe(true);
    expect(coversStaff(asg({ t: 'STATION', stationId: 5 }), staff)).toBe(true);
    expect(coversStaff(asg({ t: 'LOCATION', locationId: 9 }), staff)).toBe(true);
  });
  it('merges overlapping assignments: earliest start, latest deadline with extensions, highest limit', () => {
    const list = [
      asg({ id: 1, t: 'DEPARTMENT', departmentId: 1, startsAt: '2026-10-05', deadline: '2026-10-20' }),
      asg({ id: 2, t: 'GRADE', gradeId: 2, startsAt: '2026-10-01', deadline: '2026-10-15', max: 5, ext: [{ staffId: 3, newDeadline: '2026-11-30' }, { staffId: 99, newDeadline: '2026-12-31' }] }),
      asg({ id: 3, t: 'DEPARTMENT', departmentId: 7, assessmentId: 2 }),
    ];
    const e = entriesFor(staff, list);
    expect(e).toHaveLength(1);
    expect(e[0].assignmentIds).toEqual([1, 2]);
    expect(e[0].startsAt.toISOString().slice(0, 10)).toBe('2026-10-01');
    expect(e[0].deadline.toISOString().slice(0, 10)).toBe('2026-11-30');
    expect(e[0].maxAttempts).toBe(5);
  });
});

// ===== TEST · Filters & ranking =====
describe('filters and ranking', () => {
  const p = (name, results, status = 'COMPLETED') => ({ name, staffNo: 'S-' + name, department: 'IT', status, results: personResults(results), counts: resultCounts(personResults(results)) });
  const a = p('Ama', [fr(1, 2), fr(2, 5)]), b = p('Kofi', [fr(1, 4.5)], 'OVERDUE'), c = p('Efua', [], 'NOT_STARTED');
  it('gap, status and search filters', () => {
    expect([a, b, c].filter(x => matchesFilters(x, { gap: 'CRITICAL' })).map(x => x.name)).toEqual(['Ama']);
    expect([a, b, c].filter(x => matchesFilters(x, { gap: 'NONE', competencyId: 1 })).map(x => x.name)).toEqual([]);
    expect([a, b, c].filter(x => matchesFilters(x, { gap: 'NOT_ASSESSED' })).map(x => x.name)).toEqual(['Efua']);
    expect([a, b, c].filter(x => matchesFilters(x, { status: 'OVERDUE' })).map(x => x.name)).toEqual(['Kofi']);
    expect([a, b, c].filter(x => matchesFilters(x, { q: 's-ef' })).map(x => x.name)).toEqual(['Efua']);
  });
  it('sorts by overall average with the unassessed last when descending', () => {
    expect(sortPeople([a, b, c], 'average', 'desc').map(x => x.name)).toEqual(['Kofi', 'Ama', 'Efua']);
  });
  it('ranks priorities: most Critical, then most Moderate, then lowest average', () => {
    const stats = [
      { competencyId: 1, assessed: 4, critical: 1, moderate: 3, average: 3 },
      { competencyId: 2, assessed: 4, critical: 2, moderate: 0, average: 3.5 },
      { competencyId: 3, assessed: 4, critical: 1, moderate: 3, average: 2.8 },
      { competencyId: 4, assessed: 4, critical: 0, moderate: 0, average: 5 },
    ];
    const r = rankPriorities(stats);
    expect(r.map(x => x.competencyId)).toEqual([2, 3, 1]);
    expect(r[0]).toMatchObject({ rank: 1, needDevelopment: 2, needShare: 0.5 });
  });
});
