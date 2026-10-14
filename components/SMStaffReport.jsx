'use client';
// =============================================================================
// SMStaffReport.jsx · one staff member's individual report and its export
// Screen / URL: /report?id=<staff id> (opened from dashboards, heatmap, Training Needs, Staff Evaluations)
// Who sees it: admin (anyone); manager (own department only)
// Used by: SkillMatrixApp.jsx (report page); SMAnalytics.jsx (Report Builder preview)   Depends on: ./smUI, ./smModel (individualReport, CYCLES), xlsx
// Sections (search for these markers): REPORT · Export helpers (XML escape), REPORT · Export one person's record, REPORT · Individual report view, REPORT · Details card, REPORT · Competencies table, REPORT · History + recommended training row, REPORT · History across cycles chart, REPORT · Recommended training list, REPORT · History by competency table (full page only), REPORT · Page (/report?id=), REPORT · Not found / not allowed card, REPORT · Render, REPORT · Page header with CSV / JSON / Excel export buttons, REPORT · Report body
// =============================================================================
import React from 'react';
import { Page, PageHeader, Card, Btn, Badge, GapBadge, StatusBadge, ScopeBadge, EmptyState, DataTable, download, toCSV, slugify } from './smUI';
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

// ===== REPORT · Page (/report?id=) =====
export default function SMStaffReport({ data: D, model, go, id, role, myDept }) {
  const rep = id ? individualReport(D, model, id) : null;
  // Guard: managers can only open reports for staff in their own department; otherwise show a message card.
  const blocked = rep && role === 'manager' && rep.s.dept !== myDept;
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
