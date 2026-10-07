'use client';
import React from 'react';
import __css from './SMFramework.module.css';


const TYPES = { likert: ['Likert scale', 'icon-gauge'], single: ['Single choice', 'icon-circle-dot'], multi: ['Multiple choice', 'icon-list-checks'], numeric: ['Numeric', 'icon-hash'], text: ['Open text', 'icon-text'], matrix: ['Matrix / rubric', 'icon-grid-3x3'], file: ['File upload', 'icon-paperclip'], signature: ['Signature', 'icon-signature'], gps: ['GPS location', 'icon-map-pin'] };
const OTHER = {
  'Human Resources': [{ name: 'Talent Acquisition & Selection', items: [['Job Analysis and Role Profiling', 4], ['Structured Interviewing', 4], ['Onboarding', 3]] }, { name: 'Learning & Development', items: [['Training Needs Analysis', 5], ['Programme Evaluation', 3]] }],
  'Finance': [{ name: 'Financial Reporting', items: [['IPSAS Reporting', 5], ['Budget Preparation', 4]] }, { name: 'Revenue Management', items: [['Revenue Reconciliation', 5]] }],
  'Licensing Operations': [{ name: 'Driver Testing', items: [['Practical Test Administration', 5], ['Theory Test Invigilation', 4]] }, { name: 'Customer Service', items: [['Front Desk Service', 4], ['Complaint Handling', 3]] }],
  'Vehicle Registration': [{ name: 'Registration Processing', items: [['Document Verification', 5], ['Roadworthiness Inspection', 5]] }],
  'Internal Audit': [{ name: 'Audit Practice', items: [['Risk-based Auditing', 5], ['Audit Reporting', 4]] }],
};
class SMFramework extends React.Component {
  state = { toast: '', libDept: 'IT Department', lib: null, drafts: {}, imps: {}, newMajor: '',
    targets: null, tDirty: false, sel: 0, drag: null,
    templates: [
      { name: 'Q4 2026 IT Skills Assessment', status: 'Published', version: 3, cfg: { date: '', start: '09:00', end: '17:00', duration: 45, tabLimit: 3, pass: 60, random: true, copy: true, auto: true, offline: true, one: true }, qs: null },
      { name: 'Q4 2026 HR Skills Assessment', status: 'Draft', version: 2, cfg: { date: '', start: '09:00', end: '15:00', duration: 40, tabLimit: 3, pass: 60, random: true, copy: true, auto: true, offline: false, one: true }, qs: [
        { type: 'likert', text: 'Rate your proficiency in Job Analysis and Role Profiling', weight: 2, req: true }, { type: 'single', text: 'Which interview format gives the most reliable comparisons between candidates?', weight: 1, req: true }, { type: 'text', text: 'Describe how you would onboard a new licensing officer.', weight: 2, req: true }] },
      { name: 'Q2 2026 IT Skills Assessment', status: 'Archived', version: 2, cfg: { date: '2026-06-02', start: '09:00', end: '17:00', duration: 45, tabLimit: 3, pass: 60, random: true, copy: true, auto: true, offline: true, one: true }, qs: [] }] };
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2400); }
  lib() { const d = this.props.data; return this.state.lib || { 'IT Department': d.SKILLS.map(m => ({ name: m.name, items: m.items.map(i => [i[0], i[2]]) })), ...OTHER, 'Customer Service': [{ name: 'Service Delivery', items: [['Call Handling', 4]] }] }; }
  setTpl(fn) { const t = this.state.templates.map((x, i) => i === this.state.sel ? fn(x) : x); this.setState({ templates: t }); }
  renderVals() {
    const d = this.props.data, s = this.state, vw = this.props.vw || 1440;
    if (!d) return {};
    const rawView = this.props.view;
    const view = (rawView === 'framework' ? 'library' : rawView) || 'library';
    const lib = this.lib(), tree = lib[s.libDept] || [];
    const saveLib = (dept, majors) => this.setState({ lib: { ...lib, [dept]: majors } });
    const roles = ['IT Officer G4', 'Senior IT Officer G5', 'Network Engineer', 'Database Admin', 'Security Analyst'];
    const targets = s.targets || d.comps.map(c => roles.map((r, ri) => Math.max(1, Math.min(5, c.target + (ri === 1 ? 1 : 0) + (ri === 2 && c.major === 'Systems & Infrastructure' ? 1 : 0) + (ri === 3 && c.major === 'Software & Data' ? 1 : 0) + (ri === 4 && c.major === 'Cybersecurity' ? 1 : 0) - (ri >= 2 && c.major === 'IT Service Management' ? 1 : 0)))));
    const C = d.cycle, iso = C.day.getFullYear() + '-' + String(C.day.getMonth() + 1).padStart(2, '0') + '-' + String(C.day.getDate()).padStart(2, '0');
    const tpl = s.templates[s.sel];
    const qsBase = tpl.qs || [...d.comps.map(c => ({ type: 'likert', text: 'Rate your proficiency in ' + c.name, weight: c.importance >= 4 ? 2 : 1, req: true })),
      { type: 'single', text: "A user can't reach internal systems but the internet works. What do you check first?", weight: 1, req: true }, { type: 'single', text: 'First action on a suspected ransomware infection?', weight: 1, req: true },
      { type: 'single', text: 'Which backup approach meets a 1-hour RPO?', weight: 1, req: true }, { type: 'multi', text: 'Good controls for privileged accounts', weight: 1, req: true },
      { type: 'numeric', text: 'Allowed downtime for a 99.9% monthly SLA (minutes)', weight: 1, req: true }, { type: 'text', text: 'Describe a recent change you implemented and how you managed risk.', weight: 2, req: true }];
    const cfg = { ...tpl.cfg, date: tpl.cfg.date || iso };
    const setQs = qs => this.setTpl(x => ({ ...x, qs }));
    const setCfg = (k, v) => this.setTpl(x => ({ ...x, cfg: { ...x.cfg, [k]: v } }));
    const SC = { Published: ['#dcfce7', '#15803d'], Draft: ['#fef3c7', '#92400e'], Archived: ['#f3f4f6', '#4b5563'] };
    return {
      title: { library: 'Competency Library', targets: 'Target Profiles', scales: 'Rating Scales', builder: 'Assessment Scheduling' }[view],
      subtitle: { library: 'A three-level hierarchy: department, major skill and specific competency', targets: 'The proficiency level each job title requires for every competency', scales: 'The proficiency, importance and gap scales used across the platform', builder: 'Design timed, one-day assessments with versioning and integrity controls' }[view],
      isLibrary: view === 'library', isTargets: view === 'targets', isScales: view === 'scales', isBuilder: view === 'builder', sideMax: vw >= 1000 ? '300px' : 'none',
      deptList: Object.keys(lib).map(n => ({ name: n, count: lib[n].reduce((a, m) => a + m.items.length, 0), bg: n === s.libDept ? '#e6f2ea' : 'transparent', fg: n === s.libDept ? '#0d3b2a' : '#374151', pick: () => this.setState({ libDept: n }) })),
      libDept: s.libDept, newMajor: s.newMajor, onNewMajor: e => this.setState({ newMajor: e.target.value }),
      addMajor: () => { if (!s.newMajor.trim()) return; saveLib(s.libDept, [...tree, { name: s.newMajor.trim(), items: [] }]); this.setState({ newMajor: '' }); this.flash('Major skill added'); },
      tree: tree.map((m, mi) => { const key = s.libDept + mi;
        return { name: m.name, count: m.items.length, draft: s.drafts[key] || '', imp: s.imps[key] || '3',
          onDraft: e => this.setState({ drafts: { ...this.state.drafts, [key]: e.target.value } }), onImp: e => this.setState({ imps: { ...this.state.imps, [key]: e.target.value } }),
          add: () => { const v = (s.drafts[key] || '').trim(); if (!v) return; saveLib(s.libDept, tree.map((x, i) => i === mi ? { ...x, items: [...x.items, [v, +(s.imps[key] || 3)]] } : x)); this.setState({ drafts: { ...this.state.drafts, [key]: '' } }); this.flash('Competency added'); },
          items: m.items.map(([name, imp], ci) => ({ name, importance: imp, impShort: d.IMP[imp].short, impBg: d.IMP[imp].bg, impFg: d.IMP[imp].fg,
            remove: () => saveLib(s.libDept, tree.map((x, i) => i === mi ? { ...x, items: x.items.filter((_, j) => j !== ci) } : x)) })) }; }),
      roles, tSaveBg: s.tDirty ? '#15904c' : '#a3acb9', tSaveText: s.tDirty ? 'Save changes' : 'Saved',
      saveTargets: () => { if (!s.tDirty) return; this.setState({ tDirty: false }); this.flash('Target profiles saved. Gaps will be recalculated.'); },
      targetRows: d.comps.map((c, ci) => ({ name: c.name, major: c.major, cells: targets[ci].map((v, ri) => ({ v: String(v), bg: ['#fff', '#eef6fc', '#edf7ef', '#fdf8e1', '#fef1e1', '#fdeaea'][v],
        onChange: e => { const t = targets.map(r => [...r]); t[ci][ri] = +e.target.value; this.setState({ targets: t, tDirty: true }); } })) })),
      scales: [
        { title: 'Skill Proficiency', sub: 'Used for self, manager and 360° ratings', rows: d.PROF.slice(1).map(p => ({ n: p.n, label: p.label, desc: p.desc, bg: ['', '#e6f2ea', '#e3e9f0', '#c9d5e3', '#3a5a80', '#0d3b2a'][p.n], fg: p.n >= 4 ? '#fff' : '#0d3b2a' })) },
        { title: 'Skill Importance Levels', sub: 'How critical a competency is to the role', rows: d.IMP.slice(1).map(p => ({ n: p.n, label: p.label, desc: p.desc, bg: p.bg, fg: p.fg })) },
        { title: 'Gaps Description', sub: 'Gap = target level − actual level', rows: d.GAP.map(p => ({ n: p.n, label: p.label + ' Gap', desc: p.desc, bg: p.bg, fg: p.fg })) }],
      templates: s.templates.map((t, i) => ({ name: t.name, status: t.status, version: t.version, qCount: (t.qs || qsBase).length, sBg: SC[t.status][0], sFg: SC[t.status][1], bg: i === s.sel ? '#e6f2ea' : 'transparent', pick: () => this.setState({ sel: i }) })),
      newTemplate: () => this.setState({ templates: [...s.templates, { name: 'Untitled assessment', status: 'Draft', version: 1, cfg: { date: '', start: '09:00', end: '17:00', duration: 45, tabLimit: 3, pass: 60, random: true, copy: true, auto: true, offline: true, one: true }, qs: [] }], sel: s.templates.length }),
      tName: tpl.name, onTName: e => this.setTpl(x => ({ ...x, name: e.target.value })), nextVersion: tpl.status === 'Draft' ? tpl.version : tpl.version + 1,
      archive: () => { this.setTpl(x => ({ ...x, status: 'Archived' })); this.flash('Archived'); },
      saveDraft: () => { this.setTpl(x => ({ ...x, status: 'Draft', qs: qsBase })); this.flash('Draft saved'); },
      publish: () => { if (!qsBase.length) { this.flash('Add at least one question before publishing'); return; } this.setTpl(x => ({ ...x, status: 'Published', version: x.status === 'Draft' ? x.version : x.version + 1, qs: qsBase })); this.flash('Published. Staff will be notified of the assessment day.'); },
      cfg, on: Object.fromEntries(['date', 'start', 'end', 'duration', 'tabLimit', 'pass'].map(k => [k, e => setCfg(k, ['duration', 'tabLimit', 'pass'].includes(k) ? +e.target.value : e.target.value)])),
      toggles: [['random', 'Randomise question order'], ['copy', 'Block copy, paste & right-click'], ['auto', 'Auto-submit when time or window ends'], ['offline', 'Allow offline (encrypted cache)'], ['one', 'Single attempt only']].map(([k, label]) => ({ label, justify: cfg[k] ? 'flex-end' : 'flex-start', bg: cfg[k] ? '#0d3b2a' : '#d1d5db', toggle: () => setCfg(k, !cfg[k]) })),
      totalWeight: qsBase.reduce((a, q) => a + (+q.weight || 0), 0),
      qs: qsBase.map((q, i) => ({ num: i + 1, type: TYPES[q.type][0], icon: TYPES[q.type][1], text: q.text, weight: q.weight, bg: s.drag === i ? '#f1f8f3' : '#fff',
        reqText: q.req ? 'Required' : 'Optional', reqBg: q.req ? '#fef2f2' : '#f3f4f6', reqFg: q.req ? '#991b1b' : '#4b5563',
        onText: e => setQs(qsBase.map((x, j) => j === i ? { ...x, text: e.target.value } : x)), onWeight: e => setQs(qsBase.map((x, j) => j === i ? { ...x, weight: +e.target.value } : x)),
        toggleReq: () => setQs(qsBase.map((x, j) => j === i ? { ...x, req: !x.req } : x)), remove: () => setQs(qsBase.filter((_, j) => j !== i)),
        onDragStart: e => { this.setState({ drag: i }); try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', String(i)); } catch (er) {} },
        onDragOver: e => e.preventDefault(),
        onDrop: e => { e.preventDefault(); const from = this.state.drag; if (from === null || from === i) { this.setState({ drag: null }); return; } const a = [...qsBase]; const [m] = a.splice(from, 1); a.splice(i, 0, m); setQs(a); this.setState({ drag: null }); } })),
      palette: Object.entries(TYPES).map(([k, [label, icon]]) => ({ label, icon, add: () => setQs([...qsBase, { type: k, text: 'New ' + label.toLowerCase() + ' question', weight: 1, req: true }]) })),
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
        {(__v.isLibrary) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 240px", maxWidth: __v.sideMax, background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "8px" }}>
              <div style={{ padding: "10px 10px 8px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280" }}>DEPARTMENTS</div>
              {(__v.deptList || []).map((dp, $index) => (<React.Fragment key={$index}>
                <button onClick={dp?.pick} style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", height: "40px", padding: "0 10px", border: "0", borderRadius: "10px", cursor: "pointer", textAlign: "left", font: "500 13.5px Inter,sans-serif", background: dp?.bg, color: dp?.fg }}>{dp?.name}<span style={{ font: "600 11px Inter,sans-serif", color: "#6b7280" }}>{dp?.count}</span></button>
              </React.Fragment>))}
            </div>
            <div style={{ flex: "3 1 520px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div>
                  <div style={{ fontSize: "16.5px", fontWeight: "600" }}>{__v.libDept}</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>Department <i className={"icon-arrow-right"} style={{ fontSize: "11px" }}></i> Major Skill <i className={"icon-arrow-right"} style={{ fontSize: "11px" }}></i> Specific Competency</div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input value={__v.newMajor} onChange={__v.onNewMajor} placeholder={"New major skill"} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13px Inter,sans-serif", minWidth: "0", width: "180px" }} />
                  <button onClick={__v.addMajor} style={{ height: "34px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer", whiteSpace: "nowrap" }}>Add</button>
                </div>
              </div>
              {(__v.tree || []).map((m, $index) => (<React.Fragment key={$index}>
                <div style={{ borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", background: "rgba(255,255,255,.4)" }}>
                    <i className={"icon-folder-tree"} style={{ fontSize: "15px", color: "#6b7280" }}></i>
                    <span style={{ flex: "1", fontSize: "14px", fontWeight: "600" }}>{m?.name}</span>
                    <span style={{ fontSize: "12px", color: "#6b7280" }}>{m?.count} competencies</span>
                  </div>
                  {(m?.items || []).map((c, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", padding: "10px 20px 10px 46px", borderTop: "1px solid rgba(15,35,65,.07)" }}>
                      <span style={{ flex: "1 1 200px", fontSize: "13.5px" }}>{c?.name}</span>
                      <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "6px", padding: "3px 8px", background: c?.impBg, color: c?.impFg, whiteSpace: "nowrap" }}>Importance {c?.importance} · {c?.impShort}</span>
                      <button onClick={c?.remove} style={{ background: "none", border: "0", cursor: "pointer", color: "#9ca3af", display: "flex", padding: "4px" }}>
                        <i className={"icon-trash-2"} style={{ fontSize: "14px" }}></i>
                      </button>
                    </div>
                  </React.Fragment>))}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", padding: "10px 20px 14px 46px" }}>
                    <input value={m?.draft} onChange={m?.onDraft} placeholder={"Add a competency"} style={{ flex: "1 1 200px", height: "34px", border: "1px dashed #c7ccd4", borderRadius: "10px", padding: "0 10px", font: "400 13px Inter,sans-serif", minWidth: "0" }} />
                    <select value={m?.imp} onChange={m?.onImp} style={{ height: "34px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                      <option value={"1"}>1 · Not important</option>
                      <option value={"2"}>2 · Minor</option>
                      <option value={"3"}>3 · Moderate</option>
                      <option value={"4"}>4 · Very important</option>
                      <option value={"5"}>5 · Critical</option>
                    </select>
                    <button onClick={m?.add} style={{ height: "34px", padding: "0 12px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#0d3b2a", font: "600 13px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}><i className={"icon-plus"} style={{ fontSize: "13px" }}></i>Add</button>
                  </div>
                </div>
              </React.Fragment>))}
            </div>
          </div>
        </>) : null}
        {(__v.isTargets) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>IT Department · required proficiency by job title</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>Gaps are calculated as target − actual for staff in each role</div>
              </div>
              <button onClick={__v.saveTargets} style={{ height: "34px", padding: "0 16px", border: "0", borderRadius: "999px", background: __v.tSaveBg, color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>{__v.tSaveText}</button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", minWidth: "760px", width: "100%", font: "400 13px Inter,sans-serif" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: "10px 16px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)", position: "sticky", left: "0", background: "#fff" }}>COMPETENCY</th>
                    {(__v.roles || []).map((r, $index) => (<React.Fragment key={$index}>
                      <th style={{ padding: "10px 8px", font: "600 10px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)", textAlign: "center", whiteSpace: "nowrap" }}>{r}</th>
                    </React.Fragment>))}
                  </tr>
                </thead>
                <tbody>
                  {(__v.targetRows || []).map((row, $index) => (<React.Fragment key={$index}>
                    <tr>
                      <td style={{ padding: "8px 16px", borderBottom: "1px solid rgba(15,35,65,.07)", position: "sticky", left: "0", background: "#fff" }}>
                        <div style={{ fontWeight: "500" }}>{row?.name}</div>
                        <div style={{ fontSize: "11.5px", color: "#6b7280" }}>{row?.major}</div>
                      </td>
                      {(row?.cells || []).map((cell, $index) => (<React.Fragment key={$index}>
                        <td style={{ padding: "6px 8px", borderBottom: "1px solid rgba(15,35,65,.07)", textAlign: "center" }}>
                          <select value={cell?.v} onChange={cell?.onChange} style={{ width: "64px", height: "32px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", textAlign: "center", font: "600 13px 'JetBrains Mono',monospace", background: cell?.bg, color: "#111827" }}>
                            <option value={"1"}>1</option>
                            <option value={"2"}>2</option>
                            <option value={"3"}>3</option>
                            <option value={"4"}>4</option>
                            <option value={"5"}>5</option>
                          </select>
                        </td>
                      </React.Fragment>))}
                    </tr>
                  </React.Fragment>))}
                </tbody>
              </table>
            </div>
          </div>
        </>) : null}
        {(__v.isScales) ? (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,420px),1fr))", gap: "20px", alignItems: "start" }}>
            {(__v.scales || []).map((sc, $index) => (<React.Fragment key={$index}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", overflow: "hidden" }}>
                <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <div style={{ fontSize: "16.5px", fontWeight: "600" }}>{sc?.title}</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>{sc?.sub}</div>
                </div>
                {(sc?.rows || []).map((r, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "flex", gap: "14px", alignItems: "stretch", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <div style={{ flex: "none", width: "150px", padding: "12px 14px", background: r?.bg, color: r?.fg, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                      <span style={{ font: "700 16px Inter,sans-serif" }}>{r?.n}</span>
                      <span style={{ font: "600 12px Inter,sans-serif" }}>{r?.label}</span>
                    </div>
                    <div style={{ flex: "1", padding: "12px 16px 12px 0", fontSize: "13px", lineHeight: "1.5", color: "#374151", display: "flex", alignItems: "center" }}>{r?.desc}</div>
                  </div>
                </React.Fragment>))}
              </div>
            </React.Fragment>))}
          </div>
        </>) : null}
        {(__v.isBuilder) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 260px", maxWidth: __v.sideMax, display: "flex", flexDirection: "column", gap: "12px" }}>
              <button onClick={__v.newTemplate} style={{ height: "38px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}><i className={"icon-plus"} style={{ fontSize: "14px" }}></i>New assessment</button>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "8px" }}>
                {(__v.templates || []).map((t, $index) => (<React.Fragment key={$index}>
                  <button onClick={t?.pick} style={{ width: "100%", display: "flex", flexDirection: "column", gap: "6px", padding: "12px", border: "0", borderRadius: "10px", cursor: "pointer", textAlign: "left", background: t?.bg }}>
                    <span style={{ font: "600 13.5px Inter,sans-serif", color: "#111827" }}>{t?.name}</span>
                    <span style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <span style={{ font: "600 10.5px Inter,sans-serif", borderRadius: "999px", padding: "2px 8px", background: t?.sBg, color: t?.sFg }}>{t?.status}</span>
                      <span style={{ font: "500 11.5px Inter,sans-serif", color: "#6b7280" }}>v{t?.version} · {t?.qCount} questions</span>
                    </span>
                  </button>
                </React.Fragment>))}
              </div>
            </div>
            <div style={{ flex: "3 1 560px", minWidth: "0", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <input value={__v.tName} onChange={__v.onTName} style={{ flex: "1 1 260px", border: "0", outline: "0", font: "600 17px Inter,sans-serif", color: "#111827", minWidth: "0", background: "transparent" }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    <button onClick={__v.archive} style={{ height: "34px", padding: "0 12px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Archive</button>
                    <button onClick={__v.saveDraft} style={{ height: "34px", padding: "0 12px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", background: "#fff", color: "#374151", font: "500 13px Inter,sans-serif", cursor: "pointer" }}>Save draft</button>
                    <button onClick={__v.publish} style={{ height: "34px", padding: "0 16px", border: "0", borderRadius: "999px", background: "#16a34a", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Publish v{__v.nextVersion}</button>
                  </div>
                </div>
                <div style={{ padding: "16px 20px 18px" }}>
                  <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280", marginBottom: "12px" }}>TIMING &amp; INTEGRITY</div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: "12px" }}>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Assessment day<input type={"date"} value={__v.cfg?.date} onChange={__v.on?.date} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window opens<input type={"time"} value={__v.cfg?.start} onChange={__v.on?.start} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window closes<input type={"time"} value={__v.cfg?.end} onChange={__v.on?.end} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Time limit (min)<input type={"number"} min={"5"} max={"240"} value={__v.cfg?.duration} onChange={__v.on?.duration} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Window-leave limit<input type={"number"} min={"1"} max={"10"} value={__v.cfg?.tabLimit} onChange={__v.on?.tabLimit} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                    <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "500 12px Inter,sans-serif", color: "#374151" }}>Pass threshold (%)<input type={"number"} min={"0"} max={"100"} value={__v.cfg?.pass} onChange={__v.on?.pass} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "10px 22px", marginTop: "16px" }}>
                    {(__v.toggles || []).map((tg, $index) => (<React.Fragment key={$index}>
                      <button onClick={tg?.toggle} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "0", padding: "0", cursor: "pointer", font: "500 13px Inter,sans-serif", color: "#374151" }}><span style={{ width: "34px", height: "20px", borderRadius: "999px", padding: "2px", display: "flex", justifyContent: tg?.justify, background: tg?.bg }}>
                          <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: "#fff" }}></span>
                        </span>{tg?.label}</button>
                    </React.Fragment>))}
                  </div>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "16.5px", fontWeight: "600" }}>Questions</span>
                  <span style={{ fontSize: "12.5px", color: "#6b7280" }}>Drag to reorder · total weight {__v.totalWeight}</span>
                </div>
                {(__v.qs || []).map((q, $index) => (<React.Fragment key={$index}>
                  <div draggable={"true"} onDragStart={q?.onDragStart} onDragOver={q?.onDragOver} onDrop={q?.onDrop} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "10px", padding: "10px 16px", borderBottom: "1px solid rgba(15,35,65,.07)", background: q?.bg }}>
                    <i className={"icon-grip-vertical"} style={{ fontSize: "16px", color: "#9ca3af", cursor: "grab" }}></i>
                    <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: "#6b7280", width: "22px" }}>{q?.num}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px", font: "600 11px Inter,sans-serif", color: "#0d3b2a", background: "#e6f2ea", borderRadius: "6px", padding: "4px 8px", whiteSpace: "nowrap" }}><i className={q?.icon} style={{ fontSize: "12px" }}></i>{q?.type}</span>
                    <input className={__css.h0} value={q?.text} onChange={q?.onText} style={{ flex: "1 1 240px", height: "34px", border: "1px solid transparent", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif", color: "#111827", minWidth: "0", background: "transparent" }} />
                    <label style={{ display: "flex", alignItems: "center", gap: "5px", font: "500 12px Inter,sans-serif", color: "#6b7280" }}>Weight<input type={"number"} min={"0"} max={"10"} value={q?.weight} onChange={q?.onWeight} style={{ width: "52px", height: "30px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "6px", padding: "0 6px", font: "400 12.5px Inter,sans-serif" }} /></label>
                    <button onClick={q?.toggleReq} style={{ height: "26px", padding: "0 9px", borderRadius: "999px", cursor: "pointer", font: "600 11px Inter,sans-serif", background: q?.reqBg, color: q?.reqFg, border: "0" }}>{q?.reqText}</button>
                    <button onClick={q?.remove} style={{ background: "none", border: "0", cursor: "pointer", color: "#9ca3af", display: "flex", padding: "4px" }}>
                      <i className={"icon-trash-2"} style={{ fontSize: "14px" }}></i>
                    </button>
                  </div>
                </React.Fragment>))}
                <div style={{ padding: "14px 16px 18px" }}>
                  <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".6px", color: "#6b7280", marginBottom: "10px" }}>ADD A QUESTION</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                    {(__v.palette || []).map((p, $index) => (<React.Fragment key={$index}>
                      <button className={__css.h1} onClick={p?.add} style={{ display: "flex", alignItems: "center", gap: "6px", height: "32px", padding: "0 12px", border: "1px dashed #c7ccd4", borderRadius: "10px", background: "#fff", cursor: "pointer", font: "500 12.5px Inter,sans-serif", color: "#374151" }}><i className={p?.icon} style={{ fontSize: "13px" }}></i>{p?.label}</button>
                    </React.Fragment>))}
                  </div>
                </div>
              </div>
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


export default SMFramework;
