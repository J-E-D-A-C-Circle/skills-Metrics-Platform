'use client';
// =============================================================================
// SMMyAssessments.jsx · My Assessments: what is assigned to me, dates, attempts used / remaining, history, results
// Screen / URL: /assessments (sidebar "My Assessments")
// Who sees it: anyone with "Take assessments" (staff, supervisors). Administrators never (no assessments.view)
// Used by: components/SkillMatrixApp.jsx (page "assessments")
// Depends on: smUI.jsx, smApi.js, SMTake.jsx (ResultsPanel, AttemptStatusBadge); GET /api/my/assessments,
//   GET /api/my/assessments/:id
// Sections (search for these markers): MY ASSESSMENTS · Labels, MY ASSESSMENTS · Screen, MY ASSESSMENTS · Summary tiles,
//   MY ASSESSMENTS · Filters, MY ASSESSMENTS · Assessment card, MY ASSESSMENTS · Attempt history,
//   MY ASSESSMENTS · Results drawer
// Start / Resume / Retake open the full-screen Take page (/take?id=). Buttons only show when the server says the
// action is allowed; the server checks again when it is pressed.
// =============================================================================
import React, { useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Badge, Sel, Search, EmptyState, KpiTile, Drawer, DataTable } from '@/components/shared/smUI';
import { api, useLoad, fmtDate, fmtDateTime, fmtDuration } from '@/components/shared/smApi';
import { ResultsPanel, AttemptStatusBadge } from '@/components/participant/SMTake';

