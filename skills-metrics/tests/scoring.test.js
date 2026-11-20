// =============================================================================
// scoring.test.js · Tests for lib/scoring.js (the one scoring engine)
// Run: npm test
// Sections (search for these markers): TEST · Required cases from the prompt, TEST · Threshold boundaries,
//   TEST · Which attempts count, TEST · Scoring one attempt, TEST · Configuration checks
// =============================================================================
import { describe, it, expect } from 'vitest';
import { scoreAttempt, finalAverage, competencyStatus, gapStatus, gapValue, summarize, formatAverage, validateConfig, scoreLabel, DEFAULT_CONFIG } from '../lib/scoring.js';

const done = (...scores) => scores.map(s => ({ status: 'COMPLETED', scores: { c1: s } }));

// ===== TEST · Required cases from the prompt (section 26 table) =====
describe('required cases', () => {
  const cases = [
    [[3], '3.00', 'NOT_COMPETENT', 'MODERATE'],
    [[3, 5], '4.00', 'COMPETENT', 'MODERATE'],
    [[3, 4, 5], '4.00', 'COMPETENT', 'MODERATE'],
    [[4, 4, 5], '4.33', 'COMPETENT', 'MODERATE'],
    [[5, 5, 5], '5.00', 'PROFICIENT', 'NONE'],
    [[1, 2, 3], '2.00', 'NOT_COMPETENT', 'CRITICAL'],
  ];
  it.each(cases)('attempts %j -> %s, %s, %s', (scores, avg, comp, gap) => {
    const r = summarize(done(...scores), 'c1');
    expect(r.display).toBe(avg);
    expect(r.competencyStatus).toBe(comp);
    expect(r.gapStatus).toBe(gap);
    expect(r.attemptsIncluded).toBe(scores.length);
  });
  it('a 5 on one attempt is not Proficient when the average is below 5', () => {
    expect(summarize(done(5, 4), 'c1').competencyStatus).toBe('COMPETENT');
  });
});

// ===== TEST · Threshold boundaries =====
describe('boundaries', () => {
  it.each([[3.99, 'NOT_COMPETENT'], [4.0, 'COMPETENT'], [4.33, 'COMPETENT'], [4.99, 'COMPETENT'], [5.0, 'PROFICIENT'], [0, 'NOT_COMPETENT']])('%d -> %s', (a, s) => {
    expect(competencyStatus(a)).toBe(s);
  });
  it.each([[0, 'CRITICAL'], [1.5, 'CRITICAL'], [2.49, 'CRITICAL'], [2.5, 'MODERATE'], [3.5, 'MODERATE'], [4.0, 'MODERATE'], [4.99, 'MODERATE'], [5.0, 'NONE']])('gap %d -> %s', (a, s) => {
    expect(gapStatus(a)).toBe(s);
  });
  it('compares the unrounded average (4.995 shows 5.00 but is not Proficient)', () => {
    expect(formatAverage(4.995)).toBe('5.00');
    expect(competencyStatus(4.995)).toBe('COMPETENT');
    expect(gapStatus(4.995)).toBe('MODERATE');
  });
  it('floating point noise does not flip a threshold', () => {
    const avg = (4 + 4 + 4.000000000000001) / 3;
    expect(competencyStatus(avg)).toBe('COMPETENT');
    expect(competencyStatus(0.1 * 3 * (5 / 0.3))).toBe('PROFICIENT');
  });
  it('gap value is required level minus average', () => {
    expect(gapValue(4)).toBe(1);
    expect(gapValue(5)).toBe(0);
  });
});

