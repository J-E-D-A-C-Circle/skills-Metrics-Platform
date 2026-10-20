'use client';
// =============================================================================
// SMFormBuilder.jsx · The drag-and-drop Form Builder for one assessment version (Build, Rubric & Scoring,
//   Preview & Test, Versions, Settings), saving every change to the database
// Screen / URL: "/forms?id=<assessment id>" (opened from the Assessment Content list)
// Who sees it: anyone with "View assessment content". Only the author of a Draft / Returned / Rejected version with
//   "Edit & submit drafts" can change it (the server checks again on every save); everyone else gets the same
//   screen read-only with the locked notice.
// Used by: components/SMContent.jsx (ContentItem: header, workflow buttons, notices and the Settings tab around it)
// Depends on: smUI (EmptyState, CompetencyBadge, GapStatusBadge), smApi (useLoad, fmtDate, fmtDateTime),
//   ui/select (Select), SMFormBuilder.module.css (hover styles from the original builder), lib/formBuilder.js (canvas
//   model and sections), lib/server/content.js (labels, limits, question checks), lib/scoring.js (preview score),
//   API: POST / PUT /api/content/[id]/questions, PATCH / DELETE /api/content/[id]/questions/[qid], PATCH /api/content/[id]
// Sections (search for these markers): FORMS · Constants, FORMS · Small parts, FORMS · Main component,
//   FORMS · Saving, FORMS · Editing actions, FORMS · Drag & drop, FORMS · Toolbar, FORMS · Tab bar, FORMS · Build tab,
//   FORMS · Question types palette, FORMS · Canvas, FORMS · Section header card, FORMS · Question card,
//   FORMS · Inspector, FORMS · Rubric & Scoring tab, FORMS · Preview tab, FORMS · Live score panel, FORMS · Versions tab
// Look and behaviour follow the original Form Builder (palette left, canvas middle, inspector right, the same cards
// and tab bar). Only the question types the scoring understands are offered: Section, Single choice, Multiple
// select, True / false and Open text (marked by hand). Sections are stored as the questions' skill area
// (see lib/formBuilder.js). A question is saved as soon as it is complete (text, options, the correct answer and a
// competency); until then it shows "Not saved" with what is missing, and leaving the page warns first.
// =============================================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import __css from './SMFormBuilder.module.css';
import { EmptyState, CompetencyBadge, GapStatusBadge } from './smUI';
import { useLoad, fmtDate, fmtDateTime } from './smApi';
import { Select } from './ui/select';
import { STATUS_LABEL, STATUS_COLOURS, LIMITS } from '../lib/server/content';
import { scoreAttempt, competencyStatus, gapStatus, formatAverage, DEFAULT_CONFIG } from '../lib/scoring';
import { BUILDER_TYPES, blankQuestion, newKey, itemsFromQuestions, areaAt, questionNumbers, moveTo, step, insertAt, payloadOf, problemsOf, isDirty, layoutOf, layoutChanged } from '../lib/formBuilder';

// ===== FORMS · Constants =====
const GLASS = { background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', border: '1px solid rgba(255,255,255,.85)', borderRadius: '22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)' };
const LAB = { display: 'flex', flexDirection: 'column', gap: '5px', font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' };
const INP = { height: '34px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', padding: '0 10px', font: '400 13px Inter,sans-serif', minWidth: '0', background: '#fff', color: '#111827' };
const ICON_BTN = c => ({ background: 'none', border: '0', color: c, cursor: 'pointer', display: 'flex', padding: '4px' });
const TABS = [['build', 'Build', 'icon-blocks'], ['rubric', 'Rubric & Scoring', 'icon-scale'], ['preview', 'Preview & Test', 'icon-eye'], ['versions', 'Versions', 'icon-history'], ['settings', 'Settings', 'icon-settings']];
const PALETTE = Object.entries(BUILDER_TYPES);
const isChoice = t => t === 'SINGLE_CHOICE' || t === 'MULTIPLE_CHOICE' || t === 'TRUE_FALSE';
async function call(method, path, body) {
  const r = await fetch(path, { method, credentials: 'same-origin', cache: 'no-store', headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined, body: body !== undefined ? JSON.stringify(body) : undefined });
  let d = {}; try { d = await r.json(); } catch (e) {}
  if (!r.ok) throw new Error(d.error || 'Something went wrong. Please try again.');
  return d;
}

// ===== FORMS · Small parts =====
const Pill = ({ bg, fg, children, style }) => <span style={{ font: '600 10.5px Inter,sans-serif', color: fg, background: bg, borderRadius: '999px', padding: '2px 7px', display: 'inline-flex', alignItems: 'center', gap: '4px', ...(style || {}) }}>{children}</span>;
const Switch = ({ on, onClick, label, disabled }) => (
  <button type="button" onClick={disabled ? undefined : onClick} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'none', border: '0', padding: '0', cursor: disabled ? 'default' : 'pointer', font: '500 13px Inter,sans-serif', color: '#374151' }}>
    <span style={{ width: '34px', height: '20px', borderRadius: '999px', padding: '2px', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? '#0d3b2a' : '#d1d5db' }}><span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff' }}></span></span>{label}</button>);
const GlassCard = ({ title, sub, actions, children, style }) => (
  <div style={{ ...GLASS, minWidth: 0, ...(style || {}) }}>
    {title ? <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(15,35,65,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
      <div><div style={{ fontSize: '16.5px', fontWeight: 600 }}>{title}</div>{sub ? <div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '4px' }}>{sub}</div> : null}</div>{actions || null}</div> : null}
    {children}
  </div>);

