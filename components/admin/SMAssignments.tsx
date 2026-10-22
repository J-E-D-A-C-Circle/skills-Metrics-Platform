'use client';
// =============================================================================
// SMAssignments.jsx · Assignments: assign published assessments, deadlines, attempt limits, extensions, progress
//   and result release
// Screen / URL: /cycles (sidebar "Assignments"; ?id=<assignment id> opens one assignment)
// Who sees it: anyone with an "Assignments & Deadlines" permission (cycles.view / assign / edit / extend / release);
//   each button needs its own permission and the server checks every one again
// Used by: components/SkillMatrixApp.jsx   Depends on: ./smUI, ./smApi, /api/assignments/**, /api/lookups, /api/jobs/reminders
// Sections (search for these markers): ASSIGNMENTS · Constants & helpers, ASSIGNMENTS · Small parts,
//   ASSIGNMENTS · Main page, ASSIGNMENTS · Results release card, ASSIGNMENTS · Assignments table,
//   ASSIGNMENTS · Assignment drawer, ASSIGNMENTS · People table, ASSIGNMENTS · Extension history,
//   ASSIGNMENTS · Dialogs (edit, extend, cancel), ASSIGNMENTS · New assignment drawer
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Badge, EmptyState, DataTable, KpiTile, Drawer, Confirm, INPUT, GREEN } from '@/components/shared/smUI';
import { api, qs, useLoad, fmtDate, fmtDateTime } from '@/components/shared/smApi';

// ===== ASSIGNMENTS · Constants & helpers =====
// Progress and assignment-state colours always come with a text label (and an icon), never colour alone.
const PROG = {
  UPCOMING: ['Upcoming', '#eef2ff', '#3730a3', 'icon-calendar-clock'], NOT_STARTED: ['Not started', '#f3f4f6', '#4b5563', 'icon-circle'],
  IN_PROGRESS: ['In progress', '#fef3c7', '#92400e', 'icon-loader'], COMPLETED: ['Completed', '#dcfce7', '#15803d', 'icon-circle-check'],
  OVERDUE: ['Overdue', '#fee2e2', '#b91c1c', 'icon-circle-alert'],
};
const STATE = { UPCOMING: ['Upcoming', '#eef2ff', '#3730a3'], OPEN: ['Open', '#dcfce7', '#15803d'], CLOSED: ['Closed', '#f3f4f6', '#4b5563'] };
const RELEASE = { IMMEDIATE: 'Shown straight away', AFTER_DEADLINE: 'Shown after the deadline', MANUAL: 'Held until released' };
const TARGET_OPTS = [['INDIVIDUAL', 'Individual staff'], ['DEPARTMENT', 'Department'], ['GRADE', 'Grade'], ['STATION', 'Station'], ['LOCATION', 'Location']];
const LOOKUP_KEY = { DEPARTMENT: 'departments', GRADE: 'grades', STATION: 'stations', LOCATION: 'locations' };
// <input type="datetime-local"> works in local time; the server gets ISO (UTC) text.
const toLocal = d => { const x = new Date(d); return isNaN(x) ? '' : new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const fromLocal = v => (v ? new Date(v).toISOString() : '');
const pct = r => (r == null ? '—' : Math.round(r * 100) + '%');
const AREA = { ...INPUT, height: 'auto', minHeight: '72px', padding: '8px 10px', resize: 'vertical', width: '100%', boxSizing: 'border-box' };
const ERR = { font: '500 12.5px Inter,sans-serif', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '8px 10px' };

// ===== ASSIGNMENTS · Small parts =====
const ProgressBadge = ({ status }) => { const p = PROG[status] || PROG.NOT_STARTED; return <Badge bg={p[1]} fg={p[2]}><i className={p[3]} style={{ fontSize: '11px' }}></i>{p[0]}</Badge>; };
const StateBadge = ({ state }) => { const s = STATE[state] || STATE.OPEN; return <Badge bg={s[1]} fg={s[2]}>{s[0]}</Badge>; };
function ProgressBar({ stats }) {
  const w = stats.rate == null ? 0 : Math.round(stats.rate * 100);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '130px' }}>
      <div style={{ height: '6px', borderRadius: '999px', background: '#e5e7eb', overflow: 'hidden' }} aria-hidden="true"><div style={{ width: w + '%', height: '100%', background: GREEN }}></div></div>
      <span style={{ fontSize: '12px', color: '#4b5563' }}>{stats.COMPLETED} of {stats.open} completed · {pct(stats.rate)}{stats.UPCOMING ? ' · ' + stats.UPCOMING + ' not open yet' : ''}</span>
    </div>
  );
}
function Pager({ page, pages, total, onPage, noun }) {
  if (!total) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 20px', fontSize: '12.5px', color: '#6b7280' }}>
      <span>{total} {noun}{total === 1 ? '' : 's'} · page {page} of {pages}</span>
      <span style={{ display: 'flex', gap: '6px' }}>
        <Btn small icon="icon-chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
        <Btn small disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<i className="icon-chevron-right" style={{ fontSize: '13px' }}></i></Btn>
      </span>
    </div>
  );
}
// Debounced copy of a search box value so typing doesn't call the server on every key.
function useDebounced(v, ms = 300) { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; }
const LinkBtn = ({ onClick, children }) => <button type="button" onClick={onClick} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{children}</button>;

