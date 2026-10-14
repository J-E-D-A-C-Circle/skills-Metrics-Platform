'use client';
// =============================================================================
// SMFormBuilder · Form library and drag-and-drop assessment form builder (build, score, preview, version)
// Screen / URL: "/forms" (tabs inside the page: Build, Rubric & Scoring, Preview, Versions)
// Who sees it: admin, creator (Forms is hidden from managers and staff in the sidebar)
// Used by: SkillMatrixApp.jsx (page "forms"); SMCycles.jsx imports loadForms/saveForms/newForm/makeQuestion/loadBank/QBANK_KEY
//   Depends on: smUI (PageHeader, Btn), ui/select (Select), SMFormBuilder.module.css, props.data (framework, BANKS, PROF, IMP, depts)
// Sections (search for these markers): FORMS · Constants, Likert scale helpers, Likert scale display, Question factory,
//   Default evaluation tiers, Seed forms, Shared load/save API, Conditional logic & scoring, Main component, Drag & drop,
//   Preview answers & signature pad, View values, Build tab: canvas items, Build tab: question inspector values, Live score,
//   Preview tab: question rows, Values handed to the screen, Save draft & publish, Tabs, Question palette & question bank,
//   Rubric & scoring values, Preview result values, Version history actions, Render, Page header, Form toolbar, Locked notice,
//   Tab bar, Build tab, Question types palette, Question bank, Canvas, Section header card, Question card, Inspector (all parts),
//   Rubric & Scoring tab, Scoring mode & pass threshold, Evaluation tiers, Scoring matrix, Preview tab, Live result panel,
//   Versions tab, Toast
// =============================================================================
import React from 'react';
import __css from './SMFormBuilder.module.css';
import { PageHeader, Btn } from './smUI';
import { Select } from './ui/select';


// ===== FORMS · Constants (storage key, question types, scales, colours) =====
// All forms live in localStorage under "skm-forms" (KEY).
const KEY = 'skm-forms';
const TYPES = {
  section: ['Section', 'icon-heading'], likert: ['Likert scale', 'icon-gauge'], single: ['Single choice', 'icon-circle-dot'], multi: ['Multiple select', 'icon-list-checks'],
  text: ['Open text', 'icon-text'], numeric: ['Numeric', 'icon-hash'], matrix: ['Matrix / rubric', 'icon-grid-3x3'], file: ['File / image', 'icon-paperclip'],
  signature: ['Signature', 'icon-signature'], gps: ['GPS location', 'icon-map-pin'] };
