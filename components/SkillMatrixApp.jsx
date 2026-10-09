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
import SMTraining from './SMTraining';
import SMFramework from './SMFramework';
import SMCycles from './SMCycles';
import SMFormBuilder from './SMFormBuilder';
import SMSystem from './SMSystem';
import SMStaffReport from './SMStaffReport';
import { buildModel, ALL } from './smModel';
import { JOB_LEVELS, BANKS, HR_FRAMEWORK, RBDI_FRAMEWORK } from './dvlaBanks';

// Feature flags. A feature that is off is removed from the sidebar, routes, Profile tabs,
// Home cards, notifications and links. Its code stays in place so it can be switched back on.
const FEATURES = { auditLogs: false, developmentPlan: false, feedback360: false, evidence: false, planApprovals: false };
// Plan Approvals depends on the Development Plan, so it is only on when both are on.
const FT = { ...FEATURES, planApprovals: FEATURES.planApprovals && FEATURES.developmentPlan };

// Browser state saved against an older version of the sample data (departments, competencies, forms)
// no longer matches, so it is cleared once. Change DATA_VERSION whenever buildData() changes shape.
const DATA_VERSION = 'dvla-docs-1';
if (typeof window !== 'undefined') {
  try {
    if (localStorage.getItem('skm-data-version') !== DATA_VERSION) {
      ['skm-scope', 'skm-target-profiles', 'skm-evals', 'skm-cycles', 'skm-forms', 'skm-qbank', 'skm-session', 'skm-users', 'skm-notes'].forEach(k => localStorage.removeItem(k));
      localStorage.setItem('skm-data-version', DATA_VERSION);
    }
  } catch (e) {}
}

