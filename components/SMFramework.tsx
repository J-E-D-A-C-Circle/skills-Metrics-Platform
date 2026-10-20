'use client';
// =============================================================================
// SMFramework.jsx · Skill Framework: Competencies library and Target Profiles tabs (+ the Rating Scales cards used on Help & Guides)
// Screen / URL: /framework?tab=competencies (default), /framework?tab=targets (old /library, /targets redirect). Rating Scales moved to /help?tab=ratings.
// Who sees it: users with "View framework"; adding / removing competencies and editing target profiles are separate permissions
// Used by: components/SkillMatrixApp.jsx; SMSystem.jsx (RatingScales on Help & Guides)   Depends on: ./smUI, ./smModel (targetOf, resolveProfile, BANDS, TIERS), ./dvlaBanks (JOB_LEVELS), ./ui/select
// Sections (search for these markers): FRAMEWORK · Constants, FRAMEWORK · Page wrapper, FRAMEWORK · Competencies tab · State & helpers, FRAMEWORK · Competencies tab · Render, FRAMEWORK · Departments list, FRAMEWORK · Competency list, FRAMEWORK · Add a competency row, FRAMEWORK · Helper · Bank question count, FRAMEWORK · Target Profiles tab · State & helpers, FRAMEWORK · Target Profiles tab · Render, FRAMEWORK · Profiles table, FRAMEWORK · Required proficiency matrix, FRAMEWORK · Profile drawer, FRAMEWORK · Scale cards, HELP · Rating Scales cards (exported, shown on Help & Guides), HELP · Rating Scales · Scale cards
// =============================================================================
import React, { useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Field, Badge, ScopeBadge, EmptyState, DataTable, Toast, Drawer, ScopeSelect, INPUT, LABEL } from './smUI';
import { ALL, BANDS, TIERS, targetOf, resolveProfile, profileLabel } from './smModel';
import { JOB_LEVELS } from './dvlaBanks';
import { Select } from './ui/select';

// ===== FRAMEWORK · Constants =====
// Job levels used by the DVLA assessment tools and question banks.
const LEVELS = JOB_LEVELS.map((t, i) => [String(i), t]);
const LVL = JOB_LEVELS.map(title => ({ title }));
// Cell background per proficiency level 0-5 in the target matrix and category chips.
const CELL_BG = ['#fff', '#eef6fc', '#edf7ef', '#fdf8e1', '#fef1e1', '#fdeaea'];

// ===== FRAMEWORK · Page wrapper =====
// view comes from the URL tab: library = Competencies, targets = Target Profiles.
export default function SMFramework(props) {
  const { view = 'library' } = props;
  const [toast, setToast] = useState('');
  const flash = m => { setToast(m); clearTimeout(flash._t); flash._t = setTimeout(() => setToast(''), 2600); };
  return (
    <Page>
      {view === 'library' ? <Library {...props} flash={flash} /> : null}
      {view === 'targets' ? <Targets {...props} flash={flash} /> : null}
      <Toast text={toast} />
    </Page>
  );
}

