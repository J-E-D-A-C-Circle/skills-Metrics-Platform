'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Badge, EmptyState, DataTable, Toast, Drawer, Toggle, INPUT, LABEL } from './smUI';
import { ALL, CURRENT } from './smModel';
import { loadForms, saveForms, newForm, makeQuestion, loadBank, QBANK_KEY } from './SMFormBuilder';

const KEY = 'skm-cycles';
const SC = { Draft: ['#fef3c7', '#92400e'], Scheduled: ['#e0e7ff', '#3730a3'], Open: ['#dcfce7', '#15803d'], Closed: ['#f3f4f6', '#4b5563'], Archived: ['#f3f4f6', '#9ca3af'] };
const TYPES = ['likert', 'single', 'multiple', 'numeric', 'text'];
const TYPE_ALIASES = { likert: 'likert', 'likert scale': 'likert', single: 'single', 'single choice': 'single', multiple: 'multiple', multi: 'multiple', 'multiple choice': 'multiple', 'multiple select': 'multiple', numeric: 'numeric', number: 'numeric', text: 'text', 'open text': 'text' };
const COLS = ['competency', 'question', 'type', 'options', 'correct answer', 'weight', 'required'];
const fmtDate = s => { if (!s) return '—'; const d = new Date(s + 'T00:00'); return isNaN(d) ? s : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); };
const load = (D) => { try { const v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (Array.isArray(v) && v.length) return v; } catch (e) {} return D.cycles; };
const persist = v => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} };
const splitList = v => String(v || '').split('|').map(x => x.trim()).filter(Boolean);
const yes = v => { const t = String(v == null ? '' : v).trim().toLowerCase(); return t === '' ? true : ['yes', 'y', 'true', '1', 'required'].includes(t); };