// ===== FORMS · Main component =====
// data: GET /api/content/[id] · editable: this person may change this version now · reload(): refetch data
// workflow: the workflow buttons (submit, review, publish…) · settings: the Settings tab · lockedNote: why it is read-only
export default function SMFormBuilder({ data, id, editable, reload, toast, vw, workflow, settings, lockedNote, onViewVersion }) {
  const v = data.version;
  const compById = useMemo(() => new Map(data.competencies.map(c => [c.id, c])), [data.competencies]);
  const lookups = useLoad('/api/lookups');
  const cfg = (lookups.data && lookups.data.scoring) || DEFAULT_CONFIG;
  const [items, setItemsState] = useState(() => itemsFromQuestions(v.questions));
  const itemsRef = useRef(items);
  const setItems = useCallback(f => { itemsRef.current = typeof f === 'function' ? f(itemsRef.current) : f; setItemsState(itemsRef.current); }, []);
  const [selKey, setSelKey] = useState(null), [tab, setTab] = useState('build'), [over, setOver] = useState(null);
  const [saving, setSaving] = useState(false), [saveErr, setSaveErr] = useState('');
  const [ans, setAns] = useState({}), [tried, setTried] = useState(false), [submitMsg, setSubmitMsg] = useState(null);
  const [title, setTitle] = useState(data.settings.title || data.assessment.title);
  const stored = useRef(v.questions.map(q => ({ id: q.id, skillArea: q.skillArea || null })));
  const deletes = useRef([]), lock = useRef(false), again = useRef(false), timer = useRef(null), drag = useRef(null);
  // A different version, or someone else's read-only view: always show exactly what is stored.
  useEffect(() => { setItems(itemsFromQuestions(v.questions)); setSelKey(null); }, [v.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stored.current = v.questions.map(q => ({ id: q.id, skillArea: q.skillArea || null })); if (!editable) setItems(itemsFromQuestions(v.questions)); }, [data]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTitle(data.settings.title || data.assessment.title); }, [data.settings.title, data.assessment.title]);
  const wide = (vw || 1440) >= 1180;
  const nums = questionNumbers(items);
  const unsaved = items.filter(isDirty);
  // Leaving with unsaved questions asks first (the browser's own "Leave site?" message).
  useEffect(() => {
    if (!unsaved.length) return undefined;
    const warn = e => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [unsaved.length]);

  // ===== FORMS · Saving =====
  // One save at a time. 1 deletes · 2 new and changed questions that pass the checks (POST / PATCH, with the
  // section title as skill area) · 3 the order and sections of everything saved (PUT, only when they differ).
  const flush = useCallback(async () => {
    if (!editable) return;
    if (lock.current) { again.current = true; return; }
    lock.current = true; setSaving(true);
    let changed = false;
    try {
      do {
        again.current = false;
        while (deletes.current.length) {
          const qid = deletes.current[0];
          await call('DELETE', '/api/content/' + id + '/questions/' + qid);
          deletes.current.shift(); stored.current = stored.current.filter(x => x.id !== qid); changed = true;
        }
        for (const it of itemsRef.current.filter(isDirty)) {
          const i = itemsRef.current.findIndex(x => x.key === it.key);
          if (i < 0) continue;
          const cur = itemsRef.current[i], payload = payloadOf(itemsRef.current, i), sent = cur.q;
          if (problemsOf(payload, compById).length) continue;
          if (!cur.id) {
            const r = await call('POST', '/api/content/' + id + '/questions', payload);
            stored.current = [...stored.current, { id: r.id, skillArea: payload.skillArea || null }];
            setItems(a => a.map(x => (x.key === cur.key ? { ...x, id: r.id, saved: sent } : x)));
          } else {
            await call('PATCH', '/api/content/' + id + '/questions/' + cur.id, payload);
            stored.current = stored.current.map(x => (x.id === cur.id ? { ...x, skillArea: payload.skillArea || null } : x));
            setItems(a => a.map(x => (x.key === cur.key ? { ...x, saved: sent } : x)));
          }
          changed = true;
        }
        if (layoutChanged(itemsRef.current, stored.current)) {
          const lay = layoutOf(itemsRef.current);
          await call('PUT', '/api/content/' + id + '/questions', { questions: lay });
          stored.current = lay; changed = true;
        }
      } while (again.current);
      setSaveErr('');
    } catch (e) { setSaveErr(e.message); toast(e.message); }
    finally { lock.current = false; setSaving(false); }
    if (changed) reload();
  }, [editable, id, compById, reload, toast, setItems]);
  const schedule = useCallback((ms = 700) => { clearTimeout(timer.current); timer.current = setTimeout(flush, ms); }, [flush]);
  useEffect(() => () => clearTimeout(timer.current), []);

  // ===== FORMS · Editing actions =====
  // Every change goes through change(): read-only versions say why instead of changing anything.
  const change = (f, ms) => { if (!editable) { toast(lockedNote || 'View only.'); return; } setItems(f); schedule(ms); };
  const updQ = (key, patch) => change(a => a.map(x => (x.key === key ? { ...x, q: { ...x.q, ...patch } } : x)));
  const above = at => { const a = itemsRef.current; for (let i = (at == null ? a.length : at) - 1; i >= 0; i--) if (a[i].kind === 'question' && a[i].q.competencies.length) return a[i].q.competencies; return []; };
  const make = (type, at) => {
    const it = type === 'section' ? { key: newKey('s'), kind: 'section', title: 'Section ' + (itemsRef.current.filter(x => x.kind === 'section').length + 1) }
      : { key: newKey('q'), kind: 'question', id: null, q: blankQuestion(type, above(at)), saved: null };
    change(a => insertAt(a, it, at), 150); if (editable) setSelKey(it.key);
  };
  const remove = key => change(a => { const it = a.find(x => x.key === key); if (it && it.id) deletes.current.push(it.id); return a.filter(x => x.key !== key); }, 150);
  const dup = i => { const it = itemsRef.current[i]; if (!it) return; const c = it.kind === 'section' ? { key: newKey('s'), kind: 'section', title: it.title + ' (copy)' } : { key: newKey('q'), kind: 'question', id: null, q: JSON.parse(JSON.stringify(it.q)), saved: null }; change(a => insertAt(a, c, i + 1), 150); if (editable) setSelKey(c.key); };
  const saveTitle = async () => {
    const t = title.trim();
    if (!editable || t === (data.settings.title || '') || t.length < 3) { if (t.length < 3) setTitle(data.settings.title || data.assessment.title); return; }
    try { await call('PATCH', '/api/content/' + id, { ...data.settings, title: t, description: data.settings.description || '', instructions: data.settings.instructions || '', maxAttempts: Number(data.settings.maxAttempts) }); reload(); toast('Title saved'); }
    catch (e) { toast(e.message); setTitle(data.settings.title || data.assessment.title); }
  };
  const saveNow = async () => {
    clearTimeout(timer.current); await flush();
    const left = itemsRef.current.filter(isDirty).length;
    toast(left ? left + ' question' + (left === 1 ? '' : 's') + ' can\'t be saved yet. Select ' + (left === 1 ? 'it' : 'them') + ' to see what is missing.' : 'Draft v' + v.versionNo + ' saved');
  };

  // ===== FORMS · Drag & drop =====
  // From the palette (a new item) or from the canvas (move; a section card carries its questions along).
  const dropAt = i => { const d = drag.current; drag.current = null; setOver(null); if (!d) return; if (d.kind === 'new') make(d.type, i); else change(a => moveTo(a, d.from, i), 150); };
  const dragEnd = () => { drag.current = null; setOver(null); };

  const sel = items.find(x => x.key === selKey);
  const selIndex = items.indexOf(sel);
  const sectionCount = items.filter(x => x.kind === 'section').length;
  const qItems = items.filter(x => x.kind === 'question');
  const vs = STATUS_COLOURS[v.status] || ['#f3f4f6', '#374151'];
  const saveText = saving ? 'Saving…' : saveErr ? 'Not saved: ' + saveErr : unsaved.length ? unsaved.length + ' not saved yet' : 'All changes saved';

  return (
    <>
      {/* ===== FORMS · Toolbar (name, status, Save draft, workflow) ===== */}
      <div style={GLASS}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '14px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
          <input className={__css.h0} value={title} onChange={e => setTitle(e.target.value)} onBlur={saveTitle} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }} readOnly={!editable} maxLength={LIMITS.title} aria-label="Assessment title"
            style={{ flex: '1 1 260px', minWidth: '0', border: '1px solid transparent', borderRadius: '10px', padding: '6px 8px', font: '600 18px Inter,sans-serif', color: '#111827', background: 'transparent' }} />
          <span style={{ font: '600 11px Inter,sans-serif', borderRadius: '999px', padding: '4px 10px', background: vs[0], color: vs[1] }}>{STATUS_LABEL[v.status]} · v{v.versionNo}</span>
          <span style={{ fontSize: '12.5px', color: '#6b7280' }}>{qItems.length} question{qItems.length === 1 ? '' : 's'} · {sectionCount} section{sectionCount === 1 ? '' : 's'}</span>
          {editable ? <span role="status" style={{ fontSize: '12.5px', color: saveErr ? '#b91c1c' : unsaved.length ? '#92400e' : '#15803d' }}>{saveText}</span> : null}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginLeft: 'auto', alignItems: 'center' }}>
            {editable ? <button type="button" onClick={saveNow} style={{ height: '34px', padding: '0 14px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', background: '#fff', color: '#374151', font: '500 13px Inter,sans-serif', cursor: 'pointer' }}>Save draft</button> : <span style={{ fontSize: '12.5px', color: '#6b7280' }}>View only</span>}
            {workflow}
          </div>
        </div>
        {/* ===== FORMS · Locked notice ===== */}
        {lockedNote ? <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', background: '#fffbeb', borderBottom: '1px solid #fde68a', fontSize: '12.5px', color: '#92400e' }}><i className="icon-info" style={{ fontSize: '14px' }}></i>{lockedNote}</div> : null}
        {/* ===== FORMS · Tab bar ===== */}
        <div role="tablist" style={{ display: 'flex', gap: '4px', padding: '6px 10px', overflowX: 'auto' }}>
          {TABS.map(([k, label, icon]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '7px', height: '36px', padding: '0 14px', border: '0', borderRadius: '10px', cursor: 'pointer', whiteSpace: 'nowrap', font: '500 14px Inter,sans-serif', background: tab === k ? '#e6f2ea' : 'transparent', color: tab === k ? '#0d3b2a' : '#4b5563' }}>
              <i className={icon} style={{ fontSize: '15px' }}></i>{label}{k === 'build' && editable && data.issues.length ? <Pill bg="#fee2e2" fg="#b91c1c">{data.issues.length}</Pill> : null}</button>))}
        </div>
      </div>

      {tab === 'build' ? <BuildTab {...{ items, nums, sel, selIndex, selKey, setSelKey, editable, wide, over, setOver, drag, dropAt, dragEnd, make, remove, dup, change, updQ, compById, data }} /> : null}
      {tab === 'rubric' ? <RubricTab items={items} nums={nums} compById={compById} cfg={cfg} editable={editable} updQ={updQ} wide={wide} /> : null}
      {tab === 'preview' ? <PreviewTab {...{ items, nums, title, data, cfg, compById, ans, setAns, tried, setTried, submitMsg, setSubmitMsg, wide }} /> : null}
      {tab === 'versions' ? <VersionsTab data={data} onView={onViewVersion} /> : null}
      {tab === 'settings' ? settings : null}
    </>
  );
}

