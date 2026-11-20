'use client';
// =============================================================================
// SMTickets.jsx · Support Tickets: raise a ticket, follow it, and (for support staff) assign, reply, add internal
//   notes and change status
// Screen / URL: /tickets (list), /tickets?id=12 (opens that ticket, e.g. from a notification)
// Who sees it: everyone signed in (always in the sidebar footer). Staff see their own tickets; Ticket Resolvers also
//   see tickets assigned to them; ticket managers (tickets.manage, Administrators) see every ticket.
// Used by: SkillMatrixApp.jsx (page "tickets")   Depends on: smUI (kit), smApi (api, useLoad, qs, fmtDate, fmtDateTime)
// Server: /api/tickets, /api/tickets/meta, /api/tickets/:id, /api/tickets/:id/messages, /api/tickets/:id/attachments
// Sections (search for these markers): TICKETS · Labels & colours, TICKETS · Small parts, TICKETS · Main screen,
//   TICKETS · Filters, TICKETS · Table, TICKETS · Paging, TICKETS · New ticket form, TICKETS · Ticket drawer,
//   TICKETS · Ticket actions, TICKETS · Conversation, TICKETS · Reply box, TICKETS · History
// =============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable, Drawer, INPUT } from '@/components/shared/smUI';
import { api, useLoad, qs, fmtDate, fmtDateTime } from '@/components/shared/smApi';

// ===== TICKETS · Labels & colours =====
// Every colour goes with a text label. Status and priority colours are neutral information tints, not brand colours.
const STATUS_C = { OPEN: ['#dbeafe', '#1d4ed8'], ASSIGNED: ['#e0e7ff', '#3730a3'], IN_PROGRESS: ['#fef3c7', '#92400e'], PENDING_USER: ['#fce7f3', '#9d174d'], RESOLVED: ['#dcfce7', '#15803d'], CLOSED: ['#f3f4f6', '#4b5563'] };
const PRIORITY_C = { LOW: ['#f3f4f6', '#4b5563'], MEDIUM: ['#dbeafe', '#1d4ed8'], HIGH: ['#fef3c7', '#92400e'], URGENT: ['#fee2e2', '#b91c1c'] };
const PRIORITY_L = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
const STATUS_ICON = { OPEN: 'icon-circle-dot', ASSIGNED: 'icon-user-round-check', IN_PROGRESS: 'icon-loader', PENDING_USER: 'icon-message-circle-question', RESOLVED: 'icon-circle-check', CLOSED: 'icon-archive' };
const EVENT_TEXT = {
  created: () => 'raised the ticket', reply: () => 'replied', note: () => 'added an internal note', attachment: e => 'attached ' + (e.to || 'a file'),
  assignee: e => (e.to ? 'assigned it to ' + e.to : 'removed the assignee') + (e.from && e.to ? ' (was ' + e.from + ')' : ''),
  priority: e => 'changed priority from ' + (PRIORITY_L[e.from] || e.from) + ' to ' + (PRIORITY_L[e.to] || e.to),
};
const SIZE = 20;
const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
const TEXTAREA = { ...INPUT, height: 'auto', minHeight: '96px', padding: '8px 10px', resize: 'vertical', lineHeight: 1.45 };

// ===== TICKETS · Small parts =====
const StatusPill = ({ status, label }) => <Badge bg={STATUS_C[status]?.[0]} fg={STATUS_C[status]?.[1]}><i className={STATUS_ICON[status]} style={{ fontSize: '11px' }}></i>{label || status}</Badge>;
const PriorityPill = ({ p }) => <Badge bg={PRIORITY_C[p]?.[0]} fg={PRIORITY_C[p]?.[1]}>{PRIORITY_L[p] || p} priority</Badge>;
const ErrorLine = ({ text }) => (text ? <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '8px 12px', fontSize: '13px' }}>{text}</div> : null);
// Upload one file to a ticket (multipart; api() only sends JSON).
async function uploadFile(ticketId, file) {
  const fd = new FormData(); fd.append('file', file);
  const r = await fetch('/api/tickets/' + ticketId + '/attachments', { method: 'POST', body: fd, credentials: 'same-origin' });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(file.name + ': ' + (d.error || 'upload failed'));
  return d.attachment;
}
// Checks in the browser too (the server checks again), so people hear about a wrong file straight away.
function fileProblem(file, meta) {
  const ext = (file.name.split('.').pop() || '').toLowerCase().replace('jpeg', 'jpg');
  if (!meta.attachments.types.includes(ext)) return file.name + ': only ' + meta.attachments.types.join(', ').toUpperCase() + ' files can be attached.';
  if (file.size > meta.attachments.maxBytes) return file.name + ' is larger than 5 MB.';
  return '';
}

