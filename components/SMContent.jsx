'use client';
// =============================================================================
// SMContent.jsx · Assessment Content: drafts, question editor, bulk upload, preview, review, publishing and versions
// Screen / URL: "/forms" (list of assessments) and "/forms?id=<assessment id>" (one assessment)
// Who sees it: anyone with "View assessment content" (Assessment Creators, Administrators). Creating, editing,
//   reviewing, publishing and archiving each need their own permission; the server checks every action again
//   (app/api/content/**), including the hard rule that nobody approves or publishes their own work.
// Used by: SkillMatrixApp.jsx (page "forms", props S = { me, go, id, vw, toast, ... })
// Depends on: smUI (Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable,
//   Drawer, INPUT, LABEL), smApi (useLoad, qs, fmtDate, fmtDateTime), lib/server/content.js (shared pure rules:
//   labels, question checks), xlsx (loaded only when a file is uploaded; the browser reads it, the server checks rows)
// Sections (search for these markers): CONTENT · Helpers, CONTENT · Status badge, CONTENT · List page,
//   CONTENT · New assessment drawer, CONTENT · Assessment page, CONTENT · Workflow actions, CONTENT · Notices,
//   CONTENT · Questions tab, CONTENT · Question card, CONTENT · Question editor, CONTENT · Bulk upload,
//   CONTENT · Settings tab, CONTENT · Versions & history tab, CONTENT · Preview tab
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable, Drawer, INPUT } from './smUI';
import { useLoad, qs, fmtDate, fmtDateTime } from './smApi';
import { STATUS_LABEL, STATUS_COLOURS, TYPE_LABEL, RELEASE_LABEL, LIMITS, questionProblems, normaliseQuestion } from '../lib/server/content';

// ===== CONTENT · Helpers =====
// call(): like smApi's api() but keeps the whole error reply (e.data), so row errors and submit problems can be shown.
async function call(method, path, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error(d.error || 'Something went wrong. Please try again.'); err.data = d; err.status = r.status; throw err; }
  return d;
}
const TEXTAREA = { ...INPUT, height: 'auto', minHeight: '84px', padding: '8px 10px', resize: 'vertical', lineHeight: 1.45 };
const MUTED = { fontSize: '12.5px', color: '#6b7280' };
const ERR = { fontSize: '12.5px', color: '#b91c1c' };
const LINK = { background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' };
const can = (me, k) => !!(me && me.perms && me.perms.includes(k));
function Pager({ page, size, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / size));
  if (total <= size) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 20px', flexWrap: 'wrap' }}>
      <span style={MUTED}>Showing {(page - 1) * size + 1}–{Math.min(total, page * size)} of {total}</span>
      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <Btn small icon="icon-chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Btn>
        <span style={MUTED}>Page {page} of {pages}</span>
        <Btn small disabled={page >= pages} onClick={() => onPage(page + 1)}>Next<i className="icon-chevron-right" style={{ fontSize: '13px' }}></i></Btn>
      </span>
    </div>
  );
}
function Banner({ tone = 'info', icon, children, action }) {
  const c = { info: ['#eff6ff', '#1e40af', '#bfdbfe'], warn: ['#fffbeb', '#92400e', '#fde68a'], bad: ['#fef2f2', '#991b1b', '#fecaca'], good: ['#f0fdf4', '#166534', '#bbf7d0'] }[tone];
  return (
    <div role="status" style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '12px 14px', borderRadius: '14px', background: c[0], color: c[1], border: '1px solid ' + c[2], fontSize: '13px', lineHeight: 1.5, flexWrap: 'wrap' }}>
      <i className={icon || 'icon-info'} style={{ fontSize: '16px', marginTop: '1px' }}></i>
      <div style={{ flex: '1 1 240px', minWidth: '0' }}>{children}</div>
      {action || null}
    </div>
  );
}

// ===== CONTENT · Status badge =====
export function ContentStatus({ status, prefix }) {
  const c = STATUS_COLOURS[status] || ['#f3f4f6', '#374151'];
  return <Badge bg={c[0]} fg={c[1]}>{prefix ? prefix + ' · ' : ''}{STATUS_LABEL[status] || status}</Badge>;
}

export default function SMContent(S) {
  const id = Number(S.id);
  return Number.isInteger(id) && id > 0 ? <ContentItem key={id} S={S} id={id} /> : <ContentList S={S} />;
}

