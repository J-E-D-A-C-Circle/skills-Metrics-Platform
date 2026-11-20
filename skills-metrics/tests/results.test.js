// =============================================================================
// results.test.js · Tests for marking answers and rebuilding final results (lib/server/results.js)
// Run: npm test
// Sections (search for these markers): TEST · Setup, TEST · Marking answers, TEST · Final rows (section 26 cases),
//   TEST · Rebuild from stored attempts, TEST · Completing an attempt
// The database is replaced by a small in-memory stand-in, so these run without MySQL.
// =============================================================================
import { describe, it, expect, vi } from 'vitest';

// ===== TEST · Setup =====
// server-only and the Prisma client are swapped out; everything else is the real code.
vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));
const { markResponse, marksFor, chosenIds, buildFinalRows, rebuildFinalResults, completeMarkedAttempt, scoringQuestions } = await import('../lib/server/results.js');
const { formatAverage } = await import('../lib/scoring.js');

const CONFIG = { id: 7, version: 1, active: true, requiredLevel: 5, competentFrom: 4, proficientFrom: 5, moderateGapFrom: 2.5, noGapFrom: 5, defaultMaxAttempts: 3 };
// In-memory tables with just the Prisma calls results.js uses.
function fakeTx({ attempts = [], finals = [], questions = [], responses = [] } = {}) {
  const st = { attempts, finals, results: [], questions, responses };
  return {
    st,
    scoringConfig: { findFirst: async () => CONFIG },
    attempt: {
      findMany: async ({ where }) => st.attempts.filter(a => a.staffId === where.staffId && a.assessmentId === where.assessmentId && where.status.in.includes(a.status))
        .map(a => ({ ...a, results: st.results.filter(r => r.attemptId === a.id).concat(a.results || []) })),
      findUnique: async ({ where }) => { const a = st.attempts.find(x => x.id === where.id); return a && { ...a, responses: st.responses.filter(r => r.attemptId === a.id), version: { questions: st.questions } }; },
      update: async ({ where, data }) => Object.assign(st.attempts.find(x => x.id === where.id), data),
    },
    finalCompetencyResult: {
      deleteMany: async ({ where }) => { st.finals = st.finals.filter(f => !(f.staffId === where.staffId && f.assessmentId === where.assessmentId)); },
      createMany: async ({ data }) => { st.finals.push(...data); },
    },
    competencyAttemptResult: {
      deleteMany: async ({ where }) => { st.results = st.results.filter(r => r.attemptId !== where.attemptId); },
      createMany: async ({ data }) => { st.results.push(...data); },
    },
  };
}
// An attempt with one stored score per competency: att(1, 'COMPLETED', { 10: 3 }).
const att = (id, status, scores, staffId = 1, assessmentId = 1) => ({ id, status, staffId, assessmentId, results: Object.entries(scores).map(([c, s]) => ({ attemptId: id, competencyId: +c, score: s })) });

// ===== TEST · Marking answers =====
describe('marking answers', () => {
  const single = { type: 'SINGLE_CHOICE', options: [{ id: 1, isCorrect: false }, { id: 2, isCorrect: true }] };
  const multi = { type: 'MULTIPLE_CHOICE', options: [{ id: 1, isCorrect: true }, { id: 2, isCorrect: false }, { id: 3, isCorrect: true }] };
  it('single choice: right and wrong option', () => {
    expect(markResponse(single, { optionId: 2 })).toBe(true);
    expect(markResponse(single, { optionId: 1 })).toBe(false);
  });
  it('unanswered is null (not wrong, not 0)', () => {
    expect(markResponse(single, null)).toBe(null);
    expect(markResponse(single, { optionId: null, textAnswer: null })).toBe(null);
  });
  it('multiple choice needs the exact set', () => {
    expect(markResponse(multi, { optionId: null, textAnswer: '[1,3]' })).toBe(true);
    expect(markResponse(multi, { optionId: null, textAnswer: '[3,1]' })).toBe(true);
    expect(markResponse(multi, { optionId: null, textAnswer: '[1]' })).toBe(false);
    expect(markResponse(multi, { optionId: null, textAnswer: '[1,2,3]' })).toBe(false);
  });
  it('text answers wait for a marker', () => {
    expect(markResponse({ type: 'TEXT', options: [] }, { textAnswer: 'An answer' })).toBe(null);
    expect(markResponse({ type: 'TEXT', options: [] }, { textAnswer: 'An answer', isCorrect: true })).toBe(true);
  });
  it('chosen ids ignore broken stored lists', () => {
    expect(chosenIds({ optionId: null, textAnswer: '[oops' })).toEqual([]);
    expect(chosenIds({ optionId: 4 })).toEqual([4]);
  });
  it('marksFor leaves unanswered questions out', () => {
    expect(marksFor([{ id: 1, ...single }, { id: 2, ...single }], [{ questionId: 1, optionId: 2 }])).toEqual({ 1: true });
  });
});

