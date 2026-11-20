import { describe, it, expect, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('../lib/server/db.js', () => ({ db: {} }));

import {
  JOB_LEVELS,
  computeAssessmentTitle,
} from '../lib/levels.js';
import { parseImportRows } from '../lib/server/content';
import { parseDocxToRows } from '../lib/docxParser';
import { createDocxQuestionTemplate } from '../lib/docxTemplate';
const { startDecision } = await import('../lib/server/results');

describe('User Department Requested Features & Level 9 Baseline (Option A)', () => {
  const depts = [
    { id: 1, name: 'Human Resources', code: 'HR' },
    { id: 2, name: 'Research, Business Development & Innovation', code: 'RBDI' },
  ];

  it('configures baseline levels starting from Level 9 for Assistant Officer', () => {
    expect(JOB_LEVELS[0]).toEqual({
      id: 'LEVEL_9',
      levelNo: 9,
      label: 'Level 9 · Assistant Officer',
      shortRole: 'Assistant Officer',
    });
    expect(JOB_LEVELS[1]).toEqual({
      id: 'LEVEL_10',
      levelNo: 10,
      label: 'Level 10 · Officer & Senior Officer',
      shortRole: 'Officer & Senior Officer',
    });
    expect(JOB_LEVELS[2]).toEqual({
      id: 'LEVEL_11',
      levelNo: 11,
      label: 'Level 11 · Assistant Manager & Manager',
      shortRole: 'Assistant Manager & Manager',
    });
    expect(JOB_LEVELS[3]).toEqual({
      id: 'LEVEL_12',
      levelNo: 12,
      label: 'Level 12 · Deputy Director & Director',
      shortRole: 'Deputy Director & Director',
    });
  });

  it('automatically computes assessment title for Technical skills without manual typing', () => {
    const hrTitle = computeAssessmentTitle('TECHNICAL', '1', 'LEVEL_9', depts);
    expect(hrTitle).toBe('Human Resources Technical Assessment · Level 9 (Assistant Officer)');

    const rbdiTitle = computeAssessmentTitle('TECHNICAL', '2', 'LEVEL_10', depts);
    expect(rbdiTitle).toBe('Research, Business Development & Innovation Technical Assessment · Level 10 (Officer & Senior Officer)');

    const mgrTitle = computeAssessmentTitle('TECHNICAL', '1', 'LEVEL_11', depts);
    expect(mgrTitle).toBe('Human Resources Technical Assessment · Level 11 (Assistant Manager & Manager)');

    const dirTitle = computeAssessmentTitle('TECHNICAL', '2', 'LEVEL_12', depts);
    expect(dirTitle).toBe('Research, Business Development & Innovation Technical Assessment · Level 12 (Deputy Director & Director)');
  });

  it('automatically computes assessment title for General skills (no department included)', () => {
    const genL9 = computeAssessmentTitle('GENERAL', null, 'LEVEL_9', depts);
    expect(genL9).toBe('General Skills Competency Assessment · Level 9 (Assistant Officer)');

    const genL10 = computeAssessmentTitle('GENERAL', null, 'LEVEL_10', depts);
    expect(genL10).toBe('General Skills Competency Assessment · Level 10 (Officer & Senior Officer)');
  });

  it('allows taking and retaking assessments without attempt ceilings when maxAttempts is null or unlimited', () => {
    const now = new Date('2026-10-19T12:00:00Z');
    const entry = {
      assessment: { status: 'PUBLISHED' },
      startsAt: new Date(now.getTime() - 864e5),
      deadline: new Date(now.getTime() + 864e5),
      maxAttempts: null,
    };
    const attempts = [
      { id: 1, attemptNo: 1, status: 'COMPLETED' },
      { id: 2, attemptNo: 2, status: 'COMPLETED' },
      { id: 3, attemptNo: 3, status: 'COMPLETED' },
      { id: 4, attemptNo: 4, status: 'COMPLETED' },
    ];
    const decision = startDecision({ entry, attempts, now });
    expect(decision.action).toBe('create');
    expect(decision.attemptNo).toBe(5);
  });

  it('handles Word doc (.docx) question parsing and validation for bulk upload', async () => {
    const comps = [
      { id: 10, code: 'ta', name: 'Talent Acquisition & Selection', active: true },
      { id: 11, code: 'ld', name: 'Learning & Development Management', active: true },
    ];
    const docxBuf = await createDocxQuestionTemplate(comps);
    const rows = await parseDocxToRows(docxBuf);
    expect(rows.length).toBeGreaterThan(1);
    expect(rows[0]).toContain('Question');

    // Parse into valid question entities
    const parsed = parseImportRows(rows, [
      { id: 1, code: 'service', name: 'Front-desk service', active: true },
      { id: 2, code: 'comm', name: 'Communication', active: true },
    ]);
    expect(parsed.fileErrors.length).toBe(0);
    expect(parsed.questions.length).toBeGreaterThan(0);
  });
});
