'use client';
// =============================================================================
// SMOrgDashboard.jsx · Dashboards: organisation / team overview, department comparison and the gap heatmap
// Screen / URL: /analytics (Overview), /analytics?tab=departments, /analytics?tab=heatmap
// Who sees it: "Organisation dashboard" / "Department breakdown" / "Gap heatmap" holders; figures cover only the
//   departments (and direct reports) the person can see
// Used by: SkillMatrixApp.jsx (page "analytics", prop view = dashboard | departments | heatmap); the chart helpers
//   (StackBar, HBars, TrendChart, gapParts) are also used by SMDashboard and SMPriorities
// Depends on: smUI.jsx, smApi.js, SMTeamResults.jsx (helpers), lib/scoring.js; GET /api/dashboard/org,
//   GET /api/dashboard/departments, GET /api/dashboard/heatmap, GET /api/team (heatmap drill-down), GET /api/lookups
// Sections (search for these markers): DASHBOARDS · Charts, DASHBOARDS · Screen, DASHBOARDS · Overview,
//   DASHBOARDS · Departments, DASHBOARDS · Heatmap, DASHBOARDS · Heatmap drill-down
// Charts are plain SVG / CSS (no chart package). Every coloured mark also carries a text label or number.
// =============================================================================
import React, { useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Badge, CompetencyBadge, GapStatusBadge, Avg, EmptyState, DataTable, KpiTile, Drawer, TH, TD } from '@/components/shared/smUI';
import { useLoad, qs, fmtDate } from '@/components/shared/smApi';
import { ProgressBadge, GapCounts, pct, goTeam, scopeDepartments } from '@/components/analytics/SMTeamResults';
import { GAP_COLOURS, GAP_LABEL, COMPETENCY_COLOURS, COMPETENCY_LABEL, formatAverage } from '@/lib/scoring';

