// =============================================================================
// content.test.js · Tests for lib/server/content.js (Assessment Content workflow rules, question checks, bulk upload)
// Run: npm test
// Sections (search for these markers): TEST · Workflow, TEST · Who may act, TEST · Question checks,
//   TEST · Assessment checks, TEST · Bulk upload
// =============================================================================
import { describe, it, expect } from 'vitest';
import { canMove, assessmentStatus, versionAuthorId, isOwnWork, canSeeVersion, allowedActions, questionProblems, normaliseQuestion, assessmentProblems, parseImportRows, parseType, parseCompetencyCell, TEMPLATE_HEADERS, TEMPLATE_EXAMPLES } from '../lib/server/content.js';

const comps = [{ id: 1, code: 'service', name: 'Customer Service', active: true }, { id: 2, code: 'comm', name: 'Communication', active: true }, { id: 3, code: 'old', name: 'Old skill', active: false }];
const compById = new Map(comps.map(c => [c.id, c]));
const good = { type: 'SINGLE_CHOICE', text: 'What is 2 + 2?', points: 1, skillArea: '', options: [{ text: '3', isCorrect: false }, { text: '4', isCorrect: true }], competencies: [{ competencyId: 1, weight: 1 }] };
const admin = { id: 1, perms: ['forms.view', 'forms.create', 'forms.edit', 'forms.review', 'forms.publish', 'forms.archive'] };
const creator = { id: 3, perms: ['forms.view', 'forms.create', 'forms.edit'] };

// ===== TEST · Workflow =====
describe('workflow', () => {
  it('only allows the documented transitions', () => {
    expect(canMove('submit', 'DRAFT')).toBe(true);
    expect(canMove('submit', 'RETURNED')).toBe(true);
    expect(canMove('submit', 'APPROVED')).toBe(false);
    expect(canMove('approve', 'DRAFT')).toBe(false);
    expect(canMove('approve', 'SUBMITTED')).toBe(true);
    expect(canMove('publish', 'SUBMITTED')).toBe(false);
    expect(canMove('publish', 'APPROVED')).toBe(true);
    expect(canMove('nonsense', 'DRAFT')).toBe(false);
  });
  it('keeps an assessment published while a newer version is in review', () => {
    expect(assessmentStatus([{ versionNo: 1, status: 'PUBLISHED' }, { versionNo: 2, status: 'SUBMITTED' }])).toBe('PUBLISHED');
    expect(assessmentStatus([{ versionNo: 1, status: 'ARCHIVED' }, { versionNo: 2, status: 'APPROVED' }])).toBe('APPROVED');
    expect(assessmentStatus([{ versionNo: 1, status: 'DRAFT' }])).toBe('DRAFT');
    expect(assessmentStatus([{ versionNo: 1, status: 'PUBLISHED' }], true)).toBe('ARCHIVED');
  });
});

// ===== TEST · Who may act =====
describe('who may act', () => {
  const a = { createdById: 1, status: 'PUBLISHED' };
  const v1 = { id: 10, versionNo: 1, status: 'PUBLISHED', reviewEvents: [] };
  const v2 = { id: 11, versionNo: 2, status: 'SUBMITTED', reviewEvents: [{ action: 'CREATE', actorId: 3 }, { action: 'SUBMIT', actorId: 3 }] };
  it('finds the author from the CREATE event, falling back to the creator for version 1', () => {
    expect(versionAuthorId(v1, a)).toBe(1);
    expect(versionAuthorId(v2, a)).toBe(3);
  });
  it('treats authors and submitters as owners of the work', () => {
    expect(isOwnWork(3, v2, a)).toBe(true);
    expect(isOwnWork(1, v2, a)).toBe(false);
    expect(isOwnWork(5, { ...v2, reviewEvents: [{ action: 'CREATE', actorId: 3 }, { action: 'SUBMIT', actorId: 5 }] }, a)).toBe(true);
  });
  it('lets an administrator review someone else\'s work but never their own', () => {
    expect(allowedActions(admin, a, [v1, v2]).review).toBe(true);
    expect(allowedActions({ ...admin, id: 3 }, a, [v1, v2]).review).toBe(false);
    expect(allowedActions({ ...admin, id: 3 }, a, [v1, v2]).reviewOwn).toBe(true);
  });
  it('never lets a creator review or publish', () => {
    const can = allowedActions(creator, a, [v1, v2]);
    expect(can.review).toBe(false);
    expect(can.publish).toBe(false);
    expect(can.edit).toBe(false); // waiting for review
  });
  it('only the author edits a draft, and new versions need approved or published content', () => {
    const d = { id: 12, versionNo: 2, status: 'DRAFT', reviewEvents: [{ action: 'CREATE', actorId: 3 }] };
    expect(allowedActions(creator, a, [v1, d]).edit).toBe(true);
    expect(allowedActions({ ...creator, id: 9 }, a, [v1, d]).edit).toBe(false);
    expect(allowedActions(creator, a, [v1, d]).newVersion).toBe(false);
    expect(allowedActions(creator, a, [v1]).newVersion).toBe(true);
    expect(allowedActions(creator, { ...a, status: 'ARCHIVED' }, [v1]).newVersion).toBe(false);
  });
  it('hides other people\'s unpublished drafts from creators', () => {
    const d = { id: 12, versionNo: 2, status: 'DRAFT', reviewEvents: [{ action: 'CREATE', actorId: 7 }] };
    expect(canSeeVersion(creator, d, a)).toBe(false);
    expect(canSeeVersion(creator, v1, a)).toBe(true);
    expect(canSeeVersion(admin, d, a)).toBe(true);
  });
});

