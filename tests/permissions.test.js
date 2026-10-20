// =============================================================================
// permissions.test.js · Tests for lib/permissions.js (rules the server applies on every request)
// Run: npm test
// Sections (search for these markers): TEST · Role defaults & hard rules, TEST · Department scope, TEST · Granting
// =============================================================================
import { describe, it, expect } from 'vitest';
import { effectivePermissions, hasPermission, visibleDepartmentIds, canSeeDepartment, mayGrant, primaryRole } from '../lib/permissions.js';
import { defaultScope, scopeOf, visibleDepts } from '../components/smAccess.js';

// ===== TEST · Role defaults & hard rules =====
describe('roles', () => {
  it('administrators never take assessments, even if the tick is saved', () => {
    expect(hasPermission({ roles: ['ADMIN'] }, 'assessments.view')).toBe(false);
    expect(hasPermission({ roles: ['ADMIN'], permissions: ['assessments.view', 'settings.users'] }, 'assessments.view')).toBe(false);
    expect(hasPermission({ roles: ['ADMIN'] }, 'settings.access')).toBe(true);
  });
  it('assessment creators cannot publish and do not get a participant dashboard by default', () => {
    expect(hasPermission({ roles: ['CREATOR'] }, 'forms.publish')).toBe(false);
    expect(hasPermission({ roles: ['CREATOR'] }, 'forms.edit')).toBe(true);
    expect(hasPermission({ roles: ['CREATOR'] }, 'assessments.view')).toBe(false);
    expect(hasPermission({ roles: ['CREATOR', 'STAFF'] }, 'assessments.view')).toBe(true);
  });
  it('supervisors can take their own assessments and see results, but not settings', () => {
    const sup = { roles: ['SUPERVISOR', 'STAFF'] };
    expect(hasPermission(sup, 'assessments.view')).toBe(true);
    expect(hasPermission(sup, 'staff-evals.view')).toBe(true);
    expect(hasPermission(sup, 'settings.general')).toBe(false);
  });
  it('staff only take assessments', () => {
    expect(effectivePermissions({ roles: ['STAFF'] })).toEqual(['assessments.view']);
  });
  it('unknown keys are dropped', () => {
    expect(effectivePermissions({ roles: ['STAFF'], permissions: ['assessments.view', 'made.up'] })).toEqual(['assessments.view']);
  });
  it('the shown role is the most senior one', () => {
    expect(primaryRole(['STAFF', 'SUPERVISOR'])).toBe('SUPERVISOR');
    expect(primaryRole([])).toBe('STAFF');
  });
});

// ===== TEST · Department scope =====
describe('department scope', () => {
  it('own department only', () => {
    const a = { deptScope: 'OWN', ownDepartmentId: 2 };
    expect(visibleDepartmentIds(a)).toEqual([2]);
    expect(canSeeDepartment(a, 3)).toBe(false);
  });
  it('a supervisor with no department sees nobody (role alone grants nothing)', () => {
    expect(visibleDepartmentIds({ deptScope: 'OWN', ownDepartmentId: null })).toEqual([]);
  });
  it('selected departments plus their own', () => {
    expect(visibleDepartmentIds({ deptScope: 'SELECTED', ownDepartmentId: 1, selectedDepartmentIds: [3, 4] }).sort()).toEqual([1, 3, 4]);
  });
  it('all departments', () => {
    expect(visibleDepartmentIds({ deptScope: 'ALL' })).toBeNull();
    expect(canSeeDepartment({ deptScope: 'ALL' }, 99)).toBe(true);
  });
  it('every role and grade starts on its own department; wider access is only ever granted', () => {
    for (const role of ['Administrator', 'Assessment Creator', 'Manager / Supervisor', 'Participant', 'Ticket Resolver', undefined]) expect(defaultScope(role)).toBe('own');
    expect(visibleDepts({ role: 'Assessment Creator' }, 'Human Resources')).toEqual(['Human Resources']);
    expect(visibleDepts({ role: 'Participant' }, 'Research, Business Development & Innovation')).toEqual(['Research, Business Development & Innovation']);
    expect(scopeOf({ role: 'Assessment Creator', scope: 'all' })).toBe('all');
  });
});

// ===== TEST · Granting =====
describe('granting', () => {
  it('you can only give permissions you hold, except taking assessments', () => {
    const sup = { roles: ['SUPERVISOR'] };
    expect(mayGrant(sup, 'staff-evals.view')).toBe(true);
    expect(mayGrant(sup, 'settings.access')).toBe(false);
    expect(mayGrant(sup, 'assessments.view')).toBe(true);
  });
});