function buildData() {
  const GAP = [
    { n: 0, label: 'No Gap', bg: '#d6336c', fg: '#fff', desc: "The employee's current skill level fully meets or exceeds the required skill level. There is no discrepancy between the required and current skills." },
    { n: 1, label: 'Minimal', bg: '#1c8fd1', fg: '#fff', desc: "The employee's current skill level is very close to the required skill level. Only minor improvements or refinements are needed to meet the requirement." },
    { n: 2, label: 'Moderate', bg: '#2f9e44', fg: '#fff', desc: 'Close to the required level. Some improvement and refinement is needed.' },
    { n: 3, label: 'Noticeable', bg: '#f2c200', fg: '#3b2f00', desc: "The employee's current skill level is noticeably below the required skill level. Significant training and practice are needed to bridge the gap." },
    { n: 4, label: 'Significant', bg: '#f08c00', fg: '#fff', desc: "The employee's current skill level is well below the required skill level. Extensive training and development are required to meet the requirement." },
    { n: 5, label: 'Critical', bg: '#e03131', fg: '#fff', desc: "The employee's current skill level is far below the required skill level. Immediate and intensive training, along with ongoing support and development, are necessary to address the gap." },
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
  const categories = ['Technical', 'General'];
  const now = new Date(), add = d => new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
  const dl = (d, o) => d.toLocaleDateString('en-GB', o || { weekday: 'short', day: 'numeric', month: 'short' });
  const pad = n => String(n).padStart(2, '0'), iso = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const cycle = {
    name: 'Q4 2026 Skills Assessment', short: 'Q4 2026', day: add(0), dayLabel: dl(add(0)), dayLong: dl(add(0), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
    window: '09:00 – 17:00', durationMin: 45, tabLimit: 3,
    mgrClose: add(2), mgrCloseLabel: dl(add(2)), results: add(7), resultsLabel: dl(add(7)), plans: add(14), plansLabel: dl(add(14)),
  };
  const user = { name: 'ADJEI DENZIL ASIAM', first: 'DENZIL', last: 'ADJEI', other: 'ASIAM', email: 'denzilasiam.adjei@dvla.gov.gh', mobile: '0256488784', id: '123456789', dept: 'IT DEPARTMENT', deptName: 'IT Department', designation: 'IT OFFICER', location: 'HEAD OFFICE', dob: '13 April 1998', gender: 'Male', manager: 'HOD: Joseph Ahor Abandoh-Sam', target: JOB_LEVELS[1] + ' · Technical track' };

  // ---- Organisation: departments, competency framework, training ----
  // Taken from the DVLA source documents: the RBDI Competency Capacity Assessment Tools and the HR Skill
  // Matrix Question Banks (one per job level, see dvlaBanks.js) and the Skills Matrix Data Analysis sample
  // (Corporate Affairs technical and general skills). IT keeps the prototype's own technical skills.
  const RBDI = 'Research, Business Development & Innovation';
  const depts = [
    { name: 'IT Department', code: 'IT', hod: 'Joseph Ahor Abandoh-Sam', size: 14, bias: 0, notStarted: 0.12, titles: [['Assistant IT Officer'], ['IT Officer', 'Senior IT Officer'], ['Assistant IT Manager', 'IT Manager'], ['Deputy Director, IT']] },
    { name: 'Human Resources', code: 'HR', hod: 'Comfort Ansah', size: 12, bias: 0.1, notStarted: 0.08, bank: 'hr', titles: [['Assistant HR Officer'], ['HR Officer', 'Senior HR Officer'], ['Assistant HR Manager', 'HR Manager'], ['Deputy Director, HR']] },
    { name: RBDI, code: 'RBDI', hod: 'Nana Appiah', size: 12, bias: -0.15, notStarted: 0.1, bank: 'rbdi', titles: [['Assistant Research Officer'], ['Research Officer', 'Senior Research Officer'], ['Assistant Manager, RBDI', 'Manager, RBDI'], ['Deputy Director, RBDI']] },
    { name: 'Corporate Affairs', code: 'CA', hod: 'Kojo Quaye', size: 5, bias: 0, notStarted: 0, titles: [['Public Relations'], ['Public Relations'], ['Public Relations'], ['Public Relations']] },
  ];
  // General skills apply to every department (Skills Matrix Data Analysis sample).
  const GENERAL = [['lead', 'Leadership & Management', 'Leadership', 5], ['comm', 'Communication', 'Communication', 5], ['service', 'Customer Service', 'Customer Service', 5],
    ['team', 'Collaboration & Teamwork', 'Teamwork', 5], ['digital', 'Digital Skills', 'Digital Skills', 4]];
  const CA_TECH = [['media', 'Media Relation', 'Media Relation', 5], ['brand', 'Branding & Position', 'Branding', 5], ['graphic', 'Graphic Design', 'Graphic Design', 4], ['social', 'Social Media', 'Social Media', 5], ['video', 'Video Editing', 'Video Editing', 4]];
  const framework = [
    ...GENERAL.map(([id, name, short, importance]) => ({ id, name, short, category: 'General', group: 'General Skills', importance, dept: null })),
    ...comps.map(c => ({ id: 'it' + c.id, name: c.name, short: c.short, category: 'Technical', group: c.major, importance: c.importance, dept: 'IT Department' })),
    ...HR_FRAMEWORK.map(c => ({ id: c.id, code: c.code, name: c.name, short: c.short, category: 'Technical', group: c.group, importance: 4, dept: 'Human Resources' })),
    ...RBDI_FRAMEWORK.map(c => ({ id: c.id, name: c.name, short: c.short, category: 'Technical', group: 'RBDI Technical Competencies', areas: c.areas, importance: 4, dept: RBDI })),
    ...CA_TECH.map(([id, name, short, importance]) => ({ id, name, short, category: 'Technical', group: 'Corporate Affairs Technical Skills', importance, dept: 'Corporate Affairs' })),
  ];
  const fwById = Object.fromEntries(framework.map(c => [c.id, c]));
  // Interventions follow the Gaps Description: noticeable gaps and above need training and practice,
  // smaller gaps need minor refinement on the job. HR (L&D) assigns the actual programme.
  const training = Object.fromEntries(framework.map(c => [c.id, {
    primary: { name: 'Training & practice: ' + c.name, provider: 'HR · Learning & Development', days: 0, mode: 'To be scheduled' },
    refresher: { name: 'Coached practice: ' + c.name, provider: 'Line manager / workplace mentor', days: 0, mode: 'On the job' } }]));

  // ---- Staff, with item-level answers for the current cycle and results for earlier cycles ----
  const rng = seed => () => { seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const cl = v => Math.max(1, Math.min(5, v));
  const FIRST = ['Kwame', 'Akosua', 'Kwabena', 'Abena', 'Kwaku', 'Akua', 'Yaw', 'Yaa', 'Kojo', 'Afua', 'Kwesi', 'Adwoa', 'Fiifi', 'Esi', 'Ekow', 'Araba', 'Nii', 'Naa', 'Selorm', 'Dzifa', 'Elikem', 'Enyonam', 'Mawuli', 'Sena', 'Kobina', 'Mansa', 'Edem', 'Dede', 'Prosper', 'Gifty', 'Richmond', 'Comfort', 'Emmanuel', 'Mercy', 'Delali', 'Patience'];
  const LAST = ['Mensah', 'Antwi', 'Amoah', 'Bonsu', 'Acheampong', 'Osei', 'Tetteh', 'Nkansah', 'Annan', 'Kuffour', 'Amponsah', 'Gyamfi', 'Asamoah', 'Danquah', 'Ampofo', 'Yeboah', 'Opoku', 'Ocran', 'Lartey', 'Agbeko', 'Dogbe', 'Kpodo', 'Fosu', 'Baah', 'Hammond', 'Quartey', 'Bediako', 'Appiah', 'Agyeman', 'Ofori', 'Sarpong', 'Addo', 'Quaye', 'Darko'];
  const FIXED = { 'IT Department': ['Adjei Denzil Asiam', 'Ama Owusu', 'Kofi Boateng', 'Efua Asante', 'Yaw Darko', 'Abena Frimpong'] };
  const used = new Set(Object.values(FIXED).flat()); let k = 0;
  const nextName = () => { let nm; do { nm = FIRST[(k * 7 + 3) % FIRST.length] + ' ' + LAST[(k * 5 + 11) % LAST.length]; k++; } while (used.has(nm)); used.add(nm); return nm; };
  const LOC = ['Head Office, Accra', 'Head Office, Accra', 'Accra (37) Office', 'Kumasi Office', 'Takoradi Office', 'Tamale Office', 'Tema Office', 'Ho Office'];
  // Corporate Affairs: the five Public Relations records from the Skills Matrix Data Analysis sample
  // (current ratings: Media Relation, Branding & Position, Graphic Design, Social Media, Video Editing;
  // then Leadership & Management, Communication, Customer Service, Collaboration & Teamwork, Digital Skills).
  const CA_REC = [{ level: 2, cur: [5, 3, 2, 3, 2, 5, 5, 5, 5, 4] }, { level: 1, cur: [3, 3, 1, 3, 1, 3, 4, 4, 3, 4] }, { level: 1, cur: [3, 3, 1, 3, 1, 3, 4, 4, 3, 4] },
    { level: 2, cur: [3, 2, 1, 3, 2, 3, 3, 3, 4, 4] }, { level: 1, cur: [3, 3, 1, 3, 1, 3, 4, 4, 3, 4] }];
  // Share of questions answered correctly that lands in each level band (see TIERS in smModel.js).
  const AIM = [0, 25, 50, 70, 85, 95];
  const REASONS = ['Observed handling this independently during the quarter', 'Completed the related certification after the assessment', 'Self-rating was overly modest; supervisor evidence supports a higher level', 'Needed close supervision on recent tasks; adjusted down'];
  const ANSWERS = [
    'Last month I took over a backlog that had grown to three weeks. I listed every item by risk, agreed priorities with my supervisor and cleared it in nine working days. Next time I would flag the backlog earlier.',
    'I followed the documented procedure step by step and checked my work with a senior colleague. It went well, but I relied on them for the unusual cases, so I want more practice on those.',
    'I led a small change for our unit, wrote a short plan, tested it on one case first and then rolled it out. Two customers were affected by a delay, which I would avoid by communicating the timing earlier.',
    'I have done this a few times under supervision. I understand the main steps but I am not yet confident with the exceptions and would like training.',
    'I trained two new colleagues on this area and wrote a checklist that the unit now uses. I would add more examples to the checklist for edge cases.'];
  const TEXT_PROMPT = 'Describe a recent piece of work that shows your Leadership & Management skills. What did you do, and what would you do differently?';
  const today = iso(now), staff = [];
  let n = 0;
  depts.forEach((dp, di) => {
    const r = rng(1009 + di * 97);
    const tech = framework.filter(c => c.dept === dp.name).map(c => c.id);
    const ids = [...GENERAL.map(c => c[0]), ...tech];
    for (let i = 0; i < dp.size; i++) {
      n++;
      const name = (FIXED[dp.name] || [])[i] || nextName();
      const isMe = name === 'Adjei Denzil Asiam', ca = dp.code === 'CA' ? CA_REC[i] : null;
      const level = isMe ? 1 : ca ? ca.level : i === dp.size - 1 ? 3 : (x => x < 0.3 ? 0 : x < 0.7 ? 1 : 2)(r());
      const ability = dp.bias + level * 0.35 + (r() - 0.5) * 0.9;
      const L = {};
      ids.forEach(id => { L[id] = cl(Math.round(3 + ability + (r() - 0.58) * 3.4 - (fwById[id].importance >= 5 ? 0.3 : 0))); });
      if (isMe) comps.forEach(c => { L['it' + c.id] = c.actual; });
      if (ca) [...tech, ...GENERAL.map(c => c[0])].forEach((id, j) => { L[id] = ca.cur[j]; });
      const hist = { 'Q1 2026': {}, 'Q2 2026': {}, 'Q3 2026': {} };
      ids.forEach(id => {
        const q3 = isMe || ca ? L[id] : cl(L[id] - (r() < 0.3 ? 1 : 0)), q2 = cl(q3 - (r() < 0.3 ? 1 : 0)), q1 = cl(q2 - (r() < 0.25 ? 1 : 0));
        hist['Q3 2026'][id] = q3; hist['Q2 2026'][id] = q2; hist['Q1 2026'][id] = q1;
      });
      const x = r();
      const raw = isMe ? 'not_started' : ca ? 'submitted' : x < dp.notStarted ? 'not_started' : x < dp.notStarted + 0.08 ? 'in_progress' : 'submitted';
      // Technical competencies with a question bank are answered with that level's real questions;
      // the rest are rated on the proficiency scale (a rating of v scores v × 20%).
      const bank = dp.bank ? BANKS.find(b => b.id === dp.bank + '-' + level) : null;
      const items = ids.flatMap(id => {
        const qs = bank ? bank.items.map((q, qi) => [q, qi]).filter(([q]) => q[0] === id) : [];
        if (!qs.length) { const v = !ca && r() < 0.2 ? cl(L[id] + (r() < 0.5 ? -1 : 1)) : L[id]; return [{ comp: id, type: 'likert', weight: 2, value: v, points: 5 }]; }
        const right = Math.max(0, Math.min(qs.length, Math.round(qs.length * AIM[L[id]] / 100 + (r() - 0.5) * 1.2)));
        const order = qs.map((_, j) => [r(), j]).sort((a, b) => a[0] - b[0]).map(o => o[1]);
        return qs.map(([q, qi], j) => { const ok = order.indexOf(j) < right; const wrong = [0, 1, 2, 3].filter(o => o !== q[4]);
          return { comp: id, type: 'single', weight: 1, value: ok ? 1 : 0, bank: bank.id, q: qi, pick: ok ? q[4] : wrong[Math.floor(r() * 3)] }; });
      });
      items.push({ comp: 'lead', type: 'text', weight: 2 });
      let seed = {};
      if (ca) seed = { text: L.lead, confirmed: true, by: dp.hod };
      else if (raw === 'submitted') {
        const y = r(), txt = cl(L.lead - (r() < 0.3 ? 1 : 0));
        if (y < 0.3) seed = {};
        else if (y < 0.65) seed = { text: txt };
        else {
          seed = { text: txt, confirmed: true, by: dp.hod };
          if (r() < 0.3) { const id = ids[Math.floor(r() * ids.length)]; const up = r() < 0.7; seed.adj = { [id]: { score: cl(L[id] + (up ? 1 : -1)), reason: REASONS[up ? Math.floor(r() * 3) : 3], by: dp.hod } }; }
        }
      }
      const mins = 9 * 60 + 8 + Math.floor(r() * 420);
      const parts = name.toLowerCase().replace(/[^a-z ]/g, '').split(' ');
      const titles = dp.titles[level];
      staff.push({ id: 's' + String(n).padStart(3, '0'), staffNo: String(100200300 + n * 7919).slice(0, 9), name, email: (isMe ? 'denzilasiam.adjei' : parts[0] + '.' + parts[parts.length - 1]) + '@dvla.gov.gh',
        dept: dp.name, designation: isMe ? 'IT Officer' : titles[Math.floor(r() * titles.length)], level, levelName: JOB_LEVELS[level], track: level >= 2 ? 'Management' : 'Technical', hod: dp.hod,
        location: isMe ? 'Head Office, Accra' : ca ? 'Head Office' : LOC[Math.floor(r() * LOC.length)], bank: bank ? bank.id : null,
        comps: ids, hist, raw, seed, sub: { items }, submittedAt: 'Today · ' + pad(Math.floor(mins / 60)) + ':' + pad(mins % 60), submittedIso: today,
        textItem: { comp: 'lead', prompt: TEXT_PROMPT, answer: ANSWERS[Math.floor(r() * ANSWERS.length)] } });
    }
  });

  // ---- Target profiles: org-wide by job level, with department overrides ----
  const P = (id, level, scope, targets, comps) => ({ id, title: JOB_LEVELS[level], track: level >= 2 ? 'Management' : 'Technical', level, scope, targets, comps: comps || {} });
  const profiles = [
    P('p1', 0, 'all', { Technical: 3, General: 3 }), P('p2', 1, 'all', { Technical: 4, General: 3 }), P('p3', 2, 'all', { Technical: 4, General: 4 }), P('p4', 3, 'all', { Technical: 5, General: 5 }),
    P('p5', 1, ['IT Department'], { Technical: 4, General: 3 }, Object.fromEntries(comps.map(c => ['it' + c.id, c.target]))),
    // Required levels from the Skills Matrix Data Analysis sample (Corporate Affairs, Public Relations).
    P('p6', 1, ['Corporate Affairs'], { Technical: 5, General: 5 }, { lead: 3, comm: 4, service: 5, team: 4, digital: 5 }),
    P('p7', 2, ['Corporate Affairs'], { Technical: 5, General: 5 }),
  ];

  // ---- Assessment cycles ----
  const N = { invite: true, reminder: true, results: true };
  const cycles = [
    { id: 'cy1', name: 'Q1 2026 Skills Assessment', form: 'General Skills Self-Assessment', depts: 'all', start: '2026-03-12', end: '2026-03-12', open: '09:00', close: '17:00', duration: 45, attempts: 1, notify: N, status: 'Closed', description: 'First organisation-wide baseline of the year.' },
    { id: 'cy2', name: 'Q2 2026 Skills Assessment', form: 'General Skills Self-Assessment', depts: 'all', start: '2026-06-02', end: '2026-06-02', open: '09:00', close: '17:00', duration: 45, attempts: 1, notify: N, status: 'Closed', description: 'Mid-year assessment across all departments.' },
    { id: 'cy3', name: 'Q3 2026 Skills Assessment', form: 'General Skills Self-Assessment', depts: 'all', start: '2026-08-28', end: '2026-08-28', open: '09:00', close: '17:00', duration: 45, attempts: 1, notify: N, status: 'Closed', description: 'Third-quarter assessment; results feed the Q4 training plan.' },
    { id: 'cy4', name: cycle.name, form: 'General Skills Self-Assessment', depts: 'all', start: iso(add(0)), end: iso(add(0)), open: '09:00', close: '17:00', duration: cycle.durationMin, attempts: 1, notify: N, status: 'Open', description: 'Timed one-day assessment. HR and RBDI staff also answer the question bank for their job level. Managers confirm results by ' + cycle.mgrCloseLabel + '.' },
    { id: 'cy5', name: 'RBDI Competency Capacity Assessment · Q1 2027', form: 'RBDI Competency Assessment · ' + JOB_LEVELS[1], depts: [RBDI], start: iso(add(30)), end: iso(add(30)), open: '09:00', close: '16:00', duration: 90, attempts: 1, notify: N, status: 'Scheduled', description: '82 scenario questions across the 8 RBDI competencies.' },
    { id: 'cy6', name: 'HR Skill Matrix Assessment · Q1 2027', form: 'HR Skill Matrix Question Bank · ' + JOB_LEVELS[2], depts: ['Human Resources'], start: iso(add(45)), end: iso(add(45)), open: '09:00', close: '15:00', duration: 75, attempts: 1, notify: { invite: true, reminder: false, results: true }, status: 'Draft', description: 'Draft: Talent Acquisition & Selection and Learning & Development Management.' },
  ];

  return { GAP, IMP, LEVEL, PROF, SKILLS, comps, majors, team, categories, depts, cycle, user, fmt, framework, training, staff, profiles, cycles, iso, JOB_LEVELS, BANKS };
}
const DATA = buildData();

// Sidebar for each role. `feature` items only appear when that flag is on.
const NAV = [
  { label: 'Overview', items: [{ label: 'Home', icon: 'icon-house', key: 'home' }] },
  { label: 'Analytics', items: [
    { label: 'Executive Dashboard', icon: 'icon-chart-column', key: 'dashboard', roles: ['admin', 'manager'] },
    { label: 'Skill Heatmap', icon: 'icon-grid-3x3', key: 'heatmap', roles: ['admin', 'manager'] },
    { label: 'Training Needs', icon: 'icon-graduation-cap', key: 'training', roles: ['admin', 'manager'] },
    { label: 'Report Builder', icon: 'icon-file-spreadsheet', key: 'reports', roles: ['admin'] },
    { label: 'Scheduled Reports', icon: 'icon-calendar-clock', key: 'schedules', roles: ['admin'] }] },
  { label: 'Assessments', items: [
    { label: 'Assessment Cycles', icon: 'icon-calendar-cog', key: 'cycles', roles: ['admin'] },
    { label: 'Form Builder', icon: 'icon-file-pen-line', key: 'forms', roles: ['admin', 'creator'] },
    { label: 'Staff Evaluations', icon: 'icon-users', key: 'staff-evals', roles: ['admin', 'manager'] },
    { label: '360° Feedback', icon: 'icon-refresh-cw', key: 'feedback', roles: ['admin', 'manager'], feature: 'feedback360' },
    { label: 'Plan Approvals', icon: 'icon-badge-check', key: 'approvals', roles: ['admin', 'manager'], feature: 'planApprovals' },
    { label: 'My Assessments', icon: 'icon-clipboard-list', key: 'assessments' },
    { label: 'Evidence & Certifications', icon: 'icon-award', key: 'evidence', feature: 'evidence' },
    { label: 'Development Plan', icon: 'icon-target', key: 'plan', feature: 'developmentPlan' }] },
  { label: 'Skill Framework', items: [
    { label: 'Competency Library', icon: 'icon-network', key: 'library', roles: ['admin', 'creator'] },
    { label: 'Target Profiles', icon: 'icon-crosshair', key: 'targets', roles: ['admin', 'creator'] },
    { label: 'Rating Scales', icon: 'icon-sliders-horizontal', key: 'scales', roles: ['admin', 'creator'] }] },
  { label: 'Administration', items: [
    { label: 'User Management', icon: 'icon-user-cog', key: 'users', roles: ['admin'] },
    { label: 'Audit Logs', icon: 'icon-scroll-text', key: 'audit', roles: ['admin'], feature: 'auditLogs' },
    { label: 'System Settings', icon: 'icon-settings', key: 'settings', roles: ['admin'] }] },
];
const GROUP = { assessments: 'assess', evidence: 'assess', 'staff-evals': 'team', feedback: 'team', approvals: 'team', dashboard: 'analytics', heatmap: 'analytics', reports: 'analytics', schedules: 'analytics',
  training: 'training', library: 'framework', targets: 'framework', scales: 'framework', cycles: 'cycles', users: 'system', audit: 'system', settings: 'system', help: 'system', report: 'report' };
// Old URLs keep working.
const ALIAS = { builder: 'cycles', 'team-evals': 'staff-evals' };
const ALWAYS = ['home', 'profile', 'take', 'signin', 'help'];
const navItems = role => NAV.flatMap(g => g.items).filter(i => (!i.feature || FT[i.feature]) && (!i.roles || i.roles.includes(role)));
// Returns the page and tab to show for a URL, or Home when the page is hidden or not allowed for the role.
function normalize(page, tab, role) {
  let p = ALIAS[page] || page || 'home', t = tab;
  if (p === 'plan') { p = 'profile'; t = 'plan'; }
  if (p === 'profile') { if (t === 'plan' && !FT.developmentPlan) return ['home', undefined]; if (t && !['account', 'skills', 'history', 'plan'].includes(t)) t = undefined; return ['profile', t]; }
  if (p === 'report') return role === 'admin' || role === 'manager' ? ['report', undefined] : ['home', undefined];
  if (ALWAYS.includes(p)) return [p, undefined];
  return navItems(role).some(i => i.key === p) ? [p, undefined] : ['home', undefined];
}
const load = (k, f) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? f : v; } catch (e) { return f; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

class SkillMatrixApp extends React.Component {
  constructor(props) {
    super(props);
    const role = props.role || 'admin';
    const [page, tab] = normalize(props.routePage ?? props.startPage ?? 'home', props.routeTab, role);
    this.state = { page, active: page === 'profile' && tab === 'plan' ? 'plan' : page, tab: tab || 'account', id: props.routeId || null, history: [], vw: typeof window !== 'undefined' ? window.innerWidth : 1440,
      navOpen: false, bellOpen: false, query: '', closed: {}, status: 'not_started',
      notesOpen: false, notes: [], selId: null, draft: { title: '', body: '' }, dirty: false,
      scope: ALL, profiles: DATA.profiles, evals: {} };
  }
  role() { return this.state.roleOverride || this.props.role || 'admin'; }
  componentDidMount() {
    this.onResize = () => this.setState({ vw: window.innerWidth, vh: window.innerHeight });
    this.onResize();
    try { if (localStorage.getItem('skm-nav-pin') === '1') this.setState({ pinned: true }); } catch (e) {}
    window.addEventListener('resize', this.onResize);
    try { const n = JSON.parse(localStorage.getItem('skm-notes') || '[]'); if (Array.isArray(n)) this.setState({ notes: n }); } catch (e) {}
    try { const s = JSON.parse(localStorage.getItem('skm-session') || 'null'); if (s) this.setState({ status: s.submittedAt ? 'submitted' : 'in_progress' }); } catch (e) {}
    const sc = load('skm-scope', ALL), pr = load('skm-target-profiles', null), ev = load('skm-evals', {});
    this.setState({ scope: sc === ALL || DATA.depts.some(d => d.name === sc) ? sc : ALL, profiles: Array.isArray(pr) && pr.length ? pr : DATA.profiles, evals: ev && typeof ev === 'object' ? ev : {} });
    this.syncUrl();
  }
  // Replace the URL when it pointed at an alias, a hidden feature or a page the role cannot see.
  syncUrl() {
    const rp = this.props.routePage; if (!rp) return;
    const [p, t] = normalize(rp, this.props.routeTab, this.role());
    if (p !== rp || (t || undefined) !== (this.props.routeTab || undefined)) this.props.onNavigate && this.props.onNavigate(p, t, { replace: true });
  }
  componentDidUpdate(pp) {
    const rp = this.props.routePage;
    if (rp && (rp !== pp.routePage || this.props.routeTab !== pp.routeTab || this.props.routeId !== pp.routeId)) {
      const [p, t] = normalize(rp, this.props.routeTab, this.role());
      if (p !== this.state.page || (t || 'account') !== this.state.tab || this.props.routeId !== this.state.id) this.setState({ page: p, active: p === 'profile' && t === 'plan' ? 'plan' : p, tab: t || 'account', id: this.props.routeId || null });
      this.syncUrl();
    }
  }
  componentWillUnmount() { window.removeEventListener('resize', this.onResize); }
  go = (key, tab, id) => {
    const [page, t0] = normalize(key, tab, this.role());
    const t = t0 || 'account';
    this.setState(s => ({ page, active: page === 'profile' && t === 'plan' ? 'plan' : page, tab: t, id: id || null, navOpen: false, bellOpen: false, history: [...s.history, { page: s.page, tab: s.tab, id: s.id }].slice(-20) }));
    this.props.onNavigate && this.props.onNavigate(page, t, { id });
    try { window.scrollTo(0, 0); } catch (e) {}
  };
  setScope = v => { this.setState({ scope: v }); save('skm-scope', v); };
  setProfiles = p => { this.setState({ profiles: p }); save('skm-target-profiles', p); };
  setEval = (id, patch) => { this.setState(s => { const cur = s.evals[id] || {}; const next = { ...s.evals, [id]: { ...cur, ...patch, adj: { ...(cur.adj || {}), ...(patch.adj || {}) } } }; save('skm-evals', next); return { evals: next }; }); };
  resetEvals = () => { this.setState({ evals: {} }); save('skm-evals', {}); };
  persist(notes) { try { localStorage.setItem('skm-notes', JSON.stringify(notes)); } catch (e) {} }
  select(id) { const n = this.state.notes.find(x => x.id === id); this.setState({ selId: id, draft: { title: n.title, body: n.body }, dirty: false }); }
  renderVals() {
    const s = this.state, set = o => this.setState(o);
    const role = this.role();
    const compact = s.vw < 1100, vw = s.vw, exp = compact || s.pinned || s.hover, floating = !compact && !s.pinned && s.hover;
    const q = s.query.trim().toLowerCase();
    const model = buildModel(DATA, s.profiles, s.evals);
    const myDept = DATA.user.deptName;
    const scope = role === 'manager' ? myDept : s.scope;
    const scopeStaff = model.staff.filter(x => scope === ALL || x.dept === scope);
    const awaiting = scopeStaff.filter(x => x.status === 'Submitted' || x.status === 'Auto-scored').length;
    const badges = { 'staff-evals': awaiting ? String(awaiting) : '' };
    const allowed = navItems(role);
    const groups = NAV.map(g => {
      const items = g.items.filter(i => allowed.includes(i) && (!q || i.label.toLowerCase().includes(q))).map(({ label, icon, key }) => {
        const on = key === s.active, b = badges[key];
        return { label, icon, onClick: () => this.go(key), exp, dot: !exp && !!b,
          w: exp ? '100%' : '46px', h: exp ? '42px' : '46px', pad: exp ? '0 10px 0 12px' : '0', justify: exp ? 'flex-start' : 'center',
          bg: on ? 'linear-gradient(180deg,#2fb36b,#15904c)' : 'transparent', hoverBg: on ? 'linear-gradient(180deg,#3cc078,#1a9a53)' : 'rgba(255,255,255,.7)',
          shadow: on ? '0 8px 18px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)' : 'none',
          color: on ? '#fff' : '#334155', iconColor: on ? '#fff' : '#64748b',
          badge: b || '', badgeBg: on ? 'rgba(255,255,255,.95)' : '#ff3b30', badgeFg: on ? '#15904c' : '#fff' };
      });
      const open = q ? true : !s.closed[g.label];
      return { label: g.label, countLabel: g.label.toUpperCase() + ' · ' + items.length, showLabel: exp, showDivider: !exp, align: exp ? 'stretch' : 'center', items, open: exp ? open : true, chev: open ? 'icon-chevron-up' : 'icon-chevron-down', toggle: () => set({ closed: { ...s.closed, [g.label]: open } }) };
    }).filter(g => g.items.length);
    const grp = GROUP[s.page];
    const sel = s.notes.find(n => n.id === s.selId);
    const noteList = s.notes.map(n => ({ title: n.title || 'Untitled note', preview: n.body ? n.body.slice(0, 60) : 'Empty note',
      bg: n.id === s.selId ? '#262838' : 'transparent', accent: n.id === s.selId ? '#f5a623' : 'transparent', select: () => this.select(n.id) }));
    const nextCycle = DATA.cycles.find(c => c.status === 'Scheduled');
    const notifs = [
      { icon: 'icon-timer', title: s.status === 'submitted' ? 'Assessment submitted' : 'Your assessment is open today', sub: DATA.cycle.dayLabel + ' · ' + DATA.cycle.window + ' · ' + DATA.cycle.durationMin + ' min', onClick: () => this.go(s.status === 'submitted' ? 'assessments' : 'take') },
      (role === 'admin' || role === 'manager') && awaiting ? { icon: 'icon-user-round-check', title: awaiting + ' result' + (awaiting > 1 ? 's' : '') + ' waiting for review', sub: (scope === ALL ? 'All departments' : scope) + ' · ' + DATA.cycle.short, onClick: () => this.go('staff-evals') } : null,
      role === 'admin' && nextCycle ? { icon: 'icon-calendar-cog', title: nextCycle.name + ' is scheduled', sub: 'Opens ' + new Date(nextCycle.start).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), onClick: () => this.go('cycles') } : null,
      { icon: 'icon-user-round-check', title: 'Manager evaluation received', sub: 'Q3 2026 · Joseph Ahor Abandoh-Sam', onClick: () => this.go('profile', 'history') },
      FT.developmentPlan ? { icon: 'icon-badge-check', title: 'Development action approved', sub: 'CompTIA CySA+ certification course', onClick: () => this.go('plan') } : null,
    ].filter(Boolean);
    const common = { data: DATA, role, vw, go: this.go, features: FT, model, scope, myDept };
    return {
      ...common, page: s.page, tab: s.tab, id: s.id, onTab: t => { set({ tab: t, active: t === 'plan' ? 'plan' : 'profile' }); this.props.onNavigate && this.props.onNavigate('profile', t, { replace: true }); }, status: s.status,
      onStatus: st => set({ status: st }), profiles: s.profiles, setProfiles: this.setProfiles, evals: s.evals, setEval: this.setEval, resetEvals: this.resetEvals,
      pTake: s.page === 'take', pSignin: s.page === 'signin', shell: s.page !== 'take' && s.page !== 'signin', pForms: s.page === 'forms',
      onSignedIn: u => { const m = { Administrator: 'admin', 'Assessment Creator': 'creator', 'Manager / Supervisor': 'manager', Participant: 'staff' }; this.setState({ roleOverride: m[u.role] || 'staff' }, () => this.go('home')); },
      pHome: s.page === 'home', pProfile: s.page === 'profile', pAssess: grp === 'assess', pTeam: grp === 'team', pAnalytics: grp === 'analytics', pTraining: grp === 'training', pFramework: grp === 'framework', pCycles: grp === 'cycles', pSystem: grp === 'system', pReport: grp === 'report',
      compact, notCompact: !compact, wideHeader: vw >= 760, showScope: role === 'admin',
      scopeValue: s.scope, onScope: e => this.setScope(e.target.value), deptNames: DATA.depts.map(d => d.name),
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
      goBack: () => { const h = [...s.history]; const prev = h.pop() || { page: 'home' }; this.go(prev.page, prev.tab, prev.id); this.setState({ history: h }); },
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
    const P = { data: __v.data, role: __v.role, vw: __v.vw, go: __v.go, features: __v.features, model: __v.model, scope: __v.scope, myDept: __v.myDept };
    return (
      <>
      {(__v.pSignin) ? (<>
        <SMSignIn data={__v.data} vw={__v.vw} onSignedIn={__v.onSignedIn} features={__v.features} />
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
                {(__v.showScope) ? (<>
                  <label title={"Department scope for dashboards, heatmap, training needs, reports, staff evaluations and target profiles"} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", borderRadius: "999px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)", padding: "0 6px 0 12px", color: "#e3f1e8" }}>
                    <i className={"icon-building-2"} style={{ fontSize: "15px" }}></i>
                    <select value={__v.scopeValue} onChange={__v.onScope} aria-label={"Department scope"} style={{ maxWidth: __v.wideHeader ? "200px" : "120px", height: "30px", border: "0", outline: "0", background: "transparent", color: "#fff", font: "600 12.5px Inter,sans-serif", cursor: "pointer" }}>
                      <option value={ALL} style={{ color: "#111827" }}>All departments</option>
                      {(__v.deptNames || []).map(n => <option key={n} value={n} style={{ color: "#111827" }}>{n}</option>)}
                    </select>
                  </label>
                </>) : null}
                <button onClick={__v.toggleBell} aria-label={"Notifications"} style={{ position: "relative", width: "38px", height: "38px", borderRadius: "999px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)", color: "#e3f1e8", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <i className={"icon-bell"} style={{ fontSize: "18px" }}></i>
                  <span style={{ position: "absolute", top: "-4px", right: "-4px", background: "#ff3b30", color: "#fff", fontSize: "10px", fontWeight: "700", borderRadius: "999px", minWidth: "17px", height: "17px", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid #0f4a33" }}>{__v.notifCount}</span>
                </button>
                <button onClick={__v.goProfile} title={"My Profile"} style={{ display: "flex", alignItems: "center", gap: "8px", height: "38px", padding: "0 10px 0 3px", borderRadius: "999px", background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.16)", color: "#fff", cursor: "pointer" }}>
                  <span style={{ width: "32px", height: "32px", borderRadius: "50%", background: "repeating-linear-gradient(135deg,#cbd2da 0 4px,#b8c0ca 4px 8px)", border: "2px solid #fff", font: "600 10px 'JetBrains Mono',monospace", color: "#475569", display: "flex", alignItems: "center", justifyContent: "center" }}>AD</span>
                  {(__v.wideHeader) ? (<span style={{ font: "600 13px Inter,sans-serif", whiteSpace: "nowrap" }}>Denzil A.</span>) : null}
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
                      <button onClick={g?.toggle} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: "none", border: "0", padding: "6px 8px", cursor: "pointer", whiteSpace: "nowrap", font: "600 11px Inter,sans-serif", letterSpacing: ".4px", color: "#7b8594" }}>{g?.countLabel}<i className={g?.chev} style={{ fontSize: "14px", color: "#a0a8b4" }}></i></button>
                    </>) : null}
                    {(g?.showDivider && $index > 0) ? (<>
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
                    <button className={__css.h3} onClick={qk?.onClick} title={qk?.label} aria-label={qk?.label} style={{ position: "relative", width: "36px", height: "34px", borderRadius: "11px", border: "0", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", color: qk?.color }}>
                      <i className={qk?.icon} style={{ fontSize: "16px" }}></i>
                      {(qk?.badge) ? (<>
                        <span style={{ position: "absolute", top: "2px", right: "2px", minWidth: "14px", height: "14px", borderRadius: "999px", background: "#ff3b30", color: "#fff", font: "700 9px Inter,sans-serif", display: "flex", alignItems: "center", justifyContent: "center" }}>{qk?.badge}</span>
                      </>) : null}
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
            </aside>
            <main style={{ flex: "1", minWidth: "0", display: "flex", flexDirection: "column", minHeight: "calc(100vh - 68px)" }}>
              <div style={{ flex: "1" }}>
                {(__v.pHome) ? (<SMHome {...P} status={__v.status} />) : null}
                {(__v.pProfile) ? (<SMProfile {...P} tab={__v.tab} onTab={__v.onTab} />) : null}
                {(__v.pAssess) ? (<SMAssessments {...P} view={__v.page} status={__v.status} />) : null}
                {(__v.pTeam) ? (<SMTeam {...P} view={__v.page} evals={__v.evals} setEval={__v.setEval} resetEvals={__v.resetEvals} />) : null}
                {(__v.pAnalytics) ? (<SMAnalytics key={__v.page} {...P} view={__v.page} />) : null}
                {(__v.pTraining) ? (<SMTraining {...P} />) : null}
                {(__v.pFramework) ? (<SMFramework {...P} view={__v.page} profiles={__v.profiles} setProfiles={__v.setProfiles} />) : null}
                {(__v.pCycles) ? (<SMCycles {...P} />) : null}
                {(__v.pForms) ? (<SMFormBuilder data={__v.data} vw={__v.vw} go={__v.go} />) : null}
                {(__v.pSystem) ? (<SMSystem {...P} view={__v.page} />) : null}
                {(__v.pReport) ? (<SMStaffReport key={__v.id} {...P} id={__v.id} />) : null}
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