const SCALES = { proficiency: ['Novice', 'Basic', 'Competent', 'Proficient', 'Expert'], importance: ['Not important', 'Minor', 'Moderate', 'Very important', 'Critical'], agree: ['Strongly disagree', 'Disagree', 'Neutral', 'Agree', 'Strongly agree'] };
const COLORS = ['#0d3b2a', '#2f9e44', '#1c8fd1', '#f08c00', '#e03131', '#6d28d9'];
// Likert presets. Proficiency comes from the Rating Scales (DATA.PROF) and is a 5-point scale.
const PRESETS = {
  proficiency: { label: 'Proficiency 1–5 (Rating Scales)' },
  agree: { label: 'Agreement', 3: ['Disagree', 'Neutral', 'Agree'], 4: ['Strongly disagree', 'Disagree', 'Agree', 'Strongly agree'], 5: SCALES.agree, 7: ['Strongly disagree', 'Disagree', 'Somewhat disagree', 'Neutral', 'Somewhat agree', 'Agree', 'Strongly agree'] },
  frequency: { label: 'Frequency', 3: ['Rarely', 'Sometimes', 'Often'], 4: ['Never', 'Sometimes', 'Often', 'Always'], 5: ['Never', 'Rarely', 'Sometimes', 'Often', 'Always'], 7: ['Never', 'Very rarely', 'Rarely', 'Sometimes', 'Often', 'Very often', 'Always'] },
  importance: { label: 'Importance 1–5', 5: SCALES.importance },
  custom: { label: 'Custom labels' },
};
const POINTS = [3, 4, 5, 7];
// ===== FORMS · Likert scale helpers =====
// Labels/descriptions for a preset; the 5-point Proficiency preset reads the live Rating Scales (data.PROF).
function presetLabels(preset, n, d) {
  if (preset === 'proficiency' && n === 5) return d ? d.PROF.slice(1).map(p => p.label) : SCALES.proficiency;
  const p = PRESETS[preset]; return p && p[n] ? [...p[n]] : null;
}
function presetDescs(preset, n, d) {
  if (preset === 'proficiency' && n === 5 && d) return d.PROF.slice(1).map(p => p.desc);
  if (preset === 'importance' && n === 5 && d) return d.IMP.slice(1).map(p => p.desc);
  return Array(n).fill('');
}
const fit = (a, n, f) => Array.from({ length: n }, (_, i) => (a && a[i] != null ? a[i] : f(i)));
// The scale a participant sees for a Likert question (handles older questions that only stored `scale`).
function likertOf(q, d) {
  const preset = q.preset || ({ agree: 'agree', importance: 'importance' }[q.scale] || 'proficiency');
  const points = q.points || 5;
  const labels = q.labels && q.labels.length === points ? q.labels : (presetLabels(preset, points, d) || fit(q.labels, points, i => 'Level ' + (i + 1)));
  const descs = q.descs && q.descs.length === points ? q.descs : presetDescs(preset, points, d);
  return { preset, points, labels, descs, showNumbers: q.showNumbers !== false };
}
// ===== FORMS · Likert scale display (LikertScale) =====
// Renders the scale exactly as participants see it. `value`/`onPick` make it interactive (Preview).
function LikertScale({ sc, value, onPick }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(' + sc.points + ',minmax(0,1fr))', gap: '6px' }}>
      {sc.labels.map((l, k) => { const on = value === k + 1; return (
        <button key={k} type="button" onClick={onPick ? e => { e.stopPropagation(); onPick(k + 1); } : undefined} tabIndex={onPick ? 0 : -1} title={sc.descs[k] || l}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', padding: '8px 4px', borderRadius: '9px', cursor: onPick ? 'pointer' : 'inherit', minWidth: '0', background: on ? '#0d3b2a' : '#fff', color: on ? '#fff' : '#374151', border: '1.5px solid ' + (on ? '#0d3b2a' : '#e5e7eb'), pointerEvents: onPick ? 'auto' : 'none' }}>
          {sc.showNumbers ? <span style={{ font: '700 15px Inter,sans-serif' }}>{k + 1}</span> : null}
          <span style={{ font: '600 11px Inter,sans-serif', textAlign: 'center', overflowWrap: 'anywhere' }}>{l}</span>
          {sc.descs[k] ? <span style={{ font: '400 10px/1.35 Inter,sans-serif', color: on ? '#cfe6d8' : '#6b7280', textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{sc.descs[k]}</span> : null}
        </button>); })}
    </div>
  );
}
// ===== FORMS · Question factory (blank) & small helpers =====
// blank(type) makes a new question with sensible defaults for that question type.
let UID = Date.now();
const nid = () => 'q' + (UID++).toString(36);
const today = () => new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
const clone = x => JSON.parse(JSON.stringify(x));
function blank(type, over) {
  const b = { id: nid(), type, text: type === 'section' ? 'New section' : 'Untitled ' + TYPES[type][0].toLowerCase() + ' question', help: '', required: type !== 'section' && type !== 'file', weight: ['section', 'signature', 'gps', 'file'].includes(type) ? 0 : 1, comp: '', cond: null };
  if (type === 'likert') Object.assign(b, { scale: 'proficiency', preset: 'proficiency', points: 5, showNumbers: true });
  if (type === 'single') b.options = [{ label: 'Option A', score: 1 }, { label: 'Option B', score: 0 }, { label: 'Option C', score: 0 }];
  if (type === 'multi') b.options = [{ label: 'Option A', score: 1 }, { label: 'Option B', score: 1 }, { label: 'Option C', score: -1 }];
  if (type === 'numeric') Object.assign(b, { min: 0, max: 100, unit: '', answer: '', tol: 0 });
  if (type === 'text') Object.assign(b, { minChars: 20, scoring: 'manual' });
  if (type === 'matrix') Object.assign(b, { rows: ['Criterion 1', 'Criterion 2'], cols: ['Novice', 'Basic', 'Competent', 'Proficient', 'Expert'] });
  if (type === 'file') Object.assign(b, { accept: 'image/*,.pdf', maxMB: 10 });
  return Object.assign(b, over || {});
}
// ===== FORMS · Default evaluation tiers =====
// Result bands by percentage: Expert 90+, Proficient 80+, Competent 60+, Basic 40+, Novice below.
const TIERS = () => [{ name: 'Expert', min: 90, color: '#0d3b2a' }, { name: 'Proficient', min: 80, color: '#2f9e44' }, { name: 'Competent', min: 60, color: '#1c8fd1' }, { name: 'Basic', min: 40, color: '#f08c00' }, { name: 'Novice', min: 0, color: '#e03131' }];
// ===== FORMS · Seed forms (first run) =====
// Seed forms come from the DVLA source documents: one RBDI tool and one HR question bank per job level
// (questions, options and answer keys verbatim), plus self-ratings for the general and technical skills.
function seed(d) {
  const fw = Object.fromEntries(d.framework.map(c => [c.id, c]));
  const form = (id, name, items, note, date) => { const scoring = { pass: 60, mode: 'weighted', tiers: TIERS() };
    return { id, name, status: 'Published', version: 1, items, scoring, history: [{ v: 1, status: 'Published', date: date || '01 Oct 2026', note, items: null, scoring: clone(scoring) }] }; };
  const rate = c => blank('likert', { text: 'How would you rate your current proficiency in ' + c.name + '?', comp: c.name, weight: 2 });
  const fromBank = bank => {
    const items = []; let last = null;
    bank.items.forEach(([cid, area, text, opts, ans]) => {
      const c = fw[cid];
      if (c.id !== last) { last = c.id; items.push(blank('section', { text: (c.code ? c.code + ' ' : '') + c.name, help: c.areas ? 'Skill areas: ' + c.areas.join(', ') : c.group })); }
      items.push(blank('single', { text, help: c.areas ? 'Skill area: ' + area : '', comp: c.name, options: opts.map((label, i) => ({ label, score: i === ans ? 1 : 0 })) }));
    });
    return items;
  };
  const general = d.framework.filter(c => c.category === 'General');
  const forms = [
    form('f1', 'General Skills Self-Assessment', [blank('section', { text: 'General skills', help: 'Rate yourself honestly against the proficiency scale. Your line manager confirms the result.' }), ...general.map(rate),
      blank('text', { text: 'Describe a recent piece of work that shows your Leadership & Management skills. What did you do, and what would you do differently?', comp: 'Leadership & Management', minChars: 40, weight: 2 })], 'General skills from the Skills Matrix Data Analysis sample', '02 Jun 2026'),
    ...d.BANKS.map((b, i) => form('f' + (i + 2), b.title, fromBank(b), 'Imported from ' + b.source + ' (' + b.items.length + ' questions)')),
  ];
  d.depts.filter(dp => !dp.bank).forEach((dp, i) => {
    const tech = d.framework.filter(c => c.dept === dp.name);
    forms.push(form('fs' + i, dp.name + ' Technical Skills Self-Rating', [blank('section', { text: dp.name + ' technical skills' }), ...tech.map(rate)], 'Technical skills for ' + dp.name));
  });
  return forms;
}
// ===== FORMS · Shared load/save API (used by Assessment Cycles) =====
// "skm-qbank" holds questions uploaded in Cycles. loadForms() seeds and saves the default forms when "skm-forms" is empty.
// Shared with Assessment Cycles, which can create forms and add questions from an upload.
export const QBANK_KEY = 'skm-qbank';
export function makeQuestion(type, over) { return blank(type, over); }
export function loadForms(d) {
  let f = null; try { f = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (Array.isArray(f) && f.length) return f;
  const s = seed(d); saveForms(s); return s;
}
export function saveForms(forms) { try { localStorage.setItem(KEY, JSON.stringify(forms)); } catch (e) {} }
export function newForm(name, items, note) { return { id: 'f' + Date.now().toString(36), name, status: 'Draft', version: 1, items, scoring: { pass: 60, mode: 'weighted', tiers: TIERS() }, history: [{ v: 1, status: 'Draft', date: today(), note: note || 'Created', items: null }] }; }
export function loadBank() { try { const b = JSON.parse(localStorage.getItem(QBANK_KEY) || '[]'); return Array.isArray(b) ? b : []; } catch (e) { return []; } }
// ===== FORMS · Conditional logic, answered check & scoring =====
// condMet(): true when a question's condition on an earlier answer holds (or it has no condition).
function condMet(q, items, ans) {
  const c = q.cond; if (!c) return true;
  const src = items.find(x => x.id === c.qid); if (!src) return true;
  const v = ans[c.qid]; if (v === undefined || v === null || v === '') return false;
  if (src.type === 'single') { const lbl = src.options[v] && src.options[v].label; return c.op === 'is not' ? lbl !== c.value : lbl === c.value; }
  if (src.type === 'multi') { const has = (v || []).some(i => src.options[i] && src.options[i].label === c.value); return c.op === 'is not' ? !has : has; }
  const a = +v, b = +c.value;
  return { '=': a === b, '≠': a !== b, '≥': a >= b, '≤': a <= b, '>': a > b, '<': a < b }[c.op];
}
function answered(q, v) {
  if (q.type === 'multi') return Array.isArray(v) && v.length > 0;
  if (q.type === 'text') return typeof v === 'string' && v.trim().length >= (q.minChars || 0) && v.trim().length > 0;
  if (q.type === 'matrix') return v && q.rows.every((_, i) => v[i] !== undefined);
  return v !== undefined && v !== null && v !== '';
}
// score(): weighted points per section. Manual-review text questions count as "pending"; questions whose
// condition is not met are skipped; "equal" mode gives every weighted question a weight of 1.
function score(form, ans) {
  const out = { earned: 0, max: 0, pending: 0, sections: [] }; let cur = { title: 'General', earned: 0, max: 0 };
  const push = () => { if (cur.max > 0) out.sections.push(cur); };
  form.items.forEach(q => {
    if (q.type === 'section') { push(); cur = { title: q.text, earned: 0, max: 0 }; return; }
    const met = condMet(q, form.items, ans);
    if (q.cond && !met) return;
    if (q.type === 'text' && q.scoring === 'manual') { out.pending++; return; }
    const w = form.scoring.mode === 'equal' ? (q.weight > 0 ? 1 : 0) : (+q.weight || 0); if (w <= 0) return;
    const v = ans[q.id]; let frac = null;
    if (q.type === 'likert') frac = v ? v / (q.points || 5) : 0;
    else if (q.type === 'single') { const m = Math.max(...q.options.map(o => +o.score || 0)); if (m <= 0) return; frac = v !== undefined ? Math.max(0, +q.options[v].score || 0) / m : 0; }
    else if (q.type === 'multi') { const pos = q.options.reduce((a, o) => a + Math.max(0, +o.score || 0), 0); if (pos <= 0) return; const sum = (v || []).reduce((a, i) => a + (+q.options[i].score || 0), 0); frac = Math.max(0, Math.min(pos, sum)) / pos; }
    else if (q.type === 'numeric') { if (q.answer === '' || q.answer === undefined) return; frac = v !== undefined && v !== '' && Math.abs(+v - +q.answer) <= (+q.tol || 0) ? 1 : 0; }
    else if (q.type === 'matrix') { frac = q.rows.length ? q.rows.reduce((a, _, i) => a + (v && v[i] !== undefined ? (v[i] + 1) / q.cols.length : 0), 0) / q.rows.length : 0; }
    else return;
    out.max += w; out.earned += w * frac; cur.max += w; cur.earned += w * frac;
  });
  push(); return out;
}
// ===== FORMS · Main component (state & editing actions) =====
class SMFormBuilder extends React.Component {
  state = { forms: null, sel: 0, selQ: null, tab: 'build', ans: {}, tried: false, submitMsg: '', submitOk: false, over: null, gpsBusy: null, toast: '' };
  componentDidMount() { this.setState({ forms: loadForms(this.props.data), bankUp: loadBank() }); this._sig = {}; }
  // Every state change saves the forms list to localStorage "skm-forms" when it has changed.
  setState(u, cb) { return super.setState(u, () => { const fm = this.state.forms; if (fm && fm !== this._saved) { this._saved = fm; try { localStorage.setItem(KEY, JSON.stringify(fm)); } catch (e) {} } cb && cb(); }); }
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  // Editing a Published/Archived form starts a new Draft version (version number +1, logged in history).
  edit(fn) {
    this.setState(s => ({ forms: s.forms.map((f, i) => {
      if (i !== s.sel) return f; let g = fn(f);
      if (f.status !== 'Draft') { const v = Math.max(...f.history.map(h => h.v), f.version) + 1; g = { ...g, status: 'Draft', version: v, history: [...g.history, { v, status: 'Draft', date: today(), note: 'New draft based on v' + f.version, items: null }] }; }
      return g; }) }));
  }
  setItems(fn) { this.edit(f => ({ ...f, items: fn(f.items) })); }
  updQ(id, patch) { this.setItems(items => items.map(q => q.id === id ? { ...q, ...patch } : q)); }
  insert(q, at) { this.setItems(items => { const a = [...items]; a.splice(at == null ? a.length : at, 0, q); return a; }); this.setState({ selQ: q.id }); }
  // ===== FORMS · Drag & drop and reorder =====
  dropAt(i) {
    const d = this._drag; this._drag = null; this.setState({ over: null }); if (!d) return;
    if (d.kind === 'new') this.insert(blank(d.type), i);
    else this.setItems(items => { const a = [...items]; const [m] = a.splice(d.from, 1); a.splice(d.from < i ? i - 1 : i, 0, m); return a; });
  }
  move(i, dir) { this.setItems(items => { const j = i + dir; if (j < 0 || j >= items.length) return items; const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; return a; }); }
  // ===== FORMS · Preview answers & signature pad =====
  setAns(id, v) { this.setState(s => ({ ans: { ...s.ans, [id]: v }, submitMsg: '' })); }
  bindSig(el, id) {
    if (!el) return; this._sig = this._sig || {}; this._sig[id] = el; if (el._bound) return; el._bound = true;
    const ctx = el.getContext('2d'); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#0d3b2a'; let down = false;
    const pos = e => { const r = el.getBoundingClientRect(); return [(e.clientX - r.left) * el.width / r.width, (e.clientY - r.top) * el.height / r.height]; };
    el.addEventListener('pointerdown', e => { down = true; el.setPointerCapture(e.pointerId); const [x, y] = pos(e); ctx.beginPath(); ctx.moveTo(x, y); });
    el.addEventListener('pointermove', e => { if (!down) return; const [x, y] = pos(e); ctx.lineTo(x, y); ctx.stroke(); });
    const end = () => { if (!down) return; down = false; this.setAns(id, 'signed'); };
    el.addEventListener('pointerup', end); el.addEventListener('pointerleave', end);
  }
  // ===== FORMS · View values (renderVals) =====
  // Builds every value and handler the JSX below reads as __v.*; layout switches to side panes at 1180px+.
  renderVals() {
    const s = this.state, d = this.props.data, vw = this.props.vw || 1440;
    if (!d || !s.forms) return {};
    const f = s.forms[s.sel], items = f.items;
    const wide = vw >= 1180;
    const SC = { Published: ['#dcfce7', '#15803d'], Draft: ['#fef3c7', '#92400e'], Archived: ['#f3f4f6', '#4b5563'], Superseded: ['#f3f4f6', '#6b7280'] };
    let n = 0; const numOf = {}; items.forEach(q => { if (q.type !== 'section') numOf[q.id] = ++n; });
    const qCount = n;
    const sel = items.find(q => q.id === s.selQ);
    const condLabel = q => { if (!q.cond) return ''; const src = items.find(x => x.id === q.cond.qid); return (q.cond.effect === 'score' ? 'Scored if ' : 'Shown if ') + (src ? 'Q' + numOf[src.id] : '?') + ' ' + q.cond.op + ' ' + q.cond.value; };
    const summary = q => ({
      likert: (sc => sc.points + '-point ' + PRESETS[sc.preset].label.replace(/ \(.*\)| 1–5/g, '').toLowerCase() + ' scale' + (sc.showNumbers ? '' : ' · numbers hidden'))(likertOf(q, d)),
      single: q.options && q.options.length + ' options · ' + q.options.filter(o => +o.score > 0).length + ' scoring',
      multi: q.options && q.options.length + ' options · select all that apply',
      numeric: (q.min ?? '') + '–' + (q.max ?? '') + ' ' + (q.unit || '') + (q.answer !== '' && q.answer !== undefined ? ' · answer ' + q.answer + (q.tol ? ' ±' + q.tol : '') : ' · not scored'),
      text: 'Min ' + q.minChars + ' characters · ' + (q.scoring === 'manual' ? 'manual review' : 'not scored'),
      matrix: q.rows && q.rows.length + ' rows × ' + q.cols.length + ' columns',
      file: ({ 'image/*': 'Images', '.pdf': 'PDF', 'image/*,.pdf': 'Images & PDF', '': 'Any file' }[q.accept] || 'Files') + ' · max ' + q.maxMB + ' MB',
      signature: 'Draw-to-sign pad', gps: 'Captures latitude and longitude',
    }[q.type]);
    // ===== FORMS · Build tab: canvas items =====
    const canvas = items.map((q, i) => ({
      isSection: q.type === 'section', isQuestion: q.type !== 'section', text: q.text, help: q.help, num: numOf[q.id], icon: TYPES[q.type][1], typeLabel: TYPES[q.type][0],
      required: q.required, weightText: q.weight > 0 ? 'Weight ' + q.weight : 'Not scored', condText: condLabel(q), comp: q.comp, summary: summary(q),
      // What the participant sees, rendered inline on the canvas.
      type: q.type, scale: q.type === 'likert' ? likertOf(q, d) : null, options: q.options || [], radius: q.type === 'multi' ? '5px' : '50%', rows: q.rows || [], cols: q.cols || [], unit: q.unit, range: (q.min ?? '') + '–' + (q.max ?? ''), minChars: q.minChars, accept: q.accept, maxMB: q.maxMB,
      border: q.id === s.selQ ? '#0d3b2a' : '#e5e7eb', outline: q.id === s.selQ ? '2px solid #f2a516' : 'none', dropLine: s.over === i ? '#f2a516' : 'transparent',
      select: () => this.setState({ selQ: q.id }),
      onDragStart: e => { this._drag = { kind: 'move', from: i }; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', q.id); } catch (er) {} },
      onDragOver: e => { e.preventDefault(); if (this.state.over !== i) this.setState({ over: i }); },
      onDrop: e => { e.preventDefault(); e.stopPropagation(); this.dropAt(i); },
      up: e => { e.stopPropagation(); this.move(i, -1); }, down: e => { e.stopPropagation(); this.move(i, 1); },
      dup: e => { e.stopPropagation(); this.insert({ ...clone(q), id: nid() }, i + 1); },
      remove: e => { e.stopPropagation(); this.setItems(a => a.filter(x => x.id !== q.id).map(x => x.cond && x.cond.qid === q.id ? { ...x, cond: null } : x)); if (s.selQ === q.id) this.setState({ selQ: null }); },
    }));
    // ===== FORMS · Build tab: question inspector values =====
    // Conditions can only point to earlier Likert, single, multi or numeric questions.
    let insp = {};
    if (sel) {
      const u = p => this.updQ(sel.id, p);
      const idx = items.indexOf(sel);
      const sources = items.slice(0, idx).filter(x => ['likert', 'single', 'multi', 'numeric'].includes(x.type));
      const cond = sel.cond, src = cond && items.find(x => x.id === cond.qid);
      const choiceSrc = src && (src.type === 'single' || src.type === 'multi');
      insp = {
        icon: TYPES[sel.type][1], typeLabel: TYPES[sel.type][0], textLabel: sel.type === 'section' ? 'SECTION TITLE' : 'QUESTION',
        text: sel.text, help: sel.help, onText: e => u({ text: e.target.value }), onHelp: e => u({ help: e.target.value }),
        isQuestion: sel.type !== 'section', reqJustify: sel.required ? 'flex-end' : 'flex-start', reqBg: sel.required ? '#0d3b2a' : '#d1d5db', toggleReq: () => u({ required: !sel.required }),
        weight: sel.weight, onWeight: e => u({ weight: +e.target.value }), comp: sel.comp || '', onComp: e => u({ comp: e.target.value }),
        isLikert: sel.type === 'likert', likert: sel.type === 'likert' ? (() => { const sc = likertOf(sel, d);
          const setPoints = n => { const pl = presetLabels(sc.preset, n, d); if (pl) u({ points: n, labels: pl, descs: presetDescs(sc.preset, n, d) }); else u({ points: n, preset: 'custom', labels: fit(sc.labels, n, i => 'Level ' + (i + 1)), descs: fit(sc.descs, n, () => '') }); };
          const setPreset = p => { if (p === 'custom') { u({ preset: 'custom', labels: sc.labels, descs: sc.descs }); return; } const n = presetLabels(p, sc.points, d) ? sc.points : 5; u({ preset: p, points: n, scale: p === 'agree' ? 'agree' : p === 'importance' ? 'importance' : 'proficiency', labels: presetLabels(p, n, d), descs: presetDescs(p, n, d) }); };
          return { ...sc, setPoints, setPreset, presetOptions: Object.entries(PRESETS).map(([k, v]) => [k, v.label]), pointOptions: POINTS,
            setLabel: (k, v) => u({ preset: 'custom', labels: sc.labels.map((x, j) => j === k ? v : x), descs: sc.descs }),
            setDesc: (k, v) => u({ labels: sc.labels, descs: sc.descs.map((x, j) => j === k ? v : x) }),
            toggleNumbers: () => u({ showNumbers: !sc.showNumbers }) }; })() : null,
        isChoice: sel.type === 'single' || sel.type === 'multi',
        options: (sel.options || []).map((o, k) => ({ label: o.label, score: o.score,
          onLabel: e => u({ options: sel.options.map((x, j) => j === k ? { ...x, label: e.target.value } : x) }),
          onScore: e => u({ options: sel.options.map((x, j) => j === k ? { ...x, score: +e.target.value } : x) }),
          remove: () => sel.options.length > 2 ? u({ options: sel.options.filter((_, j) => j !== k) }) : this.flash('A choice question needs at least 2 options') })),
        addOption: () => u({ options: [...sel.options, { label: 'Option ' + String.fromCharCode(65 + sel.options.length), score: 0 }] }),
        optionHint: sel.type === 'single' ? 'The highest-scoring option counts as correct. Other options can earn partial credit.' : 'Selected scores are added up. Give wrong options a negative score so guessing is penalised.',
        isNumeric: sel.type === 'numeric', min: sel.min, max: sel.max, answer: sel.answer, tol: sel.tol, unit: sel.unit,
        onMin: e => u({ min: e.target.value === '' ? '' : +e.target.value }), onMax: e => u({ max: e.target.value === '' ? '' : +e.target.value }), onAnswer: e => u({ answer: e.target.value === '' ? '' : +e.target.value }), onTol: e => u({ tol: +e.target.value }), onUnit: e => u({ unit: e.target.value }),
        isText: sel.type === 'text', minChars: sel.minChars, scoring: sel.scoring, onMinChars: e => u({ minChars: +e.target.value }), onScoring: e => u({ scoring: e.target.value }),
        isMatrix: sel.type === 'matrix', rows: (sel.rows || []).join('\n'), cols: (sel.cols || []).join('\n'),
        onRows: e => u({ rows: e.target.value.split('\n') }), onCols: e => u({ cols: e.target.value.split('\n') }),
        isFile: sel.type === 'file', accept: sel.accept, maxMB: sel.maxMB, onAccept: e => u({ accept: e.target.value }), onMaxMB: e => u({ maxMB: +e.target.value }),
        infoNote: sel.type === 'signature' ? 'Staff sign with a mouse, finger or stylus. Their signature is stored with the submission.' : sel.type === 'gps' ? "Records the device's latitude and longitude when staff tap Capture. Use this for field assessments." : sel.type === 'section' ? 'Sections group questions. Scores are also shown per section.' : '',
        condOn: !!cond, noSources: !sources.length && sel.type !== 'section', condJustify: cond ? 'flex-end' : 'flex-start', condBg: cond ? '#6d28d9' : '#d1d5db',
        toggleCond: () => { if (cond) return u({ cond: null }); if (!sources.length) return this.flash('Add a scorable question above this one first');
          const s0 = sources[sources.length - 1]; u({ cond: { qid: s0.id, op: s0.type === 'single' || s0.type === 'multi' ? 'is' : '≥', value: s0.type === 'single' || s0.type === 'multi' ? s0.options[0].label : '3', effect: 'show' } }); },
        sources: sources.map(x => ({ id: x.id, label: 'Q' + numOf[x.id] + ' · ' + x.text.slice(0, 48) })),
        condQ: cond ? cond.qid : '', condOp: cond ? cond.op : '', condVal: cond ? String(cond.value) : '', condEffect: cond ? cond.effect : 'show',
        ops: choiceSrc ? ['is', 'is not'] : ['=', '≠', '≥', '≤', '>', '<'],
        condValSelect: !!cond && (choiceSrc || (src && src.type === 'likert')), condValInput: !!cond && src && src.type === 'numeric',
        condVals: choiceSrc ? src.options.map(o => ({ value: o.label, label: o.label })) : (src && src.type === 'likert' ? likertOf(src, d).labels : SCALES.proficiency).map((l, k) => ({ value: String(k + 1), label: k + 1 + ' · ' + l })),
        onCondQ: e => { const ns = items.find(x => x.id === e.target.value); const ch = ns.type === 'single' || ns.type === 'multi'; u({ cond: { ...cond, qid: ns.id, op: ch ? 'is' : '≥', value: ch ? ns.options[0].label : '3' } }); },
        onCondOp: e => u({ cond: { ...cond, op: e.target.value } }), onCondVal: e => u({ cond: { ...cond, value: e.target.value } }), onCondEffect: e => u({ cond: { ...cond, effect: e.target.value } }),
      };
    }
    // ===== FORMS · Live score for Preview & Rubric totals =====
    const sc = score(f, s.ans), pct = sc.max ? Math.round(sc.earned / sc.max * 100) : 0;
    const tiers = [...f.scoring.tiers].sort((a, b) => b.min - a.min), tier = tiers.find(t => pct >= t.min) || tiers[tiers.length - 1] || { name: '—', color: '#9ca3af' };
    const passed = pct >= f.scoring.pass;
    const full = score(f, Object.fromEntries(items.map(q => [q.id, q.type === 'likert' ? 5 : undefined])));
    const maxAll = items.reduce((a, q) => { if (q.type === 'section' || (q.type === 'text' && q.scoring === 'manual')) return a; const w = f.scoring.mode === 'equal' ? (q.weight > 0 ? 1 : 0) : (+q.weight || 0);
      if (q.type === 'numeric' && (q.answer === '' || q.answer === undefined)) return a; if (['file', 'signature', 'gps', 'text'].includes(q.type)) return a; return a + w; }, 0);
    const method = q => q.type === 'text' ? (q.scoring === 'manual' ? 'Manual' : 'Not scored') : ['file', 'signature', 'gps'].includes(q.type) || q.weight <= 0 || (q.type === 'numeric' && (q.answer === '' || q.answer === undefined)) ? 'Not scored' : q.cond && q.cond.effect === 'score' ? 'Conditional' : 'Auto';
    const MC = { Auto: ['#dcfce7', '#15803d'], Manual: ['#fef3c7', '#92400e'], 'Not scored': ['#f3f4f6', '#6b7280'], Conditional: ['#f3e8ff', '#6d28d9'] };
    // ===== FORMS · Preview tab: question rows & validation =====
    const pv = items.filter(q => q.type === 'section' || condMet(q, items, s.ans) || (q.cond && q.cond.effect === 'score')).map(q => {
      const v = s.ans[q.id], base = { isSection: q.type === 'section', isQuestion: q.type !== 'section', text: q.text, help: q.help, num: numOf[q.id], required: q.required };
      if (q.type === 'section') return base;
      let err = '';
      if (q.type === 'numeric' && v !== undefined && v !== '' && ((q.min !== '' && +v < q.min) || (q.max !== '' && +v > q.max))) err = 'Enter a number between ' + q.min + ' and ' + q.max + '.';
      else if (q.type === 'text' && v && v.trim().length < q.minChars) err = s.tried ? 'Write at least ' + q.minChars + ' characters.' : '';
      if (!err && s.tried && q.required && !answered(q, v)) err = 'This question is required.';
      const r = { ...base, err, border: err ? '#fca5a5' : '#e5e7eb', isLikert: q.type === 'likert', isChoice: q.type === 'single' || q.type === 'multi', isNumeric: q.type === 'numeric', isText: q.type === 'text', isMatrix: q.type === 'matrix', isFile: q.type === 'file', isSig: q.type === 'signature', isGps: q.type === 'gps' };
      if (r.isLikert) Object.assign(r, { scale: likertOf(q, d), value: v, pick: n => this.setAns(q.id, n) });
      if (r.isChoice) { r.radius = q.type === 'multi' ? '5px' : '50%'; r.opts = q.options.map((o, k) => { const on = q.type === 'multi' ? (v || []).includes(k) : v === k;
        return { label: o.label, bg: on ? '#eef7f1' : '#fff', border: on ? '#0d3b2a' : '#e5e7eb', dot: on ? '#0d3b2a' : '#cbd2da', dotFill: on ? '#0d3b2a' : '#fff',
          pick: () => q.type === 'multi' ? this.setAns(q.id, on ? (v || []).filter(x => x !== k) : [...(v || []), k]) : this.setAns(q.id, k) }; }); }
      if (r.isNumeric) Object.assign(r, { value: v ?? '', unit: q.unit, range: q.min + '–' + q.max, onInput: e => this.setAns(q.id, e.target.value) });
      if (r.isText) Object.assign(r, { value: v || '', count: (v || '').trim().length + ' / ' + q.minChars + ' min characters', onInput: e => this.setAns(q.id, e.target.value) });
      if (r.isMatrix) Object.assign(r, { cols: q.cols, rows: q.rows.map((label, ri) => ({ label, cells: q.cols.map((_, ci) => { const on = v && v[ri] === ci; return { border: on ? '#0d3b2a' : '#cbd2da', fill: on ? '#0d3b2a' : '#fff', pick: () => this.setAns(q.id, { ...(v || {}), [ri]: ci }) }; }) })) });
      if (r.isFile) Object.assign(r, { accept: q.accept, fileText: v ? v.name + ' · ' + (v.size / 1024 / 1024).toFixed(2) + ' MB' : 'Choose a file (max ' + q.maxMB + ' MB)',
        onFile: e => { const fl = e.target.files && e.target.files[0]; if (!fl) return; if (fl.size > q.maxMB * 1048576) { this.flash('That file is larger than ' + q.maxMB + ' MB'); return; } this.setAns(q.id, { name: fl.name, size: fl.size }); } });
      if (r.isSig) Object.assign(r, { sigRef: el => this.bindSig(el, q.id), sigText: v ? 'Signed' : 'Sign inside the box', clearSig: () => { const el = this._sig && this._sig[q.id]; if (el) el.getContext('2d').clearRect(0, 0, el.width, el.height); this.setAns(q.id, undefined); } });
      if (r.isGps) Object.assign(r, { gpsBtn: s.gpsBusy === q.id ? 'Locating…' : v ? 'Recapture' : 'Capture location', gpsText: v ? v.lat.toFixed(5) + ', ' + v.lng.toFixed(5) + (v.mock ? ' (sample)' : ' ±' + Math.round(v.acc) + 'm') : '',
        captureGps: () => { this.setState({ gpsBusy: q.id }); const done = p => { this.setState({ gpsBusy: null }); this.setAns(q.id, p); };
          try { navigator.geolocation.getCurrentPosition(p => done({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }), () => done({ lat: 5.60372, lng: -0.18696, mock: true }), { timeout: 6000 }); } catch (e) { done({ lat: 5.60372, lng: -0.18696, mock: true }); } } });
      return r;
    });
    const missing = items.filter(q => q.type !== 'section' && q.required && condMet(q, items, s.ans) && !answered(q, s.ans[q.id])).length;
    const setScoring = p => this.edit(x => ({ ...x, scoring: { ...x.scoring, ...p } }));
    // ===== FORMS · Values handed to the screen =====
    return {
      // ===== FORMS · Form picker, new form, name & status =====
      selValue: String(s.sel), onPickForm: e => this.setState({ sel: +e.target.value, selQ: null, ans: {}, tried: false, submitMsg: '' }),
      formOptions: s.forms.map((x, i) => ({ value: String(i), label: x.name + ' (' + x.status + ')' })),
      newForm: () => { const nf = { id: 'f' + Date.now(), name: 'Untitled assessment form', status: 'Draft', version: 1, items: [blank('section', { text: 'Section 1' })], scoring: { pass: 60, mode: 'weighted', tiers: TIERS() }, history: [{ v: 1, status: 'Draft', date: today(), note: 'Created', items: null }] };
        this.setState({ forms: [...s.forms, nf], sel: s.forms.length, selQ: null, tab: 'build', ans: {} }); },
      formName: f.name, onFormName: e => { const val = e.target.value; this.setState(st => ({ forms: st.forms.map((x, i) => i === st.sel ? { ...x, name: val } : x) })); },
      status: f.status, version: f.version, statusBg: SC[f.status][0], statusFg: SC[f.status][1], qCountText: qCount + ' questions · ' + items.filter(q => q.type === 'section').length + ' sections',
      lockedNote: f.status === 'Published' ? 'v' + f.version + ' is published and locked. Any change you make starts draft v' + (Math.max(...f.history.map(h => h.v)) + 1) + '.' : f.status === 'Archived' ? 'This form is archived. Editing it creates a new draft.' : '',
      publishBg: f.status === 'Draft' ? '#16a34a' : '#9ca3af', publishText: f.status === 'Draft' ? 'Publish v' + f.version : 'Published',
      // ===== FORMS · Save draft & publish =====
      // Publish needs at least one question and a scoring option on every choice question; older published versions become "Superseded".
      saveDraft: () => { if (f.status !== 'Draft') { this.flash('Nothing to save. Make an edit to start a new draft.'); return; } this.flash('Draft v' + f.version + ' saved'); },
      publish: () => { if (f.status !== 'Draft') return; if (!qCount) { this.flash('Add at least one question before publishing'); return; }
        const bad = items.find(q => (q.type === 'single' || q.type === 'multi') && !q.options.some(o => +o.score > 0) && q.weight > 0);
        if (bad) { this.setState({ selQ: bad.id, tab: 'build' }); this.flash('Q' + numOf[bad.id] + ' needs at least one option with a score'); return; }
        this.setState(st => ({ forms: st.forms.map((x, i) => { if (i !== st.sel) return x;
          const hist = x.history.map(h => h.status === 'Published' ? { ...h, status: 'Superseded' } : h).filter(h => h.v !== x.version);
          return { ...x, status: 'Published', history: [...hist, { v: x.version, status: 'Published', date: today(), note: 'Published with ' + qCount + ' questions', items: clone(x.items), scoring: clone(x.scoring) }] }; }) }));
        this.flash('v' + f.version + ' published. It can now be scheduled for assessment day.'); },
      // ===== FORMS · Tabs (Build / Rubric & Scoring / Preview / Versions) =====
      tabs: [['build', 'Build', 'icon-blocks'], ['rubric', 'Rubric & Scoring', 'icon-scale'], ['preview', 'Preview & Test', 'icon-eye'], ['versions', 'Versions', 'icon-history']].map(([k, label, icon]) => ({ label, icon,
        onClick: () => this.setState({ tab: k }), bg: s.tab === k ? '#e6f2ea' : 'transparent', fg: s.tab === k ? '#0d3b2a' : '#4b5563' })),
      tabBuild: s.tab === 'build', tabRubric: s.tab === 'rubric', tabPreview: s.tab === 'preview', tabVersions: s.tab === 'versions',
      paneMax: wide ? '260px' : 'none', inspMax: wide ? '360px' : 'none', panePos: wide ? 'sticky' : 'static', inspMaxH: wide ? 'calc(100vh - 100px)' : 'none',
      // ===== FORMS · Question palette & question bank =====
      // Question bank = uploaded questions + one self-rating per competency + HR bank questions; search shows at most 80.
      palette: Object.entries(TYPES).map(([k, [label, icon]]) => ({ label, icon, add: () => { const at = sel ? items.indexOf(sel) + 1 : null; this.insert(blank(k), at); },
        onDragStart: e => { this._drag = { kind: 'new', type: k }; try { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', k); } catch (er) {} } })),
      dragEnd: () => { this._drag = null; this.setState({ over: null }); },
      bank: (() => { const at = sel ? items.indexOf(sel) + 1 : null, t = (s.bankQ || '').trim().toLowerCase();
        const fw = Object.fromEntries(d.framework.map(c => [c.id, c]));
        const list = [...(s.bankUp || []).map(q => ({ name: q.text, major: 'Uploaded · ' + TYPES[q.type][0] + (q.comp ? ' · ' + q.comp : ''), add: () => this.insert({ ...clone(q), id: nid() }, sel ? items.indexOf(sel) + 1 : null) })),
        ...d.framework.map(c => ({ name: c.name, major: c.dept ? c.dept + ' · ' + c.group : 'General · ' + c.category, add: () => this.insert(blank('likert', { text: 'How would you rate your current proficiency in ' + c.name + '?', comp: c.name, weight: c.importance >= 4 ? 2 : 1 }), sel ? items.indexOf(sel) + 1 : null) })),
          ...(d.BANKS || []).flatMap(b => b.items.map(([cid, area, text, opts, ans]) => ({ name: text, major: b.title + ' · ' + fw[cid].name,
            add: () => this.insert(blank('single', { text, help: fw[cid].areas ? 'Skill area: ' + area : '', comp: fw[cid].name, options: opts.map((label, k) => ({ label, score: k === ans ? 1 : 0 })) }), at) })))];
        const hit = t ? list.filter(x => (x.name + ' ' + x.major).toLowerCase().includes(t)) : list;
        return hit.slice(0, 80); })(),
      bankQ: s.bankQ || '', onBankQ: e => this.setState({ bankQ: e.target.value }), bankTotal: (s.bankUp || []).length + d.framework.length + (d.BANKS || []).reduce((a, b) => a + b.items.length, 0),
      // ===== FORMS · Canvas & inspector =====
      canvas, endOver: e => { e.preventDefault(); if (this.state.over !== items.length) this.setState({ over: items.length }); }, endDrop: e => { e.preventDefault(); this.dropAt(items.length); },
      endBorder: s.over === items.length ? '#f2a516' : 'rgba(15,35,65,.14)', endBg: s.over === items.length ? '#fffbeb' : 'transparent',
      noSel: !sel, hasSel: !!sel, insp, compOptions: d.framework.map(c => c.name),
      // ===== FORMS · Rubric & scoring values =====
      modes: [['weighted', 'Weighted'], ['equal', 'Equal weight']].map(([k, label]) => ({ label, onClick: () => setScoring({ mode: k }), bg: f.scoring.mode === k ? '#fff' : 'transparent', fg: f.scoring.mode === k ? '#111827' : '#4b5563' })),
      pass: f.scoring.pass, onPass: e => setScoring({ pass: +e.target.value }),
      maxPoints: +maxAll.toFixed(1), passPoints: +(maxAll * f.scoring.pass / 100).toFixed(1), manualCount: items.filter(q => q.type === 'text' && q.scoring === 'manual').length,
      tiers: f.scoring.tiers.map((t, k) => ({ ...t,
        onName: e => setScoring({ tiers: f.scoring.tiers.map((x, j) => j === k ? { ...x, name: e.target.value } : x) }),
        onMin: e => setScoring({ tiers: f.scoring.tiers.map((x, j) => j === k ? { ...x, min: +e.target.value } : x) }),
        cycleColor: () => setScoring({ tiers: f.scoring.tiers.map((x, j) => j === k ? { ...x, color: COLORS[(COLORS.indexOf(x.color) + 1) % COLORS.length] } : x) }),
        remove: () => f.scoring.tiers.length > 2 ? setScoring({ tiers: f.scoring.tiers.filter((_, j) => j !== k) }) : this.flash('Keep at least 2 tiers') })),
      addTier: () => setScoring({ tiers: [...f.scoring.tiers, { name: 'New tier', min: 50, color: COLORS[f.scoring.tiers.length % COLORS.length] }] }),
      matrixRows: items.filter(q => q.type !== 'section').map(q => { const m = method(q), w = f.scoring.mode === 'equal' ? (q.weight > 0 ? 1 : 0) : q.weight;
        return { num: numOf[q.id], text: q.text, type: TYPES[q.type][0], method: m, mBg: MC[m][0], mFg: MC[m][1], weight: q.weight, max: m === 'Auto' || m === 'Conditional' ? w : '—', onWeight: e => this.updQ(q.id, { weight: +e.target.value }) }; }),
      // ===== FORMS · Preview result values =====
      pv, res: { pct, earned: +sc.earned.toFixed(1), max: +sc.max.toFixed(1), tier: tier.name, tierColor: tier.color, passText: passed ? 'Pass (≥' + f.scoring.pass + '%)' : 'Below pass mark (' + f.scoring.pass + '%)', passBg: passed ? '#dcfce7' : '#fee2e2', passFg: passed ? '#15803d' : '#b91c1c',
        sections: sc.sections.map(x => { const p = Math.round(x.earned / x.max * 100); return { title: x.title, pct: p, w: p + '%' }; }), pending: sc.pending ? sc.pending + ' open-text answer' + (sc.pending > 1 ? 's' : '') + ' will be scored by a reviewer' : '' },
      resetPreview: () => { Object.values(this._sig || {}).forEach(el => el.getContext('2d').clearRect(0, 0, el.width, el.height)); this.setState({ ans: {}, tried: false, submitMsg: '' }); },
      submitPreview: () => this.setState({ tried: true, submitMsg: missing ? missing + ' required question' + (missing > 1 ? 's are' : ' is') + ' still unanswered.' : 'Test response is valid. Score ' + pct + '% · ' + tier.name + '.', submitOk: !missing }),
      submitMsg: s.submitMsg, submitBg: s.submitOk ? '#dcfce7' : '#fef2f2', submitFg: s.submitOk ? '#15803d' : '#991b1b',
      // ===== FORMS · Version history actions =====
      history: [...f.history].sort((a, b) => b.v - a.v).map(h => ({ ...h, bg: SC[h.status][0], fg: SC[h.status][1], canRestore: !!h.items && h.v !== f.version,
        restore: () => { this.edit(x => ({ ...x, items: clone(h.items).map(q => ({ ...q })), scoring: h.scoring ? clone(h.scoring) : x.scoring })); this.setState({ tab: 'build', selQ: null }); this.flash('Restored v' + h.v + ' as a new draft'); } })),
      duplicate: () => { const nf = { ...clone(f), id: 'f' + Date.now(), name: f.name + ' (copy)', status: 'Draft', version: 1, history: [{ v: 1, status: 'Draft', date: today(), note: 'Duplicated from ' + f.name + ' v' + f.version, items: null }] };
        this.setState({ forms: [...s.forms, nf], sel: s.forms.length, tab: 'build', selQ: null }); this.flash('Duplicated as a new draft'); },
      archive: () => { this.setState(st => ({ forms: st.forms.map((x, i) => i === st.sel ? { ...x, status: 'Archived', history: x.history.map(h => h.v === x.version ? { ...h, status: 'Archived' } : h) } : x) })); this.flash('Form archived'); },
      toast: s.toast,
    };
  }
  // ===== FORMS · Render =====
  render() {
    // Forms load from localStorage after mount; render once they are there so every input starts controlled.
    if (!this.state.forms) return null;
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px", display: "flex", flexDirection: "column", gap: "20px" }}>
        {/* ===== FORMS · Page header (form picker + New form) ===== */}
        <PageHeader title={"Form Builder"} description={"Build assessment forms by dragging question types onto the canvas. Each question shows exactly what staff will see."}
          actions={<>
            <Select value={__v.selValue} onChange={__v.onPickForm} aria-label={"Form"} style={{ height: "36px", maxWidth: "280px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "500 13px Inter,sans-serif", background: "#fff", color: "#111827" }}>
              {(__v.formOptions || []).map((o, $index) => (<option key={$index} value={o?.value}>{o?.label}</option>))}
            </Select>
            <Btn kind={"primary"} icon={"icon-file-plus"} onClick={__v.newForm}>New form</Btn>
          </>} />
        {/* ===== FORMS · Form toolbar (name, status, Save draft, Publish) ===== */}
        <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px", padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
            <input className={__css.h0} value={__v.formName} onChange={__v.onFormName} style={{ flex: "1 1 260px", minWidth: "0", border: "1px solid transparent", borderRadius: "10px", padding: "6px 8px", font: "600 18px Inter,sans-serif", color: "#111827", background: "transparent" }} />
            <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "4px 10px", background: __v.statusBg, color: __v.statusFg }}>{__v.status} · v{__v.version}</span>
            <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{__v.qCountText}</span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginLeft: "auto" }}>
              <button onClick={__v.saveDraft} style={{ height: "34px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Save draft</button>
              <button onClick={__v.publish} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 16px", border: "0", borderRadius: "999px", background: __v.publishBg, color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-rocket"} style={{ fontSize: "14px" }}></i>{__v.publishText}</button>
            </div>
          </div>
          {/* ===== FORMS · Locked (published) notice ===== */}
          {(__v.lockedNote) ? (<>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 18px", background: "#fffbeb", borderBottom: "1px solid #fde68a", fontSize: "12.5px", color: "#92400e" }}><i className={"icon-info"} style={{ fontSize: "14px" }}></i>{__v.lockedNote}</div>
          </>) : null}
          {/* ===== FORMS · Tab bar ===== */}
          <div style={{ display: "flex", gap: "4px", padding: "6px 10px", overflowX: "auto" }}>
            {(__v.tabs || []).map((t, $index) => (<React.Fragment key={$index}>
              <button onClick={t?.onClick} style={{ flex: "none", display: "flex", alignItems: "center", gap: "7px", height: "36px", padding: "0 14px", border: "0", borderRadius: "10px", cursor: "pointer", whiteSpace: "nowrap", font: "500 14px Inter,sans-serif", background: t?.bg, color: t?.fg }}><i className={t?.icon} style={{ fontSize: "15px" }}></i>{t?.label}</button>
            </React.Fragment>))}
          </div>
        </div>
        {/* ===== FORMS · Build tab ===== */}
        {(__v.tabBuild) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "flex-start" }}>
            {/* ===== FORMS · Question types palette (left) ===== */}
            <aside style={{ flex: "1 1 220px", maxWidth: __v.paneMax, display: "flex", flexDirection: "column", gap: "14px", position: __v.panePos, top: "80px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "14px" }}>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280", marginBottom: "10px" }}>QUESTION TYPES</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(112px,1fr))", gap: "8px" }}>
                  {(__v.palette || []).map((p, $index) => (<React.Fragment key={$index}>
                    <div className={__css.h1} draggable={"true"} onDragStart={p?.onDragStart} onDragEnd={__v.dragEnd} onClick={p?.add} title={"Drag onto the canvas, or click to add"} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "6px", padding: "10px", border: "1px solid #e5e7eb", borderRadius: "12px", background: "rgba(255,255,255,.4)", cursor: "grab", userSelect: "none" }}>
                      <span style={{ width: "28px", height: "28px", borderRadius: "7px", background: "#fff", border: "1px solid #e5e7eb", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <i className={p?.icon} style={{ fontSize: "14px" }}></i>
                      </span>
                      <span style={{ font: "600 12px Inter,sans-serif", color: "#111827" }}>{p?.label}</span>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
              {/* ===== FORMS · Question bank (left) ===== */}
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "14px" }}>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280", marginBottom: "4px" }}>QUESTION BANK</div>
                <div style={{ fontSize: "11.5px", color: "#6b7280", marginBottom: "8px" }}>{__v.bankTotal} items: library competencies (as Likert) and the DVLA question banks</div>
                <input value={__v.bankQ || ""} onChange={__v.onBankQ} placeholder="Search questions or competencies" aria-label="Search the question bank" style={{ width: "100%", height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "9px", padding: "0 10px", font: "400 12.5px Inter,sans-serif", marginBottom: "8px", background: "#fff", boxSizing: "border-box" }} />
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "280px", overflowY: "auto" }}>
                  {(__v.bank || []).map((b, $index) => (<React.Fragment key={$index}>
                    <button className={__css.h2} onClick={b?.add} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 8px", border: "0", borderRadius: "7px", background: "transparent", cursor: "pointer", textAlign: "left" }}>
                      <i className={"icon-plus"} style={{ fontSize: "12px", color: "#6b7280" }}></i>
                      <span style={{ display: "flex", flexDirection: "column", minWidth: "0" }}>
                        <span style={{ font: "500 12.5px Inter,sans-serif", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b?.name}</span>
                        <span style={{ font: "400 11px Inter,sans-serif", color: "#9ca3af" }}>{b?.major}</span>
                      </span>
                    </button>
                  </React.Fragment>))}
                </div>
              </div>
            </aside>
            {/* ===== FORMS · Canvas (questions in the middle) ===== */}
            <section style={{ flex: "3 1 440px", minWidth: "0", display: "flex", flexDirection: "column", gap: "8px" }}>
              {(__v.canvas || []).map((it, $index) => (<React.Fragment key={$index}>
                <div draggable={"true"} onDragStart={it?.onDragStart} onDragOver={it?.onDragOver} onDrop={it?.onDrop} onDragEnd={__v.dragEnd} onClick={it?.select} style={{ borderTop: `3px solid ${it?.dropLine ?? ""}`, borderRadius: "12px" }}>
                  {/* ===== FORMS · Section header card ===== */}
                  {(it?.isSection) ? (<>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", borderRadius: "12px", background: "#0d3b2a", color: "#fff", cursor: "pointer", outline: it?.outline, outlineOffset: "2px" }}>
                      <i className={"icon-grip-vertical"} style={{ fontSize: "16px", color: "#9cc4b0", cursor: "grab" }}></i>
                      <div style={{ flex: "1", minWidth: "0" }}>
                        <div style={{ font: "700 15px Inter,sans-serif" }}>{it?.text}</div>
                        {(it?.help) ? (<>
                          <div style={{ font: "400 12px Inter,sans-serif", color: "#b9d8c6", marginTop: "2px" }}>{it?.help}</div>
                        </>) : null}
                      </div>
                      <button onClick={it?.up} title={"Move up"} style={{ background: "none", border: "0", color: "#b9d8c6", cursor: "pointer", display: "flex", padding: "4px" }}>
                        <i className={"icon-arrow-up"} style={{ fontSize: "14px" }}></i>
                      </button>
                      <button onClick={it?.down} title={"Move down"} style={{ background: "none", border: "0", color: "#b9d8c6", cursor: "pointer", display: "flex", padding: "4px" }}>
                        <i className={"icon-arrow-down"} style={{ fontSize: "14px" }}></i>
                      </button>
                      <button onClick={it?.remove} title={"Delete"} style={{ background: "none", border: "0", color: "#fca5a5", cursor: "pointer", display: "flex", padding: "4px" }}>
                        <i className={"icon-trash-2"} style={{ fontSize: "14px" }}></i>
                      </button>
                    </div>
                  </>) : null}
                  {/* ===== FORMS · Question card ===== */}
                  {(it?.isQuestion) ? (<>
                    <div className={__css.h3} style={{ display: "flex", gap: "10px", padding: "14px", borderRadius: "12px", background: "#fff", border: `1.5px solid ${it?.border ?? ""}`, cursor: "pointer", boxShadow: "0 1px 2px rgba(16,24,40,.04)" }}>
                      <i className={"icon-grip-vertical"} style={{ fontSize: "16px", color: "#9ca3af", cursor: "grab", marginTop: "2px" }}></i>
                      <div style={{ flex: "1", minWidth: "0" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                          <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: "#6b7280" }}>Q{it?.num}</span>
                          <span style={{ display: "flex", alignItems: "center", gap: "5px", font: "600 11px Inter,sans-serif", color: "#0d3b2a", background: "#e6f2ea", borderRadius: "6px", padding: "3px 7px" }}><i className={it?.icon} style={{ fontSize: "12px" }}></i>{it?.typeLabel}</span>
                          {(it?.required) ? (<>
                            <span style={{ font: "600 10.5px Inter,sans-serif", color: "#991b1b", background: "#fef2f2", borderRadius: "999px", padding: "2px 7px" }}>Required</span>
                          </>) : null}
                          <span style={{ font: "600 10.5px Inter,sans-serif", color: "#374151", background: "#f3f4f6", borderRadius: "999px", padding: "2px 7px" }}>{it?.weightText}</span>
                          {(it?.condText) ? (<>
                            <span style={{ display: "flex", alignItems: "center", gap: "4px", font: "600 10.5px Inter,sans-serif", color: "#6d28d9", background: "#f3e8ff", borderRadius: "999px", padding: "2px 7px" }}><i className={"icon-git-branch"} style={{ fontSize: "11px" }}></i>{it?.condText}</span>
                          </>) : null}
                          {(it?.comp) ? (<>
                            <span style={{ font: "500 10.5px Inter,sans-serif", color: "#0369a1", background: "#e0f2fe", borderRadius: "999px", padding: "2px 7px" }}>{it?.comp}</span>
                          </>) : null}
                        </div>
                        <div style={{ font: "500 14.5px/1.45 Inter,sans-serif", color: "#111827", marginTop: "8px", textWrap: "pretty" }}>{it?.text}</div>
                        {(it?.help) ? (<div style={{ font: "400 12.5px Inter,sans-serif", color: "#6b7280", marginTop: "3px" }}>{it?.help}</div>) : null}
                        {/* ===== FORMS · Answer preview on canvas (read-only) ===== */}
                        <div style={{ marginTop: "10px", pointerEvents: "none" }} aria-hidden={"true"}>
                          {it.type === 'likert' ? <LikertScale sc={it.scale} /> : null}
                          {it.type === 'single' || it.type === 'multi' ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                              {it.options.map((o, k) => <div key={k} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "7px 10px", borderRadius: "9px", border: "1.5px solid #e5e7eb", background: "#fff" }}>
                                <span style={{ width: "16px", height: "16px", flex: "none", borderRadius: it.radius, border: "2px solid #cbd2da" }}></span>
                                <span style={{ font: "500 13px Inter,sans-serif", color: "#111827" }}>{o.label}</span></div>)}
                            </div>) : null}
                          {it.type === 'matrix' ? (
                            <div style={{ overflowX: "auto" }}><table style={{ borderCollapse: "collapse", width: "100%", minWidth: "380px", font: "400 12.5px Inter,sans-serif" }}>
                              <thead><tr><th></th>{it.cols.map((c, k) => <th key={k} style={{ padding: "4px", font: "600 10.5px Inter,sans-serif", color: "#6b7280", textAlign: "center" }}>{c}</th>)}</tr></thead>
                              <tbody>{it.rows.map((r, k) => <tr key={k}><td style={{ padding: "6px 8px 6px 0", borderTop: "1px solid rgba(15,35,65,.07)", color: "#111827" }}>{r}</td>{it.cols.map((c, j) => <td key={j} style={{ padding: "4px", borderTop: "1px solid rgba(15,35,65,.07)", textAlign: "center" }}><span style={{ display: "inline-block", width: "18px", height: "18px", borderRadius: "50%", border: "2px solid #cbd2da" }}></span></td>)}</tr>)}</tbody>
                            </table></div>) : null}
                          {it.type === 'numeric' ? <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "260px" }}><span style={{ flex: "1", height: "36px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "9px", padding: "0 12px", display: "flex", alignItems: "center", font: "500 13px 'JetBrains Mono',monospace", color: "#9ca3af" }}>{it.range}</span><span style={{ fontSize: "13px", color: "#4b5563" }}>{it.unit}</span></div> : null}
                          {it.type === 'text' ? <div style={{ height: "64px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "9px", padding: "8px 12px", font: "400 13px Inter,sans-serif", color: "#9ca3af" }}>Type your answer… (at least {it.minChars} characters)</div> : null}
                          {it.type === 'file' ? <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", border: "1.5px dashed #c7ccd4", borderRadius: "9px", font: "500 13px Inter,sans-serif", color: "#374151" }}><i className={"icon-paperclip"} style={{ fontSize: "15px", color: "#0d3b2a" }}></i>Choose a file (max {it.maxMB} MB)</div> : null}
                          {it.type === 'signature' ? <div style={{ height: "64px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "9px", background: "repeating-linear-gradient(0deg,#fff 0 63px,#e5e7eb 63px 64px)", display: "flex", alignItems: "flex-end", padding: "6px 10px", font: "400 11.5px Inter,sans-serif", color: "#9ca3af" }}>Sign inside the box</div> : null}
                          {it.type === 'gps' ? <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "999px", font: "500 13px Inter,sans-serif", color: "#0d3b2a", background: "#fff" }}><i className={"icon-locate-fixed"} style={{ fontSize: "14px" }}></i>Capture location</span> : null}
                        </div>
                        <div style={{ font: "400 11.5px Inter,sans-serif", color: "#9ca3af", marginTop: "8px" }}>{it?.summary}</div>
                      </div>
                      {/* ===== FORMS · Card buttons (move, duplicate, delete) ===== */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <button onClick={it?.up} title={"Move up"} style={{ background: "none", border: "0", color: "#9ca3af", cursor: "pointer", display: "flex", padding: "4px" }}>
                          <i className={"icon-arrow-up"} style={{ fontSize: "14px" }}></i>
                        </button>
                        <button onClick={it?.down} title={"Move down"} style={{ background: "none", border: "0", color: "#9ca3af", cursor: "pointer", display: "flex", padding: "4px" }}>
                          <i className={"icon-arrow-down"} style={{ fontSize: "14px" }}></i>
                        </button>
                        <button onClick={it?.dup} title={"Duplicate"} style={{ background: "none", border: "0", color: "#9ca3af", cursor: "pointer", display: "flex", padding: "4px" }}>
                          <i className={"icon-copy"} style={{ fontSize: "14px" }}></i>
                        </button>
                        <button onClick={it?.remove} title={"Delete"} style={{ background: "none", border: "0", color: "#9ca3af", cursor: "pointer", display: "flex", padding: "4px" }}>
                          <i className={"icon-trash-2"} style={{ fontSize: "14px" }}></i>
                        </button>
                      </div>
                    </div>
                  </>) : null}
                </div>
              </React.Fragment>))}
              {/* ===== FORMS · Drop zone at end of canvas ===== */}
              <div onDragOver={__v.endOver} onDrop={__v.endDrop} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", minHeight: "72px", border: `2px dashed ${__v.endBorder ?? ""}`, borderRadius: "12px", background: __v.endBg, font: "500 13px Inter,sans-serif", color: "#6b7280", textAlign: "center", padding: "12px" }}><i className={"icon-mouse-pointer-click"} style={{ fontSize: "16px" }}></i>Drop a question type here, or click one in the panel</div>
            </section>
            {/* ===== FORMS · Question settings inspector (right) ===== */}
            <aside style={{ flex: "1 1 300px", maxWidth: __v.inspMax, minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", position: __v.panePos, top: "80px", maxHeight: __v.inspMaxH, overflowY: "auto" }}>
              {/* ===== FORMS · Inspector empty state ===== */}
              {(__v.noSel) ? (<>
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#6b7280", fontSize: "13.5px" }}>
                  <i className={"icon-mouse-pointer-2"} style={{ fontSize: "24px", color: "#cbd2da" }}></i>
                  <div style={{ marginTop: "8px" }}>Select a question to edit its settings</div>
                </div>
              </>) : null}
              {(__v.hasSel) ? (<>
                <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", alignItems: "center", gap: "8px" }}>
                  <i className={__v.insp?.icon} style={{ fontSize: "15px", color: "#0d3b2a" }}></i>
                  <span style={{ fontSize: "14.5px", fontWeight: "600" }}>{__v.insp?.typeLabel}</span>
                </div>
                <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* ===== FORMS · Inspector: text, help, required, weight, competency ===== */}
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>{__v.insp?.textLabel}<textarea value={__v.insp?.text} onChange={__v.insp?.onText} style={{ minHeight: "70px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "8px 10px", font: "400 13.5px/1.5 Inter,sans-serif", color: "#111827", resize: "vertical" }}></textarea></label>
                  <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>HELP TEXT<input value={__v.insp?.help} onChange={__v.insp?.onHelp} placeholder={"Optional guidance for staff"} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13px Inter,sans-serif" }} /></label>
                  {(__v.insp?.isQuestion) ? (<>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end" }}>
                      <button onClick={__v.insp?.toggleReq} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "0", padding: "0 0 8px", cursor: "pointer", font: "500 13px Inter,sans-serif", color: "#374151" }}><span style={{ width: "34px", height: "20px", borderRadius: "999px", padding: "2px", display: "flex", justifyContent: __v.insp?.reqJustify, background: __v.insp?.reqBg }}>
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff" }}></span>
                        </span>Required</button>
                      <label style={{ flex: "1 1 90px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>WEIGHT<input type={"number"} min={"0"} max={"10"} step={"0.5"} value={__v.insp?.weight} onChange={__v.insp?.onWeight} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    </div>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>LINKED COMPETENCY<Select value={__v.insp?.comp} onChange={__v.insp?.onComp} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                        <option value={""}>None</option>
                        {(__v.compOptions || []).map((o, $index) => (<React.Fragment key={$index}>
                          <option value={o}>{o}</option>
                        </React.Fragment>))}
                      </Select></label>
                  </>) : null}
                  {/* ===== FORMS · Inspector: Likert settings (points, preset, labels) ===== */}
                  {(__v.insp?.isLikert) ? (() => { const L = __v.insp.likert; const lab = { display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }; const inp = { height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "8px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }; return (<>
                    <div style={lab}>POINTS
                      <div style={{ display: "flex", background: "rgba(118,118,128,.12)", borderRadius: "10px", padding: "3px", gap: "3px" }}>
                        {L.pointOptions.map(n => <button key={n} type={"button"} onClick={() => L.setPoints(n)} style={{ flex: "1", height: "28px", border: "0", borderRadius: "7px", cursor: "pointer", font: "600 12.5px Inter,sans-serif", background: L.points === n ? "#fff" : "transparent", color: L.points === n ? "#111827" : "#4b5563", boxShadow: L.points === n ? "0 1px 2px rgba(0,0,0,.08)" : "none" }}>{n}</button>)}
                      </div>
                    </div>
                    <label style={lab}>PRESET<Select value={L.preset} onChange={e => L.setPreset(e.target.value)} style={{ ...inp, height: "34px", background: "#fff" }}>
                        {L.presetOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                      </Select>{L.preset === 'proficiency' ? <span style={{ font: "400 11.5px Inter,sans-serif", letterSpacing: "0", color: "#6b7280" }}>Labels and anchors come from Rating Scales. Proficiency is a 5-point scale; other point counts switch to custom labels.</span> : null}</label>
                    <button type={"button"} onClick={L.toggleNumbers} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "0", padding: "0", cursor: "pointer", font: "500 13px Inter,sans-serif", color: "#374151" }}><span style={{ width: "34px", height: "20px", borderRadius: "999px", padding: "2px", display: "flex", justifyContent: L.showNumbers ? "flex-end" : "flex-start", background: L.showNumbers ? "#0d3b2a" : "#d1d5db" }}><span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff" }}></span></span>Show numbers</button>
                    <div style={lab}>LABELS &amp; ANCHOR DESCRIPTIONS
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {L.labels.map((l, k) => <div key={k} style={{ display: "grid", gridTemplateColumns: "22px minmax(0,1fr)", gap: "6px", alignItems: "start" }}>
                          <span style={{ font: "700 12px 'JetBrains Mono',monospace", color: "#0d3b2a", paddingTop: "8px", letterSpacing: "0" }}>{k + 1}</span>
                          <span style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <input value={l} onChange={e => L.setLabel(k, e.target.value)} style={inp} aria-label={"Label for point " + (k + 1)} />
                            <input value={L.descs[k] || ''} onChange={e => L.setDesc(k, e.target.value)} placeholder={"Anchor description (optional)"} style={{ ...inp, height: "30px", fontSize: "12px", color: "#4b5563" }} aria-label={"Anchor description for point " + (k + 1)} />
                          </span>
                        </div>)}
                      </div>
                    </div>
                  </>); })() : null}
                  {/* ===== FORMS · Inspector: choice options & scores ===== */}
                  {(__v.insp?.isChoice) ? (<>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", marginBottom: "6px" }}>
                        <span>OPTIONS</span>
                        <span>SCORE</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {(__v.insp?.options || []).map((o, $index) => (<React.Fragment key={$index}>
                          <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                            <input value={o?.label} onChange={o?.onLabel} style={{ flex: "1", minWidth: "0", height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", padding: "0 8px", font: "400 13px Inter,sans-serif" }} />
                            <input type={"number"} step={"0.5"} value={o?.score} onChange={o?.onScore} style={{ width: "60px", height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", padding: "0 6px", font: "400 13px Inter,sans-serif" }} />
                            <button onClick={o?.remove} style={{ background: "none", border: "0", cursor: "pointer", color: "#9ca3af", display: "flex", padding: "3px" }}>
                              <i className={"icon-x"} style={{ fontSize: "14px" }}></i>
                            </button>
                          </div>
                        </React.Fragment>))}
                      </div>
                      <button onClick={__v.insp?.addOption} style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "5px", background: "none", border: "0", padding: "0", cursor: "pointer", font: "600 12.5px Inter,sans-serif", color: "#127a42" }}><i className={"icon-plus"} style={{ fontSize: "13px" }}></i>Add option</button>
                      <div style={{ fontSize: "11.5px", color: "#6b7280", marginTop: "8px", lineHeight: "1.5" }}>{__v.insp?.optionHint}</div>
                    </div>
                  </>) : null}
                  {/* ===== FORMS · Inspector: numeric settings ===== */}
                  {(__v.insp?.isNumeric) ? (<>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>MINIMUM<input type={"number"} value={__v.insp?.min} onChange={__v.insp?.onMin} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>MAXIMUM<input type={"number"} value={__v.insp?.max} onChange={__v.insp?.onMax} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>CORRECT ANSWER<input type={"number"} value={__v.insp?.answer} onChange={__v.insp?.onAnswer} placeholder={"Not scored"} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>TOLERANCE ±<input type={"number"} min={"0"} value={__v.insp?.tol} onChange={__v.insp?.onTol} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    </div>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>UNIT<input value={__v.insp?.unit} onChange={__v.insp?.onUnit} placeholder={"e.g. minutes"} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13px Inter,sans-serif" }} /></label>
                  </>) : null}
                  {/* ===== FORMS · Inspector: open text settings ===== */}
                  {(__v.insp?.isText) ? (<>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>MIN CHARACTERS<input type={"number"} min={"0"} value={__v.insp?.minChars} onChange={__v.insp?.onMinChars} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>SCORING<Select value={__v.insp?.scoring} onChange={__v.insp?.onScoring} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                          <option value={"manual"}>Manual review</option>
                          <option value={"none"}>Not scored</option>
                        </Select></label>
                    </div>
                  </>) : null}
                  {/* ===== FORMS · Inspector: matrix rows & columns ===== */}
                  {(__v.insp?.isMatrix) ? (<>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>ROWS (ONE PER LINE)<textarea value={__v.insp?.rows} onChange={__v.insp?.onRows} style={{ minHeight: "80px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "8px 10px", font: "400 13px/1.5 Inter,sans-serif", resize: "vertical" }}></textarea></label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>COLUMNS, LOWEST TO HIGHEST<textarea value={__v.insp?.cols} onChange={__v.insp?.onCols} style={{ minHeight: "80px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "8px 10px", font: "400 13px/1.5 Inter,sans-serif", resize: "vertical" }}></textarea></label>
                    <div style={{ fontSize: "11.5px", color: "#6b7280", lineHeight: "1.5" }}>Each row scores its column position ÷ number of columns, then rows are averaged.</div>
                  </>) : null}
                  {/* ===== FORMS · Inspector: file upload settings ===== */}
                  {(__v.insp?.isFile) ? (<>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>ALLOWED FILES<Select value={__v.insp?.accept} onChange={__v.insp?.onAccept} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                          <option value={"image/*"}>Images</option>
                          <option value={".pdf"}>PDF</option>
                          <option value={"image/*,.pdf"}>Images &amp; PDF</option>
                          <option value={""}>Any file</option>
                        </Select></label>
                      <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>MAX SIZE (MB)<input type={"number"} min={"1"} max={"50"} value={__v.insp?.maxMB} onChange={__v.insp?.onMaxMB} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    </div>
                  </>) : null}
                  {/* ===== FORMS · Inspector: info note (signature / GPS) ===== */}
                  {(__v.insp?.infoNote) ? (<>
                    <div style={{ fontSize: "12px", color: "#4b5563", background: "#f5f6f8", borderRadius: "10px", padding: "10px", lineHeight: "1.5" }}>{__v.insp?.infoNote}</div>
                  </>) : null}
                  {/* ===== FORMS · Inspector: conditional logic ===== */}
                  {(__v.insp?.isQuestion) ? (<>
                    <div style={{ borderTop: "1px solid rgba(15,35,65,.07)", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
                      <button onClick={__v.insp?.toggleCond} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "0", padding: "0", cursor: "pointer", font: "600 13px Inter,sans-serif", color: "#374151" }}><span style={{ width: "34px", height: "20px", borderRadius: "999px", padding: "2px", display: "flex", justifyContent: __v.insp?.condJustify, background: __v.insp?.condBg }}>
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff" }}></span>
                        </span>Conditional logic</button>
                      {(__v.insp?.noSources) ? (<>
                        <div style={{ fontSize: "11.5px", color: "#9ca3af" }}>Add a Likert, choice or numeric question above this one to use conditions.</div>
                      </>) : null}
                      {(__v.insp?.condOn) ? (<>
                        <Select value={__v.insp?.condEffect} onChange={__v.insp?.onCondEffect} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                          <option value={"show"}>Only show this question if…</option>
                          <option value={"score"}>Only count this score if…</option>
                        </Select>
                        <Select value={__v.insp?.condQ} onChange={__v.insp?.onCondQ} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                          {(__v.insp?.sources || []).map((o, $index) => (<React.Fragment key={$index}>
                            <option value={o?.id}>{o?.label}</option>
                          </React.Fragment>))}
                        </Select>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <Select value={__v.insp?.condOp} onChange={__v.insp?.onCondOp} style={{ width: "110px", height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 6px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                            {(__v.insp?.ops || []).map((o, $index) => (<React.Fragment key={$index}>
                              <option value={o}>{o}</option>
                            </React.Fragment>))}
                          </Select>
                          {(__v.insp?.condValSelect) ? (<>
                            <Select value={__v.insp?.condVal} onChange={__v.insp?.onCondVal} style={{ flex: "1", minWidth: "0", height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 6px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                              {(__v.insp?.condVals || []).map((o, $index) => (<React.Fragment key={$index}>
                                <option value={o?.value}>{o?.label}</option>
                              </React.Fragment>))}
                            </Select>
                          </>) : null}
                          {(__v.insp?.condValInput) ? (<>
                            <input type={"number"} value={__v.insp?.condVal} onChange={__v.insp?.onCondVal} style={{ flex: "1", minWidth: "0", height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif" }} />
                          </>) : null}
                        </div>
                      </>) : null}
                    </div>
                  </>) : null}
                </div>
              </>) : null}
            </aside>
          </div>
        </>) : null}
        {/* ===== FORMS · Rubric & Scoring tab ===== */}
        {(__v.tabRubric) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 340px", minWidth: "0", display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* ===== FORMS · Scoring mode & pass threshold card ===== */}
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Scoring model</div>
                <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", background: "rgba(118,118,128,.12)", borderRadius: "10px", padding: "3px", gap: "3px" }}>
                    {(__v.modes || []).map((m, $index) => (<React.Fragment key={$index}>
                      <button onClick={m?.onClick} style={{ flex: "1", height: "32px", border: "0", borderRadius: "6px", cursor: "pointer", font: "500 13px Inter,sans-serif", background: m?.bg, color: m?.fg }}>{m?.label}</button>
                    </React.Fragment>))}
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>
                      <span>PASS THRESHOLD</span>
                      <span style={{ color: "#111827", fontSize: "13px" }}>{__v.pass}%</span>
                    </div>
                    <input type={"range"} min={"0"} max={"100"} step={"5"} value={__v.pass} onChange={__v.onPass} style={{ width: "100%", marginTop: "8px", accentColor: "#0d3b2a" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "8px" }}>
                    <div style={{ background: "#f5f6f8", borderRadius: "12px", padding: "10px" }}>
                      <div style={{ fontSize: "18px", fontWeight: "700" }}>{__v.maxPoints}</div>
                      <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Max auto points</div>
                    </div>
                    <div style={{ background: "#f5f6f8", borderRadius: "12px", padding: "10px" }}>
                      <div style={{ fontSize: "18px", fontWeight: "700" }}>{__v.passPoints}</div>
                      <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Pass mark (pts)</div>
                    </div>
                    <div style={{ background: "#f5f6f8", borderRadius: "12px", padding: "10px" }}>
                      <div style={{ fontSize: "18px", fontWeight: "700" }}>{__v.manualCount}</div>
                      <div style={{ fontSize: "11.5px", color: "#6b7280" }}>Manual review</div>
                    </div>
                  </div>
                </div>
              </div>
              {/* ===== FORMS · Evaluation tiers card ===== */}
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "16.5px", fontWeight: "600" }}>Evaluation tiers</span>
                  <button onClick={__v.addTier} style={{ display: "flex", alignItems: "center", gap: "5px", background: "none", border: "0", cursor: "pointer", font: "600 12.5px Inter,sans-serif", color: "#127a42" }}><i className={"icon-plus"} style={{ fontSize: "13px" }}></i>Add tier</button>
                </div>
                <div style={{ padding: "12px 18px 16px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {(__v.tiers || []).map((t, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                      <button onClick={t?.cycleColor} title={"Change colour"} style={{ width: "26px", height: "26px", borderRadius: "7px", border: "0", cursor: "pointer", flex: "none", background: t?.color }}></button>
                      <input value={t?.name} onChange={t?.onName} style={{ flex: "1", minWidth: "0", height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", padding: "0 8px", font: "500 13px Inter,sans-serif" }} />
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>≥</span>
                      <input type={"number"} min={"0"} max={"100"} value={t?.min} onChange={t?.onMin} style={{ width: "64px", height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "7px", padding: "0 6px", font: "400 13px Inter,sans-serif" }} />
                      <span style={{ fontSize: "12px", color: "#6b7280" }}>%</span>
                      <button onClick={t?.remove} style={{ background: "none", border: "0", cursor: "pointer", color: "#9ca3af", display: "flex", padding: "3px" }}>
                        <i className={"icon-x"} style={{ fontSize: "14px" }}></i>
                      </button>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
            </div>
            {/* ===== FORMS · Scoring matrix table ===== */}
            <div style={{ flex: "2 1 520px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Scoring matrix</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>Weights can be edited here or in the question settings</div>
              </div>
              <div style={{ overflowX: "auto" }}>
                <div style={{ minWidth: "640px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 120px 110px 80px 70px", gap: "12px", padding: "10px 18px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <span>#</span>
                    <span>QUESTION</span>
                    <span>TYPE</span>
                    <span>METHOD</span>
                    <span>WEIGHT</span>
                    <span>MAX</span>
                  </div>
                  {(__v.matrixRows || []).map((r, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "grid", gridTemplateColumns: "44px minmax(0,1fr) 120px 110px 80px 70px", gap: "12px", alignItems: "center", padding: "10px 18px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "13px" }}>
                      <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: "#6b7280" }}>Q{r?.num}</span>
                      <span style={{ minWidth: "0", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r?.text}</span>
                      <span style={{ color: "#374151" }}>{r?.type}</span>
                      <span style={{ justifySelf: "start", font: "600 10.5px Inter,sans-serif", borderRadius: "999px", padding: "2px 8px", background: r?.mBg, color: r?.mFg }}>{r?.method}</span>
                      <input type={"number"} min={"0"} max={"10"} step={"0.5"} value={r?.weight} onChange={r?.onWeight} style={{ width: "62px", height: "30px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "6px", padding: "0 6px", font: "400 12.5px Inter,sans-serif" }} />
                      <span style={{ font: "600 12.5px 'JetBrains Mono',monospace" }}>{r?.max}</span>
                    </div>
                  </React.Fragment>))}
                </div>
              </div>
            </div>
          </div>
        </>) : null}
        {/* ===== FORMS · Preview tab ===== */}
        {(__v.tabPreview) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "3 1 520px", minWidth: "0", display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* ===== FORMS · Preview banner ===== */}
              <div style={{ background: "#0d3b2a", color: "#fff", borderRadius: "12px", padding: "18px 20px" }}>
                <div style={{ font: "700 10px Inter,sans-serif", letterSpacing: ".6px", color: "#b9d8c6" }}>PREVIEW · WHAT STAFF WILL SEE</div>
                <div style={{ fontSize: "19px", fontWeight: "700", marginTop: "6px" }}>{__v.formName}</div>
              </div>
              {/* ===== FORMS · Preview questions ===== */}
              {(__v.pv || []).map((q, $index) => (<React.Fragment key={$index}>
                <div>
                  {(q?.isSection) ? (<>
                    <div style={{ padding: "8px 4px 0" }}>
                      <div style={{ fontSize: "16px", fontWeight: "700", color: "#0d3b2a" }}>{q?.text}</div>
                      {(q?.help) ? (<>
                        <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "3px" }}>{q?.help}</div>
                      </>) : null}
                    </div>
                  </>) : null}
                  {(q?.isQuestion) ? (<>
                    <div style={{ background: "#fff", border: `1.5px solid ${q?.border ?? ""}`, borderRadius: "12px", padding: "16px 18px" }}>
                      <div style={{ display: "flex", gap: "8px", alignItems: "baseline" }}>
                        <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: "#6b7280" }}>{q?.num}.</span>
                        <span style={{ font: "500 15px/1.45 Inter,sans-serif", color: "#111827" }}>{q?.text}{(q?.required) ? (<>
                            <span style={{ color: "#dc2626" }}> *</span>
                          </>) : null}</span>
                      </div>
                      {(q?.help) ? (<>
                        <div style={{ fontSize: "12.5px", color: "#6b7280", margin: "4px 0 0 22px" }}>{q?.help}</div>
                      </>) : null}
                      <div style={{ marginTop: "12px" }}>
                        {(q?.isLikert) ? (<LikertScale sc={q.scale} value={q.value} onPick={q.pick} />) : null}
                        {(q?.isChoice) ? (<>
                          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                            {(q?.opts || []).map((o, $index) => (<React.Fragment key={$index}>
                              <button onClick={o?.pick} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "10px 12px", borderRadius: "9px", cursor: "pointer", textAlign: "left", background: o?.bg, border: `1.5px solid ${o?.border ?? ""}` }}>
                                <span style={{ width: "18px", height: "18px", flex: "none", borderRadius: q?.radius, border: `2px solid ${o?.dot ?? ""}`, background: o?.dotFill }}></span>
                                <span style={{ font: "500 13.5px Inter,sans-serif", color: "#111827" }}>{o?.label}</span>
                              </button>
                            </React.Fragment>))}
                          </div>
                        </>) : null}
                        {(q?.isNumeric) ? (<>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", maxWidth: "300px" }}>
                            <input type={"number"} value={q?.value} onChange={q?.onInput} placeholder={q?.range} style={{ flex: "1", minWidth: "0", height: "40px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "9px", padding: "0 12px", font: "600 15px 'JetBrains Mono',monospace" }} />
                            <span style={{ fontSize: "13px", color: "#4b5563" }}>{q?.unit}</span>
                          </div>
                        </>) : null}
                        {(q?.isText) ? (<>
                          <textarea value={q?.value} onChange={q?.onInput} placeholder={"Type your answer…"} style={{ width: "100%", minHeight: "110px", border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "9px", padding: "10px 12px", font: "400 14px/1.55 Inter,sans-serif", resize: "vertical" }}></textarea>
                          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", textAlign: "right" }}>{q?.count}</div>
                        </>) : null}
                        {(q?.isMatrix) ? (<>
                          <div style={{ overflowX: "auto" }}>
                            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "420px", font: "400 13px Inter,sans-serif" }}>
                              <thead>
                                <tr>
                                  <th></th>
                                  {(q?.cols || []).map((c, $index) => (<React.Fragment key={$index}>
                                    <th style={{ padding: "6px", font: "600 11px Inter,sans-serif", color: "#6b7280", textAlign: "center" }}>{c}</th>
                                  </React.Fragment>))}
                                </tr>
                              </thead>
                              <tbody>
                                {(q?.rows || []).map((r, $index) => (<React.Fragment key={$index}>
                                  <tr>
                                    <td style={{ padding: "8px 8px 8px 0", borderTop: "1px solid rgba(15,35,65,.07)", color: "#111827" }}>{r?.label}</td>
                                    {(r?.cells || []).map((c, $index) => (<React.Fragment key={$index}>
                                      <td style={{ padding: "6px", borderTop: "1px solid rgba(15,35,65,.07)", textAlign: "center" }}>
                                        <button onClick={c?.pick} style={{ width: "22px", height: "22px", borderRadius: "50%", cursor: "pointer", border: `2px solid ${c?.border ?? ""}`, background: c?.fill }}></button>
                                      </td>
                                    </React.Fragment>))}
                                  </tr>
                                </React.Fragment>))}
                              </tbody>
                            </table>
                          </div>
                        </>) : null}
                        {(q?.isFile) ? (<>
                          <label style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", border: "1.5px dashed #c7ccd4", borderRadius: "9px", cursor: "pointer", background: "rgba(255,255,255,.4)" }}>
                            <i className={"icon-paperclip"} style={{ fontSize: "16px", color: "#0d3b2a" }}></i>
                            <span style={{ font: "500 13px Inter,sans-serif", color: "#111827" }}>{q?.fileText}</span>
                            <input type={"file"} accept={q?.accept} onChange={q?.onFile} style={{ display: "none" }} />
                          </label>
                        </>) : null}
                        {(q?.isSig) ? (<>
                          <div style={{ border: "1.5px solid rgba(15,35,65,.14)", borderRadius: "9px", overflow: "hidden", background: "#fff" }}>
                            <canvas ref={q?.sigRef} width={"640"} height={"160"} style={{ display: "block", width: "100%", height: "140px", touchAction: "none", cursor: "crosshair", background: "repeating-linear-gradient(0deg,#fff 0 139px,#e5e7eb 139px 140px)" }}></canvas>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px", fontSize: "12px", color: "#6b7280" }}>
                            <span>{q?.sigText}</span>
                            <button onClick={q?.clearSig} style={{ background: "none", border: "0", cursor: "pointer", color: "#127a42", font: "500 12px Inter,sans-serif" }}>Clear</button>
                          </div>
                        </>) : null}
                        {(q?.isGps) ? (<>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px" }}>
                            <button onClick={q?.captureGps} style={{ display: "flex", alignItems: "center", gap: "6px", height: "36px", padding: "0 14px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "999px", background: "#fff", cursor: "pointer", font: "500 13px Inter,sans-serif", color: "#0d3b2a" }}><i className={"icon-locate-fixed"} style={{ fontSize: "14px" }}></i>{q?.gpsBtn}</button>
                            <span style={{ font: "500 12.5px 'JetBrains Mono',monospace", color: "#374151" }}>{q?.gpsText}</span>
                          </div>
                        </>) : null}
                      </div>
                      {(q?.err) ? (<>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "8px", fontSize: "12.5px", color: "#b91c1c" }}><i className={"icon-circle-alert"} style={{ fontSize: "13px" }}></i>{q?.err}</div>
                      </>) : null}
                    </div>
                  </>) : null}
                </div>
              </React.Fragment>))}
              {/* ===== FORMS · Preview buttons (Reset / Submit) ===== */}
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "10px" }}>
                <button onClick={__v.resetPreview} style={{ height: "38px", padding: "0 16px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "999px", background: "#fff", color: "#374151", font: "500 13.5px Inter,sans-serif", cursor: "pointer" }}>Reset</button>
                <button onClick={__v.submitPreview} style={{ height: "38px", padding: "0 18px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer" }}>Submit test response</button>
              </div>
            </div>
            {/* ===== FORMS · Live result panel (score, tier, sections) ===== */}
            <aside style={{ flex: "1 1 280px", maxWidth: __v.inspMax, minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", position: __v.panePos, top: "80px" }}>
              <div style={{ padding: "16px 18px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "15px", fontWeight: "600" }}>Live score</div>
              <div style={{ padding: "16px 18px", display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                  <span style={{ fontSize: "34px", fontWeight: "700", letterSpacing: "-0.5px" }}>{__v.res?.pct}%</span>
                  <span style={{ fontSize: "13px", color: "#6b7280" }}>{__v.res?.earned} / {__v.res?.max} pts</span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                  <span style={{ font: "600 11.5px Inter,sans-serif", borderRadius: "999px", padding: "4px 10px", background: __v.res?.tierColor, color: "#fff" }}>{__v.res?.tier}</span>
                  <span style={{ font: "600 11.5px Inter,sans-serif", borderRadius: "999px", padding: "4px 10px", background: __v.res?.passBg, color: __v.res?.passFg }}>{__v.res?.passText}</span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {(__v.res?.sections || []).map((sc, $index) => (<React.Fragment key={$index}>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#374151" }}>
                        <span>{sc?.title}</span>
                        <span style={{ fontWeight: "600" }}>{sc?.pct}%</span>
                      </div>
                      <div style={{ height: "6px", borderRadius: "999px", background: "#eef0f3", marginTop: "5px", overflow: "hidden" }}>
                        <div style={{ height: "100%", background: "#0d3b2a", width: sc?.w }}></div>
                      </div>
                    </div>
                  </React.Fragment>))}
                </div>
                {(__v.res?.pending) ? (<>
                  <div style={{ fontSize: "12px", color: "#92400e", background: "#fffbeb", borderRadius: "10px", padding: "8px 10px" }}>{__v.res?.pending}</div>
                </>) : null}
                {(__v.submitMsg) ? (<>
                  <div style={{ fontSize: "12.5px", borderRadius: "10px", padding: "10px", background: __v.submitBg, color: __v.submitFg }}>{__v.submitMsg}</div>
                </>) : null}
              </div>
            </aside>
          </div>
        </>) : null}
        {/* ===== FORMS · Versions tab (history, duplicate, archive, restore) ===== */}
        {(__v.tabVersions) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "16px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Version history</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>Published versions are locked. Editing one starts a new draft.</div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={__v.duplicate} style={{ height: "34px", padding: "0 12px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Duplicate form</button>
                <button onClick={__v.archive} style={{ height: "34px", padding: "0 12px", border: "1px solid #fecaca", borderRadius: "10px", background: "#fff", color: "#b91c1c", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Archive</button>
              </div>
            </div>
            {/* ===== FORMS · Version row ===== */}
            {(__v.history || []).map((h, $index) => (<React.Fragment key={$index}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "14px 18px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <span style={{ font: "700 13px 'JetBrains Mono',monospace", width: "40px" }}>v{h?.v}</span>
                <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: h?.bg, color: h?.fg }}>{h?.status}</span>
                <div style={{ flex: "1 1 200px", minWidth: "0" }}>
                  <div style={{ fontSize: "13.5px", color: "#111827" }}>{h?.note}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "2px" }}>{h?.date}</div>
                </div>
                {(h?.canRestore) ? (<>
                  <button onClick={h?.restore} style={{ height: "32px", padding: "0 12px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#0d3b2a", font: "500 12.5px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}><i className={"icon-rotate-ccw"} style={{ fontSize: "13px" }}></i>Restore as draft</button>
                </>) : null}
              </div>
            </React.Fragment>))}
          </div>
        </>) : null}
        {/* ===== FORMS · Toast message ===== */}
        {(__v.toast) ? (<>
          <div style={{ position: "fixed", left: "50%", bottom: "28px", transform: "translateX(-50%)", zIndex: "80", background: "#111827", color: "#fff", font: "500 13px Inter,sans-serif", padding: "10px 16px", borderRadius: "12px", boxShadow: "0 10px 30px rgba(0,0,0,.25)", display: "flex", alignItems: "center", gap: "8px" }}><i className={"icon-circle-check"} style={{ fontSize: "15px", color: "#4ade80" }}></i>{__v.toast}</div>
        </>) : null}
      </div>
    </>
    );
  }
}


export default SMFormBuilder;
