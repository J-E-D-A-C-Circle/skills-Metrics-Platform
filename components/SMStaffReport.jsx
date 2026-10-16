'use client';
// =============================================================================
// SMStaffReport.jsx · one staff member's individual report and its export
// Screen / URL: /report?id=<staff id> (opened from dashboards, heatmap, Training Needs, Staff Evaluations)
// Who sees it: admin (anyone); manager (own department only)
// Used by: SkillMatrixApp.jsx (report page); SMAnalytics.jsx (Report Builder preview); SMStaffEvals.jsx (staff details popup)   Depends on: ./smUI, ./smModel (individualReport, CYCLES), react-dom createPortal, xlsx
// Sections (search for these markers): REPORT · Export helpers (XML escape), REPORT · Export one person's record, REPORT · Individual report view, REPORT · Details card, REPORT · Competencies table, REPORT · History + recommended training row, REPORT · History across cycles chart, REPORT · Recommended training list, REPORT · History by competency table (full page only), REPORT · Staff details popup, REPORT · Popup staff list (floating panel, left), REPORT · Popup header with export + close, REPORT · Popup body, REPORT · Page (/report?id=), REPORT · Not found / not allowed card, REPORT · Render, REPORT · Page header with CSV / JSON / Excel export buttons, REPORT · Report body
// =============================================================================
import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Page, PageHeader, Card, Btn, Search, Badge, GapBadge, StatusBadge, ScopeBadge, EmptyState, DataTable, download, toCSV, slugify } from './smUI';
import { CYCLES, CURRENT, individualReport } from './smModel';

// ===== REPORT · Export helpers (XML escape) =====
const xe = v => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const tg = h => h.replace(/[^a-z0-9]/gi, '') || 'field';

// ===== REPORT · Export one person's record =====
// Exports one person's record. Each format carries the same sections that are on screen.
export function reportExport(rep, fmt, name) {
  const det = Object.fromEntries(rep.details);
  const compH = Object.keys(rep.comps[0] || {}), histH = ['Competency', ...CYCLES];
  const trH = ['Competency', 'Gap', 'Importance', 'Priority', 'Training', 'Provider', 'Days', 'Mode'];
  const trRows = rep.trainings.map(t => ({ Competency: t.comp, Gap: t.gap, Importance: t.importance, Priority: t.priority, Training: t.name, Provider: t.provider, Days: t.days || 'Ongoing', Mode: t.mode }));
  if (fmt === 'CSV') {
    const parts = ['Individual record', toCSV(['Field', 'Value'], rep.details.map(([k, v]) => ({ Field: k, Value: v }))), '', 'Competencies', toCSV(compH, rep.comps), '', 'History across cycles', toCSV(histH, rep.history), '', 'Recommended training', toCSV(trH, trRows)];
    download(name + '.csv', parts.join('\n'), 'text/csv');
  } else if (fmt === 'JSON') {
    download(name + '.json', JSON.stringify({ details: det, competencies: rep.comps, history: rep.history, recommendedTraining: trRows }, null, 2), 'application/json');
  } else if (fmt === 'XML') {
    const sec = (n, rows, H) => '  <' + n + '>\n' + rows.map(r => '    <row>' + H.map(h => '<' + tg(h) + '>' + xe(r[h]) + '</' + tg(h) + '>').join('') + '</row>').join('\n') + '\n  </' + n + '>';
    download(name + '.xml', '<?xml version="1.0" encoding="UTF-8"?>\n<individualRecord>\n  <details>' + rep.details.map(([k, v]) => '<' + tg(k) + '>' + xe(v) + '</' + tg(k) + '>').join('') + '</details>\n' + sec('competencies', rep.comps, compH) + '\n' + sec('history', rep.history, histH) + '\n' + sec('recommendedTraining', trRows, trH) + '\n</individualRecord>', 'application/xml');
  } else if (fmt === 'Excel') {
    import('xlsx').then(X => { const wb = X.utils.book_new();
      X.utils.book_append_sheet(wb, X.utils.aoa_to_sheet([['Field', 'Value'], ...rep.details]), 'Details');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rep.comps, { header: compH }), 'Competencies');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(rep.history, { header: histH }), 'History');
      X.utils.book_append_sheet(wb, X.utils.json_to_sheet(trRows, { header: trH }), 'Training');
      X.writeFile(wb, name + '.xlsx'); });
  }
}

