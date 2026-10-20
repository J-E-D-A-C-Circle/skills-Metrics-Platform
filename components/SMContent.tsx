'use client';
// =============================================================================
// SMContent.jsx · Assessment Content: the list of assessments, New assessment (with who it is for), and the page
//   around the Form Builder for one assessment (notices, workflow, bulk upload, settings)
// Screen / URL: "/forms" (list of assessments) and "/forms?id=<assessment id>" (one assessment, in the Form Builder)
// Who sees it: anyone with "View assessment content" (Assessment Creators, Administrators). Creating, editing,
//   reviewing, publishing and archiving each need their own permission; the server checks every action again
//   (app/api/content/**), including the hard rule that nobody approves or publishes their own work.
// Used by: SkillMatrixApp.jsx (page "forms", props S = { me, go, id, vw, toast, ... })
// Depends on: smUI (Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable,
//   Drawer, INPUT), smApi (useLoad, qs, fmtDate, fmtDateTime), SMFormBuilder.jsx (the builder itself),
//   lib/server/content.js (shared pure rules: labels, audience checks), xlsx (loaded only when a file is uploaded;
//   the browser reads it, the server checks rows), GET /api/lookups and /api/assignments/staff (audience pickers)
// Sections (search for these markers): CONTENT · Helpers, CONTENT · Status badge, CONTENT · List page,
//   CONTENT · New assessment drawer, CONTENT · Who it is for (planned audience), CONTENT · Assessment page,
//   CONTENT · Workflow actions, CONTENT · Notices, CONTENT · Bulk upload, CONTENT · Settings tab,
//   CONTENT · Settings tab · Who it is for
// =============================================================================
import React, { useEffect, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable, Drawer, INPUT } from './smUI';
import { useLoad, qs, fmtDate, fmtDateTime } from './smApi';
import { STATUS_LABEL, STATUS_COLOURS, RELEASE_LABEL, LIMITS, AUDIENCE_TARGETS, AUDIENCE_LABEL, audienceProblems } from '../lib/server/content';
import SMFormBuilder from './SMFormBuilder';

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
const can_ = can; // inside ContentItem `can` is the server's list of allowed actions
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
      <NewAssessment open={creating} canPickPeople={can(me, 'cycles.assign')} deptIds={me ? me.deptIds : null} onClose={() => setCreating(false)} onMade={nid => { S.toast('Draft created'); go('forms', undefined, nid); }} />
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
function NewAssessment({ open, onClose, onMade, canPickPeople, deptIds }) {
  const blank = { title: '', description: '', instructions: '', maxAttempts: 3, resultRelease: 'IMMEDIATE' };
  const [v, setV] = useState(blank), [aud, setAud] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  useEffect(() => { if (open) { setV(blank); setAud(null); setErr(''); } }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const audErr = audienceError(aud);
  const save = async () => {
    if (audErr) { setErr(audErr); return; }
    setBusy(true); setErr('');
    try { const d = await call('POST', '/api/content', { ...v, maxAttempts: Number(v.maxAttempts), audience: audienceBody(aud) }); onClose(); onMade(d.id); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <Drawer open={open} title="New assessment" sub="Starts as a Draft (version 1). Choose who it is for, then build the questions in the Form Builder and submit it for review." onClose={onClose} width={680}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>{err ? <span style={ERR}>{err}</span> : null}<Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" disabled={busy || v.title.trim().length < 3} onClick={save}>{busy ? 'Creating…' : 'Create and open the Form Builder'}</Btn></div>}>
      <div style={{ padding: '18px 22px', display: 'grid', gap: '22px' }}>
        <SettingsFields v={v} set={setV} />
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ font: '600 13px Inter,sans-serif', color: '#111827' }}>Who it is for</div>
          <AudienceFields aud={aud} set={setAud} canPickPeople={canPickPeople} deptIds={deptIds} />
        </div>
      </div>
    </Drawer>
  );
}