export default function SMCycles({ data: D, model, vw }) {
  const [cycles, setCycles] = useState(() => load(D));
  const [forms, setForms] = useState([]);
  const [q, setQ] = useState('');
  const [st, setSt] = useState(ALL);
  const [edit, setEdit] = useState(null);
  const [upload, setUpload] = useState(null);
  const [toast, setToast] = useState('');
  useEffect(() => { setForms(loadForms(D)); }, [D]);
  const flash = m => { setToast(m); clearTimeout(flash._t); flash._t = setTimeout(() => setToast(''), 3000); };
  const save = list => { setCycles(list); persist(list); };
  const participants = c => D.staff.filter(s => c.depts === 'all' || c.depts.includes(s.dept)).length;
  const submitted = c => c.id === 'cy4' ? model.staff.filter(s => s.scored).length : null;
  const formNames = [...new Set([...forms.map(f => f.name), ...cycles.map(c => c.form)])];
  const t = q.trim().toLowerCase();
  const rows = cycles.filter(c => (st === ALL ? c.status !== 'Archived' : c.status === st) && (!t || (c.name + ' ' + c.form).toLowerCase().includes(t)));
  const blankCycle = () => ({ id: null, name: '', form: formNames[0] || '', depts: 'all', start: D.iso(new Date(Date.now() + 14 * 864e5)), end: D.iso(new Date(Date.now() + 14 * 864e5)), open: '09:00', close: '17:00', duration: 45, attempts: 1, notify: { invite: true, reminder: true, results: true }, status: 'Draft', description: '' });
  const act = (c, kind) => {
    if (kind === 'dup') { const n = { ...c, id: 'cy' + Date.now().toString(36), name: c.name + ' (copy)', status: 'Draft' }; save([...cycles, n]); flash('Duplicated as a draft'); setEdit({ ...n, _orig: n }); return; }
    if (kind === 'close') { save(cycles.map(x => x.id === c.id ? { ...x, status: 'Closed', end: x.end < D.iso(new Date()) ? x.end : D.iso(new Date()) } : x)); flash(c.name + ' closed. No new attempts can start.'); return; }
    if (kind === 'archive') { save(cycles.map(x => x.id === c.id ? { ...x, status: 'Archived' } : x)); flash(c.name + ' archived'); return; }
    if (kind === 'restore') { save(cycles.map(x => x.id === c.id ? { ...x, status: 'Draft' } : x)); flash('Restored as a draft'); }
  };
  const counts = Object.fromEntries(Object.keys(SC).map(k => [k, cycles.filter(c => c.status === k).length]));
  return (
    <Page>
      <PageHeader title="Assessment Cycles" description="Schedule assessments for one, several or all departments. Upload an assessment or questions from Excel, CSV or JSON."
        actions={<>
          <Btn icon="icon-file-up" onClick={() => setUpload({ mode: 'questions' })}>Upload questions</Btn>
          <Btn icon="icon-upload" onClick={() => setUpload({ mode: 'assessment' })}>Upload assessment</Btn>
          <Btn kind="primary" icon="icon-plus" onClick={() => setEdit({ ...blankCycle(), _orig: null })}>New cycle</Btn></>}
        filters={<>
          <Search value={q} onChange={setQ} placeholder="Search cycle or form" />
          <Sel value={st} onChange={setSt} options={[[ALL, 'All active (' + (cycles.length - counts.Archived) + ')'], ...Object.keys(SC).map(k => [k, k + ' (' + counts[k] + ')'])]} />
        </>} />
      <Card title="Cycles" sub={rows.length + ' shown · participants are counted from each department’s staff list'} flush>
        <DataTable minWidth={1000} rows={rows} rowKey={c => c.id}
          empty={<EmptyState icon="icon-calendar-x" title="No cycles match" text={st === 'Archived' ? 'Nothing has been archived.' : 'Create a cycle or upload an assessment.'} action={<Btn kind="primary" icon="icon-plus" onClick={() => setEdit({ ...blankCycle(), _orig: null })}>New cycle</Btn>} />}
          columns={[
            { key: 'name', label: 'Cycle', render: c => <div style={{ maxWidth: '240px' }}><button type="button" onClick={() => setEdit({ ...c, _orig: c })} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', font: '600 13.5px Inter,sans-serif', color: '#111827', textAlign: 'left' }}>{c.name}</button>{c.description ? <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.description}</div> : null}</div> },
            { key: 'form', label: 'Form / template', render: c => <span title={forms.some(f => f.name === c.form) ? 'Form Builder form' : 'Template (not in the Form Builder)'} style={{ fontSize: '12.5px', display: 'block', maxWidth: '170px' }}>{c.form}</span> },
            { key: 'depts', label: 'Departments', render: c => c.depts === 'all' ? <Badge bg="#e6f2ea" fg="#0d3b2a">All departments</Badge> : <span title={c.depts.join(', ')} style={{ fontSize: '12.5px' }}>{c.depts.length === 1 ? c.depts[0] : c.depts.length + ' departments'}</span> },
            { key: 'start', label: 'Window', render: c => <div style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}><div>{fmtDate(c.start)}{c.end !== c.start ? ' – ' + fmtDate(c.end) : ''}</div><div style={{ color: '#6b7280' }}>{c.open}–{c.close}</div></div> },
            { key: 'duration', label: 'Duration', render: c => <span style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{c.duration} min<br /><span style={{ color: '#6b7280' }}>{c.attempts} attempt{c.attempts > 1 ? 's' : ''}</span></span> },
            { key: 'status', label: 'Status', render: c => <Badge bg={SC[c.status][0]} fg={SC[c.status][1]}>{c.status}</Badge> },
            { key: 'p', label: 'Participants', align: 'center', render: c => <div><b>{participants(c)}</b>{submitted(c) != null ? <div style={{ fontSize: '11px', color: '#6b7280' }}>{submitted(c)} submitted</div> : null}</div> },
            { key: 'a', label: '', align: 'right', render: c => <span style={{ display: 'inline-flex', gap: '6px' }}>
              <Btn small icon={c.status === 'Closed' || c.status === 'Archived' ? 'icon-eye' : 'icon-pencil'} onClick={() => setEdit({ ...c, _orig: c })}>{c.status === 'Closed' || c.status === 'Archived' ? 'View' : 'Edit'}</Btn>
              <Btn small icon="icon-copy" onClick={() => act(c, 'dup')} title="Duplicate as a new draft" />
              {c.status === 'Open' ? <Btn small kind="danger" icon="icon-lock" onClick={() => act(c, 'close')}>Close</Btn>
                : c.status === 'Archived' ? <Btn small icon="icon-archive-restore" onClick={() => act(c, 'restore')}>Restore</Btn>
                : <Btn small kind="danger" icon="icon-archive" onClick={() => act(c, 'archive')}>Archive</Btn>}
            </span> },
          ]} />
      </Card>
      {edit ? <CycleEditor D={D} c={edit} formNames={formNames} participants={participants} onClose={() => setEdit(null)}
        onSave={(c, msg) => { const { _orig, ...clean } = c; const exists = cycles.some(x => x.id === clean.id); const v = exists ? clean : { ...clean, id: 'cy' + Date.now().toString(36) }; save(exists ? cycles.map(x => x.id === v.id ? v : x) : [...cycles, v]); setEdit(null); flash(msg); }} /> : null}
      {upload ? <UploadDrawer D={D} mode={upload.mode} forms={forms} onClose={() => setUpload(null)}
        onImportAssessment={(meta, items) => { const f = newForm(meta.name, items, 'Imported from ' + meta.file); const fl = [...loadForms(D), f]; saveForms(fl); setForms(fl);
          const c = { id: 'cy' + Date.now().toString(36), name: meta.name, form: f.name, depts: meta.depts, start: meta.start, end: meta.end, open: meta.open, close: meta.close, duration: meta.duration, attempts: meta.attempts, notify: { invite: true, reminder: true, results: true }, status: 'Draft', description: meta.description || 'Imported from ' + meta.file };
          save([...cycles, c]); setUpload(null); setSt(ALL); flash('Draft "' + meta.name + '" created with ' + items.filter(x => x.type !== 'section').length + ' questions. Its form is in the Form Builder.'); }}
        onImportQuestions={(target, items) => {
          if (target === 'bank') { const b = [...loadBank(), ...items]; try { localStorage.setItem(QBANK_KEY, JSON.stringify(b)); } catch (e) {} setUpload(null); flash(items.length + ' questions added to the question bank'); return; }
          const fl = loadForms(D).map(f => { if (f.id !== target) return f;
            const g = { ...f, items: [...f.items, makeQuestion('section', { text: 'Imported questions' }), ...items] };
            if (f.status === 'Draft') return g;
            const v = Math.max(...f.history.map(h => h.v), f.version) + 1;
            return { ...g, status: 'Draft', version: v, history: [...f.history, { v, status: 'Draft', date: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }), note: 'Imported ' + items.length + ' questions', items: null }] }; });
          saveForms(fl); setForms(fl); setUpload(null); const f = fl.find(x => x.id === target);
          flash(items.length + ' questions added to "' + f.name + '"' + (f.version > 1 && f.status === 'Draft' ? ' as draft v' + f.version : '')); }} /> : null}
      <Toast text={toast} />
    </Page>
  );
}