// ===== REPORT · Individual report view =====
// Also used by the Report Builder preview (SMAnalytics.jsx); `compact` hides the History by competency table.
export function IndividualReportView({ D, rep, compact }) {
  const s = rep.s;
  // Chart scale: level 1-5 on the vertical axis, one point per cycle.
  const max = 5, W = 320, H = 120, X = i => 30 + i * ((W - 50) / (CYCLES.length - 1)), Y = v => H - 18 - (v - 1) / (max - 1) * (H - 34);
  const pts = rep.historyAvg.filter(h => h.value != null);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* ===== REPORT · Details card ===== */}
      <Card title={s.name} sub={s.designation + ' · ' + s.dept + ' · Staff ID ' + s.staffNo} actions={<><StatusBadge status={s.status} /><ScopeBadge override={s.override} /></>}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: '12px 20px' }}>
          {rep.details.filter(([k]) => !['Name', 'Department', 'Designation', 'Staff ID'].includes(k)).map(([k, v]) => (
            <div key={k} style={{ minWidth: '0' }}><div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{k}</div><div style={{ fontSize: '13.5px', marginTop: '3px', overflowWrap: 'anywhere' }}>{v}</div></div>))}
        </div>
      </Card>
      {/* ===== REPORT · Competencies table ===== */}
      <Card title="Competencies" sub={'Target from ' + s.profileLabel + ' · gap = max(0, target − actual)'} flush>
        <DataTable minWidth={760} rows={s.comps} columns={[
          { key: 'name', label: 'Competency', render: c => <div><div style={{ fontWeight: 500 }}>{c.name}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{c.category}{c.category === 'Technical' ? ' · ' + c.group : ''}</div></div> },
          { key: 'importance', label: 'Importance', align: 'center', render: c => <Badge bg={D.IMP[c.importance].bg} fg={D.IMP[c.importance].fg}>{c.importance} · {D.IMP[c.importance].short}</Badge> },
          { key: 'target', label: 'Target', align: 'center', render: c => <b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{c.target}</b> },
          { key: 'system', label: 'System', align: 'center', render: c => c.system == null ? <span style={{ color: '#9ca3af' }}>—</span> : c.system },
          { key: 'actual', label: 'Actual', align: 'center', render: c => <span title={c.adjusted ? 'Adjusted: ' + c.adjusted.reason : 'Source: ' + c.source}><b style={{ fontFamily: "'JetBrains Mono',monospace" }}>{c.actual}</b>{c.adjusted ? <i className="icon-pencil" style={{ fontSize: '11px', color: '#b45309', marginLeft: '4px' }}></i> : null}{c.source !== CURRENT ? <span style={{ fontSize: '10.5px', color: '#9ca3af', marginLeft: '4px' }}>{c.source}</span> : null}</span> },
          { key: 'gap', label: 'Gap', render: c => <GapBadge gap={c.gap} GAP={D.GAP} /> },
          { key: 'training', label: 'Recommended training', render: c => c.training ? <span style={{ fontSize: '12.5px' }}>{c.training.name}</span> : <span style={{ color: '#9ca3af' }}>—</span> },
        ]} />
      </Card>
      {/* ===== REPORT · History + recommended training row ===== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        {/* ===== REPORT · History across cycles chart ===== */}
        <Card title="History across cycles" sub="Average actual level" style={{ flex: '1 1 300px' }}>
          <svg viewBox={'0 0 ' + W + ' ' + H} width="100%" style={{ display: 'block' }}>
            {[1, 2, 3, 4, 5].map(v => <g key={v}><line x1="22" x2={W - 10} y1={Y(v)} y2={Y(v)} stroke="#eef0f3" /><text x="14" y={Y(v)} textAnchor="end" dominantBaseline="middle" style={{ font: '500 9px Inter,sans-serif', fill: '#9ca3af' }}>{v}</text></g>)}
            <polyline points={pts.map(h => X(CYCLES.indexOf(h.cycle)) + ',' + Y(h.value)).join(' ')} fill="none" stroke="#0d3b2a" strokeWidth="2.5" />
            {rep.historyAvg.map((h, i) => <g key={h.cycle}>{h.value != null ? <><circle cx={X(i)} cy={Y(h.value)} r="4" fill="#fff" stroke="#0d3b2a" strokeWidth="2" /><text x={X(i)} y={Y(h.value) - 9} textAnchor="middle" style={{ font: '600 10px Inter,sans-serif', fill: '#111827' }}>{h.value}</text></> : null}<text x={X(i)} y={H - 3} textAnchor="middle" style={{ font: '500 9.5px Inter,sans-serif', fill: '#6b7280' }}>{h.cycle}</text></g>)}
          </svg>
        </Card>
        {/* ===== REPORT · Recommended training list ===== */}
        <Card title="Recommended training" sub="Ordered by gap × importance" style={{ flex: '2 1 380px' }} flush>
          {rep.trainings.length ? rep.trainings.map((t, i) => (
            <div key={i} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '11px 20px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
              <span style={{ font: "700 11px 'JetBrains Mono',monospace", color: '#6b7280', width: '22px' }}>{i + 1}</span>
              <div style={{ flex: '1 1 220px', minWidth: '0' }}><div style={{ fontSize: '13.5px', fontWeight: '500' }}>{t.name}</div><div style={{ fontSize: '12px', color: '#6b7280' }}>{t.comp} · {t.provider} · {t.days ? t.days + ' day' + (t.days > 1 ? 's' : '') : 'Ongoing'} · {t.mode}</div></div>
              <GapBadge gap={t.gap} GAP={D.GAP} />
            </div>)) : <EmptyState icon="icon-party-popper" title="No training needed" text="Every competency meets its target." />}
        </Card>
      </div>
      {/* ===== REPORT · History by competency table (full page only) ===== */}
      {!compact ? <Card title="History by competency" flush>
        <DataTable minWidth={620} rows={rep.history} columns={[{ key: 'Competency', label: 'Competency' }, ...CYCLES.map(q => ({ key: q, label: q, align: 'center' }))]} />
      </Card> : null}
    </div>
  );
}

