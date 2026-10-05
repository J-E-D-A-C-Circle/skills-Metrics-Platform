'use client';
import React from 'react';
import __css from './SkillMatrixApp.module.css';
import SMSignIn from './SMSignIn';
import SMAssessmentSession from './SMAssessmentSession';
import SMHome from './SMHome';
import SMProfile from './SMProfile';
import SMAssessments from './SMAssessments';
import SMTeam from './SMTeam';
import SMAnalytics from './SMAnalytics';
import SMFramework from './SMFramework';
import SMFormBuilder from './SMFormBuilder';
import SMSystem from './SMSystem';


function buildData() {
  const GAP = [
    { n: 0, label: 'No Gap', bg: '#d6336c', fg: '#fff', desc: "The employee's current skill level fully meets or exceeds the required level." },
    { n: 1, label: 'Minimal', bg: '#1c8fd1', fg: '#fff', desc: 'Very close to the required level. Only minor improvements or refinements are needed.' },
    { n: 2, label: 'Moderate', bg: '#2f9e44', fg: '#fff', desc: 'Close to the required level. Some improvement and refinement is needed.' },
    { n: 3, label: 'Noticeable', bg: '#f2c200', fg: '#3b2f00', desc: 'Noticeably below the required level. Significant training and practice are needed.' },
    { n: 4, label: 'Significant', bg: '#f08c00', fg: '#fff', desc: 'Well below the required level. Extensive training and development are required.' },
    { n: 5, label: 'Critical', bg: '#e03131', fg: '#fff', desc: 'Far below the required level. Immediate, intensive training and ongoing support are necessary.' },
  ];
  const IMP = [null,
    { n: 1, label: 'Not Important', short: 'Not Important', bg: '#1c8fd1', fg: '#fff', desc: "Peripheral to the job role; a 'nice-to-have' but not essential." },
    { n: 2, label: 'Of Minor Importance', short: 'Minor', bg: '#2f9e44', fg: '#fff', desc: 'Occasionally useful, but not central; enhances some tasks.' },
    { n: 3, label: 'Moderately Important', short: 'Moderate', bg: '#f2c200', fg: '#3b2f00', desc: 'Regularly used; expected for the role.' },
    { n: 4, label: 'Very Important', short: 'Very Important', bg: '#f08c00', fg: '#fff', desc: 'Frequently used; absence hinders performance; defining the role.' },
    { n: 5, label: 'Critically Important', short: 'Critical', bg: '#e03131', fg: '#fff', desc: 'Indispensable for primary responsibilities; must-have for the job.' }];
  const LEVEL = ['Not rated', 'Novice', 'Basic', 'Competent', 'Proficient', 'Expert'];
  const PROF = [null,
    { n: 1, label: 'Novice', desc: 'Limited understanding of the skill. Requires significant guidance and is in the early stages of learning.' },
    { n: 2, label: 'Basic', desc: 'Has foundational knowledge but lacks hands-on experience. Can perform simple tasks with some assistance.' },
    { n: 3, label: 'Competent', desc: 'Comfortable with the skill. Can perform tasks independently but may require occasional guidance for complex challenges.' },
    { n: 4, label: 'Proficient', desc: 'Strong understanding with extensive hands-on experience. Can handle complex tasks and resolve issues effectively.' },
    { n: 5, label: 'Expert', desc: 'Mastery of the skill. Recognized as a go-to person for challenges and can guide or train others.' }];
  const SKILLS = [
    { name: 'Systems & Infrastructure', items: [['Network Administration', 'Network', 5, 4, 3, 'CCNA verified'], ['Server Management', 'Servers', 4, 4, 3], ['Backup & Disaster Recovery', 'Backup & DR', 4, 4, 1]] },
    { name: 'Software & Data', items: [['Database Administration', 'Databases', 4, 4, 2], ['Application Support', 'App Support', 5, 4, 4], ['Data Analysis & Reporting', 'Data & Reports', 3, 3, 3]] },
    { name: 'Cybersecurity', items: [['Identity & Access Management', 'IAM', 5, 4, 3], ['Incident Response', 'Incident Resp.', 5, 5, 1], ['Cloud Services', 'Cloud', 3, 3, 1]] },
    { name: 'IT Service Management', items: [['Helpdesk & Ticketing', 'Helpdesk', 4, 3, 4, 'ITIL 4 verified'], ['Change Management', 'Change Mgmt', 3, 3, 2], ['Stakeholder Communication', 'Communication', 3, 3, 3]] },
  ];
  const comps = [];
  SKILLS.forEach(m => m.items.forEach(([name, short, importance, target, actual, evidence], i) => {
    const gap = Math.max(0, target - actual);
    comps.push({ id: comps.length + 1, name, short, major: m.name, importance, target, actual, gap, evidence: evidence || '' });
  }));
  const fmt = n => (Math.round(n * 10) / 10).toFixed(1);
  const majors = SKILLS.map(m => {
    const cs = comps.filter(c => c.major === m.name);
    const t = cs.reduce((a, c) => a + c.target, 0) / cs.length, a = cs.reduce((x, c) => x + c.actual, 0) / cs.length;
    return { name: m.name, count: cs.length, target: fmt(t), actual: fmt(a), t, a };
  });
  const team = [
    { id: 't1', name: 'Adjei Denzil Asiam', role: 'IT Officer', gaps: [1, 1, 2, 0], self: 'Submitted', eval: 'Pending' },
    { id: 't2', name: 'Ama Owusu', role: 'Network Engineer', gaps: [0, 2, 1, 1], self: 'Submitted', eval: 'Evaluated' },
    { id: 't3', name: 'Kofi Boateng', role: 'Database Administrator', gaps: [2, 0, 3, 1], self: 'Submitted', eval: 'Pending' },
    { id: 't4', name: 'Efua Asante', role: 'Systems Analyst', gaps: [1, 1, 2, 0], self: 'Not started', eval: 'Locked' },
    { id: 't5', name: 'Yaw Darko', role: 'Helpdesk Lead', gaps: [3, 2, 4, 0], self: 'Submitted', eval: 'Pending' },
    { id: 't6', name: 'Abena Frimpong', role: 'Security Analyst', gaps: [2, 1, 0, 1], self: 'In progress', eval: 'Locked' },
  ];
  const categories = ['Technical', 'Digital Literacy', 'Leadership', 'Customer Service', 'Compliance'];
  const depts = [
    { name: 'IT Department', staff: 24, assessed: 22, trend: [2.6, 2.8, 2.9, 3.1], gaps: [1, 0, 2, 1, 1] },
    { name: 'Human Resources', staff: 18, assessed: 17, trend: [2.9, 3.0, 3.1, 3.2], gaps: [2, 1, 1, 0, 0] },
    { name: 'Finance', staff: 31, assessed: 27, trend: [3.0, 3.0, 3.2, 3.3], gaps: [1, 2, 2, 1, 0] },
    { name: 'Licensing Operations', staff: 142, assessed: 121, trend: [2.4, 2.5, 2.7, 2.8], gaps: [2, 3, 2, 1, 2] },
    { name: 'Vehicle Registration', staff: 118, assessed: 104, trend: [2.5, 2.6, 2.6, 2.9], gaps: [2, 3, 3, 2, 1] },
    { name: 'Internal Audit', staff: 12, assessed: 12, trend: [3.2, 3.3, 3.4, 3.4], gaps: [0, 1, 1, 1, 0] },
    { name: 'Customer Service', staff: 64, assessed: 58, trend: [2.7, 2.8, 3.0, 3.0], gaps: [3, 2, 2, 0, 1] },
  ];
  const now = new Date(), add = d => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
  const dl = (d, o) => d.toLocaleDateString('en-GB', o || { weekday: 'short', day: 'numeric', month: 'short' });
  const cycle = {
    name: 'Q4 2026 Skills Assessment', short: 'Q4 2026', day: add(0), dayLabel: dl(add(0)), dayLong: dl(add(0), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    window: '09:00 – 17:00', durationMin: 45, tabLimit: 3, questions: 18,
    mgrClose: add(2), mgrCloseLabel: dl(add(2)), results: add(7), resultsLabel: dl(add(7)), plans: add(14), plansLabel: dl(add(14)),
  };
  const user = { name: 'ADJEI DENZIL ASIAM', first: 'DENZIL', last: 'ADJEI', other: 'ASIAM', email: 'denzilasiam.adjei@dvla.gov.gh', mobile: '0256488784', id: '123456789', dept: 'IT DEPARTMENT', designation: 'IT OFFICER', location: 'HEAD OFFICE', dob: '13 April 1998', gender: 'Male', manager: 'HOD: Joseph Ahor Abandoh-Sam', target: 'IT Officer · Grade 10 · Technical Track' };
  return { GAP, IMP, LEVEL, PROF, SKILLS, comps, majors, team, categories, depts, cycle, user, fmt };
}
const DATA = buildData();
const NAV = [
  { label: '', items: [['Home', 'icon-house', 'home'], ['My Profile', 'icon-circle-user', 'profile']] },
  { label: 'Assessments', items: [['My Assessments', 'icon-clipboard-list', 'assessments'], ['Take Assessment', 'icon-timer', 'take'], ['Evidence & Certifications', 'icon-award', 'evidence'], ['Development Plan', 'icon-target', 'plan']] },
  { label: 'My Team', roles: ['manager', 'admin'], items: [['Team Evaluations', 'icon-users', 'team-evals'], ['360° Feedback', 'icon-refresh-cw', 'feedback'], ['Plan Approvals', 'icon-badge-check', 'approvals']] },
  { label: 'Analytics & Reports', roles: ['manager', 'admin'], items: [['Executive Dashboard', 'icon-chart-column', 'dashboard'], ['Skill Heatmap', 'icon-grid-3x3', 'heatmap'], ['Report Builder', 'icon-file-spreadsheet', 'reports'], ['Scheduled Reports', 'icon-calendar-clock', 'schedules']] },
  { label: 'Skill Framework', roles: ['creator', 'admin'], items: [['Form Builder', 'icon-file-pen-line', 'forms'], ['Competency Library', 'icon-network', 'library'], ['Target Profiles', 'icon-crosshair', 'targets'], ['Rating Scales', 'icon-sliders-horizontal', 'scales'], ['Assessment Scheduling', 'icon-calendar-cog', 'builder']] },
  { label: 'Administration', roles: ['admin'], items: [['User Management', 'icon-user-cog', 'users'], ['Audit Logs', 'icon-scroll-text', 'audit'], ['System Settings', 'icon-settings', 'settings']] },
  { label: 'Support', items: [['Help & Guides', 'icon-life-buoy', 'help']] },
];
const GROUP = { assessments: 'assess', evidence: 'assess', 'team-evals': 'team', feedback: 'team', approvals: 'team', dashboard: 'analytics', heatmap: 'analytics', reports: 'analytics', schedules: 'analytics', library: 'framework', targets: 'framework', scales: 'framework', builder: 'framework', users: 'system', audit: 'system', settings: 'system', help: 'system' };
class SkillMatrixApp extends React.Component {
  state = { page: this.props.routePage ?? this.props.startPage ?? 'home', active: this.props.routePage ?? this.props.startPage ?? 'home', tab: this.props.routeTab || 'account', history: [], vw: typeof window !== 'undefined' ? window.innerWidth : 1440,
    navOpen: false, bellOpen: false, query: '', closed: {}, status: 'not_started',
    notesOpen: false, notes: [], selId: null, draft: { title: '', body: '' }, dirty: false };
  componentDidMount() {
    this.onResize = () => this.setState({ vw: window.innerWidth, vh: window.innerHeight });
    this.onResize();
    try { if (localStorage.getItem('skm-nav-pin') === '1') this.setState({ pinned: true }); } catch (e) {}
    window.addEventListener('resize', this.onResize);
    try { const n = JSON.parse(localStorage.getItem('skm-notes') || '[]'); if (Array.isArray(n)) this.setState({ notes: n }); } catch (e) {}
    try { const s = JSON.parse(localStorage.getItem('skm-session') || 'null'); if (s) this.setState({ status: s.submittedAt ? 'submitted' : 'in_progress' }); } catch (e) {}
  }
  componentDidUpdate(pp) {
    const rp = this.props.routePage;
    if (rp && rp !== pp.routePage && rp !== this.state.page) this.setState({ page: rp, active: rp === 'profile' && this.props.routeTab === 'plan' ? 'plan' : rp, tab: this.props.routeTab || 'account' });
  }
  componentWillUnmount() { window.removeEventListener('resize', this.onResize); }
  go = (key, tab) => {
    let page = key, t = tab || 'account';
    if (key === 'plan') { page = 'profile'; t = 'plan'; }
    this.setState(s => ({ page, active: key, tab: t, navOpen: false, bellOpen: false, history: [...s.history, s.active].slice(-20) }));
    this.props.onNavigate && this.props.onNavigate(page, t);
    try { window.scrollTo(0, 0); } catch (e) {}
  };
  persist(notes) { try { localStorage.setItem('skm-notes', JSON.stringify(notes)); } catch (e) {} }
  select(id) { const n = this.state.notes.find(x => x.id === id); this.setState({ selId: id, draft: { title: n.title, body: n.body }, dirty: false }); }
  renderVals() {
    const s = this.state, set = o => this.setState(o);
    const role = s.roleOverride || this.props.role || 'admin';
    const compact = s.vw < 1100, vw = s.vw, exp = compact || s.pinned || s.hover, floating = !compact && !s.pinned && s.hover;
    const q = s.query.trim().toLowerCase();
    const statusBadge = { not_started: ['Open today', '#ffedd5', '#9a3412'], in_progress: ['In progress', '#fee2e2', '#b91c1c'], submitted: ['Submitted', '#dcfce7', '#15803d'] }[s.status];
    const groups = NAV.filter(g => !g.roles || g.roles.includes(role)).map(g => {
      const items = g.items.filter(i => !q || i[0].toLowerCase().includes(q)).map(([label, icon, key]) => {
        const on = key === s.active;
        const b = key === 'take' ? statusBadge : key === 'team-evals' ? ['3', '#ffedd5', '#9a3412'] : key === 'approvals' ? ['2', '#ffedd5', '#9a3412'] : null;
        return { label, icon, onClick: () => this.go(key), exp, dot: !exp && !!b,
          w: exp ? '100%' : '46px', h: exp ? '42px' : '46px', pad: exp ? '0 10px 0 12px' : '0', justify: exp ? 'flex-start' : 'center',
          bg: on ? 'linear-gradient(180deg,#2fb36b,#15904c)' : 'transparent', hoverBg: on ? 'linear-gradient(180deg,#3cc078,#1a9a53)' : 'rgba(255,255,255,.7)',
          shadow: on ? '0 8px 18px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)' : 'none',
          color: on ? '#fff' : '#334155', iconColor: on ? '#fff' : '#64748b',
          badge: b ? b[0] : '', badgeBg: on ? 'rgba(255,255,255,.95)' : (key === 'take' ? b && b[1] : '#ff3b30'), badgeFg: on ? '#15904c' : (key === 'take' ? b && b[2] : '#fff') };
      });
      const open = q ? true : !s.closed[g.label || 'Menu'];
      return { label: g.label, countLabel: (g.label || 'Menu') + ' · ' + items.length, showLabel: exp, showDivider: !exp && !!g.label, align: exp ? 'stretch' : 'center', items, open: exp ? open : true, chev: open ? 'icon-chevron-up' : 'icon-chevron-down', toggle: () => set({ closed: { ...s.closed, [g.label || 'Menu']: open } }) };
    }).filter(g => g.items.length);
    const grp = GROUP[s.page];
    const sel = s.notes.find(n => n.id === s.selId);
    const noteList = s.notes.map(n => ({ title: n.title || 'Untitled note', preview: n.body ? n.body.slice(0, 60) : 'Empty note',
      bg: n.id === s.selId ? '#262838' : 'transparent', accent: n.id === s.selId ? '#f5a623' : 'transparent', select: () => this.select(n.id) }));
    const notifs = [
      { icon: 'icon-timer', title: s.status === 'submitted' ? 'Assessment submitted' : 'Your assessment is open today', sub: DATA.cycle.dayLabel + ' · ' + DATA.cycle.window + ' · ' + DATA.cycle.durationMin + ' min', onClick: () => this.go(s.status === 'submitted' ? 'assessments' : 'take') },
      { icon: 'icon-user-round-check', title: 'Manager evaluation received', sub: 'Q3 2026 · Joseph Ahor Abandoh-Sam', onClick: () => this.go('assessments') },
      { icon: 'icon-badge-check', title: 'Development action approved', sub: 'CompTIA CySA+ certification course', onClick: () => this.go('plan') },
    ];
    return {
      data: DATA, role, vw, go: this.go, page: s.page, tab: s.tab, onTab: t => set({ tab: t, active: t === 'plan' ? 'plan' : 'profile' }), status: s.status,
      onStatus: st => set({ status: st }),
      pTake: s.page === 'take', pSignin: s.page === 'signin', shell: s.page !== 'take' && s.page !== 'signin', pForms: s.page === 'forms',
      signOut: () => this.go('signin'),
      onSignedIn: u => { const m = { Administrator: 'admin', 'Assessment Creator': 'creator', 'Manager / Supervisor': 'manager', Participant: 'staff' }; this.setState({ roleOverride: m[u.role] || 'staff' }); this.go('home'); },
      pHome: s.page === 'home', pProfile: s.page === 'profile', pAssess: grp === 'assess', pTeam: grp === 'team', pAnalytics: grp === 'analytics', pFramework: grp === 'framework', pSystem: grp === 'system',
      compact, notCompact: !compact, wideHeader: vw >= 760,
      titleText: vw < 520 ? 'Skill Matrix' : 'Skill Matrix & Assessment Platform',
      roleLabel: { staff: 'Participant', manager: 'Manager / Supervisor', creator: 'Assessment Creator', admin: 'Administrator' }[role],
      toggleNav: () => set({ navOpen: !s.navOpen }), drawerOverlay: compact && s.navOpen,
      asideShadow: floating || (compact && s.navOpen) ? 'inset 0 1px 0 rgba(255,255,255,.95),0 30px 80px rgba(10,52,36,.28)' : 'inset 0 1px 0 rgba(255,255,255,.95),inset 0 0 0 1px rgba(255,255,255,.25),0 24px 60px rgba(15,35,65,.14)',
      asidePos: compact ? 'fixed' : 'sticky', asideDisplay: !compact || s.navOpen ? 'flex' : 'none',
      asideTop: compact ? '78px' : '80px', asideLeft: compact ? '12px' : 'auto', asideW: exp ? '284px' : '84px', asideH: compact ? 'calc(100vh - 90px)' : 'calc(100vh - 92px)', asideMargin: compact ? '0' : floating ? '12px -200px 12px 12px' : '12px 0 12px 12px',
      exp, col: !exp, padX: exp ? '18px' : '0', navPad: exp ? '12px' : '0', rowJustify: exp ? 'flex-start' : 'center', footAlign: exp ? 'stretch' : 'center',
      quickDir: exp ? 'row' : 'column', quickW: exp ? 'auto' : '48px', showPin: exp && !compact,
      pinIcon: s.pinned ? 'icon-pin-off' : 'icon-pin', pinTitle: s.pinned ? 'Unpin sidebar (collapse when not hovered)' : 'Pin sidebar open',
      pinColor: s.pinned ? '#fff' : '#475569', pinBg: s.pinned ? 'linear-gradient(180deg,#2fb36b,#15904c)' : 'rgba(255,255,255,.75)', pinShadow: s.pinned ? '0 4px 12px rgba(21,144,76,.35)' : 'none',
      togglePin: () => { const p = !s.pinned; set({ pinned: p, hover: p ? false : true }); try { localStorage.setItem('skm-nav-pin', p ? '1' : '0'); } catch (e) {} },
      navEnter: () => { if (compact || s.pinned) return; clearTimeout(this._hl); this._he = setTimeout(() => this.setState({ hover: true }), 90); },
      navLeave: () => { clearTimeout(this._he); if (compact || s.pinned) return; this._hl = setTimeout(() => this.setState({ hover: false }), 160); },
      greeting: (() => { const h = new Date().getHours(); return h < 12 ? 'Good morning,' : h < 17 ? 'Good afternoon,' : 'Good evening,'; })(),
      quick: (exp ? [['Notifications', 'icon-bell', () => set({ bellOpen: !s.bellOpen }), notifs.length], ['Help & Guides', 'icon-life-buoy', () => this.go('help')], [role === 'admin' ? 'System Settings' : 'My Profile', 'icon-settings', () => this.go(role === 'admin' ? 'settings' : 'profile')], ['Sign out', 'icon-log-out', () => this.go('signin')]]
        : [['Help & Guides', 'icon-life-buoy', () => this.go('help')], ['Sign out', 'icon-log-out', () => this.go('signin')]]).map(([label, icon, onClick, badge]) => ({ label, icon, onClick, badge: badge || '', color: icon === 'icon-log-out' ? '#e5484d' : '#475569' })),
      ctaTitle: s.status === 'submitted' ? 'View receipt' : s.status === 'in_progress' ? 'Resume assessment' : 'Take assessment', ctaIcon: s.status === 'submitted' ? 'icon-receipt' : s.status === 'in_progress' ? 'icon-timer' : 'icon-play',
      ctaSub: s.status === 'submitted' ? 'Submitted · results soon' : s.status === 'in_progress' ? 'Timer is running' : 'Open today · ' + DATA.cycle.window, ctaAction: () => this.go('take'), bigCta: exp && s.vh >= 720, smallCta: !exp || s.vh < 720,
      goBack: () => { const h = [...s.history]; const prev = h.pop() || 'home'; this.go(prev); this.setState({ history: h }); },
      goProfile: () => this.go('profile'),
      bellOpen: s.bellOpen, toggleBell: () => set({ bellOpen: !s.bellOpen }), notifs, notifCount: notifs.length,
      groups, query: s.query, onQuery: e => set({ query: e.target.value }),
      notesOpen: s.notesOpen, openNotes: () => set({ notesOpen: true }), closeNotes: () => set({ notesOpen: false }), stop: e => e.stopPropagation(),
      notesDir: vw < 720 ? 'column-reverse' : 'row', notesListW: vw < 720 ? '100%' : '242px', notesListMaxH: vw < 720 ? '220px' : 'none',
      noteCount: s.notes.length, hasNotes: s.notes.length > 0, noNotes: s.notes.length === 0, noteList,
      hasSelected: !!sel, noSelected: !sel, draftTitle: s.draft.title, draftBody: s.draft.body,
      onTitle: e => set({ draft: { ...s.draft, title: e.target.value }, dirty: true }),
      onBody: e => set({ draft: { ...s.draft, body: e.target.value }, dirty: true }),
      statusText: s.dirty ? 'Unsaved changes' : sel ? 'Saved · ' + new Date(sel.updated).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : '',
      saveBg: s.dirty ? '#f5a623' : '#262838', saveColor: s.dirty ? '#1a1b29' : '#5c5f74', saveCursor: s.dirty ? 'pointer' : 'default',
      saveNote: () => { if (!s.dirty || !sel) return; const notes = s.notes.map(n => n.id === sel.id ? { ...n, ...s.draft, updated: Date.now() } : n); this.persist(notes); set({ notes, dirty: false }); },
      addNote: () => { const n = { id: Date.now(), title: 'Untitled note', body: '', updated: Date.now() }; const notes = [n, ...s.notes]; this.persist(notes); set({ notes, selId: n.id, draft: { title: n.title, body: '' }, dirty: false }); },
      deleteNote: () => { const notes = s.notes.filter(n => n.id !== s.selId); this.persist(notes); set({ notes, selId: null, dirty: false }); },
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      {(__v.pSignin) ? (<>
        <SMSignIn data={__v.data} vw={__v.vw} onSignedIn={__v.onSignedIn} />
      </>) : null}
      {(__v.pTake) ? (<>
        <SMAssessmentSession data={__v.data} go={__v.go} onStatus={__v.onStatus} vw={__v.vw} />
      </>) : null}
      {(__v.shell) ? (<>
        <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
          <div style={{ position: "sticky", top: "0", zIndex: "50", padding: "10px 12px 0" }}>
            <header style={{ position: "relative", height: "58px", borderRadius: "20px", background: "rgba(10,52,36,.82)", backdropFilter: "blur(24px) saturate(180%)", WebkitBackdropFilter: "blur(24px) saturate(180%)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.14),0 12px 30px rgba(10,52,36,.22)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", padding: "0 clamp(10px,1.6vw,18px)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: "0" }}>
                {(__v.compact) ? (<>
                  <button onClick={__v.toggleNav} aria-label={"Menu"} style={{ width: "36px", height: "36px", borderRadius: "12px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={"icon-menu"} style={{ fontSize: "19px" }}></i>
                  </button>
                </>) : null}
                {(__v.notCompact) ? (<>
                  <button onClick={__v.goBack} aria-label={"Back"} style={{ width: "34px", height: "34px", borderRadius: "12px", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.14)", color: "#cfe6d8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <i className={"icon-chevron-left"} style={{ fontSize: "18px" }}></i>
                  </button>
                </>) : null}
                <span style={{ flex: "none", width: "46px", height: "46px", borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 8px rgba(0,0,0,.25)" }}>
                  <img src={"/assets/dvla-logo.png"} alt={"DVLA"} style={{ width: "42px", height: "42px", objectFit: "contain", display: "block" }} />
                </span>
                <span style={{ color: "#fff", fontWeight: "700", fontSize: "clamp(15px,1.5vw,19px)", letterSpacing: "-0.3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{__v.titleText}</span>
                {(__v.wideHeader) ? (<>
                  <span style={{ font: "600 11px Inter,sans-serif", letterSpacing: ".3px", color: "#dcede3", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.18)", borderRadius: "999px", padding: "4px 10px", whiteSpace: "nowrap" }}>{__v.roleLabel}</span>
                </>) : null}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "clamp(8px,1.2vw,14px)", flex: "none" }}>
                <button onClick={__v.toggleBell} aria-label={"Notifications"} style={{ position: "relative", width: "38px", height: "38px", borderRadius: "999px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)", color: "#e3f1e8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={"icon-bell"} style={{ fontSize: "18px" }}></i>
                  <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ff3b30", color: "#fff", fontSize: "10px", fontWeight: "700", borderRadius: "999px", minWidth: "17px", height: "17px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0f4a33" }}>{__v.notifCount}</span>
                </button>
              </div>
              {(__v.bellOpen) ? (<>
                <div style={{ position: "absolute", top: "66px", right: "0", width: "min(360px,calc(100vw - 24px))", background: "rgba(255,255,255,.78)", backdropFilter: "blur(30px) saturate(180%)", WebkitBackdropFilter: "blur(30px) saturate(180%)", border: "1px solid rgba(255,255,255,.9)", borderRadius: "22px", boxShadow: "0 24px 60px rgba(15,35,65,.2)", overflow: "hidden", zIndex: "60" }}>
                  <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "14.5px", fontWeight: "600", display: "flex", justifyContent: "space-between", alignItems: "center" }}>Notifications<button onClick={__v.toggleBell} style={{ width: "26px", height: "26px", borderRadius: "999px", background: "rgba(118,118,128,.12)", border: "0", cursor: "pointer", color: "#4b5563", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <i className={"icon-x"} style={{ fontSize: "14px" }}></i>
                    </button></div>
                  {(__v.notifs || []).map((n, $index) => (<React.Fragment key={$index}>
                    <button className={__css.h1} onClick={n?.onClick} style={{ width: "100%", display: "flex", gap: "12px", alignItems: "flex-start", padding: "12px 16px", border: "0", borderBottom: "1px solid rgba(15,35,65,.05)", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                      <span style={{ width: "34px", height: "34px", borderRadius: "11px", background: "linear-gradient(180deg,#2fb36b,#15904c)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                        <i className={n?.icon} style={{ fontSize: "15px" }}></i>
                      </span>
                      <span style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ font: "500 13.5px Inter,sans-serif", color: "#111827" }}>{n?.title}</span>
                        <span style={{ font: "400 12px Inter,sans-serif", color: "#6b7280" }}>{n?.sub}</span>
                      </span>
                    </button>
                  </React.Fragment>))}
                </div>
              </>) : null}
            </header>
          </div>
          <div style={{ display: "flex", flex: "1", alignItems: "flex-start" }}>
            {(__v.drawerOverlay) ? (<>
              <div onClick={__v.toggleNav} style={{ position: "fixed", inset: "0", background: "rgba(15,35,65,.25)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)", zIndex: "39" }}></div>
            </>) : null}
            <aside onMouseEnter={__v.navEnter} onMouseLeave={__v.navLeave} style={{ position: __v.asidePos, top: __v.asideTop, left: __v.asideLeft, zIndex: "40", flex: "none", width: __v.asideW, height: __v.asideH, margin: __v.asideMargin, display: __v.asideDisplay, flexDirection: "column", borderRadius: "28px", background: "rgba(255,255,255,.58)", backdropFilter: "blur(32px) saturate(190%)", WebkitBackdropFilter: "blur(32px) saturate(190%)", border: "1px solid rgba(255,255,255,.85)", boxShadow: __v.asideShadow, transition: "width .28s cubic-bezier(.2,.8,.2,1),margin .28s cubic-bezier(.2,.8,.2,1),box-shadow .28s" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "12px", padding: `20px ${__v.padX ?? ""} 16px`, justifyContent: __v.rowJustify }}>
                <button onClick={__v.goProfile} title={"My Profile"} style={{ flex: "none", width: "44px", height: "44px", borderRadius: "50%", padding: "0", cursor: "pointer", border: "2px solid #fff", boxShadow: "0 0 0 2px rgba(21,144,76,.25),0 6px 14px rgba(15,35,65,.15)", background: "repeating-linear-gradient(135deg,#cbd2da 0 4px,#b8c0ca 4px 8px)", font: "600 10px 'JetBrains Mono',monospace", color: "#475569" }}>AD</button>
                {(__v.exp) ? (<>
                  <div style={{ minWidth: "0", flex: "1" }}>
                    <div style={{ font: "500 11.5px Inter,sans-serif", color: "#6b7280" }}>{__v.greeting}</div>
                    <div style={{ font: "700 15.5px Inter,sans-serif", color: "#0f172a", letterSpacing: "-0.2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>Denzil A.</div>
                  </div>
                </>) : null}
                {(__v.showPin) ? (<>
                  <button onClick={__v.togglePin} title={__v.pinTitle} style={{ flex: "none", width: "32px", height: "32px", borderRadius: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: __v.pinColor, background: __v.pinBg, border: "1px solid rgba(255,255,255,.8)", boxShadow: __v.pinShadow }}>
                    <i className={__v.pinIcon} style={{ fontSize: "15px" }}></i>
                  </button>
                </>) : null}
              </div>
              <div style={{ height: "1px", margin: `0 ${__v.padX ?? ""}`, background: "rgba(15,35,65,.08)" }}></div>
              {(__v.exp) ? (<>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", height: "40px", margin: "14px 16px 0", borderRadius: "14px", padding: "0 8px 0 12px", background: "rgba(118,118,128,.1)", border: "1px solid rgba(255,255,255,.6)" }}>
                  <i className={"icon-search"} style={{ fontSize: "15px", color: "#8a94a3" }}></i>
                  <input value={__v.query} onChange={__v.onQuery} placeholder={"Search menu"} style={{ border: "0", outline: "0", font: "400 14px Inter,sans-serif", color: "#111827", flex: "1", minWidth: "0", background: "transparent" }} />
                  <span style={{ font: "600 10.5px Inter,sans-serif", color: "#6b7280", borderRadius: "7px", padding: "2px 6px", background: "rgba(255,255,255,.75)" }}>⌘J</span>
                </div>
              </>) : null}
              {(__v.col) ? (<>
                <button onClick={__v.navEnter} title={"Search menu"} style={{ alignSelf: "center", marginTop: "14px", width: "46px", height: "40px", borderRadius: "14px", border: "1px solid rgba(255,255,255,.6)", background: "rgba(118,118,128,.1)", color: "#64748b", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={"icon-search"} style={{ fontSize: "16px" }}></i>
                </button>
              </>) : null}
              <nav style={{ flex: "1", minHeight: "0", overflowY: "auto", overflowX: "hidden", padding: `14px ${__v.navPad ?? ""} 12px` }}>
                {(__v.groups || []).map((g, $index) => (<React.Fragment key={$index}>
                  <div style={{ marginBottom: "14px" }}>
                    {(g?.showLabel) ? (<>
                      <button onClick={g?.toggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "0", padding: "6px 8px", cursor: "pointer", whiteSpace: "nowrap", font: "600 11.5px Inter,sans-serif", color: "#7b8594" }}>{g?.countLabel}<i className={g?.chev} style={{ fontSize: "14px", color: "#a0a8b4" }}></i></button>
                    </>) : null}
                    {(g?.showDivider) ? (<>
                      <div style={{ height: "1px", margin: "2px 14px 10px", background: "rgba(15,35,65,.08)" }}></div>
                    </>) : null}
                    {(g?.open) ? (<>
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px", alignItems: g?.align }}>
                        {(g?.items || []).map((item, $index) => (<React.Fragment key={$index}>
                          <button className={__css.h2} onClick={item?.onClick} title={item?.label} style={{ position: "relative", display: "flex", alignItems: "center", gap: "12px", width: item?.w, height: item?.h, padding: item?.pad, justifyContent: item?.justify, border: "0", borderRadius: "14px", cursor: "pointer", textAlign: "left", whiteSpace: "nowrap", font: "500 14px Inter,sans-serif", color: item?.color, background: item?.bg, boxShadow: item?.shadow, "--h2-0": item?.hoverBg }}>
                            <i className={item?.icon} style={{ fontSize: "19px", color: item?.iconColor, width: "20px", textAlign: "center", flex: "none" }}></i>
                            {(item?.exp) ? (<>
                              <span style={{ flex: "1", overflow: "hidden", textOverflow: "ellipsis" }}>{item?.label}</span>
                              {(item?.badge) ? (<>
                                <span style={{ font: "700 10px Inter,sans-serif", color: item?.badgeFg, background: item?.badgeBg, borderRadius: "999px", padding: "2px 7px" }}>{item?.badge}</span>
                              </>) : null}
                            </>) : null}
                            {(item?.dot) ? (<>
                              <span style={{ position: "absolute", top: "7px", right: "7px", width: "8px", height: "8px", borderRadius: "50%", background: "#ff3b30", border: "1.5px solid #fff" }}></span>
                            </>) : null}
                          </button>
                        </React.Fragment>))}
                      </div>
                    </>) : null}
                  </div>
                </React.Fragment>))}
              </nav>
              <div style={{ flex: "none", padding: `0 ${__v.navPad ?? ""} 14px`, display: "flex", flexDirection: "column", gap: "10px", alignItems: __v.footAlign }}>
                <div style={{ flexShrink: "0", display: "flex", flexDirection: __v.quickDir, gap: "4px", padding: "6px", borderRadius: "18px", background: "rgba(255,255,255,.72)", border: "1px solid rgba(255,255,255,.9)", boxShadow: "0 4px 14px rgba(15,35,65,.06)", justifyContent: "space-between", width: __v.quickW }}>
                  {(__v.quick || []).map((qk, $index) => (<React.Fragment key={$index}>
                    <button className={__css.h3} onClick={qk?.onClick} title={qk?.label} style={{ position: "relative", width: "36px", height: "34px", borderRadius: "11px", border: "0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: qk?.color }}>
                      <i className={qk?.icon} style={{ fontSize: "16px" }}></i>
                      {(qk?.badge) ? (<>
                        <span style={{ position: "absolute", top: "2px", right: "2px", minWidth: "14px", height: "14px", borderRadius: "999px", background: "#ff3b30", color: "#fff", font: "700 9px Inter,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>{qk?.badge}</span>
                      </>) : null}
                    </button>
                  </React.Fragment>))}
                </div>
                {(__v.bigCta) ? (<>
                  <button className={__css.h4} onClick={__v.ctaAction} style={{ flexShrink: "0", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "16px 12px 14px", borderRadius: "20px", cursor: "pointer", background: "rgba(255,255,255,.8)", border: "1px solid rgba(255,255,255,.95)", boxShadow: "0 8px 24px rgba(15,35,65,.08)" }}>
                    <span style={{ width: "46px", height: "46px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 8px 20px rgba(21,144,76,.4),inset 0 1px 0 rgba(255,255,255,.4)" }}>
                      <i className={__v.ctaIcon} style={{ fontSize: "20px" }}></i>
                    </span>
                    <span style={{ font: "700 14px Inter,sans-serif", color: "#0f172a" }}>{__v.ctaTitle}</span>
                    <span style={{ font: "500 11.5px Inter,sans-serif", color: "#6b7280", marginTop: "-4px" }}>{__v.ctaSub}</span>
                  </button>
                </>) : null}
                {(__v.smallCta) ? (<>
                  <button onClick={__v.ctaAction} title={__v.ctaTitle} style={{ width: "48px", height: "48px", borderRadius: "50%", border: "0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 8px 20px rgba(21,144,76,.4),inset 0 1px 0 rgba(255,255,255,.4)" }}>
                    <i className={__v.ctaIcon} style={{ fontSize: "20px" }}></i>
                  </button>
                </>) : null}
              </div>
            </aside>
            <main style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 68px)" }}>
              <div style={{ flex: "1" }}>
                {(__v.pHome) ? (<>
                  <SMHome data={__v.data} role={__v.role} vw={__v.vw} go={__v.go} status={__v.status} />
                </>) : null}
                {(__v.pProfile) ? (<>
                  <SMProfile data={__v.data} role={__v.role} vw={__v.vw} go={__v.go} tab={__v.tab} onTab={__v.onTab} />
                </>) : null}
                {(__v.pAssess) ? (<>
                  <SMAssessments data={__v.data} view={__v.page} vw={__v.vw} go={__v.go} status={__v.status} />
                </>) : null}
                {(__v.pTeam) ? (<>
                  <SMTeam data={__v.data} view={__v.page} vw={__v.vw} go={__v.go} />
                </>) : null}
                {(__v.pAnalytics) ? (<>
                  <SMAnalytics data={__v.data} view={__v.page} vw={__v.vw} go={__v.go} />
                </>) : null}
                {(__v.pFramework) ? (<>
                  <SMFramework data={__v.data} view={__v.page} vw={__v.vw} go={__v.go} />
                </>) : null}
                {(__v.pForms) ? (<>
                  <SMFormBuilder data={__v.data} vw={__v.vw} go={__v.go} />
                </>) : null}
                {(__v.pSystem) ? (<>
                  <SMSystem data={__v.data} view={__v.page} vw={__v.vw} go={__v.go} role={__v.role} />
                </>) : null}
              </div>
              <footer style={{ margin: "0 clamp(12px,2vw,20px)", borderTop: "1px solid rgba(15,35,65,.08)", padding: "20px 0 18px", textAlign: "center", fontSize: "13px", color: "#64748b" }}>© 2026 Skill Matrix &amp; Assessment Platform. All rights reserved.</footer>
            </main>
          </div>
          <div style={{ position: "fixed", right: "clamp(16px,2.5vw,36px)", bottom: "22px", zIndex: "35" }}>
            <div style={{ position: "relative", width: "56px", height: "56px", borderRadius: "50%", background: "#0d3b2a", boxShadow: "0 0 0 10px rgba(255,255,255,.35),0 10px 26px rgba(10,52,36,.35),inset 0 1px 0 rgba(255,255,255,.25)", border: "1px solid rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}>
              <i className={"icon-messages-square"} style={{ fontSize: "24px" }}></i>
              <span style={{ position: "absolute", top: "-10px", left: "-10px", background: "#fff", color: "#0d3b2a", font: "700 9px Inter,sans-serif", borderRadius: "999px", padding: "3px 6px", boxShadow: "0 1px 3px rgba(0,0,0,.2)" }}>AI</span>
            </div>
          </div>
        </div>
      </>) : null}
    </>
    );
  }
}


export default SkillMatrixApp;
