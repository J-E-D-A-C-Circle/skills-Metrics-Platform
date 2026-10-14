'use client';
// =============================================================================
// SMStaffEvals.jsx · Staff Evaluations Reviews: review auto-scored results, score open text, confirm or adjust
// Screen / URL: /staff-evals (Reviews tab)
// Who sees it: admin (all departments); manager (own department only)
// Used by: SMTeam.jsx   Depends on: ./smUI (Drawer, DataTable...), ./smModel (STATUSES, bandOf, inScope)
// Sections (search for these markers): STAFF EVALS · Reviews page (/staff-evals), STAFF EVALS · State & filters, STAFF EVALS · CSV export, STAFF EVALS · Row action button rules, STAFF EVALS · Render, STAFF EVALS · Page header (scope, search, status filter, Reset demo reviews, Export CSV), STAFF EVALS · Status KPI tiles (click to filter), STAFF EVALS · Staff table, STAFF EVALS · Review drawer & toast, STAFF EVALS · Status sort order, STAFF EVALS · Review drawer, STAFF EVALS · Review drawer render, STAFF EVALS · Review drawer body, STAFF EVALS · Score summary tiles, STAFF EVALS · How scoring works note, STAFF EVALS · Open-text answer & rubric score, STAFF EVALS · Competency results & adjust, STAFF EVALS · Question bank answers, STAFF EVALS · Pass band badge, STAFF EVALS · Stat tile
// =============================================================================
import React, { useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Badge, GapBadge, StatusBadge, EmptyState, DataTable, KpiTile, Toast, Drawer, ScopeSelect, INPUT, download, toCSV, slugify } from './smUI';
import { ALL, STATUSES, STATUS_HINT, PASS, TIERS_TEXT, bandOf, inScope } from './smModel';

