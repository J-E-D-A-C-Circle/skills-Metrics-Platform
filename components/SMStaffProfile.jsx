'use client';
// =============================================================================
// SMStaffProfile.jsx · Competency Profile: one staff member's details, final average per competency, gaps,
//   assessments with attempts remaining, and the full attempt history (printable)
// Screen / URL: /report?id=<staff record id>
// Who sees it: holders of "Open competency profiles" for people in their scope (the server answers 404 outside it)
// Used by: SkillMatrixApp.jsx (page "report"); ProfileKpis, ResultsTable, DevelopmentList and AssessmentHistory are
//   also used by SMProfile.jsx (My Profile)
// Depends on: smUI.jsx, smApi.js, SMTeamResults.jsx (ProgressBadge, GapCounts), SMOrgDashboard.jsx (StackBar,
//   gapParts), lib/scoring.js; GET /api/staff/:id
// Sections (search for these markers): PROFILE PARTS · Summary tiles, PROFILE PARTS · Results table,
//   PROFILE PARTS · Development priorities, PROFILE PARTS · Assessments & attempts, PROFILE · Screen,
//   PROFILE · Print styles
// =============================================================================
import React, { useState } from 'react';
import { Page, PageHeader, Card, Btn, Badge, CompetencyBadge, GapStatusBadge, Avg, EmptyState, DataTable, KpiTile } from './smUI';
import { useLoad, fmtDate, fmtDateTime, fmtDuration } from './smApi';
import { ProgressBadge } from './SMTeamResults';
import { StackBar, gapParts, statusParts } from './SMOrgDashboard';
import { formatAverage, GAP_COLOURS } from '../lib/scoring';

const ATTEMPT_LABEL = { IN_PROGRESS: ['In progress', '#fef3c7', '#92400e'], SUBMITTED: ['Submitted', '#e0e7ff', '#3730a3'], PENDING_MARKING: ['Pending marking', '#e0e7ff', '#3730a3'],
  COMPLETED: ['Completed', '#dcfce7', '#15803d'], ABANDONED: ['Abandoned', '#f3f4f6', '#4b5563'], EXPIRED: ['Expired', '#fee2e2', '#b91c1c'] };
const Info = ({ label, value }) => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: 0 }}><span style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{label}</span><span style={{ fontSize: '14px', color: value ? '#111827' : '#9ca3af', overflowWrap: 'anywhere' }}>{value || '—'}</span></div>;
export const InfoGrid = ({ items }) => <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(145px,1fr))', gap: '16px' }}>{items.map(([l, v]) => <Info key={l} label={l} value={v} />)}</div>;

// ===== PROFILE PARTS · Summary tiles =====
export function ProfileKpis({ p }) {
  const c = p.counts, done = p.completion;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '12px' }}>
      <KpiTile label="Competencies assessed" value={c.assessed} sub={c.assessed ? c.competent + c.proficient + ' Competent or better' : 'No results yet'} />
      <KpiTile label="Overall average" value={c.overallDisplay} sub="mean of competency final averages" />
      <KpiTile label="Critical Gaps" value={c.critical} sub="below 2.50" subColor={c.critical ? '#b91c1c' : undefined} />
      <KpiTile label="Moderate Gaps" value={c.moderate} sub="2.50 to 4.99" />
      <KpiTile label="Proficient (No Gap)" value={c.proficient} sub="final average 5.00" subColor={c.proficient ? '#15803d' : undefined} />
      <KpiTile label="Assessments completed" value={done.completed + ' / ' + done.assigned} sub={done.overdue ? done.overdue + ' overdue' : done.outstanding + ' outstanding'} subColor={done.overdue ? '#b91c1c' : undefined} />
    </div>
  );
}

