'use client';
// =============================================================================
// SMSystem · Settings area: General settings, User Management, Audit Log, plus Help & Guides
// Screen / URL: "/settings" (General), "/settings?tab=users" (User Management), "/settings?tab=audit" (Audit Log),
//   "/help" (Help & Guides) and "/help?tab=ratings" (Rating Scales, moved from the Skill Framework). Old URLs /users, /audit and /system redirect here.
// Who sees it: General, User Management and Audit Log each need their own permission; every button in User Management
//   (Add, Edit, Change roles & permissions, Reset password, Delete, Export audit log) is a separate permission; everyone sees Help & Guides
// Used by: SkillMatrixApp.jsx (rendered when the page group is "system", with props.view)
//   Depends on: react-dom createPortal (pop-up dialogs), smUI (PageHeader), smAccess (access checkboxes), SMFramework (RatingScales cards), ui/select (Select), SMSystem.module.css
// Users come from the database through /api/accounts (app/api/accounts/**); nothing about users is kept in the browser.
// Sections (search for these markers): USERS · Roles, USERS · Server calls, AUDIT LOG · Sample log entries, AUDIT LOG · Saved entries (permission and account changes), HELP · FAQ content,
//   USERS · Helpers, SETTINGS · Main component, SETTINGS · View values, USERS · Search & role filter,
//   USERS · Add / edit user dialog, USERS · Permission rules (who may grant what), USERS · Tick box, USERS · Permission ticks (what the user can open and do) & department scope, USERS · Save user, USERS · Table rows & row actions, USERS · Delete confirmation,
//   AUDIT LOG · Filters, rows & CSV export, SETTINGS · General settings values, HELP · Quick links, FAQ & support ticket,
//   HELP · Rating Scales tab,
//   SETTINGS · Render, SETTINGS · Page header, USERS · User Management tab, USERS · "User created" card, USERS · Users table,
//   USERS · Permissions (what the user can open and do) & department scope, USERS · Delete confirmation dialog, AUDIT LOG · Audit Log tab, SETTINGS · General tab, HELP · Help & Guides tab, Toast
// =============================================================================
import React from 'react';
import { createPortal } from 'react-dom';
import __css from './SMSystem.module.css';
import { PageHeader } from './smUI';
import { RatingScales } from './SMFramework';
import { Select } from './ui/select';
import { PERM_AREAS, PERM_INFO, FREE_TO_GRANT, SCOPES, defaultPerms, defaultScope, permsOf, scopeOf, deptsOf, visibleDepts, withKey, withoutKey, isCustom, permSummary } from './smAccess';