// ===== FORMS · Build tab =====
function BuildTab({ items, nums, sel, selIndex, selKey, setSelKey, editable, wide, over, setOver, drag, dropAt, dragEnd, make, remove, dup, change, updQ, compById, data }) {
  const general = editable ? data.issues.filter(x => !x.order) : [];
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-start' }}>
      {/* ===== FORMS · Question types palette (left) ===== */}
      <aside style={{ flex: '1 1 220px', maxWidth: wide ? '260px' : 'none', display: 'flex', flexDirection: 'column', gap: '14px', position: wide ? 'sticky' : 'static', top: '80px' }}>
        <div style={{ ...GLASS, padding: '14px' }}>
          <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.6px', color: '#6b7280', marginBottom: '10px' }}>QUESTION TYPES</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(112px,1fr))', gap: '8px' }}>
            {PALETTE.map(([k, [label, icon]]) => (
              <div key={k} className={editable ? __css.h1 : undefined} draggable={editable ? 'true' : 'false'} role="button" tabIndex={0}
                onDragStart={e => { drag.current = { kind: 'new', type: k }; try { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', k); } catch (er) {} }} onDragEnd={dragEnd}
                onClick={() => make(k, sel ? selIndex + 1 : null)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); make(k, sel ? selIndex + 1 : null); } }}
                title={editable ? 'Drag onto the canvas, or click to add' : 'View only'}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '6px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '12px', background: 'rgba(255,255,255,.4)', cursor: editable ? 'grab' : 'not-allowed', userSelect: 'none', opacity: editable ? 1 : 0.55 }}>
                <span style={{ width: '28px', height: '28px', borderRadius: '7px', background: '#fff', border: '1px solid #e5e7eb', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={icon} style={{ fontSize: '14px' }}></i></span>
                <span style={{ font: '600 12px Inter,sans-serif', color: '#111827' }}>{label}</span>
              </div>))}
          </div>
          <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '10px', lineHeight: 1.5 }}>Choice and true / false questions are scored automatically. Open text is marked by hand.</div>
        </div>
      </aside>

      {/* ===== FORMS · Canvas (questions in the middle) ===== */}
      <section style={{ flex: '3 1 440px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {general.length ? <div role="alert" style={{ fontSize: '12.5px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '12px', padding: '10px 12px' }}>{general.map(x => x.message).join(' ')}</div> : null}
        {items.map((it, i) => (
          <div key={it.key} draggable={editable ? 'true' : 'false'}
            onDragStart={e => { if (!editable) return; drag.current = { kind: 'move', from: i }; try { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', it.key); } catch (er) {} }}
            onDragOver={e => { if (!editable) return; e.preventDefault(); if (over !== i) setOver(i); }} onDrop={e => { e.preventDefault(); e.stopPropagation(); dropAt(i); }} onDragEnd={dragEnd}
            onClick={() => setSelKey(it.key)} style={{ borderTop: '3px solid ' + (over === i ? '#f2a516' : 'transparent'), borderRadius: '12px' }}>
            {it.kind === 'section' ? <SectionCard it={it} i={i} items={items} on={it.key === selKey} editable={editable} change={change} remove={remove} /> : <QuestionCard it={it} i={i} items={items} num={nums[it.key]} on={it.key === selKey} editable={editable} change={change} remove={remove} dup={dup} compById={compById} />}
          </div>))}
        {/* ===== FORMS · Drop zone at end of canvas ===== */}
        <div onDragOver={e => { if (!editable) return; e.preventDefault(); if (over !== items.length) setOver(items.length); }} onDrop={e => { e.preventDefault(); dropAt(items.length); }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', minHeight: '72px', border: '2px dashed ' + (over === items.length ? '#f2a516' : 'rgba(15,35,65,.14)'), borderRadius: '12px', background: over === items.length ? '#fffbeb' : 'transparent', font: '500 13px Inter,sans-serif', color: '#6b7280', textAlign: 'center', padding: '12px' }}>
          <i className="icon-mouse-pointer-click" style={{ fontSize: '16px' }}></i>{editable ? 'Drop a question type here, or click one in the panel' : items.length ? 'End of the form' : 'This version has no questions yet'}</div>
      </section>

      {/* ===== FORMS · Inspector (right) ===== */}
      <aside style={{ flex: '1 1 300px', maxWidth: wide ? '360px' : 'none', minWidth: '0', ...GLASS, position: wide ? 'sticky' : 'static', top: '80px', maxHeight: wide ? 'calc(100vh - 100px)' : 'none', overflowY: 'auto' }}>
        {!sel ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: '#6b7280', fontSize: '13.5px' }}>
            <i className="icon-mouse-pointer-2" style={{ fontSize: '24px', color: '#cbd2da' }}></i>
            <div style={{ marginTop: '8px' }}>Select a question to edit its settings</div>
          </div>) : <Inspector it={sel} i={selIndex} items={items} editable={editable} change={change} updQ={updQ} compById={compById} data={data} />}
      </aside>
    </div>
  );
}