// ===== TEST · Final rows (section 26 cases) =====
describe('final results from completed attempts', () => {
  const rows = (...scores) => buildFinalRows(scores.map(s => ({ status: 'COMPLETED', scores: { 10: s } })));
  it.each([
    [[3], '3.00', 'NOT_COMPETENT', 'MODERATE'],
    [[3, 5], '4.00', 'COMPETENT', 'MODERATE'],
    [[3, 4, 5], '4.00', 'COMPETENT', 'MODERATE'],
    [[4, 4, 5], '4.33', 'COMPETENT', 'MODERATE'],
    [[5, 5, 5], '5.00', 'PROFICIENT', 'NONE'],
    [[1, 2, 3], '2.00', 'NOT_COMPETENT', 'CRITICAL'],
  ])('attempts %j -> %s %s %s', (scores, avg, comp, gap) => {
    const [r] = rows(...scores);
    expect(formatAverage(r.average)).toBe(avg);
    expect(r.competencyStatus).toBe(comp);
    expect(r.gapStatus).toBe(gap);
    expect(r.attemptsIncluded).toBe(scores.length);
  });
  it('abandoned, expired, in-progress and pending attempts are never counted', () => {
    const r = buildFinalRows([{ status: 'COMPLETED', scores: { 10: 3 } }, { status: 'ABANDONED', scores: { 10: 0 } }, { status: 'EXPIRED', scores: { 10: 0 } }, { status: 'IN_PROGRESS', scores: { 10: 5 } }, { status: 'PENDING_MARKING', scores: { 10: 5 } }, { status: 'COMPLETED', scores: { 10: 5 } }]);
    expect(r[0].average).toBe(4);
    expect(r[0].attemptsIncluded).toBe(2);
  });
  it('a competency not assessed in one attempt is skipped there, not given 0', () => {
    const r = buildFinalRows([{ status: 'COMPLETED', scores: { 10: 4, 11: 2 } }, { status: 'COMPLETED', scores: { 10: 5 } }]);
    const c11 = r.find(x => x.competencyId === 11);
    expect(c11.average).toBe(2);
    expect(c11.attemptsIncluded).toBe(1);
  });
  it('a real score of 0 is kept and is a Critical Gap; no attempts means no row', () => {
    expect(rows(0)[0]).toMatchObject({ average: 0, competencyStatus: 'NOT_COMPETENT', gapStatus: 'CRITICAL' });
    expect(buildFinalRows([])).toEqual([]);
    expect(buildFinalRows([{ status: 'ABANDONED', scores: { 10: 5 } }])).toEqual([]);
  });
});