// ===== TICKETS · Main screen =====
export default function SMTickets(S) {
  const { me, toast, id, vw } = S;
  const [f, setF] = useState({ q: '', status: 'ACTIVE', priority: 'All', category: 'All', assignee: 'All', box: 'All' });
  const [q, setQ] = useState(''), [page, setPage] = useState(1), [openId, setOpenId] = useState(id ? Number(id) : null), [creating, setCreating] = useState(false);
  const meta = useLoad('/api/tickets/meta');
  const M = meta.data;
  // Search waits for typing to pause.
  useEffect(() => { const t = setTimeout(() => { setF(x => ({ ...x, q })); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);
  useEffect(() => { if (id) setOpenId(Number(id)); }, [id]);
  const list = useLoad('/api/tickets' + qs({ ...f, page, size: SIZE }));
  const set = k => v => { setF(x => ({ ...x, [k]: v })); setPage(1); };
  const manage = !!M?.canManage, resolve = !!M?.canResolve, support = manage || resolve;
  const counts = list.data?.counts || {}, activeCount = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER'].reduce((n, k) => n + (counts[k] || 0), 0);
  const label = s => M?.statuses.find(x => x.key === s)?.label || s;
  const narrow = (vw || 1200) < 720;

  // ===== TICKETS · Filters =====
  const filters = M ? (<>
    <Search value={q} onChange={setQ} placeholder={support ? 'Search reference, title, description or requester' : 'Search reference, title or description'} />
    <Sel title="Status" value={f.status} onChange={set('status')} options={[['All', 'Every status'], ['ACTIVE', 'Still open (' + activeCount + ')'], ...M.statuses.map(s => [s.key, s.label + ' (' + (counts[s.key] || 0) + ')'])]} />
    <Sel title="Priority" value={f.priority} onChange={set('priority')} options={[['All', 'Any priority'], ...M.priorities.map(p => [p.key, p.label])]} />
    <Sel title="Category" value={f.category} onChange={set('category')} options={[['All', 'Any category'], ...M.categories.map(c => [c, c])]} />
    {manage ? <Sel title="Assignee" value={String(f.assignee)} onChange={set('assignee')} options={[['All', 'Anyone assigned'], ['me', 'Assigned to me'], ['none', 'Not assigned'], ...M.assignees.map(a => [String(a.id), a.name])]} /> : null}
    {resolve && !manage ? <Sel title="Which tickets" value={f.box} onChange={set('box')} options={[['All', 'Assigned to me and raised by me'], ['assigned', 'Assigned to me'], ['raised', 'Raised by me']]} /> : null}
  </>) : null;

  // ===== TICKETS · Table =====
  const open = r => setOpenId(r.id);
  const cols = [
    { key: 'reference', label: 'Reference', render: r => <button type="button" onClick={() => open(r)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: "600 12.5px 'JetBrains Mono',monospace", whiteSpace: 'nowrap' }}>{r.reference}</button> },
    { key: 'title', label: 'Ticket', render: r => <button type="button" onClick={() => open(r)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit' }}>
      <div style={{ fontWeight: 600 }}>{r.title}</div><div style={{ fontSize: '12px', color: '#6b7280' }}>{r.category}{r.assessment ? ' · ' + r.assessment.title : ''}</div></button> },
    { key: 'priority', label: 'Priority', render: r => <PriorityPill p={r.priority} /> },
    { key: 'status', label: 'Status', render: r => <StatusPill status={r.status} label={r.statusLabel} /> },
    ...(support ? [{ key: 'requester', label: 'Raised by', render: r => r.requester?.name || '—' }] : []),
    { key: 'assignee', label: 'Assigned to', render: r => r.assignee?.name || <span style={{ color: '#9ca3af' }}>Not yet</span> },
    { key: 'updatedAt', label: 'Last update', render: r => <span style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.updatedAt)}</span> },
  ];
  const total = list.data?.total || 0, from = total ? (page - 1) * SIZE + 1 : 0, to = Math.min(total, page * SIZE);
  const anyFilter = f.q || f.priority !== 'All' || f.category !== 'All' || f.assignee !== 'All' || f.box !== 'All' || f.status !== 'All';

  return (
    <Page>
      <PageHeader title="Support Tickets"
        description={manage ? 'Every support ticket: assign, prioritise, reply and resolve.' : resolve ? 'Tickets assigned to you, and the ones you raised.' : 'Ask for help and follow the progress of your requests.'}
        actions={<Btn kind="primary" icon="icon-plus" onClick={() => setCreating(true)} disabled={!M}>New ticket</Btn>} filters={filters} />
      <Card flush>
        {meta.error || list.error ? <div style={{ padding: '16px 20px' }}><ErrorLine text={meta.error || list.error} /><div style={{ marginTop: '10px' }}><Btn icon="icon-refresh-cw" onClick={() => { meta.reload(); list.reload(); }}>Try again</Btn></div></div>
          : !list.data ? <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>Loading tickets…</div>
          : <DataTable columns={cols} rows={list.data.items} minWidth={support ? 920 : 760} rowKey={r => r.id}
            empty={<EmptyState icon="icon-life-buoy" title={anyFilter && total === 0 && Object.keys(counts).length ? 'No tickets match these filters' : 'No tickets yet'}
              text={anyFilter && Object.keys(counts).length ? 'Try a different search or filter.' : support ? 'New tickets will appear here.' : 'If something is not working, raise a ticket and the support team will help.'}
              action={!support || !Object.keys(counts).length ? <Btn kind="primary" icon="icon-plus" onClick={() => setCreating(true)} disabled={!M}>New ticket</Btn> : null} />} />}
        {/* ===== TICKETS · Paging ===== */}
        {total > SIZE ? (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px 20px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' }}>
            <span>Showing {from}–{to} of {total}</span>
            <span style={{ display: 'flex', gap: '8px' }}><Btn small icon="icon-chevron-left" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Btn><Btn small disabled={to >= total} onClick={() => setPage(p => p + 1)}>Next<i className="icon-chevron-right" style={{ fontSize: '13px' }}></i></Btn></span>
          </div>) : null}
      </Card>
      {creating && M ? <NewTicket M={M} narrow={narrow} onClose={() => setCreating(false)} onDone={(t, warn) => { setCreating(false); list.reload(); toast(warn || 'Ticket ' + t.reference + ' raised'); setOpenId(t.id); }} /> : null}
      {openId ? <TicketDrawer key={openId} ticketId={openId} M={M} me={me} label={label} toast={toast} onClose={() => setOpenId(null)} onChanged={list.reload} /> : null}
    </Page>
  );
}

// ===== TICKETS · New ticket form =====
// The ticket is saved first (so it gets its reference), then each chosen file is uploaded to it.
function NewTicket({ M, onClose, onDone }) {
  const [v, setV] = useState({ title: '', category: '', priority: 'MEDIUM', assessmentId: '', description: '' });
  const [files, setFiles] = useState([]), [err, setErr] = useState(''), [fields, setFields] = useState({}), [busy, setBusy] = useState(false);
  const pick = useRef(null);
  const set = k => e => setV(x => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const addFiles = list => {
    const next = [...files], probs = [];
    [...list].forEach(fl => { const p = fileProblem(fl, M); if (p) probs.push(p); else if (next.length < M.attachments.maxFiles) next.push(fl); });
    setFiles(next); setErr(probs.join(' '));
  };
  const problems = [];
  if (v.title.trim().length < 5) problems.push('a title (at least 5 characters)');
  if (!v.category) problems.push('a category');
  if (v.description.trim().length < 10) problems.push('a description (at least 10 characters)');
  const submit = async () => {
    if (problems.length) { setErr('Please add ' + problems.join(', ') + '.'); return; }
    setBusy(true); setErr(''); setFields({});
    try {
      const d = await api('POST', '/api/tickets', { title: v.title.trim(), category: v.category, priority: v.priority, description: v.description.trim(), assessmentId: v.assessmentId ? Number(v.assessmentId) : null });
      const failed = [];
      for (const fl of files) { try { await uploadFile(d.ticket.id, fl); } catch (e) { failed.push(e.message); } }
      onDone(d.ticket, failed.length ? 'Ticket ' + d.ticket.reference + ' raised, but some files were not attached: ' + failed.join(' ') : '');
    } catch (e) { setErr(e.message); setFields(e.fields || {}); setBusy(false); }
  };
  const fe = k => (fields[k] ? <span style={{ color: '#b91c1c', font: '400 11.5px Inter,sans-serif' }}>{fields[k][0]}</span> : null);
  return (
    <Drawer open title="New support ticket" sub="Tell us what is wrong. You'll get a notification each time the ticket is updated." onClose={busy ? undefined : onClose} width={640}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={onClose} disabled={busy}>Cancel</Btn><Btn kind="primary" icon="icon-send" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Raise ticket'}</Btn></div>}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <ErrorLine text={err} />
        <Field label="TITLE">{<input value={v.title} onChange={set('title')} maxLength={150} placeholder="e.g. My assessment will not open" style={INPUT} />}{fe('title')}</Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          <Field label="CATEGORY"><Sel value={v.category} onChange={set('category')} options={[['', 'Choose a category'], ...M.categories.map(c => [c, c])]} />{fe('category')}</Field>
          <Field label="PRIORITY"><Sel value={v.priority} onChange={set('priority')} options={M.priorities.map(p => [p.key, p.label])} /></Field>
        </div>
        <Field label="RELATED ASSESSMENT (OPTIONAL)" hint={M.assessments.length ? null : 'You have no assessments to link.'}>
          <Sel value={v.assessmentId} onChange={set('assessmentId')} disabled={!M.assessments.length} options={[['', 'None'], ...M.assessments.map(a => [String(a.id), a.title])]} />{fe('assessmentId')}</Field>
        <Field label="DESCRIPTION" hint="What happened, what you expected, and any error message you saw.">
          <textarea value={v.description} onChange={set('description')} maxLength={5000} rows={6} style={TEXTAREA} />{fe('description')}</Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>ATTACHMENTS (OPTIONAL)</div>
          {files.map((fl, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <i className="icon-paperclip" style={{ color: '#6b7280' }}></i><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fl.name}</span>
              <span style={{ color: '#6b7280' }}>{kb(fl.size)}</span><Btn small kind="ghost" icon="icon-x" title={'Remove ' + fl.name} onClick={() => setFiles(files.filter((_, j) => j !== i))} />
            </div>))}
          <input ref={pick} type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" style={{ display: 'none' }} onChange={e => { addFiles(e.target.files); e.target.value = ''; }} />
          <div><Btn icon="icon-paperclip" onClick={() => pick.current && pick.current.click()} disabled={files.length >= M.attachments.maxFiles}>Add files</Btn></div>
          <div style={{ fontSize: '11.5px', color: '#6b7280' }}>PDF, PNG, JPG, Word (.docx), Excel (.xlsx) or text files, up to 5 MB each.</div>
        </div>
      </div>
    </Drawer>
  );
}

// ===== TICKETS · Ticket drawer =====
function TicketDrawer({ ticketId, M, label, toast, onClose, onChanged }) {
  const { data, error, reload } = useLoad('/api/tickets/' + ticketId);
  const [t, setT] = useState(null);
  useEffect(() => { if (data) setT(data.ticket); }, [data]);
  const [busy, setBusy] = useState(false), [err, setErr] = useState(''), [confirm, setConfirm] = useState(null);
  const [assignee, setAssignee] = useState(''), [priority, setPriority] = useState(''), [status, setStatus] = useState('');
  const [reply, setReply] = useState(''), [internal, setInternal] = useState(false);
  const pick = useRef(null);
  useEffect(() => { if (t) { setAssignee(t.assignee ? String(t.assignee.id) : ''); setPriority(t.priority); setStatus(''); } }, [t]);
  const run = async (fn, okText) => {
    setBusy(true); setErr('');
    try { const d = await fn(); if (d && d.ticket) setT(d.ticket); else await reload(); onChanged(); if (okText) toast(okText); return true; }
    catch (e) { setErr(e.message); return false; } finally { setBusy(false); setConfirm(null); }
  };
  if (error) return <Drawer open title="Ticket" onClose={onClose} width={720}><div style={{ padding: '20px 22px' }}><ErrorLine text={error} /></div></Drawer>;
  if (!t) return <Drawer open title="Ticket" onClose={onClose} width={720}><div style={{ padding: '40px', textAlign: 'center', color: '#6b7280' }}>Loading…</div></Drawer>;
  const A = t.actions, staffSide = t.role !== 'requester';
  const stLabel = s => (t.role === 'requester' ? { PENDING_USER: 'Pending your response' }[s] : null) || (M?.statuses.find(x => x.key === s)?.label) || label(s);
  const changed = {};
  if (A.assign && assignee !== (t.assignee ? String(t.assignee.id) : '')) changed.assigneeId = assignee ? Number(assignee) : null;
  if (A.priority && priority !== t.priority) changed.priority = priority;
  if (status) changed.status = status;
  const save = () => run(() => api('PATCH', '/api/tickets/' + t.id, changed), 'Ticket updated');
  const send = () => run(() => api('POST', '/api/tickets/' + t.id + '/messages', { body: reply.trim(), internal: staffSide && internal }), internal ? 'Internal note added' : 'Reply sent').then(ok => { if (ok) { setReply(''); setInternal(false); } });
  const attach = async list => {
    const fl = list[0]; if (!fl) return;
    const p = M ? fileProblem(fl, M) : ''; if (p) { setErr(p); return; }
    await run(() => uploadFile(t.id, fl).then(() => null), 'File attached');
  };
  const items = [...t.messages.map(m => ({ kind: 'm', at: m.at, m })), ...t.attachments.map(a => ({ kind: 'a', at: a.at, a }))].sort((x, y) => new Date(x.at) - new Date(y.at));
  const assigneeOpts = [['', 'Not assigned'], ...(M?.assignees || []).map(a => [String(a.id), a.name])];

  return (
    <Drawer open title={t.title} sub={t.reference + ' · raised ' + fmtDate(t.createdAt) + (staffSide ? ' by ' + (t.requester?.name || 'unknown') : '')} onClose={onClose} width={760}>
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}><StatusPill status={t.status} label={stLabel(t.status)} /><PriorityPill p={t.priority} /><Badge>{t.category}</Badge></div>
        <ErrorLine text={err} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px 16px', fontSize: '13px' }}>
          {[['Reference', t.reference], ['Raised by', t.requester?.name || '—'], ['Raised on', fmtDateTime(t.createdAt)], ['Assigned to', t.assignee?.name || 'Not yet'], ['Related assessment', t.assessment?.title || 'None'], ['Last update', fmtDateTime(t.updatedAt)]].map(([k, v]) => (
            <div key={k}><div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{k}</div><div style={{ marginTop: '3px', color: '#111827', overflowWrap: 'anywhere' }}>{v}</div></div>))}
        </div>
        <div style={{ background: '#f9fafb', border: '1px solid rgba(15,35,65,.07)', borderRadius: '12px', padding: '12px 14px', fontSize: '13.5px', whiteSpace: 'pre-wrap', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{t.description}</div>

        {/* ===== TICKETS · Ticket actions ===== */}
        {A.assign || A.priority || A.statuses.length ? (
          <div style={{ border: '1px solid rgba(15,35,65,.1)', borderRadius: '14px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ fontSize: '14px', fontWeight: 600 }}>{staffSide ? 'Update ticket' : 'Your ticket'}</div>
            {staffSide ? (<>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '10px' }}>
                {A.assign ? <Field label="ASSIGNED TO"><Sel value={assignee} onChange={setAssignee} options={assigneeOpts} /></Field> : null}
                {A.priority ? <Field label="PRIORITY"><Sel value={priority} onChange={setPriority} options={(M?.priorities || []).map(p => [p.key, p.label])} /></Field> : null}
                {A.statuses.length ? <Field label="MOVE TO STATUS"><Sel value={status} onChange={setStatus} options={[['', 'Keep ' + stLabel(t.status)], ...A.statuses.map(s => [s, stLabel(s)])]} /></Field> : null}
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn kind="primary" icon="icon-check" disabled={busy || !Object.keys(changed).length} onClick={() => (changed.status === 'CLOSED' ? setConfirm('save') : save())}>Save changes</Btn></div>
            </>) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', fontSize: '13px', color: '#4b5563' }}>
                <span>{t.status === 'PENDING_USER' ? 'The support team is waiting for your answer. Reply below.' : t.status === 'RESOLVED' ? 'Marked as resolved. Close it if you are happy, or reply if you still need help.' : 'No longer need help? You can close the ticket.'}</span>
                <Btn icon="icon-archive" disabled={busy} onClick={() => { setStatus('CLOSED'); setConfirm('close'); }}>Close ticket</Btn>
              </div>)}
          </div>) : null}

        {/* ===== TICKETS · Conversation ===== */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Conversation</div>
          {!items.length ? <div style={{ fontSize: '13px', color: '#6b7280' }}>No replies yet.</div> : items.map(x => x.kind === 'm' ? (
            <div key={'m' + x.m.id} style={{ borderRadius: '12px', padding: '10px 12px', background: x.m.internal ? '#fffbeb' : x.m.author?.id === t.requester?.id ? '#fff' : '#f0fdf4', border: '1px solid ' + (x.m.internal ? '#fde68a' : 'rgba(15,35,65,.08)') }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>
                <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><b style={{ color: '#111827' }}>{x.m.author?.name || 'Unknown'}</b>{x.m.internal ? <Badge bg="#fef3c7" fg="#92400e"><i className="icon-lock" style={{ fontSize: '10px' }}></i>Internal note · not shown to the requester</Badge> : null}</span>
                <span>{fmtDateTime(x.m.at)}</span>
              </div>
              <div style={{ fontSize: '13.5px', whiteSpace: 'pre-wrap', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{x.m.body}</div>
            </div>) : (
            <a key={'a' + x.a.id} href={'/api/tickets/' + t.id + '/attachments/' + x.a.id} download={x.a.name} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#127a42', textDecoration: 'none', padding: '6px 2px' }}>
              <i className="icon-paperclip"></i><span style={{ fontWeight: 600, overflowWrap: 'anywhere' }}>{x.a.name}</span><span style={{ color: '#6b7280' }}>{kb(x.a.size)} · {fmtDateTime(x.a.at)}</span><i className="icon-download" style={{ marginLeft: 'auto' }}></i></a>))}
        </div>

        {/* ===== TICKETS · Reply box ===== */}
        {A.reply ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <textarea aria-label={internal ? 'Internal note' : 'Reply'} value={reply} onChange={e => setReply(e.target.value)} maxLength={5000} rows={4} placeholder={internal ? 'Internal note for the support team' : staffSide ? 'Reply to ' + (t.requester?.name || 'the requester') : 'Add a reply for the support team'} style={{ ...TEXTAREA, background: internal ? '#fffbeb' : '#fff' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                {A.note ? <Toggle on={internal} onClick={() => setInternal(!internal)} label="Internal note" desc="Only support staff see it" /> : null}
                {A.attach ? <><input ref={pick} type="file" accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx,.txt" style={{ display: 'none' }} onChange={e => { attach(e.target.files); e.target.value = ''; }} /><Btn small icon="icon-paperclip" disabled={busy} onClick={() => pick.current && pick.current.click()}>Attach file</Btn></> : null}
              </span>
              <Btn kind="primary" icon="icon-send" disabled={busy || !reply.trim()} onClick={send}>{internal ? 'Add note' : 'Send reply'}</Btn>
            </div>
          </div>) : <div style={{ fontSize: '13px', color: '#6b7280' }}>This ticket is closed. Raise a new ticket if you still need help.</div>}

        {/* ===== TICKETS · History ===== */}
        <details>
          <summary style={{ cursor: 'pointer', fontSize: '13.5px', fontWeight: 600 }}>History ({t.events.length})</summary>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
            {t.events.slice().reverse().map(e => (
              <div key={e.id} style={{ fontSize: '12.5px', color: '#4b5563', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtDateTime(e.at)}</span>
                <span><b style={{ color: '#111827' }}>{e.actor?.name || 'Someone'}</b> {e.field === 'status' ? 'moved it from ' + stLabel(e.from) + ' to ' + stLabel(e.to) : (EVENT_TEXT[e.field] || (() => 'changed ' + e.field))(e)}</span>
              </div>))}
          </div>
        </details>
      </div>
      <Confirm open={!!confirm} title="Close this ticket?" text={confirm === 'close' ? 'Closing means you no longer need help. You won\'t be able to reply to it afterwards, but you can raise a new ticket.' : 'A closed ticket can no longer receive replies from the requester.'}
        confirmText="Close ticket" busy={busy} onCancel={() => { setConfirm(null); setStatus(''); }}
        onConfirm={() => (confirm === 'close' ? run(() => api('PATCH', '/api/tickets/' + t.id, { status: 'CLOSED' }), 'Ticket closed') : save())} />
    </Drawer>
  );
}
