'use client';
// =============================================================================
// SMReports.jsx · Reports: pick a report, filter it, read the summary and table, export to Excel, PDF or CSV
// Screen / URL: /reports
// Who sees it: anyone with "View reports" (reports.view); export buttons need reports.export. The administration
//   reports also need forms.view / forms.review / tickets.manage / org.view (the server decides and lists them).
// Used by: SkillMatrixApp.jsx (reports page)   Depends on: ./smUI, ./smApi, lib/scoring.js (labels),
//   GET /api/reports, /api/reports/staff, /api/reports/:key, /api/reports/:key/export, /api/lookups
// Sections (search for these markers): REPORTS · Helpers, REPORTS · Cell rendering, REPORTS · Page, REPORTS · State,
//   REPORTS · Loading, REPORTS · Export, REPORTS · Filter bar, REPORTS · Summary, REPORTS · Table & paging, REPORTS · Render
// Every number comes from the server (lib/server/reports.js); the exports are built by the same function, so
// what is on screen and what is downloaded always match. Missing results show "Not assessed", never 0.
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Badge, CompetencyBadge, GapStatusBadge, EmptyState, DataTable, KpiTile, INPUT, LABEL } from './smUI';
import { useLoad, qs, fmtDate, fmtDateTime } from './smApi';
import { COMPETENCY_LABEL, GAP_LABEL, COMPETENCY_COLOURS, GAP_COLOURS } from '../lib/scoring';

// ===== REPORTS · Helpers =====
const PAGE_SIZE = 25;
const ALLV = 'All';
const codeOf = (map, label) => (Object.entries(map).find(([, v]) => v === label) || [])[0] || null;
// Progress colours reuse the scoring palette: Completed green, In progress blue, Overdue red, others grey.
const PROGRESS_C = { Completed: COMPETENCY_COLOURS.PROFICIENT, 'In progress': COMPETENCY_COLOURS.COMPETENT, Overdue: GAP_COLOURS.CRITICAL };
const remember = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const recall = k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
const MONO = { font: "600 12.5px 'JetBrains Mono',monospace" };

// ===== REPORTS · Cell rendering =====
// The same meaning as cellText() on the server; labels get their coloured badge (always with the words).
function cell(c, v) {
  if (v == null || v === '') {
    if (c.type === 'comp') return <CompetencyBadge status={null} />;
    if (c.type === 'gapst') return <GapStatusBadge gap={null} />;
    return <span style={{ color: '#9ca3af' }}>{c.empty || '—'}</span>;
  }
  switch (c.type) {
    case 'avg': case 'num': return <span style={MONO}>{Number(v).toFixed(2)}</span>;
    case 'int': return <span style={MONO}>{v}</span>;
    case 'pct': return <span style={MONO}>{Number(v).toFixed(1)}%</span>;
    case 'date': return fmtDate(v);
    case 'datetime': return fmtDateTime(v);
    case 'comp': return <CompetencyBadge status={codeOf(COMPETENCY_LABEL, v)} />;
    case 'gapst': return <GapStatusBadge gap={codeOf(GAP_LABEL, v)} />;
    case 'progress': { const p = PROGRESS_C[v] || ['#f3f4f6', '#4b5563']; return <Badge bg={p[0]} fg={p[1]}>{v}</Badge>; }
    default: return <span style={{ fontSize: '12.5px' }}>{String(v)}</span>;
  }
}