// ===== TEST · Question checks =====
describe('question checks', () => {
  it('accepts a complete question', () => { expect(questionProblems(good, compById)).toEqual([]); });
  it('needs text, 2 options, a correct answer and a competency', () => {
    const p = questionProblems({ type: 'SINGLE_CHOICE', text: ' ', points: 1, options: [{ text: 'x', isCorrect: false }], competencies: [] }, compById);
    expect(p).toContain('Enter the question text.');
    expect(p).toContain('Add at least 2 answer options.');
    expect(p).toContain('Mark the correct answer.');
    expect(p).toContain('Map the question to at least one competency.');
  });
  it('allows several correct answers only for multiple choice', () => {
    const two = { ...good, options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }] };
    expect(questionProblems(two, compById).join()).toMatch(/only have one correct answer/);
    expect(questionProblems({ ...two, type: 'MULTIPLE_CHOICE' }, compById)).toEqual([]);
  });
  it('rejects bad points, weights, duplicate options and retired competencies', () => {
    expect(questionProblems({ ...good, points: 0 }, compById).join()).toMatch(/Points/);
    expect(questionProblems({ ...good, competencies: [{ competencyId: 1, weight: -1 }] }, compById).join()).toMatch(/weight/);
    expect(questionProblems({ ...good, options: [{ text: 'Yes', isCorrect: true }, { text: 'yes', isCorrect: false }] }, compById).join()).toMatch(/same/);
    expect(questionProblems({ ...good, competencies: [{ competencyId: 3, weight: 1 }] }, compById).join()).toMatch(/retired/);
    expect(questionProblems({ ...good, competencies: [{ competencyId: 99, weight: 1 }] }, compById).join()).toMatch(/no longer exists/);
  });
  it('written answers need no options; true/false gets its two options', () => {
    expect(questionProblems({ ...good, type: 'TEXT', options: [] }, compById)).toEqual([]);
    const tf = normaliseQuestion({ ...good, type: 'TRUE_FALSE', options: [] });
    expect(tf.options.map(o => o.text)).toEqual(['True', 'False']);
    expect(questionProblems(tf, compById)).toContain('Mark the correct answer.');
  });
});

// ===== TEST · Assessment checks =====
describe('assessment checks', () => {
  it('needs a title and at least one question', () => {
    const p = assessmentProblems({ title: '', questions: [] }, compById).map(x => x.message);
    expect(p).toEqual(['Give the assessment a title.', 'Add at least one question.']);
  });
  it('numbers problems by question and spots duplicate questions', () => {
    const p = assessmentProblems({ title: 'T', questions: [{ ...good, order: 1 }, { ...good, order: 2, text: 'what is 2 + 2' }, { ...good, order: 3, points: 0 }] }, compById);
    expect(p.find(x => x.order === 2).message).toMatch(/Same question as question 1/);
    expect(p.find(x => x.order === 3).message).toMatch(/Points/);
  });
});

// ===== TEST · Bulk upload =====
describe('bulk upload', () => {
  it('reads the template examples without errors', () => {
    const r = parseImportRows([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES], comps);
    expect(r.fileErrors).toEqual([]);
    expect(r.errors).toEqual([]);
    expect(r.questions.map(q => q.type)).toEqual(['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE']);
    expect(r.questions[1].options.filter(o => o.isCorrect).length).toBe(2);
    expect(r.questions[1].competencies).toEqual([{ competencyId: 1, weight: 1 }, { competencyId: 2, weight: 0.5 }]);
    expect(r.questions[2].options.find(o => o.isCorrect).text).toBe('True');
  });
  it('reports every problem by spreadsheet row and imports nothing silently', () => {
    const r = parseImportRows([TEMPLATE_HEADERS,
      ['Q one', 'Single choice', 'a', 'b', '', '', '', '', '', 1, '', 'service'],
      ['Q two', 'Single choice', 'a', 'b', '', '', '', '', 'C', 1, '', 'service'],
      ['Q three', 'Single choice', 'a', 'b', '', '', '', '', 'A', 1, '', 'nope'],
      [],
      ['Q four', 'Essay??', 'a', 'b', '', '', '', '', 'A', 'x', '', 'service'],
      ['Q one', 'Single choice', 'a', 'b', '', '', '', '', 'A', 1, '', 'service'],
    ], comps);
    const by = Object.fromEntries(r.errors.map(e => [e.row, e.messages.join(' | ')]));
    expect(by[2]).toMatch(/correct answer is missing/);
    expect(by[3]).toMatch(/points at an empty option/);
    expect(by[4]).toMatch(/Unknown competency code "nope"/);
    expect(by[6]).toMatch(/Unknown type/);
    expect(by[6]).toMatch(/Points "x"/);
    expect(by[7]).toMatch(/Duplicate question \(same as row 2\)/);
    expect(r.total).toBe(5);
  });
  it('flags duplicates against questions already in the version', () => {
    const r = parseImportRows([TEMPLATE_HEADERS, ['What is 2 + 2?', '', 'a', 'b', '', '', '', '', 'A', '', '', 'service']], comps, ['What is 2 + 2?']);
    expect(r.errors[0].messages.join()).toMatch(/Duplicate question \(same as an existing question\)/);
  });
  it('explains a file without the template columns', () => {
    const r = parseImportRows([['foo', 'bar']], comps);
    expect(r.fileErrors.length).toBe(3);
  });
  it('parses types and competency cells', () => {
    expect(parseType('True / False')).toBe('TRUE_FALSE');
    expect(parseType('')).toBe('SINGLE_CHOICE');
    expect(parseType('essay')).toBe(null);
    expect(parseCompetencyCell('RB1; rb2:0.5')).toEqual([{ code: 'rb1', weight: 1, raw: 'RB1' }, { code: 'rb2', weight: 0.5, raw: 'rb2:0.5' }]);
  });
});