// ===== ASSIGNMENTS · Main page =====
export default function SMAssignments({ me, id, toast, vw }) {
  const may = k => !!(me && me.perms && me.perms.includes(k));
  const [q, setQ] = useState('');
  const [assessmentId, setAssessmentId] = useState('All');
  const [state, setState] = useState('All');
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(id ? Number(id) : null);
  const [creating, setCreating] = useState(false);
  const [confirm, setConfirm] = useState(null); // { kind: 'release', assessment } | { kind: 'reminders' }
  const [busy, setBusy] = useState(false);
  const dq = useDebounced(q);
  useEffect(() => { setPage(1); }, [dq, assessmentId, state]);
  useEffect(() => { if (id) setOpenId(Number(id)); }, [id]);
  const { data, error, loading, reload } = useLoad('/api/assignments' + qs({ q: dq, assessmentId, state, page }));
  const say = m => (toast ? toast(m) : null);
  const t = data ? data.totals : null;
  const held = (data ? data.assessments : []).filter(a => a.resultRelease === 'MANUAL' && a.assignments > 0);

  const runConfirm = async () => {
    setBusy(true);
    try {
      if (confirm.kind === 'release') { const r = await api('POST', '/api/assignments/release', { assessmentId: confirm.assessment.id }); say('Results released · ' + r.notified + ' people notified'); }
      else { const r = await api('POST', '/api/jobs/reminders', {}); const n = r.soon + r.passed; say(n ? n + ' reminder' + (n === 1 ? '' : 's') + ' sent' : 'Everyone is up to date · no new reminders'); }
      setConfirm(null); reload();
    } catch (e) { say(e.message); setConfirm(null); }
    setBusy(false);
  };

  return (
    <Page>
      <PageHeader title="Assignments" description="Assign published assessments, set deadlines and attempt limits, give extra time and follow progress."
        actions={<>
          {may('cycles.edit') ? <Btn icon="icon-bell-ring" onClick={() => setConfirm({ kind: 'reminders' })}>Send reminders now</Btn> : null}
          {may('cycles.assign') ? <Btn kind="primary" icon="icon-plus" onClick={() => setCreating(true)}>New assignment</Btn> : null}
        </>}
        filters={<>
          <Search value={q} onChange={setQ} placeholder="Search assessment or who it's assigned to" />
          <Sel value={assessmentId} onChange={setAssessmentId} title="Assessment" style={{ maxWidth: '100%', minWidth: '180px' }}
            options={[['All', 'All assessments'], ...(data ? data.assessments.filter(a => a.assignments > 0).map(a => [String(a.id), a.title]) : [])]} />
          <Sel value={state} onChange={setState} title="State" options={[['All', 'Any state'], ['OPEN', 'Open'], ['UPCOMING', 'Upcoming'], ['CLOSED', 'Closed']]} />
        </>} />

      {/* KPI row: one person counts once per assessment however many assignments reach them */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,180px),1fr))', gap: '12px' }}>
        <KpiTile label="Assignments" value={t ? t.assignments : '—'} sub="Matching the filters" />
        <KpiTile label="People assigned" value={t ? t.people : '—'} sub={t ? t.total + ' person-assessment' + (t.total === 1 ? '' : 's') + ' in your scope' : ' '} />
        <KpiTile label="Completion rate" value={t ? pct(t.rate) : '—'} sub={t ? t.COMPLETED + ' of ' + t.open + ' open completed' : ' '} />
        <KpiTile label="Overdue" value={t ? t.OVERDUE : '—'} sub="Deadline passed, not completed" subColor={t && t.OVERDUE ? '#b91c1c' : undefined} />
      </div>

      {/* ===== ASSIGNMENTS · Results release card ===== */}
      {held.length && may('cycles.release') ? (
        <Card title="Results held for release" sub="These assessments keep results hidden from staff until you release them.">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {held.map(a => (
              <div key={a.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{a.title}</span>
                {a.resultsReleasedAt ? <Badge bg="#dcfce7" fg="#15803d"><i className="icon-circle-check" style={{ fontSize: '11px' }}></i>Released {fmtDate(a.resultsReleasedAt)}</Badge>
                  : <span style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><Badge bg="#fef3c7" fg="#92400e">Held back</Badge><Btn small kind="primary" icon="icon-send" onClick={() => setConfirm({ kind: 'release', assessment: a })}>Release results</Btn></span>}
              </div>))}
          </div>
        </Card>) : null}

      {/* ===== ASSIGNMENTS · Assignments table ===== */}
      <Card flush>
        {error ? <EmptyState icon="icon-circle-alert" title="Couldn't load assignments" text={error} action={<Btn onClick={reload}>Try again</Btn>} />
          : !data ? <EmptyState icon="icon-loader" title="Loading assignments…" />
          : <>
            <DataTable minWidth={980} rowKey={r => r.id} rows={data.assignments}
              empty={<EmptyState icon="icon-calendar-cog" title={q || assessmentId !== 'All' || state !== 'All' ? 'No assignments match' : 'No assignments yet'}
                text={q || assessmentId !== 'All' || state !== 'All' ? 'Try a different search or filter.' : may('cycles.assign') ? 'Assign a published assessment to people, a department, a grade, a station or a location.' : 'Nothing has been assigned in the departments you can see.'}
                action={!q && may('cycles.assign') ? <Btn kind="primary" icon="icon-plus" onClick={() => setCreating(true)}>New assignment</Btn> : null} />}
              columns={[
                { key: 'assessment', label: 'Assessment', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', maxWidth: '300px' }}><LinkBtn onClick={() => setOpenId(r.id)}>{r.assessment}</LinkBtn>{r.resultRelease !== 'IMMEDIATE' ? <span style={{ fontSize: '11.5px', color: '#6b7280' }}>Results: {r.resultsReleasedAt ? 'released ' + fmtDate(r.resultsReleasedAt) : RELEASE[r.resultRelease].toLowerCase()}</span> : null}</div> },
                { key: 'target', label: 'Assigned to', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span>{r.target}</span><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.targetLabel}</span></div> },
                { key: 'startsAt', label: 'Opens', render: r => fmtDate(r.startsAt) },
                { key: 'deadline', label: 'Deadline', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span>{fmtDate(r.wholeExtension || r.deadline)}</span>{r.wholeExtension ? <span style={{ fontSize: '11.5px', color: '#92400e' }}>Extended from {fmtDate(r.deadline)}</span> : r.extensions ? <span style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.extensions} personal extension{r.extensions === 1 ? '' : 's'}</span> : null}</div> },
                { key: 'limit', label: 'Attempts', align: 'center', render: r => r.limit },
                { key: 'progress', label: 'Progress', render: r => <ProgressBar stats={r.stats} /> },
                { key: 'overdue', label: 'Overdue', align: 'center', render: r => r.stats.OVERDUE ? <Badge bg="#fee2e2" fg="#b91c1c">{r.stats.OVERDUE}</Badge> : <span style={{ color: '#9ca3af' }}>0</span> },
                { key: 'state', label: 'State', render: r => <StateBadge state={r.state} /> },
                { key: 'open', label: '', align: 'right', render: r => <Btn small onClick={() => setOpenId(r.id)}>View</Btn> },
              ]} />
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} noun="assignment" />
            {loading ? <div style={{ padding: '0 20px 12px', fontSize: '12px', color: '#6b7280' }}>Updating…</div> : null}
          </>}
      </Card>

      {openId ? <AssignmentDrawer id={openId} may={may} say={say} vw={vw} onClose={() => setOpenId(null)} onChanged={reload} /> : null}
      {creating ? <NewAssignment data={data} may={may} say={say} onClose={() => setCreating(false)} onSaved={() => { setCreating(false); reload(); }} /> : null}
      <Confirm open={!!confirm} busy={busy} onCancel={() => setConfirm(null)} onConfirm={runConfirm}
        title={confirm && confirm.kind === 'release' ? 'Release results?' : 'Send deadline reminders now?'}
        confirmText={confirm && confirm.kind === 'release' ? 'Release results' : 'Send reminders'}
        text={confirm && confirm.kind === 'release' ? 'Everyone assigned "' + confirm.assessment.title + '" will be able to see their results and will be notified. This cannot be undone.'
          : 'People whose deadline is within 48 hours, or has just passed, and who have not completed will get a reminder. Nobody gets the same reminder twice.'} />
    </Page>
  );
}

