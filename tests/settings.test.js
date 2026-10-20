// =============================================================================
// settings.test.js · Tests for lib/server/settings.js (system settings, scoring versions, templates, audit filters)
// Run: npm test
// Sections (search for these markers): TEST · General settings, TEST · Scoring configuration,
//   TEST · Notification templates, TEST · Audit log filters & CSV
// =============================================================================
import { describe, it, expect } from 'vitest';
import { GeneralSchema, GENERAL_DEFAULTS, mergeGeneral, ScoringInput, scoringProblems, sameConfig, plainConfig, templateProblems, placeholdersIn, fillPreview,
  channelsAvailable, AuditQuery, auditWhere, csvCell, toCsv } from '../lib/server/settings.js';
import { DEFAULT_CONFIG } from '../lib/scoring.js';

// ===== TEST · General settings =====
describe('general settings', () => {
  it('accepts valid values and refuses bad ones', () => {
    expect(GeneralSchema.safeParse(GENERAL_DEFAULTS).success).toBe(true);
    expect(GeneralSchema.safeParse({ ...GENERAL_DEFAULTS, defaultDeadlineDays: 0 }).success).toBe(false);
    expect(GeneralSchema.safeParse({ ...GENERAL_DEFAULTS, reminderLeadHours: 1.5 }).success).toBe(false);
    expect(GeneralSchema.safeParse({ ...GENERAL_DEFAULTS, defaultResultRelease: 'SOMETIMES' }).success).toBe(false);
    expect(GeneralSchema.safeParse({ ...GENERAL_DEFAULTS, extra: 1 }).success).toBe(false);
  });
  it('fills missing keys with defaults', () => {
    expect(mergeGeneral({ orgName: 'X' })).toEqual({ ...GENERAL_DEFAULTS, orgName: 'X' });
    expect(mergeGeneral(null)).toEqual(GENERAL_DEFAULTS);
  });
});

// ===== TEST · Scoring configuration =====
describe('scoring configuration', () => {
  const base = { ...DEFAULT_CONFIG };
  it('the defaults are valid; a reason is required', () => {
    expect(scoringProblems(base)).toEqual([]);
    expect(ScoringInput.safeParse({ ...base, reason: 'ok' }).success).toBe(false);
    expect(ScoringInput.safeParse({ ...base, reason: 'Approved by HR' }).success).toBe(true);
  });
  it('refuses overlapping or gapped ranges', () => {
    expect(scoringProblems({ ...base, moderateGapFrom: 5 }).length).toBeGreaterThan(0);
    expect(scoringProblems({ ...base, competentFrom: 5.5 }).length).toBeGreaterThan(0);
    expect(scoringProblems({ ...base, noGapFrom: 6 }).length).toBeGreaterThan(0);
  });
  it('refuses more than 2 decimals and silly attempt limits', () => {
    expect(scoringProblems({ ...base, competentFrom: 3.995 })).toContain('Use at most 2 decimal places');
    expect(scoringProblems({ ...base, defaultMaxAttempts: 0 }).length).toBeGreaterThan(0);
    expect(scoringProblems({ ...base, defaultMaxAttempts: 11 })).toContain('Attempt limit can be at most 10');
  });
  it('spots a save that changes nothing, and turns decimal columns into numbers', () => {
    const row = { id: 1, version: 1, reason: 'r', active: true, requiredLevel: '5', competentFrom: '4', proficientFrom: '5', moderateGapFrom: '2.5', noGapFrom: '5', defaultMaxAttempts: 3 };
    const p = plainConfig(row);
    expect(p.moderateGapFrom).toBe(2.5);
    expect(sameConfig(p, base)).toBe(true);
    expect(sameConfig(p, { ...base, defaultMaxAttempts: 4 })).toBe(false);
  });
});

// ===== TEST · Notification templates =====
describe('notification templates', () => {
  const none = { in_app: true, email: false, sms: false };
  it('fills placeholders the same way as notify.js and lists them', () => {
    expect(fillPreview('Ticket {reference} is {status}{x}', { reference: 'SKM-2026-000001', status: 'Open' })).toBe('Ticket SKM-2026-000001 is Open');
    expect(placeholdersIn('{a} and {b} and {a}')).toEqual(['a', 'b']);
  });
  it('refuses unknown placeholders, a missing in-app channel and unconfigured channels', () => {
    expect(templateProblems('ticket.updated', { title: '{reference}', body: '{status}', channels: ['in_app'] }, none)).toEqual([]);
    expect(templateProblems('ticket.updated', { title: '{reference}', body: '{oops}', channels: ['in_app'] }, none)[0]).toMatch(/oops/);
    expect(templateProblems('ticket.updated', { title: 'x', body: 'y', channels: [] }, none)).toContain('In-app notifications are always on.');
    expect(templateProblems('ticket.updated', { title: 'x', body: 'y', channels: ['in_app', 'email'] }, none)).toContain('Email is not configured on this server.');
    expect(templateProblems('ticket.updated', { title: 'x', body: 'y', channels: ['in_app', 'email'] }, { ...none, email: true })).toEqual([]);
  });
  it('email / SMS count as configured only when switched on', () => {
    expect(channelsAvailable({})).toEqual(none);
    expect(channelsAvailable({ NOTIFY_EMAIL: 'on', NOTIFY_SMS: 'off' })).toEqual({ in_app: true, email: true, sms: false });
  });
});

// ===== TEST · Audit log filters & CSV =====
describe('audit log filters & CSV', () => {
  it('builds the where clause from the filters', () => {
    const f = AuditQuery.parse({ action: 'ticket.', outcome: 'DENIED', from: '2026-10-01', to: '2026-10-19', actor: 'system' });
    const w = auditWhere(f);
    expect(w.AND).toContainEqual({ action: { startsWith: 'ticket.' } });
    expect(w.AND).toContainEqual({ outcome: 'DENIED' });
    expect(w.AND).toContainEqual({ actorId: null });
    expect(auditWhere(AuditQuery.parse({}))).toEqual({});
  });
  it('refuses bad dates and outcomes', () => {
    expect(AuditQuery.safeParse({ from: '19/10/2026' }).success).toBe(false);
    expect(AuditQuery.safeParse({ outcome: 'MAYBE' }).success).toBe(false);
  });
  it('CSV cells are quoted and formulas are neutralised', () => {
    expect(csvCell('a"b')).toBe('"a""b"');
    expect(csvCell('=SUM(A1)')).toBe('"\'=SUM(A1)"');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(toCsv(['h'], [['x']])).toBe('"h"\r\n"x"');
  });
});