function CycleEditor({ D, c, formNames, participants, onClose, onSave }) {
  const [f, setF] = useState(c);
  const [err, setErr] = useState('');
  const o = c._orig, isNew = !o;
  const status = o ? o.status : 'Draft';
  const full = status === 'Draft' || status === 'Scheduled';
  const isOpen = status === 'Open', readOnly = status === 'Closed' || status === 'Archived';
  const set = (k, v) => setF({ ...f, [k]: v });
  const lockTip = isOpen ? 'Locked while the cycle is open: staff may already have started.' : readOnly ? 'This cycle is ' + status.toLowerCase() + '.' : '';
  const dis = !full;
  const allDepts = f.depts === 'all';
  const submit = target => {
    const today = D.iso(new Date());
    if (!f.name.trim()) return setErr('Give the cycle a name.');
    if (!f.form) return setErr('Choose a form.');
    if (f.depts !== 'all' && !f.depts.length) return setErr('Choose at least one department, or All departments.');
    if (!f.start || !f.end || f.end < f.start) return setErr('The end date must be on or after the start date.');
    if (f.close <= f.open) return setErr('The window must close after it opens.');
    if (!(f.duration >= 5 && f.duration <= 240)) return setErr('Duration must be between 5 and 240 minutes.');
    if (!(f.attempts >= 1 && f.attempts <= 5)) return setErr('Attempt limit must be between 1 and 5.');
    if (isOpen && (f.end < o.end || (f.end === o.end && f.close < o.close))) return setErr('An open cycle can only be extended, not shortened.');
    if (target === 'Scheduled' && f.start < today) return setErr('A scheduled cycle must start today or later.');
    setErr('');
    onSave({ ...f, name: f.name.trim(), status: target || f.status }, isNew ? (target === 'Scheduled' ? 'Cycle scheduled. Staff will be invited.' : 'Draft cycle created') : isOpen ? 'Window updated' : target === 'Scheduled' && status === 'Draft' ? 'Cycle scheduled. Staff will be invited.' : 'Cycle saved');
  };
  const lockNote = isOpen ? 'This cycle is open, so staff may already have started. Only the closing date/time (to extend the window) and the description can change. The form, departments, duration and attempt limit are locked so every participant is assessed on the same terms.'
    : readOnly ? 'This cycle is ' + status.toLowerCase() + ' and cannot be edited. Duplicate it to reuse its settings.' : '';
  return (
    <Drawer open title={isNew ? 'New assessment cycle' : (readOnly ? '' : 'Edit · ') + c.name} sub={isNew ? 'Set up the form, departments and window' : status + ' · ' + participants(f) + ' participants'} onClose={onClose} width={640}
      footer={readOnly ? <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn onClick={onClose}>Close</Btn></div>
        : <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={onClose}>Cancel</Btn>
          {full ? <><Btn onClick={() => submit('Draft')}>Save as draft</Btn><Btn kind="primary" icon="icon-calendar-check" onClick={() => submit('Scheduled')}>{status === 'Scheduled' ? 'Save schedule' : 'Schedule'}</Btn></> : <Btn kind="primary" onClick={() => submit()}>Save changes</Btn>}</div>}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {lockNote ? <div style={{ display: 'flex', gap: '8px', padding: '10px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', fontSize: '12.5px', color: '#92400e', lineHeight: 1.5 }}><i className="icon-lock" style={{ fontSize: '14px', marginTop: '2px' }}></i>{lockNote}</div> : null}
        <Field label="NAME"><input value={f.name} disabled={dis} title={lockTip} onChange={e => set('name', e.target.value)} placeholder="e.g. Q1 2027 Skills Assessment" style={INPUT} /></Field>
        <Field label="FORM / TEMPLATE"><Sel value={f.form} disabled={dis} title={lockTip} onChange={v => set('form', v)} options={formNames.length ? formNames : ['']} /></Field>
        <div style={LABEL}>DEPARTMENTS
          <Toggle on={allDepts} disabled={dis} onClick={() => set('depts', allDepts ? [] : 'all')} label="All departments" desc={allDepts ? participants(f) + ' staff across ' + D.depts.length + ' departments' : 'Pick the departments below'} />
          {!allDepts ? <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '6px', marginTop: '4px' }}>
            {D.depts.map(d => { const on = f.depts.includes(d.name); return <label key={d.name} title={lockTip} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '10px', border: '1px solid ' + (on ? '#0d3b2a' : 'rgba(15,35,65,.1)'), background: on ? '#f1f8f3' : '#fff', cursor: dis ? 'not-allowed' : 'pointer', font: '500 13px Inter,sans-serif', color: '#111827', letterSpacing: 0, opacity: dis ? 0.6 : 1 }}>
              <input type="checkbox" disabled={dis} checked={on} onChange={() => set('depts', on ? f.depts.filter(x => x !== d.name) : [...f.depts, d.name])} style={{ accentColor: '#0d3b2a' }} />{d.name}<span style={{ marginLeft: 'auto', color: '#9ca3af', fontSize: '11.5px' }}>{D.staff.filter(s => s.dept === d.name).length}</span></label>; })}
          </div> : null}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: '12px' }}>
          <Field label="START DATE"><input type="date" value={f.start} disabled={dis} title={lockTip} onChange={e => set('start', e.target.value)} style={INPUT} /></Field>
          <Field label="END DATE" hint={isOpen ? 'Can be extended' : ''}><input type="date" value={f.end} disabled={readOnly} min={isOpen ? o.end : undefined} onChange={e => set('end', e.target.value)} style={INPUT} /></Field>
          <Field label="WINDOW OPENS"><input type="time" value={f.open} disabled={dis} title={lockTip} onChange={e => set('open', e.target.value)} style={INPUT} /></Field>
          <Field label="WINDOW CLOSES" hint={isOpen ? 'Can be extended' : ''}><input type="time" value={f.close} disabled={readOnly} onChange={e => set('close', e.target.value)} style={INPUT} /></Field>
          <Field label="DURATION (MIN)"><input type="number" min="5" max="240" value={f.duration} disabled={dis} title={lockTip} onChange={e => set('duration', +e.target.value)} style={INPUT} /></Field>
          <Field label="ATTEMPT LIMIT"><input type="number" min="1" max="5" value={f.attempts} disabled={dis} title={lockTip} onChange={e => set('attempts', +e.target.value)} style={INPUT} /></Field>
        </div>
        <div style={LABEL}>NOTIFICATIONS
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {[['invite', 'Invite staff when the cycle is scheduled'], ['reminder', 'Reminder the day before it opens'], ['results', 'Tell staff when results are released']].map(([k, l]) =>
              <Toggle key={k} on={!!f.notify[k]} disabled={dis} onClick={() => set('notify', { ...f.notify, [k]: !f.notify[k] })} label={l} />)}
          </div>
        </div>
        <Field label="DESCRIPTION"><textarea value={f.description} disabled={readOnly} onChange={e => set('description', e.target.value)} style={{ ...INPUT, height: '80px', padding: '8px 10px', resize: 'vertical' }} /></Field>
        {err ? <div style={{ padding: '9px 12px', borderRadius: '10px', background: '#fef2f2', color: '#991b1b', fontSize: '12.5px' }}>{err}</div> : null}
      </div>
    </Drawer>
  );
}

