'use client';
// =============================================================================
// SMPriorities.jsx · Development Priorities: the competencies with the most Critical and Moderate Gaps in scope,
//   the people who need development in each, and the ranked top training needs
// Screen / URL: /training (All Needs), /training?tab=top-needs (Top Training Needs)
// Who sees it: "Development priorities" (All Needs), "Top priorities" (Top Training Needs); "Export priorities"
//   shows the export buttons. Only people in the person's scope are counted.
// Used by: SkillMatrixApp.jsx (page "training", prop view = training | topneeds)
// Depends on: smUI.jsx, smApi.js, SMTeamResults.jsx (helpers), SMOrgDashboard.jsx (StackBar, gapParts, HBars),
//   lib/scoring.js; GET /api/dashboard/priorities, GET /api/dashboard/priorities/export, GET /api/lookups
// Sections (search for these markers): PRIORITIES · Screen, PRIORITIES · Filters, PRIORITIES · All needs,
//   PRIORITIES · Competency card, PRIORITIES · Top needs
// Ranking (same as the Reports gap analysis): most Critical Gaps, then most Moderate Gaps, then the lower average.
// =============================================================================
import React, { useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Badge, CompetencyBadge, GapStatusBadge, Avg, EmptyState, DataTable, KpiTile } from './smUI';
import { useLoad, qs } from './smApi';
import { GapCounts, pct, downloadFile, scopeDepartments, goTeam } from './SMTeamResults';
import { StackBar, gapParts, HBars } from './SMOrgDashboard';
import { GAP_COLOURS } from '../lib/scoring';

const opt = (list, all, label = x => x.name) => [['All', all], ...(list || []).map(x => [String(x.id), label(x)])];