// ===== CONTENT · List page =====
// Server-side search, status filter, "only mine" and paging (the DVLA banks alone have 8 assessments of 60–80+ questions).
const FILTERS = [['All', 'All statuses'], ['REVIEW', 'Waiting for review'], ...Object.entries(STATUS_LABEL)];
function ContentList({ S }) {
  const { me, go } = S;
  const [q, setQ] = useState(''), [dq, setDq] = useState('');
  const [status, setStatus] = useState('All'), [mine, setMine] = useState(false), [sort, setSort] = useState('updated'), [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  const { data, error, loading, reload } = useLoad('/api/content' + qs({ q: dq, status, mine: mine ? '1' : '', sort: sort === 'title' ? 'title' : '', page, size: 20 }));
  const pick = st => { setStatus(st); setPage(1); };
  const cols = [
    { key: 'title', label: 'Assessment', render: r => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '220px' }}>
        <button type="button" style={LINK} onClick={() => go('forms', undefined, r.id)}>{r.title}</button>
        <span style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.source || 'Created by ' + r.createdBy}{r.mine ? ' · yours' : ''}</span>
      </div>) },
    { key: 'status', label: 'Status', render: r => (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', alignItems: 'flex-start' }}>
        <ContentStatus status={r.status} />
        {r.versionStatus && r.versionStatus !== r.status ? <ContentStatus status={r.versionStatus} prefix={'Version ' + r.versionNo} /> : null}
      </div>) },
    { key: 'version', label: 'Version', render: r => <span>v{r.versionNo}{r.liveVersionNo && r.liveVersionNo !== r.versionNo ? <span style={MUTED}> (v{r.liveVersionNo} live)</span> : null}</span> },
    { key: 'questions', label: 'Questions', align: 'right' },
    { key: 'attempts', label: 'Attempts', align: 'right' },
    { key: 'updatedAt', label: 'Updated', render: r => fmtDate(r.updatedAt) },
  ];
  const counts = data ? data.counts || {} : {};
  return (
    <Page>
      <PageHeader title="Assessment Content" description="Write assessments, map questions to competencies, send them for review and publish approved versions."
        actions={can(me, 'forms.create') ? <Btn kind="primary" icon="icon-plus" onClick={() => setCreating(true)}>New assessment</Btn> : null}
        filters={<>
          <Search value={q} onChange={setQ} placeholder="Search titles and descriptions" />
          <Sel value={status} onChange={pick} options={FILTERS} title="Status" />
          <Sel value={sort} onChange={v => { setSort(v); setPage(1); }} options={[['updated', 'Recently updated'], ['title', 'Title A–Z']]} title="Sort" />
          {can(me, 'forms.create') ? <Toggle on={mine} onClick={() => { setMine(!mine); setPage(1); }} label="Only mine" /> : null}
        </>} />
      {data && data.review && can(me, 'forms.review') && status !== 'REVIEW' ? (
        <Banner tone="warn" icon="icon-inbox" action={<Btn small onClick={() => pick('REVIEW')}>Show them</Btn>}>
          <b>{data.review} assessment{data.review === 1 ? '' : 's'}</b> waiting for your review.
        </Banner>) : null}
      {data ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }} aria-label="Assessments by status">
          {Object.keys(STATUS_LABEL).filter(k => counts[k]).map(k => (
            <button key={k} type="button" onClick={() => pick(status === k ? 'All' : k)} style={{ border: status === k ? '1px solid #15904c' : '1px solid rgba(15,35,65,.12)', borderRadius: '999px', background: '#fff', padding: '4px 10px 4px 4px', cursor: 'pointer', display: 'inline-flex', gap: '6px', alignItems: 'center', font: '500 12px Inter,sans-serif', color: '#374151' }}>
              <ContentStatus status={k} />{counts[k]}
            </button>))}
        </div>) : null}
      <Card flush>
        {error ? <EmptyState icon="icon-triangle-alert" title="Could not load assessments" text={error} action={<Btn onClick={reload}>Try again</Btn>} />
          : !data ? <EmptyState icon="icon-loader" title="Loading assessments…" />
          : <>
            <DataTable columns={cols} rows={data.rows} minWidth={760} rowKey={r => r.id}
              empty={<EmptyState icon="icon-file-pen-line" title={dq || status !== 'All' || mine ? 'No assessments match' : 'No assessments yet'}
                text={dq || status !== 'All' || mine ? 'Try a different search or status.' : can(me, 'forms.create') ? 'Start with "New assessment", then add questions or upload them from the template.' : 'Approved and published assessments will appear here.'} />} />
            <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />
            {loading ? <div style={{ ...MUTED, padding: '0 20px 12px' }}>Updating…</div> : null}
          </>}
      </Card>
      <NewAssessment open={creating} onClose={() => setCreating(false)} onMade={nid => { S.toast('Draft created'); go('forms', undefined, nid); }} />
    </Page>
  );
}