// ---------- Upload ----------
// Example rows for the upload templates, taken from the DVLA question banks.
function sampleQ(D) {
  const fw = Object.fromEntries(D.framework.map(c => [c.id, c]));
  const pick = (id, n) => (D.BANKS.find(b => b.id === id) || { items: [] }).items.slice(0, n).map(([cid, , text, opts, ans]) => [fw[cid].name, text, 'single', opts.join('|'), opts[ans], 1, 'yes']);
  return [['Leadership & Management', 'How would you rate your current proficiency in Leadership & Management?', 'likert', '', '', 2, 'yes'], ...pick('hr-0', 2), ...pick('rbdi-1', 2),
    ['Leadership & Management', 'Describe a recent piece of work that shows your Leadership & Management skills. What did you do, and what would you do differently?', 'text', '', '', 2, 'yes']];
}
async function downloadTemplate(D, mode) {
  const X = await import('xlsx');
  const wb = X.utils.book_new();
  if (mode === 'assessment') {
    const d = new Date(Date.now() + 30 * 864e5), iso = D.iso(d);
    const meta = [['Field', 'Value'], ['Name', 'Q1 2027 Skills Assessment'], ['Departments', 'All departments'], ['Start date', iso], ['End date', iso], ['Window opens', '09:00'], ['Window closes', '17:00'], ['Duration (minutes)', 45], ['Attempt limit', 1], ['Description', 'Imported from the assessment template']];
    X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(meta), 'Assessment');
  }
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([COLS, ...sampleQ(D)]), 'Questions');
  const help = [['Column', 'What to enter'], ['competency', 'A competency name from the Competency Library (see the list below). Required for likert questions.'], ['question', 'The question text. Required.'], ['type', 'likert, single, multiple, numeric or text'],
    ['options', 'single/multiple only: the choices separated by | (pipe)'], ['correct answer', 'single: one option. multiple: the correct options separated by |. numeric: the number. Leave blank for likert and text.'], ['weight', 'A number from 0 to 10 (default 1)'], ['required', 'yes or no (default yes)'],
    [], ...(mode === 'assessment' ? [['Assessment sheet', 'Departments: "All departments" or names separated by |. Dates as YYYY-MM-DD, times as HH:MM.'], []] : []), ['Valid competencies'], ...D.framework.map(c => [c.name, c.dept || 'All departments'])];
  X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet(help), 'Instructions');
  X.writeFile(wb, mode === 'assessment' ? 'assessment-upload-template.xlsx' : 'questions-upload-template.xlsx');
}
const cellStr = v => v instanceof Date ? v.toISOString().slice(0, 10) : String(v == null ? '' : v).trim();
function normaliseRow(r) { const o = {}; Object.keys(r).forEach(k => { o[String(k).trim().toLowerCase()] = cellStr(r[k]); }); return { competency: o.competency || '', question: o.question || '', type: (o.type || '').toLowerCase(), options: o.options || '', correct: o['correct answer'] || o.correct || '', weight: o.weight === '' || o.weight == null ? '1' : o.weight, required: o.required || 'yes', skip: false }; }
function validate(r, compNames) {
  const e = [];
  if (!r.question.trim()) e.push('Missing question text');
  const type = TYPE_ALIASES[r.type.trim().toLowerCase()];
  if (!type) e.push(r.type ? 'Bad type "' + r.type + '"' : 'Missing type');
  if (r.competency.trim() && !compNames[r.competency.trim().toLowerCase()]) e.push('Unknown competency "' + r.competency + '"');
  if (type === 'likert' && !r.competency.trim()) e.push('Likert needs a competency');
  const opts = splitList(r.options), corr = splitList(r.correct);
  if (type === 'single' || type === 'multiple') {
    if (opts.length < 2) e.push('Needs at least 2 options');
    else if (!corr.length) e.push('Missing correct answer');
    else if (type === 'single' && corr.length > 1) e.push('Single choice has one correct answer');
    else if (corr.some(c => !opts.includes(c))) e.push('Correct answer is not one of the options');
  }
  if (type === 'numeric' && r.correct !== '' && isNaN(+r.correct)) e.push('Correct answer must be a number');
  if (isNaN(+r.weight) || +r.weight < 0 || +r.weight > 10) e.push('Weight must be 0–10');
  if (!['yes', 'no', 'y', 'n', 'true', 'false', '1', '0', 'required', ''].includes(String(r.required).trim().toLowerCase())) e.push('Required must be yes or no');
  return e;
}
function toItem(r, compNames) {
  const type = TYPE_ALIASES[r.type.trim().toLowerCase()], comp = r.competency.trim() ? compNames[r.competency.trim().toLowerCase()] : '';
  const base = { text: r.question.trim(), comp, weight: +r.weight, required: yes(r.required) };
  const opts = splitList(r.options), corr = splitList(r.correct);
  if (type === 'likert') return makeQuestion('likert', base);
  if (type === 'single') return makeQuestion('single', { ...base, options: opts.map(o => ({ label: o, score: corr.includes(o) ? 1 : 0 })) });
  if (type === 'multiple') return makeQuestion('multi', { ...base, options: opts.map(o => ({ label: o, score: corr.includes(o) ? 1 : -1 })) });
  if (type === 'numeric') { const a = r.correct === '' ? '' : +r.correct; return makeQuestion('numeric', { ...base, answer: a, tol: 0, min: 0, max: a !== '' && a > 100 ? Math.ceil(a * 2) : 100 }); }
  return makeQuestion('text', { ...base, scoring: 'manual' });
}