// ===== PROFILE PARTS · Results table =====
// One row per competency: final average (all completed attempts), attempts included, status, gap and a bar.
export function ResultsTable({ results, empty }) {
  if (!results.length) return empty || <EmptyState icon="icon-chart-column" title="No competency results yet" text="Results appear once an assessment is completed (and released)." />;
  return <DataTable minWidth={760} rowKey={r => r.competency.id} rows={results} columns={[
    { key: 'name', label: 'Competency', render: r => <div><div style={{ fontWeight: 600 }}>{r.competency.name}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{[r.competency.category, r.competency.group].filter(Boolean).join(' · ')}</div></div> },
    { key: 'avg', label: 'Final average', render: r => <div style={{ minWidth: '130px' }}><Avg value={r.average} /><span style={{ fontSize: '11.5px', color: '#6b7280' }}> / 5</span>
      <div style={{ height: '6px', borderRadius: '999px', background: '#eef0f3', marginTop: '4px', overflow: 'hidden' }}><div style={{ width: (r.average / 5 * 100) + '%', height: '100%', background: GAP_COLOURS[r.gapStatus][1] }}></div></div></div> },
    { key: 'n', label: 'Attempts included', align: 'center', render: r => r.attemptsIncluded },
    { key: 'cs', label: 'Competency status', render: r => <CompetencyBadge status={r.competencyStatus} /> },
    { key: 'gs', label: 'Gap status', render: r => <GapStatusBadge gap={r.gapStatus} /> },
    { key: 'gap', label: 'Gap to 5.00', align: 'center', render: r => <span style={{ font: "600 12.5px 'JetBrains Mono',monospace" }}>{formatAverage(r.gap)}</span> },
  ]} />;
}

// ===== PROFILE PARTS · Development priorities =====
// Critical Gaps first, then Moderate, lowest average first.
export function DevelopmentList({ results }) {
  const list = results.filter(r => r.gapStatus !== 'NONE').sort((a, b) => (a.gapStatus === b.gapStatus ? 0 : a.gapStatus === 'CRITICAL' ? -1 : 1) || a.average - b.average);
  if (!results.length) return <EmptyState icon="icon-target" title="Nothing to prioritise yet" text="Development priorities come from completed assessments." />;
  if (!list.length) return <EmptyState icon="icon-award" title="No gaps" text="Every assessed competency is at the required level of 5.00." />;
  return <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>{list.slice(0, 8).map((r, i) =>
    <div key={r.competency.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 11px Inter,sans-serif', flex: 'none' }}>{i + 1}</span>
      <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: '13px', fontWeight: 500 }}>{r.competency.name}</span>
      <Avg value={r.average} /><GapStatusBadge gap={r.gapStatus} />
    </div>)}{list.length > 8 ? <div style={{ fontSize: '12px', color: '#6b7280' }}>and {list.length - 8} more in the table below</div> : null}</div>;
}

// ===== PROFILE PARTS · Assessments & attempts =====
// Each assessment: progress, deadline, attempts used / remaining, its final results, and every attempt on its own.
export function AssessmentHistory({ p, own }) {
  const [open, setOpen] = useState({});
  if (!p.assessments.length) return <Card><EmptyState icon="icon-clipboard-list" title="No assessments yet" text={own ? 'Assessments assigned to you will appear here.' : 'Nothing has been assigned to this person yet.'} /></Card>;
  return p.assessments.map(a => {
    const attempts = p.history.filter(h => h.assessmentId === a.id), isOpen = open[a.id] ?? true;
    return (
      <Card key={a.id} title={a.title} sub={(a.deadline ? 'Deadline ' + fmtDate(a.deadline) + ' · ' : '') + (a.maxAttempts ? a.used + ' of ' + a.maxAttempts + ' attempts used · ' + a.remaining + ' remaining' : a.used + ' attempts')}
        actions={<><ProgressBadge status={a.status} label={a.statusLabel} /><Btn small kind="ghost" icon={isOpen ? 'icon-chevron-up' : 'icon-chevron-down'} onClick={() => setOpen({ ...open, [a.id]: !isOpen })}>{isOpen ? 'Hide' : 'Show'}</Btn></>}>
        {isOpen ? <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {!a.released && a.completed ? <div style={{ fontSize: '13px', color: '#92400e', background: '#fef3c7', borderRadius: '10px', padding: '8px 12px' }}><i className="icon-clock" style={{ marginRight: '6px' }}></i>Results for this assessment have not been released yet.</div> : null}
          {a.results.length ? <div><div style={{ font: '600 12px Inter,sans-serif', color: '#374151', marginBottom: '6px' }}>Final results ({a.completed} completed attempt{a.completed === 1 ? '' : 's'} averaged)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{a.results.map(r => <Badge key={r.competency.id} bg={GAP_COLOURS[r.gapStatus][0]} fg={GAP_COLOURS[r.gapStatus][1]} title={r.competencyLabel + ' · ' + r.gapLabel}>{r.competency.short || r.competency.name}: {r.display} · {r.gapLabel}</Badge>)}</div></div> : null}
          {attempts.length ? <DataTable minWidth={720} rowKey={h => h.id} rows={attempts} columns={[
            { key: 'n', label: 'Attempt', render: h => <b>#{h.attemptNo}</b> },
            { key: 'v', label: 'Version', render: h => h.versionNo ? 'v' + h.versionNo : '—' },
            { key: 's', label: 'Status', render: h => { const x = ATTEMPT_LABEL[h.status] || [h.status]; return <Badge bg={x[1]} fg={x[2]}>{x[0]}</Badge>; } },
            { key: 'st', label: 'Started', render: h => fmtDateTime(h.startedAt) },
            { key: 'c', label: 'Completed', render: h => fmtDateTime(h.completedAt) },
            { key: 't', label: 'Active time', render: h => <span title={'Elapsed ' + fmtDuration(h.elapsedSeconds)}>{fmtDuration(h.activeSeconds)}</span> },
            { key: 'sc', label: 'Scores in this attempt', render: h => h.scores.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxWidth: '420px' }}>{h.scores.map(x => <Badge key={x.competency.id} title={x.competency.name + ': ' + x.correct + ' of ' + x.asked + ' correct'}>{x.competency.short || x.competency.name} {x.display}</Badge>)}</div>
              : <span style={{ fontSize: '12px', color: '#6b7280' }}>{h.status !== 'COMPLETED' ? 'Not counted (not completed)' : 'Not released yet'}</span> },
          ]} /> : <div style={{ fontSize: '13px', color: '#6b7280' }}>No attempts yet.</div>}
        </div> : null}
      </Card>
    );
  });
}