// ===== CONTENT · Who it is for (planned audience) =====
// Department, grade, station, location or individual staff (only for people who may assign), plus start and deadline.
// Nothing is assigned until a version is published: then the assignments are made and staff are told
// (lib/server/audience.js). aud = null (decide later) | { targetType, targetIds, names: { id: name }, start, end }.
const dayStr = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
const fromDay = (s, end) => { const [y, m, d] = String(s || '').split('-').map(Number); if (!y || !m || !d) return null; return end ? new Date(y, m - 1, d, 23, 59, 0) : new Date(y, m - 1, d, 0, 0, 0); };
export function audienceBody(aud) {
  if (!aud || !aud.targetType) return null;
  const s = fromDay(aud.start), e = fromDay(aud.end, true);
  return { targetType: aud.targetType, targetIds: aud.targetIds, startsAt: s ? s.toISOString() : '', deadline: e ? e.toISOString() : '' };
}
const audienceError = aud => { const b = audienceBody(aud); return b ? audienceProblems(b)[0] || '' : ''; };
export const audienceState = plan => (plan && plan.targetType ? { targetType: plan.targetType, targetIds: plan.targetIds || [], names: Object.fromEntries((plan.names || []).map(n => [n.id, n.name])), start: dayStr(plan.startsAt), end: dayStr(plan.deadline) } : null);
const LIST_OF = { DEPARTMENT: 'departments', GRADE: 'grades', STATION: 'stations', LOCATION: 'locations' };
// deptIds: the departments the signed-in person may see (null = all). Someone limited to their own department(s)
// only gets those departments, and no grade / station / location (they reach across departments).
function AudienceFields({ aud, set, canPickPeople, deptIds, disabled }) {
  const limited = Array.isArray(deptIds);
  const lk = useLoad('/api/lookups');
  const [q, setQ] = useState(''), [found, setFound] = useState([]);
  const type = aud ? aud.targetType : '';
  useEffect(() => {
    if (type !== 'INDIVIDUAL' || q.trim().length < 2) { setFound([]); return undefined; }
    const t = setTimeout(() => { call('GET', '/api/assignments/staff' + qs({ q })).then(d => setFound(d.staff || [])).catch(() => setFound([])); }, 300);
    return () => clearTimeout(t);
  }, [q, type]);
  const pickType = t => { setQ(''); set(t ? { targetType: t, targetIds: [], names: {}, start: (aud && aud.start) || dayStr(new Date()), end: (aud && aud.end) || dayStr(Date.now() + 14 * 864e5) } : null); };
  const toggle = (id, name) => set({ ...aud, targetIds: aud.targetIds.includes(id) ? aud.targetIds.filter(x => x !== id) : [...aud.targetIds, id], names: { ...aud.names, [id]: name } });
  const list = type && type !== 'INDIVIDUAL' && lk.data ? (lk.data[LIST_OF[type]] || []).filter(x => (x.active !== false || (aud.targetIds || []).includes(x.id)) && (!limited || type !== 'DEPARTMENT' || deptIds.includes(x.id) || (aud.targetIds || []).includes(x.id))) : [];
  const shown = list.filter(x => !q.trim() || x.name.toLowerCase().includes(q.trim().toLowerCase()));
  const types = [['', 'Decide later (on the Assignments page)'], ...AUDIENCE_TARGETS.filter(t => (t !== 'INDIVIDUAL' || canPickPeople) && (!limited || t === 'DEPARTMENT' || t === 'INDIVIDUAL')).map(t => [t, AUDIENCE_LABEL[t]])];
  return (
    <div style={{ display: 'grid', gap: '12px' }}>
      <Field label="ASSIGN TO" hint="Nothing is assigned yet. When an administrator publishes the assessment, it is assigned to these people and they are told.">
        <Sel value={type} onChange={pickType} options={types} disabled={disabled} title="Assign to" /></Field>
      {type && type !== 'INDIVIDUAL' ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          {list.length > 8 ? <Search value={q} onChange={setQ} placeholder={'Search ' + AUDIENCE_LABEL[type].toLowerCase() + 's'} /> : null}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(200px,1fr))', gap: '6px', maxHeight: '220px', overflowY: 'auto', padding: '2px' }}>
            {!lk.data ? <span style={MUTED}>Loading…</span> : shown.map(x => { const on = aud.targetIds.includes(x.id); return (
              <button key={x.id} type="button" disabled={disabled} onClick={() => toggle(x.id, x.name)} aria-pressed={on}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '10px', cursor: disabled ? 'default' : 'pointer', textAlign: 'left', font: '500 13px Inter,sans-serif', color: '#111827', border: on ? '1px solid #15904c' : '1px solid rgba(15,35,65,.12)', background: on ? '#f0fdf4' : '#fff' }}>
                <i className={on ? 'icon-square-check' : 'icon-square'} style={{ fontSize: '15px', color: on ? '#15904c' : '#9ca3af' }}></i>{x.name}</button>); })}
          </div>
          <span style={MUTED}>{aud.targetIds.length} chosen</span>
        </div>) : null}
      {type === 'INDIVIDUAL' ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          {!disabled ? <Search value={q} onChange={setQ} placeholder="Search staff by name or staff ID (2+ letters)" /> : null}
          {found.length ? <div style={{ display: 'grid', gap: '4px', maxHeight: '180px', overflowY: 'auto' }}>{found.map(s => { const on = aud.targetIds.includes(s.id); return (
            <button key={s.id} type="button" onClick={() => toggle(s.id, s.name + ' (' + s.staffNo + ')')} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', padding: '7px 10px', borderRadius: '9px', border: '1px solid rgba(15,35,65,.1)', background: on ? '#f0fdf4' : '#fff', cursor: 'pointer', font: '400 13px Inter,sans-serif', textAlign: 'left' }}>
              <span>{s.name} <span style={MUTED}>({s.staffNo}{s.department ? ' · ' + s.department : ''})</span></span><span style={{ color: '#127a42', fontWeight: 600 }}>{on ? 'Added' : 'Add'}</span></button>); })}</div> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{aud.targetIds.map(id => <Badge key={id} bg="#e6f2ea" fg="#0d3b2a">{aud.names[id] || 'Staff member'}{!disabled ? <button type="button" onClick={() => toggle(id)} title="Remove" style={{ border: 0, background: 'none', cursor: 'pointer', color: '#0d3b2a', padding: 0, display: 'flex' }}><i className="icon-x" style={{ fontSize: '11px' }}></i></button> : null}</Badge>)}{!aud.targetIds.length ? <span style={MUTED}>No one added yet.</span> : null}</div>
        </div>) : null}
      {type ? (
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Field label="OPENS ON" style={{ flex: '1 1 160px' }}><input type="date" style={INPUT} value={aud.start} disabled={disabled} onChange={e => set({ ...aud, start: e.target.value })} /></Field>
          <Field label="DEADLINE (END OF DAY)" style={{ flex: '1 1 160px' }}><input type="date" style={INPUT} value={aud.end} disabled={disabled} onChange={e => set({ ...aud, end: e.target.value })} /></Field>
        </div>) : null}
      {type && audienceError(aud) ? <span style={ERR}>{audienceError(aud)}</span> : null}
    </div>
  );
}