// ===== FRAMEWORK · Competencies tab · State & helpers =====
// General skills have no dept (apply to everyone); technical skills belong to one department.
// Adding/removing competencies only changes this screen's state (not saved).
// can('framework.competencies') = may add / remove competencies; otherwise the library is read-only.
function Library({ data: D, flash, can = () => true }) {
  const mayEdit = can('framework.competencies');
  const CORE = 'General skills (all departments)';
  const [sel, setSel] = useState(CORE);
  const [extra, setExtra] = useState({});
  const [removed, setRemoved] = useState({});
  const [draft, setDraft] = useState({});
  const base = name => D.framework.filter(c => name === CORE ? !c.dept : c.dept === name);
  const list = name => [...base(name).filter(c => !removed[c.id]), ...(extra[name] || [])];
  const comps = list(sel);
  const groups = [...new Set(comps.map(c => c.group))];
  const depts = [CORE, ...D.depts.map(d => d.name)];
  // ===== FRAMEWORK · Competencies tab · Render =====
  return (
    <>
      <PageHeader title="Competency Library" description="Department → major skill → specific competency, as set out in the DVLA assessment tools. General skills apply to every department; technical ones belong to one." />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* ===== FRAMEWORK · Competencies · Departments list ===== */}
        <Card title="Departments" style={{ flex: '1 1 240px', maxWidth: '320px' }} bodyStyle={{ padding: '8px' }}>
          {depts.map(n => <button key={n} type="button" onClick={() => setSel(n)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', height: '40px', padding: '0 10px', border: '0', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', font: '500 13.5px Inter,sans-serif', background: n === sel ? '#e6f2ea' : 'transparent', color: n === sel ? '#0d3b2a' : '#374151' }}>{n}<span style={{ font: '600 11px Inter,sans-serif', color: '#6b7280' }}>{list(n).length}</span></button>)}
        </Card>
        {/* ===== FRAMEWORK · Competencies · Competency list (grouped by major skill) ===== */}
        <Card title={sel} sub={sel === CORE ? 'Assessed for every member of staff, in every department' : 'Technical competencies for this department, plus the ' + base(CORE).length + ' general skills'} style={{ flex: '3 1 520px' }} flush>
          {groups.length ? groups.map(g => (
            <div key={g} style={{ borderBottom: '1px solid rgba(15,35,65,.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 20px', background: 'rgba(255,255,255,.4)' }}>
                <i className="icon-folder-tree" style={{ fontSize: '15px', color: '#6b7280' }}></i>
                <span style={{ flex: '1', fontSize: '14px', fontWeight: '600' }}>{g}</span>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{comps.filter(c => c.group === g).length} competencies</span>
              </div>
              {comps.filter(c => c.group === g).map(c => (
                <div key={c.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '10px 20px 10px 46px', borderTop: '1px solid rgba(15,35,65,.07)' }}>
                  <span style={{ flex: '1 1 200px', fontSize: '13.5px' }}>{c.code ? <span style={{ fontFamily: "'JetBrains Mono',monospace", fontSize: '12px', color: '#6b7280', marginRight: '6px' }}>{c.code}</span> : null}{c.name}
                    {c.areas ? <span style={{ display: 'block', fontSize: '11.5px', color: '#6b7280', marginTop: '3px', lineHeight: 1.45 }}>Skill areas: {c.areas.join(' · ')}</span> : null}</span>
                  <Badge bg={D.IMP[c.importance].bg} fg={D.IMP[c.importance].fg} style={{ borderRadius: '6px' }}>Importance {c.importance} · {D.IMP[c.importance].short}</Badge>
                  <span style={{ fontSize: '11.5px', color: '#9ca3af', width: '150px' }}>{qCount(D, c.id)}</span>
                  {mayEdit ? <button type="button" title="Remove" onClick={() => { if (c.custom) setExtra({ ...extra, [sel]: extra[sel].filter(x => x.id !== c.id) }); else setRemoved({ ...removed, [c.id]: true }); flash('Competency removed from the library'); }} style={{ background: 'none', border: '0', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: '4px' }}><i className="icon-trash-2" style={{ fontSize: '14px' }}></i></button> : null}
                </div>))}
              {/* ===== FRAMEWORK · Competencies · Add a competency row ===== */}
              {mayEdit ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '10px 20px 14px 46px' }}>
                <input value={(draft[g] || {}).name || ''} onChange={e => setDraft({ ...draft, [g]: { ...(draft[g] || {}), name: e.target.value } })} placeholder="Add a competency" style={{ ...INPUT, flex: '1 1 200px', border: '1px dashed #c7ccd4' }} />
                <Sel value={(draft[g] || {}).imp || '3'} onChange={v => setDraft({ ...draft, [g]: { ...(draft[g] || {}), imp: v } })} options={[1, 2, 3, 4, 5].map(n => [String(n), n + ' · ' + D.IMP[n].short])} />
                <Btn icon="icon-plus" onClick={() => { const dr = draft[g] || {}; if (!(dr.name || '').trim()) return; const cat = comps.find(c => c.group === g).category;
                  setExtra({ ...extra, [sel]: [...(extra[sel] || []), { id: 'x' + Date.now(), name: dr.name.trim(), group: g, category: cat, importance: +(dr.imp || 3), custom: true }] }); setDraft({ ...draft, [g]: {} }); flash('Competency added'); }}>Add</Btn>
              </div> : null}
            </div>)) : <EmptyState icon="icon-network" title="No competencies yet" />}
        </Card>
      </div>
    </>
  );
}