// ===== PRIORITIES · Screen =====
export default function SMPriorities(S) {
  const top = S.view === 'topneeds';
  const [f, setF] = useState({ departmentId: 'All', gradeId: 'All', assessmentId: 'All' });
  const { data: d, error, loading } = useLoad('/api/dashboard/priorities' + qs({ ...f, view: top ? 'top' : undefined }));
  const lk = useLoad('/api/lookups').data;
  const perms = S.me?.perms || [];
  const set = k => v => setF(x => ({ ...x, [k]: v }));
  // ===== PRIORITIES · Filters =====
  const filters = <>
    <Sel value={f.departmentId} onChange={set('departmentId')} options={opt(scopeDepartments(S.me, lk?.departments), 'All departments in scope')} style={{ flex: '1 1 150px', maxWidth: '240px' }} />
    <Sel value={f.gradeId} onChange={set('gradeId')} options={opt(lk?.grades, 'All grades')} style={{ flex: '1 1 150px', maxWidth: '220px' }} />
    <Sel value={f.assessmentId} onChange={set('assessmentId')} options={opt(d?.assessments, 'All assessments', a => a.title)} style={{ flex: '1 1 150px', maxWidth: '300px' }} />
  </>;
  const actions = perms.includes('training.export') ? <>
    <Btn icon="icon-download" onClick={() => downloadFile('/api/dashboard/priorities/export' + qs({ ...f, format: 'csv' }), S.toast)}>Export CSV</Btn>
    <Btn icon="icon-file-spreadsheet" onClick={() => downloadFile('/api/dashboard/priorities/export' + qs({ ...f, format: 'xlsx' }), S.toast)}>Export Excel</Btn></> : null;
  const desc = top ? 'The biggest development needs across the departments you can see, ranked.' : 'Competencies with Critical and Moderate Gaps, and the people who need development in each.';
  return (
    <Page>
      <PageHeader title="Development Priorities" description={desc} actions={actions} filters={filters} />
      {error ? <Card><EmptyState icon="icon-circle-alert" title="Priorities could not be loaded" text={error} /></Card>
        : !d ? <Card><EmptyState icon="icon-loader" title="Loading priorities…" /></Card>
        : <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', opacity: loading ? 0.6 : 1 }}>{top ? <TopNeeds d={d} /> : <AllNeeds d={d} S={S} />}</div>}
    </Page>
  );
}

// ===== PRIORITIES · All needs =====
function AllNeeds({ d, S }) {
  const list = d.priorities;
  return <>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
      <KpiTile label="Competencies needing development" value={list.length} sub={d.noGap.length + ' with no gaps'} />
      <KpiTile label="People needing development" value={d.peopleNeeding} sub={'of ' + d.people + ' staff in scope'} />
      <KpiTile label="Critical Gap results" value={list.reduce((s, x) => s + x.critical, 0)} subColor="#b91c1c" sub="final average below 2.50" />
      <KpiTile label="Moderate Gap results" value={list.reduce((s, x) => s + x.moderate, 0)} sub="final average 2.50 to 4.99" />
    </div>
    {!list.length ? <Card><EmptyState icon="icon-award" title={d.noGap.length ? 'No development gaps' : 'No results yet'} text={d.noGap.length ? 'Everyone assessed is at the required level of 5.00 in every competency.' : 'Priorities appear once people in your scope complete assessments.'} /></Card>
      : list.map(c => <CompetencyCard key={c.competencyId} c={c} S={S} />)}
  </>;
}

// ===== PRIORITIES · Competency card =====
// Rank, group average, the Critical / Moderate / No Gap split and the people behind it (Critical first).
function CompetencyCard({ c, S }) {
  const [open, setOpen] = useState(c.rank <= 3);
  const perms = S.me?.perms || [], canOpen = perms.includes('staff-evals.report');
  return (
    <Card title={<span style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}><span style={{ width: '26px', height: '26px', borderRadius: '50%', background: c.critical ? GAP_COLOURS.CRITICAL[1] : GAP_COLOURS.MODERATE[1], color: c.critical ? GAP_COLOURS.CRITICAL[2] : GAP_COLOURS.MODERATE[2], display: 'inline-flex', alignItems: 'center', justifyContent: 'center', font: '700 12px Inter,sans-serif', flex: 'none' }}>{c.rank}</span>{c.name}</span>}
      sub={[c.category, c.group].filter(Boolean).join(' · ') + ' · ' + c.assessed + ' people assessed · group average ' + c.display}
      actions={<><GapStatusBadge gap={c.gapStatus} /><Btn small kind="ghost" icon={open ? 'icon-chevron-up' : 'icon-chevron-down'} onClick={() => setOpen(!open)}>{open ? 'Hide people' : c.needDevelopment + ' people'}</Btn></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <StackBar parts={gapParts(c)} />
        {open ? <DataTable minWidth={620} rowKey={p => p.id} rows={c.people} columns={[
          { key: 'name', label: 'Name', render: p => canOpen ? <button type="button" onClick={() => S.go('report', undefined, p.id)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{p.name}</button> : <b>{p.name}</b> },
          { key: 'department', label: 'Department', render: p => p.department || '—' },
          { key: 'grade', label: 'Grade', render: p => p.grade || '—' },
          { key: 'avg', label: 'Final average', align: 'center', render: p => <span title={p.attemptsIncluded + ' completed attempt(s)'}><Avg value={p.average} /></span> },
          { key: 'cs', label: 'Competency', render: p => <CompetencyBadge status={p.competencyStatus} /> },
          { key: 'gs', label: 'Gap', render: p => <GapStatusBadge gap={p.gapStatus} /> },
        ]} /> : null}
        {open && perms.includes('staff-evals.view') ? <div><Btn small kind="ghost" icon="icon-users" onClick={() => goTeam(S.go, { competencyId: String(c.competencyId), gap: c.critical ? 'CRITICAL' : 'MODERATE' })}>Open in Team Results</Btn></div> : null}
      </div>
    </Card>
  );
}

// ===== PRIORITIES · Top needs =====
function TopNeeds({ d }) {
  if (!d.top.length) return <Card><EmptyState icon="icon-trending-up" title="No training needs yet" text="Top needs appear once people in your scope complete assessments and show gaps." /></Card>;
  return <>
    <Card title="Top training needs" sub="Ranked by Critical Gaps, then Moderate Gaps, then the lower group average" flush>
      <DataTable minWidth={820} rowKey={r => r.competencyId} rows={d.top} columns={[
        { key: 'rank', label: '#', render: r => <b>{r.rank}</b> },
        { key: 'name', label: 'Competency', render: r => <div><div style={{ fontWeight: 600 }}>{r.name}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{[r.category, r.group].filter(Boolean).join(' · ')}</div></div> },
        { key: 'avg', label: 'Group average', align: 'center', render: r => <Avg value={r.average} /> },
        { key: 'gaps', label: 'Gaps', render: r => <GapCounts c={r} compact /> },
        { key: 'share', label: 'Share needing development', render: r => <div style={{ minWidth: '160px' }}><div style={{ fontSize: '12.5px', marginBottom: '4px' }}>{pct(r.needShare)} <span style={{ color: '#6b7280' }}>({r.needDevelopment} of {r.assessed})</span></div><StackBar parts={gapParts(r)} height={8} legend={false} /></div> },
      ]} />
    </Card>
    <div style={{ font: '600 16.5px Inter,sans-serif' }}>Biggest needs by department</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '16px' }}>
      {d.departments.map(g => <Card key={g.name} title={g.name} sub={g.people + ' staff'}>
        {g.top.length ? <HBars rows={g.top.map(t => ({ key: t.competencyId, label: t.rank + '. ' + t.name, sub: t.critical + ' Critical · ' + t.moderate + ' Moderate', value: t.needShare || 0, display: pct(t.needShare), color: t.critical ? GAP_COLOURS.CRITICAL[1] : GAP_COLOURS.MODERATE[1] }))} />
          : <EmptyState icon="icon-award" title="No gaps recorded" />}
        {g.top.length ? <div style={{ marginTop: '10px', fontSize: '11.5px', color: '#6b7280' }}>Bar = share of people assessed with a Critical or Moderate Gap.</div> : null}
      </Card>)}
    </div>
  </>;
}