// ===== FORMS · Section header card =====
function SectionCard({ it, i, items, on, editable, change, remove }) {
  const n = (() => { let c = 0; for (let j = i + 1; j < items.length && items[j].kind !== 'section'; j++) c++; return c; })();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 14px', borderRadius: '12px', background: '#0d3b2a', color: '#fff', cursor: 'pointer', outline: on ? '2px solid #f2a516' : 'none', outlineOffset: '2px' }}>
      <i className="icon-grip-vertical" style={{ fontSize: '16px', color: '#9cc4b0', cursor: editable ? 'grab' : 'default' }}></i>
      <div style={{ flex: '1', minWidth: '0' }}>
        <div style={{ font: '700 15px Inter,sans-serif' }}>{it.title || 'Untitled section'}</div>
        <div style={{ font: '400 12px Inter,sans-serif', color: '#b9d8c6', marginTop: '2px' }}>{n ? n + ' question' + (n === 1 ? '' : 's') + ' · skill area "' + (it.title || 'none') + '"' : 'Empty section: drop questions below it (saved once it has a question)'}</div>
      </div>
      {editable ? <>
        <button type="button" onClick={e => { e.stopPropagation(); change(a => step(a, i, -1), 150); }} title="Move up" style={ICON_BTN('#b9d8c6')}><i className="icon-arrow-up" style={{ fontSize: '14px' }}></i></button>
        <button type="button" onClick={e => { e.stopPropagation(); change(a => step(a, i, 1), 150); }} title="Move down" style={ICON_BTN('#b9d8c6')}><i className="icon-arrow-down" style={{ fontSize: '14px' }}></i></button>
        <button type="button" onClick={e => { e.stopPropagation(); remove(it.key); }} title="Delete section (its questions stay)" style={ICON_BTN('#fca5a5')}><i className="icon-trash-2" style={{ fontSize: '14px' }}></i></button>
      </> : null}
    </div>
  );
}

// ===== FORMS · Question card =====
function QuestionCard({ it, i, items, num, on, editable, change, remove, dup, compById }) {
  const q = it.q, [label, icon] = BUILDER_TYPES[q.type] || [q.type, 'icon-circle-help'];
  const problems = it.id && !isDirtyQ(it) ? [] : problemsOf(payloadOf(items, i), compById);
  const dirty = isDirtyQ(it);
  const right = q.options.filter(o => o.isCorrect).length;
  const summary = q.type === 'TEXT' ? 'Marked by hand · counts once marked' : q.options.length + ' options · ' + right + ' correct' + (q.type === 'MULTIPLE_CHOICE' ? ' · select all that apply' : '');
  return (
    <div className={__css.h3} style={{ display: 'flex', gap: '10px', padding: '14px', borderRadius: '12px', background: '#fff', border: '1.5px solid ' + (on ? '#0d3b2a' : '#e5e7eb'), outline: on ? '2px solid #f2a516' : 'none', cursor: 'pointer', boxShadow: '0 1px 2px rgba(16,24,40,.04)' }}>
      <i className="icon-grip-vertical" style={{ fontSize: '16px', color: '#9ca3af', cursor: editable ? 'grab' : 'default', marginTop: '2px' }}></i>
      <div style={{ flex: '1', minWidth: '0' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
          <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: '#6b7280' }}>Q{num}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', font: '600 11px Inter,sans-serif', color: '#0d3b2a', background: '#e6f2ea', borderRadius: '6px', padding: '3px 7px' }}><i className={icon} style={{ fontSize: '12px' }}></i>{label}</span>
          <Pill bg="#f3f4f6" fg="#374151">{q.points} point{Number(q.points) === 1 ? '' : 's'}</Pill>
          {q.competencies.map(c => <Pill key={c.competencyId} bg="#e0f2fe" fg="#0369a1" style={{ fontWeight: 500 }}>{(compById.get(Number(c.competencyId)) || {}).name || 'Competency'}</Pill>)}
          {dirty ? <Pill bg="#fef3c7" fg="#92400e"><i className="icon-cloud-off" style={{ fontSize: '11px' }}></i>{problems.length ? 'Not saved · ' + problems.length + ' to fix' : 'Saving…'}</Pill> : null}
        </div>
        <div style={{ font: '500 14.5px/1.45 Inter,sans-serif', color: '#111827', marginTop: '8px', textWrap: 'pretty' }}>{q.text || <i style={{ color: '#9ca3af' }}>No question text yet</i>}</div>
        {/* ===== FORMS · Answer preview on canvas (read-only) ===== */}
        <div style={{ marginTop: '10px', pointerEvents: 'none' }} aria-hidden="true">
          {isChoice(q.type) ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              {q.options.map((o, k) => <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '9px', border: '1.5px solid #e5e7eb', background: '#fff' }}>
                <span style={{ width: '16px', height: '16px', flex: 'none', borderRadius: q.type === 'MULTIPLE_CHOICE' ? '5px' : '50%', border: '2px solid #cbd2da' }}></span>
                <span style={{ font: '500 13px Inter,sans-serif', color: '#111827' }}>{o.text || <i style={{ color: '#9ca3af' }}>Empty option</i>}</span></div>)}
            </div>) : <div style={{ height: '64px', border: '1.5px solid rgba(15,35,65,.14)', borderRadius: '9px', padding: '8px 12px', font: '400 13px Inter,sans-serif', color: '#9ca3af' }}>Type your answer…</div>}
        </div>
        <div style={{ font: '400 11.5px Inter,sans-serif', color: '#9ca3af', marginTop: '8px' }}>{summary}</div>
        {dirty && problems.length && on ? <div style={{ fontSize: '12px', color: '#92400e', marginTop: '6px' }}>Still needed: {problems.join(' ')}</div> : null}
      </div>
      {/* ===== FORMS · Card buttons (move, duplicate, delete) ===== */}
      {editable ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <button type="button" onClick={e => { e.stopPropagation(); change(a => step(a, i, -1), 150); }} title="Move up" style={ICON_BTN('#9ca3af')}><i className="icon-arrow-up" style={{ fontSize: '14px' }}></i></button>
          <button type="button" onClick={e => { e.stopPropagation(); change(a => step(a, i, 1), 150); }} title="Move down" style={ICON_BTN('#9ca3af')}><i className="icon-arrow-down" style={{ fontSize: '14px' }}></i></button>
          <button type="button" onClick={e => { e.stopPropagation(); dup(i); }} title="Duplicate" style={ICON_BTN('#9ca3af')}><i className="icon-copy" style={{ fontSize: '14px' }}></i></button>
          <button type="button" onClick={e => { e.stopPropagation(); remove(it.key); }} title="Delete" style={ICON_BTN('#9ca3af')}><i className="icon-trash-2" style={{ fontSize: '14px' }}></i></button>
        </div>) : null}
    </div>
  );
}
const isDirtyQ = it => isDirty(it);