// ===== USERS · Roles =====
// The built-in sample user list was removed on 19 Oct 2026: the table shows only real accounts from the database.
const ROLES = ['Administrator', 'Assessment Creator', 'Manager / Supervisor', 'Participant', 'Ticket Resolver'];
// ===== AUDIT LOG · Sample log entries (demo data) =====
const LOGS = [
  ['09:42:18', 'Abena Frimpong', 'Integrity', 'Left assessment window (2 of 3) · Q4 2026 IT Skills'],
  ['09:31:02', 'Ama Owusu', 'Assessment', 'Submitted Q4 2026 IT Skills Assessment · 38m 12s'],
  ['09:20:44', 'Yaw Darko', 'Assessment', 'Started timed assessment · 45 min'],
  ['09:05:10', 'Esi Mensah', 'Config', 'Published Q4 2026 HR Skills Assessment v2'],
  ['08:58:37', 'Joseph Ahor Abandoh-Sam', 'Auth', 'Signed in · Chrome on Windows'],
  ['08:41:09', 'Adjei Denzil Asiam', 'Export', 'Exported IT gap register (Excel, 66 rows)'],
  ['08:30:00', 'System', 'Config', 'Assessment window opened · 09:00 – 17:00'],
  ['Yesterday', 'Kojo Quaye', 'Auth', 'Failed sign-in attempt (wrong password)'],
  ['Yesterday', 'Adjei Denzil Asiam', 'Config', 'Changed role: Esi Mensah → Assessment Creator'],
  ['Yesterday', 'System', 'Export', 'Scheduled report sent: Weekly assessment completion'],
];
// ===== HELP · FAQ content =====
const FAQ = [
  ['Why is the assessment timed and only one day?', 'To keep it fair. Everyone completes the same assessment on the same day, in one sitting, so nobody has extra time to look up answers or get help.'],
  ['What happens if my internet drops during the assessment?', "Your answers keep saving on your device and sync when you're back online. The timer keeps running, so reconnect as quickly as you can."],
  ['Can I pause the timer?', 'No. Once you press Start, the timer runs until you submit or the time runs out. Plan for an uninterrupted block of time before you begin.'],
  ['What counts as leaving the window?', 'Switching to another tab or app, or minimising the browser. Each one is recorded, and after the set limit (3 by default) your assessment is submitted automatically.'],
  ['How is my skill gap calculated?', 'Gap = target level for your role − your actual level. When you submit, the system scores your answers automatically. Your manager then confirms the result, or adjusts a competency and records why.'],
  ['What is a target profile?', 'The level your job level (Assistant Officer up to Director) requires for each competency. Most profiles apply organisation-wide; some departments have their own override.'],
  ['Who can see my results?', 'You, your line manager and HR. Executive dashboards only show summary figures, never individual answers.'],
];
// ===== USERS · Helpers =====
const DOMAIN = '@dvla.gov.gh';
// slug(): "First Last" -> suggested username "first.last". genPass(): random 10-character temporary password.
function slug(name) { const p = name.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean); return p.length > 1 ? p[0] + '.' + p[p.length - 1] : (p[0] || ''); }
function genPass() { const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghijkmnpqrstuvwxyz', n = '23456789', y = '!@#$%&*?', all = U + l + n + y, r = m => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] % m; }, pick = s => s[r(s.length)];
  const a = [pick(U), pick(l), pick(n), pick(y)]; while (a.length < 10) a.push(pick(all)); for (let i = a.length - 1; i > 0; i--) { const j = r(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a.join(''); }
// ===== USERS · Server calls =====
// api(method, path, body): calls /api/accounts…, returns the JSON reply, or throws an Error with the server's message.
async function api(method, path, body) {
  const r = await fetch('/api/accounts' + path, { method, credentials: 'same-origin', cache: 'no-store', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}
const STATUSES = ['Active', 'Must change password', 'Suspended'];
const isAdmin = u => u.role === 'Administrator';
// Username of whoever is signed in (the seeded administrator when nobody has signed in yet).
function meName() { try { return localStorage.getItem('skm-me') || 'denzilasiam.adjei'; } catch (e) { return 'denzilasiam.adjei'; } }
// ===== AUDIT LOG · Saved entries (permission and account changes) =====
// Entries older versions saved in localStorage "skm-audit" (shown above the sample entries in the Audit Log tab).
// User Management changes are now recorded on the server (AuditLog table); the Audit Log tab moves there in phase 8.
const AKEY = 'skm-audit';
function loadAudit() { try { const a = JSON.parse(localStorage.getItem(AKEY) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
const TYPEC = { Auth: ['#e0e7ff', '#3730a3'], Assessment: ['#dcfce7', '#15803d'], Integrity: ['#fee2e2', '#b91c1c'], Config: ['#fef3c7', '#92400e'], Export: ['#e0f2fe', '#0369a1'] };
// ===== USERS · Tick box (used by the permission cards and department ticks) =====
// on = ticked, mixed = some of the area's actions ticked (shows a dash), small = action-row size.
// Ticked boxes use the app's green gradient (same as the header buttons, GREEN in smUI.jsx).
function PermBox({ on, mixed, small }) {
  const sz = small ? '16px' : '18px', fill = on || mixed;
  return <span style={{ flex: 'none', width: sz, height: sz, marginTop: small ? '1px' : '0', borderRadius: '5px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: fill ? 'linear-gradient(180deg,#2fb36b,#15904c)' : '#fff', border: fill ? '1px solid #15904c' : '1px solid rgba(15,35,65,.3)', color: '#fff' }}>
    {on ? <i className="icon-check" style={{ fontSize: small ? '11px' : '12px' }}></i> : mixed ? <span style={{ width: '8px', height: '2px', borderRadius: '1px', background: '#fff' }}></span> : null}</span>;
}
// ===== SETTINGS · Main component (state & helpers) =====
// st = General settings values (kept in memory only, not saved to storage).
class SMSystem extends React.Component {
  state = { toast: '', uq: '', uRole: 'All', users: [], usersLoaded: false, uLoadErr: '', busy: false,
    adding: false, editId: null, nStatus: 'Active', confirmDel: null, nName: '', nEmail: '', nDept: 'IT Department', nRole: 'Participant', nPerms: defaultPerms('Participant'), nScope: defaultScope('Participant'), nDepts: [], nUser: '', userTouched: false, emailTouched: false, tried: false, nPass: genPass(), showPass: false, mustChange: true, sendEmail: true, created: null, nErr: '', aType: 'All',
    st: { duration: 45, start: '09:00', end: '17:00', tabLimit: 3, retention: '5', mfa: true, offline: true, encrypt: true, notify: true, anon: true }, sDirty: false,
    hq: '', open: { 0: true }, tSubject: '', tMsg: '' };
  // Loads the user list from the database, and clears the old browser-only list ("skm-users") left by earlier versions.
  componentDidMount() { try { localStorage.removeItem('skm-users'); } catch (e) {} if (this.mayGrant('settings.users')) this.loadUsers(); }
  loadUsers = async () => {
    try { const d = await api('GET', ''); this.setState({ users: d.users, usersLoaded: true, uLoadErr: '' }); }
    catch (e) { this.setState({ usersLoaded: true, uLoadErr: e.message }); }
  };
  // Runs one change on the server, then reloads the list. Returns the reply, or null when it failed (message shown).
  change = async (method, path, body, onErr) => {
    if (this.state.busy) return null;
    this.setState({ busy: true });
    try { const d = await api(method, path, body); await this.loadUsers(); return d; }
    catch (e) { onErr ? onErr(e.message) : this.flash(e.message); return null; }
    finally { this.setState({ busy: false }); }
  };
  // One pop-up for both: Add user starts empty, Edit user starts from the chosen row.
  openAdd() { this.setState({ adding: true, editId: null, nName: '', nEmail: '', nUser: '', userTouched: false, emailTouched: false, nDept: 'IT Department', nRole: 'Participant', nPerms: this.roleDefaults('Participant', []), nScope: defaultScope('Participant'), nDepts: [], nStatus: 'Active', tried: false, nErr: '', created: null }); }
  openEdit(u) { this.setState({ adding: true, editId: u.id, nName: u.name, nEmail: u.email, nUser: u.username || '', userTouched: true, emailTouched: true, nDept: u.dept, nRole: u.role, nPerms: permsOf(u), nScope: scopeOf(u), nDepts: deptsOf(u), nStatus: u.status, tried: false, nErr: '', created: null }); }
  // ===== USERS · Permission rules (who may grant what) =====
  // mayGrant(k): you can only give (or take away) a permission you hold yourself, so nobody can hand out more than they have.
  // permLocked(): the permission ticks are read-only when you edit your own account, or lack "Change roles & permissions".
  // roleDefaults(role, current): the role's usual ticks you are allowed to give, plus any ticks you cannot change.
  mayGrant(k) { return FREE_TO_GRANT.includes(k) || (this.props.can ? this.props.can(k) : true); }
  isSelf() { const u = this.state.editId != null ? this.state.users.find(x => x.id === this.state.editId) : null; return !!u && (u.username || '') === meName(); }
  permLocked() { return this.isSelf() || !this.mayGrant('settings.access'); }
  roleDefaults(role, current) { return [...defaultPerms(role).filter(k => this.mayGrant(k)), ...current.filter(k => !this.mayGrant(k))].filter((k, i, a) => a.indexOf(k) === i); }
  togglePerm(k) {
    if (this.permLocked() || !this.mayGrant(k)) return;
    this.setState(st => ({ nPerms: st.nPerms.includes(k) ? withoutKey(st.nPerms, k) : withKey(st.nPerms, k).filter(x => st.nPerms.includes(x) || this.mayGrant(x)) }));
  }
  // Area tick: all of the area's permissions you may give on, or all of them off.
  toggleArea(keys, allOn) {
    if (this.permLocked()) return;
    const mine = keys.filter(k => this.mayGrant(k));
    this.setState(st => ({ nPerms: allOn ? st.nPerms.filter(k => !mine.includes(k)) : [...st.nPerms, ...mine.filter(k => !st.nPerms.includes(k))] }));
  }
  closeModal() { this.setState({ adding: false, editId: null, tried: false, nErr: '' }); }
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  // ===== SETTINGS · View values (renderVals) =====
  // props.view picks the screen: settings (General), users, audit or help; the old "system" view means settings.
  renderVals() {
    const d = this.props.data, s = this.state, go = this.props.go || (() => {}), ft = this.props.features || {}, role = this.props.role || 'staff';
    if (!d) return {};
    const rawView = this.props.view;
    const view = (rawView === 'system' ? 'settings' : rawView) || 'users';
    const q = s.uq.trim().toLowerCase();
    // Editor's own department visibility: someone limited to some departments only sees (and can only give) those.
    const meU = s.users.find(u => (u.username || '') === meName()), editorVis = meU ? visibleDepts(meU, meU.dept) : null;
    const may = k => this.mayGrant(k);
    const users = s.users.filter(u => (!editorVis || editorVis.includes(u.dept)) && (s.uRole === 'All' || u.role === s.uRole) && (!q || (u.name + u.email).toLowerCase().includes(q)));
    // A work email can be typed in full, or just the part before the @ (completed with @dvla.gov.gh).
    const rawEmail = s.nEmail.trim(), email = (rawEmail && !rawEmail.includes('@') ? rawEmail + DOMAIN : rawEmail).toLowerCase();
    const emailOk = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email), uname = s.nUser.trim().toLowerCase();
    const nameParts = s.nName.trim().split(/\s+/).filter(Boolean), nameOk = nameParts.length >= 2;
    const userOk = /^[a-z0-9._-]{3,30}$/.test(uname), userTaken = s.users.some(x => x.id !== s.editId && (x.username || '').toLowerCase() === uname), emailTaken = s.users.some(x => x.id !== s.editId && x.email.toLowerCase() === email);
    // Temporary password rule: at least 8 characters with an upper-case letter, a lower-case letter and a digit.
    const passOk = s.nPass.length >= 8 && /[A-Z]/.test(s.nPass) && /[a-z]/.test(s.nPass) && /\d/.test(s.nPass);
    const editing = s.editId != null, editUser = editing ? s.users.find(x => x.id === s.editId) : null;
    // adminCount is used for the last-admin guard; me is the signed-in username (self-delete block).
    const adminCount = s.users.filter(isAdmin).length, me = meName();
    const canAdd = nameOk && emailOk && userOk && !userTaken && !emailTaken && (editing || passOk);
    const logs = [...loadAudit().map(e => [e.time, e.user, e.type, e.event]), ...LOGS].filter(l => s.aType === 'All' || l[2] === s.aType);
    const setSt = (k, v) => this.setState({ st: { ...this.state.st, [k]: v }, sDirty: true });
    const hq = s.hq.trim().toLowerCase(), faqs = FAQ.map((f, i) => ({ f, i })).filter(({ f }) => !hq || (f[0] + f[1]).toLowerCase().includes(hq));
    const canSend = s.tSubject.trim() && s.tMsg.trim().length > 5;
    // ===== SETTINGS · Values handed to the screen =====
    return {
      headerActions: view === 'users' ? (!may('settings.add-user') ? null : <button onClick={() => this.openAdd()} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-user-plus"} style={{ fontSize: "14px" }}></i>Add user</button>)
        : view === 'settings' ? <button onClick={() => { if (!s.sDirty) return; this.setState({ sDirty: false }); this.flash('Settings saved'); }} style={{ height: "36px", padding: "0 18px", border: "0", borderRadius: "999px", background: s.sDirty ? 'linear-gradient(180deg,#2fb36b,#15904c)' : '#a3acb9', color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>{s.sDirty ? 'Save settings' : 'All changes saved'}</button> : null,
      title: { users: 'User Management', audit: 'Audit Logs', settings: 'System Settings', help: 'Help & Guides', ratings: 'Help & Guides' }[view],
      subtitle: { users: 'Manage who can sign in and what each role can do, across every department', audit: 'A tamper-evident record of sign-ins, assessments, integrity events and changes', settings: 'Platform-wide defaults for assessments, security and data', help: 'Answers about the timed assessment, scoring and your results', ratings: 'The proficiency, importance, gap and scoring scales used across the platform' }[view],
      isUsers: view === 'users', isAudit: view === 'audit', isSettings: view === 'settings', isHelp: view === 'help', isRatings: view === 'ratings',
      // ===== USERS · Search & role filter =====
      uq: s.uq, onUq: e => this.setState({ uq: e.target.value }), uRole: s.uRole, onURole: e => this.setState({ uRole: e.target.value }), roleNames: ROLES, deptNames: d.depts.map(x => x.name).filter(n => !editorVis || editorVis.includes(n)),
      // ===== USERS · Add / edit user dialog values =====
      adding: s.adding, toggleAdd: () => this.closeModal(), editing, nStatus: s.nStatus, onNStatus: e => this.setState({ nStatus: e.target.value }), statusNames: STATUSES,
      mTitle: editing ? 'Edit user' : 'Add a new user', mSub: editing ? 'Changes apply the next time they sign in. Use Reset password to change their password.' : 'They sign in with a username or email, plus a temporary password',
      mIcon: editing ? 'icon-user-pen' : 'icon-user-plus', saveText: editing ? 'Save changes' : 'Create user', nName: s.nName, nEmail: s.nEmail, nDept: s.nDept, nRole: s.nRole,
      onNName: e => { const v = e.target.value; this.setState(st => ({ nName: v, nErr: '', nUser: st.userTouched ? st.nUser : slug(v), nEmail: st.emailTouched ? st.nEmail : (slug(v).includes('.') ? slug(v) + DOMAIN : '') })); },
      onNEmail: e => this.setState({ nEmail: e.target.value.replace(/\s/g, ''), emailTouched: true, nErr: '' }),
      nameBorder: s.tried && !nameOk ? '#fca5a5' : 'rgba(15,35,65,.14)',
      nameHint: s.tried && !nameOk ? (s.nName.trim() ? 'Enter both the first and last name, e.g. Isaac Addy' : 'Enter the full name') : 'First and last name, as held by HR', nameHintColor: s.tried && !nameOk ? '#b91c1c' : '#6b7280',
      emailBorder: (rawEmail && (!emailOk || emailTaken)) || (s.tried && !emailOk) ? '#fca5a5' : 'rgba(15,35,65,.14)',
      emailHint: !rawEmail ? (s.tried ? 'Enter a work email' : 'Filled in from the name. You can type just the part before the @.') : !emailOk ? 'Use a work email like isaac.addy@dvla.gov.gh' : emailTaken ? 'A user with this email already exists' : !rawEmail.includes('@') ? 'Will be saved as ' + email : 'Looks good',
      emailHintColor: !rawEmail ? (s.tried ? '#b91c1c' : '#6b7280') : !emailOk || emailTaken ? '#b91c1c' : '#15803d', onNDept: e => this.setState({ nDept: e.target.value }), onNRole: e => { if (this.permLocked()) return; const r = e.target.value; this.setState({ nRole: r, nPerms: this.roleDefaults(r, s.nPerms), nScope: editorVis && defaultScope(r) === 'all' ? 'own' : defaultScope(r), nDepts: [] }); },
      // Edit user: details need "Edit users"; role and ticks need "Change roles & permissions" (never on your own account).
      detailsLocked: editing && !may('settings.edit-user'), roleLocked: this.permLocked(),
      // ===== USERS · Permission ticks (what the user can open and do) & department scope =====
      // One card per area (Assessment Cycles, Forms ...) with a tick for each action. Picking a role ticks its usual set;
      // any single tick can then be changed. Ticks you may not give are greyed out (see USERS · Permission rules).
      permLocked: this.permLocked(), permLockedText: this.isSelf() ? 'You cannot change your own permissions. Another user with "Change roles & permissions" must do it.' : 'You can see these permissions but not change them. That needs "Change roles & permissions".',
      permGroups: [...new Set(PERM_AREAS.map(a => a.group))].map(group => ({ group, areas: PERM_AREAS.filter(a => a.group === group).map(a => {
        const keys = a.actions.map(([x]) => a.area + '.' + x), n = keys.filter(k => s.nPerms.includes(k)).length;
        return { area: a.area, label: a.label, icon: a.icon, count: n + ' of ' + keys.length, on: n === keys.length, mixed: n > 0 && n < keys.length, toggle: () => this.toggleArea(keys, n === keys.length),
          items: a.actions.map(([x, label, desc]) => { const k = a.area + '.' + x; return { k, label, desc, on: s.nPerms.includes(k), locked: this.permLocked() || !may(k), toggle: () => this.togglePerm(k) }; }) }; }) })),
      permCount: s.nPerms.length + ' of ' + Object.keys(PERM_INFO).length + ' ticked',
      resetAccess: () => { if (this.permLocked()) return; this.setState({ nPerms: this.roleDefaults(s.nRole, s.nPerms), nScope: editorVis && defaultScope(s.nRole) === 'all' ? 'own' : defaultScope(s.nRole), nDepts: [] }); },
      clearAccess: () => { if (this.permLocked()) return; this.setState({ nPerms: s.nPerms.filter(k => !may(k)) }); },
      // Departments they can see: All (only if you see all yourself), Own department, or Selected departments (ticks below).
      nScope: s.nScope, scopeOpts: SCOPES.map(([v, label]) => { const off = this.permLocked() || (v === 'all' && !!editorVis); return { v, label, on: s.nScope === v, off, pick: () => { if (!off) this.setState({ nScope: v }); } }; }),
      deptPicks: s.nScope === 'some' ? d.depts.map(x => x.name).filter(n => !editorVis || editorVis.includes(n)).map(n => { const on = s.nDepts.includes(n); return { n, on,
        toggle: () => { if (!this.permLocked()) this.setState({ nDepts: on ? this.state.nDepts.filter(x => x !== n) : [...this.state.nDepts, n] }); } }; }) : null,
      nSaveBg: 'linear-gradient(180deg,#2fb36b,#15904c)',
      nUser: s.nUser, onNUser: e => this.setState({ nUser: e.target.value.replace(/\s/g, '').toLowerCase(), userTouched: true, nErr: '' }),
      userBorder: (uname && (!userOk || userTaken)) || (s.tried && !userOk) ? '#fca5a5' : 'rgba(15,35,65,.14)',
      userHint: !uname ? 'Filled in from the name. You can change it.' : !userOk ? '3–30 characters: letters, numbers, dot, dash or underscore' : userTaken ? 'This username is already taken' : 'Available',
      userHintColor: uname && (!userOk || userTaken) ? '#b91c1c' : uname ? '#15803d' : '#6b7280',
      nPass: s.nPass, onNPass: e => this.setState({ nPass: e.target.value, nErr: '' }), passType: s.showPass ? 'text' : 'password', passIcon: s.showPass ? 'icon-eye-off' : 'icon-eye',
      toggleShowPass: () => this.setState({ showPass: !s.showPass }), genPass: () => this.setState({ nPass: genPass(), showPass: true }),
      passBorder: s.nPass && !passOk ? '#fca5a5' : 'rgba(15,35,65,.14)', passHint: passOk ? 'Strong enough for a temporary password' : 'At least 8 characters with uppercase, lowercase and a number', passHintColor: passOk ? '#15803d' : '#b45309',
      // The "Email sign-in details" toggle was taken out until notifications are built (no email is sent yet).
      newToggles: [['mustChange', 'Ask for a new password at first sign-in', 'The temporary password only works once']]
        .map(([k, label, desc]) => ({ label, desc, justify: s[k] ? 'flex-end' : 'flex-start', bg: s[k] ? '#0d3b2a' : '#d1d5db', toggle: () => this.setState({ [k]: !this.state[k] }) })),
      nErr: s.nErr,
      // ===== USERS · Save user (add or edit) =====
      // The server checks everything again (permissions, last Administrator, departments) and its message is shown here.
      saveUser: async () => {
        if (!canAdd) { const n = [!nameOk, !emailOk || emailTaken, !userOk || userTaken, !editing && !passOk].filter(Boolean).length; this.setState({ tried: true, nErr: n === 1 ? 'Fix the highlighted field to continue.' : 'Fix the ' + n + ' highlighted fields to continue.' }); return; }
        if (s.nScope === 'some' && !s.nDepts.length) { this.setState({ nErr: 'Tick at least one department under Selected departments.' }); return; }
        const fail = m => this.setState({ nErr: m });
        if (editing) {
          if (!editUser) { this.closeModal(); return; }
          // Last-admin guard: the only Administrator cannot be given another role or be suspended (checked again on the server).
          if (isAdmin(editUser) && adminCount === 1 && s.nRole !== 'Administrator') { this.setState({ nErr: editUser.name + ' is the only Administrator. Make someone else an Administrator first.' }); return; }
          if (isAdmin(editUser) && adminCount === 1 && s.nStatus === 'Suspended') { this.setState({ nErr: 'The only Administrator cannot be suspended.' }); return; }
          const body = { ...(may('settings.edit-user') ? { name: nameParts.join(' '), email, username: uname, dept: s.nDept, status: s.nStatus } : {}),
            ...(this.permLocked() ? {} : { role: s.nRole, perms: s.nPerms, scope: s.nScope, depts: s.nScope === 'some' ? s.nDepts : [] }) };
          const r = await this.change('PATCH', '/' + editUser.id, body, fail);
          if (!r) return;
          // Keep the signed-in person's stored username in step if they renamed their own.
          if ((editUser.username || '') === me && uname !== me) { try { localStorage.setItem('skm-me', uname); } catch (e) {} }
          this.setState({ adding: false, editId: null, tried: false, nErr: '' });
          this.flash('Changes saved for ' + r.user.name);
          return;
        }
        // New user: saved in the database; the "User created" card then shows the sign-in details once.
        const r = await this.change('POST', '', { name: nameParts.join(' '), email, username: uname, dept: s.nDept, role: s.nRole, perms: s.nPerms, scope: s.nScope, depts: s.nScope === 'some' ? s.nDepts : [], password: s.nPass, mustChange: s.mustChange }, fail);
        if (!r) return;
        const u = { ...r.user, password: s.nPass };
        // Emails are not sent yet (notifications come in a later phase), so the details are always shown here to pass on.
        const note = 'Share these details with them securely. ' + (s.mustChange ? 'They will be asked to set their own password the first time they sign in.' : 'They can sign in with this password straight away.');
        this.setState({ adding: false, nName: '', nEmail: '', nUser: '', userTouched: false, emailTouched: false, tried: false, nPass: genPass(), showPass: false, nErr: '', created: { ...u, title: u.name + ' has been added', note } });
        this.flash('User created'); },
      created: s.created, dismissCreated: () => this.setState({ created: null }),
      copyCreds: () => { const c = s.created; const t = 'Skill Matrix sign-in\nUsername: ' + c.username + '\nEmail: ' + c.email + '\nTemporary password: ' + c.password; try { navigator.clipboard.writeText(t); } catch (e) {} this.flash('Sign-in details copied'); },
      trySignIn: () => go('signin'),
      // ===== USERS · Table rows & row actions =====
      users: users.map(u => ({ ...u, initials: u.name.split(' ').map(x => x[0]).slice(0, 2).join(''), sBg: u.status === 'Active' ? '#dcfce7' : u.status === 'Suspended' ? '#fee2e2' : '#fef3c7', sFg: u.status === 'Active' ? '#15803d' : u.status === 'Suspended' ? '#b91c1c' : '#92400e', username: u.username || '—',
        // Row buttons follow the signed-in user's permissions; your own role and ticks cannot be changed from here.
        self: (u.username || '') === me, mayEdit: may('settings.edit-user') || may('settings.access'), mayReset: may('settings.password'), mayDel: may('settings.delete-user'),
        mayRole: may('settings.access') && (u.username || '') !== me, mayStatus: may('settings.edit-user') && (u.username || '') !== me, summary: permSummary(u),
        // Reset password: the server makes the temporary password and signs them out everywhere.
        reset: async () => { if (!may('settings.password')) return; const r = await this.change('POST', '/' + u.id + '/password'); if (!r) return;
          this.setState({ created: { ...u, password: r.password, title: 'Password reset for ' + u.name, note: 'Give ' + u.name.split(' ')[0] + ' this temporary password. They will set a new one the next time they sign in.' } }); this.flash('Temporary password generated'); },
        // Last-admin guard (table role dropdown): changing the only Administrator's role is refused.
        onRole: async e => { const r = e.target.value; if (!may('settings.access') || (u.username || '') === me) return; if (isAdmin(u) && adminCount === 1 && r !== 'Administrator') { this.flash(u.name + ' is the only Administrator. Make someone else an Administrator first.'); return; }
          // Changing the role resets the ticks and departments to that role's defaults.
          const done = await this.change('PATCH', '/' + u.id, { role: r, perms: this.roleDefaults(r, permsOf(u)), scope: editorVis && defaultScope(r) === 'all' ? 'own' : defaultScope(r), depts: [] });
          if (done) this.flash(u.name + ' is now ' + r); },
        edit: () => this.openEdit(u), custom: isCustom(u),
        // Delete is blocked for your own account (self-delete) and for the last Administrator; the reason shows as the button tooltip.
        delBlock: (u.username || '') === me ? 'You cannot delete your own account while signed in' : isAdmin(u) && adminCount === 1 ? 'The only Administrator cannot be deleted' : '',
        del: () => { if (!may('settings.delete-user') || (u.username || '') === me || (isAdmin(u) && adminCount === 1)) return; this.setState({ confirmDel: u }); },
        toggle: () => { if (!may('settings.edit-user') || (u.username || '') === me) return; this.change('PATCH', '/' + u.id, { status: u.status === 'Suspended' ? (u.mustChange ? 'Must change password' : 'Active') : 'Suspended' }); } })),
      // Footer: loading, a load error from the server, or the count.
      userCount: !s.usersLoaded ? 'Loading users…' : s.uLoadErr ? s.uLoadErr : users.length + ' of ' + s.users.length + ' users',
      // ===== USERS · Delete confirmation =====
      confirmDel: s.confirmDel, cancelDel: () => this.setState({ confirmDel: null }),
      doDel: async () => { const u = s.confirmDel; if (!u || !may('settings.delete-user')) return; const r = await this.change('DELETE', '/' + u.id); if (!r) return; this.setState({ confirmDel: null, created: s.created && s.created.id === u.id ? null : s.created }); this.flash(u.name + ' has been deleted'); },
      // ===== AUDIT LOG · Filters, rows & CSV export =====
      // IP addresses are generated for the demo; Export downloads the filtered rows as CSV.
      aTypes: ['All', 'Auth', 'Assessment', 'Integrity', 'Config', 'Export'].map(t => { const on = s.aType === t; return { label: t, pick: () => this.setState({ aType: t }), bg: on ? '#0d3b2a' : '#fff', fg: on ? '#fff' : '#374151', border: on ? '#0d3b2a' : 'rgba(15,35,65,.14)' }; }),
      logs: logs.map((l, i) => ({ time: l[0], user: l[1], type: l[2], event: l[3], ip: '10.20.' + (4 + i) + '.' + (17 + i * 13), bg: TYPEC[l[2]][0], fg: TYPEC[l[2]][1] })),
      mayAuditExport: may('settings.audit-export'),
      exportAudit: () => { if (!may('settings.audit-export')) return; try { const csv = ['Time,User,Type,Event', ...logs.map(l => l.map(x => '"' + x + '"').join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'audit-log.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {} this.flash('Audit log exported'); },
      // ===== SETTINGS · General settings values =====
      // sDirty turns on the Save button after any change.
      st: s.st, on: Object.fromEntries(['duration', 'start', 'end', 'tabLimit', 'retention'].map(k => [k, e => setSt(k, ['duration', 'tabLimit'].includes(k) ? +e.target.value : e.target.value)])),
      switches: [['mfa', 'Require multi-factor sign-in', 'For administrators and managers'], ['offline', 'Allow offline assessments', 'Answers cached on the device and synced automatically'], ['encrypt', 'Encrypt offline data', 'AES-256 on the device'], ['notify', 'Email staff before assessment day', 'Reminders 3 days and 1 day before'], ...(ft.feedback360 ? [['anon', 'Keep 360° feedback anonymous', 'Only HR can see who gave feedback']] : [])]
        .map(([k, label, desc]) => ({ label, desc, justify: s.st[k] ? 'flex-end' : 'flex-start', bg: s.st[k] ? '#0d3b2a' : '#d1d5db', toggle: () => setSt(k, !s.st[k]) })),
      sSaveBg: s.sDirty ? 'linear-gradient(180deg,#2fb36b,#15904c)' : '#a3acb9', sSaveText: s.sDirty ? 'Save settings' : 'All changes saved',
      saveSettings: () => { if (!s.sDirty) return; this.setState({ sDirty: false }); this.flash('Settings saved'); },
      // ===== HELP · Quick links, FAQ & support ticket =====
      // Quick links: non-admins get My assessments; everyone gets Rating scales (opens the Rating Scales tab on this page).
      // The "Your skill profile" link was removed from Help & Guides (15 Oct 2026); it stays under My Profile.
      links: [role !== 'admin' ? { icon: 'icon-clipboard-list', title: 'My assessments', sub: 'Open today · ' + d.cycle.window, go: () => go('assessments') } : null, { icon: 'icon-sliders-horizontal', title: 'Rating scales explained', sub: 'Proficiency, importance and gap', go: () => go('help', 'ratings') }].filter(Boolean),
      hq: s.hq, onHq: e => this.setState({ hq: e.target.value }), noFaq: faqs.length === 0,
      faqs: faqs.map(({ f, i }) => ({ q: f[0], a: f[1], open: !!s.open[i], chev: s.open[i] ? 'icon-chevron-up' : 'icon-chevron-down', toggle: () => this.setState({ open: { ...this.state.open, [i]: !this.state.open[i] } }) })),
      tSubject: s.tSubject, tMsg: s.tMsg, onTSubject: e => this.setState({ tSubject: e.target.value }), onTMsg: e => this.setState({ tMsg: e.target.value }), tBg: canSend ? 'linear-gradient(180deg,#2fb36b,#15904c)' : '#a3acb9',
      sendTicket: () => { if (!canSend) { this.flash('Add a subject and a message'); return; } this.setState({ tSubject: '', tMsg: '' }); this.flash('Ticket sent. We usually reply within one working day.'); },
      toast: s.toast,
    };
  }
  // ===== SETTINGS · Render =====
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* ===== SETTINGS · Page header (title + action button) ===== */}
        <PageHeader title={__v.title} description={__v.subtitle} actions={__v.headerActions} />
        {/* ===== USERS · User Management tab (/settings?tab=users) ===== */}
        {(__v.isUsers) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            {/* ===== USERS · Search & role filter bar ===== */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "8px", height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px" }}>
                <i className={"icon-search"} style={{ fontSize: "14px", color: "#9ca3af" }}></i>
                <input value={__v.uq} onChange={__v.onUq} placeholder={"Search name, email or staff ID"} style={{ border: "0", outline: "0", flex: "1", minWidth: "0", font: "400 13.5px Inter,sans-serif" }} />
              </div>
              <Select value={__v.uRole} onChange={__v.onURole} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                <option value={"All"}>All roles</option>
                {(__v.roleNames || []).map((r, $index) => (<React.Fragment key={$index}>
                  <option value={r}>{r}</option>
                </React.Fragment>))}
              </Select>
            </div>
            {/* ===== USERS · Add / edit user dialog (pop-up, rendered into document.body) ===== */}
            {(__v.adding) ? createPortal(<>
              <div onClick={__v.toggleAdd} onKeyDown={e => { if (e.key === 'Escape') __v.toggleAdd(); }} style={{ position: "fixed", inset: "0", zIndex: "80", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(255,255,255,.45)", backdropFilter: "blur(10px) saturate(160%)", WebkitBackdropFilter: "blur(10px) saturate(160%)" }}>
              <div role={"dialog"} aria-modal={"true"} aria-labelledby={"new-user-title"} onClick={e => e.stopPropagation()} style={{ width: "min(900px,100%)", maxHeight: "calc(100vh - 32px)", display: "flex", flexDirection: "column", borderRadius: "28px", background: "linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.82))", backdropFilter: "blur(36px) saturate(190%)", WebkitBackdropFilter: "blur(36px) saturate(190%)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "inset 0 1px 0 #fff,0 0 0 1px rgba(15,35,65,.05),0 24px 60px rgba(15,35,65,.14)", overflow: "hidden" }}>
                {/* ===== USERS · Dialog header ===== */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "linear-gradient(180deg,#2fb36b,#15904c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)" }}><i className={__v.mIcon} style={{ fontSize: "18px" }}></i></span>
                  <div style={{ flex: "1", minWidth: "0" }}>
                    <div id={"new-user-title"} style={{ fontSize: "17px", fontWeight: "700" }}>{__v.mTitle}</div>
                    <div style={{ fontSize: "12.5px", color: "#4b5563", marginTop: "2px" }}>{__v.mSub}</div>
                  </div>
                  <button onClick={__v.toggleAdd} aria-label={"Close"} type={"button"} style={{ width: "32px", height: "32px", borderRadius: "999px", border: "1px solid rgba(15,35,65,.08)", background: "#fff", cursor: "pointer", color: "#4b5563", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><i className={"icon-x"} style={{ fontSize: "15px" }}></i></button>
                </div>
                {/* ===== USERS · Dialog form fields (name, email, username, department, role, status / password) ===== */}
                <div style={{ flex: "1", minHeight: "0", overflowY: "auto", padding: "18px 20px", display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "12px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>FULL NAME<input autoFocus value={__v.nName} onChange={__v.onNName} disabled={!!__v.detailsLocked} placeholder={"e.g. Isaac Addy"} aria-invalid={__v.nameHintColor === '#b91c1c'} style={{ height: "36px", border: `1px solid ${__v.nameBorder}`, borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0" }} /><span style={{ font: "400 11.5px Inter,sans-serif", letterSpacing: "0", color: __v.nameHintColor }}>{__v.nameHint}</span></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>EMAIL<input value={__v.nEmail} onChange={__v.onNEmail} disabled={!!__v.detailsLocked} placeholder={"firstname.lastname@dvla.gov.gh"} aria-invalid={__v.emailHintColor === '#b91c1c'} style={{ height: "36px", border: `1px solid ${__v.emailBorder}`, borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0" }} /><span style={{ font: "400 11.5px Inter,sans-serif", letterSpacing: "0", color: __v.emailHintColor }}>{__v.emailHint}</span></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>DEPARTMENT<Select value={__v.nDept} onChange={__v.onNDept} disabled={!!__v.detailsLocked} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", background: "#fff" }}>
                      {(__v.deptNames || []).map((n, $index) => (<React.Fragment key={$index}>
                        <option value={n}>{n}</option>
                      </React.Fragment>))}
                    </Select></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>ROLE<Select value={__v.nRole} onChange={__v.onNRole} disabled={!!__v.roleLocked} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", background: "#fff" }}>
                      {(__v.roleNames || []).map((r, $index) => (<React.Fragment key={$index}>
                        <option value={r}>{r}</option>
                      </React.Fragment>))}
                    </Select></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>USERNAME<input value={__v.nUser} onChange={__v.onNUser} disabled={!!__v.detailsLocked} placeholder={"firstname.lastname"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", fontFamily: "'JetBrains Mono',monospace", borderColor: __v.userBorder }} /><span style={{ font: "400 11.5px Inter,sans-serif", letterSpacing: "0", color: __v.userHintColor }}>{__v.userHint}</span></label>
                  {(__v.editing) ? (
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>STATUS<Select value={__v.nStatus} onChange={__v.onNStatus} disabled={!!__v.detailsLocked} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", background: "#fff" }}>
                      {(__v.statusNames || []).map((n, $index) => (<React.Fragment key={$index}>
                        <option value={n}>{n}</option>
                      </React.Fragment>))}
                    </Select></label>
                  ) : (<>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>TEMPORARY PASSWORD
              <div style={{ display: "flex", gap: "6px" }}>
                      <div style={{ flex: "1", minWidth: "0", display: "flex", alignItems: "center", height: "36px", border: `1px solid ${__v.passBorder ?? ""}`, borderRadius: "10px", background: "#fff", padding: "0 4px 0 10px" }}>
                        <input type={__v.passType} value={__v.nPass} onChange={__v.onNPass} style={{ flex: "1", minWidth: "0", border: "0", outline: "0", font: "400 13.5px 'JetBrains Mono',monospace", background: "transparent" }} />
                        <button onClick={__v.toggleShowPass} type={"button"} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", display: "flex", padding: "5px" }}>
                          <i className={__v.passIcon} style={{ fontSize: "14px" }}></i>
                        </button>
                      </div>
                      <button onClick={__v.genPass} type={"button"} title={"Generate a strong password"} style={{ height: "36px", padding: "0 10px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#0d3b2a", cursor: "pointer", display: "flex", alignItems: "center", gap: "5px", font: "600 12px Inter,sans-serif" }}><i className={"icon-refresh-cw"} style={{ fontSize: "13px" }}></i>Generate</button>
                    </div><span style={{ font: "400 11.5px Inter,sans-serif", letterSpacing: "0", color: __v.passHintColor }}>{__v.passHint}</span></label>
                  </>)}
                </div>
                {/* ===== USERS · Permissions (what the user can open and do) & department scope ===== */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", borderTop: "1px solid rgba(15,35,65,.07)", paddingTop: "14px" }}>
                  {/* Section heading with the tick count and the Reset / Clear buttons */}
                  <div style={{ display: "flex", flexWrap: "wrap", alignItems: "baseline", justifyContent: "space-between", gap: "8px" }}>
                    <div>
                      <div style={{ font: "600 13.5px Inter,sans-serif", color: "#111827" }}>Permissions <span style={{ font: "500 12px Inter,sans-serif", color: "#6b7280", marginLeft: "6px" }}>{__v.permCount}</span></div>
                      <div style={{ font: "400 12px Inter,sans-serif", color: "#6b7280", marginTop: "2px" }}>Tick exactly what this user can see and do. The role ticks its usual set. Home, My Profile and Help & Guides are always open.</div>
                    </div>
                    {(!__v.permLocked) ? <div style={{ display: "flex", gap: "14px" }}>
                      <button onClick={__v.resetAccess} type={"button"} style={{ background: "none", border: "0", padding: "0", cursor: "pointer", font: "600 12px Inter,sans-serif", color: "#127a42" }}>Reset to role defaults</button>
                      <button onClick={__v.clearAccess} type={"button"} style={{ background: "none", border: "0", padding: "0", cursor: "pointer", font: "600 12px Inter,sans-serif", color: "#b91c1c" }}>Clear all</button>
                    </div> : null}
                  </div>
                  {(__v.permLocked) ? <div style={{ padding: "9px 12px", borderRadius: "10px", background: "#fffbeb", border: "1px solid #fde68a", color: "#92400e", fontSize: "12.5px" }}>{__v.permLockedText}</div> : null}
                  {/* One group (Assessments / Analytics / Administration), each with a card per area */}
                  {(__v.permGroups || []).map((g) => (<div key={g.group} style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", textTransform: "uppercase" }}>{g.group}</div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: "8px", alignItems: "start" }}>
                      {g.areas.map((a) => (
                        <div key={a.area} style={{ borderRadius: "12px", background: a.on || a.mixed ? "#f3f9f5" : "#fff", border: a.on || a.mixed ? "1px solid rgba(21,144,76,.35)" : "1px solid rgba(15,35,65,.12)", overflow: "hidden" }}>
                          {/* Area tick: ticks or clears every action in the area */}
                          <button type={"button"} role={"checkbox"} aria-checked={a.mixed ? "mixed" : a.on} onClick={a.toggle} disabled={__v.permLocked} style={{ width: "100%", display: "flex", alignItems: "center", gap: "10px", textAlign: "left", padding: "9px 12px", border: "0", borderBottom: "1px solid rgba(15,35,65,.07)", background: "transparent", cursor: __v.permLocked ? "default" : "pointer" }}>
                            <PermBox on={a.on} mixed={a.mixed} />
                            <i className={a.icon} style={{ fontSize: "14px", color: "#0d3b2a" }}></i>
                            <span style={{ flex: "1", font: "600 13px Inter,sans-serif", color: "#111827" }}>{a.label}</span>
                            <span style={{ font: "500 11px Inter,sans-serif", color: "#6b7280" }}>{a.count}</span>
                          </button>
                          {/* Action ticks */}
                          <div style={{ display: "flex", flexDirection: "column", padding: "4px 0" }}>
                            {a.items.map((it) => (
                              <button key={it.k} type={"button"} role={"checkbox"} aria-checked={it.on} onClick={it.toggle} disabled={it.locked} title={it.locked && !__v.permLocked ? "You do not hold this permission yourself, so you cannot give or remove it" : it.desc} style={{ display: "flex", alignItems: "flex-start", gap: "10px", textAlign: "left", padding: "6px 12px", border: "0", background: "transparent", cursor: it.locked ? "default" : "pointer", opacity: it.locked && !__v.permLocked ? ".5" : "1" }}>
                                <PermBox on={it.on} small />
                                <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                                  <span style={{ font: "500 12.5px Inter,sans-serif", color: "#111827" }}>{it.label}</span>
                                  <span style={{ font: "400 11px Inter,sans-serif", color: "#6b7280" }}>{it.desc}</span>
                                </span>
                              </button>))}
                          </div>
                        </div>))}
                    </div>
                  </div>))}
                  {/* Department scope: which departments' staff and results they can see */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", textTransform: "uppercase" }}>Departments they can see</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {(__v.scopeOpts || []).map((o) => (
                        <button key={o.v} type={"button"} role={"radio"} aria-checked={o.on} onClick={o.pick} disabled={o.off} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "8px 12px", borderRadius: "999px", cursor: o.off ? "default" : "pointer", opacity: o.off && !o.on ? ".5" : "1", font: "500 13px Inter,sans-serif", color: "#111827", background: o.on ? "#e6f2ea" : "#fff", border: o.on ? "1px solid rgba(21,144,76,.45)" : "1px solid rgba(15,35,65,.12)" }}>
                          <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: o.on ? "0" : "1px solid rgba(15,35,65,.3)", background: o.on ? "radial-gradient(circle,#fff 0 3px,transparent 3.5px),linear-gradient(180deg,#2fb36b,#15904c)" : "#fff", boxSizing: "border-box" }}></span>{o.label}
                        </button>))}
                    </div>
                    {/* Selected departments: one tick per department */}
                    {(__v.deptPicks) ? <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" }}>
                      {__v.deptPicks.map((dp) => (
                        <button key={dp.n} type={"button"} role={"checkbox"} aria-checked={dp.on} onClick={dp.toggle} disabled={__v.permLocked} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 11px", borderRadius: "10px", cursor: __v.permLocked ? "default" : "pointer", font: "500 12.5px Inter,sans-serif", color: "#111827", background: dp.on ? "#e6f2ea" : "#fff", border: dp.on ? "1px solid rgba(21,144,76,.45)" : "1px solid rgba(15,35,65,.12)" }}>
                          <PermBox on={dp.on} small />{dp.n}
                        </button>))}
                    </div> : null}
                  </div>
                </div>
                {/* ===== USERS · New-user options (toggles) ===== */}
                {(!__v.editing) ? (<div style={{ display: "flex", flexWrap: "wrap", gap: "10px 26px" }}>
                  {(__v.newToggles || []).map((tg, $index) => (<React.Fragment key={$index}>
                    <button onClick={tg?.toggle} style={{ display: "flex", alignItems: "center", gap: "9px", background: "none", border: "0", padding: "0", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ flex: "none", width: "34px", height: "20px", borderRadius: "999px", padding: "2px", display: "flex", justifyContent: tg?.justify, background: tg?.bg }}>
                        <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff" }}></span>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ font: "500 13px Inter,sans-serif", color: "#111827" }}>{tg?.label}</span>
                        <span style={{ font: "400 11.5px Inter,sans-serif", color: "#6b7280" }}>{tg?.desc}</span>
                      </span>
                    </button>
                  </React.Fragment>))}
                </div>) : null}
                {(__v.nErr) ? (<>
                  <div style={{ padding: "9px 12px", borderRadius: "10px", background: "#fef2f2", color: "#991b1b", fontSize: "12.5px" }}>{__v.nErr}</div>
                </>) : null}
                </div>
                {/* ===== USERS · Dialog buttons (Cancel / Save) ===== */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", padding: "14px 20px", borderTop: "1px solid rgba(15,35,65,.06)", background: "rgba(255,255,255,.7)" }}>
                  <button onClick={__v.toggleAdd} style={{ height: "36px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Cancel</button>
                  <button onClick={__v.saveUser} style={{ height: "36px", padding: "0 16px", border: "0", borderRadius: "999px", background: __v.nSaveBg, color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>{__v.saveText}</button>
                </div>
              </div>
              </div>
            </>, document.body) : null}
            {/* ===== USERS · "User created" card with sign-in details ===== */}
            {(__v.created) ? (<>
              <div style={{ margin: "16px 18px", padding: "16px", border: "1px solid #a7e3c0", borderRadius: "12px", background: "#ecfbf2", display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
                <span style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#d3f4e0", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <i className={"icon-user-check"} style={{ fontSize: "18px" }}></i>
                </span>
                <div style={{ flex: "1 1 280px", minWidth: "0" }}>
                  <div style={{ fontSize: "15px", fontWeight: "600" }}>{__v.created?.title}</div>
                  <div style={{ fontSize: "13px", color: "#374151", marginTop: "4px", lineHeight: "1.5" }}>{__v.created?.note}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: "8px", marginTop: "12px" }}>
                    <div style={{ background: "#fff", border: "1px solid #d3f4e0", borderRadius: "10px", padding: "8px 10px" }}>
                      <div style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>USERNAME</div>
                      <div style={{ font: "600 13.5px 'JetBrains Mono',monospace", marginTop: "3px", overflowWrap: "anywhere" }}>{__v.created?.username}</div>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #d3f4e0", borderRadius: "10px", padding: "8px 10px" }}>
                      <div style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>EMAIL (ALSO WORKS FOR SIGN-IN)</div>
                      <div style={{ font: "500 13px Inter,sans-serif", marginTop: "3px", overflowWrap: "anywhere" }}>{__v.created?.email}</div>
                    </div>
                    <div style={{ background: "#fff", border: "1px solid #d3f4e0", borderRadius: "10px", padding: "8px 10px" }}>
                      <div style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>TEMPORARY PASSWORD</div>
                      <div style={{ font: "600 13.5px 'JetBrains Mono',monospace", marginTop: "3px" }}>{__v.created?.password}</div>
                    </div>
                  </div>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <button onClick={__v.copyCreds} style={{ height: "34px", padding: "0 12px", border: "1px solid #a7e3c0", borderRadius: "10px", background: "#fff", color: "#15803d", font: "600 12.5px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><i className={"icon-copy"} style={{ fontSize: "13px" }}></i>Copy details</button>
                  <button onClick={__v.trySignIn} style={{ height: "34px", padding: "0 12px", border: "0", borderRadius: "10px", background: "#0d3b2a", color: "#fff", font: "600 12.5px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><i className={"icon-log-in"} style={{ fontSize: "13px" }}></i>Try signing in</button>
                  <button onClick={__v.dismissCreated} style={{ background: "none", border: "0", cursor: "pointer", color: "#6b7280", display: "flex", padding: "8px" }}>
                    <i className={"icon-x"} style={{ fontSize: "15px" }}></i>
                  </button>
                </div>
              </div>
            </>) : null}
            {/* ===== USERS · Users table ===== */}
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "1280px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 150px minmax(0,1fr) 180px 160px 100px 300px", gap: "14px", padding: "10px 18px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span>USER</span>
                  <span>USERNAME</span>
                  <span>DEPARTMENT</span>
                  <span>ROLE</span>
                  <span>STATUS</span>
                  <span>LAST ACTIVE</span>
                  <span>ACTIONS</span>
                </div>
                {/* ===== USERS · Table row (role, status, Edit / Reset password / Delete) ===== */}
                {(__v.users || []).map((u, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 150px minmax(0,1fr) 180px 160px 100px 300px", gap: "14px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
                      <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px Inter,sans-serif", flex: "none" }}>{u?.initials}</span>
                      <div style={{ minWidth: "0" }}>
                        <div style={{ fontSize: "13.5px", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u?.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u?.email}</div>
                      </div>
                    </div>
                    <span style={{ font: "500 12.5px 'JetBrains Mono',monospace", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.username}</span>
                    <span style={{ fontSize: "13px", color: "#374151" }}>{u?.dept}</span>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: "0" }}>
                    {(u?.mayRole) ? <Select value={u?.role} onChange={u?.onRole} style={{ height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 6px", font: "400 12.5px Inter,sans-serif", background: "#fff" }}>
                      {(__v.roleNames || []).map((r, $index) => (<React.Fragment key={$index}>
                        <option value={r}>{r}</option>
                      </React.Fragment>))}
                    </Select> : <span style={{ fontSize: "13px", color: "#374151" }}>{u?.role}</span>}
                    {/* "Custom access" = this user's ticks differ from their role's defaults (Edit to see them); the tooltip gives the count. */}
                    {(u?.custom) ? <button onClick={u?.mayEdit ? u?.edit : undefined} title={u?.summary} type={"button"} style={{ alignSelf: "flex-start", background: "none", border: "0", padding: "0", cursor: u?.mayEdit ? "pointer" : "default", font: "500 11px Inter,sans-serif", color: "#127a42" }}>Custom access</button> : null}
                    </div>
                    <button onClick={u?.toggle} disabled={!u?.mayStatus} style={{ justifySelf: "start", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "4px 10px", border: "0", cursor: u?.mayStatus ? "pointer" : "default", background: u?.sBg, color: u?.sFg }}>{u?.status}</button>
                    <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{u?.last}</span>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {(u?.mayEdit) ? <button onClick={u?.edit} style={{ display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", background: "#fff", color: "#374151", font: "500 12px Inter,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}><i className={"icon-pencil"} style={{ fontSize: "12px" }}></i>Edit</button> : null}
                      {(u?.mayReset) ? <button onClick={u?.reset} style={{ display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", background: "#fff", color: "#374151", font: "500 12px Inter,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}><i className={"icon-key-round"} style={{ fontSize: "12px" }}></i>Reset password</button> : null}
                      {(u?.mayDel) ? <button onClick={u?.del} disabled={!!u?.delBlock} title={u?.delBlock || ('Delete ' + u?.name)} style={{ display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", border: "1px solid rgba(220,38,38,.25)", borderRadius: "7px", background: "#fff", color: "#b91c1c", font: "500 12px Inter,sans-serif", cursor: u?.delBlock ? "not-allowed" : "pointer", opacity: u?.delBlock ? ".45" : "1", whiteSpace: "nowrap" }}><i className={"icon-trash-2"} style={{ fontSize: "12px" }}></i>Delete</button> : null}
                    </div>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
            {/* ===== USERS · User count footer ===== */}
            <div style={{ padding: "12px 18px", fontSize: "12.5px", color: "#6b7280" }}>{__v.userCount}</div>
            {/* ===== USERS · Delete confirmation dialog ===== */}
            {(__v.confirmDel) ? createPortal(<>
              <div onClick={__v.cancelDel} style={{ position: "fixed", inset: "0", zIndex: "80", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px", background: "rgba(255,255,255,.45)", backdropFilter: "blur(10px) saturate(160%)", WebkitBackdropFilter: "blur(10px) saturate(160%)" }}>
                <div role={"alertdialog"} aria-modal={"true"} aria-labelledby={"del-user-title"} onClick={e => e.stopPropagation()} style={{ width: "min(440px,100%)", borderRadius: "24px", background: "linear-gradient(180deg,rgba(255,255,255,.95),rgba(255,255,255,.88))", border: "1px solid rgba(255,255,255,.95)", boxShadow: "inset 0 1px 0 #fff,0 0 0 1px rgba(15,35,65,.05),0 24px 60px rgba(15,35,65,.14)", padding: "22px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                    <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#fee2e2", color: "#b91c1c", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}><i className={"icon-trash-2"} style={{ fontSize: "18px" }}></i></span>
                    <div style={{ minWidth: "0" }}>
                      <div id={"del-user-title"} style={{ fontSize: "17px", fontWeight: "700" }}>Delete {__v.confirmDel?.name}?</div>
                      <div style={{ fontSize: "13px", color: "#4b5563", marginTop: "4px", lineHeight: "1.5" }}>They will no longer be able to sign in. This cannot be undone.</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                    <button autoFocus onClick={__v.cancelDel} style={{ height: "36px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Cancel</button>
                    <button onClick={__v.doDel} style={{ height: "36px", padding: "0 16px", border: "0", borderRadius: "999px", background: "#dc2626", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Delete user</button>
                  </div>
                </div>
              </div>
            </>, document.body) : null}
          </div>
        </>) : null}
        {/* ===== AUDIT LOG · Audit Log tab (/settings?tab=audit) ===== */}
        {(__v.isAudit) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            {/* ===== AUDIT LOG · Type filter chips & Export button ===== */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(__v.aTypes || []).map((t, $index) => (<React.Fragment key={$index}>
                  <button onClick={t?.pick} style={{ height: "30px", padding: "0 12px", borderRadius: "999px", cursor: "pointer", font: "500 12.5px Inter,sans-serif", background: t?.bg, color: t?.fg, border: `1px solid ${t?.border ?? ""}` }}>{t?.label}</button>
                </React.Fragment>))}
              </div>
              {(__v.mayAuditExport) ? <button onClick={__v.exportAudit} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "500 12.5px Inter,sans-serif", color: "#374151" }}><i className={"icon-download"} style={{ fontSize: "13px" }}></i>Export CSV</button> : null}
            </div>
            {/* ===== AUDIT LOG · Log table ===== */}
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "820px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "150px 170px 110px minmax(0,1fr) 120px", gap: "14px", padding: "10px 18px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span>TIME</span>
                  <span>USER</span>
                  <span>TYPE</span>
                  <span>EVENT</span>
                  <span>IP ADDRESS</span>
                </div>
                {(__v.logs || []).map((l, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "grid", gridTemplateColumns: "150px 170px 110px minmax(0,1fr) 120px", gap: "14px", alignItems: "center", padding: "11px 18px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "13px" }}>
                    <span style={{ font: "500 12px 'JetBrains Mono',monospace", color: "#4b5563" }}>{l?.time}</span>
                    <span style={{ color: "#111827" }}>{l?.user}</span>
                    <span style={{ justifySelf: "start", font: "600 10.5px Inter,sans-serif", borderRadius: "999px", padding: "3px 8px", background: l?.bg, color: l?.fg }}>{l?.type}</span>
                    <span style={{ color: "#374151" }}>{l?.event}</span>
                    <span style={{ font: "500 12px 'JetBrains Mono',monospace", color: "#6b7280" }}>{l?.ip}</span>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </div>
        </>) : null}
        {/* ===== SETTINGS · General tab (/settings) ===== */}
        {(__v.isSettings) ? (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
            {/* ===== SETTINGS · Assessment defaults card ===== */}
            <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Assessment defaults</div>
              <div style={{ padding: "16px 20px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Time limit (min)<input type={"number"} value={__v.st?.duration} onChange={__v.on?.duration} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window opens<input type={"time"} value={__v.st?.start} onChange={__v.on?.start} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window closes<input type={"time"} value={__v.st?.end} onChange={__v.on?.end} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window-leave limit<input type={"number"} value={__v.st?.tabLimit} onChange={__v.on?.tabLimit} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
              </div>
            </div>
            {/* ===== SETTINGS · Security, offline & data card ===== */}
            <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Security, offline &amp; data</div>
              <div style={{ padding: "8px 20px 16px" }}>
                {(__v.switches || []).map((w, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 0", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <div style={{ flex: "1" }}>
                      <div style={{ fontSize: "14px", fontWeight: "500" }}>{w?.label}</div>
                      <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "2px" }}>{w?.desc}</div>
                    </div>
                    <button onClick={w?.toggle} style={{ width: "40px", height: "22px", borderRadius: "999px", border: "0", cursor: "pointer", padding: "2px", display: "flex", justifyContent: w?.justify, background: w?.bg, flex: "none" }}>
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}></span>
                    </button>
                  </div>
                </React.Fragment>))}
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151", marginTop: "14px" }}>Keep assessment records for<Select value={__v.st?.retention} onChange={__v.on?.retention} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                    <option value={"3"}>3 years</option>
                    <option value={"5"}>5 years</option>
                    <option value={"7"}>7 years</option>
                  </Select></label>
              </div>
            </div>
          </div>
        </>) : null}
        {/* ===== HELP · Rating Scales tab (/help?tab=ratings) ===== */}
        {/* Proficiency, importance, gap and scoring scales (cards come from SMFramework.jsx RatingScales). */}
        {(__v.isRatings) ? <RatingScales data={this.props.data} /> : null}
        {/* ===== HELP · Help & Guides tab (/help) ===== */}
        {(__v.isHelp) ? (<>
          {/* ===== HELP · Quick link cards ===== */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: "12px" }}>
            {(__v.links || []).map((k, $index) => (<React.Fragment key={$index}>
              <button className={__css.h0} onClick={k?.go} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "16px 18px", borderRadius: "18px", background: "rgba(255,255,255,.62)", backdropFilter: "blur(20px) saturate(180%)", WebkitBackdropFilter: "blur(20px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", cursor: "pointer", textAlign: "left" }}>
                <span style={{ width: "40px", height: "40px", borderRadius: "12px", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <i className={k?.icon} style={{ fontSize: "18px" }}></i>
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                  <span style={{ font: "600 14px Inter,sans-serif", color: "#111827" }}>{k?.title}</span>
                  <span style={{ font: "400 12px Inter,sans-serif", color: "#6b7280" }}>{k?.sub}</span>
                </span>
              </button>
            </React.Fragment>))}
          </div>
          {/* ===== HELP · FAQ list & support form ===== */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            {/* ===== HELP · FAQ search & answers ===== */}
            <div style={{ flex: "2 1 480px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", alignItems: "center", gap: "8px" }}>
                <i className={"icon-search"} style={{ fontSize: "15px", color: "#9ca3af" }}></i>
                <input value={__v.hq} onChange={__v.onHq} placeholder={"Search help articles"} style={{ border: "0", outline: "0", flex: "1", font: "400 14px Inter,sans-serif", minWidth: "0" }} />
              </div>
              {(__v.faqs || []).map((f, $index) => (<React.Fragment key={$index}>
                <div style={{ borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <button onClick={f?.toggle} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "14px 18px", background: "none", border: "0", cursor: "pointer", textAlign: "left", font: "500 14px Inter,sans-serif", color: "#111827" }}>{f?.q}<i className={f?.chev} style={{ fontSize: "16px", color: "#6b7280", flex: "none" }}></i></button>
                  {(f?.open) ? (<>
                    <div style={{ padding: "0 18px 16px", fontSize: "13.5px", lineHeight: "1.6", color: "#4b5563", textWrap: "pretty" }}>{f?.a}</div>
                  </>) : null}
                </div>
              </React.Fragment>))}
              {(__v.noFaq) ? (<>
                <div style={{ padding: "30px", textAlign: "center", fontSize: "13.5px", color: "#6b7280" }}>No articles match your search.</div>
              </>) : null}
            </div>
            {/* ===== HELP · Contact HR / IT support form ===== */}
            <div style={{ flex: "1 1 300px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Contact HR / IT support</div>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>SUBJECT<input value={__v.tSubject} onChange={__v.onTSubject} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif" }} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>MESSAGE<textarea value={__v.tMsg} onChange={__v.onTMsg} style={{ minHeight: "110px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "10px", font: "400 13.5px/1.5 Inter,sans-serif", resize: "vertical" }}></textarea></label>
              <button onClick={__v.sendTicket} style={{ height: "38px", border: "0", borderRadius: "999px", background: __v.tBg, color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </>) : null}
        {/* ===== SETTINGS · Toast message ===== */}
        {(__v.toast) ? (<>
          <div style={{ position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "80", background: "#111827", color: "#fff", font: "500 13px Inter,sans-serif", padding: "10px 16px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: "8px" }}><i className={"icon-circle-check"} style={{ fontSize: "15px", color: "#4ade80" }}></i>{__v.toast}</div>
        </>) : null}
      </div>
    </>
    );
  }
}


export default SMSystem;
