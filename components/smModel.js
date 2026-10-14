// =============================================================================
// smModel.js · Data model: cycles, statuses, score bands, scoring and per-staff results
// Screen / URL: no screen of its own; feeds Home, Analytics, Training Needs, Staff Evaluations, Skill Framework, Cycles and the staff report (/report?id=)
// Who sees it: admin / manager (results); used for every role
// Used by: SkillMatrixApp.jsx, SMAdminHome, SMAnalytics, SMCycles, SMFramework, SMStaffEvals, SMStaffReport, SMTraining, smUI.jsx   Depends on: nothing (pure functions over buildData() + skm-target-profiles + skm-evals)
// Sections (search for these markers): DATA MODEL
// =============================================================================
// Derived data for the admin console. Everything here is computed from buildData()
// plus the browser state (target profiles and evaluation reviews), so no totals are hard-coded.

// ===== DATA MODEL · Cycles & statuses =====
export const CYCLES = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
export const CURRENT = 'Q4 2026';
export const PREVIOUS = 'Q3 2026';
export const STATUSES = ['Not started', 'In progress', 'Submitted', 'Auto-scored', 'Confirmed'];
export const STATUS_C = { 'Not started': ['#f3f4f6', '#4b5563'], 'In progress': ['#fef3c7', '#92400e'], Submitted: ['#e0e7ff', '#3730a3'], 'Auto-scored': ['#e0f2fe', '#0369a1'], Confirmed: ['#dcfce7', '#15803d'] };
export const STATUS_HINT = {
  'Not started': 'Has not opened the assessment yet',
  'In progress': 'Timer running, not yet submitted',
  Submitted: 'Objective items auto-scored; the open-text answer is waiting for a reviewer',
  'Auto-scored': 'Every item is scored; waiting for the manager to confirm',
  Confirmed: 'Result confirmed by the manager',
};
export const isScored = st => st === 'Submitted' || st === 'Auto-scored' || st === 'Confirmed';
// ===== DATA MODEL · Score bands & tiers =====
// Scoring interpretation from the DVLA competency assessment tools.
export const BANDS = [{ name: 'High Competency', min: 80, bg: '#dcfce7', fg: '#15803d' }, { name: 'Moderate Competency', min: 60, bg: '#e0f2fe', fg: '#0369a1' },
  { name: 'Basic Competency', min: 40, bg: '#fef3c7', fg: '#92400e' }, { name: 'Training Required', min: 0, bg: '#fee2e2', fg: '#b91c1c' }];
export const bandOf = p => BANDS.find(b => p >= b.min) || BANDS[BANDS.length - 1];
// Evaluation tiers map a percentage to a 1–5 proficiency level. They keep the bands' 40/60/80 cut-offs
// and split High Competency into Proficient (80–89) and Expert (90+). The Form Builder uses the same tiers.
export const TIERS = [{ name: 'Expert', min: 90, level: 5 }, { name: 'Proficient', min: 80, level: 4 }, { name: 'Competent', min: 60, level: 3 }, { name: 'Basic', min: 40, level: 2 }, { name: 'Novice', min: 0, level: 1 }];
export const TIERS_TEXT = 'Expert ≥90, Proficient ≥80, Competent ≥60, Basic ≥40, otherwise Novice';
export const PASS = 60;
export const levelFromPct = p => (TIERS.find(t => p >= t.min) || TIERS[TIERS.length - 1]).level;
// ===== DATA MODEL · Small helpers =====
export const avg = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
export const round1 = n => Math.round(n * 10) / 10;
export const ALL = 'All';

// ===== DATA MODEL · Target profiles =====
export function profileLabel(p) { return p ? p.title + ' · ' + p.track + ' track' : 'No target profile'; }

// A department override beats the org-wide profile for the same job level.
export function resolveProfile(profiles, s) {
  const same = profiles.filter(p => p.level === s.level);
  const o = same.find(p => Array.isArray(p.scope) && p.scope.includes(s.dept));
  if (o) return { p: o, override: true };
  const g = same.find(p => p.scope === 'all');
  return { p: g || null, override: false };
}
// Target for one competency: a per-competency value wins, then the category target, otherwise 3.
export function targetOf(p, c) {
  if (!p) return 3;
  const v = p.comps && p.comps[c.id];
  return v != null ? v : (p.targets[c.category] != null ? p.targets[c.category] : 3);
}