// ===== FORMS · Inspector =====
// Section: title. Question: text, points, competencies (required), options with the correct answer(s).
function Inspector({ it, i, items, editable, change, updQ, compById, data }) {
  const ro = !editable;
  if (it.kind === 'section') return (
    <>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(15,35,65,.07)', display: 'flex', alignItems: 'center', gap: '8px' }}><i className="icon-heading" style={{ fontSize: '15px', color: '#0d3b2a' }}></i><span style={{ fontSize: '14.5px', fontWeight: 600 }}>Section</span></div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <label style={LAB}>SECTION TITLE<input value={it.title} readOnly={ro} maxLength={LIMITS.skillArea} onChange={e => { const t = e.target.value; change(a => a.map(x => (x.key === it.key ? { ...x, title: t } : x))); }} placeholder="e.g. Front-desk service" style={INP} /></label>
        <div style={{ fontSize: '12px', color: '#4b5563', background: '#f5f6f8', borderRadius: '10px', padding: '10px', lineHeight: 1.5 }}>Sections group questions. Every question below this card, down to the next section, gets this title as its skill area, so renaming the section renames them too. Deleting the card keeps its questions.</div>
      </div>
    </>);
  const q = it.q, [label, icon] = BUILDER_TYPES[q.type] || [q.type, 'icon-circle-help'];
  const u = patch => updQ(it.key, patch);
  const problems = isDirty(it) ? problemsOf(payloadOf(items, i), compById) : [];
  const used = new Set(q.competencies.map(c => Number(c.competencyId)));
  const compOpts = id => data.competencies.filter(c => (c.active && !used.has(c.id)) || c.id === id).map(c => ({ value: String(c.id), label: c.name + ' (' + c.code + ')' + (c.active ? '' : ' · retired'), group: c.category + ' · ' + c.group }));
  const multi = q.type === 'MULTIPLE_CHOICE';
  const setOpt = (k, patch) => u({ options: q.options.map((o, j) => (j === k ? { ...o, ...patch } : patch.isCorrect && !multi ? { ...o, isCorrect: false } : o)) });
  const area = areaAt(items, i);
  return (
    <>
      <div style={{ padding: '14px 16px', borderBottom: '1px solid rgba(15,35,65,.07)', display: 'flex', alignItems: 'center', gap: '8px' }}><i className={icon} style={{ fontSize: '15px', color: '#0d3b2a' }}></i><span style={{ fontSize: '14.5px', fontWeight: 600 }}>{label}</span></div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* ===== FORMS · Inspector: text, points, section ===== */}
        <label style={LAB}>QUESTION<textarea value={q.text} readOnly={ro} maxLength={LIMITS.text} onChange={e => u({ text: e.target.value })} style={{ minHeight: '70px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', padding: '8px 10px', font: '400 13.5px/1.5 Inter,sans-serif', color: '#111827', resize: 'vertical' }}></textarea></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-end' }}>
          <label style={{ ...LAB, flex: '1 1 90px' }}>POINTS (WEIGHT)<input type="number" min="0.5" max={LIMITS.points} step="0.5" value={q.points} readOnly={ro} onChange={e => u({ points: e.target.value === '' ? '' : Number(e.target.value) })} style={INP} /></label>
          <div style={{ flex: '2 1 140px', fontSize: '12px', color: '#6b7280', paddingBottom: '8px' }}>Section: <b style={{ color: '#374151' }}>{area || 'none'}</b></div>
        </div>
        {/* ===== FORMS · Inspector: linked competencies ===== */}
        <div style={LAB}>LINKED COMPETENCIES
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {q.competencies.map((c, k) => (
              <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                <Select value={String(c.competencyId)} disabled={ro} onValueChange={x => u({ competencies: q.competencies.map((m, j) => (j === k ? { ...m, competencyId: Number(x) } : m)) })} options={compOpts(Number(c.competencyId))} style={{ ...INP, flex: '1' }} />
                <input type="number" min="0.1" step="0.1" max={LIMITS.weight} value={c.weight} readOnly={ro} title="Weight" aria-label="Competency weight" onChange={e => u({ competencies: q.competencies.map((m, j) => (j === k ? { ...m, weight: e.target.value === '' ? '' : Number(e.target.value) } : m)) })} style={{ ...INP, width: '60px', padding: '0 6px' }} />
                {editable ? <button type="button" onClick={() => u({ competencies: q.competencies.filter((_, j) => j !== k) })} title="Remove competency" style={ICON_BTN('#9ca3af')}><i className="icon-x" style={{ fontSize: '14px' }}></i></button> : null}
              </div>))}
          </div>
          {editable && q.competencies.length < LIMITS.competencies ? <button type="button" onClick={() => { const first = data.competencies.find(c => c.active && !used.has(c.id)); if (first) u({ competencies: [...q.competencies, { competencyId: first.id, weight: 1 }] }); }} style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '0', padding: '0', cursor: 'pointer', font: '600 12.5px Inter,sans-serif', letterSpacing: 0, color: '#127a42' }}><i className="icon-plus" style={{ fontSize: '13px' }}></i>{q.competencies.length ? 'Add another competency' : 'Link a competency'}</button> : null}
          <span style={{ font: '400 11.5px Inter,sans-serif', letterSpacing: 0, color: '#6b7280' }}>Every question needs at least one. Results are worked out per competency.</span>
        </div>
        {/* ===== FORMS · Inspector: choice options & correct answer ===== */}
        {isChoice(q.type) ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', marginBottom: '6px' }}><span>OPTIONS</span><span>CORRECT</span></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {q.options.map((o, k) => (
                <div key={k} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input value={o.text} readOnly={ro || q.type === 'TRUE_FALSE'} maxLength={LIMITS.option} onChange={e => setOpt(k, { text: e.target.value })} aria-label={'Option ' + String.fromCharCode(65 + k)} style={{ ...INP, flex: '1', height: '32px', borderRadius: '7px', padding: '0 8px' }} />
                  <button type="button" disabled={ro} onClick={() => setOpt(k, { isCorrect: multi ? !o.isCorrect : true })} aria-pressed={o.isCorrect} title={o.isCorrect ? 'Correct answer' : 'Mark as correct'}
                    style={{ flex: 'none', width: '60px', height: '32px', borderRadius: '7px', cursor: ro ? 'default' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', font: '600 11.5px Inter,sans-serif', border: o.isCorrect ? '1px solid #15904c' : '1px solid rgba(15,35,65,.14)', background: o.isCorrect ? '#dcfce7' : '#fff', color: o.isCorrect ? '#15803d' : '#9ca3af' }}>
                    <i className={o.isCorrect ? 'icon-circle-check' : multi ? 'icon-square' : 'icon-circle'} style={{ fontSize: '14px' }}></i>{o.isCorrect ? 'Yes' : ''}</button>
                  {editable && q.type !== 'TRUE_FALSE' ? <button type="button" onClick={() => (q.options.length > 2 ? u({ options: q.options.filter((_, j) => j !== k) }) : null)} disabled={q.options.length <= 2} title="Remove option" style={{ ...ICON_BTN('#9ca3af'), padding: '3px', opacity: q.options.length <= 2 ? 0.4 : 1 }}><i className="icon-x" style={{ fontSize: '14px' }}></i></button> : null}
                </div>))}
            </div>
            {editable && q.type !== 'TRUE_FALSE' && q.options.length < LIMITS.options ? <button type="button" onClick={() => u({ options: [...q.options, { text: 'Option ' + String.fromCharCode(65 + q.options.length), isCorrect: false }] })} style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '5px', background: 'none', border: '0', padding: '0', cursor: 'pointer', font: '600 12.5px Inter,sans-serif', color: '#127a42' }}><i className="icon-plus" style={{ fontSize: '13px' }}></i>Add option</button> : null}
            <div style={{ fontSize: '11.5px', color: '#6b7280', marginTop: '8px', lineHeight: '1.5' }}>{multi ? 'Mark every correct answer. Staff earn the points only when they pick exactly these.' : q.type === 'TRUE_FALSE' ? 'Mark which one is correct.' : 'Mark the one correct answer.'}</div>
          </div>) : (
          <div style={{ fontSize: '12px', color: '#4b5563', background: '#f5f6f8', borderRadius: '10px', padding: '10px', lineHeight: '1.5' }}>Written answers are marked by hand. They show as Pending until someone marks them and only count towards the score once marked (never as 0).</div>)}
        {problems.length ? <div role="alert" style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '10px', padding: '10px', lineHeight: 1.5 }}><b>Not saved yet.</b> Still needed: {problems.join(' ')}</div> : null}
      </div>
    </>
  );
}