// ===== TEST · Which attempts count =====
describe('attempts counted', () => {
  it('one, two and three completed attempts', () => {
    expect(finalAverage(done(4), 'c1').average).toBe(4);
    expect(finalAverage(done(3, 4), 'c1').average).toBe(3.5);
    expect(finalAverage(done(3, 4, 5), 'c1').average).toBe(4);
  });
  it('leaves out in-progress, abandoned and expired attempts', () => {
    const a = [...done(5), { status: 'IN_PROGRESS', scores: { c1: 0 } }, { status: 'ABANDONED', scores: { c1: 1 } }, { status: 'EXPIRED', scores: { c1: 1 } }, { status: 'SUBMITTED', scores: { c1: 1 } }];
    expect(finalAverage(a, 'c1')).toEqual({ average: 5, attemptsIncluded: 1, scores: [5] });
  });
  it('a competency not asked in one attempt is skipped, not counted as 0', () => {
    const a = [{ status: 'COMPLETED', scores: { c1: 4, c2: 2 } }, { status: 'COMPLETED', scores: { c2: 4 } }];
    expect(finalAverage(a, 'c1')).toEqual({ average: 4, attemptsIncluded: 1, scores: [4] });
    expect(finalAverage(a, 'c2').average).toBe(3);
  });
  it('no result is different from a score of 0', () => {
    expect(summarize([], 'c1').average).toBeNull();
    expect(summarize([], 'c1').competencyStatus).toBeNull();
    const zero = summarize(done(0), 'c1');
    expect(zero.average).toBe(0);
    expect(zero.competencyStatus).toBe('NOT_COMPETENT');
    expect(zero.gapStatus).toBe('CRITICAL');
    expect(scoreLabel(0).label).toBe('Critically Low');
    expect(scoreLabel(null)).toBeNull();
  });
  it('a new completed attempt updates the average', () => {
    const a = done(3, 4);
    expect(summarize(a, 'c1').display).toBe('3.50');
    a.push(...done(5));
    expect(summarize(a, 'c1').display).toBe('4.00');
  });
  it('decimal averages keep full precision', () => {
    expect(finalAverage(done(4, 4, 5), 'c1').average).toBeCloseTo(13 / 3, 12);
  });
});

// ===== TEST · Scoring one attempt =====
describe('scoreAttempt', () => {
  const qs = [
    { id: 1, competencies: ['a'] }, { id: 2, competencies: ['a'] }, { id: 3, competencies: ['a', 'b'] }, { id: 4, competencies: ['b'], points: 2 },
  ];
  it('5 x share of points earned, per competency', () => {
    const r = scoreAttempt(qs, { 1: true, 2: false, 3: true, 4: true });
    expect(r.a.score).toBeCloseTo(5 * 2 / 3, 12);
    expect(r.a.asked).toBe(3);
    expect(r.a.correct).toBe(2);
    expect(r.b.score).toBe(5); // 1 + 2 points out of 3
  });
  it('unanswered questions count as asked and earn nothing', () => {
    const r = scoreAttempt(qs, { 1: true });
    expect(r.a.score).toBeCloseTo(5 / 3, 12);
    expect(r.b.score).toBe(0);
  });
  it('7 of 10 correct gives 3.50', () => {
    const ten = Array.from({ length: 10 }, (_, i) => ({ id: i, competencies: ['x'] }));
    const marks = Object.fromEntries(ten.map((q, i) => [q.id, i < 7]));
    expect(formatAverage(scoreAttempt(ten, marks).x.score)).toBe('3.50');
  });
});

// ===== TEST · Configuration checks =====
describe('validateConfig', () => {
  it('accepts the defaults', () => { expect(validateConfig(DEFAULT_CONFIG)).toEqual([]); });
  it('rejects overlapping or out-of-order ranges', () => {
    expect(validateConfig({ competentFrom: 5.5 }).length).toBeGreaterThan(0);
    expect(validateConfig({ moderateGapFrom: 5 }).length).toBeGreaterThan(0);
    expect(validateConfig({ defaultMaxAttempts: 0 }).length).toBeGreaterThan(0);
  });
  it('custom thresholds are applied', () => {
    expect(competencyStatus(3.6, { competentFrom: 3.5 })).toBe('COMPETENT');
  });
});
