'use client';
// =============================================================================
// SMCompetencies.jsx · Competency Framework: competencies grouped by category, with filters, details and editing
// Screen / URL: /framework
// Who sees it: users with "View framework" (framework.view, e.g. Administrators and Assessment Creators); adding and
//   editing competencies and categories needs "Edit competencies" (framework.competencies). The server checks both.
// Used by: components/SkillMatrixApp.jsx (PAGE ROUTER, pFramework)   Depends on: ./smUI, ./smApi, /api/competencies/**
// Sections (search for these markers): FRAMEWORK · Constants, FRAMEWORK · Page, FRAMEWORK · Category groups,
//   FRAMEWORK · Competency row, FRAMEWORK · Competency drawer, FRAMEWORK · Competency form, FRAMEWORK · Category dialog
// Deactivating a competency or category only stops it being used for new content; saved results never change.
// =============================================================================
import React, { useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, Drawer, INPUT, LABEL } from './smUI';
import { api, qs, useLoad, fmtDate } from './smApi';

// ===== FRAMEWORK · Constants =====
// Importance 1-5 (the DVLA assessment tools' scale), shown with a text label as well as a colour.
const IMP = [null,
  { label: 'Not Important', bg: '#1c8fd1', fg: '#fff' }, { label: 'Of Minor Importance', bg: '#2f9e44', fg: '#fff' }, { label: 'Moderately Important', bg: '#f2c200', fg: '#3b2f00' },
  { label: 'Very Important', bg: '#f08c00', fg: '#fff' }, { label: 'Critically Important', bg: '#e03131', fg: '#fff' }];
const MONO = { font: "600 12px 'JetBrains Mono',monospace", color: '#6b7280' };
const SUB = { fontSize: '11.5px', color: '#6b7280', marginTop: '3px', lineHeight: 1.45 };
const ERR = { fontSize: '12.5px', color: '#b91c1c', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '8px 10px' };
const NOTE = { fontSize: '12.5px', color: '#374151', background: '#f0f7f2', border: '1px solid #cfe6d7', borderRadius: '10px', padding: '8px 10px', lineHeight: 1.5 };
const GRID = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px' };
const ImpBadge = ({ n }) => IMP[n] ? <Badge bg={IMP[n].bg} fg={IMP[n].fg} style={{ borderRadius: '6px' }}>Importance {n} · {IMP[n].label}</Badge> : null;
const Off = () => <Badge bg="#f3f4f6" fg="#4b5563"><i className="icon-circle-pause" style={{ fontSize: '11px' }}></i>Inactive</Badge>;
const catName = c => (c ? c.name + ' · ' + c.group : '—');
const FieldErr = ({ e }) => (e ? <span style={{ font: '400 11.5px Inter,sans-serif', letterSpacing: 0, color: '#b91c1c' }}>{[].concat(e)[0]}</span> : null);