// ===== ASSIGNMENTS · Assignment drawer =====
// One assignment: its dates and limit, actions, everyone it covers with their progress, and the extension history.
function AssignmentDrawer({ id, may, say, onClose, onChanged }) {
  const [status, setStatus] = useState('ALL');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null); // { kind: 'edit' } | { kind: 'extend', person? } | { kind: 'cancel' }
  const dq = useDebounced(q);
  useEffect(() => { setPage(1); }, [dq, status]);
  const { data, error, reload } = useLoad('/api/assignments/' + id + qs({ status, q: dq, page }));
  const a = data ? data.assignment : null, st = data ? data.stats : null;
  const done = msg => { setDialog(null); say(msg); reload(); onChanged(); };
  const manage = a && a.canManage;
  const chips = st ? [['ALL', 'Everyone', st.total], ...['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'OVERDUE', 'UPCOMING'].filter(k => st[k] || k !== 'UPCOMING').map(k => [k, PROG[k][0], st[k]])] : [];
  const Info = ({ label, children }) => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '0' }}><span style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{label}</span><span style={{ fontSize: '13.5px', color: '#111827' }}>{children}</span></div>;

  return (
    <Drawer open width={1040} onClose={onClose} title={a ? a.assessment : 'Assignment'} sub={a ? a.targetLabel + ' · ' + a.target : error ? '' : 'Loading…'}
      footer={a ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-end' }}>
        {may('cycles.edit') && manage ? <Btn kind="danger" icon="icon-trash-2" disabled={a.hasAttempts} title={a.hasAttempts ? 'People have started this assessment, so it can\'t be cancelled' : 'Cancel this assignment'} onClick={() => setDialog({ kind: 'cancel' })}>Cancel assignment</Btn> : null}
        {may('cycles.extend') && manage ? <Btn icon="icon-calendar-plus" onClick={() => setDialog({ kind: 'extend' })}>Extend for everyone</Btn> : null}
        {may('cycles.edit') && manage ? <Btn kind="primary" icon="icon-pencil" onClick={() => setDialog({ kind: 'edit' })}>Change dates & limit</Btn> : null}
      </div> : null}>
      {error ? <EmptyState icon="icon-circle-alert" title="Couldn't open this assignment" text={error} /> : !a ? <EmptyState icon="icon-loader" title="Loading…" /> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', padding: '18px 22px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '14px' }}>
            <Info label="State"><StateBadge state={a.state} /></Info>
            <Info label="Opens">{fmtDateTime(a.startsAt)}</Info>
            <Info label="Deadline">{fmtDateTime(a.wholeExtension || a.deadline)}{a.wholeExtension ? <span style={{ display: 'block', fontSize: '11.5px', color: '#92400e' }}>Extended from {fmtDateTime(a.deadline)}</span> : null}</Info>
            <Info label="Attempts allowed">{a.limit}{a.maxAttempts == null ? <span style={{ fontSize: '11.5px', color: '#6b7280' }}> (assessment default)</span> : null}</Info>
            <Info label="Results">{a.resultRelease === 'MANUAL' && a.resultsReleasedAt ? 'Released ' + fmtDate(a.resultsReleasedAt) : RELEASE[a.resultRelease]}</Info>
            <Info label="Assigned by">{a.createdBy || '—'}<span style={{ display: 'block', fontSize: '11.5px', color: '#6b7280' }}>{fmtDate(a.createdAt)}</span></Info>
          </div>
          {!manage && (may('cycles.edit') || may('cycles.extend')) ? <div style={{ fontSize: '12.5px', color: '#6b7280' }}><i className="icon-info" style={{ fontSize: '12px' }}></i> This assignment reaches beyond the departments you manage. You can extend the deadline for people you can see, one at a time.</div> : null}

          {/* Status filter chips with counts; completion rate leaves out people whose assessment hasn't opened */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
            {chips.map(([k, label, n]) => { const on = status === k; return (
              <button key={k} type="button" onClick={() => setStatus(k)} aria-pressed={on} style={{ border: on ? '1px solid #15904c' : '1px solid rgba(15,35,65,.14)', background: on ? '#e6f4ec' : '#fff', color: on ? '#0d5a31' : '#374151', borderRadius: '999px', padding: '5px 11px', cursor: 'pointer', font: '500 12.5px Inter,sans-serif' }}>{label} · {n}</button>); })}
            <span style={{ marginLeft: 'auto', fontSize: '12.5px', color: '#4b5563' }}>Completion rate <b>{pct(st.rate)}</b></span>
          </div>

          {/* ===== ASSIGNMENTS · People table ===== */}
          <Card flush actions={<Search value={q} onChange={setQ} placeholder="Search name, staff ID or department" style={{ minWidth: '220px' }} />} title="People on this assignment" sub="Only people in the departments you can see are listed.">
            <DataTable minWidth={860} rowKey={r => r.staffId} rows={data.people}
              empty={<EmptyState icon="icon-users" title="Nobody to show" text={q || status !== 'ALL' ? 'Try a different search or status.' : 'This assignment covers nobody you can see (for example a department with no active staff).'} />}
              columns={[
                { key: 'staffNo', label: 'Staff ID', render: r => <span style={{ font: "500 12.5px 'JetBrains Mono',monospace" }}>{r.staffNo}</span> },
                { key: 'name', label: 'Name', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span style={{ fontWeight: 500 }}>{r.name}</span><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{[r.grade, r.station].filter(Boolean).join(' · ')}</span></div> },
                { key: 'department', label: 'Department', render: r => r.department || '—' },
                { key: 'status', label: 'Status', render: r => <ProgressBadge status={r.status} /> },
                { key: 'used', label: 'Attempts', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}><span>{r.used} of {r.limit} used</span><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.completed} completed</span></div> },
                { key: 'deadline', label: 'Their deadline', render: r => <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span>{fmtDateTime(r.deadline)}</span>
                  {r.personalExtension ? <Badge bg="#fef3c7" fg="#92400e" style={{ alignSelf: 'flex-start' }}><i className="icon-calendar-plus" style={{ fontSize: '11px' }}></i>Personal extension</Badge> : null}
                  {r.otherAssignments ? <span style={{ fontSize: '11.5px', color: '#6b7280' }}>Also assigned another way ({r.otherAssignments})</span> : null}</div> },
                { key: 'act', label: '', align: 'right', render: r => may('cycles.extend') && r.status !== 'COMPLETED' ? <Btn small icon="icon-calendar-plus" onClick={() => setDialog({ kind: 'extend', person: r })}>Extend</Btn> : null },
              ]} />
            <Pager page={data.page} pages={data.pages} total={data.total} onPage={setPage} noun="person" />
          </Card>

          {/* ===== ASSIGNMENTS · Extension history ===== */}
          <Card title="Deadline extensions" sub="Original and new deadline, who it covers, the reason, and who approved it.">
            {a.history.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {a.history.map(x => (
                <div key={x.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px', paddingBottom: '10px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
                  <span style={{ fontSize: '13.5px', fontWeight: 500 }}>{x.who}: {fmtDateTime(x.originalDeadline)} → {fmtDateTime(x.newDeadline)}</span>
                  <span style={{ fontSize: '13px', color: '#374151' }}>“{x.reason}”</span>
                  <span style={{ fontSize: '12px', color: '#6b7280' }}>Approved by {x.approvedBy || '—'} · {fmtDateTime(x.at)}</span>
                </div>))}
            </div> : <div style={{ fontSize: '13px', color: '#6b7280' }}>No extensions yet.</div>}
          </Card>
        </div>)}
      {dialog && a ? <AssignmentDialog dialog={dialog} a={a} onCancel={() => setDialog(null)} onDone={done} onClosed={() => { setDialog(null); say('Assignment cancelled'); onChanged(); onClose(); }} /> : null}
    </Drawer>
  );
}