// ===== REPORTS · Page =====
export default function SMReports({ me, vw, toast }) {
  // ===== REPORTS · State =====
  // key = chosen report (remembered in this browser); f = filter values; q = search; sort / page = table position.
  const [key, setKey] = useState(() => recall('skm-report-key'));
  const [f, setF] = useState({});
  const [q, setQ] = useState(''), [qd, setQd] = useState('');
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState('');
  useEffect(() => { const t = setTimeout(() => { setQd(q.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [q]);

  // ===== REPORTS · Loading =====
  const cat = useLoad('/api/reports'), look = useLoad('/api/lookups');
  const reports = cat.data ? cat.data.reports : [];
  const def = reports.find(r => r.key === key) || reports.find(r => r.key === 'final-averages') || reports.find(r => !r.needsStaff) || reports[0] || null;
  const has = k => !!def && def.filters.includes(k);
  const staff = useLoad(has('staff') ? '/api/reports/staff' : null);
  const params = useMemo(() => {
    if (!def) return null;
    const p = {};
    def.filters.forEach(k => { const v = f[k]; if (v && v !== ALLV) p[k === 'from' || k === 'to' || k === 'status' ? k : k + 'Id'] = v; });
    if (qd) p.q = qd;
    if (sort) { p.sort = sort.key; p.dir = sort.dir; }
    return p;
  }, [def, f, qd, sort]);
  const waitingForStaff = def && def.needsStaff && !(f.staff && f.staff !== ALLV);
  const rep = useLoad(def && !waitingForStaff ? '/api/reports/' + def.key + qs({ ...params, page, pageSize: PAGE_SIZE }) : null);
  const choose = k => { setKey(k); remember('skm-report-key', k); setSort(null); setPage(1); };
  const setFilter = (k, v) => { setF(x => ({ ...x, [k]: v })); setPage(1); };
  const clear = () => { setF({}); setQ(''); setSort(null); setPage(1); };
  const openProfile = staffId => { if (!reports.some(r => r.key === 'staff-profile')) return; setF({ staff: String(staffId) }); choose('staff-profile'); };

  // ===== REPORTS · Export =====
  // Fetches the file (so a refusal shows as a message, not a broken page) and saves it with the server's file name.
  const exportAs = async format => {
    setBusy(format);
    try {
      const r = await fetch('/api/reports/' + def.key + '/export' + qs({ ...params, format }), { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) { let m = 'The export could not be made. Please try again.'; try { m = (await r.json()).error || m; } catch (e) {} throw new Error(m); }
      const blob = await r.blob(), name = ((r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/) || [])[1] || def.key + '.' + format;
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      toast && toast('Downloaded ' + name);
    } catch (e) { toast && toast(e.message); }
    setBusy('');
  };

  // ===== REPORTS · Filter bar =====
  const L = look.data || {};
  const visibleDepts = useMemo(() => {
    const all = (L.departments || []).filter(d => d.active !== false);
    if (!me || me.scope === 'all') return all;
    const names = new Set([me.dept, ...(me.scope === 'some' ? me.depts || [] : [])].filter(Boolean));
    return all.filter(d => names.has(d.name));
  }, [L.departments, me]);
  const stations = (L.stations || []).filter(s => !f.location || f.location === ALLV || String(s.locationId) === f.location);
  const sel = (k, label, options) => has(k) ? (
    <label key={k} style={{ ...LABEL, flex: '1 1 140px', minWidth: '0' }}>{label}
      <Sel value={f[k] || ALLV} onChange={v => setFilter(k, v)} options={[[ALLV, k === 'staff' ? 'Choose a staff member' : 'All'], ...options]} style={{ width: '100%' }} /></label>) : null;
  const dateField = (k, label) => has(k) ? (
    <label key={k} style={{ ...LABEL, flex: '1 1 140px' }}>{label}
      <input type="date" value={f[k] || ''} onChange={e => setFilter(k, e.target.value)} style={{ ...INPUT, width: '100%' }} /></label>) : null;
  const filterBar = def ? (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'flex-end', width: '100%' }}>
      <label style={{ ...LABEL, flex: '2 1 260px', minWidth: '0' }}>REPORT
        <Sel value={def.key} onChange={choose} options={reports.map(r => ({ value: r.key, label: r.title, group: r.group }))} style={{ width: '100%' }} /></label>
      {sel('staff', 'STAFF MEMBER', ((staff.data && staff.data.staff) || []).map(s => [String(s.id), s.name + ' · ' + s.staffNo + (s.status !== 'ACTIVE' ? ' (' + s.status.toLowerCase() + ')' : '')]))}
      {sel('assessment', 'ASSESSMENT', ((cat.data && cat.data.assessments) || []).map(a => [String(a.id), a.title]))}
      {sel('competency', 'COMPETENCY', (L.competencies || []).map(c => [String(c.id), c.name]))}
      {sel('department', 'DEPARTMENT', visibleDepts.map(d => [String(d.id), d.name]))}
      {sel('grade', 'GRADE', (L.grades || []).map(g => [String(g.id), g.name]))}
      {sel('location', 'LOCATION', (L.locations || []).map(l => [String(l.id), l.name]))}
      {sel('station', 'STATION', stations.map(s => [String(s.id), s.name]))}
      {sel('status', 'STATUS', def.status)}
      {dateField('from', (def.dateLabel || 'Date').toUpperCase() + ' FROM')}
      {dateField('to', 'TO')}
      <Btn icon="icon-rotate-ccw" onClick={clear} title="Clear filters">Clear</Btn>
    </div>) : null;

  // ===== REPORTS · Summary =====
  const d = rep.data;
  const summary = d && d.summary.length ? (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(' + (vw < 520 ? 140 : 190) + 'px,1fr))', gap: '12px' }}>
      {d.summary.map(s => <KpiTile key={s.label} label={s.label} value={typeof s.value === 'number' ? s.value.toLocaleString('en-GB') : s.value} sub={s.sub} subColor={s.tone === 'bad' ? '#b91c1c' : undefined} />)}
    </div>) : null;

  // ===== REPORTS · Table & paging =====
  const columns = d ? d.columns.map(c => ({ key: c.key, label: c.label, align: ['int', 'avg', 'num', 'pct'].includes(c.type) ? 'right' : 'left',
    render: r => (c.key === 'name' && r.staffId && def.key !== 'staff-profile' && reports.some(x => x.key === 'staff-profile')
      ? <button type="button" onClick={() => openProfile(r.staffId)} title="Open this person's competency profile" style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{r.name}</button>
      : cell(c, r[c.key])) })) : [];
  const onSort = k => { setSort(s => (s && s.key === k ? { key: k, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key: k, dir: 'asc' })); setPage(1); };
  const from = d && d.total ? (d.page - 1) * d.pageSize + 1 : 0, to = d ? Math.min(d.total, d.page * d.pageSize) : 0;
  const canExport = !!(cat.data && cat.data.canExport);
  const exportBtns = def && canExport && !waitingForStaff ? (
    <>{[['xlsx', 'Excel', 'icon-file-spreadsheet'], ['pdf', 'PDF', 'icon-file-text'], ['csv', 'CSV', 'icon-download']].map(([fm, label, icon]) =>
      <Btn key={fm} small icon={icon} onClick={() => exportAs(fm)} disabled={!!busy || !d} title={'Export ' + label}>{busy === fm ? 'Preparing…' : label}</Btn>)}</>) : null;

  // ===== REPORTS · Render =====
  if (cat.error) return <Page><PageHeader title="Reports" /><Card><EmptyState icon="icon-lock" title="Reports are not available" text={cat.error} /></Card></Page>;
  if (cat.loading && !cat.data) return <Page><PageHeader title="Reports" /><Card><EmptyState icon="icon-loader" title="Loading reports…" /></Card></Page>;
  if (!def) return <Page><PageHeader title="Reports" /><Card><EmptyState icon="icon-file-spreadsheet" title="No reports for your account" text="Ask an administrator if you need access to reports." /></Card></Page>;
  return (
    <Page>
      <PageHeader title="Reports" description="Results, completion and administration reports for the staff you are allowed to see. Exports match the table exactly." filters={filterBar} />
      <div style={{ fontSize: '13px', color: '#4b5563', marginTop: '-6px' }}><b style={{ color: '#111827' }}>{def.title}.</b> {def.description}</div>
      {waitingForStaff ? <Card><EmptyState icon="icon-user-search" title="Choose a staff member" text="Pick someone from the Staff member list to see their competency profile." /></Card> : <>
        {summary}
        {d && (d.filtersUsed.length || d.notes.length) ? (
          <div style={{ fontSize: '12px', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {d.filtersUsed.length ? <div><b>Filters used:</b> {d.filtersUsed.map(([k, v]) => k + ': ' + v).join(' · ')}</div> : null}
            {d.notes.map(n => <div key={n}>{n}</div>)}
          </div>) : null}
        <Card title={def.title} sub={d ? (d.total ? 'Showing ' + from + '–' + to + ' of ' + d.total.toLocaleString('en-GB') + ' rows' : 'No rows') : rep.loading ? 'Loading…' : ''} actions={exportBtns} flush>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid rgba(15,35,65,.07)', display: 'flex', gap: '8px' }}>
            <Search value={q} onChange={setQ} placeholder="Search this report" />
          </div>
          {rep.error ? <EmptyState icon="icon-circle-alert" title="This report could not be loaded" text={rep.error} />
            : !d ? <EmptyState icon="icon-loader" title="Loading report…" />
            : <DataTable columns={columns} rows={d.rows} sort={sort} onSort={onSort} minWidth={Math.max(560, columns.length * 135)} rowKey={(r, i) => (d.page || 1) + ':' + i}
                empty={<EmptyState icon="icon-search-x" title="Nothing to show" text={qd ? 'No rows match your search.' : 'No records match these filters. Try widening them.'} />} />}
          {d && d.pages > 1 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px 14px', fontSize: '12.5px', color: '#6b7280' }}>
              <span>Page {d.page} of {d.pages}</span>
              <span style={{ display: 'flex', gap: '6px' }}>
                <Btn small icon="icon-chevron-left" onClick={() => setPage(d.page - 1)} disabled={d.page <= 1 || rep.loading}>Previous</Btn>
                <Btn small onClick={() => setPage(d.page + 1)} disabled={d.page >= d.pages || rep.loading}>Next<i className="icon-chevron-right" style={{ fontSize: '13px' }}></i></Btn>
              </span>
            </div>) : null}
        </Card>
      </>}
    </Page>
  );
}
