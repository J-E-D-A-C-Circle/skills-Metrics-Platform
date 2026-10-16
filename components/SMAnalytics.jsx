'use client';
// =============================================================================
// SMAnalytics.jsx · analytics dashboards, top training needs, report builder and scheduled reports
// Screen / URL: /analytics (Overview), /analytics?tab=departments, /analytics?tab=heatmap, /training?tab=top-needs, /reports (Report Builder), /reports?tab=scheduled
// Who sees it: admin (all); manager (Analytics + Training, own department only); Reports is admin only
// Used by: SkillMatrixApp.jsx (analytics + training pages)   Depends on: ./smUI, ./smModel, ./SMStaffReport (IndividualReportView, reportExport), xlsx
// Sections (search for these markers): ANALYTICS · Constants, ANALYTICS · Helpers (toast, XML escape), ANALYTICS · Gap legend, ANALYTICS · Main component (view switcher), ANALYTICS · Page titles & descriptions, ANALYTICS · Render, ANALYTICS · Selected view (only one renders), ANALYTICS · Staff drawer & toast, ANALYTICS · Overview dashboard (/analytics), ANALYTICS · Overview render, ANALYTICS · Overview page header, ANALYTICS · KPI tiles, ANALYTICS · Proficiency by department card, ANALYTICS · Trend over time chart, ANALYTICS · Largest gaps by competency card, ANALYTICS · Gap distribution card, ANALYTICS · Departments tab (/analytics?tab=departments), ANALYTICS · Departments page header, ANALYTICS · Departments table, TRAINING · Top Training Needs (/training?tab=top-needs), TRAINING · Top needs page header, TRAINING · Top needs table, ANALYTICS · Heat grid (shared coloured grid), ANALYTICS · Heat grid column headers, ANALYTICS · Heat grid rows, ANALYTICS · Heat grid legend, ANALYTICS · Heatmap tab (/analytics?tab=heatmap), ANALYTICS · Heatmap · all departments view, ANALYTICS · Heatmap page header, ANALYTICS · Department x category grid, ANALYTICS · Heatmap · single department view, ANALYTICS · Heatmap page header + category filter, ANALYTICS · Person x competency grid, REPORTS · Report builder (/reports), REPORTS · Builder state, REPORTS · Rows from filters, REPORTS · Export, REPORTS · Type switch & preview columns, REPORTS · Render, REPORTS · Report builder page header, REPORTS · Build a report panel, REPORTS · Report type switch, REPORTS · Staff picker (individual) or filters (records / summary), REPORTS · Filters (date, gap band, source, status), REPORTS · Column picker (staff records only), REPORTS · Format picker & export button, REPORTS · Preview + recent exports column, REPORTS · Preview, REPORTS · Recent exports, REPORTS · Scheduled reports (/reports?tab=scheduled), REPORTS · Scheduled reports page header, REPORTS · Scheduled reports list card, REPORTS · New schedule form, REPORTS · Schedule rows (toggle / delete)
// =============================================================================
import React, { useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Badge, GapBadge, StatusBadge, EmptyState, DataTable, KpiTile, Toast, StaffDrawer, ScopeSelect, Toggle, CARD, INPUT, download, toCSV, slugify } from './smUI';
import { ALL, CYCLES, CURRENT, PREVIOUS, STATUSES, inScope, staffRow, records, avg, round1, individualReport } from './smModel';
import { IndividualReportView, reportExport } from './SMStaffReport';

// ===== ANALYTICS · Constants =====
// QDATE = the date a result from an earlier cycle is stamped with in reports; RCOLS / SUMCOLS = report columns.
const QDATE = { 'Q1 2026': '2026-03-12', 'Q2 2026': '2026-06-02', 'Q3 2026': '2026-08-28' };
const EVALUATORS = ['All', 'System', 'Manager-confirmed', 'Manager-adjusted', 'Previous cycle'];
const RCOLS = ['Staff ID', 'Name', 'Department', 'Designation', 'Category', 'Competency', 'Target', 'Actual', 'Gap', 'Status', 'Evaluator', 'Date'];
const SUMCOLS = ['Department', 'Category', 'Staff', 'Records', 'Avg target', 'Avg actual', 'Avg gap', 'Gaps ≥ 3'];

// ===== ANALYTICS · Helpers (toast, XML escape) =====
function useToast() {
  const [t, setT] = useState('');
  const ref = React.useRef();
  return [t, msg => { setT(msg); clearTimeout(ref.current); ref.current = setTimeout(() => setT(''), 2600); }];
}
function xmlEscape(v) { return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
const tag = h => h.replace(/[^a-z0-9]/gi, '') || 'field';

// ===== ANALYTICS · Gap legend =====
// Coloured key for gaps 0-5; when onPick is given each band is clickable and opens the staff drawer.
function GapLegend({ D, counts, onPick }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '11.5px', color: '#4b5563' }}>
      {D.GAP.map(g => (
        <button key={g.n} type="button" onClick={onPick ? () => onPick(g.n) : undefined} disabled={!onPick} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: '0', padding: '2px 0', cursor: onPick ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
          <span style={{ width: '11px', height: '11px', borderRadius: '3px', background: g.bg }}></span>{g.n} · {g.label}{counts ? ' (' + (counts[g.n] || 0) + ')' : ''}
        </button>
      ))}
    </div>
  );
}