// ===== DATA MODEL · Scoring =====
// Objective items score automatically; open text only counts once a reviewer scores it.
export function scoreSubmission(sub, textScore) {
  const per = {}; let earned = 0, max = 0, pending = 0;
  sub.items.forEach(it => {
    let frac;
    if (it.type === 'text') { if (textScore == null) { pending++; return; } frac = textScore / 5; }
    else if (it.type === 'likert') frac = it.value / (it.points || 5);
    else frac = it.value ? 1 : 0;
    const p = per[it.comp] || (per[it.comp] = { earned: 0, max: 0, asked: 0, right: 0 });
    if (it.type === 'single' && it.bank) { p.asked++; if (it.value) p.right++; }
    p.earned += it.weight * frac; p.max += it.weight; earned += it.weight * frac; max += it.weight;
  });
  const comps = {};
  Object.keys(per).forEach(k => { const pct = per[k].max ? per[k].earned / per[k].max * 100 : 0; comps[k] = { pct: Math.round(pct), level: levelFromPct(pct), asked: per[k].asked, right: per[k].right }; });
  const pct = max ? Math.round(earned / max * 100) : 0;
  return { comps, pct, pending, pass: pct >= PASS };
}

// ===== DATA MODEL · Training suggestion =====
// A gap of 3 or more gets the full training programme; a smaller gap gets coached practice.
function trainingFor(D, id, gap) {
  const t = D.training[id];
  if (!t || gap <= 0) return null;
  return gap >= 3 ? t.primary : t.refresher;
}

// ===== DATA MODEL · buildModel (per-staff results) =====
// Cached: rebuilt only when the data, target profiles or evaluations change. Live evaluations (skm-evals)
// override the seeded result, and a manager adjustment overrides the system score.
let _cache = null;
export function buildModel(D, profiles, evals) {
  if (_cache && _cache.D === D && _cache.profiles === profiles && _cache.evals === evals) return _cache.model;
  const compById = Object.fromEntries(D.framework.map(c => [c.id, c]));
  const staff = D.staff.map(s0 => {
    const live = (evals || {})[s0.id] || {};
    const seed = s0.seed || {};
    const text = live.text !== undefined ? live.text : seed.text;
    const confirmed = live.confirmed !== undefined ? live.confirmed : !!seed.confirmed;
    const adj = { ...(seed.adj || {}), ...(live.adj || {}) };
    // Status: raw seed state first, then Confirmed / Auto-scored (open text scored) / Submitted.
    const status = s0.raw === 'not_started' ? 'Not started' : s0.raw === 'in_progress' ? 'In progress' : confirmed ? 'Confirmed' : text != null ? 'Auto-scored' : 'Submitted';
    const scored = isScored(status);
    const sc = scored ? scoreSubmission(s0.sub, text) : null;
    const { p, override } = resolveProfile(profiles, s0);
    const comps = s0.comps.map(id => {
      const c = compById[id], target = targetOf(p, c);
      const system = sc ? sc.comps[id].level : null, a = adj[id] || null;
      const final = scored ? (a ? a.score : system) : null;
      // Actual = this cycle's final score once scored, otherwise last cycle's (Q3 2026) result.
      const actual = scored ? final : s0.hist[PREVIOUS][id];
      const gap = Math.max(0, target - actual);
      return { id, name: c.name, short: c.short, category: c.category, group: c.group, importance: c.importance, target, system, final, adjusted: a, actual, gap,
        source: scored ? CURRENT : PREVIOUS, pct: sc ? sc.comps[id].pct : null, asked: sc ? sc.comps[id].asked : 0, right: sc ? sc.comps[id].right : 0, training: trainingFor(D, id, gap), priority: gap * c.importance };
    });
    const hist = {};
    CYCLES.slice(0, 3).forEach(q => { hist[q] = avg(comps.map(c => s0.hist[q][c.id])); });
    if (scored) hist[CURRENT] = avg(comps.map(c => c.final));
    const top = [...comps].sort((a, b) => b.gap - a.gap || b.importance - a.importance)[0];
    return { id: s0.id, staffNo: s0.staffNo, name: s0.name, email: s0.email, dept: s0.dept, designation: s0.designation, level: s0.level, levelName: s0.levelName, track: s0.track, bank: s0.bank,
      hod: s0.hod, location: s0.location, status, scored, pending: sc ? sc.pending : 0, overallPct: sc ? sc.pct : null, pass: sc ? sc.pass : null, band: sc ? bandOf(sc.pct).name : null,
      submittedAt: scored ? s0.submittedAt : null, submittedIso: scored ? s0.submittedIso : null, textItem: s0.textItem, text, confirmed, confirmedBy: live.by || seed.by || null,
      profile: p, profileLabel: profileLabel(p), override, comps, hist, top,
      avgTarget: avg(comps.map(c => c.target)), avgActual: avg(comps.map(c => c.actual)), avgGap: avg(comps.map(c => c.gap)) };
  });
  const byId = Object.fromEntries(staff.map(s => [s.id, s]));
  const model = { staff, byId, compById };
  _cache = { D, profiles, evals, model };
  return model;
}