// ===== FRAMEWORK · Page =====
export default function SMCompetencies(S) {
  const perms = (S.me && S.me.perms) || [];
  const mayEdit = perms.includes('framework.competencies');
  const toast = m => (S.toast ? S.toast(m) : null);
  const [q, setQ] = useState('');
  const [f, setF] = useState({ departmentId: '', categoryId: '', status: '' });
  const [open, setOpen] = useState(null); // { id } | { id, edit } | { create, categoryId? }
  const [cat, setCat] = useState(null); // category being added / edited ({} = new)
  const { data, error, loading, reload } = useLoad('/api/competencies' + qs(f));
  const set = k => v => setF(x => ({ ...x, [k]: v }));
  const rows = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data ? data.rows : []).filter(c => !t || [c.code, c.name, c.short, c.category && c.category.group, ...(c.skillAreas || [])].some(x => String(x || '').toLowerCase().includes(t)));
  }, [data, q]);
  const filtered = !!(q.trim() || f.departmentId || f.categoryId || f.status);
  const groups = useMemo(() => {
    if (!data) return [];
    return data.categories.filter(k => (!f.categoryId || String(k.id) === f.categoryId) && (!filtered || rows.some(c => c.categoryId === k.id)))
      .map(k => ({ ...k, items: rows.filter(c => c.categoryId === k.id) }));
  }, [data, rows, f.categoryId, filtered]);
  const depts = data ? data.departments : [];
  const deptName = id => (depts.find(d => d.id === id) || {}).name;
  return (
    <Page>
      <PageHeader title="Competency Framework" description="Competencies grouped by category. General skills apply to every department; technical ones belong to one department. Assessment questions are mapped to these competencies."
        actions={mayEdit ? <><Btn icon="icon-folder-plus" onClick={() => setCat({})}>Add category</Btn><Btn kind="primary" icon="icon-plus" onClick={() => setOpen({ create: true })}>Add competency</Btn></> : null}
        filters={<>
          <Search value={q} onChange={setQ} placeholder="Search name, code, category or skill area" />
          <Sel value={f.departmentId} onChange={set('departmentId')} title="Department" options={[['', 'All departments'], ['general', 'General skills (every department)'], ...depts.map(d => [String(d.id), d.name + (d.active ? '' : ' (inactive)')])]} />
          <Sel value={f.categoryId} onChange={set('categoryId')} title="Category" options={[['', 'All categories'], ...(data ? data.categories : []).map(k => [String(k.id), catName(k) + (k.active ? '' : ' (inactive)')])]} />
          <Sel value={f.status} onChange={set('status')} title="Status" options={[['', 'Active and inactive'], ['active', 'Active only'], ['inactive', 'Inactive only']]} />
        </>} />
      {/* ===== FRAMEWORK · Category groups ===== */}
      <Card title={data ? rows.length + (filtered ? ' of ' + data.total : '') + ' competencies' : 'Competencies'} sub={data ? data.categories.length + ' categories · ' + data.rows.filter(c => c.active).length + ' active in this view' : null} flush>
        {error ? <EmptyState icon="icon-circle-alert" title="Could not load the framework" text={error} action={<Btn icon="icon-refresh-cw" onClick={reload}>Try again</Btn>} />
          : !data ? <div style={{ padding: '30px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>Loading…</div>
          : !groups.length ? <EmptyState icon="icon-network" title={filtered ? 'No competencies match these filters' : 'No competencies yet'} text={filtered ? 'Try a different search or clear a filter.' : mayEdit ? 'Add a category, then add competencies to it.' : ''} />
          : <div style={{ opacity: loading ? 0.6 : 1 }}>{groups.map(g => (
            <div key={g.id} style={{ borderBottom: '1px solid rgba(15,35,65,.07)' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '12px 20px', background: 'rgba(255,255,255,.45)' }}>
                <i className="icon-folder-tree" style={{ fontSize: '15px', color: '#6b7280' }}></i>
                <span style={{ flex: '1 1 200px', fontSize: '14px', fontWeight: 600 }}>{g.group} <span style={{ fontWeight: 500, fontSize: '12px', color: '#6b7280' }}>· {g.name}</span></span>
                {!g.active ? <Off /> : null}
                <span style={{ fontSize: '12px', color: '#6b7280' }}>{g.items.length} {g.items.length === 1 ? 'competency' : 'competencies'}</span>
                {mayEdit ? <><Btn small kind="ghost" icon="icon-pencil" onClick={() => setCat(g)}>Edit</Btn>{g.active ? <Btn small kind="ghost" icon="icon-plus" onClick={() => setOpen({ create: true, categoryId: g.id })}>Add</Btn> : null}</> : null}
              </div>
              {g.items.length ? g.items.map(c => <CompRow key={c.id} c={c} dept={deptName(c.departmentId)} onOpen={() => setOpen({ id: c.id })} />)
                : <div style={{ padding: '10px 20px 12px 46px', fontSize: '12.5px', color: '#9ca3af' }}>No competencies in this category{filtered ? ' match the filters' : ' yet'}.</div>}
            </div>))}</div>}
      </Card>
      {open ? <CompDrawer key={open.id || 'new'} open={open} setOpen={setOpen} data={data} mayEdit={mayEdit} toast={toast} onChanged={reload} /> : null}
      {cat ? <CategoryDialog cat={cat} onClose={() => setCat(null)} toast={toast} onChanged={reload} /> : null}
    </Page>
  );
}

// ===== FRAMEWORK · Competency row =====
function CompRow({ c, dept, onOpen }) {
  return (
    <button type="button" onClick={onOpen} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', padding: '10px 20px 10px 46px', border: 0, borderTop: '1px solid rgba(15,35,65,.07)', background: 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit', color: 'inherit', opacity: c.active ? 1 : 0.7 }}>
      <span style={{ flex: '1 1 240px', fontSize: '13.5px', minWidth: 0 }}>
        <span style={{ ...MONO, marginRight: '6px' }}>{c.code}</span><span style={{ fontWeight: 500 }}>{c.name}</span>
        {c.skillAreas.length ? <span style={{ ...SUB, display: 'block' }}>Skill areas: {c.skillAreas.join(' · ')}</span> : null}
      </span>
      <Badge bg={c.departmentId ? '#eef2ff' : '#e6f2ea'} fg={c.departmentId ? '#3730a3' : '#0d3b2a'}>{c.departmentId ? dept || 'Department' : 'All departments'}</Badge>
      <ImpBadge n={c.importance} />
      <span style={{ fontSize: '12px', color: '#374151', width: '96px' }}>Required <b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{c.requiredLevel.toFixed(2)}</b></span>
      <span style={{ fontSize: '11.5px', color: '#9ca3af', width: '96px' }}>{c.questions} questions</span>
      {!c.active ? <Off /> : null}
      <i className="icon-chevron-right" style={{ fontSize: '14px', color: '#9ca3af' }}></i>
    </button>
  );
}