// ===== ANALYTICS · Main component (view switcher) =====
// `view` comes from the URL tab (dashboard, departments, topneeds, heatmap, reports, schedules).
// Managers are locked to their own department; admins can pick one here (defaults to the global scope).
export default function SMAnalytics(props) {
  const { data: D, model, go, view = 'dashboard', role, scope, myDept, deptLocked } = props;
  const [local, setLocal] = useState(null);
  const locked = deptLocked ?? role === 'manager'; // own department only (Settings > User Management > Departments they can see)
  const dept = locked ? myDept : (local ?? scope);
  const [drawer, setDrawer] = useState(null);
  const [toast, flash] = useToast();
  const staff = useMemo(() => inScope(model, dept), [model, dept]);
  const scopeLabel = dept === ALL ? 'All departments' : dept;
  const deptFilter = <ScopeSelect depts={D.depts} value={dept} globalValue={scope} onChange={setLocal} locked={locked} />;

  // drawer helpers
  const openStaff = (title, list, sub) => setDrawer({ title, sub: sub || scopeLabel, rows: list.map(staffRow), aggregated: true });
  const openRecords = (title, list, pred, sub) => setDrawer({ title, sub: sub || scopeLabel, rows: records(list, pred), aggregated: false });

  // ===== ANALYTICS · Page titles & descriptions =====
  const title = { dashboard: 'Executive Dashboard', departments: 'Departments at a Glance', topneeds: 'Top Training Needs', heatmap: 'Skill Heatmap', reports: 'Report Builder', schedules: 'Scheduled Reports' }[view];
  const desc = { dashboard: 'Organisation-wide KPIs for the ' + CURRENT + ' cycle. Click any tile, bar or band to see the staff behind it.', departments: 'Completion, average gap and reviews outstanding for each department in the ' + CURRENT + ' cycle. Click a department to see its staff.', topneeds: 'Competencies where staff have a gap of 3 or more, ranked by how many people need training. Click a row to see who.', heatmap: 'Average gap by department and skill category. Pick a department to see each person by competency.', reports: 'Build an individual record or an aggregated report, preview it, then export exactly what you see', schedules: 'Reports sent automatically every day, week or month' }[view];

  // ===== ANALYTICS · Render =====
  return (
    <Page>
      {/* ===== ANALYTICS · Selected view (only one renders) ===== */}
      {view === 'dashboard' ? <Dashboard {...{ D, model, staff, dept, scopeLabel, openStaff, openRecords, go, title, desc, deptFilter }} /> : null}
      {view === 'departments' ? <Departments {...{ D, model, staff, dept, openStaff, title, desc, deptFilter }} /> : null}
      {view === 'topneeds' ? <TopNeeds {...{ D, staff, scopeLabel, openRecords, go, title, desc, deptFilter }} /> : null}
      {view === 'heatmap' ? <Heatmap {...{ D, model, staff, dept, scopeLabel, openRecords, go, title, desc, deptFilter, setLocal: locked ? null : setLocal }} /> : null}
      {view === 'reports' ? <Reports {...{ D, model, dept, go, title, desc, deptFilter, flash }} /> : null}
      {view === 'schedules' ? <Schedules {...{ title, desc, flash }} /> : null}
      {/* ===== ANALYTICS · Staff drawer & toast ===== */}
      <StaffDrawer ctx={drawer} D={D} go={go} onClose={() => setDrawer(null)} />
      <Toast text={toast} />
    </Page>
  );
}