// ===== FRAMEWORK · Helper · Bank question count =====
// How many questions the DVLA question banks hold for a competency, across the four job levels.
function qCount(D, id) {
  const per = (D.BANKS || []).map(b => b.items.filter(q => q[0] === id).length).filter(Boolean);
  return per.length ? per.reduce((a, b) => a + b, 0) + ' bank questions (' + per.length + ' levels)' : 'Rated on the proficiency scale';
}

// ===== FRAMEWORK · Target Profiles tab · State & helpers =====
// Profiles are saved by SkillMatrixApp (setProfiles -> localStorage "skm-target-profiles"). The department picker starts at the global scope.
// can('framework.profiles') = may create, edit, remove and apply target profiles; otherwise read-only.
function Targets({ data: D, model, profiles, setProfiles, scope, flash, can = () => true }) {
  const mayEdit = can('framework.profiles');
  const [local, setLocal] = useState(null);
  const dept = local ?? scope;
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState('');
  // The profile that applies at each job level in the chosen department.
  // A department override replaces the org-wide profile for that job level (resolveProfile in smModel).
  const columns = LVL.map((_, level) => {
    if (dept === ALL) { const p = profiles.find(x => x.level === level && x.scope === 'all'); return p ? { p, override: false } : null; }
    const r = resolveProfile(profiles, { level, dept }); return r.p ? r : null;
  }).filter(Boolean);
  const comps = D.framework.filter(c => dept === ALL || !c.dept || c.dept === dept);
  const listed = dept === ALL ? profiles : profiles.filter(p => p.scope === 'all' || p.scope.includes(dept));
  const staffOn = p => model.staff.filter(s => s.profile && s.profile.id === p.id && (dept === ALL || s.dept === dept)).length;
  const save = list => setProfiles(list);
  const setCell = (p, c, v) => save(profiles.map(x => x.id === p.id ? { ...x, comps: { ...x.comps, [c.id]: +v } } : x));
  // Apply to all: turns an override into the org-wide profile for its level, replacing any existing one.
  const applyAll = p => {
    const replaced = profiles.find(x => x.level === p.level && x.scope === 'all');
    save(profiles.filter(x => x !== replaced).map(x => x.id === p.id ? { ...x, scope: 'all' } : x));
    flash(profileLabel(p) + ' now applies to all departments' + (replaced ? ' (replaced the previous org-wide profile)' : ''));
  };
  const openNew = () => { setErr(''); setEdit({ id: null, level: '0', track: 'Technical', scope: dept === ALL ? 'all' : [dept], targets: { Technical: 3, General: 3 }, comps: {} }); };
  const openEdit = p => { setErr(''); setEdit({ ...p, level: String(p.level), scope: p.scope === 'all' ? 'all' : [...p.scope] }); };
  // Save rules: only one org-wide profile per job level, and at most one override per level per department.
  const submit = () => {
    const lv = +edit.level, sc = edit.scope;
    if (sc !== 'all' && !sc.length) { setErr('Choose at least one department, or set the scope to All departments.'); return; }
    if (sc === 'all' && profiles.some(x => x.id !== edit.id && x.level === lv && x.scope === 'all')) { setErr('An org-wide profile for ' + LVL[lv].title + ' already exists. Edit that one, or scope this profile to specific departments.'); return; }
    const clash = sc !== 'all' && profiles.find(x => x.id !== edit.id && x.level === lv && Array.isArray(x.scope) && x.scope.some(d => sc.includes(d)));
    if (clash) { setErr(clash.scope.filter(d => sc.includes(d)).join(', ') + ' already has an override for ' + LVL[lv].title + '.'); return; }
    const p = { id: edit.id || 'p' + Date.now(), title: LVL[lv].title, track: edit.track, level: lv, scope: sc, targets: edit.targets, comps: edit.comps || {} };
    save(edit.id ? profiles.map(x => x.id === edit.id ? p : x) : [...profiles, p]);
    setEdit(null); flash(edit.id ? 'Target profile saved. Gaps recalculated.' : 'Target profile created');
  };
  // ===== FRAMEWORK · Target Profiles tab · Render =====
  return (
    <>
      {/* ===== FRAMEWORK · Target Profiles · Page header, New profile, department filter ===== */}
      <PageHeader title="Target Profiles" description="The proficiency each job level requires. Org-wide profiles apply everywhere; a department override replaces them for that department."
        actions={mayEdit ? <Btn kind="primary" icon="icon-plus" onClick={openNew}>New profile</Btn> : null}
        filters={<><ScopeSelect depts={D.depts} value={dept} globalValue={scope} onChange={setLocal} /><span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>Changes recalculate every gap, dashboard and training need straight away</span></>} />
      {/* ===== FRAMEWORK · Target Profiles · Profiles table ===== */}
      <Card title={dept === ALL ? 'All target profiles' : 'Profiles that apply in ' + dept} sub="Mapped by job level and career track" flush>
        <DataTable minWidth={860} rows={listed} rowKey={p => p.id} empty={<EmptyState icon="icon-crosshair" title="No profiles" action={mayEdit ? <Btn onClick={openNew}>New profile</Btn> : null} />} columns={[
          { key: 'title', label: 'Job level · track', render: p => <div><div style={{ fontWeight: 600 }}>{p.title}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{p.track} track</div></div> },
          { key: 'scope', label: 'Scope', render: p => { const over = p.scope !== 'all'; const shadowed = dept !== ALL && !over && profiles.some(x => x.level === p.level && Array.isArray(x.scope) && x.scope.includes(dept));
            return <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}><ScopeBadge override={over} />{over ? <span style={{ fontSize: '11.5px', color: '#6b7280' }}>{p.scope.join(', ')}</span> : null}{shadowed ? <span style={{ fontSize: '11.5px', color: '#b45309' }}>Overridden in {dept}</span> : null}</div>; } },
          { key: 'targets', label: 'Category targets', render: p => <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>{D.categories.map(c => <span key={c} title={c} style={{ fontSize: '11px', background: CELL_BG[p.targets[c]], border: '1px solid rgba(15,35,65,.08)', borderRadius: '6px', padding: '2px 6px' }}>{c.split(' ')[0]} <b>{p.targets[c]}</b></span>)}</div> },
          { key: 'staff', label: 'Staff', align: 'center', render: p => <b>{staffOn(p)}</b> },
          { key: 'a', label: '', align: 'right', render: p => <span style={{ display: 'inline-flex', gap: '6px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {!mayEdit ? null : <>{p.scope !== 'all' ? <Btn small icon="icon-globe" onClick={() => applyAll(p)} title="Make this profile apply to every department">Apply to all departments</Btn> : null}
            <Btn small icon="icon-pencil" onClick={() => openEdit(p)}>Edit</Btn>
            {p.scope !== 'all' ? <Btn small kind="danger" onClick={() => { save(profiles.filter(x => x.id !== p.id)); flash('Override removed. The org-wide profile applies again.'); }}>Remove</Btn> : null}</>}</span> },
        ]} />
      </Card>
      {/* ===== FRAMEWORK · Target Profiles · Required proficiency matrix (cell falls back to the category target unless set) ===== */}
      <Card title={'Required proficiency · ' + (dept === ALL ? 'org-wide profiles' : dept)} sub={dept === ALL ? 'Editing here changes the org-wide profile for every department without an override' : 'Each column is the profile that applies in ' + dept + '. Faded values come from the category target.'} flush>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', minWidth: '760px', width: '100%', font: '400 13px Inter,sans-serif' }}>
            <thead><tr>
              <th style={{ textAlign: 'left', padding: '10px 16px', font: '600 10px Inter,sans-serif', letterSpacing: '.5px', color: '#6b7280', borderBottom: '1px solid rgba(15,35,65,.07)', position: 'sticky', left: '0', background: '#fff' }}>COMPETENCY</th>
              {columns.map(({ p, override }) => <th key={p.id} style={{ padding: '10px 8px', borderBottom: '1px solid rgba(15,35,65,.07)', textAlign: 'center', verticalAlign: 'bottom' }}><div style={{ font: '600 11px Inter,sans-serif', color: '#111827', whiteSpace: 'nowrap' }}>{p.title}</div><div style={{ marginTop: '4px' }}><ScopeBadge override={override} /></div></th>)}
            </tr></thead>
            <tbody>{comps.map(c => (
              <tr key={c.id}>
                <td style={{ padding: '8px 16px', borderBottom: '1px solid rgba(15,35,65,.07)', position: 'sticky', left: '0', background: '#fff' }}><div style={{ fontWeight: '500' }}>{c.name}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{c.category}{c.dept ? ' · ' + c.dept : ''}</div></td>
                {columns.map(({ p }) => { const v = targetOf(p, c), own = p.comps && p.comps[c.id] != null; return (
                  <td key={p.id} style={{ padding: '6px 8px', borderBottom: '1px solid rgba(15,35,65,.07)', textAlign: 'center' }}>
                    <Select value={String(v)} onChange={e => setCell(p, c, e.target.value)} title={own ? 'Set for this competency' : 'From the ' + c.category + ' category target'} style={{ width: '64px', height: '32px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', textAlign: 'center', font: "600 13px 'JetBrains Mono',monospace", background: CELL_BG[v], color: own ? '#111827' : '#9ca3af' }}>{[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}</Select>
                  </td>); })}
              </tr>))}</tbody>
          </table>
        </div>
      </Card>
      {/* ===== FRAMEWORK · Target Profiles · New / Edit profile drawer ===== */}
      <Drawer open={!!edit} title={edit && edit.id ? 'Edit target profile' : 'New target profile'} sub="Job level, track and the departments it applies to" onClose={() => setEdit(null)} width={560}
        footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={() => setEdit(null)}>Cancel</Btn><Btn kind="primary" onClick={submit}>{edit && edit.id ? 'Save profile' : 'Create profile'}</Btn></div>}>
        {edit ? <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* ===== FRAMEWORK · Profile drawer · Job level and career track ===== */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label="JOB LEVEL"><Sel value={edit.level} onChange={v => setEdit({ ...edit, level: v })} options={LEVELS} /></Field>
            <Field label="CAREER TRACK"><Sel value={edit.track} onChange={v => setEdit({ ...edit, track: v })} options={['Technical', 'Management']} /></Field>
          </div>
          {/* ===== FRAMEWORK · Profile drawer · Scope (all or specific departments) ===== */}
          <div style={LABEL}>SCOPE
            <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
              {[['all', 'All departments', 'Org-wide default'], ['some', 'Specific departments', 'Overrides the org-wide profile there']].map(([k, l, d]) => { const on = (edit.scope === 'all') === (k === 'all'); return (
                <button key={k} type="button" onClick={() => setEdit({ ...edit, scope: k === 'all' ? 'all' : (Array.isArray(edit.scope) ? edit.scope : []) })} style={{ flex: '1', textAlign: 'left', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', border: '1.5px solid ' + (on ? '#0d3b2a' : '#e5e7eb'), background: on ? '#f1f8f3' : '#fff' }}>
                  <div style={{ font: '600 13px Inter,sans-serif', color: '#111827', letterSpacing: 0 }}>{l}</div><div style={{ font: '400 11.5px Inter,sans-serif', color: '#6b7280', letterSpacing: 0, marginTop: '2px' }}>{d}</div></button>); })}
            </div>
          </div>
          {edit.scope !== 'all' ? <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
            {D.depts.map(d => { const on = edit.scope.includes(d.name); return <label key={d.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '10px', border: '1px solid ' + (on ? '#0d3b2a' : 'rgba(15,35,65,.1)'), background: on ? '#f1f8f3' : '#fff', cursor: 'pointer', fontSize: '13px' }}>
              <input type="checkbox" checked={on} onChange={() => setEdit({ ...edit, scope: on ? edit.scope.filter(x => x !== d.name) : [...edit.scope, d.name] })} style={{ accentColor: '#0d3b2a' }} />{d.name}</label>; })}
          </div> : null}
          {/* ===== FRAMEWORK · Profile drawer · Category targets and error message ===== */}
          <div style={LABEL}>CATEGORY TARGETS (1–5)
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '8px', marginTop: '4px' }}>
              {D.categories.map(c => <label key={c} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', font: '500 13px Inter,sans-serif', color: '#374151', letterSpacing: 0 }}>{c}
                <Sel value={String(edit.targets[c])} onChange={v => setEdit({ ...edit, targets: { ...edit.targets, [c]: +v } })} options={[1, 2, 3, 4, 5].map(n => [String(n), n + ' · ' + D.PROF[n].label])} style={{ width: '130px' }} /></label>)}
            </div>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.5 }}>Competency-level targets can be fine-tuned in the matrix after saving.</div>
          {err ? <div style={{ padding: '9px 12px', borderRadius: '10px', background: '#fef2f2', color: '#991b1b', fontSize: '12.5px' }}>{err}</div> : null}
        </div> : null}
      </Drawer>
    </>
  );
}