// ===== ASSIGNMENTS · Dialogs (edit, extend, cancel) =====
// Edit: start, deadline, attempt limit. Extend: one person or everyone, new deadline + required reason. Cancel: confirm.
function AssignmentDialog({ dialog, a, onCancel, onDone, onClosed }) {
  const person = dialog.person || null;
  const current = person ? person.deadline : (a.wholeExtension || a.deadline);
  const later = new Date(Math.max(new Date(current).getTime(), Date.now()) + 7 * 864e5);
  const [f, setF] = useState({ startsAt: toLocal(a.startsAt), deadline: toLocal(a.deadline), maxAttempts: a.maxAttempts == null ? '' : String(a.maxAttempts), newDeadline: toLocal(later), reason: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const go = async () => {
    setErr(''); setBusy(true);
    try {
      if (dialog.kind === 'edit') {
        const m = f.maxAttempts.trim();
        if (m && !/^\d+$/.test(m)) throw new Error('The attempt limit must be a whole number from 1 to 10.');
        await api('PATCH', '/api/assignments/' + a.id, { startsAt: fromLocal(f.startsAt), deadline: fromLocal(f.deadline), maxAttempts: m ? Number(m) : null });
        onDone('Assignment updated');
      } else if (dialog.kind === 'extend') {
        if (f.reason.trim().length < 5) throw new Error('Give a reason of at least 5 characters.');
        const r = await api('POST', '/api/assignments/' + a.id + '/extensions', { staffId: person ? person.staffId : null, newDeadline: fromLocal(f.newDeadline), reason: f.reason.trim() });
        onDone('Deadline extended · ' + r.notified + ' notified');
      } else { await api('DELETE', '/api/assignments/' + a.id); onClosed(); }
    } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const title = dialog.kind === 'edit' ? 'Change dates & attempt limit' : dialog.kind === 'cancel' ? 'Cancel this assignment?' : person ? 'Extend the deadline for ' + person.name : 'Extend the deadline for everyone';
  const text = dialog.kind === 'cancel' ? 'Nobody it covers has started yet. It will be removed and people will no longer see it (unless another assignment gives them the same assessment). The audit log keeps a record.'
    : dialog.kind === 'extend' ? 'Current deadline: ' + fmtDateTime(current) + '. ' + (person ? 'Only this person gets the extra time.' : 'Everyone on this assignment gets the extra time.') + ' They will be notified.'
    : 'Changing the deadline here does not notify anyone. Use an extension to give extra time with a recorded reason.';
  return (
    <Confirm open busy={busy} danger={dialog.kind === 'cancel'} title={title} text={text} onCancel={onCancel} onConfirm={go}
      confirmText={dialog.kind === 'edit' ? 'Save changes' : dialog.kind === 'cancel' ? 'Cancel assignment' : 'Extend deadline'}>
      {dialog.kind === 'edit' ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px' }}>
        <Field label="OPENS"><input type="datetime-local" value={f.startsAt} onChange={e => set('startsAt', e.target.value)} style={INPUT} /></Field>
        <Field label="DEADLINE"><input type="datetime-local" value={f.deadline} onChange={e => set('deadline', e.target.value)} style={INPUT} /></Field>
        <Field label="ATTEMPTS ALLOWED" hint={'Blank = the assessment\'s limit (' + a.assessmentLimit + '). At least ' + Math.max(1, a.maxUsed) + '.'}><input inputMode="numeric" value={f.maxAttempts} onChange={e => set('maxAttempts', e.target.value)} placeholder={String(a.assessmentLimit)} style={INPUT} /></Field>
      </div> : null}
      {dialog.kind === 'extend' ? <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <Field label="NEW DEADLINE"><input type="datetime-local" value={f.newDeadline} onChange={e => set('newDeadline', e.target.value)} style={INPUT} /></Field>
        <Field label="REASON (REQUIRED)" hint="Recorded with the extension and in the audit log."><textarea value={f.reason} onChange={e => set('reason', e.target.value)} maxLength={500} placeholder="e.g. On annual leave for most of the assessment window" style={AREA} /></Field>
      </div> : null}
      {err ? <div role="alert" style={ERR}>{err}</div> : null}
    </Confirm>
  );
}

// ===== ASSIGNMENTS · New assignment drawer =====
// Pick a published assessment, who it goes to (several departments / people at once), dates and an optional limit.
function NewAssignment({ data, may, say, onClose, onSaved }) {
  const lookups = useLoad('/api/lookups');
  const allowed = data ? data.allowed : { all: false, departmentIds: [] };
  const published = (data ? data.assessments : []).filter(a => a.status === 'PUBLISHED');
  const start = new Date(); start.setSeconds(0, 0);
  const end = new Date(start.getTime() + 14 * 864e5); end.setHours(17, 0, 0, 0);
  const [f, setF] = useState({ assessmentId: published[0] ? String(published[0].id) : '', targetType: allowed.all ? 'DEPARTMENT' : 'INDIVIDUAL', ids: [], startsAt: toLocal(start), deadline: toLocal(end), maxAttempts: '' });
  const [people, setPeople] = useState([]); // chosen staff [{ id, name, staffNo, department }]
  const [sq, setSq] = useState('');
  const [found, setFound] = useState({ list: [], loading: false, error: '' });
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const dsq = useDebounced(sq);
  const set = (k, v) => setF(x => ({ ...x, [k]: v }));
  const targetOpts = TARGET_OPTS.filter(([k]) => allowed.all || k === 'INDIVIDUAL' || k === 'DEPARTMENT');
  const chosen = published.find(a => String(a.id) === f.assessmentId);
  // Group options from /api/lookups: active ones only; departments limited to the user's scope.
  const groups = useMemo(() => {
    const L = lookups.data; if (!L || f.targetType === 'INDIVIDUAL') return [];
    const list = (L[LOOKUP_KEY[f.targetType]] || []).filter(x => x.active !== false);
    const locName = id => ((L.locations || []).find(l => l.id === id) || {}).name;
    return (f.targetType === 'DEPARTMENT' && !allowed.all ? list.filter(d => (allowed.departmentIds || []).includes(d.id)) : list)
      .map(x => ({ id: x.id, name: x.name, sub: f.targetType === 'STATION' && locName(x.locationId) !== x.name ? locName(x.locationId) : '' }));
  }, [lookups.data, f.targetType, allowed]);
  // Staff search (server-side, scoped to the people this user may see).
  useEffect(() => {
    if (f.targetType !== 'INDIVIDUAL') return;
    let live = true; setFound(s => ({ ...s, loading: true }));
    api('GET', '/api/assignments/staff' + qs({ q: dsq })).then(d => live && setFound({ list: d.staff, loading: false, error: '' })).catch(e => live && setFound({ list: [], loading: false, error: e.message }));
    return () => { live = false; };
  }, [dsq, f.targetType]);
  const ids = f.targetType === 'INDIVIDUAL' ? people.map(p => p.id) : f.ids;
  const toggle = id => set('ids', f.ids.includes(id) ? f.ids.filter(x => x !== id) : [...f.ids, id]);
  const check = () => {
    if (!chosen) return 'Choose a published assessment.';
    if (!ids.length) return f.targetType === 'INDIVIDUAL' ? 'Add at least one member of staff.' : 'Tick at least one ' + TARGET_OPTS.find(o => o[0] === f.targetType)[1].toLowerCase() + '.';
    if (!f.startsAt || !f.deadline) return 'Enter the start date and the deadline.';
    if (new Date(f.deadline) <= new Date(f.startsAt)) return 'The deadline must be after the start date.';
    if (new Date(f.deadline) <= new Date()) return 'The deadline must be in the future.';
    const m = f.maxAttempts.trim(); if (m && (!/^\d+$/.test(m) || +m < 1 || +m > 10)) return 'The attempt limit must be a whole number from 1 to 10.';
    return '';
  };
  const review = () => { const e = check(); setErr(e); if (!e) setAsk(true); };
  const save = async () => {
    setBusy(true);
    try {
      const r = await api('POST', '/api/assignments', { assessmentId: Number(f.assessmentId), targetType: f.targetType, targetIds: ids, startsAt: fromLocal(f.startsAt), deadline: fromLocal(f.deadline), maxAttempts: f.maxAttempts.trim() ? Number(f.maxAttempts) : null });
      say('Assigned to ' + r.covered + ' ' + (r.covered === 1 ? 'person' : 'people') + ' · ' + r.notified + ' notified');
      onSaved();
    } catch (e) { setErr(e.message); setAsk(false); }
    setBusy(false);
  };
  const box = { border: '1px solid rgba(15,35,65,.1)', borderRadius: '12px', background: '#fff', maxHeight: '260px', overflowY: 'auto' };
  const row = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', padding: '8px 12px', borderBottom: '1px solid rgba(15,35,65,.06)', fontSize: '13px' };

  return (
    <Drawer open width={680} title="New assignment" sub="People covered are notified straight away and see it in My Assessments." onClose={onClose}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="icon-send" onClick={review} disabled={!published.length}>Assign</Btn></div>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '18px 22px' }}>
        {!published.length ? <EmptyState icon="icon-file-pen-line" title="No published assessments" text="An assessment must be approved and published by an Administrator before it can be assigned." /> : <>
          <Field label="ASSESSMENT" hint={chosen ? 'Attempts allowed by default: ' + chosen.maxAttempts + ' · Results: ' + RELEASE[chosen.resultRelease].toLowerCase() : ''}>
            <Sel value={f.assessmentId} onChange={v => set('assessmentId', v)} options={published.map(a => [String(a.id), a.title])} style={{ width: '100%' }} />
          </Field>
          <Field label="ASSIGN TO" hint={allowed.all ? '' : 'You can assign to your own department(s) or to staff you can see.'}>
            <Sel value={f.targetType} onChange={v => setF(x => ({ ...x, targetType: v, ids: [] }))} options={targetOpts} style={{ width: '100%' }} />
          </Field>
          {f.targetType === 'INDIVIDUAL' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {people.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{people.map(p => (
                <span key={p.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: '#e6f4ec', color: '#0d5a31', borderRadius: '999px', padding: '4px 6px 4px 10px', font: '500 12.5px Inter,sans-serif' }}>{p.name} · {p.staffNo}
                  <button type="button" aria-label={'Remove ' + p.name} onClick={() => setPeople(people.filter(x => x.id !== p.id))} style={{ border: 0, background: 'none', cursor: 'pointer', color: '#0d5a31', display: 'flex', padding: '2px' }}><i className="icon-x" style={{ fontSize: '12px' }}></i></button></span>))}</div> : null}
              <Search value={sq} onChange={setSq} placeholder="Search staff by name or staff ID" style={{ flex: 'none' }} />
              <div style={box}>
                {found.error ? <div style={{ ...row, color: '#b91c1c' }}>{found.error}</div>
                  : found.loading && !found.list.length ? <div style={{ ...row, color: '#6b7280' }}>Searching…</div>
                  : !found.list.length ? <div style={{ ...row, color: '#6b7280' }}>No staff match.</div>
                  : found.list.map(s => { const on = people.some(p => p.id === s.id); return (
                    <div key={s.id} style={row}><span style={{ minWidth: 0 }}><b style={{ fontWeight: 500 }}>{s.name}</b> <span style={{ color: '#6b7280' }}>· {s.staffNo} · {s.department || 'No department'}</span></span>
                      <Btn small kind={on ? 'secondary' : 'ghost'} icon={on ? 'icon-check' : 'icon-plus'} onClick={() => setPeople(on ? people.filter(p => p.id !== s.id) : [...people, s])}>{on ? 'Added' : 'Add'}</Btn></div>); })}
              </div>
            </div>
          ) : (
            <div style={box}>
              {lookups.error ? <div style={{ ...row, color: '#b91c1c' }}>{lookups.error}</div> : !lookups.data ? <div style={{ ...row, color: '#6b7280' }}>Loading…</div>
                : !groups.length ? <div style={{ ...row, color: '#6b7280' }}>Nothing available to choose.</div>
                : groups.map(g => (
                  <label key={g.id} style={{ ...row, justifyContent: 'flex-start', cursor: 'pointer' }}>
                    <input type="checkbox" checked={f.ids.includes(g.id)} onChange={() => toggle(g.id)} style={{ accentColor: '#15904c', width: '16px', height: '16px' }} />
                    <span>{g.name}{g.sub ? <span style={{ color: '#6b7280' }}> · {g.sub}</span> : null}</span>
                  </label>))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
            <Field label="OPENS"><input type="datetime-local" value={f.startsAt} onChange={e => set('startsAt', e.target.value)} style={INPUT} /></Field>
            <Field label="DEADLINE" hint="No new attempts can start after this unless you grant an extension."><input type="datetime-local" value={f.deadline} onChange={e => set('deadline', e.target.value)} style={INPUT} /></Field>
            <Field label="ATTEMPTS ALLOWED (OPTIONAL)" hint={'Blank = the assessment\'s limit' + (chosen ? ' (' + chosen.maxAttempts + ')' : '') + '.'}><input inputMode="numeric" value={f.maxAttempts} onChange={e => set('maxAttempts', e.target.value)} placeholder={chosen ? String(chosen.maxAttempts) : '3'} style={INPUT} /></Field>
          </div>
          {err ? <div role="alert" style={ERR}>{err}</div> : null}
        </>}
      </div>
      <Confirm open={ask} busy={busy} onCancel={() => setAsk(false)} onConfirm={save} title="Assign this assessment?" confirmText="Assign and notify"
        text={chosen ? '"' + chosen.title + '" will be assigned to ' + ids.length + ' ' + (f.targetType === 'INDIVIDUAL' ? (ids.length === 1 ? 'person' : 'people') : TARGET_OPTS.find(o => o[0] === f.targetType)[1].toLowerCase() + (ids.length === 1 ? '' : 's')) + ', open ' + fmtDateTime(fromLocal(f.startsAt)) + ' and close ' + fmtDateTime(fromLocal(f.deadline)) + '. Everyone covered will be notified.' : ''} />
    </Drawer>
  );
}
