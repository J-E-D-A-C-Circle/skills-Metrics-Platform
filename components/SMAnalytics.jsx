'use client';
import React from 'react';


const FIRST = ['Ama', 'Kofi', 'Efua', 'Yaw', 'Abena', 'Kwesi', 'Akosua', 'Kojo', 'Esi', 'Kwame', 'Adwoa', 'Nana', 'Afia', 'Fiifi'];
const LAST = ['Owusu', 'Boateng', 'Asante', 'Darko', 'Frimpong', 'Mensah', 'Appiah', 'Agyeman', 'Ofori', 'Quaye', 'Sarpong', 'Addo'];
const ROLES = ['Officer', 'Senior Officer', 'Assistant', 'Supervisor', 'Analyst'];
const ALLCOLS = ['Staff ID', 'Name', 'Department', 'Designation', 'Category', 'Target', 'Actual', 'Gap', 'Evaluator', 'Date'];
function rows(depts, cats) {
  const out = []; let k = 0;
  depts.forEach((d, di) => cats.forEach((c, ci) => { for (let i = 0; i < 3; i++) { k++;
    const target = 3 + ((k + ci) % 3 === 0 ? 1 : 0) + (ci === 2 && i === 0 ? 1 : 0), gap = Math.max(0, Math.min(5, d.gaps[ci] + ((i + di) % 3) - 1)), actual = Math.max(1, target - gap);
    out.push({ 'Staff ID': String(100000000 + k * 7919).slice(0, 9), Name: FIRST[(k * 3) % FIRST.length] + ' ' + LAST[(k * 5) % LAST.length], Department: d.name, Designation: ROLES[k % ROLES.length], Category: c,
      Target: target, Actual: actual, Gap: target - actual, Evaluator: ['Self', 'Manager', '360°'][k % 3], Date: '2026-' + String(1 + (k % 9)).padStart(2, '0') + '-' + String(1 + (k % 27)).padStart(2, '0') }); } }));
  return out;
}
class SMAnalytics extends React.Component {
  state = { dept: 'All', period: '3', cell: null, toast: '',
    rtype: 'Individual', from: '2026-01-01', to: '2026-12-31', rDept: 'All', band: 'All', evaluator: 'All', cols: ['Staff ID', 'Name', 'Department', 'Category', 'Target', 'Actual', 'Gap'], fmt: 'CSV',
    exports: [{ fmt: 'PDF', name: 'Q3 2026 organisation summary', when: '30 Sep 2026' }, { fmt: 'XLSX', name: 'IT Department gap register', when: '18 Sep 2026' }],
    adding: false, sName: '', sFreq: 'Weekly', sFmt: 'PDF', sTo: '',
    schedules: [{ id: 1, name: 'Weekly assessment completion', freq: 'Weekly', fmt: 'PDF', to: 'hr.director@dvla.gov.gh', next: 'Mon, 5 Oct · 07:00', on: true },
      { id: 2, name: 'Monthly skills gap register', freq: 'Monthly', fmt: 'Excel', to: 'it.director@dvla.gov.gh, hr.director@dvla.gov.gh', next: '1 Nov · 07:00', on: true },
      { id: 3, name: 'Daily integrity events digest', freq: 'Daily', fmt: 'CSV', to: 'audit@dvla.gov.gh', next: 'Tomorrow · 06:00', on: false }] };
  flash(t) { this.setState({ toast: t }); clearTimeout(this._t); this._t = setTimeout(() => this.setState({ toast: '' }), 2600); }
  download(name, text, mime) { try { const b = new Blob([text], { type: mime }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {} }
  renderVals() {
    const d = this.props.data, s = this.state, go = this.props.go || (() => {});
    const rawView = this.props.view;
    const view = (rawView === 'analytics' ? 'dashboard' : rawView) || 'dashboard', P = +s.period, QL = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
    const sel = s.dept === 'All' ? d.depts : d.depts.filter(x => x.name === s.dept);
    const staff = sel.reduce((a, x) => a + x.staff, 0), assessed = sel.reduce((a, x) => a + Math.round(x.assessed * (0.7 + P * 0.1)), 0);
    const wavg = (list, p) => list.reduce((a, x) => a + x.trend[p] * x.staff, 0) / list.reduce((a, x) => a + x.staff, 0);
    const avg = wavg(sel, P), prev = P > 0 ? wavg(sel, P - 1) : null;
    const all = rows(d.depts, d.categories), selRows = all.filter(r => s.dept === 'All' || r.Department === s.dept);
    const critical = selRows.filter(r => r.Gap >= 3).length;
    const maxT = 5;
    const bars = [...d.depts].sort((a, b) => b.trend[P] - a.trend[P]).map(x => ({ name: x.name, value: x.trend[P].toFixed(1), pct: (x.trend[P] / maxT * 100) + '%', color: x.trend[P] >= 3 ? '#0d3b2a' : '#f2a516',
      opacity: s.dept === 'All' || s.dept === x.name ? 1 : 0.35, pick: () => this.setState({ dept: s.dept === x.name ? 'All' : x.name }) }));
    const X = i => 60 + i * 90, Y = v => 170 - (v - 2) / 2 * 150;
    const tl = [0, 1, 2, 3].map(i => wavg(sel, i)), org = [0, 1, 2, 3].map(i => wavg(d.depts, i));
    const trend = { grid: [2, 2.5, 3, 3.5, 4].map(v => ({ y: Y(v), label: v.toFixed(1) })), line: tl.map((v, i) => X(i) + ',' + Y(v)).join(' '), org: org.map((v, i) => X(i) + ',' + Y(v)).join(' '),
      pts: tl.map((v, i) => ({ x: X(i), y: Y(v), ly: Y(v) - 10, v: v.toFixed(1), q: QL[i].slice(0, 2) })) };
    const dist = d.GAP.map(g => ({ ...g, count: selRows.filter(r => r.Gap === g.n).length })).filter(g => g.count).map(g => ({ ...g, pct: Math.round(g.count / selRows.length * 100) + '%' }));
    const c = s.cell, drillRows = c ? all.filter(r => r.Department === c.dept && r.Category === c.cat) : [];
    const rFiltered = all.filter(r => (s.rDept === 'All' || r.Department === s.rDept) && (s.evaluator === 'All' || r.Evaluator === s.evaluator) && r.Date >= s.from && r.Date <= s.to
      && (s.band === 'All' || (s.band === '0' && r.Gap === 0) || (s.band === '1-2' && r.Gap >= 1 && r.Gap <= 2) || (s.band === '3+' && r.Gap >= 3)));
    const cols = ALLCOLS.filter(x => s.cols.includes(x));
    let reportRows = rFiltered;
    if (s.rtype === 'Aggregated') {
      const g = {}; rFiltered.forEach(r => { const k = r.Department + '|' + r.Category; (g[k] = g[k] || []).push(r); });
      reportRows = Object.values(g).map(list => ({ Department: list[0].Department, Category: list[0].Category, Staff: list.length, 'Avg target': (list.reduce((a, r) => a + r.Target, 0) / list.length).toFixed(1), 'Avg actual': (list.reduce((a, r) => a + r.Actual, 0) / list.length).toFixed(1), 'Avg gap': (list.reduce((a, r) => a + r.Gap, 0) / list.length).toFixed(1) }));
    }
    const headers = s.rtype === 'Aggregated' ? ['Department', 'Category', 'Staff', 'Avg target', 'Avg actual', 'Avg gap'] : cols;
    const canSave = s.sName.trim() && /@/.test(s.sTo);
    return {
      title: { dashboard: 'Executive Dashboard', heatmap: 'Skill Heatmap', reports: 'Report Builder', schedules: 'Scheduled Reports' }[view],
      subtitle: { dashboard: 'Real-time KPIs across departments, time periods and assessors', heatmap: 'Spot capability gaps across the organisation and drill down to individual records', reports: 'Pick filters and columns, then export to PDF, CSV, Excel, JSON or XML', schedules: 'Reports sent automatically every day, week or month' }[view],
      isDash: view === 'dashboard', isHeat: view === 'heatmap', isReports: view === 'reports', isSchedules: view === 'schedules', showFilters: view === 'dashboard',
      dept: s.dept, period: s.period, onDept: e => this.setState({ dept: e.target.value }), onPeriod: e => this.setState({ period: e.target.value }), deptNames: d.depts.map(x => x.name),
      periodLabel: QL[P], trendLabel: s.dept === 'All' ? 'Organisation' : s.dept, trendShort: s.dept === 'All' ? 'All departments' : s.dept,
      kpis: [{ label: 'Staff in scope', value: staff, sub: sel.length + ' department' + (sel.length > 1 ? 's' : ''), subColor: '#6b7280' },
        { label: 'Assessment completion', value: Math.min(100, Math.round(assessed / staff * 100)) + '%', sub: Math.min(assessed, staff) + ' of ' + staff + ' assessed', subColor: '#6b7280' },
        { label: 'Average proficiency', value: avg.toFixed(2) + ' / 5', sub: prev ? (avg - prev >= 0 ? '▲ ' : '▼ ') + Math.abs(avg - prev).toFixed(2) + ' vs ' + QL[P - 1] : 'First cycle of the year', subColor: prev && avg - prev >= 0 ? '#15803d' : '#b91c1c' },
        { label: 'Noticeable+ gaps (3–5)', value: critical, sub: 'Need targeted training', subColor: '#b45309' }],
      bars, trend, dist, distTotal: selRows.length,
      cats: d.categories, gapScale: d.GAP,
      heatRows: d.depts.map(x => ({ name: x.name, staff: x.staff, cells: x.gaps.map((g, i) => { const on = c && c.dept === x.name && c.cat === d.categories[i];
        return { label: g === 0 ? '✓' : g, bg: d.GAP[g].bg, fg: d.GAP[g].fg, border: on ? '3px solid #111827' : '0', title: x.name + ' · ' + d.categories[i] + ': ' + d.GAP[g].label, pick: () => this.setState({ cell: { dept: x.name, cat: d.categories[i] } }) }; }) })),
      noDrill: !c, drillTitle: c ? c.dept : 'Drill-down', drillSub: c ? c.cat + ' · ' + drillRows.length + ' individual records' : 'Individual assessment records',
      drill: drillRows.map(r => ({ name: r.Name, initials: r.Name.split(' ').map(x => x[0]).join(''), role: r.Designation, target: r.Target, actual: r.Actual, gap: r.Gap + ' · ' + d.GAP[r.Gap].label, bg: d.GAP[r.Gap].bg, fg: d.GAP[r.Gap].fg })),
      rtypes: ['Individual', 'Aggregated'].map(t => ({ label: t === 'Individual' ? 'Individual records' : 'Group summary', onClick: () => this.setState({ rtype: t }), bg: s.rtype === t ? '#fff' : 'transparent', fg: s.rtype === t ? '#111827' : '#4b5563' })),
      from: s.from, to: s.to, rDept: s.rDept, band: s.band, evaluator: s.evaluator,
      onFrom: e => this.setState({ from: e.target.value }), onTo: e => this.setState({ to: e.target.value }), onRDept: e => this.setState({ rDept: e.target.value }), onBand: e => this.setState({ band: e.target.value }), onEval: e => this.setState({ evaluator: e.target.value }),
      cols: ALLCOLS.map(x => { const on = s.cols.includes(x); return { label: x, bg: on ? '#0d3b2a' : '#fff', fg: on ? '#fff' : '#374151', border: on ? '#0d3b2a' : 'rgba(15,35,65,.14)',
        toggle: () => this.setState({ cols: on ? s.cols.filter(y => y !== x) : [...s.cols, x] }) }; }),
      formats: ['PDF', 'CSV', 'Excel', 'JSON', 'XML'].map(f => { const on = s.fmt === f; return { label: f, pick: () => this.setState({ fmt: f }), bg: on ? '#e6f2ea' : '#fff', fg: on ? '#0d3b2a' : '#4b5563', border: on ? '#0d3b2a' : 'rgba(15,35,65,.14)' }; }),
      fmt: s.fmt, headers, previewCount: reportRows.length, preview: reportRows.slice(0, 8).map(r => headers.map(h => String(r[h]))),
      generate: () => {
        const name = 'skill-matrix-' + s.rtype.toLowerCase() + '-' + new Date().toISOString().slice(0, 10);
        const data = reportRows.map(r => Object.fromEntries(headers.map(h => [h, r[h]])));
        if (s.fmt === 'CSV' || s.fmt === 'Excel') this.download(name + '.csv', [headers.join(','), ...data.map(r => headers.map(h => '"' + String(r[h]).replace(/"/g, '""') + '"').join(','))].join('\n'), 'text/csv');
        else if (s.fmt === 'JSON') this.download(name + '.json', JSON.stringify(data, null, 2), 'application/json');
        else if (s.fmt === 'XML') this.download(name + '.xml', '<?xml version="1.0"?>\n<report>\n' + data.map(r => '  <row>' + headers.map(h => { const t = h.replace(/[^a-z]/gi, ''); return '<' + t + '>' + String(r[h]).replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</' + t + '>'; }).join('') + '</row>').join('\n') + '\n</report>', 'application/xml');
        this.setState({ exports: [{ fmt: s.fmt === 'Excel' ? 'XLSX' : s.fmt, name: (s.rtype === 'Aggregated' ? 'Group summary' : 'Individual records') + ' · ' + reportRows.length + ' rows', when: 'Just now' }, ...s.exports].slice(0, 6) });
        this.flash(s.fmt === 'PDF' ? 'PDF is being generated. It will appear in Recent exports.' : s.fmt + ' downloaded (' + reportRows.length + ' rows)'); },
      exportsList: s.exports,
      adding: s.adding, toggleAdd: () => this.setState({ adding: !s.adding }), sName: s.sName, sFreq: s.sFreq, sFmt: s.sFmt, sTo: s.sTo,
      onSName: e => this.setState({ sName: e.target.value }), onSFreq: e => this.setState({ sFreq: e.target.value }), onSFmt: e => this.setState({ sFmt: e.target.value }), onSTo: e => this.setState({ sTo: e.target.value }),
      sSaveBg: canSave ? '#15904c' : '#a3acb9',
      saveSchedule: () => { if (!canSave) { this.flash('Add a name and at least one email address'); return; }
        this.setState({ schedules: [...s.schedules, { id: Date.now(), name: s.sName.trim(), freq: s.sFreq, fmt: s.sFmt, to: s.sTo.trim(), next: { Daily: 'Tomorrow · 06:00', Weekly: 'Mon · 07:00', Monthly: '1st · 07:00' }[s.sFreq], on: true }], adding: false, sName: '', sTo: '' }); this.flash('Schedule created'); },
      schedules: s.schedules.map(r => ({ ...r, justify: r.on ? 'flex-end' : 'flex-start', bg: r.on ? '#0d3b2a' : '#d1d5db',
        toggle: () => this.setState({ schedules: this.state.schedules.map(x => x.id === r.id ? { ...x, on: !x.on } : x) }),
        remove: () => this.setState({ schedules: this.state.schedules.filter(x => x.id !== r.id) }) })),
      toast: s.toast,
    };
  }
  render() {
    const __v = this.renderVals() || {};
    return (
      <>
      <div style={{ padding: "clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px", display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-end", gap: "12px" }}>
          <div>
            <h1 style={{ margin: "0", fontSize: "clamp(24px,3vw,30px)", fontWeight: "700", letterSpacing: "-0.5px" }}>{__v.title}</h1>
            <div style={{ fontSize: "14px", color: "#6b7280", marginTop: "6px" }}>{__v.subtitle}</div>
          </div>
          {(__v.showFilters) ? (<>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              <select value={__v.dept} onChange={__v.onDept} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "500 13px Inter,sans-serif", background: "#fff", color: "#111827" }}>
                <option value={"All"}>All departments</option>
                {(__v.deptNames || []).map((n, $index) => (<React.Fragment key={$index}>
                  <option value={n}>{n}</option>
                </React.Fragment>))}
              </select>
              <select value={__v.period} onChange={__v.onPeriod} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "500 13px Inter,sans-serif", background: "#fff", color: "#111827" }}>
                <option value={"3"}>Q4 2026</option>
                <option value={"2"}>Q3 2026</option>
                <option value={"1"}>Q2 2026</option>
                <option value={"0"}>Q1 2026</option>
              </select>
            </div>
          </>) : null}
        </div>
        {(__v.isDash) ? (<>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: "12px" }}>
            {(__v.kpis || []).map((k, $index) => (<React.Fragment key={$index}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "18px" }}>
                <div style={{ fontSize: "13px", color: "#374151" }}>{k?.label}</div>
                <div style={{ fontSize: "24px", fontWeight: "700", marginTop: "8px", letterSpacing: "-0.3px" }}>{k?.value}</div>
                <div style={{ fontSize: "12px", color: k?.subColor, marginTop: "4px" }}>{k?.sub}</div>
              </div>
            </React.Fragment>))}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "stretch" }}>
            <div style={{ flex: "3 1 460px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Average proficiency by department</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>{__v.periodLabel} · click a department to drill down</div>
              </div>
              <div style={{ padding: "16px 20px 20px", display: "flex", flexDirection: "column", gap: "12px" }}>
                {(__v.bars || []).map((b, $index) => (<React.Fragment key={$index}>
                  <button onClick={b?.pick} style={{ display: "grid", gridTemplateColumns: "minmax(110px,170px) minmax(0,1fr) 44px", gap: "12px", alignItems: "center", background: "none", border: "0", padding: "4px 0", cursor: "pointer", textAlign: "left", opacity: b?.opacity }}>
                    <span style={{ font: "500 13px Inter,sans-serif", color: "#111827", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{b?.name}</span>
                    <span style={{ position: "relative", height: "14px", background: "rgba(118,118,128,.12)", borderRadius: "4px", overflow: "hidden" }}>
                      <span style={{ position: "absolute", left: "0", top: "0", bottom: "0", borderRadius: "4px", background: b?.color, width: b?.pct }}></span>
                    </span>
                    <span style={{ font: "600 12.5px 'JetBrains Mono',monospace", color: "#374151", textAlign: "right" }}>{b?.value}</span>
                  </button>
                </React.Fragment>))}
              </div>
            </div>
            <div style={{ flex: "2 1 340px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Trend over time</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>{__v.trendLabel} · average proficiency</div>
              </div>
              <div style={{ padding: "14px 16px 10px", flex: "1", display: "flex", alignItems: "center" }}>
                <svg viewBox={"0 0 360 200"} width={"100%"} style={{ display: "block" }}>
                  <g>
                    {(__v.trend?.grid || []).map((g, $index) => (<React.Fragment key={$index}>
                      <line x1={"36"} x2={"350"} y1={g?.y} y2={g?.y} stroke={"#eef0f3"}></line>
                    </React.Fragment>))}
                  </g>
                  <g>
                    {(__v.trend?.grid || []).map((g, $index) => (<React.Fragment key={$index}>
                      <text x={"28"} y={g?.y} textAnchor={"end"} dominantBaseline={"middle"} style={{ font: "500 10px Inter,sans-serif", fill: "#9ca3af" }}>{g?.label}</text>
                    </React.Fragment>))}
                  </g>
                  <polyline points={__v.trend?.org} fill={"none"} stroke={"#cbd2da"} strokeWidth={"2"} strokeDasharray={"4 4"}></polyline>
                  <polyline points={__v.trend?.line} fill={"none"} stroke={"#0d3b2a"} strokeWidth={"2.5"}></polyline>
                  <g>
                    {(__v.trend?.pts || []).map((p, $index) => (<React.Fragment key={$index}>
                      <circle cx={p?.x} cy={p?.y} r={"4.5"} fill={"#fff"} stroke={"#0d3b2a"} strokeWidth={"2"}></circle>
                      <text x={p?.x} y={p?.ly} textAnchor={"middle"} style={{ font: "600 10.5px Inter,sans-serif", fill: "#111827" }}>{p?.v}</text>
                      <text x={p?.x} y={"192"} textAnchor={"middle"} style={{ font: "500 10px Inter,sans-serif", fill: "#6b7280" }}>{p?.q}</text>
                    </React.Fragment>))}
                  </g>
                </svg>
              </div>
              <div style={{ display: "flex", gap: "16px", padding: "0 20px 16px", fontSize: "11.5px", color: "#4b5563" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "16px", height: "3px", background: "#0d3b2a" }}></span>{__v.trendShort}</span>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "16px", borderTop: "2px dashed #cbd2da" }}></span>Organisation</span>
              </div>
            </div>
          </div>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "18px 20px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "10px" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Gap distribution</div>
              <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{__v.distTotal} competency ratings · {__v.periodLabel}</span>
            </div>
            <div style={{ display: "flex", height: "22px", borderRadius: "6px", overflow: "hidden", marginTop: "14px", gap: "2px" }}>
              {(__v.dist || []).map((g, $index) => (<React.Fragment key={$index}>
                <div style={{ flex: g?.count, background: g?.bg, color: g?.fg, font: "600 10.5px Inter,sans-serif", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>{g?.pct}</div>
              </React.Fragment>))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "12px", fontSize: "11.5px", color: "#4b5563" }}>
              {(__v.dist || []).map((g, $index) => (<React.Fragment key={$index}>
                <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "10px", height: "10px", borderRadius: "3px", background: g?.bg }}></span>{g?.n} · {g?.label} ({g?.count})</span>
              </React.Fragment>))}
            </div>
          </div>
        </>) : null}
        {(__v.isHeat) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "3 1 560px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Average gap by department and skill category</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>Click a cell to see individual assessment records</div>
              </div>
              <div style={{ padding: "16px 20px 20px", overflowX: "auto" }}>
                <div style={{ minWidth: "640px", display: "grid", gridTemplateColumns: "180px repeat(5,minmax(0,1fr))", gap: "4px" }}>
                  <span></span>
                  {(__v.cats || []).map((c, $index) => (<React.Fragment key={$index}>
                    <span style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", padding: "0 4px 6px", textTransform: "uppercase" }}>{c}</span>
                  </React.Fragment>))}
                  {(__v.heatRows || []).map((r, $index) => (<React.Fragment key={$index}>
                    <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", paddingRight: "8px" }}>
                      <span style={{ fontSize: "13px", fontWeight: "500" }}>{r?.name}</span>
                      <span style={{ fontSize: "11.5px", color: "#6b7280" }}>{r?.staff} staff</span>
                    </div>
                    {(r?.cells || []).map((cell, $index) => (<React.Fragment key={$index}>
                      <button onClick={cell?.pick} title={cell?.title} style={{ height: "46px", borderRadius: "6px", cursor: "pointer", font: "600 12.5px Inter,sans-serif", background: cell?.bg, color: cell?.fg, border: cell?.border }}>{cell?.label}</button>
                    </React.Fragment>))}
                  </React.Fragment>))}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", marginTop: "16px", fontSize: "11.5px", color: "#4b5563" }}>
                  {(__v.gapScale || []).map((g, $index) => (<React.Fragment key={$index}>
                    <span style={{ display: "flex", alignItems: "center", gap: "6px" }}><span style={{ width: "12px", height: "12px", borderRadius: "3px", background: g?.bg }}></span>{g?.n} · {g?.label}</span>
                  </React.Fragment>))}
                </div>
              </div>
            </div>
            <div style={{ flex: "2 1 320px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>{__v.drillTitle}</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>{__v.drillSub}</div>
              </div>
              {(__v.noDrill) ? (<>
                <div style={{ padding: "36px 20px", textAlign: "center", fontSize: "13.5px", color: "#6b7280" }}>Select a cell in the heatmap.</div>
              </>) : null}
              {(__v.drill || []).map((p, $index) => (<React.Fragment key={$index}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                  <span style={{ width: "34px", height: "34px", borderRadius: "50%", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", font: "600 12px Inter,sans-serif", flex: "none" }}>{p?.initials}</span>
                  <div style={{ flex: "1", minWidth: "0" }}>
                    <div style={{ fontSize: "13.5px", fontWeight: "500" }}>{p?.name}</div>
                    <div style={{ fontSize: "12px", color: "#6b7280" }}>{p?.role} · target {p?.target}, actual {p?.actual}</div>
                  </div>
                  <span style={{ font: "600 11px Inter,sans-serif", borderRadius: "999px", padding: "3px 9px", background: p?.bg, color: p?.fg }}>{p?.gap}</span>
                </div>
              </React.Fragment>))}
            </div>
          </div>
        </>) : null}
        {(__v.isReports) ? (<>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "20px", alignItems: "flex-start" }}>
            <div style={{ flex: "1 1 320px", minWidth: "0", background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Build a report</div>
              <div style={{ display: "flex", background: "rgba(118,118,128,.12)", borderRadius: "10px", padding: "3px", gap: "3px" }}>
                {(__v.rtypes || []).map((t, $index) => (<React.Fragment key={$index}>
                  <button onClick={t?.onClick} style={{ flex: "1", height: "30px", border: "0", borderRadius: "6px", cursor: "pointer", font: "500 12.5px Inter,sans-serif", background: t?.bg, color: t?.fg }}>{t?.label}</button>
                </React.Fragment>))}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>FROM<input type={"date"} value={__v.from} onChange={__v.onFrom} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>TO<input type={"date"} value={__v.to} onChange={__v.onTo} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", minWidth: "0" }} /></label>
              </div>
              <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>DEPARTMENT<select value={__v.rDept} onChange={__v.onRDept} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                  <option value={"All"}>All departments</option>
                  {(__v.deptNames || []).map((n, $index) => (<React.Fragment key={$index}>
                    <option value={n}>{n}</option>
                  </React.Fragment>))}
                </select></label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>GAP BAND<select value={__v.band} onChange={__v.onBand} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                    <option value={"All"}>All gaps</option>
                    <option value={"0"}>0 · No gap</option>
                    <option value={"1-2"}>1–2 · Minimal/Moderate</option>
                    <option value={"3+"}>3+ · Noticeable or worse</option>
                  </select></label>
                <label style={{ display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>EVALUATOR<select value={__v.evaluator} onChange={__v.onEval} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13px Inter,sans-serif", background: "#fff" }}>
                    <option value={"All"}>All</option>
                    <option value={"Self"}>Self</option>
                    <option value={"Manager"}>Manager</option>
                    <option value={"360°"}>360°</option>
                  </select></label>
              </div>
              <div>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", marginBottom: "8px" }}>COLUMNS</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(__v.cols || []).map((c, $index) => (<React.Fragment key={$index}>
                    <button onClick={c?.toggle} style={{ height: "28px", padding: "0 10px", borderRadius: "999px", cursor: "pointer", font: "500 12px Inter,sans-serif", background: c?.bg, color: c?.fg, border: `1px solid ${c?.border ?? ""}` }}>{c?.label}</button>
                  </React.Fragment>))}
                </div>
              </div>
              <div>
                <div style={{ font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280", marginBottom: "8px" }}>FORMAT</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                  {(__v.formats || []).map((f, $index) => (<React.Fragment key={$index}>
                    <button onClick={f?.pick} style={{ height: "30px", padding: "0 12px", borderRadius: "10px", cursor: "pointer", font: "600 12px Inter,sans-serif", background: f?.bg, color: f?.fg, border: `1px solid ${f?.border ?? ""}` }}>{f?.label}</button>
                  </React.Fragment>))}
                </div>
              </div>
              <button onClick={__v.generate} style={{ height: "40px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13.5px Inter,sans-serif", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}><i className={"icon-download"} style={{ fontSize: "15px" }}></i>Generate {__v.fmt}</button>
            </div>
            <div style={{ flex: "2 1 520px", minWidth: "0", display: "flex", flexDirection: "column", gap: "20px" }}>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", display: "flex", flexWrap: "wrap", justifyContent: "space-between", gap: "8px" }}>
                  <span style={{ fontSize: "16.5px", fontWeight: "600" }}>Preview</span>
                  <span style={{ fontSize: "12.5px", color: "#6b7280" }}>{__v.previewCount} rows</span>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", font: "400 13px Inter,sans-serif", minWidth: "560px" }}>
                    <thead>
                      <tr>
                        {(__v.headers || []).map((h, $index) => (<React.Fragment key={$index}>
                          <th style={{ textAlign: "left", padding: "10px 14px", font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280", borderBottom: "1px solid rgba(15,35,65,.07)", whiteSpace: "nowrap" }}>{h}</th>
                        </React.Fragment>))}
                      </tr>
                    </thead>
                    <tbody>
                      {(__v.preview || []).map((r, $index) => (<React.Fragment key={$index}>
                        <tr>
                          {(r || []).map((cell, $index) => (<React.Fragment key={$index}>
                            <td style={{ padding: "10px 14px", borderBottom: "1px solid rgba(15,35,65,.07)", color: "#111827", whiteSpace: "nowrap" }}>{cell}</td>
                          </React.Fragment>))}
                        </tr>
                      </React.Fragment>))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
                <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(15,35,65,.07)", fontSize: "16.5px", fontWeight: "600" }}>Recent exports</div>
                {(__v.exportsList || []).map((e, $index) => (<React.Fragment key={$index}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                    <span style={{ font: "700 10px 'JetBrains Mono',monospace", background: "#e6f2ea", color: "#0d3b2a", borderRadius: "6px", padding: "4px 7px" }}>{e?.fmt}</span>
                    <span style={{ flex: "1", fontSize: "13.5px", minWidth: "0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e?.name}</span>
                    <span style={{ fontSize: "12px", color: "#6b7280", whiteSpace: "nowrap" }}>{e?.when}</span>
                  </div>
                </React.Fragment>))}
              </div>
            </div>
          </div>
        </>) : null}
        {(__v.isSchedules) ? (<>
          <div style={{ background: "rgba(255,255,255,.62)", backdropFilter: "blur(28px) saturate(180%)", WebkitBackdropFilter: "blur(28px) saturate(180%)", border: "1px solid rgba(255,255,255,.85)", borderRadius: "22px", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)", boxShadow: "inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: "12px", padding: "18px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
              <div>
                <div style={{ fontSize: "16.5px", fontWeight: "600" }}>Scheduled reports</div>
                <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "4px" }}>Sent automatically by email</div>
              </div>
              <button onClick={__v.toggleAdd} style={{ display: "flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 14px", border: "0", borderRadius: "999px", background: "linear-gradient(180deg,#2fb36b,#15904c)", boxShadow: "0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)", color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}><i className={"icon-plus"} style={{ fontSize: "14px" }}></i>New schedule</button>
            </div>
            {(__v.adding) ? (<>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "12px", alignItems: "flex-end", padding: "16px 20px", background: "rgba(255,255,255,.4)", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <label style={{ flex: "2 1 220px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>REPORT NAME<input value={__v.sName} onChange={__v.onSName} placeholder={"e.g. Weekly completion summary"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif" }} /></label>
                <label style={{ flex: "1 1 140px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>FREQUENCY<select value={__v.sFreq} onChange={__v.onSFreq} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif", background: "#fff" }}>
                    <option value={"Daily"}>Daily</option>
                    <option value={"Weekly"}>Weekly</option>
                    <option value={"Monthly"}>Monthly</option>
                  </select></label>
                <label style={{ flex: "1 1 110px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>FORMAT<select value={__v.sFmt} onChange={__v.onSFmt} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 8px", font: "400 13.5px Inter,sans-serif", background: "#fff" }}>
                    <option value={"PDF"}>PDF</option>
                    <option value={"Excel"}>Excel</option>
                    <option value={"CSV"}>CSV</option>
                  </select></label>
                <label style={{ flex: "2 1 240px", display: "flex", flexDirection: "column", gap: "5px", font: "600 10.5px Inter,sans-serif", letterSpacing: ".4px", color: "#6b7280" }}>RECIPIENTS<input value={__v.sTo} onChange={__v.onSTo} placeholder={"name@dvla.gov.gh, …"} style={{ height: "36px", border: "1px solid rgba(15,35,65,.14)", borderRadius: "10px", padding: "0 10px", font: "400 13.5px Inter,sans-serif" }} /></label>
                <button onClick={__v.saveSchedule} style={{ height: "36px", padding: "0 16px", border: "0", borderRadius: "999px", background: __v.sSaveBg, color: "#fff", font: "600 13px Inter,sans-serif", cursor: "pointer" }}>Save</button>
              </div>
            </>) : null}
            {(__v.schedules || []).map((r, $index) => (<React.Fragment key={$index}>
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px", padding: "14px 20px", borderBottom: "1px solid rgba(15,35,65,.07)" }}>
                <span style={{ width: "38px", height: "38px", borderRadius: "9px", background: "#e6f2ea", color: "#0d3b2a", display: "flex", alignItems: "center", justifyContent: "center", flex: "none" }}>
                  <i className={"icon-calendar-clock"} style={{ fontSize: "17px" }}></i>
                </span>
                <div style={{ flex: "2 1 220px", minWidth: "0" }}>
                  <div style={{ fontSize: "14.5px", fontWeight: "500" }}>{r?.name}</div>
                  <div style={{ fontSize: "12.5px", color: "#6b7280", marginTop: "2px", overflowWrap: "anywhere" }}>{r?.freq} · {r?.fmt} · {r?.to}</div>
                </div>
                <div style={{ flex: "0 0 130px" }}>
                  <div style={{ font: "600 10px Inter,sans-serif", letterSpacing: ".5px", color: "#6b7280" }}>NEXT RUN</div>
                  <div style={{ fontSize: "13px", marginTop: "3px" }}>{r?.next}</div>
                </div>
                <button onClick={r?.toggle} title={"Active"} style={{ width: "40px", height: "22px", borderRadius: "999px", border: "0", cursor: "pointer", padding: "2px", display: "flex", justifyContent: r?.justify, background: r?.bg }}>
                  <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }}></span>
                </button>
                <button onClick={r?.remove} style={{ background: "none", border: "0", cursor: "pointer", color: "#9ca3af", display: "flex", padding: "4px" }}>
                  <i className={"icon-trash-2"} style={{ fontSize: "15px" }}></i>
                </button>
              </div>
            </React.Fragment>))}
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


export default SMAnalytics;