// ===== ANALYTICS · Overview dashboard (/analytics) =====
function Dashboard({ D, model, staff, dept, scopeLabel, openStaff, openRecords, go, title, desc, deptFilter }) {
  const assessed = staff.filter(s => s.scored), outstanding = staff.filter(s => !s.scored), review = staff.filter(s => s.status === 'Submitted' || s.status === 'Auto-scored');
  const recs = staff.flatMap(s => s.comps.map(c => ({ s, c })));
  const avgGap = avg(recs.map(r => r.c.gap)), severe = recs.filter(r => r.c.gap >= 4);
  const pct = staff.length ? Math.round(assessed.length / staff.length * 100) : 0;
  const counts = {}; recs.forEach(r => { counts[r.c.gap] = (counts[r.c.gap] || 0) + 1; });
  // Department bars always use every department; ones outside the chosen scope are dimmed.
  const deptRows = D.depts.map(dp => { const ss = model.staff.filter(s => s.dept === dp.name); return { name: dp.name, ss, actual: avg(ss.map(s => s.avgActual)), gap: avg(ss.map(s => s.avgGap)), done: ss.filter(s => s.scored).length }; }).sort((a, b) => b.actual - a.actual);
  const compAgg = {};
  recs.forEach(({ c }) => { const a = compAgg[c.id] || (compAgg[c.id] = { id: c.id, name: c.name, short: c.short, gaps: [], dept: model.compById[c.id].dept }); a.gaps.push(c.gap); });
  const compRows = Object.values(compAgg).map(a => ({ ...a, avg: avg(a.gaps), n: a.gaps.length, severe: a.gaps.filter(g => g >= 3).length })).sort((a, b) => b.avg - a.avg).slice(0, 10);
  const maxComp = Math.max(1, ...compRows.map(c => c.avg));
  // trend
  const tl = CYCLES.map(q => { const l = staff.filter(s => s.hist[q] != null); return l.length ? avg(l.map(s => s.hist[q])) : null; });
  const org = CYCLES.map(q => { const l = model.staff.filter(s => s.hist[q] != null); return avg(l.map(s => s.hist[q])); });
  const vals = [...tl, ...org].filter(v => v != null), lo = Math.floor(Math.min(...vals) * 2) / 2 - 0.5, hi = Math.ceil(Math.max(...vals) * 2) / 2 + 0.5;
  const X = i => 60 + i * 90, Y = v => 170 - (v - lo) / (hi - lo) * 150;
  const grid = []; for (let v = lo; v <= hi + 0.001; v += 0.5) grid.push(v);
  const prevAvg = tl[2], curAvg = tl[3];
  // ===== ANALYTICS · Overview render =====
  return (
    <>
      {/* ===== ANALYTICS · Overview page header ===== */}
      <PageHeader title={title} description={desc} actions={<Btn icon="icon-file-spreadsheet" onClick={() => go('reports')}>Build a report</Btn>} filters={<>{deptFilter}<span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>{D.cycle.name} · actual = latest scored result</span></>} />
      {/* ===== ANALYTICS · KPI tiles ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
        <KpiTile label="Staff in scope" value={staff.length} sub={(dept === ALL ? D.depts.length + ' departments' : dept)} onClick={() => openStaff('Staff in scope', staff)} />
        <KpiTile label="Assessed" value={assessed.length} sub={review.length + ' awaiting review'} onClick={() => openStaff('Assessed · ' + CURRENT, assessed)} />
        <KpiTile label="Completion" value={pct + '%'} sub={outstanding.length + ' not yet submitted'} subColor={outstanding.length ? '#b45309' : '#15803d'} onClick={() => openStaff('Outstanding assessments · ' + CURRENT, outstanding)} />
        <KpiTile label="Average proficiency" value={curAvg == null ? '—' : curAvg.toFixed(2) + ' / 5'} sub={curAvg != null && prevAvg != null ? (curAvg - prevAvg >= 0 ? '▲ ' : '▼ ') + Math.abs(curAvg - prevAvg).toFixed(2) + ' vs ' + PREVIOUS : ''} subColor={curAvg >= prevAvg ? '#15803d' : '#b91c1c'} onClick={() => openStaff('Average proficiency · ' + CURRENT, assessed)} />
        <KpiTile label="Average gap" value={avgGap.toFixed(2)} sub={D.GAP[Math.round(avgGap)].label + ' on average'} onClick={() => openStaff('Average gap', [...staff].sort((a, b) => b.avgGap - a.avgGap))} />
        <KpiTile label="Significant + critical gaps" value={severe.length} sub={new Set(severe.map(r => r.s.id)).size + ' staff need intensive training'} subColor="#b91c1c" onClick={() => openRecords('Significant & critical gaps (4–5)', staff, c => c.gap >= 4)} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        {/* ===== ANALYTICS · Proficiency by department card ===== */}
        <Card title="Proficiency by department" sub="Average actual level · click a department to see its staff" style={{ flex: '3 1 460px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {deptRows.map(r => (
              <button key={r.name} type="button" onClick={() => openStaff(r.name, r.ss, r.done + ' of ' + r.ss.length + ' assessed')} style={{ display: 'grid', gridTemplateColumns: 'minmax(110px,170px) minmax(0,1fr) 44px 92px', gap: '12px', alignItems: 'center', background: 'none', border: '0', padding: '5px 0', cursor: 'pointer', textAlign: 'left', opacity: dept === ALL || dept === r.name ? 1 : 0.4 }}>
                <span style={{ font: '500 13px Inter,sans-serif', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.name}</span>
                <span style={{ position: 'relative', height: '14px', background: 'rgba(118,118,128,.12)', borderRadius: '4px', overflow: 'hidden' }}><span style={{ position: 'absolute', left: '0', top: '0', bottom: '0', borderRadius: '4px', background: r.actual >= 3 ? '#0d3b2a' : '#f2a516', width: (r.actual / 5 * 100) + '%' }}></span></span>
                <span style={{ font: "600 12.5px 'JetBrains Mono',monospace", color: '#374151', textAlign: 'right' }}>{r.actual.toFixed(1)}</span>
                <span style={{ fontSize: '11.5px', color: '#6b7280', textAlign: 'right' }}>gap {r.gap.toFixed(1)} · {Math.round(r.done / r.ss.length * 100)}%</span>
              </button>
            ))}
          </div>
        </Card>
        {/* ===== ANALYTICS · Trend over time chart ===== */}
        <Card title="Trend over time" sub={scopeLabel + ' · average proficiency per cycle'} style={{ flex: '2 1 340px', display: 'flex', flexDirection: 'column' }}>
          <svg viewBox="0 0 360 200" width="100%" style={{ display: 'block' }}>
            {grid.map(v => <g key={v}><line x1="36" x2="350" y1={Y(v)} y2={Y(v)} stroke="#eef0f3" /><text x="28" y={Y(v)} textAnchor="end" dominantBaseline="middle" style={{ font: '500 10px Inter,sans-serif', fill: '#9ca3af' }}>{v.toFixed(1)}</text></g>)}
            <polyline points={org.map((v, i) => X(i) + ',' + Y(v)).join(' ')} fill="none" stroke="#cbd2da" strokeWidth="2" strokeDasharray="4 4" />
            <polyline points={tl.map((v, i) => v == null ? null : X(i) + ',' + Y(v)).filter(Boolean).join(' ')} fill="none" stroke="#0d3b2a" strokeWidth="2.5" />
            {tl.map((v, i) => <g key={i}>{v != null ? <><circle cx={X(i)} cy={Y(v)} r="4.5" fill="#fff" stroke="#0d3b2a" strokeWidth="2" /><text x={X(i)} y={Y(v) - 10} textAnchor="middle" style={{ font: '600 10.5px Inter,sans-serif', fill: '#111827' }}>{v.toFixed(1)}</text></> : null}<text x={X(i)} y="194" textAnchor="middle" style={{ font: '500 10px Inter,sans-serif', fill: '#6b7280' }}>{CYCLES[i].slice(0, 2)}</text></g>)}
          </svg>
          <div style={{ display: 'flex', gap: '16px', fontSize: '11.5px', color: '#4b5563', marginTop: '8px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '16px', height: '3px', background: '#0d3b2a' }}></span>{scopeLabel}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '16px', borderTop: '2px dashed #cbd2da' }}></span>Organisation</span>
          </div>
        </Card>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        {/* ===== ANALYTICS · Largest gaps by competency card ===== */}
        <Card title="Largest gaps by competency" sub={'Top 10 in ' + scopeLabel + ' · click a competency to see who needs it'} style={{ flex: '3 1 460px' }}>
          {compRows.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {compRows.map(c => (
              <button key={c.id} type="button" onClick={() => openRecords(c.name, staff, x => x.id === c.id, c.n + ' staff assessed on it')} style={{ display: 'grid', gridTemplateColumns: 'minmax(120px,200px) minmax(0,1fr) 40px 110px', gap: '12px', alignItems: 'center', background: 'none', border: '0', padding: '4px 0', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ minWidth: '0' }}><span style={{ display: 'block', font: '500 13px Inter,sans-serif', color: '#111827', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span><span style={{ fontSize: '11px', color: '#9ca3af' }}>{c.dept || 'All departments'}</span></span>
                <span style={{ position: 'relative', height: '12px', background: 'rgba(118,118,128,.12)', borderRadius: '4px', overflow: 'hidden' }}><span style={{ position: 'absolute', left: '0', top: '0', bottom: '0', borderRadius: '4px', background: D.GAP[Math.round(c.avg)].bg, width: (c.avg / maxComp * 100) + '%' }}></span></span>
                <span style={{ font: "600 12.5px 'JetBrains Mono',monospace", color: '#374151', textAlign: 'right' }}>{c.avg.toFixed(1)}</span>
                <span style={{ fontSize: '11.5px', color: '#6b7280', textAlign: 'right' }}>{c.severe} of {c.n} at gap ≥ 3</span>
              </button>
            ))}
          </div> : <EmptyState title="No competency records" />}
        </Card>
        {/* ===== ANALYTICS · Gap distribution card ===== */}
        <Card title="Gap distribution" sub={recs.length + ' competency ratings · click a band'} style={{ flex: '2 1 340px' }}>
          <div style={{ display: 'flex', height: '26px', borderRadius: '6px', overflow: 'hidden', gap: '2px' }}>
            {D.GAP.filter(g => counts[g.n]).map(g => (
              <button key={g.n} type="button" title={g.label + ': ' + counts[g.n]} onClick={() => openRecords('Gap ' + g.n + ' · ' + g.label, staff, c => c.gap === g.n)} style={{ flex: counts[g.n], background: g.bg, color: g.fg, border: '0', cursor: 'pointer', font: '600 10.5px Inter,sans-serif', overflow: 'hidden', padding: '0' }}>{Math.round(counts[g.n] / recs.length * 100)}%</button>
            ))}
          </div>
          <div style={{ marginTop: '12px' }}><GapLegend D={D} counts={counts} onPick={n => openRecords('Gap ' + n + ' · ' + D.GAP[n].label, staff, c => c.gap === n)} /></div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '16px' }}>
            {D.GAP.slice(1).map(g => { const ppl = new Set(recs.filter(r => r.c.gap === g.n).map(r => r.s.id)).size; return (
              <button key={g.n} type="button" onClick={() => openRecords('Gap ' + g.n + ' · ' + g.label, staff, c => c.gap === g.n)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,.5)', border: '1px solid rgba(15,35,65,.07)', borderRadius: '10px', padding: '7px 10px', cursor: 'pointer', font: '500 12.5px Inter,sans-serif', color: '#374151' }}>
                <GapBadge gap={g.n} GAP={D.GAP} /><span>{ppl} staff · {counts[g.n] || 0} records</span>
              </button>); })}
          </div>
        </Card>
      </div>
    </>
  );
}

// ===== ANALYTICS · Departments tab (/analytics?tab=departments) =====
function Departments({ D, model, staff, dept, openStaff, title, desc, deptFilter }) {
  const rows = D.depts.filter(d => dept === ALL || d.name === dept).map(d => {
    const l = model.staff.filter(s => s.dept === d.name), done = l.filter(s => s.scored).length;
    return { name: d.name, hod: d.hod, list: l, staff: l.length, done, pct: l.length ? Math.round(done / l.length * 100) : 0, gap: avg(l.map(s => s.avgGap)), review: l.filter(s => s.status === 'Submitted' || s.status === 'Auto-scored').length };
  });
  return (
    <>
      {/* ===== ANALYTICS · Departments page header ===== */}
      <PageHeader title={title} description={desc} filters={<>{deptFilter}<span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>{rows.length} department{rows.length === 1 ? '' : 's'} · {staff.length} staff</span></>} />
      {/* ===== ANALYTICS · Departments table ===== */}
      <Card title="Departments at a glance" sub={CURRENT + ' · click a department to see its staff'} flush>
        <DataTable minWidth={720} rows={rows} rowKey={r => r.name} columns={[
          { key: 'name', label: 'Department', render: r => <button type="button" onClick={() => openStaff(r.name, r.list, r.hod ? 'HOD: ' + r.hod : undefined)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', textAlign: 'left', font: '500 13px Inter,sans-serif', color: '#127a42' }}>{r.name}</button> },
          { key: 'hod', label: 'Head of department', render: r => <span style={{ color: '#4b5563' }}>{r.hod || '—'}</span> },
          { key: 'staff', label: 'Staff', align: 'center' },
          { key: 'pct', label: 'Completion', render: r => <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '80px', height: '6px', borderRadius: '999px', background: '#eef0f3', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: r.pct + '%', background: '#0d3b2a' }}></span></span>{r.pct}% <span style={{ color: '#9ca3af' }}>({r.done}/{r.staff})</span></span> },
          { key: 'gap', label: 'Avg gap', render: r => <GapBadge gap={Math.round(r.gap)} GAP={D.GAP} note={r.gap.toFixed(1)} /> },
          { key: 'review', label: 'To review', align: 'center', render: r => r.review ? <Badge bg="#ffedd5" fg="#9a3412">{r.review}</Badge> : <span style={{ color: '#9ca3af' }}>0</span> }]} />
      </Card>
    </>
  );
}

// ===== TRAINING · Top Training Needs (/training?tab=top-needs) =====
// Only gaps of 3 or more count; rows ranked by number of staff, then by the largest gap.
function TopNeeds({ D, staff, scopeLabel, openRecords, go, title, desc, deptFilter }) {
  const byComp = {};
  staff.forEach(s => s.comps.filter(c => c.gap >= 3).forEach(c => {
    const e = byComp[c.id] = byComp[c.id] || { id: c.id, name: c.name, category: c.category, n: 0, depts: new Set(), worst: 0, tr: c.training };
    e.n++; e.depts.add(s.dept); e.worst = Math.max(e.worst, c.gap);
  }));
  const rows = Object.values(byComp).sort((a, b) => b.n - a.n || b.worst - a.worst);
  const people = new Set(staff.filter(s => s.comps.some(c => c.gap >= 3)).map(s => s.id)).size;
  return (
    <>
      {/* ===== TRAINING · Top needs page header ===== */}
      <PageHeader title={title} description={desc} filters={<>{deptFilter}<span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>{rows.length} competencies · {people} staff with a gap of 3 or more</span></>} />
      {/* ===== TRAINING · Top needs table ===== */}
      <Card title="Top training needs" sub={scopeLabel + ' · staff with a gap of 3 or more'} flush>
        <DataTable minWidth={720} rows={rows} rowKey={r => r.id} empty={<EmptyState icon="icon-graduation-cap" title="No intensive training needs" text="Nobody in scope has a gap of 3 or more." />} columns={[
          { key: 'name', label: 'Competency', render: r => <button type="button" onClick={() => openRecords(r.name, staff, x => x.id === r.id && x.gap >= 3, r.n + ' staff with a gap of 3 or more')} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', textAlign: 'left', font: '500 13px Inter,sans-serif', color: '#127a42' }}>{r.name}</button> },
          { key: 'tr', label: 'Recommended training', render: r => <span style={{ color: '#4b5563' }}>{r.tr ? r.tr.name : '—'}</span> },
          { key: 'depts', label: 'Departments', align: 'center', render: r => r.depts.size },
          { key: 'worst', label: 'Largest gap', render: r => <GapBadge gap={r.worst} GAP={D.GAP} /> },
          { key: 'n', label: 'Staff', align: 'center', render: r => <b style={{ font: "700 14px 'JetBrains Mono',monospace" }}>{r.n}</b> }]} />
      </Card>
    </>
  );
}

// ===== ANALYTICS · Heat grid (shared coloured grid) =====
// Each cell = average gap of the row's staff on the column's competencies; a striped cell means not assessed.
function HeatGrid({ D, rows, cols, onCell, onRow, onCol, labelW = 190 }) {
  if (!rows.length) return <EmptyState title="No data in scope" />;
  return (
    <div style={{ padding: '16px 20px 20px', overflowX: 'auto' }}>
      <div style={{ minWidth: Math.max(560, labelW + cols.length * 70) + 'px', display: 'grid', gridTemplateColumns: labelW + 'px repeat(' + cols.length + ',minmax(54px,1fr))', gap: '4px' }}>
        {/* ===== ANALYTICS · Heat grid column headers ===== */}
        <span></span>
        {cols.map(c => onCol ? <button key={c.key} type="button" onClick={() => onCol(c)} title={c.title || c.label} style={{ background: 'none', border: '0', cursor: 'pointer', font: '600 10px Inter,sans-serif', letterSpacing: '.3px', color: '#127a42', padding: '0 2px 6px', textTransform: 'uppercase', textAlign: 'left', alignSelf: 'end' }}>{c.label}</button>
          : <span key={c.key} style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', padding: '0 4px 6px', textTransform: 'uppercase', alignSelf: 'end' }}>{c.label}</span>)}
        {/* ===== ANALYTICS · Heat grid rows ===== */}
        {rows.map(r => (
          <React.Fragment key={r.key}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingRight: '8px', minWidth: '0' }}>
              {onRow ? <button type="button" onClick={() => onRow(r)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', textAlign: 'left', font: '500 13px Inter,sans-serif', color: '#127a42', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</button>
                : <span style={{ fontSize: '13px', fontWeight: '500' }}>{r.label}</span>}
              <span style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.sub}</span>
            </div>
            {cols.map(c => {
              const gaps = r.list.flatMap(s => s.comps.filter(c.pred).map(x => x.gap));
              if (!gaps.length) return <div key={c.key} style={{ height: '44px', borderRadius: '6px', background: 'repeating-linear-gradient(135deg,#f3f4f6 0 6px,#fff 6px 12px)' }} title="Not assessed on this"></div>;
              const v = avg(gaps), g = D.GAP[Math.round(v)];
              return <button key={c.key} type="button" onClick={() => onCell(r, c)} title={r.label + ' · ' + c.label + ': average gap ' + v.toFixed(1) + ' (' + g.label + ')'} style={{ height: '44px', borderRadius: '6px', cursor: 'pointer', font: '600 12px Inter,sans-serif', background: g.bg, color: g.fg, border: '0' }}>{gaps.length === 1 ? v : v.toFixed(1)}</button>;
            })}
          </React.Fragment>
        ))}
      </div>
      {/* ===== ANALYTICS · Heat grid legend ===== */}
      <div style={{ marginTop: '14px' }}><GapLegend D={D} /></div>
    </div>
  );
}

// ===== ANALYTICS · Heatmap tab (/analytics?tab=heatmap) =====
// All departments: department x category grid. One department chosen: person x competency grid.
function Heatmap({ D, model, staff, dept, scopeLabel, openRecords, go, title, desc, deptFilter, setLocal }) {
  const [catFilter, setCat] = useState(ALL);
  if (dept === ALL) {
    // ===== ANALYTICS · Heatmap · all departments view =====
    return (
      <>
        {/* ===== ANALYTICS · Heatmap page header ===== */}
        <PageHeader title={title} description={desc} filters={<>{deptFilter}<span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>{staff.length} staff · click a department name to open its competency view</span></>} />
        {/* ===== ANALYTICS · Department x category grid ===== */}
        <Card title="Average gap by department and skill category" sub="Click a cell to see the staff and competencies behind it" flush>
          <HeatGrid D={D} rows={D.depts.map(dp => { const list = model.staff.filter(s => s.dept === dp.name); return { key: dp.name, label: dp.name, sub: list.length + ' staff', list }; })}
            cols={D.categories.map(c => ({ key: c, label: c, pred: x => x.category === c }))}
            onCell={(r, c) => openRecords(c.label + ' · ' + r.label, r.list, c.pred, 'Average gap in this category')}
            onRow={setLocal ? r => setLocal(r.key) : null} />
        </Card>
      </>
    );
  }
  // ===== ANALYTICS · Heatmap · single department view =====
  const comps = D.framework.filter(c => (!c.dept || c.dept === dept) && (catFilter === ALL || c.category === catFilter));
  return (
    <>
      {/* ===== ANALYTICS · Heatmap page header + category filter ===== */}
      <PageHeader title={title} description={desc} filters={<>{deptFilter}<Sel value={catFilter} onChange={setCat} options={[[ALL, 'All categories'], ...D.categories.map(c => [c, c])]} /><span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>{staff.length} staff × {comps.length} competencies</span></>} />
      {/* ===== ANALYTICS · Person x competency grid ===== */}
      <Card title={dept + ' · gap per person and competency'} sub="Click a name for the individual report, a column for everyone on that competency, or a cell for that record" flush>
        <HeatGrid D={D} labelW={200} rows={[...staff].sort((a, b) => b.avgGap - a.avgGap).map(s => ({ key: s.id, label: s.name, sub: s.designation, list: [s] }))}
          cols={comps.map(c => ({ key: c.id, label: c.short, title: c.name, pred: x => x.id === c.id, name: c.name }))}
          onRow={r => go('report', null, r.key)}
          onCol={c => openRecords(c.name + ' · ' + dept, staff, c.pred)}
          onCell={(r, c) => openRecords(c.name + ' · ' + r.label, r.list, c.pred, dept)} />
      </Card>
    </>
  );
}

// ===== REPORTS · Report builder (/reports) =====
function Reports({ D, model, dept, go, title, desc, deptFilter, flash }) {
  // ===== REPORTS · Builder state =====
  const [rtype, setRtype] = useState('individual');
  const [pid, setPid] = useState(null);
  const [pq, setPq] = useState('');
  const [from, setFrom] = useState('2026-01-01');
  const [to, setTo] = useState('2026-12-31');
  const [band, setBand] = useState('All');
  const [evaluator, setEvaluator] = useState('All');
  const [status, setStatus] = useState('All');
  const [cols, setCols] = useState(['Staff ID', 'Name', 'Department', 'Competency', 'Target', 'Actual', 'Gap', 'Status']);
  const [fmt, setFmt] = useState('CSV');
  const [exportsList, setExports] = useState([{ fmt: 'PDF', name: 'Q3 2026 organisation summary', when: '30 Sep 2026' }, { fmt: 'XLSX', name: 'IT Department gap register', when: '18 Sep 2026' }]);
  // ===== REPORTS · Rows from filters =====
  const staff = inScope(model, dept);
  const picks = staff.filter(s => !pq.trim() || (s.name + ' ' + s.staffNo + ' ' + s.designation).toLowerCase().includes(pq.trim().toLowerCase()));
  const person = pid && staff.find(s => s.id === pid) ? pid : null;
  const rep = rtype === 'individual' && person ? individualReport(D, model, person) : null;
  const inBand = g => band === 'All' || (band === '0' && g === 0) || (band === '1-2' && g >= 1 && g <= 2) || (band === '3+' && g >= 3) || (band === '4+' && g >= 4);
  const rows = [];
  staff.forEach(s => {
    if (status !== 'All' && s.status !== status) return;
    s.comps.forEach(c => {
      // Result source: earlier cycle -> "Previous cycle"; adjusted by reviewer -> "Manager-adjusted"; confirmed -> "Manager-confirmed"; else "System".
      const ev = c.source !== CURRENT ? 'Previous cycle' : c.adjusted ? 'Manager-adjusted' : s.status === 'Confirmed' ? 'Manager-confirmed' : 'System';
      const date = c.source === CURRENT ? s.submittedIso : QDATE[c.source];
      if (!inBand(c.gap) || (evaluator !== 'All' && ev !== evaluator) || date < from || date > to) return;
      rows.push({ 'Staff ID': s.staffNo, Name: s.name, Department: s.dept, Designation: s.designation, Category: c.category, Competency: c.name, Target: c.target, Actual: c.actual, Gap: c.gap, Status: s.status, Evaluator: ev, Date: date, _gap: c.gap });
    });
  });
  let headers = RCOLS.filter(c => cols.includes(c)), out = rows;
  // Group summary: rows grouped by department + category with averages.
  if (rtype === 'summary') {
    const g = {};
    rows.forEach(r => { const k = r.Department + '|' + r.Category; (g[k] = g[k] || []).push(r); });
    out = Object.values(g).map(l => ({ Department: l[0].Department, Category: l[0].Category, Staff: new Set(l.map(r => r['Staff ID'])).size, Records: l.length, 'Avg target': avg(l.map(r => r.Target)).toFixed(1), 'Avg actual': avg(l.map(r => r.Actual)).toFixed(1), 'Avg gap': avg(l.map(r => r.Gap)).toFixed(1), 'Gaps ≥ 3': l.filter(r => r.Gap >= 3).length, _gap: Math.round(avg(l.map(r => r.Gap))) }))
      .sort((a, b) => a.Department.localeCompare(b.Department) || a.Category.localeCompare(b.Category));
    headers = SUMCOLS;
  }
  const label = rtype === 'individual' ? (rep ? 'Individual record · ' + rep.s.name : 'Individual record') : rtype === 'summary' ? 'Group summary' : 'Staff records';
  // ===== REPORTS · Export =====
  // CSV / Excel / JSON / XML download in the browser; PDF only shows a message (no file is made).
  const generate = () => {
    const stamp = new Date().toISOString().slice(0, 10);
    if (rtype === 'individual') {
      if (!rep) { flash('Pick a staff member first'); return; }
      if (fmt === 'PDF') { flash('PDF is being generated. It will appear in Recent exports.'); }
      else reportExport(rep, fmt, 'individual-record-' + slugify(rep.s.name) + '-' + stamp);
      setExports(e => [{ fmt: fmt === 'Excel' ? 'XLSX' : fmt, name: label, when: 'Just now' }, ...e].slice(0, 6));
      if (fmt !== 'PDF') flash(fmt + ' downloaded for ' + rep.s.name);
      return;
    }
    const name = 'skill-matrix-' + slugify(label) + '-' + slugify(dept) + '-' + stamp;
    const data = out.map(r => Object.fromEntries(headers.map(h => [h, r[h]])));
    if (fmt === 'CSV') download(name + '.csv', toCSV(headers, data), 'text/csv');
    else if (fmt === 'JSON') download(name + '.json', JSON.stringify({ report: label, department: dept === ALL ? 'All departments' : dept, generated: new Date().toISOString(), filters: { from, to, band, evaluator, status }, rows: data }, null, 2), 'application/json');
    else if (fmt === 'XML') download(name + '.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<report name="' + xmlEscape(label) + '" department="' + xmlEscape(dept === ALL ? 'All departments' : dept) + '">\n' + data.map(r => '  <row>' + headers.map(h => '<' + tag(h) + '>' + xmlEscape(r[h]) + '</' + tag(h) + '>').join('') + '</row>').join('\n') + '\n</report>', 'application/xml');
    else if (fmt === 'Excel') import('xlsx').then(X => { const ws = X.utils.json_to_sheet(data, { header: headers }); const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, ws, 'Report'); X.writeFile(wb, name + '.xlsx'); });
    setExports(e => [{ fmt: fmt === 'Excel' ? 'XLSX' : fmt, name: label + ' · ' + out.length + ' rows', when: 'Just now' }, ...e].slice(0, 6));
    flash(fmt === 'PDF' ? 'PDF is being generated. It will appear in Recent exports.' : fmt + ' downloaded (' + out.length + ' rows)');
  };
  // ===== REPORTS · Type switch & preview columns =====
  const seg = (v, l) => <button key={v} type="button" onClick={() => setRtype(v)} style={{ flex: '1', height: '30px', border: '0', borderRadius: '6px', cursor: 'pointer', font: '500 12.5px Inter,sans-serif', background: rtype === v ? '#fff' : 'transparent', color: rtype === v ? '#111827' : '#4b5563', whiteSpace: 'nowrap' }}>{l}</button>;
  const tableCols = headers.map(h => ({ key: h, label: h, render: h === 'Gap' || h === 'Avg gap' ? r => <GapBadge gap={r._gap} GAP={D.GAP} /> : h === 'Status' ? r => <StatusBadge status={r.Status} /> : h === 'Name' && rtype === 'records' ? r => <span>{r.Name}</span> : undefined }));
  // ===== REPORTS · Render =====
  return (
    <>
      {/* ===== REPORTS · Report builder page header ===== */}
      <PageHeader title={title} description={desc} actions={<Btn kind="primary" icon="icon-download" onClick={generate}>Export {fmt}</Btn>} filters={<>{deptFilter}<span style={{ fontSize: '12.5px', color: '#6b7280', marginLeft: 'auto' }}>{staff.length} staff in scope</span></>} />
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
        {/* ===== REPORTS · Build a report panel ===== */}
        <Card title="Build a report" style={{ flex: '1 1 320px', maxWidth: '420px' }} bodyStyle={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* ===== REPORTS · Report type switch ===== */}
          <div style={{ display: 'flex', background: 'rgba(118,118,128,.12)', borderRadius: '10px', padding: '3px', gap: '3px' }}>{seg('individual', 'Individual record')}{seg('records', 'Staff records')}{seg('summary', 'Group summary')}</div>
          {/* ===== REPORTS · Staff picker (individual) or filters (records / summary) ===== */}
          {rtype === 'individual' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>STAFF MEMBER</div>
              <Search value={pq} onChange={setPq} placeholder={'Search ' + staff.length + ' staff by name or ID'} style={{ flex: 'none' }} />
              <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid rgba(15,35,65,.08)', borderRadius: '12px', background: 'rgba(255,255,255,.6)' }}>
                {picks.length ? picks.map(s => (
                  <button key={s.id} type="button" onClick={() => setPid(s.id)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 12px', border: '0', borderBottom: '1px solid rgba(15,35,65,.05)', background: person === s.id ? '#e6f2ea' : 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                    <span style={{ minWidth: '0' }}><span style={{ display: 'block', font: '500 13px Inter,sans-serif', color: '#111827' }}>{s.name}</span><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{s.designation} · {s.dept}</span></span>
                    {person === s.id ? <i className="icon-check" style={{ color: '#15904c' }}></i> : null}
                  </button>)) : <EmptyState icon="icon-user-search" title="No staff match" />}
              </div>
            </div>
          ) : (
            <>
              {/* ===== REPORTS · Filters (date, gap band, source, status) ===== */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <Field label="FROM"><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={INPUT} /></Field>
                <Field label="TO"><input type="date" value={to} onChange={e => setTo(e.target.value)} style={INPUT} /></Field>
                <Field label="GAP BAND"><Sel value={band} onChange={setBand} options={[['All', 'All gaps'], ['0', '0 · No gap'], ['1-2', '1–2 · Minimal/Moderate'], ['3+', '3+ · Noticeable or worse'], ['4+', '4+ · Significant or critical']]} /></Field>
                <Field label="RESULT SOURCE"><Sel value={evaluator} onChange={setEvaluator} options={EVALUATORS} /></Field>
                <Field label="STATUS" style={{ gridColumn: 'span 2' }}><Sel value={status} onChange={setStatus} options={[['All', 'All statuses'], ...STATUSES]} /></Field>
              </div>
              {/* ===== REPORTS · Column picker (staff records only) ===== */}
              {rtype === 'records' ? <div>
                <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', marginBottom: '8px' }}>COLUMNS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                  {RCOLS.map(x => { const on = cols.includes(x); return <button key={x} type="button" onClick={() => setCols(on ? cols.filter(y => y !== x) : RCOLS.filter(y => y === x || cols.includes(y)))} style={{ height: '28px', padding: '0 10px', borderRadius: '999px', cursor: 'pointer', font: '500 12px Inter,sans-serif', background: on ? '#0d3b2a' : '#fff', color: on ? '#fff' : '#374151', border: '1px solid ' + (on ? '#0d3b2a' : 'rgba(15,35,65,.14)') }}>{x}</button>; })}
                </div>
              </div> : null}
            </>
          )}
          {/* ===== REPORTS · Format picker & export button ===== */}
          <div>
            <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', marginBottom: '8px' }}>FORMAT</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {['CSV', 'Excel', 'JSON', 'XML', 'PDF'].map(f => <button key={f} type="button" onClick={() => setFmt(f)} style={{ height: '30px', padding: '0 12px', borderRadius: '10px', cursor: 'pointer', font: '600 12px Inter,sans-serif', background: fmt === f ? '#e6f2ea' : '#fff', color: fmt === f ? '#0d3b2a' : '#4b5563', border: '1px solid ' + (fmt === f ? '#0d3b2a' : 'rgba(15,35,65,.14)') }}>{f}</button>)}
            </div>
          </div>
          <Btn kind="primary" icon="icon-download" onClick={generate}>Export {fmt}</Btn>
        </Card>
        {/* ===== REPORTS · Preview + recent exports column ===== */}
        <div style={{ flex: '2 1 520px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ===== REPORTS · Preview ===== */}
          {rtype === 'individual' ? (rep ? <IndividualReportView D={D} rep={rep} go={go} compact />
            : <Card title="Preview"><EmptyState icon="icon-user-search" title="Pick a staff member" text="The report covers only that person: their details, target profile, each competency's target, actual and gap, history across cycles and recommended trainings." /></Card>)
            : <Card title="Preview" sub={label + ' · exactly what will be exported'} actions={<span style={{ fontSize: '12.5px', color: '#6b7280' }}>{out.length} rows</span>} flush>
              <DataTable columns={tableCols} rows={out} maxHeight="560px" minWidth={Math.max(560, headers.length * 110)} empty={<EmptyState icon="icon-filter" title="No rows match" text="Widen the date range or clear a filter." />} />
            </Card>}
          {/* ===== REPORTS · Recent exports ===== */}
          <Card title="Recent exports" flush>
            {exportsList.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
                <span style={{ font: "700 10px 'JetBrains Mono',monospace", background: '#e6f2ea', color: '#0d3b2a', borderRadius: '6px', padding: '4px 7px' }}>{e.fmt}</span>
                <span style={{ flex: '1', fontSize: '13.5px', minWidth: '0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</span>
                <span style={{ fontSize: '12px', color: '#6b7280', whiteSpace: 'nowrap' }}>{e.when}</span>
              </div>))}
          </Card>
        </div>
      </div>
    </>
  );
}

// ===== REPORTS · Scheduled reports (/reports?tab=scheduled) =====
// Demo only: schedules live in component state; nothing is saved or emailed.
function Schedules({ title, desc, flash }) {
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ name: '', freq: 'Weekly', fmt: 'PDF', to: '' });
  const [list, setList] = useState([
    { id: 1, name: 'Weekly assessment completion', freq: 'Weekly', fmt: 'PDF', to: 'hr.director@dvla.gov.gh', next: 'Mon · 07:00', on: true },
    { id: 2, name: 'Monthly skills gap register', freq: 'Monthly', fmt: 'Excel', to: 'it.director@dvla.gov.gh, hr.director@dvla.gov.gh', next: '1st · 07:00', on: true },
    { id: 3, name: 'Daily training needs digest', freq: 'Daily', fmt: 'CSV', to: 'training.unit@dvla.gov.gh', next: 'Tomorrow · 06:00', on: false }]);
  const canSave = f.name.trim() && /@/.test(f.to);
  const save = () => { if (!canSave) { flash('Add a name and at least one email address'); return; }
    setList([...list, { id: Date.now(), name: f.name.trim(), freq: f.freq, fmt: f.fmt, to: f.to.trim(), next: { Daily: 'Tomorrow · 06:00', Weekly: 'Mon · 07:00', Monthly: '1st · 07:00' }[f.freq], on: true }]);
    setAdding(false); setF({ name: '', freq: 'Weekly', fmt: 'PDF', to: '' }); flash('Schedule created'); };
  return (
    <>
      {/* ===== REPORTS · Scheduled reports page header ===== */}
      <PageHeader title={title} description={desc} actions={<Btn kind="primary" icon="icon-plus" onClick={() => setAdding(!adding)}>New schedule</Btn>} />
      {/* ===== REPORTS · Scheduled reports list card ===== */}
      <Card title="Scheduled reports" sub={list.filter(x => x.on).length + ' of ' + list.length + ' active · sent by email'} flush>
        {/* ===== REPORTS · New schedule form ===== */}
        {adding ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end', padding: '16px 20px', background: 'rgba(255,255,255,.4)', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
            <Field label="REPORT NAME" style={{ flex: '2 1 220px' }}><input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Weekly completion summary" style={INPUT} /></Field>
            <Field label="FREQUENCY" style={{ flex: '1 1 140px' }}><Sel value={f.freq} onChange={v => setF({ ...f, freq: v })} options={['Daily', 'Weekly', 'Monthly']} /></Field>
            <Field label="FORMAT" style={{ flex: '1 1 110px' }}><Sel value={f.fmt} onChange={v => setF({ ...f, fmt: v })} options={['PDF', 'Excel', 'CSV']} /></Field>
            <Field label="RECIPIENTS" style={{ flex: '2 1 240px' }}><input value={f.to} onChange={e => setF({ ...f, to: e.target.value })} placeholder="name@dvla.gov.gh, …" style={INPUT} /></Field>
            <Btn kind="primary" onClick={save} disabled={!canSave}>Save</Btn>
          </div>) : null}
        {/* ===== REPORTS · Schedule rows (toggle / delete) ===== */}
        {list.length ? list.map(r => (
          <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '9px', background: '#e6f2ea', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className="icon-calendar-clock" style={{ fontSize: '17px' }}></i></span>
            <div style={{ flex: '2 1 220px', minWidth: '0' }}>
              <div style={{ fontSize: '14.5px', fontWeight: '500' }}>{r.name}</div>
              <div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '2px', overflowWrap: 'anywhere' }}>{r.freq} · {r.fmt} · {r.to}</div>
            </div>
            <div style={{ flex: '0 0 130px' }}><div style={{ font: '600 10px Inter,sans-serif', letterSpacing: '.5px', color: '#6b7280' }}>NEXT RUN</div><div style={{ fontSize: '13px', marginTop: '3px' }}>{r.on ? r.next : 'Paused'}</div></div>
            <Toggle on={r.on} onClick={() => setList(list.map(x => x.id === r.id ? { ...x, on: !x.on } : x))} label="" />
            <button type="button" onClick={() => setList(list.filter(x => x.id !== r.id))} title="Delete" style={{ background: 'none', border: '0', cursor: 'pointer', color: '#9ca3af', display: 'flex', padding: '4px' }}><i className="icon-trash-2" style={{ fontSize: '15px' }}></i></button>
          </div>)) : <EmptyState icon="icon-calendar-clock" title="No scheduled reports" text="Create one to email a report automatically." />}
      </Card>
    </>
  );
}
