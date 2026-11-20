'use client';
// =============================================================================
// SMOrganisation.jsx · Organisation CMS: Staff Records, Departments, Grades, Stations & Locations, Supervisors
// Screen / URL: /organisation?tab=staff (default) | departments | grades | stations | supervisors
// Who sees it: users with "View organisation" (org.view); adding / editing needs org.staff (staff records),
//   org.structure (departments, grades, stations, locations) or org.supervisors (supervisor assignments and links).
//   The server checks every permission and the department scope again (app/api/org/**).
// Used by: components/SkillMatrixApp.jsx (PAGE ROUTER, view = org-staff | org-departments | org-grades | org-stations |
//   org-supervisors)   Depends on: ./smUI, ./smApi, /api/org/**, /api/lookups
// Sections (search for these markers): ORG · Helpers, ORG · Page wrapper, ORG · Staff Records, ORG · Staff drawer,
//   ORG · Staff form, ORG · Staff picker, ORG · Bulk import, ORG · Structure table (shared), ORG · Departments,
//   ORG · Grades, ORG · Stations & Locations, ORG · Supervisors
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable, Drawer, KpiTile, download, INPUT, LABEL, Spinner } from '@/components/shared/smUI';
import { api, qs, useLoad, fmtDate } from '@/components/shared/smApi';

