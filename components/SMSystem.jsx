'use client';
import React from 'react';
import __css from './SMSystem.module.css';


const ROLES = ['Administrator', 'Assessment Creator', 'Manager / Supervisor', 'Participant'];
const USERS = [
  ['Adjei Denzil Asiam', 'denzilasiam.adjei@dvla.gov.gh', 'IT Department', 'Administrator', 'Active', 'Now'],
  ['Joseph Ahor Abandoh-Sam', 'joseph.abandoh-sam@dvla.gov.gh', 'IT Department', 'Manager / Supervisor', 'Active', '12 min ago'],
  ['Esi Mensah', 'esi.mensah@dvla.gov.gh', 'Human Resources', 'Assessment Creator', 'Active', '1 h ago'],
  ['Ama Owusu', 'ama.owusu@dvla.gov.gh', 'IT Department', 'Participant', 'Active', 'Today'],
  ['Kofi Boateng', 'kofi.boateng@dvla.gov.gh', 'IT Department', 'Participant', 'Active', 'Today'],
  ['Efua Asante', 'efua.asante@dvla.gov.gh', 'IT Department', 'Participant', 'Active', 'Yesterday'],
  ['Nana Appiah', 'nana.appiah@dvla.gov.gh', 'Finance', 'Manager / Supervisor', 'Active', 'Yesterday'],
  ['Akosua Ofori', 'akosua.ofori@dvla.gov.gh', 'Licensing Operations', 'Participant', 'Suspended', '3 weeks ago'],
  ['Kojo Quaye', 'kojo.quaye@dvla.gov.gh', 'Internal Audit', 'Manager / Supervisor', 'Active', '2 days ago'],
];
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
const FAQ = [
  ['Why is the assessment timed and only one day?', 'To keep it fair. Everyone completes the same assessment on the same day, in one sitting, so nobody has extra time to look up answers or get help.'],
  ['What happens if my internet drops during the assessment?', "Your answers keep saving on your device and sync when you're back online. The timer keeps running, so reconnect as quickly as you can."],
  ['Can I pause the timer?', 'No. Once you press Start, the timer runs until you submit or the time runs out. Plan for an uninterrupted block of time before you begin.'],
  ['What counts as leaving the window?', 'Switching to another tab or app, or minimising the browser. Each one is recorded, and after the set limit (3 by default) your assessment is submitted automatically.'],
  ['How is my skill gap calculated?', 'Gap = target level for your role − your actual level. Your actual level combines your self-assessment with your manager evaluation and any 360° feedback.'],
  ['Who can see my results?', 'You, your line manager and HR. Executive dashboards only show summary figures, never individual answers.'],
];
const UKEY = 'skm-users';
function slug(name) { const p = name.toLowerCase().normalize('NFKD').replace(/[^a-z\s]/g, '').trim().split(/\s+/).filter(Boolean); return p.length > 1 ? p[0] + '.' + p[p.length - 1] : (p[0] || ''); }
function genPass() { const U = 'ABCDEFGHJKLMNPQRSTUVWXYZ', l = 'abcdefghijkmnpqrstuvwxyz', n = '23456789', y = '!@#$%&*?', all = U + l + n + y, pick = s => s[Math.floor(Math.random() * s.length)];
  const a = [pick(U), pick(l), pick(n), pick(y)]; while (a.length < 10) a.push(pick(all)); return a.sort(() => Math.random() - 0.5).join(''); }
