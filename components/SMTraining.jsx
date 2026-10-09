'use client';
import React, { useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Badge, GapBadge, StatusBadge, EmptyState, DataTable, KpiTile, Toast, ScopeSelect, download, toCSV, slugify } from './smUI';
import { ALL, inScope } from './smModel';

// Who needs which training, grouped by competency or by person.
export default function SMTraining({ data: D, model, go, role, scope, myDept }) {
  const [local, setLocal] = useState(null);
  const locked = role === 'manager';
  const dept = locked ? myDept : (local ?? scope);
  const [mode, setMode] = useState('comp');
  const [minGap, setMinGap] = useState('1');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const [toast, setToast] = useState('');
  const staff = useMemo(() => inScope(model, dept), [model, dept]);
  const mg = +minGap, t = q.trim().toLowerCase();
  const recs = [];
  staff.forEach(s => s.comps.forEach(c => { if (c.gap >= mg) recs.push({ s, c }); }));
  const byComp = {};
  recs.forEach(r => { const k = r.c.id; (byComp[k] = byComp[k] || { id: k, name: r.c.name, category: r.c.category, importance: r.c.importance, dept: model.compById[k].dept, list: [] }).list.push(r); });
  const compRows = Object.values(byComp).map(g => ({ ...g, bands: [1, 2, 3, 4, 5].map(n => g.list.filter(r => r.c.gap === n).length), score: g.list.reduce((a, r) => a + r.c.priority, 0), tr: D.training[g.id] }))
    .filter(g => !t || (g.name + ' ' + g.tr.primary.name + ' ' + g.category).toLowerCase().includes(t))
    .sort((a, b) => b.score - a.score);
  const staffRows = staff.map(s => ({ s, needs: s.comps.filter(c => c.gap >= mg).sort((a, b) => b.priority - a.priority || b.gap - a.gap) }))
    .filter(x => x.needs.length && (!t || (x.s.name + ' ' + x.s.designation + ' ' + x.needs.map(n => n.training.name + ' ' + n.name).join(' ')).toLowerCase().includes(t)))
    .sort((a, b) => b.needs[0].priority - a.needs[0].priority || b.needs.length - a.needs.length);
  const people = new Set(recs.map(r => r.s.id)).size, intensive = recs.filter(r => r.c.gap >= 3).length, programmes = new Set(recs.map(r => r.c.training.name)).size;
  const flash = m => { setToast(m); setTimeout(() => setToast(''), 2400); };
  const exportCsv = () => {
    const H = ['Competency', 'Category', 'Staff', 'Staff ID', 'Department', 'Role', 'Target', 'Actual', 'Gap', 'Gap band', 'Importance', 'Priority', 'Recommended training', 'Provider', 'Mode'];
    const src = mode === 'comp' ? compRows.flatMap(g => g.list) : staffRows.flatMap(x => x.needs.map(c => ({ s: x.s, c })));
    const rows = src.map(({ s, c }) => ({ Competency: c.name, Category: c.category, Staff: s.name, 'Staff ID': s.staffNo, Department: s.dept, Role: s.designation, Target: c.target, Actual: c.actual, Gap: c.gap, 'Gap band': D.GAP[c.gap].label, Importance: c.importance, Priority: c.priority, 'Recommended training': c.training.name, Provider: c.training.provider, Mode: c.training.mode }));
    download('training-needs-' + (mode === 'comp' ? 'by-competency' : 'by-staff') + '-' + slugify(dept) + '.csv', toCSV(H, rows), 'text/csv');
    flash('CSV downloaded (' + rows.length + ' rows)');
  };
  const nameBtn = s => <button type="button" onClick={() => go('report', null, s.id)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{s.name}</button>;
  const seg = (v, l, icon) => <button key={v} type="button" onClick={() => setMode(v)} style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '30px', padding: '0 12px', border: '0', borderRadius: '7px', cursor: 'pointer', font: '500 12.5px Inter,sans-serif', background: mode === v ? '#fff' : 'transparent', color: mode === v ? '#111827' : '#4b5563' }}><i className={icon} style={{ fontSize: '13px' }}></i>{l}</button>;
  return (
    <Page>
      <PageHeader title="Training Needs" description="Who needs which training, ranked by gap severity × how important the skill is to the role"
        actions={<Btn kind="primary" icon="icon-download" onClick={exportCsv}>Export CSV</Btn>}
        filters={<>
          <ScopeSelect depts={D.depts} value={dept} globalValue={scope} onChange={setLocal} locked={locked} />
          <div style={{ display: 'flex', background: 'rgba(118,118,128,.12)', borderRadius: '10px', padding: '3px', gap: '3px' }}>{seg('comp', 'By competency', 'icon-layers')}{seg('staff', 'By staff', 'icon-users')}</div>
          <Sel value={minGap} onChange={setMinGap} options={[['1', 'Any gap (1–5)'], ['2', 'Gap 2 or more'], ['3', 'Gap 3 or more'], ['4', 'Gap 4 or more']]} />
          <Search value={q} onChange={setQ} placeholder={mode === 'comp' ? 'Search competency or programme' : 'Search staff or training'} />
        </>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
        <KpiTile label="Staff needing training" value={people} sub={'of ' + staff.length + ' in scope'} />
        <KpiTile label="Training needs" value={recs.length} sub="person × competency" />
        <KpiTile label="Intensive programmes" value={intensive} sub="gap 3 or more" subColor="#b45309" />
        <KpiTile label="Distinct programmes" value={programmes} sub="across the catalogue" />
      </div>
      {mode === 'comp' ? (
        <Card title="By competency" sub="Click a competency to see exactly who needs it" flush>
          {compRows.length ? compRows.map(g => { const on = !!open[g.id], total = g.list.length; return (
            <div key={g.id} style={{ borderBottom: '1px solid rgba(15,35,65,.07)' }}>
              <button type="button" onClick={() => setOpen({ ...open, [g.id]: !on })} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', padding: '14px 20px', background: on ? 'rgba(230,242,234,.5)' : 'transparent', border: '0', cursor: 'pointer', textAlign: 'left' }}>
                <i className={on ? 'icon-chevron-down' : 'icon-chevron-right'} style={{ fontSize: '15px', color: '#6b7280' }}></i>
                <div style={{ flex: '2 1 220px', minWidth: '0' }}>
                  <div style={{ fontSize: '14.5px', fontWeight: '600', color: '#111827' }}>{g.name}</div>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{g.category} · {g.dept || 'All departments'} · importance {g.importance}</div>
                </div>
                <div style={{ flex: '1 1 170px', minWidth: '0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '600', color: '#111827' }}>{total} staff</div>
                  <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', gap: '2px', marginTop: '5px' }}>{g.bands.map((n, i) => n ? <span key={i} title={n + ' at gap ' + (i + 1) + ' · ' + D.GAP[i + 1].label} style={{ flex: n, background: D.GAP[i + 1].bg }}></span> : null)}</div>
                  <div style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>{g.bands.map((n, i) => n ? (i + 1) + ': ' + n : null).filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ flex: '2 1 260px', minWidth: '0' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#111827' }}><i className="icon-graduation-cap" style={{ fontSize: '13px', color: '#15904c', marginRight: '6px' }}></i>{g.tr.primary.name}</div>
                  <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px' }}>{g.tr.primary.provider}{g.tr.primary.days ? ' · ' + g.tr.primary.days + ' days' : ''} · {g.tr.primary.mode} · for gap ≥ 3 (noticeable or worse). Smaller gaps: coached practice.</div>
                </div>
              </button>
              {on ? <div style={{ padding: '0 0 6px' }}>
                <DataTable minWidth={760} rows={[...g.list].sort((a, b) => b.c.gap - a.c.gap)} rowKey={r => r.s.id} columns={[
                  { key: 'name', label: 'Staff', render: r => nameBtn(r.s) }, { key: 'dept', label: 'Department', render: r => r.s.dept }, { key: 'role', label: 'Role', render: r => r.s.designation },
                  { key: 't', label: 'Target', align: 'center', render: r => r.c.target }, { key: 'a', label: 'Actual', align: 'center', render: r => r.c.actual },
                  { key: 'gap', label: 'Gap', render: r => <GapBadge gap={r.c.gap} GAP={D.GAP} /> }, { key: 'st', label: 'Status', render: r => <StatusBadge status={r.s.status} /> },
                  { key: 'tr', label: 'Recommended', render: r => <span style={{ fontSize: '12.5px' }}>{r.c.training.name}</span> }]} />
              </div> : null}
            </div>); }) : <EmptyState icon="icon-graduation-cap" title="No training needs" text="Nobody in scope has a gap at this level." />}
        </Card>
      ) : (
        <Card title="By staff" sub="Each person's trainings, most urgent first (gap × importance)" flush>
          <DataTable minWidth={900} rows={staffRows} rowKey={x => x.s.id} empty={<EmptyState icon="icon-users" title="No staff need training at this level" />} columns={[
            { key: 'name', label: 'Staff', render: x => <div>{nameBtn(x.s)}<div style={{ fontSize: '11.5px', color: '#6b7280' }}>{x.s.designation}</div></div> },
            { key: 'dept', label: 'Department', render: x => x.s.dept },
            { key: 'n', label: 'Needs', align: 'center', render: x => <b>{x.needs.length}</b> },
            { key: 'list', label: 'Trainings, in priority order', render: x => <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>{x.needs.slice(0, 4).map((c, i) => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12.5px' }}><span style={{ font: "700 10.5px 'JetBrains Mono',monospace", color: '#9ca3af', width: '14px' }}>{i + 1}</span><GapBadge gap={c.gap} GAP={D.GAP} /><span>{c.training.name}</span><span style={{ color: '#9ca3af' }}>· {c.short}</span></div>))}
              {x.needs.length > 4 ? <button type="button" onClick={() => go('report', null, x.s.id)} style={{ alignSelf: 'flex-start', background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '500 12px Inter,sans-serif' }}>+{x.needs.length - 4} more in the report</button> : null}</div> },
          ]} />
        </Card>
      )}
      <Toast text={toast} />
    </Page>
  );
}
