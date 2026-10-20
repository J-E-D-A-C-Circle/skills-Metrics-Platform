// =============================================================================
// smAccess.js · Permissions: what each user can open, what they can do there, and which departments they see
// Used by: SMSystem.jsx (Add / edit user dialog, users table), SkillMatrixApp.jsx (sidebar, tabs, page guard, `can` prop),
//   and every page that hides buttons the user may not use (Cycles, Forms, Staff Evaluations, Staff report, Analytics,
//   Training Needs, Skill Framework, Settings)   Depends on: nothing
// How it works: every action in the app has a permission key "<area>.<action>" (e.g. "staff-evals.confirm").
//   Picking a role ticks that role's default keys (ROLE_PERMS). The admin can then tick or untick any single key; the
//   list is saved on the user as `perms`. Department visibility is saved as `scope` ('all' | 'own' | 'some') plus
//   `depts` (the chosen department names when scope is 'some').
//   Users saved before 16 Oct 2026 have `access` (page keys only) instead of `perms`; they get every action on those pages.
// Sections (search for these markers): ACCESS · Permission list (areas & actions), ACCESS · Role defaults,
//   ACCESS · Department scope options, ACCESS · Reading a user's permissions, ACCESS · Department visibility, ACCESS · Helpers
// =============================================================================