// ===== FORMS · Rubric & Scoring tab =====
// The scoring is fixed for every assessment (lib/scoring.js + the active scoring version), so there is no pass mark or
// tier to set here: each question's points, its competency, and what each competency can earn.
function RubricTab({ items, nums, compById, cfg, editable, updQ, wide }) {
  const qs = items.filter(x => x.kind === 'question');
  const auto = qs.filter(x => x.q.type !== 'TEXT'), manual = qs.filter(x => x.q.type === 'TEXT');
  const per = new Map();
  qs.forEach(x => x.q.competencies.forEach(c => { const id = Number(c.competencyId), p = per.get(id) || { id, n: 0, pts: 0, manual: 0 }; p.n++; p.pts += Number(x.q.points) || 0; if (x.q.type === 'TEXT') p.manual++; per.set(id, p); }));
  const rows = [...per.values()].map(p => ({ ...p, name: (compById.get(p.id) || {}).name || 'Unknown competency' })).sort((a, b) => a.name.localeCompare(b.name));
  const total = qs.reduce((s, x) => s + (Number(x.q.points) || 0), 0);
  const tile = (v, l) => <div style={{ background: '#f5f6f8', borderRadius: '12px', padding: '10px' }}><div style={{ fontSize: '18px', fontWeight: 700 }}>{v}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{l}</div></div>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 340px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* ===== FORMS · Scoring model card ===== */}
        <GlassCard title="Scoring model" sub={'The same for every assessment (scoring version ' + (cfg.version || 1) + ', Settings > Scoring & Attempts)'}>
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ fontSize: '13px', color: '#374151', lineHeight: 1.6 }}>Each competency is scored from 0 to 5: <b>5 × points earned ÷ points available</b> on that competency's questions. The final result is the average of every completed attempt: <b>Competent from {formatAverage(cfg.competentFrom)}</b>, <b>Proficient at {formatAverage(cfg.proficientFrom)}</b>. Open-text answers count only once they are marked.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px' }}>{tile(+total.toFixed(1), 'Points available')}{tile(auto.length, 'Scored automatically')}{tile(manual.length, 'Marked by hand')}</div>
          </div>
        </GlassCard>
        {/* ===== FORMS · Points per competency card ===== */}
        <GlassCard title="Points per competency" sub="What each competency's score is worked out from">
          {!rows.length ? <EmptyState icon="icon-scale" title="No competencies linked yet" text="Link each question to a competency in the Build tab." /> : rows.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid rgba(15,35,65,.07)', fontSize: '13px' }}>
              <span style={{ flex: '1', minWidth: 0 }}>{r.name}</span><span style={{ color: '#6b7280' }}>{r.n} question{r.n === 1 ? '' : 's'}{r.manual ? ' (' + r.manual + ' by hand)' : ''}</span><span style={{ font: "600 12.5px 'JetBrains Mono',monospace" }}>{+r.pts.toFixed(1)} pts</span>
            </div>))}
        </GlassCard>
      </div>
      {/* ===== FORMS · Scoring matrix table ===== */}
      <div style={{ flex: '2 1 520px', minWidth: '0', ...GLASS }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
          <div style={{ fontSize: '16.5px', fontWeight: 600 }}>Scoring matrix</div>
          <div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '4px' }}>{editable ? 'Points can be changed here or in the question settings' : 'Read only'}</div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div style={{ minWidth: '640px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 120px 100px 80px minmax(0,160px)', gap: '12px', padding: '10px 18px', font: '600 10px Inter,sans-serif', letterSpacing: '.5px', color: '#6b7280', borderBottom: '1px solid rgba(15,35,65,.07)' }}><span>#</span><span>QUESTION</span><span>TYPE</span><span>METHOD</span><span>POINTS</span><span>COMPETENCY</span></div>
            {qs.map(x => { const m = x.q.type === 'TEXT' ? ['Manual', '#fef3c7', '#92400e'] : ['Auto', '#dcfce7', '#15803d']; return (
              <div key={x.key} style={{ display: 'grid', gridTemplateColumns: '44px minmax(0,1fr) 120px 100px 80px minmax(0,160px)', gap: '12px', alignItems: 'center', padding: '10px 18px', borderBottom: '1px solid rgba(15,35,65,.07)', fontSize: '13px' }}>
                <span style={{ font: "600 12px 'JetBrains Mono',monospace", color: '#6b7280' }}>Q{nums[x.key]}</span>
                <span style={{ minWidth: '0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={x.q.text}>{x.q.text}</span>
                <span style={{ color: '#374151' }}>{BUILDER_TYPES[x.q.type][0]}</span>
                <span style={{ justifySelf: 'start', font: '600 10.5px Inter,sans-serif', borderRadius: '999px', padding: '2px 8px', background: m[1], color: m[2] }}>{m[0]}</span>
                <input type="number" min="0.5" max={LIMITS.points} step="0.5" value={x.q.points} readOnly={!editable} onChange={e => updQ(x.key, { points: e.target.value === '' ? '' : Number(e.target.value) })} aria-label={'Points for question ' + nums[x.key]} style={{ width: '62px', height: '30px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '6px', padding: '0 6px', font: '400 12.5px Inter,sans-serif' }} />
                <span style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#0369a1' }}>{x.q.competencies.map(c => (compById.get(Number(c.competencyId)) || {}).name).filter(Boolean).join(', ') || <span style={{ color: '#b91c1c' }}>None yet</span>}</span>
              </div>); })}
            {!qs.length ? <div style={{ padding: '20px 18px', fontSize: '13px', color: '#6b7280' }}>No questions yet.</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// ===== FORMS · Preview tab =====
// What staff will see. Answers stay on this screen: nothing is saved, scored for real or counted as an attempt.
function PreviewTab({ items, nums, title, data, cfg, compById, ans, setAns, tried, setTried, submitMsg, setSubmitMsg, wide }) {
  const qs = items.filter(x => x.kind === 'question');
  const set = (k, val) => { setAns(a => ({ ...a, [k]: val })); setSubmitMsg(null); };
  // Choice answers change from the latest state, so quick clicks never undo each other.
  const toggle = (k, i, many) => { setAns(a => { const v = a[k] || []; return { ...a, [k]: many ? (v.includes(i) ? v.filter(x => x !== i) : [...v, i]) : [i] }; }); setSubmitMsg(null); };
  const answered = x => (x.q.type === 'TEXT' ? !!String(ans[x.key] || '').trim() : (ans[x.key] || []).length > 0);
  // Marks the way the server does (lib/server/results.js markResponse): multiple select must match exactly.
  const mark = x => { const pick = ans[x.key] || []; if (!pick.length) return undefined; const right = x.q.options.map((o, k) => (o.isCorrect ? k : -1)).filter(k => k >= 0);
    return x.q.type === 'MULTIPLE_CHOICE' ? pick.length === right.length && pick.every(k => right.includes(k)) : pick.length === 1 && right.includes(pick[0]); };
  const scored = qs.filter(x => x.q.type !== 'TEXT');
  const res = scoreAttempt(scored.map(x => ({ id: x.key, points: Number(x.q.points) || 0, competencies: x.q.competencies.map(c => Number(c.competencyId)) })), Object.fromEntries(scored.map(x => [x.key, mark(x)])));
  const scores = Object.entries(res).map(([cid, r]) => ({ cid: Number(cid), ...r, name: (compById.get(Number(cid)) || {}).name || 'Competency' })).sort((a, b) => a.name.localeCompare(b.name));
  const pending = qs.filter(x => x.q.type === 'TEXT').length;
  const missing = qs.filter(x => !answered(x)).length;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'flex-start' }}>
      <div style={{ flex: '3 1 520px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* ===== FORMS · Preview banner ===== */}
        <div style={{ background: '#0d3b2a', color: '#fff', borderRadius: '12px', padding: '18px 20px' }}>
          <div style={{ font: '700 10px Inter,sans-serif', letterSpacing: '.6px', color: '#b9d8c6' }}>PREVIEW · WHAT STAFF WILL SEE</div>
          <div style={{ fontSize: '19px', fontWeight: 700, marginTop: '6px' }}>{title}</div>
          {data.settings.instructions ? <div style={{ fontSize: '13px', color: '#d7eadf', marginTop: '6px', whiteSpace: 'pre-wrap' }}>{data.settings.instructions}</div> : null}
        </div>
        {/* ===== FORMS · Preview questions ===== */}
        {items.map(it => it.kind === 'section' ? (
          <div key={it.key} style={{ padding: '8px 4px 0' }}><div style={{ fontSize: '16px', fontWeight: 700, color: '#0d3b2a' }}>{it.title || 'Untitled section'}</div></div>
        ) : (() => { const q = it.q, err = tried && !answered(it) ? 'This question is not answered yet (it would earn 0 points).' : '';
          return (
            <div key={it.key} style={{ background: '#fff', border: '1.5px solid ' + (err ? '#fca5a5' : '#e5e7eb'), borderRadius: '12px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline' }}><span style={{ font: "600 12px 'JetBrains Mono',monospace", color: '#6b7280' }}>{nums[it.key]}.</span><span style={{ font: '500 15px/1.45 Inter,sans-serif', color: '#111827' }}>{q.text}</span></div>
              {q.type === 'MULTIPLE_CHOICE' ? <div style={{ fontSize: '12.5px', color: '#6b7280', margin: '4px 0 0 22px' }}>Choose all that apply</div> : null}
              <div style={{ marginTop: '12px' }}>
                {isChoice(q.type) ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {q.options.map((o, k) => { const on = (ans[it.key] || []).includes(k); return (
                      <button key={k} type="button" onClick={() => toggle(it.key, k, q.type === 'MULTIPLE_CHOICE')} aria-pressed={on}
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '9px', cursor: 'pointer', textAlign: 'left', background: on ? '#eef7f1' : '#fff', border: '1.5px solid ' + (on ? '#0d3b2a' : '#e5e7eb') }}>
                        <span style={{ width: '18px', height: '18px', flex: 'none', borderRadius: q.type === 'MULTIPLE_CHOICE' ? '5px' : '50%', border: '2px solid ' + (on ? '#0d3b2a' : '#cbd2da'), background: on ? '#0d3b2a' : '#fff' }}></span>
                        <span style={{ font: '500 13.5px Inter,sans-serif', color: '#111827' }}>{o.text}</span>
                      </button>); })}
                  </div>) : (<>
                  <textarea value={ans[it.key] || ''} onChange={e => set(it.key, e.target.value)} placeholder="Type your answer…" aria-label={'Answer to question ' + nums[it.key]} style={{ width: '100%', minHeight: '110px', border: '1.5px solid rgba(15,35,65,.14)', borderRadius: '9px', padding: '10px 12px', font: '400 14px/1.55 Inter,sans-serif', resize: 'vertical', boxSizing: 'border-box' }}></textarea>
                  <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>Marked by hand</div></>)}
              </div>
              {err ? <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '12.5px', color: '#b91c1c' }}><i className="icon-circle-alert" style={{ fontSize: '13px' }}></i>{err}</div> : null}
            </div>); })())}
        {!qs.length ? <div style={GLASS}><EmptyState icon="icon-eye" title="Nothing to preview yet" text="Add questions in the Build tab." /></div> : null}
        {/* ===== FORMS · Preview buttons (Reset / Submit) ===== */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" onClick={() => { setAns({}); setTried(false); setSubmitMsg(null); }} style={{ height: '38px', padding: '0 16px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '999px', background: '#fff', color: '#374151', font: '500 13.5px Inter,sans-serif', cursor: 'pointer' }}>Reset</button>
          <button type="button" onClick={() => { setTried(true); setSubmitMsg(missing ? { ok: false, text: missing + ' question' + (missing === 1 ? ' is' : 's are') + ' still unanswered.' } : { ok: true, text: 'Test response is complete. See the live score for each competency.' }); }} style={{ height: '38px', padding: '0 18px', border: '0', borderRadius: '999px', background: 'linear-gradient(180deg,#2fb36b,#15904c)', boxShadow: '0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)', color: '#fff', font: '600 13.5px Inter,sans-serif', cursor: 'pointer' }}>Submit test response</button>
        </div>
      </div>
      {/* ===== FORMS · Live score panel (per competency, 0 to 5) ===== */}
      <aside style={{ flex: '1 1 280px', maxWidth: wide ? '360px' : 'none', minWidth: '0', ...GLASS, position: wide ? 'sticky' : 'static', top: '80px' }}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(15,35,65,.07)', fontSize: '15px', fontWeight: 600 }}>Live score</div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ fontSize: '13px', color: '#6b7280' }}>{qs.length - missing} of {qs.length} answered · score per competency, 0 to 5</div>
          {!scores.length ? <div style={{ fontSize: '12.5px', color: '#6b7280' }}>Scores appear once questions are linked to competencies.</div> : scores.map(s => { const st = competencyStatus(s.score, cfg), gp = gapStatus(s.score, cfg); return (
            <div key={s.cid}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '12.5px', color: '#374151' }}><span style={{ minWidth: 0 }}>{s.name}</span><span style={{ font: "700 13px 'JetBrains Mono',monospace" }}>{formatAverage(s.score)}</span></div>
              <div style={{ height: '6px', borderRadius: '999px', background: '#eef0f3', marginTop: '5px', overflow: 'hidden' }}><div style={{ height: '100%', background: '#0d3b2a', width: Math.max(0, Math.min(100, (s.score || 0) / 5 * 100)) + '%' }}></div></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}><CompetencyBadge status={st} /><GapStatusBadge gap={gp} /><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{+s.earned.toFixed(1)} / {+s.available.toFixed(1)} pts</span></div>
            </div>); })}
          {pending ? <div style={{ fontSize: '12px', color: '#92400e', background: '#fffbeb', borderRadius: '10px', padding: '8px 10px' }}>{pending} open-text answer{pending === 1 ? '' : 's'} will be marked by hand; the score above leaves {pending === 1 ? 'it' : 'them'} out.</div> : null}
          {submitMsg ? <div style={{ fontSize: '12.5px', borderRadius: '10px', padding: '10px', background: submitMsg.ok ? '#dcfce7' : '#fef2f2', color: submitMsg.ok ? '#15803d' : '#991b1b' }}>{submitMsg.text}</div> : null}
        </div>
      </aside>
    </div>
  );
}