function loadUsers() {
  try { const u = JSON.parse(localStorage.getItem(UKEY) || 'null'); if (Array.isArray(u) && u.length) return u; } catch (e) {}
  return USERS.map((u, i) => ({ id: i, name: u[0], email: u[1], dept: u[2], role: u[3], status: u[4], last: u[5], username: u[1].split('@')[0], password: 'Password@1', mustChange: false }));
}
const TYPEC = { Auth: ['#e0e7ff', '#3730a3'], Assessment: ['#dcfce7', '#15803d'], Integrity: ['#fee2e2', '#b91c1c'], Config: ['#fef3c7', '#92400e'], Export: ['#e0f2fe', '#0369a1'] };
class SMSystem extends React.Component {
  state = { toast: '', uq: '', uRole: 'All', users: loadUsers(),
    adding: false, nName: '', nEmail: '', nDept: 'IT Department', nRole: 'Participant', nUser: '', userTouched: false, nPass: genPass(), showPass: false, mustChange: true, sendEmail: true, created: null, nErr: '', aType: 'All',
    st: { duration: 45, start: '09:00', end: '17:00', tabLimit: 3, retention: '5', mfa: true, offline: true, encrypt: true, notify: true, anon: true }, sDirty: false,
    hq: '', open: { 0: true }, tSubject: '', tMsg: '' };
  componentDidMount() { try { if (!localStorage.getItem(UKEY)) localStorage.setItem(UKEY, JSON.stringify(this.state.users)); } catch (e) {} }
  setState(u, cb) { return super.setState(u, () => { this.persistUsers(); cb && cb(); }); }
  persistUsers() { const u = this.state.users; if (u && u !== this._savedUsers) { this._savedUsers = u; try { localStorage.setItem(UKEY, JSON.stringify(u)); } catch (e) {} } }
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  renderVals() {
    const d = this.props.data, s = this.state, go = this.props.go || (() => {});
    if (!d) return {};
    const rawView = this.props.view;
    const view = (rawView === 'system' ? 'settings' : rawView) || 'users';
    const q = s.uq.trim().toLowerCase();
    const users = s.users.filter(u => (s.uRole === 'All' || u.role === s.uRole) && (!q || (u.name + u.email).toLowerCase().includes(q)));
    const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s.nEmail.trim()), uname = s.nUser.trim().toLowerCase();
    const userOk = /^[a-z0-9._-]{3,30}$/.test(uname), userTaken = s.users.some(x => (x.username || '').toLowerCase() === uname), emailTaken = s.users.some(x => x.email.toLowerCase() === s.nEmail.trim().toLowerCase());
    const passOk = s.nPass.length >= 8 && /[A-Z]/.test(s.nPass) && /[a-z]/.test(s.nPass) && /\d/.test(s.nPass);
    const canAdd = s.nName.trim() && emailOk && userOk && !userTaken && !emailTaken && passOk;
    const logs = LOGS.filter(l => s.aType === 'All' || l[2] === s.aType);
    const setSt = (k, v) => this.setState({ st: { ...this.state.st, [k]: v }, sDirty: true });
    const hq = s.hq.trim().toLowerCase(), faqs = FAQ.map((f, i) => ({ f, i })).filter(({ f }) => !hq || (f[0] + f[1]).toLowerCase().includes(hq));
    const canSend = s.tSubject.trim() && s.tMsg.trim().length > 5;
    return {
      title: { users: 'User Management', audit: 'Audit Logs', settings: 'System Settings', help: 'Help & Guides' }[view],
      subtitle: { users: 'Manage who can sign in and what each role can do', audit: 'A tamper-evident record of sign-ins, assessments, integrity events and changes', settings: 'Platform-wide defaults for assessments, security and data', help: 'Answers about the timed assessment, scoring and your results' }[view],
      isUsers: view === 'users', isAudit: view === 'audit', isSettings: view === 'settings', isHelp: view === 'help',
      uq: s.uq, onUq: e => this.setState({ uq: e.target.value }), uRole: s.uRole, onURole: e => this.setState({ uRole: e.target.value }), roleNames: ROLES, deptNames: d.depts.map(x => x.name),
      adding: s.adding, toggleAdd: () => this.setState({ adding: !s.adding, created: null, nErr: '' }), nName: s.nName, nEmail: s.nEmail, nDept: s.nDept, nRole: s.nRole,
      onNName: e => { const v = e.target.value; this.setState(st => ({ nName: v, nErr: '', nUser: st.userTouched ? st.nUser : slug(v) })); }, onNEmail: e => this.setState({ nEmail: e.target.value }), onNDept: e => this.setState({ nDept: e.target.value }), onNRole: e => this.setState({ nRole: e.target.value }),
      nSaveBg: canAdd ? '#15904c' : '#a3acb9',
      nUser: s.nUser, onNUser: e => this.setState({ nUser: e.target.value.replace(/\s/g, '').toLowerCase(), userTouched: true, nErr: '' }),
      userBorder: uname && (!userOk || userTaken) ? '#fca5a5' : 'rgba(15,35,65,.14)',
      userHint: !uname ? 'Filled in from the name. You can change it.' : !userOk ? '3–30 characters: letters, numbers, dot, dash or underscore' : userTaken ? 'This username is already taken' : 'Available',
      userHintColor: uname && (!userOk || userTaken) ? '#b91c1c' : uname ? '#15803d' : '#6b7280',
      nPass: s.nPass, onNPass: e => this.setState({ nPass: e.target.value, nErr: '' }), passType: s.showPass ? 'text' : 'password', passIcon: s.showPass ? 'icon-eye-off' : 'icon-eye',
      toggleShowPass: () => this.setState({ showPass: !s.showPass }), genPass: () => this.setState({ nPass: genPass(), showPass: true }),
      passBorder: s.nPass && !passOk ? '#fca5a5' : 'rgba(15,35,65,.14)', passHint: passOk ? 'Strong enough for a temporary password' : 'At least 8 characters with uppercase, lowercase and a number', passHintColor: passOk ? '#15803d' : '#b45309',
      newToggles: [['mustChange', 'Ask for a new password at first sign-in', 'The temporary password only works once'], ['sendEmail', 'Email sign-in details to the user', 'Sends the username and temporary password to their work email']]
        .map(([k, label, desc]) => ({ label, desc, justify: s[k] ? 'flex-end' : 'flex-start', bg: s[k] ? '#0d3b2a' : '#d1d5db', toggle: () => this.setState({ [k]: !this.state[k] }) })),
      nErr: s.nErr,
      saveUser: () => {
        if (!canAdd) { this.setState({ nErr: !s.nName.trim() ? 'Enter a full name.' : !emailOk ? 'Enter a valid email address.' : emailTaken ? 'A user with this email already exists.' : !userOk || userTaken ? 'Choose a valid, unused username.' : 'Use a stronger temporary password.' }); return; }
        const u = { id: Date.now(), name: s.nName.trim(), email: s.nEmail.trim(), username: uname, password: s.nPass, mustChange: s.mustChange, dept: s.nDept, role: s.nRole, status: s.mustChange ? 'Must change password' : 'Active', last: 'Never signed in' };
        const note = (s.sendEmail ? 'Sign-in details have been emailed to ' + u.email + '. ' : 'Share these details with them securely. ') + (s.mustChange ? 'They will be asked to set their own password the first time they sign in.' : 'They can sign in with this password straight away.');
        this.setState({ users: [u, ...s.users], adding: false, nName: '', nEmail: '', nUser: '', userTouched: false, nPass: genPass(), showPass: false, nErr: '', created: { ...u, title: u.name + ' has been added', note } });
        this.flash('User created' + (s.sendEmail ? ', details emailed' : '')); },
      created: s.created, dismissCreated: () => this.setState({ created: null }),
      copyCreds: () => { const c = s.created; const t = 'Skill Matrix sign-in\nUsername: ' + c.username + '\nEmail: ' + c.email + '\nTemporary password: ' + c.password; try { navigator.clipboard.writeText(t); } catch (e) {} this.flash('Sign-in details copied'); },
      trySignIn: () => go('signin'),
      users: users.map(u => ({ ...u, initials: u.name.split(' ').map(x => x[0]).slice(0, 2).join(''), sBg: u.status === 'Active' ? '#dcfce7' : u.status === 'Suspended' ? '#fee2e2' : '#fef3c7', sFg: u.status === 'Active' ? '#15803d' : u.status === 'Suspended' ? '#b91c1c' : '#92400e', username: u.username || '—',
        reset: () => { const p = genPass(); this.setState({ users: this.state.users.map(x => x.id === u.id ? { ...x, password: p, mustChange: true, status: x.status === 'Suspended' ? 'Suspended' : 'Must change password' } : x), created: { ...u, password: p, title: 'Password reset for ' + u.name, note: 'Give ' + u.name.split(' ')[0] + ' this temporary password. They will set a new one the next time they sign in.' } }); this.flash('Temporary password generated'); },
        onRole: e => { const r = e.target.value; this.setState({ users: this.state.users.map(x => x.id === u.id ? { ...x, role: r } : x) }); this.flash(u.name + ' is now ' + r); },
        toggle: () => this.setState({ users: this.state.users.map(x => x.id === u.id ? { ...x, status: x.status === 'Suspended' ? (x.mustChange ? 'Must change password' : 'Active') : 'Suspended' } : x) }) })),
      userCount: users.length + ' of ' + s.users.length + ' users',
      aTypes: ['All', 'Auth', 'Assessment', 'Integrity', 'Config', 'Export'].map(t => { const on = s.aType === t; return { label: t, pick: () => this.setState({ aType: t }), bg: on ? '#0d3b2a' : '#fff', fg: on ? '#fff' : '#374151', border: on ? '#0d3b2a' : 'rgba(15,35,65,.14)' }; }),
      logs: logs.map((l, i) => ({ time: l[0], user: l[1], type: l[2], event: l[3], ip: '10.20.' + (4 + i) + '.' + (17 + i * 13), bg: TYPEC[l[2]][0], fg: TYPEC[l[2]][1] })),
      exportAudit: () => { try { const csv = ['Time,User,Type,Event', ...logs.map(l => l.map(x => '"' + x + '"').join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'audit-log.csv'; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {} this.flash('Audit log exported'); },
      st: s.st, on: Object.fromEntries(['duration', 'start', 'end', 'tabLimit', 'retention'].map(k => [k, e => setSt(k, ['duration', 'tabLimit'].includes(k) ? +e.target.value : e.target.value)])),
      switches: [['mfa', 'Require multi-factor sign-in', 'For administrators and managers'], ['offline', 'Allow offline assessments', 'Answers cached on the device and synced automatically'], ['encrypt', 'Encrypt offline data', 'AES-256 on the device'], ['notify', 'Email staff before assessment day', 'Reminders 3 days and 1 day before'], ['anon', 'Keep 360° feedback anonymous', 'Only HR can see who gave feedback']]
        .map(([k, label, desc]) => ({ label, desc, justify: s.st[k] ? 'flex-end' : 'flex-start', bg: s.st[k] ? '#0d3b2a' : '#d1d5db', toggle: () => setSt(k, !s.st[k]) })),
      sSaveBg: s.sDirty ? '#15904c' : '#a3acb9', sSaveText: s.sDirty ? 'Save settings' : 'All changes saved',
      saveSettings: () => { if (!s.sDirty) return; this.setState({ sDirty: false }); this.flash('Settings saved'); },
      links: [{ icon: 'icon-timer', title: 'Take your assessment', sub: 'Open today · ' + d.cycle.window, go: () => go('take') }, { icon: 'icon-sliders-horizontal', title: 'Rating scales explained', sub: 'Proficiency, importance and gap', go: () => go('scales') }, { icon: 'icon-user', title: 'Your skill profile', sub: 'Gaps and development plan', go: () => go('profile', 'skills') }],
      hq: s.hq, onHq: e => this.setState({ hq: e.target.value }), noFaq: faqs.length === 0,
      faqs: faqs.map(({ f, i }) => ({ q: f[0], a: f[1], open: !!s.open[i], chev: s.open[i] ? 'icon-chevron-up' : 'icon-chevron-down', toggle: () => this.setState({ open: { ...this.state.open, [i]: !this.state.open[i] } }) })),
      tSubject: s.tSubject, tMsg: s.tMsg, onTSubject: e => this.setState({ tSubject: e.target.value }), onTMsg: e => this.setState({ tMsg: e.target.value }), tBg: canSend ? '#15904c' : '#a3acb9',
      sendTicket: () => { if (!canSend) { this.flash('Add a subject and a message'); return; } this.setState({ tSubject: '', tMsg: '' }); this.flash('Ticket sent. We usually reply within one working day.'); },
      toast: s.toast,
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div>
          <h1 style={{ margin: "0", fontSize: "clamp(24px,3vw,30px)", fontWeight: "700", letterSpacing: "-0.5px" }}>{__v.title}</h1>
          <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>{__v.subtitle}</div>
        </div>
        {(__v.isUsers) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div style={{ flex: "1 1 220px", display: "flex", alignItems: "center", gap: "8px", height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px" }}>
                <i className={"icon-search"} style={{ fontSize: "14px", color: "#9ca3af" }}></i>
                <input value={__v.uq} onChange={__v.onUq} placeholder={"Search name, email or staff ID"} style={{ border: "0", outline: "0", flex: "1", minWidth: "0", font: "400 13.5px Inter,sans-serif" }} />
              </div>
              <select value={__v.uRole} onChange={__v.onURole} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                <option value={"All"}>All roles</option>
                {(__v.roleNames || []).map((r, $index) => (<React.Fragment key={$index}>
                  <option value={r}>{r}</option>
                </React.Fragment>))}
              </select>
              <button onClick={__v.toggleAdd} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-user-plus"} style={{ fontSize: "14px" }}></i>Add user</button>
            </div>
            {(__v.adding) ? (<>
              <div style={{ padding: "18px", background: "rgba(255,255,255,.4)", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "15px", fontWeight: "600" }}>New user</span>
                  <span style={{ fontSize: "12px", color: "#6b7280" }}>They sign in with a username or email, plus a temporary password</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: "12px" }}>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>FULL NAME<input value={__v.nName} onChange={__v.onNName} placeholder={"e.g. Ama Owusu"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0" }} /></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>EMAIL<input value={__v.nEmail} onChange={__v.onNEmail} placeholder={"name@dvla.gov.gh"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0" }} /></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>DEPARTMENT<select value={__v.nDept} onChange={__v.onNDept} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", background: "#fff" }}>
                      {(__v.deptNames || []).map((n, $index) => (<React.Fragment key={$index}>
                        <option value={n}>{n}</option>
                      </React.Fragment>))}
                    </select></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>ROLE<select value={__v.nRole} onChange={__v.onNRole} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", background: "#fff" }}>
                      {(__v.roleNames || []).map((r, $index) => (<React.Fragment key={$index}>
                        <option value={r}>{r}</option>
                      </React.Fragment>))}
                    </select></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>USERNAME<input value={__v.nUser} onChange={__v.onNUser} placeholder={"firstname.lastname"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif", minWidth: "0", fontFamily: "'JetBrains Mono',monospace", borderColor: __v.userBorder }} /><span style={{ font: "400 11.5px Inter,sans-serif", letterSpacing: "0", color: __v.userHintColor }}>{__v.userHint}</span></label>
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
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 26px" }}>
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
                </div>
                {(__v.nErr) ? (<>
                  <div style={{ padding: "9px 12px", borderRadius: "10px", background: "#fef2f2", color: "#991b1b", fontSize: "12.5px" }}>{__v.nErr}</div>
                </>) : null}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
                  <button onClick={__v.toggleAdd} style={{ height: "36px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Cancel</button>
                  <button onClick={__v.saveUser} style={{ height: "36px", padding: "0 16px", border: "0", borderRadius: "999px", background: __v.nSaveBg, color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Create user</button>
                </div>
              </div>
            </>) : null}
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
            <div style={{ overflowX: "auto" }}>
              <div style={{ minWidth: "1100px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 150px minmax(0,1fr) 180px 160px 100px 120px", gap: "14px", padding: "10px 18px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span>USER</span>
                  <span>USERNAME</span>
                  <span>DEPARTMENT</span>
                  <span>ROLE</span>
                  <span>STATUS</span>
                  <span>LAST ACTIVE</span>
                  <span>ACTIONS</span>
                </div>
                {(__v.users || []).map((u, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1.4fr) 150px minmax(0,1fr) 180px 160px 100px 120px", gap: "14px", alignItems: "center", padding: "12px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "0" }}>
                      <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px Inter,sans-serif", flex: "none" }}>{u?.initials}</span>
                      <div style={{ minWidth: "0" }}>
                        <div style={{ fontSize: "13.5px", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u?.name}</div>
                        <div style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{u?.email}</div>
                      </div>
                    </div>
                    <span style={{ font: "500 12.5px 'JetBrains Mono',monospace", color: "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u?.username}</span>
                    <span style={{ fontSize: "13px", color: "#374151" }}>{u?.dept}</span>
                    <select value={u?.role} onChange={u?.onRole} style={{ height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 6px", font: "400 12.5px Inter,sans-serif", background: "#fff" }}>
                      {(__v.roleNames || []).map((r, $index) => (<React.Fragment key={$index}>
                        <option value={r}>{r}</option>
                      </React.Fragment>))}
                    </select>
                    <button onClick={u?.toggle} style={{ justifySelf: "start", font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "4px 10px", border: "0", cursor: "pointer", background: u?.sBg, color: u?.sFg }}>{u?.status}</button>
                    <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{u?.last}</span>
                    <button onClick={u?.reset} style={{ justifySelf: "start", display: "flex", alignItems: "center", gap: "5px", height: "30px", padding: "0 10px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", background: "#fff", color: "#374151", font: "500 12px Inter,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}><i className={"icon-key-round"} style={{ fontSize: "12px" }}></i>Reset password</button>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
            <div style={{ padding: "12px 18px", fontSize: "12.5px", color: "#6b7280" }}>{__v.userCount}</div>
          </div>
        </>) : null}
        {(__v.isAudit) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center", justifyContent: "space-between", padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {(__v.aTypes || []).map((t, $index) => (<React.Fragment key={$index}>
                  <button onClick={t?.pick} style={{ height: "30px", padding: "0 12px", borderRadius: "999px", cursor: "pointer", font: "500 12.5px Inter,sans-serif", background: t?.bg, color: t?.fg, border: `1px solid ${t?.border ?? ""}` }}>{t?.label}</button>
                </React.Fragment>))}
              </div>
              <button onClick={__v.exportAudit} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", border: "1px solid #e5e7eb", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "500 12.5px Inter,sans-serif", color: "#374151" }}><i className={"icon-download"} style={{ fontSize: "13px" }}></i>Export CSV</button>
            </div>
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
        {(__v.isSettings) ? (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
            <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Assessment defaults</div>
              <div style={{ padding: "16px 20px 20px", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Time limit (min)<input type={"number"} value={__v.st?.duration} onChange={__v.on?.duration} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window opens<input type={"time"} value={__v.st?.start} onChange={__v.on?.start} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window closes<input type={"time"} value={__v.st?.end} onChange={__v.on?.end} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window-leave limit<input type={"number"} value={__v.st?.tabLimit} onChange={__v.on?.tabLimit} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
              </div>
            </div>
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
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151", marginTop: "14px" }}>Keep assessment records for<select value={__v.st?.retention} onChange={__v.on?.retention} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                    <option value={"3"}>3 years</option>
                    <option value={"5"}>5 years</option>
                    <option value={"7"}>7 years</option>
                  </select></label>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button onClick={__v.saveSettings} style={{ height: "40px", padding: "0 20px", border: "0", borderRadius: "999px", background: __v.sSaveBg, color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>{__v.sSaveText}</button>
          </div>
        </>) : null}
        {(__v.isHelp) ? (<>
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
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
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
            <div style={{ flex: "1 1 300px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "18px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Contact HR / IT support</div>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>SUBJECT<input value={__v.tSubject} onChange={__v.onTSubject} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif" }} /></label>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>MESSAGE<textarea value={__v.tMsg} onChange={__v.onTMsg} style={{ minHeight: "110px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "10px", font: "400 13.5px/1.5 Inter,sans-serif", resize: "vertical" }}></textarea></label>
              <button onClick={__v.sendTicket} style={{ height: "38px", border: "0", borderRadius: "999px", background: __v.tBg, color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Send</button>
            </div>
          </div>
        </>) : null}
        {(__v.toast) ? (<>
          <div style={{ position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "80", background: "#111827", color: "#fff", font: "500 13px Inter,sans-serif", padding: "10px 16px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: "8px" }}><i className={"icon-circle-check"} style={{ fontSize: "15px", color: "#4ade80" }}></i>{__v.toast}</div>
        </>) : null}
      </div>
    </>
    );
  }
}


export default SMSystem;
