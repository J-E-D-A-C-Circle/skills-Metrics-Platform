'use client';
// =============================================================================
// SMTeamResults.jsx · Team Results: everyone in the signed-in person's scope with progress, final averages,
//   Competent / Proficient and gap status, as a summary table or a staff × competency matrix
// Screen / URL: /staff-evals
// Who sees it: anyone with "View team results" (supervisors: their departments + direct reports; admins: everyone)
// Used by: SkillMatrixApp.jsx (page "staff-evals"); its small helpers (ProgressBadge, GapCounts, pct, goTeam,
//   downloadFile, scopeDepartments) are also used by SMDashboard, SMOrgDashboard, SMPriorities, SMStaffProfile
// Depends on: smUI.jsx, smApi.js, lib/scoring.js; GET /api/team, GET /api/team/export, GET /api/lookups
// Sections (search for these markers): TEAM · Shared helpers, TEAM · Filters, TEAM · Screen, TEAM · Summary tiles,
//   TEAM · Filter bar, TEAM · Summary table, TEAM · Matrix, TEAM · Paging
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Badge, CompetencyBadge, GapStatusBadge, Avg, EmptyState, DataTable, KpiTile, TH, TD } from '@/components/shared/smUI';
import { useLoad, qs, fmtDate } from '@/components/shared/smApi';
import { GAP_COLOURS, GAP_LABEL, formatAverage } from '@/lib/scoring';

// ===== TEAM · Shared helpers =====
// Progress status colours (same palette as lib/scoring.js) with a text label, never colour alone.
export const PROGRESS_C = { COMPLETED: ['#dcfce7', '#15803d', 'icon-circle-check'], IN_PROGRESS: ['#fef3c7', '#92400e', 'icon-loader'], NOT_STARTED: ['#f3f4f6', '#4b5563', 'icon-circle'],
  OVERDUE: ['#fee2e2', '#b91c1c', 'icon-clock-alert'], UPCOMING: ['#dbeafe', '#1d4ed8', 'icon-calendar'], NOT_ASSIGNED: ['#f3f4f6', '#6b7280', 'icon-minus'] };
export const PROGRESS_LABEL = { COMPLETED: 'Completed', IN_PROGRESS: 'In progress', NOT_STARTED: 'Not started', OVERDUE: 'Overdue', UPCOMING: 'Upcoming', NOT_ASSIGNED: 'Not assigned' };
export function ProgressBadge({ status, label }) {
  const c = PROGRESS_C[status] || PROGRESS_C.NOT_ASSIGNED;
  return <Badge bg={c[0]} fg={c[1]}><i className={c[2]} style={{ fontSize: '11px' }}></i>{label || PROGRESS_LABEL[status] || status}</Badge>;
}
export const pct = x => (x == null ? '—' : Math.round(x * 100) + '%');
// Critical / Moderate / No Gap counts as small labelled chips (zero counts are faded).
export function GapCounts({ c, compact }) {
  return <span style={{ display: 'inline-flex', gap: '4px', flexWrap: 'wrap' }}>{[['CRITICAL', c.critical], ['MODERATE', c.moderate], ['NONE', c.none]].map(([k, n]) =>
    <Badge key={k} bg={n ? GAP_COLOURS[k][1] : '#f9fafb'} fg={n ? GAP_COLOURS[k][2] : '#9ca3af'} title={GAP_LABEL[k]}>{n} {compact ? GAP_LABEL[k].split(' ')[0] : GAP_LABEL[k]}</Badge>)}</span>;
}
// Opens Team Results with filters already chosen (used by dashboard drill-downs).
export function goTeam(go, filters) { try { sessionStorage.setItem('skm-team-filter', JSON.stringify(filters || {})); } catch (e) {} go('staff-evals'); }
// Downloads a server export (keeps the session cookie; shows the server's message when it fails).
export async function downloadFile(path, toast) {
  try {
    const r = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
    if (!r.ok) { let m = 'The download failed. Please try again.'; try { m = (await r.json()).error || m; } catch (e) {} toast && toast(m); return; }
    const name = (/filename="([^"]+)"/.exec(r.headers.get('Content-Disposition') || '') || [])[1] || 'export';
    const a = document.createElement('a'); a.href = URL.createObjectURL(await r.blob()); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    toast && toast('Download started');
  } catch (e) { toast && toast('The download failed. Please try again.'); }
}
// Departments the person may pick: every department for scope "all", otherwise their own and chosen ones.
export function scopeDepartments(me, departments) {
  const list = (departments || []).filter(d => d.active !== false);
  if (!me || me.scope === 'all') return list;
  const names = new Set([me.dept, ...(me.depts || [])].filter(Boolean));
  return list.filter(d => names.has(d.name));
}
const opt = (list, all, label = x => x.name) => [['All', all], ...(list || []).map(x => [String(x.id), label(x)])];