// ===== CONTENT · Assessment page =====
// The Form Builder (components/SMFormBuilder.jsx) for one version: Build, Rubric & Scoring, Preview & Test, Versions
// and Settings. The workflow buttons sit in the builder toolbar; the notices and the version picker stay here.
function ContentItem({ S, id }) {
  const { go, toast, me } = S;
  const [versionNo, setVersionNo] = useState(null);
  const { data, error, reload } = useLoad('/api/content/' + id + qs({ version: versionNo }));
  const list = useLoad('/api/content' + qs({ size: 50 }));
  const [act, setAct] = useState(null), [uploading, setUploading] = useState(false), [creating, setCreating] = useState(false);
  const header = actions => <PageHeader title="Form Builder" description="Build assessment forms by dragging question types onto the canvas. Each question shows exactly what staff will see." actions={actions} />;
  if (error) return <Page>{header(<Btn icon="icon-arrow-left" onClick={() => go('forms')}>All assessments</Btn>)}<Card><EmptyState icon="icon-triangle-alert" title="This assessment can't be opened" text={error} /></Card></Page>;
  if (!data) return <Page>{header(null)}<Card><EmptyState icon="icon-loader" title="Loading assessment…" /></Card></Page>;
  const a = data.assessment, v = data.version, can = data.can;
  const latest = data.versions[0], onLatest = v.id === latest.id;
  const editable = can.edit && onLatest;
  const mine = latest.authorId === me?.id;
  // Why the builder is read-only, in one sentence (the server enforces the same rules).
  const lockedNote = editable ? '' : a.status === 'ARCHIVED' ? 'This assessment is archived. It can no longer be changed.'
    : !onLatest ? 'You are reading version ' + v.versionNo + ' (' + STATUS_LABEL[v.status].toLowerCase() + '). Older versions never change.'
    : latest.status === 'SUBMITTED' ? 'v' + v.versionNo + ' is waiting for review and is locked until it is returned or approved.'
    : ['APPROVED', 'PUBLISHED'].includes(latest.status) ? 'v' + v.versionNo + ' is ' + STATUS_LABEL[latest.status].toLowerCase() + ' and locked. ' + (can.newVersion ? 'Use New version to start draft v' + (latest.versionNo + 1) + '.' : 'Changes go into a new version.')
    : !mine ? 'Only the author of this version (' + latest.author + ') can change it.' : 'View only. You do not have permission to edit content.';
  const picker = (list.data ? list.data.rows : []).map(r => [String(r.id), r.title + ' (' + STATUS_LABEL[r.status] + ')']);
  if (!picker.some(o => o[0] === String(id))) picker.unshift([String(id), a.title + ' (' + STATUS_LABEL[a.status] + ')']);
  return (
    <Page>
      {header(<>
        <Btn icon="icon-arrow-left" onClick={() => go('forms')}>All assessments</Btn>
        <Sel value={String(id)} onChange={x => go('forms', undefined, Number(x))} options={picker} title="Assessment" style={{ maxWidth: '280px' }} />
        {can.upload && onLatest ? <Btn icon="icon-upload" onClick={() => setUploading(true)}>Bulk upload</Btn> : null}
        {can.newVersion && onLatest ? <Btn icon="icon-copy-plus" onClick={() => setAct('new-version')}>New version</Btn> : null}
        {can.archive ? <Btn kind="danger" icon="icon-archive" onClick={() => setAct('archive')}>Archive</Btn> : null}
        {can_(me, 'forms.create') ? <Btn kind="primary" icon="icon-file-plus" onClick={() => setCreating(true)}>New assessment</Btn> : null}
      </>)}
      <Notices data={data} onLatest={onLatest} onNewest={() => setVersionNo(null)} />
      <SMFormBuilder key={v.id + ':' + editable} data={data} id={id} editable={editable} reload={reload} toast={toast} vw={S.vw} lockedNote={lockedNote}
        workflow={<WorkflowButtons can={can} editable={editable} onAct={setAct} />}
        onViewVersion={no => setVersionNo(no === latest.versionNo ? null : no)}
        settings={<SettingsTab data={data} editable={editable} reload={reload} toast={toast} id={id} me={me} />} />
      <BulkUpload open={uploading} id={id} data={data} onClose={() => setUploading(false)} onDone={n => { setUploading(false); reload(); toast(n + ' question' + (n === 1 ? '' : 's') + ' imported'); }} />
      <ActionDialog act={act} data={data} id={id} onClose={() => setAct(null)} onDone={(msg, res) => { setAct(null); if (res && res.versionNo && act === 'new-version') setVersionNo(null); reload(); toast(audienceToast(msg, res)); }} />
      <NewAssessment open={creating} canPickPeople={can_(me, 'cycles.assign')} deptIds={me ? me.deptIds : null} onClose={() => setCreating(false)} onMade={nid => { toast('Draft created'); go('forms', undefined, nid); }} />
    </Page>
  );
}
// "Published · assigned to 2 departments (34 people told)" when the planned audience was used.
function audienceToast(msg, res) {
  const x = res && res.audience;
  if (!x) return msg;
  if (!x.created.length) return msg + ' · not assigned: ' + (x.skipped[0] || 'see Settings');
  return msg + ' · assigned to ' + x.covered + ' staff (' + x.notified + ' told)' + (x.skipped.length ? ' · ' + x.skipped.length + ' skipped, see Settings' : '');
}