// ===== CONTENT · New assessment drawer =====
function SettingsFields({ v, set, disabled }) {
  const f = k => e => set({ ...v, [k]: e.target.value });
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <Field label="TITLE"><input style={INPUT} value={v.title} onChange={f('title')} disabled={disabled} maxLength={LIMITS.title} placeholder="e.g. Front Desk Service · Officer" /></Field>
      <Field label="DESCRIPTION" hint="What the assessment covers (shown in lists)."><textarea style={TEXTAREA} value={v.description || ''} onChange={f('description')} disabled={disabled} maxLength={LIMITS.description} /></Field>
      <Field label="INSTRUCTIONS FOR PARTICIPANTS" hint="Shown before the first question."><textarea style={TEXTAREA} value={v.instructions || ''} onChange={f('instructions')} disabled={disabled} maxLength={LIMITS.instructions} /></Field>
      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
        <Field label="MAXIMUM ATTEMPTS" hint="Default 3 (Settings > Scoring & Attempts). An assignment can override it." style={{ flex: '1 1 160px' }}>
          <input type="number" min="1" max={LIMITS.maxAttempts} style={INPUT} value={v.maxAttempts} onChange={f('maxAttempts')} disabled={disabled} /></Field>
        <Field label="RESULTS SHOWN TO STAFF" style={{ flex: '2 1 240px' }}>
          <Sel value={v.resultRelease} onChange={x => set({ ...v, resultRelease: x })} disabled={disabled} options={Object.entries(RELEASE_LABEL)} /></Field>
      </div>
    </div>
  );
}
function NewAssessment({ open, onClose, onMade }) {
  const blank = { title: '', description: '', instructions: '', maxAttempts: 3, resultRelease: 'IMMEDIATE' };
  const [v, setV] = useState(blank), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { if (open) { setV(blank); setErr(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = async () => {
    setBusy(true); setErr('');
    try { const d = await call('POST', '/api/content', { ...v, maxAttempts: Number(v.maxAttempts) }); onClose(); onMade(d.id); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Drawer open={open} title="New assessment" sub="Starts as a Draft (version 1). Add questions next, then submit it for review." onClose={onClose} width={620}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{err ? <span style={ERR}>{err}</span> : null}<Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={busy || v.title.trim().length < 3} onClick={save}>{busy ? 'Creating…' : 'Create draft'}</Btn></div>}>
      <div style={{ padding: '18px 22px' }}><SettingsFields v={v} set={setV} /></div>
    </Drawer>
  );
}

// ===== CONTENT · Assessment page =====
// Tabs: Questions · Settings · Versions & history · Preview. `version` picks an older version to read.
const TAB_LIST = [['questions', 'Questions', 'icon-list-checks'], ['settings', 'Settings', 'icon-settings'], ['versions', 'Versions & history', 'icon-history'], ['preview', 'Preview', 'icon-eye']];
function ContentItem({ S, id }) {
  const { go, toast } = S;
  const [versionNo, setVersionNo] = useState(null), [tab, setTab] = useState('questions');
  const { data, error, reload } = useLoad('/api/content/' + id + qs({ version: versionNo }));
  const [act, setAct] = useState(null), [editing, setEditing] = useState(null), [uploading, setUploading] = useState(false);
  if (error) return <Page><PageHeader title="Assessment Content" actions={<Btn icon="icon-arrow-left" onClick={() => go('forms')}>All assessments</Btn>} /><Card><EmptyState icon="icon-triangle-alert" title="This assessment can't be opened" text={error} /></Card></Page>;
  if (!data) return <Page><PageHeader title="Assessment Content" /><Card><EmptyState icon="icon-loader" title="Loading assessment…" /></Card></Page>;
  const a = data.assessment, v = data.version, can = data.can;
  const latest = data.versions[0], onLatest = v.id === latest.id;
  const editable = can.edit && onLatest;
  return (
    <Page>
      <PageHeader title={data.settings.title || a.title}
        description={<span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}><ContentStatus status={a.status} />{v.status !== a.status ? <ContentStatus status={v.status} prefix={'Version ' + v.versionNo} /> : null}<span>{v.status !== a.status ? '' : 'Version ' + v.versionNo + ' · '}{v.questions.length} question{v.questions.length === 1 ? '' : 's'} · {a.source || 'created by ' + a.createdBy}</span></span>}
        actions={<><Btn icon="icon-arrow-left" onClick={() => go('forms')}>All assessments</Btn><WorkflowButtons can={can} editable={editable} onLatest={onLatest} onAct={setAct} onUpload={() => setUploading(true)} /></>} />
      <Notices data={data} onLatest={onLatest} onNewest={() => setVersionNo(null)} />
      <div role="tablist" aria-label="Assessment sections" style={{ background: 'rgba(118,118,128,.12)', borderRadius: '12px', padding: '4px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
        {TAB_LIST.map(([k, label, icon]) => { const on = k === tab; return (
          <button key={k} type="button" role="tab" aria-selected={on} onClick={() => setTab(k)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '8px', height: '34px', padding: '0 12px', border: '0', borderRadius: '7px', cursor: 'pointer', font: '500 14px Inter,sans-serif', color: on ? '#111827' : '#4b5563', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
            <i className={icon} style={{ fontSize: '15px' }}></i>{label}{k === 'questions' && editable && data.issues.length ? <Badge bg="#fee2e2" fg="#b91c1c">{data.issues.length}</Badge> : null}</button>); })}
      </div>
      {tab === 'questions' ? <QuestionsTab data={data} editable={editable} onEdit={setEditing} reload={reload} toast={toast} id={id} /> : null}
      {tab === 'settings' ? <SettingsTab data={data} editable={editable} reload={reload} toast={toast} id={id} /> : null}
      {tab === 'versions' ? <VersionsTab data={data} onView={no => { setVersionNo(no === latest.versionNo ? null : no); setTab('questions'); }} /> : null}
      {tab === 'preview' ? <PreviewTab data={data} /> : null}
      {editing ? <QuestionEditor key={editing.id || 'new'} q={editing} data={data} id={id} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); toast('Question saved'); }} /> : null}
      <BulkUpload open={uploading} id={id} data={data} onClose={() => setUploading(false)} onDone={n => { setUploading(false); reload(); toast(n + ' question' + (n === 1 ? '' : 's') + ' imported'); }} />
      <ActionDialog act={act} data={data} id={id} onClose={() => setAct(null)} onDone={(msg, res) => { setAct(null); if (res && res.versionNo && act === 'new-version') setVersionNo(null); reload(); toast(msg); }} />
    </Page>
  );
}

// ===== CONTENT · Workflow actions =====
// Buttons follow the server's `can` flags; each opens a confirmation (with feedback for return / reject).
function WorkflowButtons({ can, editable, onLatest, onAct, onUpload }) {
  return <>
    {can.upload && onLatest ? <Btn icon="icon-upload" onClick={onUpload}>Bulk upload</Btn> : null}
    {can.newVersion && onLatest ? <Btn icon="icon-copy-plus" onClick={() => onAct('new-version')}>New version</Btn> : null}
    {can.archive ? <Btn kind="danger" icon="icon-archive" onClick={() => onAct('archive')}>Archive</Btn> : null}
    {can.review ? <><Btn icon="icon-undo-2" onClick={() => onAct('return')}>Return for revision</Btn><Btn kind="danger" icon="icon-x" onClick={() => onAct('reject')}>Reject</Btn><Btn kind="primary" icon="icon-check" onClick={() => onAct('approve')}>Approve</Btn></> : null}
    {can.publish ? <Btn kind="primary" icon="icon-rocket" onClick={() => onAct('publish')}>Publish</Btn> : null}
    {editable && can.submit ? <Btn kind="primary" icon="icon-send" onClick={() => onAct('submit')}>Submit for review</Btn> : null}
  </>;
}
const ACT = {
  submit: { title: 'Submit for review?', text: 'An administrator will review this version. You cannot change it while it is waiting for review.', ok: 'Submit for review', done: 'Submitted for review', version: c => c.latestVersionId },
  approve: { title: 'Approve this version?', text: 'Approved content can then be published. The author is told it was approved.', ok: 'Approve', done: 'Approved', version: c => c.submittedVersionId },
  return: { title: 'Return for revision?', text: 'The author gets your feedback, makes changes and submits again.', ok: 'Return for revision', done: 'Returned for revision', feedback: true, version: c => c.submittedVersionId },
  reject: { title: 'Reject this version?', text: 'The author is told it was rejected, with your feedback. They may still revise and resubmit it.', ok: 'Reject', done: 'Rejected', feedback: true, danger: true, version: c => c.submittedVersionId },
  publish: { title: 'Publish this version?', text: 'It becomes the live version that can be assigned. An older live version is retired, but attempts already made keep pointing at it and their results do not change.', ok: 'Publish', done: 'Published', version: c => c.approvedVersionId },
  archive: { title: 'Archive this assessment?', text: 'It can no longer be assigned or started. Attempts and results already recorded stay. Versions still in progress are closed. This cannot be undone here.', ok: 'Archive', done: 'Archived', danger: true, optional: true, version: c => c.latestVersionId },
  'new-version': { title: 'Start a new version?', text: 'The questions are copied into a new Draft. The current version stays exactly as it is until the new one is approved and published.', ok: 'Create new version', done: 'New version created', version: c => c.latestVersionId },
};
function ActionDialog({ act, data, id, onClose, onDone }) {
  const [fb, setFb] = useState(''), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [issues, setIssues] = useState([]);
  useEffect(() => { setFb(''); setErr(''); setIssues([]); }, [act]);
  if (!act) return null;
  const c = ACT[act];
  const go = async () => {
    if (c.feedback && fb.trim().length < 5) { setErr('Write feedback for the author so they know what to change.'); return; }
    setBusy(true); setErr(''); setIssues([]);
    try { const r = await call('POST', '/api/content/' + id + '/action', { action: act, versionId: c.version(data.can), feedback: fb }); onDone(c.done, r); }
    catch (e) { setErr(e.message); setIssues((e.data && e.data.issues) || []); } finally { setBusy(false); }
  };
  return (
    <Confirm open title={c.title} text={c.text} confirmText={c.ok} danger={c.danger} busy={busy} onConfirm={go} onCancel={onClose}>
      {c.feedback || c.optional || act === 'approve' || act === 'publish' ? (
        <Field label={c.feedback ? 'FEEDBACK FOR THE AUTHOR (REQUIRED)' : 'NOTE (OPTIONAL)'}>
          <textarea style={TEXTAREA} value={fb} onChange={e => setFb(e.target.value)} maxLength={LIMITS.feedback} placeholder={c.feedback ? 'What needs to change, and why' : ''} autoFocus />
        </Field>) : null}
      {err ? <div style={ERR} role="alert">{err}</div> : null}
      {issues.length ? <ul style={{ margin: '0', paddingLeft: '18px', maxHeight: '180px', overflow: 'auto', ...ERR }}>{issues.slice(0, 30).map((x, i) => <li key={i}>{x.order ? 'Question ' + x.order + ': ' : ''}{x.message}</li>)}</ul> : null}
    </Confirm>
  );
}

// ===== CONTENT · Notices =====
// Read-only older version, live version while a new one is written, latest reviewer feedback, own-work rule.
function Notices({ data, onLatest, onNewest }) {
  const { can, version: v, versions, history } = data;
  const latest = versions[0], live = versions.find(x => x.status === 'PUBLISHED');
  const fb = history.find(h => h.versionNo === latest.versionNo && ['RETURN', 'REJECT'].includes(h.action));
  const out = [];
  if (!onLatest) out.push(<Banner key="old" icon="icon-history" action={<Btn small onClick={onNewest}>View newest</Btn>}>You are reading version {v.versionNo} ({STATUS_LABEL[v.status].toLowerCase()}). Older versions never change, so attempts made on them keep their results.</Banner>);
  if (onLatest && fb && ['RETURNED', 'REJECTED'].includes(latest.status)) out.push(<Banner key="fb" tone={latest.status === 'REJECTED' ? 'bad' : 'warn'} icon="icon-message-square-warning"><b>{fb.label} by {fb.actor} on {fmtDateTime(fb.at)}.</b> {fb.feedback}{can.edit ? ' Make the changes, then submit again.' : ''}</Banner>);
  if (onLatest && live && live.id !== latest.id && ['DRAFT', 'RETURNED', 'REJECTED', 'SUBMITTED'].includes(latest.status)) out.push(<Banner key="live" icon="icon-shield-check">Version {live.versionNo} is live and stays unchanged. Version {latest.versionNo} only replaces it once it is approved and published.</Banner>);
  if (can.reviewOwn || can.publishOwn) out.push(<Banner key="own" tone="warn" icon="icon-user-x">You created or submitted this version, so another administrator must {can.reviewOwn ? 'review' : 'publish'} it.</Banner>);
  if (data.assessment.status === 'ARCHIVED') out.push(<Banner key="arch" icon="icon-archive">This assessment is archived. It cannot be assigned or started; its results are kept.</Banner>);
  if (latest.status === 'SUBMITTED' && !can.review && !can.reviewOwn) out.push(<Banner key="wait" icon="icon-hourglass">Version {latest.versionNo} is waiting for an administrator's review.</Banner>);
  return out.length ? <div style={{ display: 'grid', gap: '8px' }}>{out}</div> : null;
}

// ===== CONTENT · Questions tab =====
// Problems to fix (live), search, paging and the question cards. Editing only on the author's editable version.
const QPAGE = 15;
function QuestionsTab({ data, editable, onEdit, reload, toast, id }) {
  const [q, setQ] = useState(''), [page, setPage] = useState(1), [del, setDel] = useState(null), [busy, setBusy] = useState(false);
  const list = data.version.questions;
  const rows = useMemo(() => { const t = q.trim().toLowerCase(); return !t ? list : list.filter(x => (x.text + ' ' + (x.skillArea || '') + ' ' + x.competencies.map(c => c.name + ' ' + c.code).join(' ')).toLowerCase().includes(t)); }, [list, q]);
  useEffect(() => { setPage(1); }, [q, data.version.id]);
  const byOrder = useMemo(() => Object.fromEntries(list.map(x => [x.order, x])), [list]);
  const issues = editable ? data.issues : [];
  const move = async (x, dir) => { try { await call('PATCH', '/api/content/' + id + '/questions/' + x.id, { move: dir }); reload(); } catch (e) { toast(e.message); } };
  const remove = async () => { setBusy(true); try { await call('DELETE', '/api/content/' + id + '/questions/' + del.id); setDel(null); reload(); toast('Question deleted'); } catch (e) { toast(e.message); } finally { setBusy(false); } };
  const blank = { type: 'SINGLE_CHOICE', text: '', points: 1, skillArea: '', options: [{ text: '', isCorrect: false }, { text: '', isCorrect: false }], competencies: [] };
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      {issues.length ? (
        <Card title={issues.length + ' problem' + (issues.length === 1 ? '' : 's') + ' to fix before submitting'} sub="Every question needs text, at least 2 options, a correct answer and at least one competency.">
          <ul style={{ margin: '0', paddingLeft: '18px', display: 'grid', gap: '4px', maxHeight: '220px', overflow: 'auto' }}>
            {issues.slice(0, 50).map((x, i) => <li key={i} style={{ fontSize: '13px', color: '#991b1b' }}>
              {x.order && byOrder[x.order] ? <button type="button" style={{ ...LINK, color: '#991b1b', textDecoration: 'underline' }} onClick={() => onEdit(byOrder[x.order])}>Question {x.order}</button> : null}{x.order ? ': ' : ''}{x.message}</li>)}
          </ul>
        </Card>) : editable && list.length ? <Banner tone="good" icon="icon-circle-check">Every question passes the checks. You can submit this version for review.</Banner> : null}
      {data.measured.length ? (
        <Card title="Competencies measured" sub={'Results are worked out per competency. Categories: ' + [...new Set(data.measured.map(c => c.category + ' · ' + c.group))].join(', ')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{data.measured.map(c => <Badge key={c.id} bg="#e6f2ea" fg="#0d3b2a">{c.name} <span style={{ fontWeight: 500, opacity: 0.75 }}>({c.code}, {list.filter(x => x.competencies.some(m => m.competencyId === c.id)).length} q)</span></Badge>)}</div>
        </Card>) : null}
      <Card title={'Questions (' + list.length + ')'} sub={editable ? 'Changes are saved straight away to this draft version.' : 'Read only.'}
        actions={<><Search value={q} onChange={setQ} placeholder="Search questions" style={{ flex: '0 1 240px' }} />{editable ? <Btn kind="primary" icon="icon-plus" onClick={() => onEdit(blank)}>Add question</Btn> : null}</>} flush>
        {!rows.length ? <EmptyState icon="icon-list-checks" title={list.length ? 'No questions match' : 'No questions yet'} text={list.length ? 'Try a different search.' : editable ? 'Add questions one at a time, or use Bulk upload with the Excel template.' : 'This version has no questions.'} />
          : <div style={{ display: 'grid' }}>
              {rows.slice((page - 1) * QPAGE, page * QPAGE).map(x => <QuestionCard key={x.id} x={x} editable={editable} last={list.length} onEdit={() => onEdit(x)} onMove={dir => move(x, dir)} onDelete={() => setDel(x)} problems={issues.filter(i => i.order === x.order)} />)}
              <Pager page={page} size={QPAGE} total={rows.length} onPage={setPage} />
            </div>}
      </Card>
      <Confirm open={!!del} title="Delete this question?" text={del ? 'Question ' + del.order + ': "' + del.text.slice(0, 120) + '". The questions after it move up one place.' : ''} confirmText="Delete" danger busy={busy} onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  );
}

// ===== CONTENT · Question card =====
function QuestionCard({ x, editable, last, onEdit, onMove, onDelete, problems }) {
  return (
    <div style={{ padding: '14px 20px', borderBottom: '1px solid rgba(15,35,65,.07)', display: 'flex', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
      <span style={{ flex: 'none', width: '34px', height: '26px', borderRadius: '8px', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '600 12px Inter,sans-serif', color: '#374151' }}>{x.order}</span>
      <div style={{ flex: '1 1 280px', minWidth: '0', display: 'grid', gap: '8px' }}>
        <div style={{ fontSize: '14px', color: '#111827', lineHeight: 1.45 }}>{x.text}</div>
        {x.type === 'TEXT' ? <div style={MUTED}><i className="icon-pen-line" style={{ fontSize: '12px' }}></i> Written answer, marked manually (shows as Pending until marked).</div> : (
          <div style={{ display: 'grid', gap: '4px' }}>
            {x.options.map((o, i) => <div key={o.id || i} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '13px', color: o.isCorrect ? '#15803d' : '#374151', fontWeight: o.isCorrect ? 600 : 400 }}>
              <span style={{ flex: 'none', width: '18px', color: '#6b7280', fontWeight: 600 }}>{String.fromCharCode(65 + i)}</span><span style={{ minWidth: '0' }}>{o.text}</span>
              {o.isCorrect ? <Badge bg="#dcfce7" fg="#15803d"><i className="icon-check" style={{ fontSize: '11px' }}></i>Correct</Badge> : null}</div>)}
          </div>)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <Badge>{TYPE_LABEL[x.type]}</Badge><Badge>{x.points} point{x.points === 1 ? '' : 's'}</Badge>
          {x.skillArea ? <Badge bg="#f5f3ff" fg="#5b21b6">{x.skillArea}</Badge> : null}
          {x.competencies.map(c => <Badge key={c.competencyId} bg="#e6f2ea" fg="#0d3b2a">{c.name || c.code}{c.weight !== 1 ? ' × ' + c.weight : ''}</Badge>)}
          {!x.competencies.length ? <Badge bg="#fee2e2" fg="#b91c1c">No competency</Badge> : null}
        </div>
        {problems.length ? <div style={ERR} role="alert"><i className="icon-triangle-alert" style={{ fontSize: '12px' }}></i> {problems.map(p => p.message).join(' ')}</div> : null}
      </div>
      {editable ? (
        <div style={{ display: 'flex', gap: '4px', flex: 'none' }}>
          <Btn small icon="icon-arrow-up" title="Move up" disabled={x.order <= 1} onClick={() => onMove('up')} />
          <Btn small icon="icon-arrow-down" title="Move down" disabled={x.order >= last} onClick={() => onMove('down')} />
          <Btn small icon="icon-pencil" onClick={onEdit}>Edit</Btn>
          <Btn small kind="danger" icon="icon-trash-2" title="Delete question" onClick={onDelete} />
        </div>) : null}
    </div>
  );
}

// ===== CONTENT · Question editor =====
// Drawer for one question: type, text, options with the correct answer(s), points, skill area and competency mapping.
// The same checks as the server run live (questionProblems from lib/server/content.js).
function QuestionEditor({ q, data, id, onClose, onSaved }) {
  const [v, setV] = useState(() => ({ ...q, skillArea: q.skillArea || '', options: q.options.map(o => ({ text: o.text, isCorrect: o.isCorrect })), competencies: q.competencies.map(c => ({ competencyId: c.competencyId, weight: c.weight })) }));
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [tried, setTried] = useState(false);
  const compById = useMemo(() => new Map(data.competencies.map(c => [c.id, c])), [data.competencies]);
  const problems = questionProblems(normaliseQuestion(v), compById);
  const setType = t => setV(s => ({ ...s, type: t,
    options: t === 'TRUE_FALSE' ? [{ text: 'True', isCorrect: s.options[0] && /true/i.test(s.options[0].text) ? s.options[0].isCorrect : false }, { text: 'False', isCorrect: false }]
      : t === 'TEXT' ? [] : s.type === 'TRUE_FALSE' || !s.options.length ? [{ text: '', isCorrect: false }, { text: '', isCorrect: false }]
      : t === 'SINGLE_CHOICE' ? s.options.map((o, i) => ({ ...o, isCorrect: o.isCorrect && i === s.options.findIndex(p => p.isCorrect) })) : s.options }));
  const setOpt = (i, patch) => setV(s => ({ ...s, options: s.options.map((o, j) => j === i ? { ...o, ...patch } : patch.isCorrect && s.type !== 'MULTIPLE_CHOICE' ? { ...o, isCorrect: false } : o) }));
  const setComp = (i, patch) => setV(s => ({ ...s, competencies: s.competencies.map((c, j) => j === i ? { ...c, ...patch } : c) }));
  const used = new Set(v.competencies.map(c => Number(c.competencyId)));
  const compOptions = data.competencies.filter(c => c.active || used.has(c.id)).map(c => ({ value: String(c.id), label: c.name + ' (' + c.code + ')' + (c.active ? '' : ' · retired'), group: c.category + ' · ' + c.group }));
  const areas = [...new Set(v.competencies.flatMap(c => (compById.get(Number(c.competencyId)) || {}).skillAreas || []))];
  const save = async () => {
    setTried(true); if (problems.length) return;
    setBusy(true); setErr('');
    const body = { type: v.type, text: v.text, skillArea: v.skillArea, points: Number(v.points), options: v.options, competencies: v.competencies.map(c => ({ competencyId: Number(c.competencyId), weight: Number(c.weight) })) };
    try { await call(q.id ? 'PATCH' : 'POST', '/api/content/' + id + '/questions' + (q.id ? '/' + q.id : ''), body); onSaved(); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const multi = v.type === 'MULTIPLE_CHOICE';
  return (
    <Drawer open title={q.id ? 'Edit question ' + q.order : 'Add question'} sub={'Version ' + data.version.versionNo + ' · ' + STATUS_LABEL[data.version.status]} onClose={onClose} width={720}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{err ? <span style={ERR} role="alert">{err}</span> : null}<Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save question'}</Btn></div>}>
      <div style={{ padding: '18px 22px', display: 'grid', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Field label="QUESTION TYPE" style={{ flex: '2 1 220px' }}><Sel value={v.type} onChange={setType} options={Object.entries(TYPE_LABEL)} /></Field>
          <Field label="POINTS" style={{ flex: '1 1 100px' }}><input type="number" min="0.5" step="0.5" max={LIMITS.points} style={INPUT} value={v.points} onChange={e => setV({ ...v, points: e.target.value })} /></Field>
        </div>
        <Field label="QUESTION"><textarea style={TEXTAREA} value={v.text} maxLength={LIMITS.text} onChange={e => setV({ ...v, text: e.target.value })} placeholder="Type the question as staff will see it" autoFocus /></Field>
        {v.type === 'TEXT' ? <Banner icon="icon-pen-line">Written answers are not marked automatically. They show as Pending until someone marks them, and never count as 0.</Banner> : (
          <div style={{ display: 'grid', gap: '8px' }}>
            <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>ANSWER OPTIONS · {multi ? 'TICK EVERY CORRECT ANSWER' : 'PICK THE ONE CORRECT ANSWER'}</div>
            {v.options.map((o, i) => (
              <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button type="button" onClick={() => setOpt(i, { isCorrect: multi ? !o.isCorrect : true })} aria-pressed={o.isCorrect} title={o.isCorrect ? 'Correct answer' : 'Mark as correct'}
                  style={{ flex: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px', height: '36px', padding: '0 10px', borderRadius: '10px', cursor: 'pointer', font: '600 12px Inter,sans-serif', border: o.isCorrect ? '1px solid #15904c' : '1px solid rgba(15,35,65,.14)', background: o.isCorrect ? '#dcfce7' : '#fff', color: o.isCorrect ? '#15803d' : '#6b7280' }}>
                  <i className={o.isCorrect ? 'icon-circle-check' : multi ? 'icon-square' : 'icon-circle'} style={{ fontSize: '14px' }}></i>{String.fromCharCode(65 + i)}{o.isCorrect ? ' · Correct' : ''}</button>
                <input style={{ ...INPUT, flex: '1' }} value={o.text} maxLength={LIMITS.option} disabled={v.type === 'TRUE_FALSE'} onChange={e => setOpt(i, { text: e.target.value })} placeholder={'Option ' + String.fromCharCode(65 + i)} aria-label={'Option ' + String.fromCharCode(65 + i)} />
                {v.type !== 'TRUE_FALSE' ? <Btn small kind="ghost" icon="icon-x" title="Remove option" disabled={v.options.length <= 2} onClick={() => setV(s => ({ ...s, options: s.options.filter((_, j) => j !== i) }))} /> : null}
              </div>))}
            {v.type !== 'TRUE_FALSE' && v.options.length < LIMITS.options ? <div><Btn small icon="icon-plus" onClick={() => setV(s => ({ ...s, options: [...s.options, { text: '', isCorrect: false }] }))}>Add option</Btn></div> : null}
          </div>)}
        <div style={{ display: 'grid', gap: '8px' }}>
          <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>COMPETENCIES THIS QUESTION MEASURES</div>
          {v.competencies.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
              <Sel value={String(c.competencyId)} onChange={x => setComp(i, { competencyId: Number(x) })} options={compOptions.filter(o => o.value === String(c.competencyId) || !used.has(Number(o.value)))} style={{ flex: '1 1 260px' }} title="Competency" />
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', ...MUTED }}>Weight<input type="number" min="0.1" step="0.1" max={LIMITS.weight} style={{ ...INPUT, width: '80px' }} value={c.weight} onChange={e => setComp(i, { weight: e.target.value })} aria-label="Weight" /></label>
              <Btn small kind="ghost" icon="icon-x" title="Remove competency" onClick={() => setV(s => ({ ...s, competencies: s.competencies.filter((_, j) => j !== i) }))} />
            </div>))}
          {v.competencies.length < LIMITS.competencies ? <div><Btn small icon="icon-plus" onClick={() => { const first = compOptions.find(o => !used.has(Number(o.value)) && compById.get(Number(o.value)).active); if (first) setV(s => ({ ...s, competencies: [...s.competencies, { competencyId: Number(first.value), weight: 1 }] })); }}>Add competency</Btn></div> : null}
          <span style={MUTED}>Weight 1 = normal. A higher weight is recorded with the mapping so its effect is visible and documented, never hidden.</span>
        </div>
        <Field label="SKILL AREA (OPTIONAL)" hint={areas.length ? 'Suggestions come from the mapped competencies.' : 'A sub-topic used for grouping, e.g. "Survey Design".'}>
          <input style={INPUT} list="skm-skill-areas" value={v.skillArea} maxLength={LIMITS.skillArea} onChange={e => setV({ ...v, skillArea: e.target.value })} />
          <datalist id="skm-skill-areas">{areas.map(a => <option key={a} value={a} />)}</datalist>
        </Field>
        {tried && problems.length ? <Banner tone="bad" icon="icon-triangle-alert"><b>Fix these first:</b><ul style={{ margin: '4px 0 0', paddingLeft: '18px' }}>{problems.map(p => <li key={p}>{p}</li>)}</ul></Banner>
          : problems.length ? <div style={MUTED}>Still needed: {problems.join(' ')}</div> : null}
      </div>
    </Drawer>
  );
}

// ===== CONTENT · Bulk upload =====
// 1 download the template · 2 pick an .xlsx / .csv file (read in the browser) · 3 the server checks every row and lists
// problems by row number · 4 import, only when every row is valid, in one transaction.
const MAX_FILE = 2 * 1024 * 1024;
function BulkUpload({ open, id, data, onClose, onDone }) {
  const [file, setFile] = useState(null), [rows, setRows] = useState(null), [replace, setReplace] = useState(false);
  const [check, setCheck] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState(''), [confirm, setConfirm] = useState(false);
  useEffect(() => { if (open) { setFile(null); setRows(null); setCheck(null); setErr(''); setReplace(false); } }, [open]);
  const run = async (mode, r = rows, rep = replace) => {
    setBusy(true); setErr('');
    try { const d = await call('POST', '/api/content/' + id + '/import', { mode, rows: r, replace: rep, fileName: file ? file.name : '' }); if (mode === 'import') { setConfirm(false); onDone(d.imported); } else setCheck(d); }
    catch (e) { setErr(e.message); if (e.data && e.data.errors) setCheck(e.data); setConfirm(false); } finally { setBusy(false); }
  };
  const pick = async f => {
    setFile(f); setRows(null); setCheck(null); setErr('');
    if (!f) return;
    if (!/\.(xlsx|xls|csv)$/i.test(f.name)) { setErr('Choose an Excel (.xlsx) or CSV file.'); return; }
    if (f.size > MAX_FILE) { setErr('The file is larger than 2 MB. Split it into smaller files.'); return; }
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false });
      const name = wb.SheetNames.find(n => /question/i.test(n)) || wb.SheetNames[0];
      const all = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false, blankrows: false });
      const r = all.map(row => row.slice(0, 30).map(c => String(c == null ? '' : c).slice(0, LIMITS.text + 50)));
      if (r.length > LIMITS.importRows + 1) { setErr('The file has more than ' + LIMITS.importRows + ' rows. Split it into smaller files.'); return; }
      setRows(r); run('check', r);
    } catch (e) { setErr('This file could not be read. Save it as .xlsx or .csv from the template and try again.'); }
  };
  const clean = check && !check.fileErrors.length && !check.errors.length && check.valid > 0;
  return (
    <Drawer open={open} title="Bulk upload questions" sub={'Into version ' + data.version.versionNo + ' (' + STATUS_LABEL[data.version.status].toLowerCase() + '). Nothing is imported until every row is valid.'} onClose={onClose} width={860}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {check ? <span style={clean ? { ...MUTED, color: '#15803d' } : ERR}>{clean ? check.valid + ' question' + (check.valid === 1 ? '' : 's') + ' ready to import' : 'Fix the problems and upload the file again'}</span> : null}
        <Btn onClick={onClose}>Close</Btn><Btn kind="primary" icon="icon-upload" disabled={!clean || busy} onClick={() => setConfirm(true)}>Import {clean ? check.valid : ''} question{clean && check.valid === 1 ? '' : 's'}</Btn></div>}>
      <div style={{ padding: '18px 22px', display: 'grid', gap: '16px' }}>
        <Card title="1. Download the template" sub="One question per row. The Competencies sheet lists every code you can use.">
          <a href="/api/content/template" download style={{ textDecoration: 'none' }}><Btn icon="icon-download">Download Excel template</Btn></a>
        </Card>
        <Card title="2. Upload your file" sub="Excel (.xlsx) or CSV, up to 2 MB and 1,000 questions.">
          <div style={{ display: 'grid', gap: '10px' }}>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={e => pick(e.target.files && e.target.files[0])} aria-label="Question file" style={{ font: '400 13px Inter,sans-serif' }} />
            <Toggle on={replace} onClick={() => { const r = !replace; setReplace(r); if (rows) run('check', rows, r); }} label="Replace the questions already in this version" desc={replace ? 'All ' + data.version.questions.length + ' current questions will be removed first.' : 'New questions are added after the ' + data.version.questions.length + ' already there.'} />
            {busy ? <span style={MUTED}>Checking…</span> : null}
            {err ? <div style={ERR} role="alert">{err}</div> : null}
          </div>
        </Card>
        {check ? (
          <Card title="3. Check results" sub={check.total + ' row' + (check.total === 1 ? '' : 's') + ' read · ' + check.valid + ' valid · ' + check.errors.length + ' with problems'} flush>
            {check.fileErrors.length ? <div style={{ padding: '14px 20px' }}><Banner tone="bad" icon="icon-file-x"><ul style={{ margin: 0, paddingLeft: '18px' }}>{check.fileErrors.map(m => <li key={m}>{m}</li>)}</ul></Banner></div> : null}
            {check.errors.length ? <DataTable minWidth={620} maxHeight="360px" rows={check.errors} rowKey={r => r.row} columns={[
              { key: 'row', label: 'Row', width: '60px' }, { key: 'text', label: 'Question', render: r => <span style={{ fontSize: '12.5px' }}>{r.text || <i style={{ color: '#9ca3af' }}>(no text)</i>}</span> },
              { key: 'messages', label: 'Problems', render: r => <ul style={{ margin: 0, paddingLeft: '16px', ...ERR }}>{r.messages.map(m => <li key={m}>{m}</li>)}</ul> }]} />
              : clean ? <div style={{ padding: '14px 20px' }}><Banner tone="good" icon="icon-circle-check">Every row is valid. First rows: {check.preview.map(p => '"' + p.text.slice(0, 50) + '"').join(', ')}{check.valid > check.preview.length ? '…' : ''}</Banner></div> : null}
          </Card>) : null}
      </div>
      <Confirm open={confirm} title={'Import ' + (check ? check.valid : 0) + ' questions?'} text={replace ? 'The ' + data.version.questions.length + ' questions already in this version are replaced.' : 'They are added after the existing questions.'} confirmText="Import" busy={busy} onConfirm={() => run('import')} onCancel={() => setConfirm(false)} />
    </Drawer>
  );
}

// ===== CONTENT · Settings tab =====
// Title, description, instructions, attempt limit and result release. While a version is live, saved changes wait
// for the new version to be published (the server keeps them aside).
function SettingsTab({ data, editable, reload, toast, id }) {
  const [v, setV] = useState(data.settings), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { setV(data.settings); }, [data.settings]);
  const live = data.versions.some(x => x.status === 'PUBLISHED');
  const save = async () => {
    setBusy(true); setErr('');
    try { const r = await call('PATCH', '/api/content/' + id, { ...v, description: v.description || '', instructions: v.instructions || '', maxAttempts: Number(v.maxAttempts) }); reload(); toast(r.pending ? 'Saved; applies when the new version is published' : 'Settings saved'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', alignItems: 'start' }}>
      <Card title="Assessment settings" sub={editable ? (live ? 'Saved changes apply when this new version is published; the live version keeps its current settings.' : 'Saved with this draft.') : 'Read only. Start a new version to change published content.'}
        actions={editable ? <Btn kind="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</Btn> : null}>
        <SettingsFields v={v} set={setV} disabled={!editable} />
        {data.settingsPending ? <div style={{ ...MUTED, marginTop: '10px' }}><i className="icon-clock" style={{ fontSize: '12px' }}></i> These settings are waiting for version {data.versions[0].versionNo} to be published.</div> : null}
        {err ? <div style={{ ...ERR, marginTop: '10px' }} role="alert">{err}</div> : null}
      </Card>
      <Card title="Where the rest is set">
        <div style={{ display: 'grid', gap: '8px', fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
          <div><b>Who takes it, start date and deadline:</b> Assignments & Deadlines, once this assessment is published.</div>
          <div><b>Scoring:</b> each question earns its points; results are worked out per competency on the 0–5 scale using the active scoring configuration (Competent from 4.00, Proficient at 5.00).</div>
          <div><b>Competency category:</b> {data.measured.length ? [...new Set(data.measured.map(c => c.category + ' · ' + c.group))].join(', ') : 'set by the competencies the questions are mapped to.'}</div>
          <div><b>Created:</b> {fmtDateTime(data.assessment.createdAt)} by {data.assessment.createdBy}</div>
        </div>
      </Card>
    </div>
  );
}

// ===== CONTENT · Versions & history tab =====
function VersionsTab({ data, onView }) {
  const cols = [
    { key: 'versionNo', label: 'Version', render: r => <b>v{r.versionNo}</b> },
    { key: 'status', label: 'Status', render: r => <ContentStatus status={r.status} /> },
    { key: 'author', label: 'Author' },
    { key: 'questions', label: 'Questions', align: 'right' },
    { key: 'attempts', label: 'Attempts', align: 'right' },
    { key: 'approved', label: 'Approved', render: r => r.approvedAt ? <span>{fmtDate(r.approvedAt)}<div style={MUTED}>{r.approvedBy || ''}</div></span> : '—' },
    { key: 'published', label: 'Published', render: r => r.publishedAt ? <span>{fmtDate(r.publishedAt)}<div style={MUTED}>{r.publishedBy || ''}</div></span> : '—' },
    { key: 'view', label: '', render: r => r.visible ? <Btn small icon="icon-eye" onClick={() => onView(r.versionNo)}>{r.id === data.version.id ? 'Viewing' : 'View'}</Btn> : <span style={MUTED}>Not shared yet</span> },
  ];
  return (
    <div style={{ display: 'grid', gap: '16px' }}>
      <Card title="Versions" sub="Published content is never edited. Each change goes through review as a new version; attempts keep pointing at the version they used." flush>
        <DataTable columns={cols} rows={data.versions} rowKey={r => r.id} minWidth={760} />
      </Card>
      <Card title="Review history" sub="Who did what, when, with the reviewer's feedback.">
        {!data.history.length ? <EmptyState icon="icon-history" title="No history yet" /> : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
            {data.history.map(h => (
              <li key={h.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ flex: 'none', width: '28px', height: '28px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' }}>
                  <i className={{ CREATE: 'icon-file-plus', SUBMIT: 'icon-send', APPROVE: 'icon-check', REJECT: 'icon-x', RETURN: 'icon-undo-2', PUBLISH: 'icon-rocket', ARCHIVE: 'icon-archive', SUPERSEDE: 'icon-history' }[h.action] || 'icon-dot'} style={{ fontSize: '13px' }}></i></span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '13.5px' }}><b>{h.label}</b> · version {h.versionNo} · {h.actor}</div>
                  <div style={MUTED}>{fmtDateTime(h.at)}</div>
                  {h.feedback ? <div style={{ marginTop: '4px', fontSize: '13px', color: '#374151', background: '#f9fafb', borderRadius: '10px', padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{h.feedback}</div> : null}
                </div>
              </li>))}
          </ol>)}
      </Card>
    </div>
  );
}

// ===== CONTENT · Preview tab =====
// The assessment as a participant sees it. Answers live only in this component: nothing is saved, scored or recorded.
const PPAGE = 10;
function PreviewTab({ data }) {
  const [ans, setAns] = useState({}), [page, setPage] = useState(1);
  const list = data.version.questions, s = data.settings;
  const pick = (q, oi) => setAns(a => ({ ...a, [q.id]: q.type === 'MULTIPLE_CHOICE' ? ((a[q.id] || []).includes(oi) ? a[q.id].filter(x => x !== oi) : [...(a[q.id] || []), oi]) : [oi] }));
  const answered = list.filter(q => q.type === 'TEXT' ? (ans[q.id] || '').trim() : (ans[q.id] || []).length).length;
  return (
    <div style={{ display: 'grid', gap: '16px', maxWidth: '860px' }}>
      <Banner icon="icon-eye" action={<Btn small onClick={() => { setAns({}); setPage(1); }}>Clear answers</Btn>}>Preview of version {data.version.versionNo}. Nothing you choose here is saved, scored or counted as an attempt.</Banner>
      <Card title={s.title} sub={list.length + ' questions · up to ' + s.maxAttempts + ' attempt' + (Number(s.maxAttempts) === 1 ? '' : 's') + ' · no time limit · ' + answered + ' answered'}>
        {s.description ? <p style={{ margin: '0 0 8px', fontSize: '13.5px', color: '#374151' }}>{s.description}</p> : null}
        <div style={{ fontSize: '13.5px', color: '#374151', whiteSpace: 'pre-wrap' }}>{s.instructions || 'Answer every question, then submit. Your answers are saved as you go.'}</div>
      </Card>
      {!list.length ? <Card><EmptyState icon="icon-list-checks" title="No questions to preview yet" /></Card> : list.slice((page - 1) * PPAGE, page * PPAGE).map(q => (
        <Card key={q.id}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <div style={{ ...MUTED, fontWeight: 600 }}>Question {q.order} of {list.length}{q.type === 'MULTIPLE_CHOICE' ? ' · choose all that apply' : ''}</div>
            <div style={{ fontSize: '15px', color: '#111827', lineHeight: 1.5 }}>{q.text}</div>
            {q.type === 'TEXT' ? <textarea style={TEXTAREA} value={ans[q.id] || ''} onChange={e => setAns(a => ({ ...a, [q.id]: e.target.value }))} placeholder="Type your answer" aria-label={'Answer to question ' + q.order} />
              : <div role={q.type === 'MULTIPLE_CHOICE' ? 'group' : 'radiogroup'} style={{ display: 'grid', gap: '6px' }}>
                {q.options.map((o, i) => { const on = (ans[q.id] || []).includes(i); return (
                  <button key={o.id || i} type="button" role={q.type === 'MULTIPLE_CHOICE' ? 'checkbox' : 'radio'} aria-checked={on} onClick={() => pick(q, i)}
                    style={{ display: 'flex', gap: '10px', alignItems: 'center', textAlign: 'left', padding: '10px 12px', borderRadius: '12px', cursor: 'pointer', font: '400 14px Inter,sans-serif', color: '#111827', border: on ? '1px solid #15904c' : '1px solid rgba(15,35,65,.12)', background: on ? '#f0fdf4' : '#fff' }}>
                    <i className={q.type === 'MULTIPLE_CHOICE' ? (on ? 'icon-square-check' : 'icon-square') : on ? 'icon-circle-dot' : 'icon-circle'} style={{ fontSize: '16px', color: on ? '#15904c' : '#9ca3af' }}></i>{o.text}</button>); })}
              </div>}
          </div>
        </Card>))}
      <Pager page={page} size={PPAGE} total={list.length} onPage={p => { setPage(p); try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) {} }} />
    </div>
  );
}