// ===== MY ASSESSMENTS · Labels =====
// Progress status (lib/server/assigned.js progressStatus) with colour and text.
const PROGRESS = {
  UPCOMING: ['Upcoming', '#e0f2fe', '#075985'], NOT_STARTED: ['Not started', '#f3f4f6', '#374151'], IN_PROGRESS: ['In progress', '#fef3c7', '#92400e'],
  COMPLETED: ['Completed', '#dcfce7', '#15803d'], OVERDUE: ['Overdue', '#fee2e2', '#b91c1c'],
};
const ProgressBadge = ({ item }) => { const p = item.unassigned ? ['No longer assigned', '#f3f4f6', '#6b7280'] : PROGRESS[item.progress] || [item.progressLabel, '#f3f4f6', '#374151']; return <Badge bg={p[1]} fg={p[2]}>{p[0]}</Badge>; };
const FACT = { display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '120px' };
const FACT_K = { font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' };
const PAGE_SIZE = 10;

// ===== MY ASSESSMENTS · Screen =====
export default function SMMyAssessments({ go, vw }) {
  const { data, error, loading, reload } = useLoad('/api/my/assessments');
  const [q, setQ] = useState(''), [status, setStatus] = useState('All'), [page, setPage] = useState(0);
  const [open, setOpen] = useState({}), [results, setResults] = useState(null);
  const items = data ? data.items : [];
  const count = k => items.filter(i => !i.unassigned && i.progress === k).length;
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return items.filter(i => (status === 'All' || (status === 'UNASSIGNED' ? i.unassigned : !i.unassigned && i.progress === status)) && (!t || (i.title + ' ' + (i.description || '')).toLowerCase().includes(t)));
  }, [items, q, status]);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE)), pg = Math.min(page, pages - 1);
  const openResults = async it => {
    setResults({ item: it, loading: true });
    try { const d = await api('GET', '/api/my/assessments/' + it.assessmentId); setResults({ item: d.item }); }
    catch (e) { setResults({ item: it, error: e.message }); }
  };

  return (
    <Page>
      <PageHeader title="My Assessments" description="Assessments assigned to you, their deadlines, your attempts and your results." actions={<Btn icon="icon-refresh-cw" onClick={reload} disabled={loading}>Refresh</Btn>} />
      {error ? <Card><EmptyState icon="icon-circle-alert" title="Your assessments couldn't be loaded" text={error} action={<Btn kind="primary" onClick={reload}>Try again</Btn>} /></Card> : null}
      {!error && loading && !data ? <Card><div style={{ padding: '30px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>Loading your assessments…</div></Card> : null}

      {/* ===== MY ASSESSMENTS · Summary tiles ===== */}
      {data ? <div style={{ display: 'grid', gridTemplateColumns: vw < 640 ? 'repeat(2,1fr)' : 'repeat(5,1fr)', gap: '12px' }}>
        <KpiTile label="Assigned" value={items.filter(i => !i.unassigned).length} onClick={() => { setStatus('All'); setPage(0); }} />
        <KpiTile label="Not started" value={count('NOT_STARTED') + count('UPCOMING')} sub={count('UPCOMING') ? count('UPCOMING') + ' not open yet' : null} onClick={() => { setStatus('NOT_STARTED'); setPage(0); }} />
        <KpiTile label="In progress" value={count('IN_PROGRESS')} onClick={() => { setStatus('IN_PROGRESS'); setPage(0); }} />
        <KpiTile label="Completed" value={count('COMPLETED')} onClick={() => { setStatus('COMPLETED'); setPage(0); }} />
        <KpiTile label="Overdue" value={count('OVERDUE')} subColor="#b91c1c" sub={count('OVERDUE') ? 'Deadline passed' : null} onClick={() => { setStatus('OVERDUE'); setPage(0); }} />
      </div> : null}

      {/* ===== MY ASSESSMENTS · Filters ===== */}
      {data && items.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        <Search value={q} onChange={v => { setQ(v); setPage(0); }} placeholder="Search assessments" />
        <Sel value={status} onChange={v => { setStatus(v); setPage(0); }} options={[['All', 'All statuses'], ...Object.entries(PROGRESS).map(([k, v]) => [k, v[0]]), ...(items.some(i => i.unassigned) ? [['UNASSIGNED', 'No longer assigned']] : [])]} />
      </div> : null}

      {data && !items.length ? <Card><EmptyState icon="icon-clipboard-list" title="No assessments assigned to you" text="When an assessment is assigned to you, it will appear here with its deadline. You'll also get a notification." /></Card> : null}
      {data && items.length && !shown.length ? <Card><EmptyState icon="icon-search" title="No assessments match" text="Try a different search or status." action={<Btn onClick={() => { setQ(''); setStatus('All'); }}>Clear filters</Btn>} /></Card> : null}

      {/* ===== MY ASSESSMENTS · Assessment card ===== */}
      {shown.slice(pg * PAGE_SIZE, pg * PAGE_SIZE + PAGE_SIZE).map(it => {
        const s = it.summary, hist = open[it.assessmentId];
        return (
          <Card key={it.assessmentId} title={it.title} sub={it.description ? <span style={{ overflowWrap: 'anywhere' }}>{it.description}</span> : null} actions={<ProgressBadge item={it} />}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px 28px' }}>
              <div style={FACT}><span style={FACT_K}>Opens</span><span style={{ fontSize: '13.5px' }}>{it.startsAt ? fmtDateTime(it.startsAt) : '—'}</span></div>
              <div style={FACT}><span style={FACT_K}>Deadline</span><span style={{ fontSize: '13.5px', color: it.progress === 'OVERDUE' ? '#b91c1c' : '#111827' }}>{it.deadline ? fmtDateTime(it.deadline) : '—'}</span>
                {it.originalDeadline ? <span title={it.extensionReason || ''} style={{ fontSize: '11.5px', color: '#075985' }}>Extended from {fmtDate(it.originalDeadline)}</span> : null}</div>
              <div style={FACT}><span style={FACT_K}>Attempts</span><span style={{ fontSize: '13.5px' }}>{it.used} attempt{it.used === 1 ? '' : 's'} taken</span><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{it.completed} completed</span></div>
              <div style={{ ...FACT, flex: '1 1 220px' }}><span style={FACT_K}>Results</span>
                {!it.completed ? <span style={{ fontSize: '13px', color: '#6b7280' }}>{it.attempts.some(a => a.status === 'PENDING_MARKING') ? 'Waiting for marking' : 'No completed attempts yet'}</span>
                  : !it.released ? <span style={{ fontSize: '13px', color: '#6b7280' }}>{it.releaseNote}</span>
                  : s ? <span style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <Badge bg="#dbeafe" fg="#1d4ed8">{s.competent} of {s.competencies} Competent</Badge>
                      {s.proficient ? <Badge bg="#dcfce7" fg="#15803d">{s.proficient} Proficient</Badge> : null}
                      {s.critical ? <Badge bg="#fee2e2" fg="#b91c1c">{s.critical} Critical Gap</Badge> : null}
                      {s.moderate ? <Badge bg="#fef3c7" fg="#92400e">{s.moderate} Moderate Gap</Badge> : null}
                      {s.noGap ? <Badge bg="#dcfce7" fg="#15803d">{s.noGap} No Gap</Badge> : null}
                    </span> : <span style={{ fontSize: '13px', color: '#6b7280' }}>—</span>}
              </div>
            </div>
            {!it.canStart && !it.canResume && it.blockedReason && !it.unassigned && it.progress !== 'COMPLETED' ? <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#6b7280' }}>{it.blockedReason}</div> : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '14px' }}>
              {it.canResume ? <Btn kind="primary" icon="icon-play" onClick={() => go('take', undefined, it.assessmentId)}>Resume attempt</Btn> : null}
              {it.canStart ? <Btn kind="primary" icon="icon-play" onClick={() => go('take', undefined, it.assessmentId)}>{it.used ? 'Retake' : 'Start'}</Btn> : null}
              {it.completed ? <Btn icon="icon-chart-column" onClick={() => openResults(it)}>View results</Btn> : null}
              {it.attempts.length ? <Btn kind="ghost" icon={hist ? 'icon-chevron-up' : 'icon-history'} onClick={() => setOpen(o => ({ ...o, [it.assessmentId]: !hist }))}>{hist ? 'Hide attempt history' : 'Attempt history (' + it.attempts.length + ')'}</Btn> : null}
            </div>
            {/* ===== MY ASSESSMENTS · Attempt history ===== */}
            {hist ? <div style={{ marginTop: '12px', border: '1px solid rgba(15,35,65,.08)', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
              <DataTable minWidth={600} rowKey={a => a.id} rows={[...it.attempts].reverse()} columns={[
                { key: 'attemptNo', label: 'Attempt', render: a => 'Attempt ' + a.attemptNo },
                { key: 'startedAt', label: 'Started', render: a => fmtDateTime(a.startedAt) },
                { key: 'submittedAt', label: 'Submitted', render: a => fmtDateTime(a.submittedAt) },
                { key: 'activeSeconds', label: 'Active time', render: a => (a.activeSeconds == null ? '—' : fmtDuration(a.activeSeconds)) },
                { key: 'status', label: 'Status', render: a => <AttemptStatusBadge status={a.status} /> },
              ]} />
              <div style={{ padding: '8px 14px', fontSize: '11.5px', color: '#6b7280' }}>Active time counts only while the assessment page was open and in front. It is shown after an attempt is submitted and never affects scores.</div>
            </div> : null}
          </Card>
        );
      })}
      {pages > 1 ? <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', fontSize: '13px', color: '#374151' }}>
        <Btn small icon="icon-chevron-left" onClick={() => setPage(pg - 1)} disabled={pg === 0}>Previous</Btn>Page {pg + 1} of {pages}<Btn small onClick={() => setPage(pg + 1)} disabled={pg >= pages - 1}>Next</Btn>
      </div> : null}

      {/* ===== MY ASSESSMENTS · Results drawer ===== */}
      <Drawer open={!!results} onClose={() => setResults(null)} title={results ? results.item.title : ''} width={920}
        sub={results && !results.loading && !results.error ? results.item.completed + ' completed attempt' + (results.item.completed === 1 ? '' : 's') + ' · ' + results.item.remaining + ' of ' + results.item.maxAttempts + ' remaining' : null}>
        <div style={{ padding: '18px 22px' }}>
          {results && results.loading ? <div style={{ fontSize: '13px', color: '#6b7280' }}>Loading results…</div>
            : results && results.error ? <EmptyState icon="icon-circle-alert" title="Results couldn't be loaded" text={results.error} />
            : results ? <ResultsPanel item={results.item} /> : null}
        </div>
      </Drawer>
    </Page>
  );
}