function UploadDrawer({ D, mode, forms, onClose, onImportAssessment, onImportQuestions }) {
  const [file, setFile] = useState(null);
  const [rows, setRows] = useState(null);
  const [meta, setMeta] = useState(null);
  const [parseErr, setParseErr] = useState('');
  const [target, setTarget] = useState(forms[0] ? forms[0].id : 'bank');
  const compNames = useMemo(() => Object.fromEntries(D.framework.map(c => [c.name.toLowerCase(), c.name])), [D]);
  const deptByLower = Object.fromEntries(D.depts.map(d => [d.name.toLowerCase(), d.name]));
  const onFile = async e => {
    const fl = e.target.files && e.target.files[0]; e.target.value = ''; if (!fl) return;
    setParseErr(''); setRows(null); setMeta(null);
    const ext = fl.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv', 'json'].includes(ext)) { setParseErr('Use an .xlsx, .csv or .json file.'); return; }
    try {
      let qs = [], m = {};
      if (ext === 'json') {
        const j = JSON.parse(await fl.text());
        qs = Array.isArray(j) ? j : (j.questions || []);
        const a = j.assessment || {};
        m = { name: a.name, departments: Array.isArray(a.departments) ? a.departments.join('|') : a.departments, start: a.startDate || a.start, end: a.endDate || a.end, open: a.windowOpens || a.open, close: a.windowCloses || a.close, duration: a.duration, attempts: a.attempts || a.attemptLimit, description: a.description };
      } else {
        const X = await import('xlsx');
        const wb = X.read(await fl.arrayBuffer(), { cellDates: true });
        const qName = wb.SheetNames.find(n => n.toLowerCase() === 'questions') || wb.SheetNames.find(n => !['assessment', 'instructions'].includes(n.toLowerCase()));
        if (!qName) throw new Error('No Questions sheet found.');
        qs = X.utils.sheet_to_json(wb.Sheets[qName], { defval: '', raw: true });
        const aName = wb.SheetNames.find(n => n.toLowerCase() === 'assessment');
        if (aName) { const kv = {}; X.utils.sheet_to_json(wb.Sheets[aName], { header: 1, defval: '', raw: true }).slice(1).forEach(r => { if (r[0] !== '') kv[String(r[0]).trim().toLowerCase()] = cellStr(r[1]); });
          m = { name: kv.name, departments: kv.departments, start: kv['start date'], end: kv['end date'], open: kv['window opens'], close: kv['window closes'], duration: kv['duration (minutes)'] || kv.duration, attempts: kv['attempt limit'] || kv.attempts, description: kv.description }; }
      }
      if (!qs.length) throw new Error('The file has no question rows.');
      setRows(qs.map(r => normaliseRow(r)));
      if (mode === 'assessment') {
        const d0 = D.iso(new Date(Date.now() + 14 * 864e5));
        setMeta({ name: m.name || fl.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' '), departments: m.departments || 'All departments', start: cellStr(m.start) || d0, end: cellStr(m.end) || cellStr(m.start) || d0, open: m.open || '09:00', close: m.close || '17:00', duration: String(m.duration || 45), attempts: String(m.attempts || 1), description: m.description || '' });
      }
      setFile(fl.name);
    } catch (er) { setParseErr('Could not read ' + fl.name + ': ' + (er && er.message ? er.message : 'unknown error')); }
  };
  const metaErrs = [];
  let depts = 'all';
  if (meta) {
    if (!String(meta.name).trim()) metaErrs.push('Assessment name is missing');
    const dv = String(meta.departments).trim();
    if (dv && !/^all( departments)?$/i.test(dv)) { const list = splitList(dv.replace(/,/g, '|')); const bad = list.filter(x => !deptByLower[x.toLowerCase()]); if (bad.length) metaErrs.push('Unknown department: ' + bad.join(', ')); depts = list.map(x => deptByLower[x.toLowerCase()]).filter(Boolean); }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(meta.start) || !/^\d{4}-\d{2}-\d{2}$/.test(meta.end)) metaErrs.push('Dates must be YYYY-MM-DD');
    else if (meta.end < meta.start) metaErrs.push('End date is before start date');
    if (!/^\d{1,2}:\d{2}$/.test(meta.open) || !/^\d{1,2}:\d{2}$/.test(meta.close)) metaErrs.push('Times must be HH:MM');
    if (!(+meta.duration >= 5 && +meta.duration <= 240)) metaErrs.push('Duration must be 5–240 minutes');
    if (!(+meta.attempts >= 1 && +meta.attempts <= 5)) metaErrs.push('Attempt limit must be 1–5');
  }
  const checked = (rows || []).map(r => ({ r, errs: r.skip ? [] : validate(r, compNames) }));
  const included = checked.filter(x => !x.r.skip), bad = included.filter(x => x.errs.length);
  const canImport = rows && included.length && !bad.length && !metaErrs.length;
  const setRow = (i, k, v) => setRows(rows.map((r, j) => j === i ? { ...r, [k]: v } : r));
  const doImport = () => {
    if (!canImport) return;
    const items = included.map(x => toItem(x.r, compNames));
    if (mode === 'assessment') onImportAssessment({ name: String(meta.name).trim(), depts, start: meta.start, end: meta.end, open: meta.open.padStart(5, '0'), close: meta.close.padStart(5, '0'), duration: +meta.duration, attempts: +meta.attempts, description: meta.description, file }, [makeQuestion('section', { text: 'Imported questions' }), ...items]);
    else onImportQuestions(target, items);
  };
  const cellIn = { ...INPUT, height: '30px', fontSize: '12.5px', width: '100%' };
  return (
    <Drawer open title={mode === 'assessment' ? 'Upload assessment' : 'Upload questions'} sub={mode === 'assessment' ? 'Creates a draft cycle and a matching draft form' : 'Adds questions to an existing form or the question bank'} onClose={onClose} width={1120}
      footer={<div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '12.5px', color: bad.length || metaErrs.length ? '#b91c1c' : '#6b7280' }}>{!rows ? 'Choose a file to preview it.' : metaErrs.length ? 'Fix the assessment details above.' : bad.length ? 'Fix or skip ' + bad.length + ' row' + (bad.length > 1 ? 's' : '') + ' to continue.' : included.length + ' question' + (included.length === 1 ? '' : 's') + ' ready to import' + (rows.length - included.length ? ' · ' + (rows.length - included.length) + ' skipped' : '') + '.'}</span>
        <div style={{ display: 'flex', gap: '8px' }}><Btn onClick={onClose}>Cancel</Btn><Btn kind="primary" icon="icon-check" disabled={!canImport} onClick={doImport}>{mode === 'assessment' ? 'Create draft' : 'Import questions'}</Btn></div></div>}>
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'stretch' }}>
          <label style={{ flex: '2 1 320px', display: 'flex', alignItems: 'center', gap: '14px', padding: '16px', border: '1.5px dashed #c7ccd4', borderRadius: '14px', background: 'rgba(255,255,255,.6)', cursor: 'pointer' }}>
            <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: '#e6f2ea', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className="icon-cloud-upload" style={{ fontSize: '20px' }}></i></span>
            <span><span style={{ display: 'block', font: '600 14px Inter,sans-serif', color: '#111827' }}>{file ? file + ' · choose another file' : 'Choose a file'}</span><span style={{ font: '400 12px Inter,sans-serif', color: '#6b7280' }}>.xlsx, .csv or .json · read in your browser, nothing is uploaded to a server</span></span>
            <input type="file" accept=".xlsx,.xls,.csv,.json" onChange={onFile} style={{ display: 'none' }} />
          </label>
          <div style={{ flex: '1 1 240px', display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center', padding: '12px 14px', borderRadius: '14px', background: '#f5f6f8' }}>
            <span style={{ fontSize: '12.5px', color: '#374151' }}>Columns: {COLS.join(', ')}. Options are pipe-separated.</span>
            <Btn icon="icon-file-down" onClick={() => downloadTemplate(D, mode)}>Download template</Btn>
          </div>
        </div>
        {mode === 'questions' ? <Field label="ADD QUESTIONS TO" hint="Adding to a published form starts a new draft version, as in the Form Builder."><Sel value={target} onChange={setTarget} options={[...forms.map(f => [f.id, f.name + ' (' + f.status + ' v' + f.version + ')']), ['bank', 'Question bank (reusable in any form)']]} /></Field> : null}
        {parseErr ? <div style={{ padding: '9px 12px', borderRadius: '10px', background: '#fef2f2', color: '#991b1b', fontSize: '12.5px' }}>{parseErr}</div> : null}
        {meta ? <Card title="Assessment details" sub="From the Assessment sheet. You can fix anything here before importing." bodyStyle={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: '10px' }}>
          <Field label="NAME" style={{ gridColumn: 'span 2' }}><input value={meta.name} onChange={e => setMeta({ ...meta, name: e.target.value })} style={INPUT} /></Field>
          <Field label="DEPARTMENTS" style={{ gridColumn: 'span 2' }} hint='"All departments" or names separated by |'><input value={meta.departments} onChange={e => setMeta({ ...meta, departments: e.target.value })} style={INPUT} /></Field>
          <Field label="START DATE"><input value={meta.start} onChange={e => setMeta({ ...meta, start: e.target.value })} placeholder="YYYY-MM-DD" style={INPUT} /></Field>
          <Field label="END DATE"><input value={meta.end} onChange={e => setMeta({ ...meta, end: e.target.value })} placeholder="YYYY-MM-DD" style={INPUT} /></Field>
          <Field label="OPENS"><input value={meta.open} onChange={e => setMeta({ ...meta, open: e.target.value })} style={INPUT} /></Field>
          <Field label="CLOSES"><input value={meta.close} onChange={e => setMeta({ ...meta, close: e.target.value })} style={INPUT} /></Field>
          <Field label="DURATION (MIN)"><input value={meta.duration} onChange={e => setMeta({ ...meta, duration: e.target.value })} style={INPUT} /></Field>
          <Field label="ATTEMPTS"><input value={meta.attempts} onChange={e => setMeta({ ...meta, attempts: e.target.value })} style={INPUT} /></Field>
          {metaErrs.length ? <div style={{ gridColumn: '1 / -1', padding: '8px 12px', borderRadius: '10px', background: '#fef2f2', color: '#991b1b', fontSize: '12.5px' }}>{metaErrs.join(' · ')}</div> : null}
        </Card> : null}
        {rows ? <Card title="Preview" sub={rows.length + ' rows · ' + (included.length - bad.length) + ' valid · ' + bad.length + ' with errors · ' + (rows.length - included.length) + ' skipped. Edit a cell to fix it, or skip the row.'} flush>
          <datalist id="skm-comp-list">{D.framework.map(c => <option key={c.id} value={c.name} />)}</datalist>
          <DataTable minWidth={1240} rows={checked} rowKey={(x, i) => i} columns={[
            { key: 'n', label: '#', width: '36px', render: x => <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: '#6b7280' }}>{rows.indexOf(x.r) + 1}</span> },
            { key: 'skip', label: 'Import', width: '60px', align: 'center', render: x => <input type="checkbox" checked={!x.r.skip} onChange={() => setRow(rows.indexOf(x.r), 'skip', !x.r.skip)} style={{ accentColor: '#0d3b2a' }} title={x.r.skip ? 'Skipped' : 'Will be imported'} /> },
            { key: 'competency', label: 'Competency', width: '180px', render: x => <input list="skm-comp-list" value={x.r.competency} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'competency', e.target.value)} style={cellIn} /> },
            { key: 'question', label: 'Question', render: x => <input value={x.r.question} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'question', e.target.value)} style={{ ...cellIn, minWidth: '220px' }} /> },
            { key: 'type', label: 'Type', width: '110px', render: x => <select value={TYPE_ALIASES[x.r.type] || x.r.type} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'type', e.target.value)} style={{ ...cellIn, padding: '0 4px' }}>{!TYPE_ALIASES[x.r.type] ? <option value={x.r.type}>{x.r.type || '—'}</option> : null}{TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select> },
            { key: 'options', label: 'Options (a|b|c)', width: '190px', render: x => <input value={x.r.options} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'options', e.target.value)} style={cellIn} /> },
            { key: 'correct', label: 'Correct answer', width: '150px', render: x => <input value={x.r.correct} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'correct', e.target.value)} style={cellIn} /> },
            { key: 'weight', label: 'Weight', width: '64px', render: x => <input value={x.r.weight} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'weight', e.target.value)} style={cellIn} /> },
            { key: 'required', label: 'Req.', width: '74px', render: x => <select value={yes(x.r.required) ? 'yes' : 'no'} disabled={x.r.skip} onChange={e => setRow(rows.indexOf(x.r), 'required', e.target.value)} style={{ ...cellIn, padding: '0 4px' }}><option value="yes">yes</option><option value="no">no</option></select> },
            { key: 'errs', label: 'Check', width: '200px', render: x => x.r.skip ? <Badge>Skipped</Badge> : x.errs.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>{x.errs.map(e => <span key={e} style={{ fontSize: '11.5px', color: '#b91c1c', display: 'flex', gap: '4px' }}><i className="icon-circle-alert" style={{ fontSize: '12px', marginTop: '1px' }}></i>{e}</span>)}</div> : <Badge bg="#dcfce7" fg="#15803d"><i className="icon-check" style={{ fontSize: '11px' }}></i>OK</Badge> },
          ]} />
        </Card> : !parseErr ? <EmptyState icon="icon-file-spreadsheet" title="No file yet" text="Download the template, fill it in, then choose it here. You'll see every row with any problems before anything is imported." /> : null}
      </div>
    </Drawer>
  );
}
