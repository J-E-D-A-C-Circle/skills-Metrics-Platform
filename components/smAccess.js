// =============================================================================
// smAccess.js · What each user can open and see (the checkboxes in Settings > User Management)
// Used by: SMSystem.jsx (Add / edit user dialog, users table), SkillMatrixApp.jsx (sidebar + page guard)   Depends on: nothing
// How it works: a user's role ticks a default set of boxes (ROLE_ACCESS). The admin can then tick or untick
//   any box, which is saved on the user as `access` (list of page keys) and `scope` ('all' or 'own').
//   Users saved before this existed have no `access`, so they keep their role's defaults.
// Sections (search for these markers): ACCESS · Areas (checkbox list), ACCESS · Role defaults, ACCESS · Scope options, ACCESS · Helpers
// =============================================================================

// ===== ACCESS · Areas (checkbox list) =====
// Page keys match the sidebar keys in SkillMatrixApp.jsx (NAV / FOOTER_PAGES). Home, My Profile and Help & Guides are always open.
export const ACCESS_AREAS = [
  { group: 'Assessments', items: [
    { key: 'cycles', label: 'Assessment Cycles', desc: 'Set up and schedule assessment cycles' },
    { key: 'forms', label: 'Forms', desc: 'Create and edit assessment forms' },
    { key: 'staff-evals', label: 'Staff Evaluations', desc: 'Review, adjust and confirm results' },
    { key: 'assessments', label: 'Take assessments', desc: 'My Assessments and the timed assessment' }] },
  { group: 'Analytics', items: [
    { key: 'analytics', label: 'Analytics', desc: 'Dashboards, departments and heatmap' },
    { key: 'training', label: 'Training Needs', desc: 'Gaps and recommended training' },
    { key: 'reports', label: 'Reports', desc: 'Report builder and scheduled reports' }] },
  { group: 'Administration', items: [
    { key: 'framework', label: 'Skill Framework', desc: 'Competencies and target profiles' },
    { key: 'settings', label: 'Settings & User Management', desc: 'System settings, users and audit log' }] },
];
export const ACCESS_KEYS = ACCESS_AREAS.flatMap(g => g.items.map(i => i.key));

// ===== ACCESS · Role defaults =====
// The boxes a role ticks when it is picked (same as the old fixed sidebar per role).
export const ROLE_ACCESS = {
  Administrator: ['cycles', 'forms', 'staff-evals', 'analytics', 'training', 'reports', 'framework', 'settings'],
  'Assessment Creator': ['forms', 'assessments', 'framework'],
  'Manager / Supervisor': ['staff-evals', 'assessments', 'analytics', 'training'],
  Participant: ['assessments'],
};

// ===== ACCESS · Scope options =====
// Which departments' staff and results the user can see.
export const SCOPES = [['all', 'All departments'], ['own', 'Own department only']];
export const ROLE_SCOPE = { 'Manager / Supervisor': 'own' };

// ===== ACCESS · Helpers =====
export const defaultAccess = role => [...(ROLE_ACCESS[role] || ROLE_ACCESS.Participant)];
export const defaultScope = role => ROLE_SCOPE[role] || 'all';
// The user's ticked pages (saved list, or the role defaults for older users).
export const accessOf = u => (u && Array.isArray(u.access) ? u.access.filter(k => ACCESS_KEYS.includes(k)) : defaultAccess(u && u.role));
export const scopeOf = u => (u && (u.scope === 'all' || u.scope === 'own') ? u.scope : defaultScope(u && u.role));
// True when the saved boxes differ from the role's defaults (shown as "Custom access" in the users table).
export const isCustom = u => {
  const a = accessOf(u).slice().sort().join(), d = defaultAccess(u && u.role).sort().join();
  return a !== d || scopeOf(u) !== defaultScope(u && u.role);
};