// ===== CONTENT · Workflow actions =====
// Submit / review / publish follow the server's `can` flags; each opens a confirmation (with feedback for return /
// reject). Bulk upload, New version and Archive are in the page header.
function WorkflowButtons({ can, editable, onAct }) {
  return <>
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
  publish: { title: 'Publish this version?', text: 'It becomes the live version that can be assigned. If the author chose who it is for, it is assigned to them now and they are told. An older live version is retired, but attempts already made keep pointing at it and their results do not change.', ok: 'Publish', done: 'Published', version: c => c.approvedVersionId },
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
// for the new version to be published (the server keeps them aside). Who it is for is a plan, saved straight away;
// once it has been used at publishing, changes are made on the Assignments page.
function SettingsTab({ data, editable, reload, toast, id, me }) {
  const [v, setV] = useState(data.settings), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const plan = data.audience, done = !!(plan && plan.done);
  const [aud, setAud] = useState(() => audienceState(plan));
  useEffect(() => { setV(data.settings); }, [data.settings]);
  useEffect(() => { setAud(audienceState(data.audience)); }, [data.audience]);
  const live = data.versions.some(x => x.status === 'PUBLISHED');
  const save = async () => {
    const ae = audienceError(aud);
    if (!done && ae) { setErr(ae); return; }
    setBusy(true); setErr('');
    try { const r = await call('PATCH', '/api/content/' + id, { ...v, description: v.description || '', instructions: v.instructions || '', maxAttempts: Number(v.maxAttempts), ...(done ? {} : { audience: audienceBody(aud) }) }); reload(); toast(r.pending ? 'Saved; settings apply when the new version is published' : 'Settings saved'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'grid', gap: '16px', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,340px),1fr))', alignItems: 'start' }}>
      <Card title="Assessment settings" sub={editable ? (live ? 'Saved changes apply when this new version is published; the live version keeps its current settings.' : 'Saved with this draft.') : 'Read only. Start a new version to change published content.'}
        actions={editable ? <Btn kind="primary" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save settings'}</Btn> : null}>
        <SettingsFields v={v} set={setV} disabled={!editable} />
        {data.settingsPending ? <div style={{ ...MUTED, marginTop: '10px' }}><i className="icon-clock" style={{ fontSize: '12px' }}></i> These settings are waiting for version {data.versions[0].versionNo} to be published.</div> : null}
        {err ? <div style={{ ...ERR, marginTop: '10px' }} role="alert">{err}</div> : null}
      </Card>
      {/* ===== CONTENT · Settings tab · Who it is for ===== */}
      <Card title="Who it is for" sub={done ? 'Already assigned when it was published.' : editable ? 'Assigned automatically when an administrator publishes it. Saved with "Save settings".' : 'Read only.'}>
        {done ? (
          <div style={{ display: 'grid', gap: '8px', fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
            <div><b>{plan.label}:</b> {plan.names.length ? plan.names.map(n => n.name).join(', ') : plan.targetIds.length + ' chosen'}</div>
            <div>Opens {fmtDate(plan.startsAt)} · deadline {fmtDateTime(plan.deadline)}</div>
            <div>Assigned {fmtDateTime(plan.done.at)}: {plan.done.assignmentIds.length} assignment{plan.done.assignmentIds.length === 1 ? '' : 's'} made.{plan.done.skipped && plan.done.skipped.length ? ' Not assigned: ' + plan.done.skipped.join(' ') : ''}</div>
            <div style={MUTED}>Change dates or add people on the Assignments page.</div>
          </div>) : <AudienceFields aud={aud} set={setAud} canPickPeople={data.canPickPeople} deptIds={me ? me.deptIds : null} disabled={!editable} />}
      </Card>
      <Card title="Where the rest is set">
        <div style={{ display: 'grid', gap: '8px', fontSize: '13px', color: '#374151', lineHeight: 1.5 }}>
          <div><b>Later changes to who takes it and deadlines:</b> Assignments & Deadlines, once this assessment is published.</div>
          <div><b>Scoring:</b> each question earns its points; results are worked out per competency on the 0–5 scale using the active scoring configuration (Competent from 4.00, Proficient at 5.00).</div>
          <div><b>Competency category:</b> {data.measured.length ? [...new Set(data.measured.map(c => c.category + ' · ' + c.group))].join(', ') : 'set by the competencies the questions are mapped to.'}</div>
          <div><b>Created:</b> {fmtDateTime(data.assessment.createdAt)} by {data.assessment.createdBy}</div>
        </div>
      </Card>
    </div>
  );
}