// ===== STAFF EVALS · Reviews page (/staff-evals) =====
// Staff Evaluations: results are scored automatically on submission.
// Reviewers score the open-text answer, then confirm, or adjust a competency with a reason.
export default function StaffEvaluations({ data: D, model, go, role, scope, myDept, setEval, resetEvals }) {
  // ===== STAFF EVALS · State & filters =====
  // Managers are locked to their own department; admins pick one here (defaults to the global scope).
  const [local, setLocal] = useState(null);
  const locked = role === 'manager';
  const dept = locked ? myDept : (local ?? scope);
  const [q, setQ] = useState('');
  const [st, setSt] = useState(ALL);
  const [openId, setOpenId] = useState(null);
  const [toast, setToast] = useState('');
  const flash = m => { setToast(m); clearTimeout(flash._t); flash._t = setTimeout(() => setToast(''), 2600); };
  const staff = useMemo(() => inScope(model, dept), [model, dept]);
  const counts = Object.fromEntries(STATUSES.map(x => [x, staff.filter(s => s.status === x).length]));
  const t = q.trim().toLowerCase();
  // Rows sorted by status (Submitted first, then Auto-scored, In progress, Not started, Confirmed), then by name.
  const rows = staff.filter(s => (st === ALL || s.status === st) && (!t || (s.name + ' ' + s.staffNo + ' ' + s.designation + ' ' + s.dept).toLowerCase().includes(t)))
    .sort((a, b) => STATUSES.indexOf(a.status) === STATUSES.indexOf(b.status) ? a.name.localeCompare(b.name) : rank(a.status) - rank(b.status));
  // Reviewer name stored with confirmations and adjustments.
  const me = D.user.short + (role === 'admin' ? ' (Administrator)' : '');
  // ===== STAFF EVALS · CSV export =====
  const exportCsv = () => {
    const H = ['Staff ID', 'Name', 'Department', 'Role', 'Status', 'Score %', 'Result', 'Largest gap', 'Competency', 'Confirmed by'];
    download('staff-evaluations-' + slugify(dept) + '.csv', toCSV(H, rows.map(s => ({ 'Staff ID': s.staffNo, Name: s.name, Department: s.dept, Role: s.designation, Status: s.status, 'Score %': s.overallPct == null ? '' : s.overallPct, Result: s.band || '', 'Largest gap': s.top.gap, Competency: s.top.name, 'Confirmed by': s.status === 'Confirmed' ? s.confirmedBy || '' : '' }))), 'text/csv');
    flash('CSV downloaded (' + rows.length + ' staff)');
  };
  // ===== STAFF EVALS · Row action button rules =====
  // Submitted -> score open text; Auto-scored -> review & confirm; Confirmed -> view result; others -> no button.
  const action = s => s.status === 'Submitted' ? ['Score open text', 'primary'] : s.status === 'Auto-scored' ? ['Review & confirm', 'primary'] : s.status === 'Confirmed' ? ['View result', 'secondary'] : [null];
  const cur = openId ? model.byId[openId] : null;
  // ===== STAFF EVALS · Render =====
  return (
    <Page>
      {/* ===== STAFF EVALS · Page header (scope, search, status filter, Reset demo reviews, Export CSV) ===== */}
      <PageHeader title="Staff Evaluations" description={'Scoring is automatic when staff submit. You review the open-text answer, then confirm the result or adjust a competency with a reason.' + (locked ? ' You see ' + myDept + ' only.' : '')}
        actions={<><Btn kind="ghost" icon="icon-rotate-ccw" onClick={() => { resetEvals(); flash('Review changes reset to the sample data'); }}>Reset demo reviews</Btn><Btn kind="primary" icon="icon-download" onClick={exportCsv}>Export CSV</Btn></>}
        filters={<>
          <ScopeSelect depts={D.depts} value={dept} globalValue={scope} onChange={setLocal} locked={locked} />
          <Search value={q} onChange={setQ} placeholder="Search name, staff ID or role" />
          <Sel value={st} onChange={setSt} options={[[ALL, 'All statuses (' + staff.length + ')'], ...STATUSES.map(x => [x, x + ' (' + counts[x] + ')'])]} />
        </>} />
      {/* ===== STAFF EVALS · Status KPI tiles (click to filter) ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
        {STATUSES.map(x => <KpiTile key={x} label={x} value={counts[x]} sub={STATUS_HINT[x]} onClick={() => setSt(st === x ? ALL : x)} icon="icon-filter" />)}
      </div>
      {/* ===== STAFF EVALS · Staff table ===== */}
      <Card title={(st === ALL ? 'All staff' : st) + ' · ' + (dept === ALL ? 'all departments' : dept)} sub={rows.length + ' of ' + staff.length + ' staff · ' + D.cycle.name} flush>
        <DataTable minWidth={980} rows={rows} rowKey={s => s.id} empty={<EmptyState icon="icon-users" title="No staff match" text="Change the status filter or search." />} columns={[
          { key: 'name', label: 'Staff', render: s => <div><button type="button" onClick={() => go('report', null, s.id)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{s.name}</button><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{s.staffNo} · {s.designation}</div></div> },
          { key: 'dept', label: 'Department' },
          { key: 'status', label: 'Status', render: s => <StatusBadge status={s.status} /> },
          { key: 'score', label: 'System score', render: s => s.overallPct == null ? <span style={{ color: '#9ca3af' }}>—</span> : <span><b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{s.overallPct}%</b> <BandBadge pct={s.overallPct} />{s.pending ? <div style={{ fontSize: '11px', color: '#3730a3', marginTop: '3px' }}>+ open text pending</div> : null}</span> },
          { key: 'gap', label: 'Largest gap', render: s => <GapBadge gap={s.top.gap} GAP={D.GAP} note={s.top.short} /> },
          { key: 'act', label: '', align: 'right', render: s => { const [l, k] = action(s); return l ? <Btn small kind={k} onClick={() => setOpenId(s.id)}>{l}</Btn> : <span style={{ fontSize: '12px', color: '#9ca3af' }}>Awaiting submission</span>; } },
        ]} />
      </Card>
      {/* ===== STAFF EVALS · Review drawer & toast ===== */}
      {cur ? <ReviewDrawer key={cur.id} D={D} s={cur} me={me} go={go} setEval={setEval} flash={flash} onClose={() => setOpenId(null)} /> : null}
      <Toast text={toast} />
    </Page>
  );
}
// ===== STAFF EVALS · Status sort order =====
const rank = st => ({ Submitted: 0, 'Auto-scored': 1, 'In progress': 2, 'Not started': 3, Confirmed: 4 })[st];

// ===== STAFF EVALS · Review drawer =====
function ReviewDrawer({ D, s, me, go, setEval, flash, onClose }) {
  const [edit, setEdit] = useState(null); // { id, score, reason }
  const [text, setText] = useState(s.text != null ? s.text : null);
  const locked = s.status === 'Confirmed';
  const tc = s.comps.find(c => c.id === s.textItem.comp);
  // setEval saves review changes to localStorage "skm-evals" (handled in SkillMatrixApp.jsx).
  const saveText = () => { if (text == null) return; setEval(s.id, { text }); flash('Open-text answer scored · ' + s.name + ' is ready to confirm'); };
  // An adjustment needs a reason; it is stored with the result and shown in reports.
  const saveAdj = () => {
    if (!edit.reason.trim()) return;
    setEval(s.id, { adj: { [edit.id]: { score: +edit.score, reason: edit.reason.trim(), by: me } } }); setEdit(null); flash('Final score adjusted');
  };
  const confirm = () => { setEval(s.id, { confirmed: true, by: me }); flash('Result confirmed for ' + s.name); onClose(); };
  const changed = s.comps.filter(c => c.adjusted).length;
  // ===== STAFF EVALS · Review drawer render =====
  return (
    <Drawer open title={'Review · ' + s.name} sub={s.designation + ' · ' + s.dept + ' · submitted ' + (s.submittedAt || '')} onClose={onClose} width={860}
      footer={<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12.5px', color: '#6b7280' }}>{locked ? 'Confirmed by ' + (s.confirmedBy || 'manager') + '.' : s.status === 'Submitted' ? 'Score the open-text answer before confirming.' : changed ? changed + ' competency adjusted.' : 'System scores will be used as the final scores.'}</span>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Btn onClick={() => { onClose(); go('report', null, s.id); }} icon="icon-file-text">Individual report</Btn>
          {locked ? <Btn onClick={() => { setEval(s.id, { confirmed: false }); flash('Result reopened for review'); }} icon="icon-unlock">Reopen</Btn>
            : <Btn kind="primary" icon="icon-badge-check" disabled={s.status === 'Submitted'} onClick={confirm}>Confirm result</Btn>}
        </div>
      </div>}>
      {/* ===== STAFF EVALS · Review drawer body ===== */}
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {/* ===== STAFF EVALS · Score summary tiles ===== */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
          <Stat label="System score" value={s.overallPct + '%'} sub={s.band + (s.pass ? ' · pass (≥' + PASS + '%)' : ' · below pass mark (' + PASS + '%)')} color={bandOf(s.overallPct).fg} />
          <Stat label="Status" value={<StatusBadge status={s.status} />} sub={STATUS_HINT[s.status]} />
          <Stat label="Target profile" value={<span style={{ fontSize: '13px' }}>{s.profile ? s.profile.title : '—'}</span>} sub={s.override ? 'Department override' : 'Org-wide'} />
        </div>
        {/* ===== STAFF EVALS · How scoring works note ===== */}
        <div style={{ fontSize: '12.5px', color: '#4b5563', background: '#f5f6f8', borderRadius: '10px', padding: '10px 12px', lineHeight: 1.5 }}>
          <i className="icon-cpu" style={{ fontSize: '13px', marginRight: '6px' }}></i>The system scored every question-bank answer and rating with the form weights, mapped each competency's percentage to a level ({TIERS_TEXT}) and set Gap = max(0, Target − Actual). You do not re-rate those items.
        </div>
        {/* ===== STAFF EVALS · Open-text answer & rubric score ===== */}
        <section>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Open-text answer <span style={{ fontWeight: 500, fontSize: '12.5px', color: '#6b7280' }}>· {tc ? tc.name : ''} · weight 2</span></div>
          <div style={{ border: '1px solid rgba(15,35,65,.1)', borderRadius: '12px', padding: '12px 14px', background: '#fff' }}>
            <div style={{ fontSize: '13px', color: '#374151', fontWeight: 500 }}>{s.textItem.prompt}</div>
            <div style={{ fontSize: '13.5px', color: '#111827', marginTop: '8px', lineHeight: 1.55, background: '#fafafa', borderRadius: '8px', padding: '10px' }}>{s.textItem.answer}</div>
            <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', margin: '12px 0 6px' }}>RUBRIC SCORE</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map(n => { const on = text === n; return <button key={n} type="button" disabled={locked} title={D.PROF[n].desc} onClick={() => setText(n)} style={{ padding: '7px 4px', borderRadius: '10px', cursor: locked ? 'default' : 'pointer', background: on ? '#0d3b2a' : '#fff', color: on ? '#fff' : '#374151', border: '1.5px solid ' + (on ? '#0d3b2a' : '#e5e7eb'), display: 'flex', flexDirection: 'column', alignItems: 'center' }}><b style={{ fontSize: '14px' }}>{n}</b><span style={{ fontSize: '11px' }}>{D.PROF[n].label}</span></button>; })}
            </div>
            {!locked ? <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}><Btn small kind="primary" disabled={text == null || text === s.text} onClick={saveText}>{s.text == null ? 'Save rubric score' : 'Update rubric score'}</Btn></div> : null}
          </div>
        </section>
        {/* ===== STAFF EVALS · Competency results & adjust ===== */}
        <section>
          <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '8px' }}>Competency results</div>
          <div style={{ border: '1px solid rgba(15,35,65,.08)', borderRadius: '12px', overflow: 'hidden' }}>
            <DataTable minWidth={700} rows={s.comps} rowKey={c => c.id} columns={[
              { key: 'name', label: 'Competency', render: c => <div><div style={{ fontWeight: 500 }}>{c.name}</div>{c.adjusted ? <div style={{ fontSize: '11.5px', color: '#92400e', marginTop: '2px' }}><i className="icon-message-square-text" style={{ fontSize: '11px' }}></i> {c.adjusted.reason}{c.adjusted.by ? ' — ' + c.adjusted.by : ''}</div> : null}</div> },
              { key: 'target', label: 'Target', align: 'center' },
              { key: 'system', label: 'System score', align: 'center', render: c => <span><b>{c.system}</b> <span style={{ fontSize: '11px', color: '#9ca3af' }}>{c.pct}%</span>{c.asked ? <div style={{ fontSize: '11px', color: '#6b7280' }}>{c.right} of {c.asked} correct</div> : null}</span> },
              { key: 'final', label: 'Final score', align: 'center', render: c => edit && edit.id === c.id ? <Sel value={String(edit.score)} onChange={v => setEdit({ ...edit, score: v })} options={[1, 2, 3, 4, 5].map(n => [String(n), n + ' · ' + D.PROF[n].label])} style={{ height: '30px' }} />
                : <b style={{ color: c.adjusted ? '#b45309' : '#111827' }}>{c.final}</b> },
              { key: 'gap', label: 'Gap', render: c => <GapBadge gap={c.gap} GAP={D.GAP} /> },
              { key: 'a', label: '', align: 'right', render: c => locked ? null : edit && edit.id === c.id ? null : <span style={{ display: 'inline-flex', gap: '4px' }}>
                <Btn small onClick={() => setEdit({ id: c.id, score: c.final, reason: c.adjusted ? c.adjusted.reason : '' })} icon="icon-pencil">Adjust</Btn>
                {c.adjusted ? <Btn small kind="ghost" onClick={() => { setEval(s.id, { adj: { [c.id]: null } }); flash('Adjustment removed'); }}>Undo</Btn> : null}</span> },
            ]} />
          </div>
          {edit ? <div style={{ marginTop: '10px', border: '1px solid #fde68a', background: '#fffbeb', borderRadius: '12px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600 }}>Adjust {s.comps.find(c => c.id === edit.id).name}: system {s.comps.find(c => c.id === edit.id).system} → final {edit.score}</div>
            <textarea value={edit.reason} onChange={e => setEdit({ ...edit, reason: e.target.value })} placeholder="Reason for the adjustment (required). It is stored with the result and shown in reports." style={{ ...INPUT, height: '70px', padding: '8px 10px', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn small onClick={() => setEdit(null)}>Cancel</Btn><Btn small kind="primary" disabled={!edit.reason.trim() || +edit.score === s.comps.find(c => c.id === edit.id).system && !s.comps.find(c => c.id === edit.id).adjusted} onClick={saveAdj}>Save adjustment</Btn></div>
          </div> : null}
        </section>
        {/* ===== STAFF EVALS · Question bank answers ===== */}
        {s.bank ? <Answers D={D} s={s} /> : null}
      </div>
    </Drawer>
  );
}
// ===== STAFF EVALS · Pass band badge =====
function BandBadge({ pct }) { const b = bandOf(pct); return <Badge bg={b.bg} fg={b.fg}>{b.name}</Badge>; }
// ===== STAFF EVALS · Question bank answers =====
// The participant's answers to the question bank for their job level, with the answer key.
function Answers({ D, s }) {
  const [open, setOpen] = useState(null);
  const bank = D.BANKS.find(b => b.id === s.bank);
  const src = D.staff.find(x => x.id === s.id);
  if (!bank || !src) return null;
  const items = src.sub.items.filter(it => it.bank === bank.id);
  const byComp = s.comps.filter(c => c.asked).map(c => ({ c, list: items.filter(it => it.comp === c.id) }));
  return (
    <section>
      <div style={{ fontSize: '15px', fontWeight: '600', marginBottom: '2px' }}>Question bank answers</div>
      <div style={{ fontSize: '12.5px', color: '#6b7280', marginBottom: '8px' }}>{bank.title} · {items.filter(it => it.value).length} of {items.length} correct · answer key from the DVLA tool</div>
      <div style={{ border: '1px solid rgba(15,35,65,.08)', borderRadius: '12px', overflow: 'hidden', background: '#fff' }}>
        {byComp.map(({ c, list }) => { const on = open === c.id; return (
          <div key={c.id} style={{ borderTop: '1px solid rgba(15,35,65,.07)' }}>
            <button type="button" onClick={() => setOpen(on ? null : c.id)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', background: 'none', border: '0', cursor: 'pointer', textAlign: 'left', font: '500 13px Inter,sans-serif', color: '#111827' }}>
              <i className={on ? 'icon-chevron-down' : 'icon-chevron-right'} style={{ fontSize: '14px', color: '#6b7280' }}></i>
              <span style={{ flex: 1 }}>{c.name}</span><span style={{ fontSize: '12px', color: '#6b7280' }}>{c.right} of {c.asked} correct</span></button>
            {on ? <ol style={{ margin: 0, padding: '0 16px 12px 40px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {list.map(it => { const q = bank.items[it.q]; return (
                <li key={it.q} style={{ fontSize: '12.5px', color: '#374151', lineHeight: 1.5 }}>
                  {q[1] ? <div style={{ fontSize: '11px', color: '#9ca3af' }}>{q[1]}</div> : null}
                  <div>{q[2]}</div>
                  <div style={{ marginTop: '4px', color: it.value ? '#15803d' : '#b91c1c' }}><i className={it.value ? 'icon-check' : 'icon-x'} style={{ fontSize: '12px' }}></i> Answered {'ABCD'[it.pick]}. {q[3][it.pick]}</div>
                  {!it.value ? <div style={{ color: '#15803d' }}>Correct: {'ABCD'[q[4]]}. {q[3][q[4]]}</div> : null}
                </li>); })}
            </ol> : null}
          </div>); })}
      </div>
    </section>
  );
}
// ===== STAFF EVALS · Stat tile =====
function Stat({ label, value, sub, color }) {
  return <div style={{ flex: '1 1 180px', border: '1px solid rgba(15,35,65,.08)', borderRadius: '12px', padding: '10px 12px', background: '#fff' }}>
    <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{label}</div>
    <div style={{ fontSize: '19px', fontWeight: 700, marginTop: '4px' }}>{value}</div>
    {sub ? <div style={{ fontSize: '11.5px', color: color || '#6b7280', marginTop: '3px' }}>{sub}</div> : null}
  </div>;
}