// ===== TEAM · Filters =====
const EMPTY = { q: '', assessmentId: 'All', departmentId: 'All', gradeId: 'All', stationId: 'All', competencyId: 'All', status: 'All', gap: 'All' };
const STATUS_OPTS = [['All', 'Any progress'], ['NOT_STARTED', 'Not started'], ['IN_PROGRESS', 'In progress'], ['COMPLETED', 'Completed'], ['OVERDUE', 'Overdue'], ['UPCOMING', 'Upcoming'], ['NOT_ASSIGNED', 'Not assigned']];
const GAP_OPTS = [['All', 'Any gap status'], ['CRITICAL', 'Has a Critical Gap'], ['MODERATE', 'Has a Moderate Gap'], ['NONE', 'Has No Gap results'], ['NOT_ASSESSED', 'Not assessed yet']];

// ===== TEAM · Screen =====
export default function SMTeamResults({ me, go, vw, toast }) {
  const perms = (me && me.perms) || [];
  const [f, setF] = useState(() => { try { const x = JSON.parse(sessionStorage.getItem('skm-team-filter') || 'null'); sessionStorage.removeItem('skm-team-filter'); return x ? { ...EMPTY, ...x } : EMPTY; } catch (e) { return EMPTY; } });
  const [q, setQ] = useState(f.q);
  const [view, setView] = useState('summary');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState(25);
  useEffect(() => { const t = setTimeout(() => setF(x => (x.q === q ? x : { ...x, q })), 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { setPage(1); }, [f, pageSize]);
  const params = { ...f, sort: sort.key, dir: sort.dir };
  const { data, error, loading } = useLoad('/api/team' + qs({ ...params, page, pageSize }));
  const lk = useLoad('/api/lookups').data;
  const set = k => v => setF(x => ({ ...x, [k]: v }));
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
  const canOpen = perms.includes('staff-evals.report'), canExport = perms.includes('staff-evals.export');
  const comp = f.competencyId !== 'All' ? (lk?.competencies || []).find(c => String(c.id) === f.competencyId) : null;
  const filtered = Object.entries(f).some(([k, v]) => v !== EMPTY[k]);
  const s = data?.summary;
  const nameCell = r => canOpen
    ? <button type="button" onClick={() => go('report', undefined, r.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{r.name}</button>
    : <span style={{ fontWeight: 600 }}>{r.name}</span>;

  const cols = useMemo(() => [
    { key: 'staffNo', label: 'Staff ID', render: r => <span style={{ font: "500 12px 'JetBrains Mono',monospace", color: '#4b5563', whiteSpace: 'nowrap' }}>{r.staffNo}</span> },
    { key: 'name', label: 'Name', render: r => <div>{nameCell(r)}<div style={{ fontSize: '11.5px', color: '#6b7280' }}>{[r.grade, r.station].filter(Boolean).join(' · ') || '—'}</div></div> },
    { key: 'department', label: 'Department', render: r => r.department || '—' },
    { key: 'status', label: 'Progress', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-start' }}><ProgressBadge status={r.status} label={r.statusLabel} /><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.completed} of {r.assigned} completed{r.overdue ? ' · ' + r.overdue + ' overdue' : ''}</span></div> },
    { key: 'deadline', label: 'Next deadline', sortable: false, render: r => r.nextDeadline ? <span style={{ color: new Date(r.nextDeadline) < new Date() ? '#b91c1c' : '#374151' }}>{fmtDate(r.nextDeadline)}</span> : <span style={{ color: '#9ca3af' }}>—</span> },
    ...(comp ? [
      { key: 'competency', label: comp.short || comp.name, render: r => { const x = r.results[comp.id]; return x ? <Avg value={x.average} /> : <span style={{ color: '#6b7280', fontSize: '12px' }}>Not assessed</span>; } },
      { key: 'cstatus', label: 'Competency', sortable: false, render: r => <CompetencyBadge status={r.results[comp.id]?.competencyStatus} /> },
      { key: 'gstatus', label: 'Gap', sortable: false, render: r => <GapStatusBadge gap={r.results[comp.id]?.gapStatus} /> },
    ] : [
      { key: 'average', label: 'Overall average', align: 'center', render: r => r.counts.assessed ? <div title="Mean of this person's competency final averages"><Avg value={r.counts.overall} /><div style={{ fontSize: '11px', color: '#6b7280' }}>{r.counts.assessed} competencies</div></div> : <span style={{ color: '#6b7280', fontSize: '12px' }}>Not assessed</span> },
      { key: 'critical', label: 'Gaps', render: r => r.counts.assessed ? <GapCounts c={r.counts} compact /> : <span style={{ color: '#9ca3af' }}>—</span> },
      { key: 'proficient', label: 'Competent / Proficient', sortable: false, render: r => r.counts.assessed ? <span style={{ display: 'flex', flexDirection: 'column', fontSize: '12px', whiteSpace: 'nowrap' }}><span style={{ color: '#1d4ed8' }}>{r.counts.competent} Competent</span><b style={{ color: '#15803d' }}>{r.counts.proficient} Proficient</b></span> : <span style={{ color: '#9ca3af' }}>—</span> },
    ]),
  ], [comp, canOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Page>
      <PageHeader title="Team Results" description="Staff in the departments you can see: progress on assigned assessments, final averages (average of all completed attempts), competency and gap status."
        actions={canExport ? <>
          <Btn icon="icon-download" onClick={() => downloadFile('/api/team/export' + qs({ ...params, format: 'csv' }), toast)}>Export CSV</Btn>
          <Btn icon="icon-file-spreadsheet" onClick={() => downloadFile('/api/team/export' + qs({ ...params, format: 'xlsx' }), toast)}>Export Excel</Btn></> : null} />

      {/* ===== TEAM · Summary tiles ===== */}
      {s ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
        <KpiTile label="Staff" value={s.people} sub={s.peopleAssessed + ' with results'} />
        <KpiTile label="Completion rate" value={pct(s.completion.rate)} sub={s.completion.completed + ' of ' + s.completion.open + ' open assessments completed'} />
        <KpiTile label="Overdue" value={s.completion.overdue} sub="assessments past their deadline" subColor={s.completion.overdue ? '#b91c1c' : undefined} onClick={s.completion.overdue ? () => { setF({ ...EMPTY, status: 'OVERDUE' }); setQ(''); } : undefined} />
        <KpiTile label="People with a Critical Gap" value={s.peopleWithCritical} sub={s.results.critical + ' Critical Gap results'} subColor={s.peopleWithCritical ? '#b91c1c' : undefined} onClick={s.peopleWithCritical ? () => { setF({ ...EMPTY, gap: 'CRITICAL' }); setQ(''); } : undefined} />
        <KpiTile label="Team average" value={s.results.overallDisplay} sub="mean of every final average" />
      </div> : null}

      {/* ===== TEAM · Filter bar ===== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <Search value={q} onChange={setQ} placeholder="Search name, Staff ID or department" style={{ flex: '1 1 220px' }} />
        <Sel value={f.assessmentId} onChange={set('assessmentId')} options={opt(data?.assessments, 'All assessments', a => a.title)} style={{ flex: '1 1 150px', maxWidth: '260px' }} />
        <Sel value={f.departmentId} onChange={set('departmentId')} options={opt(scopeDepartments(me, lk?.departments), 'All departments')} style={{ flex: '1 1 150px', maxWidth: '220px' }} />
        <Sel value={f.gradeId} onChange={set('gradeId')} options={opt(lk?.grades, 'All grades')} style={{ flex: '1 1 150px', maxWidth: '200px' }} />
        <Sel value={f.stationId} onChange={set('stationId')} options={opt(lk?.stations, 'All stations')} style={{ flex: '1 1 150px', maxWidth: '200px' }} />
        <Sel value={f.competencyId} onChange={set('competencyId')} options={opt((lk?.competencies || []).filter(c => c.active !== false), 'All competencies')} style={{ flex: '1 1 150px', maxWidth: '240px' }} />
        <Sel value={f.status} onChange={set('status')} options={STATUS_OPTS} style={{ flex: '1 1 150px', maxWidth: '170px' }} />
        <Sel value={f.gap} onChange={set('gap')} options={GAP_OPTS} style={{ flex: '1 1 150px', maxWidth: '190px' }} />
        {filtered ? <Btn kind="ghost" icon="icon-x" onClick={() => { setF(EMPTY); setQ(''); }}>Clear filters</Btn> : null}
      </div>

      <Card title={view === 'summary' ? 'Staff' : 'Competency matrix'} sub={data ? data.total + ' staff match' + (filtered ? ' the filters' : '') : 'Loading…'} flush
        actions={<div role="tablist" style={{ display: 'flex', background: 'rgba(118,118,128,.12)', borderRadius: '10px', padding: '3px', gap: '3px' }}>
          {[['summary', 'Summary', 'icon-list'], ['matrix', 'Matrix', 'icon-grid-3x3']].map(([k, l, i]) => <button key={k} type="button" role="tab" aria-selected={view === k} onClick={() => setView(k)}
            style={{ border: 0, borderRadius: '7px', padding: '0 12px', height: '30px', cursor: 'pointer', font: '500 13px Inter,sans-serif', display: 'flex', alignItems: 'center', gap: '6px', background: view === k ? '#fff' : 'transparent', color: view === k ? '#111827' : '#4b5563', boxShadow: view === k ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}><i className={i}></i>{l}</button>)}
        </div>}>
        {error ? <EmptyState icon="icon-circle-alert" title="Team results could not be loaded" text={error} />
          : !data ? <EmptyState icon="icon-loader" title="Loading team results…" />
          : !data.rows.length ? <EmptyState icon="icon-users" title={filtered ? 'Nobody matches these filters' : 'No staff in your scope yet'} text={filtered ? 'Try clearing a filter or searching for someone else.' : 'Staff appear here once they are placed in a department you can see.'}
              action={filtered ? <Btn onClick={() => { setF(EMPTY); setQ(''); }}>Clear filters</Btn> : null} />
          : view === 'summary'
            /* ===== TEAM · Summary table ===== */
            ? <div style={{ opacity: loading ? 0.6 : 1 }}><DataTable columns={cols} rows={data.rows} sort={sort} onSort={onSort} minWidth={980} rowKey={r => r.id} /></div>
            : <Matrix rows={data.rows} comps={comp ? data.competencies.filter(c => c.id === comp.id) : data.competencies} nameCell={nameCell} loading={loading} />}
        {/* ===== TEAM · Paging ===== */}
        {data && data.total ? <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px 16px', borderTop: '1px solid rgba(15,35,65,.07)', fontSize: '12.5px', color: '#6b7280' }}>
          <span>Showing {(data.page - 1) * data.pageSize + 1}–{Math.min(data.total, data.page * data.pageSize)} of {data.total}</span>
          <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <Sel value={String(pageSize)} onChange={v => setPageSize(Number(v))} options={[['10', '10 per page'], ['25', '25 per page'], ['50', '50 per page'], ['100', '100 per page']]} style={{ width: '130px' }} />
            <Btn small icon="icon-chevron-left" disabled={data.page <= 1} onClick={() => setPage(data.page - 1)}>Previous</Btn>
            <span>Page {data.page} of {data.pages}</span>
            <Btn small disabled={data.page >= data.pages} onClick={() => setPage(data.page + 1)}>Next<i className="icon-chevron-right" style={{ fontSize: '13px' }}></i></Btn>
          </span>
        </div> : null}
      </Card>
      {vw < 720 ? null : <div style={{ fontSize: '12px', color: '#6b7280' }}>Final average = the average of every completed attempt for that competency (two decimals; the unrounded value decides the status). Competent from 4.00, Proficient at 5.00. Critical Gap below 2.50, Moderate Gap 2.50–4.99, No Gap at 5.00. “Not assessed” is never counted as 0.</div>}
    </Page>
  );
}

// ===== TEAM · Matrix =====
// One row per person, one column per competency with results; each cell shows the final average and its gap label.
function Matrix({ rows, comps, nameCell, loading }) {
  if (!comps.length) return <EmptyState icon="icon-grid-3x3" title="No competency results for these staff yet" text="Results appear once someone completes an assessment." />;
  return (
    <div style={{ overflow: 'auto', maxHeight: '70vh', opacity: loading ? 0.6 : 1 }}>
      <table style={{ borderCollapse: 'separate', borderSpacing: 0, font: '400 12.5px Inter,sans-serif', minWidth: '100%' }}>
        <thead><tr>
          <th style={{ ...TH, left: 0, zIndex: 2, minWidth: '180px' }}>Name</th>
          {comps.map(c => <th key={c.id} title={c.name} style={{ ...TH, textAlign: 'center', whiteSpace: 'normal', minWidth: '92px', maxWidth: '120px', textTransform: 'none', letterSpacing: 0, fontSize: '11px' }}>{c.short || c.name}</th>)}
        </tr></thead>
        <tbody>{rows.map(r => <tr key={r.id}>
          <td style={{ ...TD, position: 'sticky', left: 0, background: 'rgba(255,255,255,.96)', zIndex: 1 }}>{nameCell(r)}<div style={{ fontSize: '11px', color: '#6b7280' }}>{r.department || '—'}</div></td>
          {comps.map(c => { const x = r.results[c.id]; const col = x ? GAP_COLOURS[x.gapStatus] : null;
            return <td key={c.id} title={x ? c.name + ': ' + formatAverage(x.average) + ' · ' + GAP_LABEL[x.gapStatus] + ' · ' + x.attemptsIncluded + ' attempt(s)' : c.name + ': Not assessed'} style={{ ...TD, textAlign: 'center', padding: '6px' }}>
              {x ? <div style={{ background: col[1], color: col[2], borderRadius: '8px', padding: '4px 2px' }}><div style={{ font: "700 12.5px 'JetBrains Mono',monospace" }}>{formatAverage(x.average)}</div><div style={{ fontSize: '10px', fontWeight: 600 }}>{GAP_LABEL[x.gapStatus].replace(' Gap', '')}</div></div>
                : <span style={{ color: '#9ca3af', fontSize: '11px' }}>—</span>}</td>; })}
        </tr>)}</tbody>
      </table>
    </div>
  );
}