// ===== DATA MODEL · Department scope =====
export const inScope = (model, dept) => (!dept || dept === ALL ? model.staff : model.staff.filter(s => s.dept === dept));

// ===== DATA MODEL · Drawer rows =====
// Drawer rows. A staff row summarises a person (averages + their largest gap);
// a record row is one person × one competency.
export function staffRow(s) {
  const t = s.top;
  return { id: s.id, name: s.name, dept: s.dept, role: s.designation, target: round1(s.avgTarget), actual: round1(s.avgActual), gap: t ? t.gap : 0, gapNote: t ? t.short : '',
    status: s.status, training: t && t.training ? t.training.name : '—' };
}
export function recordRow(s, c) {
  return { id: s.id, name: s.name, dept: s.dept, role: s.designation, target: c.target, actual: c.actual, gap: c.gap, gapNote: c.short, comp: c.name,
    status: s.status, training: c.training ? c.training.name : '—' };
}
export function records(staffList, pred) {
  const out = [];
  staffList.forEach(s => s.comps.forEach(c => { if (!pred || pred(c, s)) out.push(recordRow(s, c)); }));
  return out;
}

// ===== DATA MODEL · Individual report =====
// Everything the individual report shows, used by the report page and the Report Builder.
export function individualReport(D, model, id) {
  const s = model.byId[id];
  if (!s) return null;
  const trainings = s.comps.filter(c => c.training).sort((a, b) => b.priority - a.priority)
    .map(c => ({ comp: c.name, gap: c.gap, importance: c.importance, priority: c.priority, name: c.training.name, provider: c.training.provider, days: c.training.days, mode: c.training.mode }));
  const src = D.staff.find(x => x.id === id);
  return {
    s,
    details: [['Staff ID', s.staffNo], ['Name', s.name], ['Email', s.email], ['Department', s.dept], ['Designation', s.designation], ['Job level', s.levelName + ' · ' + s.track + ' track'], ['Head of department', s.hod], ['Location', s.location],
      ['Target profile', s.profileLabel + (s.override ? ' (department override)' : ' (org-wide)')], ['Q4 2026 status', s.status], ['Overall score', s.overallPct == null ? '—' : s.overallPct + '% · ' + s.band + (s.pass ? '' : ' (below pass mark)')]],
    comps: s.comps.map(c => ({ Competency: c.name, Category: c.category, Importance: c.importance, Target: c.target, 'System score': c.system == null ? '—' : c.system, 'Correct answers': c.asked ? c.right + ' of ' + c.asked : '—', 'Final score': c.final == null ? '—' : c.final,
      Actual: c.actual, Gap: c.gap, Source: c.source, Adjustment: c.adjusted ? c.adjusted.reason : '' })),
    history: s.comps.map(c => { const row = { Competency: c.name }; CYCLES.slice(0, 3).forEach(q => { row[q] = src.hist[q][c.id]; }); row[CURRENT] = c.final == null ? '—' : c.final; return row; }),
    historyAvg: CYCLES.map(q => ({ cycle: q, value: s.hist[q] == null ? null : round1(s.hist[q]) })),
    trainings,
  };
}