// ===== ACCESS · Permission list (areas & actions) =====
// One entry per area (page). `page` is the sidebar key in SkillMatrixApp.jsx (NAV / FOOTER_PAGES).
// Each action: [action, label, description, needs]. `needs` = the action that must also be ticked (usually "view");
// ticking an action ticks what it needs, unticking the need unticks everything that depends on it.
// Home, My Profile and Help & Guides are always open and have no keys.
export const PERM_AREAS = [
  { group: 'Assessments', area: 'forms', page: 'forms', label: 'Assessment Content', icon: 'icon-file-pen-line', actions: [
    ['view', 'View assessment content', 'Open assessments, preview them and see their versions and review history'],
    ['create', 'Create drafts & upload questions', 'New assessment drafts, bulk question upload from the template', 'view'],
    ['edit', 'Edit & submit drafts', 'Change questions, answers and competency mapping, then submit for review', 'view'],
    ['review', 'Review content', 'Approve, reject or return submitted content (Administrators only)', 'view'],
    ['publish', 'Publish content', 'Make approved content live so it can be assigned (Administrators only)', 'review'],
    ['archive', 'Archive content', 'Retire an assessment so it can no longer be assigned', 'view']] },
  { group: 'Assessments', area: 'cycles', page: 'cycles', label: 'Assignments & Deadlines', icon: 'icon-calendar-cog', actions: [
    ['view', 'View assignments', 'See who each assessment is assigned to, with dates and progress'],
    ['assign', 'Assign assessments', 'Assign to people, departments, grades, stations or locations', 'view'],
    ['edit', 'Change dates & attempt limits', 'Change start dates, deadlines and attempt limits', 'view'],
    ['extend', 'Extend deadlines', 'Give more time, with a recorded reason', 'view'],
    ['release', 'Release results', 'Release results held back for later', 'view']] },
  { group: 'Assessments', area: 'staff-evals', page: 'staff-evals', label: 'Team Results', icon: 'icon-users', actions: [
    ['view', 'View team results', 'Staff in the departments you can see: completion, averages, competency and gap status'],
    ['report', 'Open competency profiles', 'Full competency detail for one staff member', 'view'],
    ['export', 'Export team results', 'Download Excel, PDF or CSV', 'view']] },
  { group: 'Assessments', area: 'assessments', page: 'assessments', label: 'Take assessments', icon: 'icon-clipboard-list', actions: [
    ['view', 'Take assessments', 'My Assessments: start, resume and submit assigned assessments']] },
  { group: 'Analytics', area: 'analytics', page: 'analytics', label: 'Dashboards', icon: 'icon-chart-column', actions: [
    ['view', 'Organisation dashboard', 'Staff, assessments, completion, competency and gap figures'],
    ['departments', 'Department breakdown', 'Every department side by side'],
    ['heatmap', 'Gap heatmap', 'Average result by department and competency']] },
  { group: 'Analytics', area: 'training', page: 'training', label: 'Development Priorities', icon: 'icon-graduation-cap', actions: [
    ['view', 'Development priorities', 'Critical and Moderate Gaps by competency and by staff member'],
    ['top', 'Top priorities', 'The biggest gaps across departments'],
    ['export', 'Export priorities', 'Download as CSV', 'view']] },
  { group: 'Analytics', area: 'reports', page: 'reports', label: 'Reports', icon: 'icon-file-spreadsheet', actions: [
    ['view', 'View reports', 'Open the reports, with filters'],
    ['export', 'Export reports', 'Download reports as Excel, PDF or CSV', 'view']] },
  { group: 'Administration', area: 'org', page: 'organisation', label: 'Organisation', icon: 'icon-building-2', actions: [
    ['view', 'View organisation', 'Staff records, departments, grades, stations and locations'],
    ['staff', 'Manage staff records', 'Add and edit staff, Staff IDs, departments, stations and grades; link login accounts', 'view'],
    ['structure', 'Manage structure', 'Add and edit departments, grades, stations and locations', 'view'],
    ['supervisors', 'Manage supervisors', 'Supervisor / HoD assignments and grade-to-station-manager mappings', 'view']] },
  { group: 'Administration', area: 'framework', page: 'framework', label: 'Competency Framework', icon: 'icon-network', actions: [
    ['view', 'View framework', 'Competency categories and competencies'],
    ['competencies', 'Edit competencies', 'Add, edit and retire competencies and categories', 'view']] },
  { group: 'Administration', area: 'tickets', page: 'tickets', label: 'Support Tickets', icon: 'icon-life-buoy', actions: [
    ['manage', 'Manage all tickets', 'See every ticket, assign and reassign, set priority, add internal notes'],
    ['resolve', 'Handle assigned tickets', 'Respond to and update tickets assigned to you']] },
  { group: 'Administration', area: 'settings', page: 'settings', label: 'Settings & User Management', icon: 'icon-settings', actions: [
    ['general', 'System settings', 'Result-release and deadline policies'],
    ['scoring', 'Scoring thresholds', 'Competent, Proficient and gap thresholds, required level and attempt limits (with history)'],
    ['notifications', 'Notification templates', 'Change the wording of notifications'],
    ['users', 'View users', 'See the user list'],
    ['add-user', 'Add users', 'Create new accounts', 'users'],
    ['edit-user', 'Edit users', 'Change name, email, department and status', 'users'],
    ['access', 'Change roles & permissions', 'Tick or untick what other users can do', 'users'],
    ['password', 'Reset passwords', 'Give a user a temporary password', 'users'],
    ['delete-user', 'Delete users', 'Remove an account for good', 'users'],
    ['audit', 'Audit log', 'See sign-ins, changes and exports'],
    ['audit-export', 'Export audit log', 'Download the audit log as CSV', 'audit']] },
];
const key = (a, x) => a + '.' + x;
// Keys anyone who manages permissions may give, even without holding them (taking an assessment is not a privilege,
// and Administrators do not hold it themselves).
export const FREE_TO_GRANT = ['assessments.view'];
// Every key, in display order.
export const PERM_KEYS = PERM_AREAS.flatMap(a => a.actions.map(([x]) => key(a.area, x)));
// key -> { area, action, label, needs (full key or null) }
export const PERM_INFO = Object.fromEntries(PERM_AREAS.flatMap(a => a.actions.map(([x, label, desc, needs]) =>
  [key(a.area, x), { area: a.area, areaLabel: a.label, action: x, label, desc, needs: needs ? key(a.area, needs) : null }])));