// ===== REPORT · Staff details popup =====
// Same report as /report?id=, shown in a pop-up over the current screen so the user stays where they were.
// Close with the X, the Escape key or a click on the dimmed background. Used by SMStaffEvals.jsx.
// `list` (optional) = staff to show down the left side; clicking one, or the Up / Down arrow keys, calls onSelect(id) to switch.
export function StaffReportModal({ D, model, id, role, myDept, deptLocked, onClose, list, onSelect }) {
  const rep = id ? individualReport(D, model, id) : null;
  // Same guard as the page: users limited to their own department only see staff in it.
  const blocked = rep && (deptLocked ?? role === 'manager') && rep.s.dept !== myDept;
  // Escape closes the popup; the page behind it stops scrolling while it is open.
  const [find, setFind] = useState('');
  const bodyRef = useRef(null), listRef = useRef(null);
  const ft = find.trim().toLowerCase();
  const shown = (list || []).filter(x => !ft || (x.name + ' ' + x.staffNo + ' ' + x.designation).toLowerCase().includes(ft));
  // On switching person: jump the report back to the top and keep the selected name visible in the list.
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    const el = listRef.current && listRef.current.querySelector('[aria-current="true"]');
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [id]);
  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose();
      // Up / Down arrows move to the previous / next person in the list (not while typing in the list search).
      if (onSelect && shown.length && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && e.target.tagName !== 'INPUT') {
        e.preventDefault();
        const i = shown.findIndex(x => x.id === id), n = e.key === 'ArrowDown' ? Math.min(shown.length - 1, i + 1) : Math.max(0, i - 1);
        if (shown[n] && shown[n].id !== id) onSelect(shown[n].id);
      }
    };
    const prev = document.body.style.overflow;
    document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose, onSelect, shown, id]);
  const name = rep ? 'individual-record-' + slugify(rep.s.name) + '-' + new Date().toISOString().slice(0, 10) : '';
  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: '0', zIndex: '80', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px', background: 'rgba(255,255,255,.45)', backdropFilter: 'blur(10px) saturate(160%)', WebkitBackdropFilter: 'blur(10px) saturate(160%)' }}>
      {/* Popup size: at least 40px clear space all round, up to 1720px wide; the staff list and the report sit side by side with a gap. */}
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(1720px,100%)', height: 'calc(100vh - 80px)', display: 'flex', gap: '16px' }}>
      {/* ===== REPORT · Popup staff list (floating panel, left) ===== */}
      {/* Its own floating card beside the report (not joined to it). Only shown when a list is passed in. Selected person uses the sidebar's active green. */}
      {list ? <aside style={{ width: 'clamp(210px,22vw,290px)', flex: 'none', display: 'flex', flexDirection: 'column', borderRadius: '24px', background: 'linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.82))', backdropFilter: 'blur(36px) saturate(190%)', WebkitBackdropFilter: 'blur(36px) saturate(190%)', border: '1px solid rgba(255,255,255,.95)', boxShadow: 'inset 0 1px 0 #fff,0 0 0 1px rgba(15,35,65,.05),0 24px 60px rgba(15,35,65,.14)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 14px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>Staff · {shown.length}{ft ? ' of ' + list.length : ''}</div>
            <Search value={find} onChange={setFind} placeholder="Find staff" style={{ flex: 'none' }} />
          </div>
          <div ref={listRef} style={{ flex: '1', overflowY: 'auto', padding: '0 8px 12px' }}>
            {shown.length ? shown.map(x => { const on = x.id === id; return (
              <button key={x.id} type="button" aria-current={on ? 'true' : undefined} onClick={() => onSelect(x.id)} style={{ width: '100%', display: 'block', textAlign: 'left', border: '0', cursor: 'pointer', borderRadius: '12px', padding: '9px 10px', marginBottom: '2px', background: on ? 'linear-gradient(180deg,#2fb36b,#15904c)' : 'transparent', boxShadow: on ? '0 8px 18px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)' : 'none' }}>
                <div style={{ font: '600 13px Inter,sans-serif', color: on ? '#fff' : '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.name}</div>
                <div style={{ fontSize: '11.5px', color: on ? 'rgba(255,255,255,.85)' : '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.designation} · {x.status}</div>
              </button>); }) : <div style={{ fontSize: '12.5px', color: '#6b7280', padding: '8px 10px' }}>No staff match.</div>}
          </div>
      </aside> : null}
      <div role="dialog" aria-modal="true" aria-labelledby="staff-report-title" style={{ flex: '1', minWidth: '0', height: '100%', display: 'flex', flexDirection: 'column', borderRadius: '28px', background: 'linear-gradient(180deg,rgba(255,255,255,.92),rgba(255,255,255,.82))', backdropFilter: 'blur(36px) saturate(190%)', WebkitBackdropFilter: 'blur(36px) saturate(190%)', border: '1px solid rgba(255,255,255,.95)', boxShadow: 'inset 0 1px 0 #fff,0 0 0 1px rgba(15,35,65,.05),0 24px 60px rgba(15,35,65,.14)', overflow: 'hidden' }}>
        {/* ===== REPORT · Popup header with export + close ===== */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '18px 20px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
          <div style={{ flex: '1 1 240px', minWidth: '0' }}>
            <div id="staff-report-title" style={{ fontSize: '17px', fontWeight: '700' }}>{rep && !blocked ? rep.s.name : 'Individual report'}</div>
            <div style={{ fontSize: '12.5px', color: '#4b5563', marginTop: '2px' }}>{rep && !blocked ? 'Individual report · ' + rep.s.designation + ', ' + rep.s.dept : "One staff member's targets, results, history and recommended training"}</div>
          </div>
          {rep && !blocked ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}><Btn icon="icon-download" onClick={() => reportExport(rep, 'CSV', name)}>CSV</Btn><Btn icon="icon-file-json" onClick={() => reportExport(rep, 'JSON', name)}>JSON</Btn><Btn kind="primary" icon="icon-file-spreadsheet" onClick={() => reportExport(rep, 'Excel', name)}>Export Excel</Btn></div> : null}
          <button onClick={onClose} aria-label="Close" type="button" style={{ width: '32px', height: '32px', borderRadius: '999px', border: '1px solid rgba(15,35,65,.08)', background: '#fff', cursor: 'pointer', color: '#4b5563', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className="icon-x" style={{ fontSize: '15px' }}></i></button>
        </div>
        {/* ===== REPORT · Popup body ===== */}
        <div ref={bodyRef} style={{ flex: '1', minWidth: '0', overflowY: 'auto', padding: '24px 28px' }}>
          {rep && !blocked ? <IndividualReportView D={D} rep={rep} />
            : <Card><EmptyState icon="icon-user-x" title={blocked ? 'Not in your department' : 'Staff member not found'} text={blocked ? 'Managers can only open reports for their own department.' : 'This staff member could not be found.'} /></Card>}
        </div>
      </div>
      </div>
    </div>,
    document.body
  );
}

// ===== REPORT · Page (/report?id=) =====
export default function SMStaffReport({ data: D, model, go, id, role, myDept, deptLocked }) {
  const rep = id ? individualReport(D, model, id) : null;
  // Guard: managers can only open reports for staff in their own department; otherwise show a message card.
  const blocked = rep && (deptLocked ?? role === 'manager') && rep.s.dept !== myDept;
  if (!rep || blocked) {
    // ===== REPORT · Not found / not allowed card =====
    return <Page><PageHeader title="Individual report" description="One staff member's targets, results, history and recommended training" />
      <Card><EmptyState icon="icon-user-x" title={blocked ? 'Not in your department' : 'Staff member not found'} text={blocked ? 'Managers can only open reports for their own department.' : 'Open a report from a dashboard, the heatmap or Staff Evaluations.'} action={<Btn onClick={() => go('dashboard')}>Go to the dashboard</Btn>} /></Card></Page>;
  }
  // ===== REPORT · Render =====
  const name = 'individual-record-' + slugify(rep.s.name) + '-' + new Date().toISOString().slice(0, 10);
  return (
    <Page>
      {/* ===== REPORT · Page header with CSV / JSON / Excel export buttons ===== */}
      <PageHeader title={rep.s.name} description={'Individual report · ' + rep.s.designation + ', ' + rep.s.dept}
        actions={<><Btn icon="icon-download" onClick={() => reportExport(rep, 'CSV', name)}>CSV</Btn><Btn icon="icon-file-json" onClick={() => reportExport(rep, 'JSON', name)}>JSON</Btn><Btn kind="primary" icon="icon-file-spreadsheet" onClick={() => reportExport(rep, 'Excel', name)}>Export Excel</Btn></>} />
      {/* ===== REPORT · Report body ===== */}
      <IndividualReportView D={D} rep={rep} />
    </Page>
  );
}