// ===== TEST · Rebuild from stored attempts =====
describe('rebuildFinalResults', () => {
  it('averages every completed attempt and tags the scoring version used', async () => {
    const tx = fakeTx({ attempts: [att(1, 'COMPLETED', { 10: 3 }), att(2, 'COMPLETED', { 10: 5 }), att(3, 'ABANDONED', { 10: 0 })], finals: [{ staffId: 1, assessmentId: 1, competencyId: 10, average: 9 }] });
    await rebuildFinalResults(tx, 1, 1);
    expect(tx.st.finals).toHaveLength(1);
    expect(tx.st.finals[0]).toMatchObject({ staffId: 1, assessmentId: 1, competencyId: 10, average: 4, attemptsIncluded: 2, competencyStatus: 'COMPETENT', gapStatus: 'MODERATE', scoringConfigId: 7 });
  });
  it('a newly completed attempt updates the final average', async () => {
    const tx = fakeTx({ attempts: [att(1, 'COMPLETED', { 10: 4 }), att(2, 'COMPLETED', { 10: 4 })] });
    await rebuildFinalResults(tx, 1, 1);
    expect(formatAverage(tx.st.finals[0].average)).toBe('4.00');
    tx.st.attempts.push(att(3, 'COMPLETED', { 10: 5 }));
    await rebuildFinalResults(tx, 1, 1);
    expect(tx.st.finals).toHaveLength(1);
    expect(formatAverage(tx.st.finals[0].average)).toBe('4.33');
    expect(tx.st.finals[0].attemptsIncluded).toBe(3);
  });
  it("leaves other people's and other assessments' results alone", async () => {
    const other = { staffId: 2, assessmentId: 1, competencyId: 10, average: 1 }, otherAssessment = { staffId: 1, assessmentId: 2, competencyId: 10, average: 2 };
    const tx = fakeTx({ attempts: [att(1, 'COMPLETED', { 10: 5 })], finals: [other, otherAssessment] });
    await rebuildFinalResults(tx, 1, 1);
    expect(tx.st.finals).toContainEqual(other);
    expect(tx.st.finals).toContainEqual(otherAssessment);
    expect(tx.st.finals.find(f => f.staffId === 1 && f.assessmentId === 1)).toMatchObject({ average: 5, competencyStatus: 'PROFICIENT', gapStatus: 'NONE' });
  });
});

// ===== TEST · Completing an attempt =====
describe('completeMarkedAttempt', () => {
  // Three questions on competency 10 (one worth 2 points), one on competency 11.
  const questions = [
    { id: 1, points: 1, competencies: [{ competencyId: 10 }] }, { id: 2, points: 2, competencies: [{ competencyId: 10 }] },
    { id: 3, points: 1, competencies: [{ competencyId: 10 }] }, { id: 4, points: 1, competencies: [{ competencyId: 11 }] },
  ];
  it('scores each competency, completes the attempt and rebuilds the final result', async () => {
    const tx = fakeTx({ attempts: [{ id: 5, status: 'SUBMITTED', staffId: 1, assessmentId: 1 }], questions, responses: [
      { attemptId: 5, questionId: 1, isCorrect: true }, { attemptId: 5, questionId: 2, isCorrect: true }, { attemptId: 5, questionId: 4, isCorrect: false }, // q3 unanswered
    ] });
    const scores = await completeMarkedAttempt(tx, 5);
    expect(scores[10].score).toBeCloseTo(5 * 3 / 4, 10); // 3 of 4 points
    expect(scores[10].asked).toBe(3);
    expect(scores[11].score).toBe(0);
    expect(tx.st.attempts[0].status).toBe('COMPLETED');
    expect(tx.st.results).toHaveLength(2);
    expect(tx.st.finals.find(f => f.competencyId === 10)).toMatchObject({ competencyStatus: 'NOT_COMPETENT', gapStatus: 'MODERATE', attemptsIncluded: 1 });
    expect(tx.st.finals.find(f => f.competencyId === 11)).toMatchObject({ average: 0, gapStatus: 'CRITICAL' });
  });
  it('running it again gives the same results (no duplicate rows)', async () => {
    const tx = fakeTx({ attempts: [{ id: 5, status: 'SUBMITTED', staffId: 1, assessmentId: 1 }], questions, responses: [{ attemptId: 5, questionId: 1, isCorrect: true }] });
    await completeMarkedAttempt(tx, 5);
    await completeMarkedAttempt(tx, 5);
    expect(tx.st.results).toHaveLength(2);
    expect(tx.st.finals).toHaveLength(2);
  });
  it('scoringQuestions turns Prisma rows into the scoring engine shape', () => {
    expect(scoringQuestions([{ id: 1, points: '2.00', competencies: [{ competencyId: 3 }] }])).toEqual([{ id: 1, points: 2, competencies: [3] }]);
  });
  it('buildWhereConditions expands compound unique keys like attemptId_questionId', async () => {
    const { buildWhereConditions } = await import('../lib/server/drizzleBridge.js');
    const { attemptResponses } = await import('../drizzle/schema.js');
    const conds = buildWhereConditions(attemptResponses, { attemptId_questionId: { attemptId: 12, questionId: 99 } });
    expect(conds).toHaveLength(2);
  });
});