// ===== DASHBOARDS · Charts =====
// A single bar split into parts [{ key, label, value, bg, fg }] with a legend of counts underneath.
export function StackBar({ parts, height = 14, legend = true }) {
  const total = parts.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div role="img" aria-label={parts.map(p => p.label + ' ' + p.value).join(', ')} style={{ display: 'flex', height: height + 'px', borderRadius: '999px', overflow: 'hidden', background: '#f3f4f6' }}>
        {total ? parts.filter(p => p.value).map(p => <div key={p.key} title={p.label + ': ' + p.value + ' (' + Math.round(p.value / total * 100) + '%)'} style={{ width: (p.value / total * 100) + '%', background: p.fg }} />) : null}
      </div>
      {legend ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12px', color: '#374151' }}>
        {parts.map(p => <span key={p.key} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: p.fg }}></span>{p.label} <b>{p.value}</b>{total ? <span style={{ color: '#6b7280' }}>({Math.round(p.value / total * 100)}%)</span> : null}</span>)}
      </div> : null}
    </div>
  );
}
export const gapParts = c => [['CRITICAL', c.critical], ['MODERATE', c.moderate], ['NONE', c.none]].map(([k, v]) => ({ key: k, label: GAP_LABEL[k], value: v || 0, bg: GAP_COLOURS[k][0], fg: GAP_COLOURS[k][1] }));
export const statusParts = c => [['NOT_COMPETENT', c.notCompetent], ['COMPETENT', c.competent], ['PROFICIENT', c.proficient]].map(([k, v]) => ({ key: k, label: COMPETENCY_LABEL[k], value: v || 0, bg: COMPETENCY_COLOURS[k][0], fg: COMPETENCY_COLOURS[k][1] }));
// Horizontal bars: rows [{ key, label, sub, value (0..max), display, color, onClick }].
export function HBars({ rows, max = 1, empty }) {
  if (!rows.length) return empty || <EmptyState title="Nothing to show yet" />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {rows.map(r => <button key={r.key} type="button" onClick={r.onClick} disabled={!r.onClick} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: '4px 10px', alignItems: 'center', background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: r.onClick ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.label}>{r.label}{r.sub ? <span style={{ color: '#6b7280', fontWeight: 400 }}> · {r.sub}</span> : null}</span>
        <span style={{ font: "600 12.5px 'JetBrains Mono',monospace" }}>{r.display}</span>
        <span style={{ gridColumn: '1 / -1', height: '8px', borderRadius: '999px', background: '#eef0f3', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: Math.max(0, Math.min(100, (r.value || 0) / max * 100)) + '%', background: r.color || '#2fb36b', borderRadius: '999px' }}></span></span>
      </button>)}
    </div>
  );
}
// Monthly trend: bars = completed attempts, line = mean competency score in those attempts (0–5).
export function TrendChart({ data }) {
  if (!data || !data.length) return <EmptyState icon="icon-chart-line" title="No completed attempts in the last 12 months" text="The trend appears once people complete assessments." />;
  const W = 560, H = 190, L = 34, R = 34, T = 14, B = 28, iw = W - L - R, ih = H - T - B, maxA = Math.max(...data.map(d => d.attempts), 1), bw = iw / data.length;
  const pts = data.map((d, i) => d.average == null ? null : [L + bw * i + bw / 2, T + ih - d.average / 5 * ih]).filter(Boolean);
  const mon = m => new Date(m + '-01T00:00:00').toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  return (
    <svg viewBox={'0 0 ' + W + ' ' + H} role="img" aria-label={'Completed attempts and mean score per month: ' + data.map(d => mon(d.month) + ' ' + d.attempts + ' attempts, mean ' + d.display).join('; ')} style={{ width: '100%', height: 'auto', font: '11px Inter,sans-serif' }}>
      {[0, 1, 2, 3, 4, 5].map(v => <g key={v}><line x1={L} x2={W - R} y1={T + ih - v / 5 * ih} y2={T + ih - v / 5 * ih} stroke="#eef0f3" /><text x={W - R + 6} y={T + ih - v / 5 * ih + 4} fill="#6b7280">{v}</text></g>)}
      <text x={4} y={T + 8} fill="#6b7280">{maxA}</text><text x={4} y={T + ih} fill="#6b7280">0</text>
      {data.map((d, i) => { const h = d.attempts / maxA * ih; return <g key={d.month}>
        <rect x={L + bw * i + bw * 0.2} y={T + ih - h} width={bw * 0.6} height={h} rx="4" fill="#bfe5cf"><title>{mon(d.month) + ': ' + d.attempts + ' completed attempts, mean score ' + d.display}</title></rect>
        <text x={L + bw * i + bw / 2} y={H - 8} textAnchor="middle" fill="#4b5563">{mon(d.month)}</text></g>; })}
      {pts.length > 1 ? <polyline points={pts.map(p => p.join(',')).join(' ')} fill="none" stroke="#15904c" strokeWidth="2.5" /> : null}
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="4" fill="#15904c" />)}
    </svg>
  );
}
const Legend = ({ items }) => <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', fontSize: '12px', color: '#374151' }}>{items.map(([c, l]) => <span key={l} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', background: c }}></span>{l}</span>)}</div>;
const opt = (list, all, label = x => x.name) => [['All', all], ...(list || []).map(x => [String(x.id), label(x)])];
const Loading = ({ error, what }) => error ? <Card><EmptyState icon="icon-circle-alert" title={what + ' could not be loaded'} text={error} /></Card> : <Card><EmptyState icon="icon-loader" title={'Loading ' + what.toLowerCase() + '…'} /></Card>;
const grid = min => ({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(' + min + ',1fr))', gap: '16px' });

// ===== DASHBOARDS · Screen =====
export default function SMOrgDashboard(S) {
  const v = S.view || 'dashboard';
  return v === 'departments' ? <Departments {...S} /> : v === 'heatmap' ? <Heatmap {...S} /> : <Overview {...S} />;
}

// ===== DASHBOARDS · Overview =====
function Overview({ me, go }) {
  const [f, setF] = useState({ departmentId: 'All', assessmentId: 'All' });
  const { data: d, error } = useLoad('/api/dashboard/org' + qs(f));
  const lk = useLoad('/api/lookups').data;
  const perms = me?.perms || [], canTeam = perms.includes('staff-evals.view');
  const team = x => canTeam ? () => goTeam(go, { ...x, ...(f.departmentId !== 'All' ? { departmentId: f.departmentId } : {}), ...(f.assessmentId !== 'All' ? { assessmentId: f.assessmentId } : {}) }) : undefined;
  const filters = <>
    <Sel value={f.departmentId} onChange={x => setF({ ...f, departmentId: x })} options={opt(scopeDepartments(me, lk?.departments), 'All departments in scope')} style={{ flex: '1 1 150px', maxWidth: '260px' }} />
    <Sel value={f.assessmentId} onChange={x => setF({ ...f, assessmentId: x })} options={opt(d?.assessments, 'All assessments', a => a.title)} style={{ flex: '1 1 150px', maxWidth: '300px' }} />
  </>;
  if (!d) return <Page><PageHeader title="Dashboards" filters={filters} /><Loading error={error} what="Dashboard" /></Page>;
  const s = d.summary, c = s.completion;
  return (
    <Page>
      <PageHeader title="Dashboards" description={me?.scope === 'all' ? 'Every department.' : 'The departments and direct reports you can see.'} filters={filters} />
      <div style={grid('170px')}>
        <KpiTile label="Staff" value={s.people} sub={s.peopleAssessed + ' with results'} onClick={team({})} />
        <KpiTile label="Completion rate" value={pct(c.rate)} sub={c.completed + ' of ' + c.open + ' open assessments'} />
        <KpiTile label="Outstanding" value={c.outstanding} sub={c.overdue + ' overdue'} subColor={c.overdue ? '#b91c1c' : undefined} onClick={c.overdue ? team({ status: 'OVERDUE' }) : undefined} />
        <KpiTile label="Critical Gaps" value={s.results.critical} sub={s.peopleWithCritical + ' people affected'} subColor={s.results.critical ? '#b91c1c' : undefined} onClick={s.peopleWithCritical ? team({ gap: 'CRITICAL' }) : undefined} />
        <KpiTile label="Proficient results" value={s.results.proficient} sub={'of ' + s.results.assessed + ' competency results'} />
        <KpiTile label="Overall average" value={s.overallDisplay} sub="mean of every final average" />
      </div>
      <div style={grid('320px')}>
        <Card title="Gap status" sub="Every person × competency final result">
          {s.results.assessed ? <StackBar parts={gapParts(s.results)} /> : <EmptyState title="No results yet" text="Results appear once people complete assessments." />}
        </Card>
        <Card title="Competent and Proficient" sub="Competent from 4.00 · Proficient at 5.00">
          {s.results.assessed ? <StackBar parts={statusParts(s.results)} /> : <EmptyState title="No results yet" />}
        </Card>
      </div>
      <div style={grid('360px')}>
        <Card title="Completion by assessment" sub="Completed ÷ assigned and open (start date reached)">
          <HBars rows={d.participation.map(a => ({ key: a.id, label: a.title, sub: a.completed + ' of ' + a.open + (a.overdue ? ' · ' + a.overdue + ' overdue' : ''), value: a.rate || 0, display: pct(a.rate), onClick: team({ assessmentId: String(a.id) }) }))}
            empty={<EmptyState icon="icon-calendar" title="No assessments assigned yet" />} />
        </Card>
        <Card title="Trend" sub="Per month: completed attempts (bars) and mean score in those attempts (line, 0–5)">
          <TrendChart data={d.trend} />
          {d.trend.length ? <Legend items={[['#bfe5cf', 'Completed attempts'], ['#15904c', 'Mean attempt score']]} /> : null}
        </Card>
      </div>
      <Card title="Gaps by competency" sub="Group average = mean of each person's final average · sorted by most Critical Gaps" flush>
        {d.competencies.length ? <DataTable minWidth={760} rowKey={r => r.competencyId}
          rows={[...d.competencies].sort((a, b) => b.critical - a.critical || b.moderate - a.moderate || (a.average ?? 9) - (b.average ?? 9))}
          columns={[
            { key: 'name', label: 'Competency', render: r => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.category}{r.group ? ' · ' + r.group : ''}</div></div> },
            { key: 'assessed', label: 'People', align: 'center' },
            { key: 'average', label: 'Average', align: 'center', render: r => <Avg value={r.average} /> },
            { key: 'gapStatus', label: 'Group status', render: r => <GapStatusBadge gap={r.gapStatus} /> },
            { key: 'split', label: 'Critical · Moderate · No Gap', render: r => <div style={{ minWidth: '220px' }}><StackBar parts={gapParts(r)} height={10} legend={false} /><div style={{ marginTop: '4px' }}><GapCounts c={r} compact /></div></div> },
          ]} /> : <EmptyState title="No competency results yet" />}
      </Card>
    </Page>
  );
}