// ===== FORMS · Versions tab =====
// Every version with its status (published versions are locked; changes go into a new version through review),
// then the review history with the reviewers' feedback.
function VersionsTab({ data, onView }) {
  const icons = { CREATE: 'icon-file-plus', SUBMIT: 'icon-send', APPROVE: 'icon-check', REJECT: 'icon-x', RETURN: 'icon-undo-2', PUBLISH: 'icon-rocket', ARCHIVE: 'icon-archive', SUPERSEDE: 'icon-history' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={GLASS}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
          <div style={{ fontSize: '16.5px', fontWeight: 600 }}>Version history</div>
          <div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '4px' }}>Published versions are locked. Use New version to change them; attempts keep pointing at the version they used.</div>
        </div>
        {/* ===== FORMS · Version row ===== */}
        {data.versions.map(r => { const c = STATUS_COLOURS[r.status] || ['#f3f4f6', '#374151']; return (
          <div key={r.id} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', padding: '14px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
            <span style={{ font: "700 13px 'JetBrains Mono',monospace", width: '40px' }}>v{r.versionNo}</span>
            <span style={{ font: '600 11px Inter,sans-serif', borderRadius: '999px', padding: '3px 9px', background: c[0], color: c[1] }}>{STATUS_LABEL[r.status]}</span>
            <div style={{ flex: '1 1 200px', minWidth: '0' }}>
              <div style={{ fontSize: '13.5px', color: '#111827' }}>{r.questions} question{r.questions === 1 ? '' : 's'} · by {r.author}{r.attempts ? ' · ' + r.attempts + ' attempt' + (r.attempts === 1 ? '' : 's') : ''}</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>Created {fmtDate(r.createdAt)}{r.approvedAt ? ' · approved ' + fmtDate(r.approvedAt) + (r.approvedBy ? ' by ' + r.approvedBy : '') : ''}{r.publishedAt ? ' · published ' + fmtDate(r.publishedAt) + (r.publishedBy ? ' by ' + r.publishedBy : '') : ''}</div>
            </div>
            {r.visible ? <button type="button" onClick={() => onView(r.versionNo)} style={{ height: '32px', padding: '0 12px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', background: '#fff', color: '#0d3b2a', font: '500 12.5px Inter,sans-serif', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}><i className="icon-eye" style={{ fontSize: '13px' }}></i>{r.id === data.version.id ? 'Viewing' : 'View'}</button> : <span style={{ fontSize: '12px', color: '#6b7280' }}>Not shared yet</span>}
          </div>); })}
      </div>
      <div style={GLASS}>
        <div style={{ padding: '16px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}><div style={{ fontSize: '16.5px', fontWeight: 600 }}>Review history</div><div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '4px' }}>Who did what, when, with the reviewer's feedback</div></div>
        {!data.history.length ? <EmptyState icon="icon-history" title="No history yet" /> : data.history.map(h => (
          <div key={h.id} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', padding: '12px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
            <span style={{ flex: 'none', width: '28px', height: '28px', borderRadius: '50%', background: '#e6f2ea', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={icons[h.action] || 'icon-dot'} style={{ fontSize: '13px' }}></i></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13.5px' }}><b>{h.label}</b> · version {h.versionNo} · {h.actor}</div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>{fmtDateTime(h.at)}</div>
              {h.feedback ? <div style={{ marginTop: '4px', fontSize: '13px', color: '#374151', background: '#f9fafb', borderRadius: '10px', padding: '8px 10px', whiteSpace: 'pre-wrap' }}>{h.feedback}</div> : null}
            </div>
          </div>))}
      </div>
    </div>
  );
}