// ===== ORG · Helpers =====
// Status pills always carry a text label. Options for the custom Select are [value, label] pairs; '' means "all".
const STATUS = [['ACTIVE', 'Active'], ['INACTIVE', 'Inactive'], ['LEFT', 'Left']];
const STATUS_C = { ACTIVE: ['#e6f2ea', '#0d3b2a', 'icon-circle-check'], INACTIVE: ['#f3f4f6', '#4b5563', 'icon-circle-pause'], LEFT: ['#fef3c7', '#92400e', 'icon-log-out'] };
const StaffStatus = ({ s }) => { const c = STATUS_C[s] || STATUS_C.INACTIVE; return <Badge bg={c[0]} fg={c[1]}><i className={c[2]} style={{ fontSize: '11px' }}></i>{(STATUS.find(x => x[0] === s) || [, s])[1]}</Badge>; };
const ActiveBadge = ({ on }) => on ? <Badge bg="#e6f2ea" fg="#0d3b2a"><i className="icon-circle-check" style={{ fontSize: '11px' }}></i>Active</Badge> : <Badge bg="#f3f4f6" fg="#4b5563"><i className="icon-circle-pause" style={{ fontSize: '11px' }}></i>Inactive</Badge>;
const idOpts = (list, first, all = false) => [...(first ? [['', first]] : []), ...(list || []).filter(x => all || x.active !== false).map(x => [String(x.id), x.name + (x.active === false ? ' (inactive)' : '')])];
const stationLabel = s => s.name + (s.location && s.location.name && s.location.name !== s.name ? ' · ' + s.location.name : '');
const MONO = { font: "600 12px 'JetBrains Mono',monospace", color: '#374151', whiteSpace: 'nowrap' };
const SUB = { fontSize: '11.5px', color: '#6b7280', marginTop: '2px' };
const ERR = { fontSize: '12.5px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '8px 10px' };
const NOTE = { fontSize: '12.5px', color: '#374151', background: '#f0f7f2', border: '1px solid #cfe6d7', borderRadius: '10px', padding: '8px 10px', lineHeight: 1.5 };
const LINK = { background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' };
const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' };
// Spreadsheet-safe CSV cell: a value starting with = + - @ is prefixed with ' so Excel never runs it as a formula.
const csvCell = v => { const s = String(v == null ? '' : v); return '"' + (/^[=+\-@]/.test(s) ? "'" + s : s).replace(/"/g, '""') + '"'; };
const toCsv = (head, rows) => '﻿' + [head.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n');
function useDebounced(v, ms = 300) { const [d, set] = useState(v); useEffect(() => { const t = setTimeout(() => set(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; }
const FieldErr = ({ e }) => (e ? <span style={{ font: '400 11.5px Inter,sans-serif', letterSpacing: 0, color: '#b91c1c' }}>{[].concat(e)[0]}</span> : null);
function Pager({ page, pageSize, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return <div style={{ padding: '10px 16px', fontSize: '12.5px', color: '#6b7280' }}>{total} {total === 1 ? 'record' : 'records'}</div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '10px 16px', fontSize: '12.5px', color: '#6b7280' }}>
      <span>{(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total}</span>
      <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <Btn small icon="icon-chevron-left" disabled={page <= 1} onClick={() => onPage(page - 1)} title="Previous page" />
        <span>Page {page} of {pages}</span>
        <Btn small icon="icon-chevron-right" disabled={page >= pages} onClick={() => onPage(page + 1)} title="Next page" />
      </span>
    </div>
  );
}
const Loading = () => <div style={{ padding: '36px', textAlign: 'center', display: 'flex', justifyContent: 'center' }}><Spinner size="md" tone="brand" label="Loading…" /></div>;
const LoadError = ({ text, retry }) => <EmptyState icon="icon-circle-alert" title="Could not load this list" text={text} action={retry ? <Btn icon="icon-refresh-cw" onClick={retry}>Try again</Btn> : null} />;

// ===== ORG · Page wrapper =====
// view comes from the shell's tab. lookups feed every drop-down (inactive ones stay so old records show names).
export default function SMOrganisation(S) {
  const { view = 'org-staff', me } = S;
  const perms = (me && me.perms) || [];
  const can = k => perms.includes(k);
  const lk = useLoad('/api/lookups');
  const toast = m => (S.toast ? S.toast(m) : null);
  const p = { S, can, toast, lk: lk.data || { departments: [], grades: [], stations: [], locations: [] }, reloadLookups: lk.reload, vw: S.vw || 1200 };
  return (
    <Page>
      {view === 'org-staff' ? <StaffRecords {...p} /> : null}
      {view === 'org-departments' ? <Departments {...p} /> : null}
      {view === 'org-grades' ? <Grades {...p} /> : null}
      {view === 'org-stations' ? <Stations {...p} /> : null}
      {view === 'org-supervisors' ? <Supervisors {...p} /> : null}
    </Page>
  );
}

// ===== ORG · Staff Records =====
// Server-side search, filters, sort and pages (GET /api/org/staff). Supervisors only get staff in their scope.
function StaffRecords({ can, toast, lk, vw }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState({ departmentId: '', gradeId: '', stationId: '', status: '', sort: 'name' });
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null); // { id } | { id, edit: true } | { create: true }
  const [importing, setImporting] = useState(false);
  const dq = useDebounced(q);
  useEffect(() => setPage(1), [dq, f]);
  const path = '/api/org/staff' + qs({ q: dq, ...f, page, pageSize: 25 });
  const { data, error, loading, reload } = useLoad(path);
  const set = k => v => setF(x => ({ ...x, [k]: v }));
  const exportCsv = async () => {
    try {
      const d = await api('GET', '/api/org/staff' + qs({ q: dq, ...f, all: 1 }));
      const head = ['Staff ID', 'First name', 'Last name', 'Other names', 'Email', 'Designation', 'Department', 'Grade', 'Station', 'Location', 'Supervisor Staff ID', 'Supervisor', 'Status'];
      download('staff-records.csv', toCsv(head, d.rows.map(r => [r.staffNo, r.firstName, r.lastName, r.otherNames, r.email, r.designation, r.department, r.grade, r.station, r.location, r.supervisor?.staffNo, r.supervisor?.name, (STATUS.find(s => s[0] === r.status) || [])[1]])), 'text/csv');
      toast('Exported ' + d.rows.length + ' staff records');
    } catch (e) { toast(e.message); }
  };
  const cols = [
    { key: 'staffNo', label: 'Staff ID', render: r => <span style={MONO}>{r.staffNo}</span> },
    { key: 'name', label: 'Name', render: r => <div><button type="button" style={LINK} onClick={() => setOpen({ id: r.id })}>{r.name}</button>{r.email ? <div style={SUB}>{r.email}</div> : null}</div> },
    { key: 'designation', label: 'Designation', render: r => r.designation || <span style={{ color: '#9ca3af' }}>—</span> },
    { key: 'department', label: 'Department', render: r => r.department || <span style={{ color: '#9ca3af' }}>None</span> },
    { key: 'grade', label: 'Grade', render: r => r.grade || <span style={{ color: '#9ca3af' }}>—</span> },
    { key: 'station', label: 'Station', render: r => r.station ? <div>{r.station}{r.location && r.location !== r.station ? <div style={SUB}>{r.location}</div> : null}</div> : <span style={{ color: '#9ca3af' }}>—</span> },
    { key: 'supervisor', label: 'Supervisor', render: r => r.supervisor ? r.supervisor.name : <span style={{ color: '#9ca3af' }}>None</span> },
    { key: 'status', label: 'Status', render: r => <StaffStatus s={r.status} /> },
    { key: 'act', label: '', align: 'right', render: r => can('org.staff') ? <Btn small kind="ghost" icon="icon-pencil" onClick={() => setOpen({ id: r.id, edit: true })}>Edit</Btn> : <Btn small kind="ghost" icon="icon-eye" onClick={() => setOpen({ id: r.id })}>View</Btn> },
  ];
  return (
    <>
      <PageHeader description="Every member of staff with their Staff ID, department, grade, station and supervisor. Moving someone keeps where their earlier results came from."
        actions={<>
          <Btn icon="icon-download" onClick={exportCsv} disabled={!data || !data.total}>Export CSV</Btn>
          {can('org.staff') ? <Btn icon="icon-upload" onClick={() => setImporting(true)}>Import staff</Btn> : null}
          {can('org.staff') ? <Btn kind="primary" icon="icon-user-plus" onClick={() => setOpen({ create: true })}>Add staff</Btn> : null}
        </>}
        filters={<>
          <Search value={q} onChange={setQ} placeholder="Search Staff ID, name, email or designation" />
          <Sel value={f.departmentId} onChange={set('departmentId')} title="Department" options={[['', 'All departments'], ...idOpts(lk.departments, null, true), ['none', 'No department']]} />
          <Sel value={f.gradeId} onChange={set('gradeId')} title="Grade" options={idOpts(lk.grades, 'All grades', true)} />
          <Sel value={f.stationId} onChange={set('stationId')} title="Station" options={idOpts(lk.stations, 'All stations', true)} />
          <Sel value={f.status} onChange={set('status')} title="Status" options={[['', 'Any status'], ...STATUS]} />
          <Sel value={f.sort} onChange={set('sort')} title="Sort" options={[['name', 'Sort: name'], ['staffNo', 'Sort: Staff ID'], ['department', 'Sort: department'], ['updated', 'Sort: recently changed']]} />
        </>} />
      <Card flush>
        {error ? <LoadError text={error} retry={reload} /> : !data ? <Loading /> : (
          <div style={{ opacity: loading ? 0.6 : 1 }}>
            <DataTable columns={cols} rows={data.rows} minWidth={1000} rowKey={r => r.id}
              empty={<EmptyState icon="icon-id-card" title={dq || Object.values(f).some(v => v && v !== 'name') ? 'No staff match these filters' : 'No staff records yet'} text={dq || f.departmentId ? 'Try a different search or clear a filter.' : can('org.staff') ? 'Add staff one by one or import them from the Excel template.' : 'Staff records you can see will appear here.'} />} />
            <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
          </div>)}
      </Card>
      {open ? <StaffDrawer key={open.id || 'new'} open={open} setOpen={setOpen} can={can} lk={lk} toast={toast} onChanged={reload} vw={vw} /> : null}
      {importing ? <ImportDrawer onClose={() => setImporting(false)} toast={toast} onImported={reload} /> : null}
    </>
  );
}

// ===== ORG · Staff drawer =====
// View one record (details, placement history, login accounts, direct reports), then edit, change status or delete.
function StaffDrawer({ open, setOpen, can, lk, toast, onChanged }) {
  const { data, error, reload } = useLoad(open.id ? '/api/org/staff/' + open.id : null);
  const [ask, setAsk] = useState(null); // { status } | { del: true }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const close = () => setOpen(null);
  const r = data && data.row;
  const editing = open.create || open.edit;
  const saved = (row, msg) => { toast(msg); onChanged(); setOpen({ id: row.id }); if (!open.create) reload(); };
  const setStatus = async status => {
    setBusy(true); setErr('');
    try { await api('PATCH', '/api/org/staff/' + r.id, { status }); setAsk(null); toast('Status changed to ' + STATUS.find(s => s[0] === status)[1]); reload(); onChanged(); }
    catch (e) { setErr(e.message); setAsk(null); } finally { setBusy(false); }
  };
  const del = async () => {
    setBusy(true); setErr('');
    try { await api('DELETE', '/api/org/staff/' + r.id); setAsk(null); toast('Staff record deleted'); onChanged(); close(); }
    catch (e) { setErr(e.message); setAsk(null); } finally { setBusy(false); }
  };
  if (editing) return <StaffForm row={open.create ? null : r} loading={!open.create && !r} lk={lk} onClose={open.create ? close : () => setOpen({ id: open.id })} onSaved={saved} />;
  const facts = r ? [['Staff ID', <span style={MONO}>{r.staffNo}</span>], ['Email', r.email || '—'], ['Designation', r.designation || '—'], ['Department', r.department || 'None'],
    ['Grade', r.grade || '—'], ['Station', r.station ? r.station + (r.location && r.location !== r.station ? ' · ' + r.location : '') : '—'], ['Supervisor', r.supervisor ? r.supervisor.name + ' (' + r.supervisor.staffNo + ')' : 'None'],
    ['Assessment history', r.attempts ? r.attempts + ' attempts · ' + r.results + ' competency results' : 'No attempts yet']] : [];
  return (
    <Drawer open title={r ? r.name : 'Staff record'} sub={r ? <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center' }}><StaffStatus s={r.status} />{r.designation || ''}</span> : null} onClose={close} width={760}
      footer={r && can('org.staff') ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {r.status === 'ACTIVE' ? <><Btn icon="icon-circle-pause" onClick={() => setAsk({ status: 'INACTIVE' })}>Set inactive</Btn><Btn icon="icon-log-out" onClick={() => setAsk({ status: 'LEFT' })}>Mark as left</Btn></>
            : <Btn icon="icon-circle-play" onClick={() => setAsk({ status: 'ACTIVE' })}>Reactivate</Btn>}
          {!r.attempts && !r.results && !r.accounts && !r.reports ? <Btn kind="danger" icon="icon-trash-2" onClick={() => setAsk({ del: true })}>Delete</Btn> : null}
        </span>
        <Btn kind="primary" icon="icon-pencil" onClick={() => setOpen({ id: r.id, edit: true })}>Edit</Btn>
      </div> : null}>
      {error ? <LoadError text={error} retry={reload} /> : !data ? <Loading /> : (
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {err ? <div style={ERR}>{err}</div> : null}
          <div style={GRID}>{facts.map(([k, v]) => <div key={k}><div style={LABEL}>{k.toUpperCase()}</div><div style={{ fontSize: '13.5px', marginTop: '4px' }}>{v}</div></div>)}</div>
          {/* ===== ORG · Staff drawer · Placement history ===== */}
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Placement history</div>
            <div style={{ ...SUB, marginBottom: '8px' }}>Where this person sat over time. Results keep the department and station that applied when they were taken.</div>
            <DataTable rows={data.placements} minWidth={560} rowKey={p => p.id} empty={<div style={SUB}>No placement history recorded yet.</div>} columns={[
              { key: 'department', label: 'Department', render: p => p.department || '—' },
              { key: 'station', label: 'Station', render: p => p.station ? p.station + (p.location && p.location !== p.station ? ' · ' + p.location : '') : '—' },
              { key: 'from', label: 'From', render: p => fmtDate(p.fromDate) },
              { key: 'to', label: 'To', render: p => p.toDate ? fmtDate(p.toDate) : <Badge bg="#e6f2ea" fg="#0d3b2a">Current</Badge> },
              { key: 'reason', label: 'Reason', render: p => <span style={{ fontSize: '12.5px' }}>{p.reason || '—'}{p.changedBy ? <div style={SUB}>by {p.changedBy}</div> : null}</span> }]} />
          </div>
          {/* ===== ORG · Staff drawer · Accounts & reports ===== */}
          <div style={GRID}>
            <div><div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>Login accounts</div>
              {data.accounts.length ? data.accounts.map(a => <div key={a.id} style={{ fontSize: '13px', padding: '4px 0' }}><span style={MONO}>{a.username}</span> <span style={SUB}>· {a.status === 'ACTIVE' ? 'Active' : a.status.replace(/_/g, ' ').toLowerCase()}</span></div>)
                : <div style={SUB}>No login account. Accounts are managed in Settings › User Management.</div>}</div>
            <div><div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>Reports to this person ({data.reports.length})</div>
              {data.reports.length ? data.reports.slice(0, 12).map(x => <div key={x.id} style={{ fontSize: '13px', padding: '3px 0' }}><button type="button" style={LINK} onClick={() => setOpen({ id: x.id })}>{x.name}</button> <span style={SUB}>{x.staffNo}{x.status !== 'ACTIVE' ? ' · ' + x.status.toLowerCase() : ''}</span></div>) : <div style={SUB}>Nobody reports to this person.</div>}
              {data.reports.length > 12 ? <div style={SUB}>and {data.reports.length - 12} more</div> : null}</div>
          </div>
          {r.attempts || r.results ? <div style={NOTE}>This person has assessment records, so the record can't be deleted. Set it to Inactive or Left instead; their results stay in reports.</div> : null}
        </div>)}
      <Confirm open={!!(ask && ask.status)} busy={busy} onCancel={() => setAsk(null)} onConfirm={() => setStatus(ask.status)}
        title={ask && ask.status === 'ACTIVE' ? 'Reactivate ' + (r && r.name) + '?' : ask && ask.status === 'LEFT' ? 'Mark ' + (r && r.name) + ' as left?' : 'Set ' + (r && r.name) + ' as inactive?'}
        text={ask && ask.status === 'ACTIVE' ? 'They will count in staff figures again and can be assigned assessments.' : 'They will no longer be counted as active staff or receive new assignments. Their results and history are kept.'}
        confirmText={ask && ask.status === 'ACTIVE' ? 'Reactivate' : 'Change status'} danger={ask && ask.status !== 'ACTIVE'} />
      <Confirm open={!!(ask && ask.del)} busy={busy} onCancel={() => setAsk(null)} onConfirm={del} danger confirmText="Delete record"
        title={'Delete ' + (r && r.name) + '?'} text="Only use this for a record entered by mistake. It has no attempts, results or login accounts, so nothing else is affected. This cannot be undone." />
    </Drawer>
  );
}

// ===== ORG · Staff form =====
// Add or edit. A department or station change asks for a reason and a confirmation, because it is recorded as a move.
function StaffForm({ row, loading, lk, onClose, onSaved }) {
  const blank = { staffNo: '', firstName: '', lastName: '', otherNames: '', email: '', designation: '', departmentId: '', gradeId: '', stationId: '', supervisorId: '', status: 'ACTIVE' };
  const from = r => r ? Object.fromEntries(Object.keys(blank).map(k => [k, r[k] == null ? '' : String(r[k])])) : blank;
  const [v, setV] = useState(from(row));
  const [sup, setSup] = useState(row && row.supervisor ? row.supervisor : null);
  const [reason, setReason] = useState('');
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmMove, setConfirmMove] = useState(false);
  useEffect(() => { if (row) { setV(from(row)); setSup(row.supervisor || null); } }, [row && row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setV(x => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const moved = row && (v.departmentId !== (row.departmentId == null ? '' : String(row.departmentId)) || v.stationId !== (row.stationId == null ? '' : String(row.stationId)));
  const name = id => { const d = [...lk.departments, ...lk.stations].find(x => String(x.id) === id); return d ? d.name : 'none'; };
  const save = async () => {
    setErr(''); setErrs({});
    const missing = {};
    if (!v.staffNo.trim()) missing.staffNo = 'Enter the Staff ID.';
    if (!v.firstName.trim()) missing.firstName = 'Enter the first name.';
    if (!v.lastName.trim()) missing.lastName = 'Enter the last name.';
    if (Object.keys(missing).length) { setErrs(missing); setErr('Please fill in the highlighted fields.'); return; }
    if (moved && !confirmMove) { setConfirmMove(true); return; }
    setBusy(true);
    try {
      const body = { ...v, supervisorId: sup ? sup.id : '', reason: moved ? reason : undefined };
      const d = row ? await api('PATCH', '/api/org/staff/' + row.id, body) : await api('POST', '/api/org/staff', body);
      setConfirmMove(false);
      onSaved(d.row, row ? (d.moved ? 'Saved. The move is recorded in the placement history' : d.unchanged ? 'Nothing changed' : 'Staff record saved') : 'Staff record added');
    } catch (e) { setErr(e.message); setErrs(e.fields || {}); setConfirmMove(false); } finally { setBusy(false); }
  };
  const inp = (k, label, props = {}) => <Field label={label}><input value={v[k]} onChange={set(k)} style={{ ...INPUT, ...(errs[k] ? { border: '1px solid #fca5a5' } : {}) }} {...props} /><FieldErr e={errs[k]} /></Field>;
  const dept = lk.departments.filter(d => d.active || String(d.id) === v.departmentId);
  const grades = lk.grades.filter(d => d.active || String(d.id) === v.gradeId);
  const stations = lk.stations.filter(d => d.active || String(d.id) === v.stationId).map(s => ({ ...s, location: lk.locations.find(l => l.id === s.locationId) }));
  return (
    <Drawer open title={row ? 'Edit ' + row.name : 'Add staff'} sub={row ? 'Staff ID ' + row.staffNo : 'A new staff record (the person). Login accounts are created in Settings › User Management.'} onClose={onClose} width={720}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={onClose} disabled={busy}>Cancel</Btn><Btn kind="primary" icon="icon-check" onClick={save} disabled={busy || loading}>{busy ? 'Saving…' : row ? 'Save changes' : 'Add staff'}</Btn></div>}>
      {loading ? <Loading /> : (
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {err ? <div style={ERR}>{err}</div> : null}
          <div style={GRID}>
            {inp('staffNo', 'STAFF ID *', { placeholder: 'e.g. DV-1001', autoFocus: !row })}
            {inp('firstName', 'FIRST NAME *')}
            {inp('lastName', 'LAST NAME *')}
            {inp('otherNames', 'OTHER NAMES')}
            {inp('email', 'EMAIL', { type: 'email', placeholder: 'name@dvla.gov.gh' })}
            {inp('designation', 'DESIGNATION', { placeholder: 'e.g. Senior Officer' })}
          </div>
          <div style={GRID}>
            <Field label="DEPARTMENT"><Sel value={v.departmentId} onChange={set('departmentId')} options={[['', 'No department'], ...idOpts(dept, null, true)]} /><FieldErr e={errs.departmentId} /></Field>
            <Field label="GRADE"><Sel value={v.gradeId} onChange={set('gradeId')} options={[['', 'No grade'], ...idOpts(grades, null, true)]} /><FieldErr e={errs.gradeId} /></Field>
            <Field label="STATION"><Sel value={v.stationId} onChange={set('stationId')} options={[['', 'No station'], ...stations.map(s => [String(s.id), stationLabel(s) + (s.active ? '' : ' (inactive)')])]} /><FieldErr e={errs.stationId} /></Field>
            <Field label="STATUS"><Sel value={v.status} onChange={set('status')} options={STATUS} /></Field>
          </div>
          <Field label="SUPERVISOR / HOD" hint="Search by name or Staff ID. Only active staff you can see are listed.">
            <StaffPicker value={sup} onChange={setSup} exclude={row && row.id} />
            <FieldErr e={errs.supervisorId} />
          </Field>
          {moved ? <div style={NOTE}><b>This is a move.</b> The current placement will be closed today and a new one opened, so earlier results keep {row.department || 'their old department'}{row.station ? ' / ' + row.station : ''}.
            <Field label="REASON FOR THE MOVE" style={{ marginTop: '8px' }}><input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Transfer to Kumasi Office" style={INPUT} maxLength={300} /></Field></div> : null}
        </div>)}
      <Confirm open={confirmMove} busy={busy} onCancel={() => setConfirmMove(false)} onConfirm={save} confirmText="Move and save"
        title={'Move ' + (row ? row.name : '') + '?'}
        text={row ? 'From ' + (row.department || 'no department') + ' / ' + (row.station || 'no station') + ' to ' + name(v.departmentId) + ' / ' + name(v.stationId) + '. The change is recorded in the placement history and the audit log.' : ''} />
    </Drawer>
  );
}

// ===== ORG · Staff picker =====
// A search box that looks up active staff in scope (GET /api/org/staff?q=) and picks one. value: { id, name, staffNo } | null.
function StaffPicker({ value, onChange, exclude, placeholder }) {
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const { data, loading } = useLoad(dq.trim().length >= 2 ? '/api/org/staff' + qs({ q: dq, status: 'ACTIVE', pageSize: 8 }) : null);
  if (value) return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...INPUT, height: 'auto', minHeight: '36px', padding: '4px 6px 4px 10px' }}>
      <i className="icon-user-round-check" style={{ color: '#127a42' }}></i>
      <span style={{ flex: 1, font: '500 13px Inter,sans-serif', color: '#111827' }}>{value.name} <span style={MONO}>{value.staffNo}</span></span>
      <Btn small kind="ghost" icon="icon-x" onClick={() => onChange(null)}>Clear</Btn>
    </div>);
  const rows = data ? data.rows.filter(r => r.id !== exclude) : [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <Search value={q} onChange={setQ} placeholder={placeholder || 'Type at least 2 letters of a name or Staff ID'} style={{ flex: 'none' }} />
      {dq.trim().length >= 2 ? <div style={{ border: '1px solid rgba(15,35,65,.1)', borderRadius: '10px', background: '#fff', maxHeight: '240px', overflowY: 'auto' }}>
        {loading && !data ? <div style={{ ...SUB, padding: '8px 10px' }}>Searching…</div> : rows.length ? rows.map(r => (
          <button key={r.id} type="button" onClick={() => { onChange({ id: r.id, name: r.name, staffNo: r.staffNo }); setQ(''); }} style={{ display: 'flex', width: '100%', justifyContent: 'space-between', gap: '8px', padding: '8px 10px', border: 0, borderBottom: '1px solid rgba(15,35,65,.06)', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: '500 13px Inter,sans-serif', color: '#111827' }}>
            <span>{r.name}<span style={{ ...SUB, display: 'block', letterSpacing: 0, textTransform: 'none', fontWeight: 400 }}>{[r.designation, r.department].filter(Boolean).join(' · ')}</span></span><span style={MONO}>{r.staffNo}</span>
          </button>)) : <div style={{ ...SUB, padding: '8px 10px' }}>No active staff match “{dq}”.</div>}
      </div> : null}
    </div>
  );
}

// ===== ORG · Bulk import =====
// 1 download the template, 2 choose the file, 3 check every row (nothing saved), 4 import all rows in one go.
function ImportDrawer({ onClose, toast, onImported }) {
  const [file, setFile] = useState(null);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState(false);
  const [onlyErr, setOnlyErr] = useState(false);
  const send = async mode => {
    if (!file) return;
    setBusy(true); setErr('');
    try {
      // The file is read here in the browser; only its cell text goes to the server (never the file itself).
      if (!/\.(xlsx|xls|csv)$/i.test(file.name || '')) throw new Error('Upload an .xlsx, .xls or .csv file (use the template).');
      if (file.size > 2 * 1024 * 1024) throw new Error('The file is larger than 2 MB. Split it into smaller files.');
      const XLSX = await import('xlsx');
      let wb;
      try { wb = XLSX.read(await file.arrayBuffer(), { type: 'array', cellFormula: false, cellHTML: false, cellStyles: false, bookVBA: false, dense: true }); }
      catch (e) { throw new Error('The file could not be read. Save it as .xlsx or .csv and try again.'); }
      const sheetName = wb.SheetNames.find(n => n.trim().toLowerCase() === 'staff') || wb.SheetNames[0];
      if (!sheetName) throw new Error('The file has no sheets.');
      const sheet = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], { header: 1, defval: '', raw: false, blankrows: false });
      const r = await fetch('/api/org/staff/import', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, fileName: file.name, sheetName, sheet }), credentials: 'same-origin', cache: 'no-store' });
      let d = {}; try { d = await r.json(); } catch (e) {}
      if (d.rows) setRes(d);
      if (!r.ok && !d.rows) throw new Error(d.error || 'Something went wrong. Please try again.');
      if (mode === 'import' && d.imported) { toast(d.imported + ' staff records imported'); onImported(); setAsk(false); onClose(); }
      else if (mode === 'import') setErr('Nothing was imported: fix the rows marked below and check the file again.');
    } catch (e) { setErr(e.message); } finally { setBusy(false); setAsk(false); }
  };
  const ok = res && !res.fileErrors.length && !res.invalid && res.total > 0;
  const rows = res ? res.rows.filter(r => !onlyErr || r.errors.length) : [];
  return (
    <Drawer open title="Import staff" sub="Add many staff records at once from an Excel or CSV file. Nothing is saved until every row passes the checks." onClose={onClose} width={860}
      footer={<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' }}>
        <Btn onClick={onClose} disabled={busy}>Close</Btn>
        <Btn icon="icon-list-checks" onClick={() => send('check')} disabled={!file || busy}>{busy && !ask ? 'Checking…' : 'Check file'}</Btn>
        <Btn kind="primary" icon="icon-upload" onClick={() => setAsk(true)} disabled={!ok || busy}>Import {ok ? res.total + ' staff' : ''}</Btn>
      </div>}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={NOTE}>
          <b>1.</b> Download the template and fill in the <b>Staff</b> sheet (Staff ID, First name and Last name are required). The <b>Lists</b> sheet shows the departments, grades and stations you can use.
          <div style={{ marginTop: '8px' }}><a href="/api/org/staff/template" download style={{ ...LINK, display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}><i className="icon-file-spreadsheet"></i>Download template (.xlsx)</a></div>
        </div>
        <Field label="2. CHOOSE THE FILE (.XLSX, .XLS OR .CSV, UP TO 2 MB)">
          <input type="file" accept=".xlsx,.xls,.csv" onChange={e => { setFile(e.target.files[0] || null); setRes(null); setErr(''); }} style={{ font: '400 13px Inter,sans-serif' }} />
        </Field>
        {err ? <div style={ERR}>{err}</div> : null}
        {res ? <>
          {res.fileErrors.length ? <div style={ERR}>{res.fileErrors.map(e => <div key={e}>{e}</div>)}</div> : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
              <Badge bg="#e6f2ea" fg="#0d3b2a"><i className="icon-circle-check" style={{ fontSize: '11px' }}></i>{res.valid} ready</Badge>
              <Badge bg={res.invalid ? '#fef2f2' : '#f3f4f6'} fg={res.invalid ? '#b91c1c' : '#4b5563'}><i className="icon-circle-alert" style={{ fontSize: '11px' }}></i>{res.invalid} with problems</Badge>
              <span style={SUB}>{res.fileName} · sheet “{res.sheetName}”</span>
              {res.invalid ? <span style={{ marginLeft: 'auto' }}><Toggle on={onlyErr} onClick={() => setOnlyErr(!onlyErr)} label="Only rows with problems" /></span> : null}
            </div>)}
          {res.invalid ? <div style={{ ...SUB, fontSize: '12.5px' }}>Fix these rows in your file, save it, choose it again and press <b>Check file</b>. Nothing has been imported.</div> : ok ? <div style={NOTE}>Every row passed the checks. Press <b>Import</b> to add them all in one go.</div> : null}
          {res.rows.length ? <DataTable rows={rows} minWidth={620} maxHeight="52vh" rowKey={r => r.row} columns={[
            { key: 'row', label: 'Row', width: '56px', render: r => <span style={MONO}>{r.row}</span> },
            { key: 'staffNo', label: 'Staff ID', render: r => <span style={MONO}>{r.staffNo || '—'}</span> },
            { key: 'name', label: 'Name', render: r => r.name || '—' },
            { key: 'errors', label: 'Check', render: r => r.errors.length ? <ul style={{ margin: 0, paddingLeft: '16px', color: '#b91c1c', fontSize: '12.5px' }}>{r.errors.map(e => <li key={e}>{e}</li>)}</ul> : <Badge bg="#e6f2ea" fg="#0d3b2a"><i className="icon-check" style={{ fontSize: '11px' }}></i>Ready</Badge> }]} /> : null}
        </> : null}
      </div>
      <Confirm open={ask} busy={busy} onCancel={() => setAsk(false)} onConfirm={() => send('import')} confirmText={'Import ' + (res ? res.total : '') + ' staff'}
        title="Import these staff records?" text="All rows are added together; if anything fails, nothing is added. Each person gets a placement history row and the import is recorded in the audit log." />
    </Drawer>
  );
}

// ===== ORG · Structure table (shared) =====
// Departments, grades, locations and stations: add, rename, deactivate / reactivate, delete when unused.
// kind: 'departments' | 'grades' | 'locations' | 'stations'; fields: [[key, label, type, options?]]; columns: extra columns.
function StructureCard({ kind, label, title, sub, rows, error, reload, fields, columns, canEdit, toast, onChanged, filterRow, extraActions, empty }) {
  const [edit, setEdit] = useState(null); // { row?, values }
  const [ask, setAsk] = useState(null); // { row, action: 'deactivate'|'reactivate'|'delete' }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [fe, setFe] = useState({});
  const blank = () => Object.fromEntries(fields.map(([k, , , , def]) => [k, def || '']));
  const startEdit = row => { setErr(''); setFe({}); setEdit({ row, values: row ? Object.fromEntries(fields.map(([k]) => [k, row[k] == null ? '' : String(row[k])])) : blank() }); };
  const done = msg => { toast(msg); reload(); onChanged && onChanged(); };
  const save = async () => {
    setBusy(true); setErr(''); setFe({});
    try {
      const body = { ...edit.values };
      if (edit.row) await api('PATCH', '/api/org/' + kind + '/' + edit.row.id, body); else await api('POST', '/api/org/' + kind, body);
      setEdit(null); done(edit.row ? label + ' saved' : label + ' added');
    } catch (e) { setErr(e.message); setFe(e.fields || {}); } finally { setBusy(false); }
  };
  const act = async () => {
    setBusy(true); setErr('');
    try {
      if (ask.action === 'delete') await api('DELETE', '/api/org/' + kind + '/' + ask.row.id);
      else await api('PATCH', '/api/org/' + kind + '/' + ask.row.id, { active: ask.action === 'reactivate' });
      done(label + (ask.action === 'delete' ? ' deleted' : ask.action === 'reactivate' ? ' reactivated' : ' deactivated')); setAsk(null);
    } catch (e) { toast(e.message); setAsk(null); } finally { setBusy(false); }
  };
  const cols = [...columns, { key: 'active', label: 'Status', render: r => <ActiveBadge on={r.active} /> },
    ...(canEdit ? [{ key: 'act', label: '', align: 'right', render: r => <span style={{ display: 'inline-flex', gap: '2px', flexWrap: 'nowrap' }}>
      {extraActions ? extraActions(r) : null}
      <Btn small kind="ghost" icon="icon-pencil" onClick={() => startEdit(r)}>Edit</Btn>
      {r.active ? <Btn small kind="ghost" icon="icon-circle-pause" onClick={() => setAsk({ row: r, action: 'deactivate' })}>Deactivate</Btn> : <Btn small kind="ghost" icon="icon-circle-play" onClick={() => setAsk({ row: r, action: 'reactivate' })}>Reactivate</Btn>}
      {!r.inUse ? <Btn small kind="ghost" icon="icon-trash-2" title={'Delete ' + label.toLowerCase()} onClick={() => setAsk({ row: r, action: 'delete' })} /> : null}
    </span> }] : [])];
  const nm = ask && ask.row ? ask.row.name : '';
  return (
    <Card title={title} sub={sub} flush actions={canEdit ? <Btn kind="primary" small icon="icon-plus" onClick={() => startEdit(null)}>Add {label.toLowerCase()}</Btn> : null}>
      {filterRow ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>{filterRow}</div> : null}
      {error ? <LoadError text={error} retry={reload} /> : !rows ? <Loading /> : <DataTable columns={cols} rows={rows} minWidth={680} rowKey={r => r.id} empty={empty || <EmptyState title={'No ' + label.toLowerCase() + 's to show'} text={canEdit ? 'Add one with the button above.' : ''} />} />}
      <Confirm open={!!edit} busy={busy} onCancel={() => setEdit(null)} onConfirm={save} confirmText={edit && edit.row ? 'Save' : 'Add'} title={edit && edit.row ? 'Edit ' + label.toLowerCase() : 'Add ' + label.toLowerCase()}
        text={edit && edit.row && edit.row.inUse ? 'Renaming changes the name everywhere it is shown, including older results.' : null}>
        {edit ? <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {err ? <div style={ERR}>{err}</div> : null}
          {fields.map(([k, l, type, opts]) => <Field key={k} label={l}>
            {type === 'select' ? <Sel value={edit.values[k]} onChange={x => setEdit(s => ({ ...s, values: { ...s.values, [k]: x } }))} options={opts} />
              : <input value={edit.values[k]} onChange={e => { const x = e.target.value; setEdit(s => ({ ...s, values: { ...s.values, [k]: x } })); }} style={INPUT} maxLength={120} />}
            <FieldErr e={fe[k]} /></Field>)}
        </div> : null}
      </Confirm>
      <Confirm open={!!ask} busy={busy} onCancel={() => setAsk(null)} onConfirm={act} danger={ask && ask.action !== 'reactivate'}
        confirmText={ask ? { delete: 'Delete', deactivate: 'Deactivate', reactivate: 'Reactivate' }[ask.action] : ''}
        title={ask ? { delete: 'Delete ', deactivate: 'Deactivate ', reactivate: 'Reactivate ' }[ask.action] + nm + '?' : ''}
        text={ask ? { delete: 'Nothing uses this ' + label.toLowerCase() + ' yet, so it can be removed for good. This cannot be undone.', deactivate: 'It will no longer be offered for new records. Staff and results that already use it keep it, and you can reactivate it later.', reactivate: 'It will be offered again for new records.' }[ask.action] : ''} />
    </Card>
  );
}
const countCell = (n, word) => <span style={{ fontSize: '12.5px', color: n ? '#374151' : '#9ca3af' }}>{n || 0} {word}</span>;
// Search + "show inactive" filter shared by the structure tabs.
function useStructureFilter(rows, keys = ['name']) {
  const [q, setQ] = useState(''), [inactive, setInactive] = useState(true);
  const list = useMemo(() => (rows || null) && rows.filter(r => (inactive || r.active) && (!q.trim() || keys.some(k => String(r[k] || '').toLowerCase().includes(q.trim().toLowerCase())))), [rows, q, inactive]); // eslint-disable-line react-hooks/exhaustive-deps
  const ui = <><Search value={q} onChange={setQ} placeholder="Search" /><Toggle on={inactive} onClick={() => setInactive(!inactive)} label="Show inactive" /></>;
  return [list, ui];
}

// ===== ORG · Departments =====
function Departments({ can, toast, reloadLookups }) {
  const { data, error, reload } = useLoad('/api/org/departments');
  const [rows, filter] = useStructureFilter(data && data.rows, ['name', 'code']);
  return (
    <>
      <PageHeader description="Departments group staff, competencies and assessment assignments. A department that is in use can be deactivated but not deleted, so older results keep its name." />
      <StructureCard kind="departments" label="Department" title="Departments" sub={data ? data.rows.length + ' departments · ' + data.rows.filter(r => r.active).length + ' active' : null}
        rows={rows} error={error} reload={reload} canEdit={can('org.structure')} toast={toast} onChanged={reloadLookups} filterRow={filter}
        fields={[['code', 'CODE (E.G. HR)'], ['name', 'NAME']]}
        columns={[{ key: 'code', label: 'Code', render: r => <span style={MONO}>{r.code}</span> }, { key: 'name', label: 'Name', render: r => <b style={{ fontWeight: 600 }}>{r.name}</b> },
          { key: 'staff', label: 'Staff', render: r => countCell(r.counts.staff, 'staff') }, { key: 'comps', label: 'Competencies', render: r => countCell(r.counts.competencies, 'technical') },
          { key: 'sup', label: 'Supervisors', render: r => countCell(r.counts.supervisorLinks, 'assigned') }]} />
    </>
  );
}

// ===== ORG · Grades =====
// Grades in rank order (most junior first); the arrows save a new order. A grade never grants system permissions.
function Grades({ can, toast, reloadLookups }) {
  const { data, error, reload } = useLoad('/api/org/grades');
  const [busy, setBusy] = useState(false);
  const [rows, filter] = useStructureFilter(data && data.rows);
  const move = async (r, dir) => {
    const ids = data.rows.map(x => x.id), i = ids.indexOf(r.id), j = i + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    setBusy(true);
    try { await api('PUT', '/api/org/grades/order', { ids }); toast('Grade order saved'); reload(); reloadLookups(); } catch (e) { toast(e.message); } finally { setBusy(false); }
  };
  const all = data ? data.rows : [];
  return (
    <>
      <PageHeader description="Job levels, from most junior to most senior. Grades are used for assignments and reports; they never give anyone system permissions." />
      <StructureCard kind="grades" label="Grade" title="Grades" sub="Use the arrows to change the order (position 1 = most junior)." rows={rows} error={error} reload={reload} canEdit={can('org.structure')} toast={toast} onChanged={reloadLookups} filterRow={filter}
        fields={[['name', 'NAME']]}
        extraActions={r => <><Btn small kind="ghost" icon="icon-arrow-up" title="Move up (more junior)" disabled={busy || all[0] === r} onClick={() => move(r, -1)} /><Btn small kind="ghost" icon="icon-arrow-down" title="Move down (more senior)" disabled={busy || all[all.length - 1] === r} onClick={() => move(r, 1)} /></>}
        columns={[{ key: 'rank', label: 'Position', width: '80px', render: r => <span style={MONO}>{all.indexOf(r) + 1}</span> }, { key: 'name', label: 'Grade', render: r => <b style={{ fontWeight: 600 }}>{r.name}</b> },
          { key: 'staff', label: 'Staff', render: r => countCell(r.counts.staff, 'staff') }, { key: 'map', label: 'Supervisory mappings', render: r => countCell(r.counts.supervisoryMapping, 'mappings') }]} />
    </>
  );
}

// ===== ORG · Stations & Locations =====
// Locations (offices / regions) hold stations; staff are placed at a station.
function Stations({ can, toast, reloadLookups }) {
  const locs = useLoad('/api/org/locations');
  const sts = useLoad('/api/org/stations');
  const [loc, setLoc] = useState('');
  const [lrows, lfilter] = useStructureFilter(locs.data && locs.data.rows, ['name', 'region']);
  const [srows0, sfilter] = useStructureFilter(sts.data && sts.data.rows, ['name']);
  const srows = srows0 && srows0.filter(s => !loc || String(s.locationId) === loc);
  const locOpts = idOpts(locs.data ? locs.data.rows : [], null);
  const changed = () => { reloadLookups(); locs.reload(); sts.reload(); };
  return (
    <>
      <PageHeader description="Stations are where staff are placed; each belongs to a location. Changing someone's station keeps their earlier placement in the history." />
      <StructureCard kind="stations" label="Station" title="Stations" sub={sts.data ? sts.data.rows.length + ' stations' : null} rows={srows} error={sts.error} reload={sts.reload} canEdit={can('org.structure')} toast={toast} onChanged={changed}
        filterRow={<>{sfilter}<Sel value={loc} onChange={setLoc} title="Location" options={[['', 'All locations'], ...idOpts(locs.data ? locs.data.rows : [], null, true)]} /></>}
        fields={[['name', 'STATION NAME'], ['locationId', 'LOCATION', 'select', locOpts, locOpts[0] ? locOpts[0][0] : '']]}
        columns={[{ key: 'name', label: 'Station', render: r => <b style={{ fontWeight: 600 }}>{r.name}</b> }, { key: 'loc', label: 'Location', render: r => r.location ? r.location.name : '—' },
          { key: 'staff', label: 'Staff', render: r => countCell(r.counts.staff, 'staff') }, { key: 'asg', label: 'Assignments', render: r => countCell(r.counts.assignments, 'assigned') }]} />
      <StructureCard kind="locations" label="Location" title="Locations" sub={locs.data ? locs.data.rows.length + ' locations' : null} rows={lrows} error={locs.error} reload={locs.reload} canEdit={can('org.structure')} toast={toast} onChanged={changed} filterRow={lfilter}
        fields={[['name', 'LOCATION NAME'], ['region', 'REGION']]}
        columns={[{ key: 'name', label: 'Location', render: r => <b style={{ fontWeight: 600 }}>{r.name}</b> }, { key: 'region', label: 'Region', render: r => r.region || '—' },
          { key: 'st', label: 'Stations', render: r => countCell(r.counts.stations, 'stations') }]} />
    </>
  );
}

// ===== ORG · Supervisors =====
// Department supervisors / HoDs (which account covers which department), grade-to-station-manager mappings, and
// which supervisor each member of staff reports to.
function Supervisors({ S, can, toast, lk }) {
  const { data, error, reload } = useLoad('/api/org/supervisors');
  const edit = can('org.supervisors');
  const [na, setNa] = useState({ accountId: '', departmentId: '' });
  const [nm, setNm] = useState({ gradeId: '', stationId: '', roleLabel: 'Station Manager' });
  const [ask, setAsk] = useState(null); // { kind, row?, text, title, run }
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const run = async () => {
    setBusy(true); setErr('');
    try { await ask.run(); setAsk(null); reload(); } catch (e) { setErr(e.message); setAsk(null); } finally { setBusy(false); }
  };
  const acc = data ? data.candidates.find(a => String(a.id) === na.accountId) : null;
  const dep = lk.departments.find(d => String(d.id) === na.departmentId);
  const assign = () => setAsk({ title: 'Assign ' + acc.name + ' to ' + dep.name + '?', text: acc.name + ' will cover ' + dep.name + ' as supervisor / HoD and will be able to see its staff and their results (the department is added to their department access).', confirm: 'Assign',
    run: async () => { await api('POST', '/api/org/supervisors/assignments', { accountId: acc.id, departmentId: dep.id }); toast(acc.name + ' now covers ' + dep.name); setNa({ accountId: '', departmentId: '' }); } });
  const addMapping = async () => {
    setErr('');
    try { await api('POST', '/api/org/supervisors/mappings', nm); toast('Mapping added'); setNm({ gradeId: '', stationId: '', roleLabel: 'Station Manager' }); reload(); } catch (e) { setErr(e.message); }
  };
  const stations = lk.stations.filter(s => s.active).map(s => ({ ...s, location: lk.locations.find(l => l.id === s.locationId) }));
  return (
    <>
      <PageHeader description="Who supervises whom. Covering a department gives a supervisor / HoD that department's team view; staff can also be linked to a named supervisor." />
      {err ? <div style={ERR}>{err}</div> : null}
      {error ? <Card><LoadError text={error} retry={reload} /></Card> : !data ? <Card><Loading /></Card> : <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
          <KpiTile label="Department supervisors" value={data.assignments.length} sub={new Set(data.assignments.map(a => a.department && a.department.id)).size + ' departments covered'} />
          <KpiTile label="Staff with a supervisor" value={data.activeStaff - data.noSupervisor} sub={'of ' + data.activeStaff + ' active staff you can see'} />
          <KpiTile label="Without a supervisor" value={data.noSupervisor} sub={data.noSupervisor ? 'Link them in the table below' : 'Everyone is linked'} subColor={data.noSupervisor ? '#92400e' : undefined} />
        </div>
        {/* ===== ORG · Supervisors · Department supervisors ===== */}
        <Card title="Department supervisors & HoDs" sub="An account with the Manager / Supervisor role that covers a department sees that department's staff and results." flush>
          {edit ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(15,35,65,.07)', alignItems: 'center' }}>
            <Sel value={na.accountId} onChange={x => setNa(s => ({ ...s, accountId: x }))} title="Supervisor account" style={{ minWidth: '220px' }} options={[['', data.candidates.length ? 'Choose a supervisor account' : 'No supervisor accounts'], ...data.candidates.map(a => [String(a.id), a.name + ' (' + a.username + ')'])]} />
            <Sel value={na.departmentId} onChange={x => setNa(s => ({ ...s, departmentId: x }))} title="Department" style={{ minWidth: '200px' }} options={idOpts(lk.departments, 'Choose a department')} />
            <Btn kind="primary" icon="icon-user-round-check" disabled={!acc || !dep} onClick={assign}>Assign</Btn>
          </div> : null}
          <DataTable rows={data.assignments} minWidth={620} rowKey={a => a.id} empty={<EmptyState icon="icon-user-round-check" title="No department supervisors yet" text={edit ? 'Choose an account and a department above.' : ''} />} columns={[
            { key: 'dept', label: 'Covers department', render: a => <b style={{ fontWeight: 600 }}>{a.department ? a.department.name : '—'}</b> },
            { key: 'name', label: 'Supervisor / HoD', render: a => <div>{a.account.name}<div style={SUB}>{a.account.username}</div></div> },
            { key: 'own', label: 'Own department', render: a => a.account.department || '—' },
            { key: 'scope', label: 'Department access', render: a => a.account.scope === 'ALL' ? <Badge bg="#e6f2ea" fg="#0d3b2a">All departments</Badge> : <Badge>{a.account.scope === 'SELECTED' ? 'Selected departments' : 'Own department'}</Badge> },
            { key: 'since', label: 'Since', render: a => fmtDate(a.createdAt) },
            ...(edit ? [{ key: 'act', label: '', align: 'right', render: a => <Btn small kind="ghost" icon="icon-user-round-x" onClick={() => setAsk({ title: 'Stop ' + a.account.name + ' covering ' + (a.department ? a.department.name : 'this department') + '?', text: 'They will no longer see that department\'s team results, unless it is their own department or they have access to all departments.', confirm: 'Remove', danger: true,
              run: async () => { await api('DELETE', '/api/org/supervisors/assignments/' + a.id); toast('Supervisor assignment removed'); } })}>Remove</Btn> }] : [])]} />
        </Card>
        {/* ===== ORG · Supervisors · Staff links ===== */}
        <SupervisorLinks S={S} edit={edit} toast={toast} lk={lk} supervisors={data.supervisors} onChanged={reload} />
        {/* ===== ORG · Supervisors · Grade mappings ===== */}
        <Card title="Grade-to-station-manager mappings" sub="Which grade acts as station manager or supervisor, at one station or at every station. A mapping never gives system permissions." flush>
          {edit ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(15,35,65,.07)', alignItems: 'center' }}>
            <Sel value={nm.gradeId} onChange={x => setNm(s => ({ ...s, gradeId: x }))} title="Grade" options={idOpts(lk.grades, 'Choose a grade')} />
            <Sel value={nm.stationId} onChange={x => setNm(s => ({ ...s, stationId: x }))} title="Station" options={[['', 'All stations'], ...stations.map(s => [String(s.id), stationLabel(s)])]} />
            <input value={nm.roleLabel} onChange={e => { const x = e.target.value; setNm(s => ({ ...s, roleLabel: x })); }} placeholder="Role, e.g. Station Manager" style={{ ...INPUT, flex: '1 1 180px' }} maxLength={80} />
            <Btn kind="primary" icon="icon-plus" disabled={!nm.gradeId || nm.roleLabel.trim().length < 2} onClick={addMapping}>Add mapping</Btn>
          </div> : null}
          <DataTable rows={data.mappings} minWidth={560} rowKey={m => m.id} empty={<EmptyState icon="icon-layers" title="No mappings yet" text={edit ? 'Pick a grade, a station (or all stations) and the role above.' : ''} />} columns={[
            { key: 'grade', label: 'Grade', render: m => <b style={{ fontWeight: 600 }}>{m.grade.name}</b> },
            { key: 'role', label: 'Acts as', render: m => m.roleLabel },
            { key: 'station', label: 'Station', render: m => m.station ? m.station.name + (m.station.location && m.station.location !== m.station.name ? ' · ' + m.station.location : '') : <Badge>All stations</Badge> },
            ...(edit ? [{ key: 'act', label: '', align: 'right', render: m => <Btn small kind="ghost" icon="icon-trash-2" onClick={() => setAsk({ title: 'Remove this mapping?', text: m.grade.name + ' as ' + m.roleLabel + ' at ' + (m.station ? m.station.name : 'all stations') + '.', confirm: 'Remove', danger: true,
              run: async () => { await api('DELETE', '/api/org/supervisors/mappings/' + m.id); toast('Mapping removed'); } })}>Remove</Btn> }] : [])]} />
        </Card>
      </>}
      <Confirm open={!!ask} busy={busy} onCancel={() => setAsk(null)} onConfirm={run} title={ask ? ask.title : ''} text={ask ? ask.text : ''} confirmText={ask ? ask.confirm : ''} danger={ask && ask.danger} />
    </>
  );
}

// ===== ORG · Supervisors · Staff links =====
// Tick staff, pick a supervisor, save (POST /api/org/supervisors/links). The list is paged and scoped by the server.
function SupervisorLinks({ edit, toast, lk, supervisors, onChanged }) {
  const [q, setQ] = useState('');
  const [f, setF] = useState({ departmentId: '', supervisorId: '' });
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState({});
  const [sup, setSup] = useState(null);
  const [ask, setAsk] = useState(null); // 'set' | 'clear'
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const dq = useDebounced(q);
  useEffect(() => setPage(1), [dq, f]);
  const { data, error, loading, reload } = useLoad('/api/org/staff' + qs({ q: dq, ...f, status: 'ACTIVE', page, pageSize: 20 }));
  const ids = Object.keys(sel).filter(k => sel[k]).map(Number);
  const pageIds = data ? data.rows.map(r => r.id) : [];
  const allOn = pageIds.length && pageIds.every(id => sel[id]);
  const save = async () => {
    setBusy(true); setErr('');
    try { const d = await api('POST', '/api/org/supervisors/links', { staffIds: ids, supervisorId: ask === 'set' ? sup.id : null }); toast(d.changed + ' staff updated' + (d.unchanged ? ' (' + d.unchanged + ' already set)' : '')); setSel({}); setAsk(null); reload(); onChanged(); }
    catch (e) { setErr(e.message); setAsk(null); } finally { setBusy(false); }
  };
  const box = (on, onClick, label) => <button type="button" role="checkbox" aria-checked={!!on} aria-label={label} onClick={onClick} style={{ width: '18px', height: '18px', borderRadius: '5px', border: on ? '0' : '1.5px solid #c7ccd4', background: on ? 'linear-gradient(180deg,#2fb36b,#15904c)' : '#fff', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}>{on ? <i className="icon-check" style={{ fontSize: '12px' }}></i> : null}</button>;
  return (
    <Card title="Staff and their supervisors" sub="Each member of staff can report to one named supervisor or HoD. Tick staff, choose the supervisor and save." flush>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
        <Search value={q} onChange={setQ} placeholder="Search staff" />
        <Sel value={f.departmentId} onChange={x => setF(s => ({ ...s, departmentId: x }))} title="Department" options={[['', 'All departments'], ...idOpts(lk.departments, null, true)]} />
        <Sel value={f.supervisorId} onChange={x => setF(s => ({ ...s, supervisorId: x }))} title="Supervisor" options={[['', 'Any supervisor'], ['none', 'No supervisor'], ...supervisors.map(s => [String(s.id), s.name + ' (' + s.reports + ')'])]} />
      </div>
      {edit && ids.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 16px', background: '#f0f7f2', borderBottom: '1px solid #cfe6d7', alignItems: 'flex-start' }}>
        <span style={{ font: '600 13px Inter,sans-serif', paddingTop: '9px' }}>{ids.length} selected</span>
        <div style={{ flex: '1 1 260px' }}><StaffPicker value={sup} onChange={setSup} placeholder="Find the supervisor by name or Staff ID" /></div>
        <Btn kind="primary" icon="icon-user-round-check" disabled={!sup} onClick={() => setAsk('set')}>Set supervisor</Btn>
        <Btn icon="icon-user-round-x" onClick={() => setAsk('clear')}>Clear supervisor</Btn>
        <Btn kind="ghost" onClick={() => setSel({})}>Clear selection</Btn>
      </div> : null}
      {err ? <div style={{ ...ERR, margin: '12px 16px 0' }}>{err}</div> : null}
      {error ? <LoadError text={error} retry={reload} /> : !data ? <Loading /> : <div style={{ opacity: loading ? 0.6 : 1 }}>
        <DataTable rows={data.rows} minWidth={680} rowKey={r => r.id} empty={<EmptyState icon="icon-users" title="No active staff match" text="Try a different search or filter." />} columns={[
          ...(edit ? [{ key: 'sel', label: box(allOn, () => setSel(s => ({ ...s, ...Object.fromEntries(pageIds.map(id => [id, !allOn])) })), 'Select all on this page'), width: '40px', sortable: false, render: r => box(sel[r.id], () => setSel(s => ({ ...s, [r.id]: !s[r.id] })), 'Select ' + r.name) }] : []),
          { key: 'staffNo', label: 'Staff ID', render: r => <span style={MONO}>{r.staffNo}</span> },
          { key: 'name', label: 'Name', render: r => <div>{r.name}{r.designation ? <div style={SUB}>{r.designation}</div> : null}</div> },
          { key: 'dept', label: 'Department', render: r => r.department || '—' },
          { key: 'sup', label: 'Supervisor', render: r => r.supervisor ? <div>{r.supervisor.name}<div style={SUB}>{r.supervisor.staffNo}</div></div> : <Badge bg="#fef3c7" fg="#92400e">None</Badge> }]} />
        <Pager page={data.page} pageSize={data.pageSize} total={data.total} onPage={setPage} />
      </div>}
      <Confirm open={!!ask} busy={busy} onCancel={() => setAsk(null)} onConfirm={save} confirmText={ask === 'set' ? 'Set supervisor' : 'Clear supervisor'} danger={ask === 'clear'}
        title={ask === 'set' ? 'Make ' + (sup ? sup.name : '') + ' the supervisor of ' + ids.length + ' staff?' : 'Clear the supervisor of ' + ids.length + ' staff?'}
        text="Each change is recorded in the audit log." />
    </Card>
  );
}