// Keys that open the area's page (any one is enough).
// A permission area can sit on a page with a different key (area "org" is the "organisation" page).
const PAGE_OF = Object.fromEntries(PERM_AREAS.map(a => [a.area, a.page || a.area]));
export const pageKeys = page => PERM_KEYS.filter(k => PAGE_OF[PERM_INFO[k].area] === page);

// ===== ACCESS · Role defaults =====
// The boxes a role ticks when it is picked. Admins get everything except taking assessments.
const ALL_BUT = (...skip) => PERM_KEYS.filter(k => !skip.includes(k));
export const ROLE_PERMS = {
  Administrator: ALL_BUT('assessments.view', 'tickets.resolve'),
  // Creators draft and submit content; an Administrator reviews and publishes it (lib/permissions.js enforces this).
  'Assessment Creator': ['forms.view', 'forms.create', 'forms.edit', 'framework.view'],
  'Manager / Supervisor': ['staff-evals.view', 'staff-evals.report', 'staff-evals.export', 'assessments.view', 'cycles.view',
    'analytics.view', 'analytics.departments', 'analytics.heatmap', 'training.view', 'training.top', 'training.export', 'reports.view', 'reports.export'],
  Participant: ['assessments.view'],
  // A designated ticket resolver only handles tickets assigned to them.
  'Ticket Resolver': ['tickets.resolve'],
};

// ===== ACCESS · Department scope options =====
// Which departments' staff and results the user can see. 'some' uses the user's `depts` list.
export const SCOPES = [['all', 'All departments'], ['own', 'Own department only'], ['some', 'Selected departments']];
export const ROLE_SCOPE = { 'Manager / Supervisor': 'own' };

// ===== ACCESS · Reading a user's permissions =====
export const defaultPerms = role => [...(ROLE_PERMS[role] || ROLE_PERMS.Participant)];
export const defaultScope = role => ROLE_SCOPE[role] || 'all';
// Older users only have `access` (page keys from the first version of the checkboxes): give every action on those pages.
const fromPages = pages => PERM_KEYS.filter(k => pages.includes(PERM_INFO[k].area));
export const permsOf = u => {
  if (!u) return defaultPerms('Participant');
  if (Array.isArray(u.perms)) return u.perms.filter(k => PERM_INFO[k]);
  if (Array.isArray(u.access)) return fromPages(u.access);
  return defaultPerms(u.role);
};
export const scopeOf = u => (u && SCOPES.some(([v]) => v === u.scope) ? u.scope : defaultScope(u && u.role));
export const deptsOf = u => (u && Array.isArray(u.depts) ? u.depts : []);

// ===== ACCESS · Department visibility =====
// The department names a user may see, or null for all departments.
export const visibleDepts = (u, ownDept) => {
  const sc = scopeOf(u);
  if (sc === 'own') return [ownDept];
  if (sc === 'some') return deptsOf(u).length ? deptsOf(u) : [ownDept];
  return null;
};

// ===== ACCESS · Helpers =====
// Tick a key together with what it needs; untick a key together with everything that needs it.
export const withKey = (list, k) => { const out = new Set(list); let x = k; while (x && !out.has(x)) { out.add(x); x = PERM_INFO[x].needs; } return PERM_KEYS.filter(y => out.has(y)); };
export const withoutKey = (list, k) => { const drop = new Set([k]); let grew = true;
  while (grew) { grew = false; PERM_KEYS.forEach(y => { if (!drop.has(y) && drop.has(PERM_INFO[y].needs)) { drop.add(y); grew = true; } }); }
  return list.filter(y => !drop.has(y)); };
const same = (a, b) => a.slice().sort().join() === b.slice().sort().join();
// True when the saved permissions or departments differ from the role's defaults ("Custom access" in the users table).
export const isCustom = u => !same(permsOf(u), defaultPerms(u && u.role)) || scopeOf(u) !== defaultScope(u && u.role);
// Short summary for the users table, e.g. "12 of 38 permissions".
export const permSummary = u => permsOf(u).length + ' of ' + PERM_KEYS.length + ' permissions';