// ===== DASHBOARDS · Departments =====
function Departments({ me, go, vw }) {
  const [assessmentId, setA] = useState('All');
  const { data: d, error } = useLoad('/api/dashboard/departments' + qs({ assessmentId }));
  const canTeam = (me?.perms || []).includes('staff-evals.view');
  const filters = <Sel value={assessmentId} onChange={setA} options={opt(d?.assessments, 'All assessments', a => a.title)} style={{ flex: '1 1 150px', maxWidth: '300px' }} />;
  if (!d) return <Page><PageHeader title="Dashboards" filters={filters} /><Loading error={error} what="Departments" /></Page>;
  const rows = d.departments;
  return (
    <Page>
      <PageHeader title="Dashboards" description="Departments side by side. Completion rate = completed ÷ assigned and open; averages are the mean of each person's final averages." filters={filters} />
      {!rows.length ? <Card><EmptyState icon="icon-building-2" title="No departments in your scope" /></Card> : <>
        <div style={grid('320px')}>
          <Card title="Completion rate"><HBars rows={rows.map(r => ({ key: r.name, label: r.name, sub: r.completion.completed + ' of ' + r.completion.open, value: r.completion.rate || 0, display: pct(r.completion.rate), onClick: canTeam && r.id ? () => goTeam(go, { departmentId: String(r.id) }) : undefined }))} /></Card>
          <Card title="Overall average" sub="Out of 5 · Competent from 4.00">
            <HBars max={5} rows={rows.map(r => ({ key: r.name, label: r.name, sub: r.peopleAssessed + ' assessed', value: r.results.overall || 0, display: r.overallDisplay, color: r.results.overall == null ? '#e5e7eb' : r.results.overall >= 4 ? '#1d4ed8' : '#b91c1c' }))} />
            <div style={{ marginTop: '10px' }}><Legend items={[['#1d4ed8', 'Competent or above (4.00+)'], ['#b91c1c', 'Below Competent']]} /></div>
          </Card>
        </div>
        <Card title="Department comparison" flush>
          <DataTable minWidth={980} rowKey={r => r.name} rows={[...rows, { ...d.total, name: 'All in scope', id: null, total: true }]}
            columns={[
              { key: 'name', label: 'Department', render: r => <b style={{ fontWeight: r.total ? 700 : 600 }}>{r.name}</b> },
              { key: 'people', label: 'Staff', align: 'center' },
              { key: 'rate', label: 'Completion', render: r => <span>{pct(r.completion.rate)} <span style={{ color: '#6b7280', fontSize: '12px' }}>({r.completion.completed}/{r.completion.open})</span></span> },
              { key: 'overdue', label: 'Overdue', align: 'center', render: r => r.completion.overdue ? <ProgressBadge status="OVERDUE" label={r.completion.overdue + ' overdue'} /> : '0' },
              { key: 'avg', label: 'Average', align: 'center', render: r => <Avg value={r.results.overall} /> },
              { key: 'gaps', label: 'Gap results', render: r => <GapCounts c={r.results} compact /> },
              { key: 'crit', label: 'People with a Critical Gap', align: 'center', render: r => r.peopleWithCritical },
              { key: 'prof', label: 'Proficient results', align: 'center', render: r => r.results.proficient },
            ]} />
        </Card>
        <Card title="Competency averages by department" sub="Mean of each person's final average · “—” = nobody assessed" flush>
          <HeatTable rows={rows.map(r => ({ id: r.id, name: r.name, people: r.people, overallDisplay: r.overallDisplay, cells: r.competencies }))} comps={d.competencies} vw={vw} />
        </Card>
      </>}
    </Page>
  );
}