// ===== HELP · Rating Scales cards (exported, shown on Help & Guides) =====
// Read-only reference: proficiency (PROF), importance (IMP), gap (GAP) and the DVLA scoring bands.
// Moved out of the Skill Framework (15 Oct 2026); SMSystem.jsx shows it on the Help & Guides "Rating Scales" tab (/help?tab=ratings).
export function RatingScales({ data: d }) {
  const scales = [
    { title: 'Skill Proficiency', sub: 'Used for self-assessment and manager review. Also the Form Builder’s default Likert preset.', rows: d.PROF.slice(1).map(p => ({ n: p.n, label: p.label, desc: p.desc, bg: ['', '#e6f2ea', '#e3e9f0', '#c9d5e3', '#3a5a80', '#0d3b2a'][p.n], fg: p.n >= 4 ? '#fff' : '#0d3b2a' })) },
    { title: 'Skill Importance Levels', sub: 'How critical a competency is to the role', rows: d.IMP.slice(1).map(p => ({ n: p.n, label: p.label, desc: p.desc, bg: p.bg, fg: p.fg })) },
    { title: 'Gaps Description', sub: 'Gap = max(0, target level − actual level)', rows: d.GAP.map(p => ({ n: p.n, label: /Gap$/.test(p.label) ? p.label : p.label + ' Gap', desc: p.desc, bg: p.bg, fg: p.fg })) },
    { title: 'Scoring Interpretation', sub: 'From the DVLA competency assessment tools. Scores are the share of questions answered correctly.', rows: BANDS.map((b, i) => ({ n: i ? b.min + '–' + (BANDS[i - 1].min - 1) + '%' : b.min + '–100%', label: b.name, bg: b.bg, fg: b.fg,
      desc: 'Maps to proficiency level ' + TIERS.filter(t => t.min >= b.min && (!i || t.min < BANDS[i - 1].min)).map(t => t.level + ' (' + t.name + (t.min !== b.min ? ', ' + t.min + '%+' : '') + ')').join(' or ') + '.' })) }];
  return (
    <>
      {/* ===== HELP · Rating Scales · Scale cards ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: '20px', alignItems: 'start' }}>
        {scales.map(sc => (
          <Card key={sc.title} title={sc.title} sub={sc.sub} flush style={{ overflow: 'hidden' }}>
            {sc.rows.map(r => (
              <div key={r.n} style={{ display: 'flex', gap: '14px', alignItems: 'stretch', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
                <div style={{ flex: 'none', width: '150px', padding: '12px 14px', background: r.bg, color: r.fg, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><span style={{ font: '700 16px Inter,sans-serif' }}>{r.n}</span><span style={{ font: '600 12px Inter,sans-serif' }}>{r.label}</span></div>
                <div style={{ flex: '1', padding: '12px 16px 12px 0', fontSize: '13px', lineHeight: '1.5', color: '#374151', display: 'flex', alignItems: 'center' }}>{r.desc}</div>
              </div>))}
          </Card>))}
      </div>
    </>
  );
}