// ===== PROFILE · Screen =====
export default function SMStaffProfile({ id, go, me }) {
  const { data, error } = useLoad(id ? '/api/staff/' + encodeURIComponent(id) : null);
  const back = (me?.perms || []).includes('staff-evals.view') ? <Btn icon="icon-arrow-left" onClick={() => go('staff-evals')}>Team Results</Btn> : null;
  if (!id) return <Page><PageHeader title="Competency Profile" actions={back} /><Card><EmptyState icon="icon-user-search" title="No staff member chosen" text="Open someone from Team Results to see their competency profile." /></Card></Page>;
  if (!data) return <Page><PageHeader title="Competency Profile" actions={back} /><Card>{error ? <EmptyState icon="icon-circle-alert" title="This profile could not be opened" text={error} /> : <EmptyState icon="icon-loader" title="Loading profile…" />}</Card></Page>;
  const p = data.profile, s = p.staff;
  return (
    <Page>
      {/* ===== PROFILE · Print styles ===== */}
      <style>{'@media print { header, aside, nav, [data-noprint] { display: none !important; } body { background: #fff !important; } }'}</style>
      <PageHeader title={s.name} description={'Competency Profile · Staff ID ' + s.staffNo + (s.status !== 'ACTIVE' ? ' · ' + s.status : '')}
        actions={<span data-noprint style={{ display: 'flex', gap: '8px' }}>{back}<Btn icon="icon-printer" onClick={() => window.print()}>Print</Btn></span>} />
      <Card title="Details"><InfoGrid items={[['Staff ID', s.staffNo], ['Department', s.department], ['Grade', s.grade], ['Station', s.station], ['Location', s.location], ['Designation', s.designation], ['Supervisor / HoD', s.supervisor], ['Email', s.email]]} /></Card>
      <ProfileKpis p={p} />
      {p.results.length ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: '16px' }}>
        <Card title="Development priorities" sub="Critical Gaps first, then Moderate Gaps"><DevelopmentList results={p.results} /></Card>
        <Card title="Result overview" sub={p.results.length + ' competencies'}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><StackBar parts={gapParts(p.counts)} /><StackBar parts={statusParts(p.counts)} /></div>
        </Card>
      </div> : null}
      <Card title="Final result per competency" sub="Average of all completed attempts · two decimals · the unrounded value decides the status" flush><ResultsTable results={p.results} /></Card>
      <div style={{ font: '600 16.5px Inter,sans-serif', marginTop: '4px' }}>Assessments and attempt history</div>
      <AssessmentHistory p={p} own={data.own} />
    </Page>
  );
}