// ===== DASHBOARDS · Heatmap =====
function Heatmap({ me, go, vw }) {
  const [f, setF] = useState({ by: 'department', assessmentId: 'All' });
  const [cell, setCell] = useState(null);
  const { data: d, error } = useLoad('/api/dashboard/heatmap' + qs(f));
  const canTeam = (me?.perms || []).includes('staff-evals.view');
  const filters = <>
    <Sel value={f.by} onChange={by => setF({ ...f, by })} options={[['department', 'By department'], ['grade', 'By grade'], ['station', 'By station']]} style={{ flex: '1 1 150px', maxWidth: '180px' }} />
    <Sel value={f.assessmentId} onChange={x => setF({ ...f, assessmentId: x })} options={opt(d?.assessments, 'All assessments', a => a.title)} style={{ flex: '1 1 150px', maxWidth: '300px' }} />
  </>;
  if (!d) return <Page><PageHeader title="Dashboards" filters={filters} /><Loading error={error} what="Heatmap" /></Page>;
  return (
    <Page>
      <PageHeader title="Dashboards" description="Average final result for each competency, coloured by gap status. Select a cell to see the people behind it." filters={filters} />
      <Card title={'Gap heatmap · by ' + d.by} sub={d.rows.length + (d.rows.length === 1 ? ' group · ' : ' groups · ') + d.competencies.length + ' competencies'} flush
        actions={<div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}><Legend items={[[GAP_COLOURS.CRITICAL[1], 'Critical Gap (below 2.50)'], [GAP_COLOURS.MODERATE[1], 'Moderate Gap (2.50–4.99)'], [GAP_COLOURS.NONE[1], 'No Gap (5.00)']]} /><span style={{ fontSize: '11.5px', color: '#6b7280' }}>Deeper shade = lower average · “crit” = people with a Critical Gap · “ppl” = people assessed</span></div>}>
        {d.rows.length && d.competencies.length ? <HeatTable rows={d.rows} comps={d.competencies} vw={vw} onCell={canTeam ? (r, c) => setCell({ r, c, by: d.by }) : undefined} />
          : <EmptyState icon="icon-grid-3x3" title="No results to map yet" text="The heatmap fills in once people in your scope complete assessments." />}
      </Card>
      {cell ? <CellDrawer cell={cell} assessmentId={f.assessmentId} go={go} canOpen={(me?.perms || []).includes('staff-evals.report')} onClose={() => setCell(null)} /> : null}
    </Page>
  );
}
// Cell background: the gap colour, deeper the lower the average sits inside its band (so averages that share a gap
// status can still be told apart). The number and the label carry the meaning; colour only supports them.
const BAND = { CRITICAL: [0, 2.5], MODERATE: [2.5, 5], NONE: [5, 5] };
function shade(x) {
  const [lo, hi] = BAND[x.gapStatus] || [0, 5], col = GAP_COLOURS[x.gapStatus];
  const t = hi > lo ? Math.max(0, Math.min(1, (hi - x.average) / (hi - lo))) : 0;
  return 'color-mix(in srgb, ' + col[1] + ' ' + Math.round(6 + t * 22) + '%, ' + col[0] + ')';
}
// Groups × competencies table; each cell shows the average, its gap label and how many people it covers.
function HeatTable({ rows, comps, onCell }) {
  return (
    <div style={{ overflow: 'auto', maxHeight: '72vh' }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, font: '400 12.5px Inter,sans-serif', minWidth: '100%' }}>
        <thead><tr><th style={{ ...TH, left: 0, zIndex: 2, minWidth: '170px' }}>Group</th>
          {comps.map(c => <th key={c.id} title={c.name} style={{ ...TH, textAlign: 'center', whiteSpace: 'normal', minWidth: '88px', maxWidth: '120px', textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>{c.short || c.name}</th>)}</tr></thead>
        <tbody>{rows.map(r => <tr key={r.name}>
          <td style={{ ...TD, position: 'sticky', left: 0, background: 'rgba(255,255,255,.96)', zIndex: 1 }}><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '11px', color: '#6b7280' }}>{r.people} staff · avg {r.overallDisplay}</div></td>
          {comps.map(c => { const x = r.cells[c.id]; const col = x && x.assessed ? GAP_COLOURS[x.gapStatus] : null;
            const tip = c.name + ' · ' + r.name + ': ' + (x && x.assessed ? formatAverage(x.average) + ' (' + GAP_LABEL[x.gapStatus] + ') · ' + x.assessed + ' people · ' + x.critical + ' Critical, ' + x.moderate + ' Moderate, ' + x.none + ' No Gap' : 'Not assessed');
            return <td key={c.id} style={{ ...TD, padding: '5px', textAlign: 'center' }}>
              {col ? <button type="button" title={tip} aria-label={tip} onClick={onCell ? () => onCell(r, c) : undefined} disabled={!onCell} style={{ width: '100%', border: 0, borderRadius: '8px', padding: '5px 2px', background: shade(x), color: col[1], cursor: onCell ? 'pointer' : 'default', font: 'inherit' }}>
                <div style={{ font: "700 12.5px 'JetBrains Mono',monospace" }}>{formatAverage(x.average)}</div><div style={{ fontSize: '10px', fontWeight: 600 }}>{GAP_LABEL[x.gapStatus].replace(' Gap', '')}</div><div style={{ fontSize: '9.5px', opacity: 0.85 }}>{x.critical ? x.critical + ' crit · ' : ''}{x.assessed} ppl</div></button>
                : <span title={tip} style={{ color: '#9ca3af', fontSize: '11px' }}>—</span>}</td>; })}
        </tr>)}</tbody>
      </table>
    </div>
  );
}