// ===== FRAMEWORK · Competency drawer =====
// Details, the assessments whose questions use it, and (with Edit competencies) the edit form and deactivate.
function CompDrawer({ open, setOpen, data, mayEdit, toast, onChanged }) {
  const d = useLoad(open.id ? '/api/competencies/' + open.id : null);
  const [ask, setAsk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const c = d.data && d.data.row;
  const close = () => setOpen(null);
  if (open.create || open.edit) return <CompForm row={open.create ? null : c} loading={!open.create && !c} data={data} presetCategory={open.categoryId}
    onClose={open.create ? close : () => setOpen({ id: open.id })} onSaved={(row, msg) => { toast(msg); onChanged(); setOpen({ id: row.id }); if (!open.create) d.reload(); }} />;
  const toggle = async () => {
    setBusy(true); setErr('');
    try { await api('PATCH', '/api/competencies/' + c.id, { active: !c.active }); toast(c.active ? 'Competency deactivated' : 'Competency reactivated'); setAsk(false); d.reload(); onChanged(); }
    catch (e) { setErr(e.message); setAsk(false); } finally { setBusy(false); }
  };
  const dept = c && c.department ? c.department.name : 'All departments';
  return (
    <Drawer open title={c ? c.name : 'Competency'} sub={c ? <span style={{ display: 'inline-flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}><span style={MONO}>{c.code}</span>{catName(c.category)}{!c.active ? <Off /> : null}</span> : null} onClose={close} width={700}
      footer={c && mayEdit ? <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
        {c.active ? <Btn icon="icon-circle-pause" onClick={() => setAsk(true)}>Deactivate</Btn> : <Btn icon="icon-circle-play" onClick={() => setAsk(true)}>Reactivate</Btn>}
        <Btn kind="primary" icon="icon-pencil" onClick={() => setOpen({ id: c.id, edit: true })}>Edit</Btn></div> : null}>
      {d.error ? <EmptyState icon="icon-circle-alert" title="Could not load this competency" text={d.error} /> : !c ? <div style={{ padding: '30px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>Loading…</div> : (
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {err ? <div style={ERR}>{err}</div> : null}
          {!c.active ? <div style={NOTE}>This competency is inactive: it is not offered for new questions. Results already saved for it are kept unchanged.</div> : null}
          <div style={GRID}>
            {[['Short name', c.short], ['Department', dept], ['Importance', <ImpBadge n={c.importance} />], ['Required level', <b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{c.requiredLevel.toFixed(2)} of 5</b>],
              ['Questions mapped', c.questions], ['Results recorded', c.finalResults ? c.finalResults + ' staff results' : 'None yet'], ['Last changed', fmtDate(c.updatedAt)]].map(([k, v]) =>
              <div key={k}><div style={LABEL}>{k.toUpperCase()}</div><div style={{ fontSize: '13.5px', marginTop: '4px' }}>{v}</div></div>)}
          </div>
          <div><div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>Skill areas</div>
            {c.skillAreas.length ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{c.skillAreas.map(s => <Badge key={s}>{s}</Badge>)}</div> : <div style={SUB}>No skill areas listed.</div>}</div>
          <div><div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '6px' }}>Used in assessments</div>
            {d.data.assessments.length ? d.data.assessments.map(a => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid rgba(15,35,65,.06)' }}>
              <span>{a.title}<span style={{ ...SUB, display: 'block' }}>Version {a.versions.join(', ')}</span></span><Badge>{a.status.charAt(0) + a.status.slice(1).toLowerCase()}</Badge></div>)
              : <div style={SUB}>No assessment questions are mapped to this competency yet.</div>}</div>
        </div>)}
      <Confirm open={ask} busy={busy} onCancel={() => setAsk(false)} onConfirm={toggle} danger={c && c.active} confirmText={c && c.active ? 'Deactivate' : 'Reactivate'}
        title={c ? (c.active ? 'Deactivate ' : 'Reactivate ') + c.name + '?' : ''}
        text={c && c.active ? 'It will no longer be offered when questions are written or mapped. Existing questions, attempt scores and final results are not changed.' : 'It will be offered again for new questions.'} />
    </Drawer>
  );
}

// ===== FRAMEWORK · Competency form =====
function CompForm({ row, loading, data, presetCategory, onClose, onSaved }) {
  const init = r => r ? { code: r.code, name: r.name, short: r.short || '', categoryId: String(r.categoryId), departmentId: r.departmentId ? String(r.departmentId) : '', importance: String(r.importance), requiredLevel: String(r.requiredLevel), skillAreas: r.skillAreas.join('\n') }
    : { code: '', name: '', short: '', categoryId: presetCategory ? String(presetCategory) : '', departmentId: '', importance: '4', requiredLevel: '5', skillAreas: '' };
  const [v, setV] = useState(init(row));
  const [errs, setErrs] = useState({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  React.useEffect(() => { if (row) setV(init(row)); }, [row && row.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = k => e => setV(x => ({ ...x, [k]: e && e.target ? e.target.value : e }));
  const codeLocked = row && (row.finalResults || row.attemptResults);
  const cats = (data ? data.categories : []).filter(k => k.active || String(k.id) === v.categoryId);
  const depts = (data ? data.departments : []).filter(d => d.active || String(d.id) === v.departmentId);
  const save = async () => {
    setErr(''); setErrs({});
    const lvl = Number(v.requiredLevel);
    if (v.name.trim().length < 2) { setErrs({ name: 'Enter the competency name.' }); return; }
    if (!v.categoryId) { setErrs({ categoryId: 'Pick a category.' }); return; }
    if (!(lvl >= 0 && lvl <= 5)) { setErrs({ requiredLevel: 'Use a number from 0 to 5.' }); return; }
    setBusy(true);
    try {
      const body = { name: v.name, short: v.short, categoryId: v.categoryId, departmentId: v.departmentId, importance: Number(v.importance), requiredLevel: Math.round(lvl * 100) / 100,
        skillAreas: v.skillAreas.split('\n').map(s => s.trim()).filter(Boolean), ...(codeLocked ? {} : { code: v.code }) };
      const d = row ? await api('PATCH', '/api/competencies/' + row.id, body) : await api('POST', '/api/competencies', body);
      onSaved(d.row, row ? 'Competency saved' : 'Competency added');
    } catch (e) { setErr(e.message); setErrs(e.fields || {}); } finally { setBusy(false); }
  };
  return (
    <Drawer open title={row ? 'Edit ' + row.name : 'Add competency'} sub={row ? 'Changes apply to new content and reports; saved scores are not recalculated.' : 'A new competency that questions can be mapped to.'} onClose={onClose} width={700}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={onClose} disabled={busy}>Cancel</Btn><Btn kind="primary" icon="icon-check" onClick={save} disabled={busy || loading}>{busy ? 'Saving…' : row ? 'Save changes' : 'Add competency'}</Btn></div>}>
      {loading ? <div style={{ padding: '30px', textAlign: 'center', fontSize: '13px', color: '#6b7280' }}>Loading…</div> : (
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {err ? <div style={ERR}>{err}</div> : null}
          <div style={GRID}>
            <Field label="NAME *"><input value={v.name} onChange={set('name')} style={INPUT} maxLength={160} autoFocus={!row} /><FieldErr e={errs.name} /></Field>
            <Field label="SHORT NAME" hint="Used in charts. Leave empty to use the name."><input value={v.short} onChange={set('short')} style={INPUT} maxLength={60} /><FieldErr e={errs.short} /></Field>
            <Field label="CODE" hint={codeLocked ? 'Fixed: results already use this code.' : row ? 'Used by question uploads and exports.' : 'Leave empty to make one from the name.'}>
              <input value={v.code} onChange={set('code')} disabled={!!codeLocked} placeholder="e.g. it7" style={{ ...INPUT, fontFamily: "'JetBrains Mono',monospace", background: codeLocked ? '#f3f4f6' : '#fff' }} maxLength={30} /><FieldErr e={errs.code} /></Field>
          </div>
          <div style={GRID}>
            <Field label="CATEGORY *"><Sel value={v.categoryId} onChange={set('categoryId')} options={[['', 'Choose a category'], ...cats.map(k => [String(k.id), catName(k)])]} /><FieldErr e={errs.categoryId} /></Field>
            <Field label="DEPARTMENT"><Sel value={v.departmentId} onChange={set('departmentId')} options={[['', 'All departments (general skill)'], ...depts.map(d => [String(d.id), d.name])]} /><FieldErr e={errs.departmentId} /></Field>
            <Field label="IMPORTANCE"><Sel value={v.importance} onChange={set('importance')} options={[1, 2, 3, 4, 5].map(n => [String(n), n + ' · ' + IMP[n].label])} /></Field>
            <Field label="REQUIRED LEVEL (0–5)" hint="The level staff are expected to reach."><input type="number" min="0" max="5" step="0.25" value={v.requiredLevel} onChange={set('requiredLevel')} style={INPUT} /><FieldErr e={errs.requiredLevel} /></Field>
          </div>
          <Field label="SKILL AREAS" hint="One per line.">
            <textarea value={v.skillAreas} onChange={set('skillAreas')} rows={5} style={{ ...INPUT, height: 'auto', padding: '8px 10px', resize: 'vertical', lineHeight: 1.5 }} />
            <FieldErr e={errs.skillAreas} />
          </Field>
        </div>)}
    </Drawer>
  );
}

// ===== FRAMEWORK · Category dialog =====
// Add or rename a category (name such as "Technical", group such as "Cybersecurity"), or deactivate / reactivate it.
function CategoryDialog({ cat, onClose, toast, onChanged }) {
  const isNew = !cat.id;
  const [v, setV] = useState({ name: cat.name || 'Technical', group: cat.group || '' });
  const [active, setActive] = useState(cat.active !== false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setErr('');
    if (v.name.trim().length < 2 || v.group.trim().length < 2) { setErr('Enter both the category name and the group.'); return; }
    setBusy(true);
    try {
      if (isNew) { await api('POST', '/api/competencies/categories', v); toast('Category added'); }
      else { const d = await api('PATCH', '/api/competencies/categories/' + cat.id, { ...v, active }); toast(d.retired ? 'Category deactivated with ' + d.retired + ' competencies' : 'Category saved'); }
      onChanged(); onClose();
    } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };
  const retiring = !isNew && cat.active !== false && !active;
  return (
    <Confirm open title={isNew ? 'Add category' : 'Edit category'} onCancel={onClose} onConfirm={save} busy={busy} confirmText={isNew ? 'Add' : retiring ? 'Deactivate and save' : 'Save'} danger={retiring}
      text={retiring ? 'Deactivating also deactivates its ' + (cat.competencies || 0) + ' competencies, so they are no longer used for new content. Saved results are not changed.' : null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {err ? <div style={ERR}>{err}</div> : null}
        <Field label="CATEGORY" hint="For example General or Technical."><input value={v.name} onChange={e => { const x = e.target.value; setV(s => ({ ...s, name: x })); }} style={INPUT} maxLength={60} /></Field>
        <Field label="GROUP" hint="For example Cybersecurity or Learning & Development Management."><input value={v.group} onChange={e => { const x = e.target.value; setV(s => ({ ...s, group: x })); }} style={INPUT} maxLength={120} autoFocus={isNew} /></Field>
        {!isNew ? <Toggle on={active} onClick={() => setActive(!active)} label={active ? 'Active' : 'Inactive'} desc="Inactive categories are not offered for new competencies." /> : null}
      </div>
    </Confirm>
  );
}