// ===== DASHBOARDS · Heatmap drill-down =====
// The people behind one cell, from GET /api/team (same scope rules), lowest result first.
function CellDrawer({ cell, assessmentId, go, canOpen, onClose }) {
  const key = { department: 'departmentId', grade: 'gradeId', station: 'stationId' }[cell.by];
  const { data, error } = useLoad('/api/team' + qs({ [key]: cell.r.id, competencyId: cell.c.id, assessmentId, pageSize: 100, sort: 'competency', dir: 'asc' }));
  const rows = (data?.rows || []).filter(r => r.results[cell.c.id]);
  return (
    <Drawer open title={cell.c.name} sub={cell.r.name + (data ? ' · ' + rows.length + ' people assessed' : '')} onClose={onClose} width={760}>
      {error ? <EmptyState icon="icon-circle-alert" title="Could not load the people" text={error} /> : !data ? <EmptyState icon="icon-loader" title="Loading…" />
        : <DataTable minWidth={560} rowKey={r => r.id} rows={rows} empty={<EmptyState icon="icon-users" title="Nobody assessed in this group" />}
          columns={[
            { key: 'name', label: 'Name', render: r => canOpen ? <button type="button" onClick={() => { onClose(); go('report', undefined, r.id); }} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{r.name}</button> : r.name },
            { key: 'department', label: 'Department' },
            { key: 'avg', label: 'Final average', align: 'center', render: r => <Avg value={r.results[cell.c.id].average} /> },
            { key: 'cs', label: 'Competency', render: r => <CompetencyBadge status={r.results[cell.c.id].competencyStatus} /> },
            { key: 'gs', label: 'Gap', render: r => <GapStatusBadge gap={r.results[cell.c.id].gapStatus} /> },
          ]} />}
    </Drawer>
  );
}
