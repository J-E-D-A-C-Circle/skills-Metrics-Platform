'use client';
import React from 'react';
import { Page, PageHeader, Card, Btn, Badge, GapBadge, EmptyState, DataTable, KpiTile, CARD, GREEN } from './smUI';
import { ALL, inScope, avg } from './smModel';

const SC = { Draft: ['#fef3c7', '#92400e'], Scheduled: ['#e0e7ff', '#3730a3'], Open: ['#dcfce7', '#15803d'], Closed: ['#f3f4f6', '#4b5563'] };
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// Administrator Home: an overview across every department (or the department chosen in the header).
export default function AdminHome({ data: D, model, go, scope, status }) {
  const staff = inScope(model, scope);
  const label = scope === ALL ? 'All departments' : scope;
  const done = staff.filter(s => s.scored).length, pct = staff.length ? Math.round(done / staff.length * 100) : 0;
  const pendingText = staff.filter(s => s.status === 'Submitted').length, toConfirm = staff.filter(s => s.status === 'Auto-scored').length;
  const severe = staff.flatMap(s => s.comps.filter(c => c.gap >= 3).map(c => ({ s, c })));
  let cycles = D.cycles;
  try { const v = JSON.parse(localStorage.getItem('skm-cycles') || 'null'); if (Array.isArray(v) && v.length) cycles = v; } catch (e) {}
  const live = cycles.filter(c => c.status === 'Open' || c.status === 'Scheduled' || c.status === 'Draft').sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const byComp = {};
  severe.forEach(({ s, c }) => { (byComp[c.id] = byComp[c.id] || { id: c.id, name: c.name, n: 0, tr: c.training }).n++; });
  const topNeeds = Object.values(byComp).sort((a, b) => b.n - a.n).slice(0, 5);
  const depts = D.depts.filter(d => scope === ALL || d.name === scope).map(d => { const l = model.staff.filter(s => s.dept === d.name); return { name: d.name, staff: l.length, pct: Math.round(l.filter(s => s.scored).length / l.length * 100), gap: avg(l.map(s => s.avgGap)), review: l.filter(s => s.status === 'Submitted' || s.status === 'Auto-scored').length }; });
  const outstandingTop = [...depts].sort((a, b) => a.pct - b.pct)[0];
  const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const C = D.cycle;
  const my = { not_started: ['Your ' + C.short + ' assessment is open today', C.window + ' · ' + C.durationMin + ' minutes · one attempt', 'Start assessment', 'icon-play', () => go('take')],
    in_progress: ['Your assessment timer is running', 'Answers are saved. Return before time runs out.', 'Resume assessment', 'icon-timer', () => go('take')],
    submitted: ['Your assessment is submitted', 'Results are released on ' + C.resultsLabel, 'View receipt', 'icon-receipt', () => go('take')] }[status || 'not_started'];
  const attention = [
    pendingText ? { icon: 'icon-message-square-text', text: pendingText + ' open-text answer' + (pendingText > 1 ? 's' : '') + ' waiting to be scored', go: () => go('staff-evals') } : null,
    toConfirm ? { icon: 'icon-badge-check', text: toConfirm + ' auto-scored result' + (toConfirm > 1 ? 's' : '') + ' ready to confirm', go: () => go('staff-evals') } : null,
    outstandingTop && outstandingTop.pct < 100 ? { icon: 'icon-hourglass', text: outstandingTop.name + ' is at ' + outstandingTop.pct + '% completion, the lowest in scope', go: () => go('dashboard') } : null,
    severe.length ? { icon: 'icon-graduation-cap', text: new Set(severe.map(x => x.s.id)).size + ' staff need intensive training (gap 3+)', go: () => go('training') } : null,
  ].filter(Boolean);
  return (
    <Page>
      <PageHeader title={greet + ', Denzil'} description={'Administrator overview · ' + label + ' · ' + C.name} actions={<><Btn icon="icon-calendar-cog" onClick={() => go('cycles')}>Assessment cycles</Btn><Btn kind="primary" icon="icon-chart-column" onClick={() => go('dashboard')}>Executive dashboard</Btn></>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
        <KpiTile label="Staff in scope" value={staff.length} sub={scope === ALL ? D.depts.length + ' departments' : scope} onClick={() => go('dashboard')} />
        <KpiTile label="Completion" value={pct + '%'} sub={done + ' of ' + staff.length + ' assessed'} onClick={() => go('dashboard')} />
        <KpiTile label="Awaiting review" value={pendingText + toConfirm} sub={pendingText + ' open text · ' + toConfirm + ' to confirm'} subColor={pendingText + toConfirm ? '#b45309' : '#15803d'} onClick={() => go('staff-evals')} />
        <KpiTile label="Gaps of 3 or more" value={severe.length} sub="person × competency" subColor="#b91c1c" onClick={() => go('training')} />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <button type="button" onClick={my[4]} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderRadius: '22px', border: '0', background: 'linear-gradient(120deg,#0d3b2a,#17603f)', color: '#fff', cursor: 'pointer', textAlign: 'left', boxShadow: '0 10px 30px rgba(10,52,36,.18)' }}>
            <span style={{ width: '44px', height: '44px', borderRadius: '50%', background: GREEN, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', boxShadow: '0 8px 20px rgba(21,144,76,.4)' }}><i className={my[3]} style={{ fontSize: '19px' }}></i></span>
            <span style={{ flex: '1', minWidth: '0' }}><span style={{ display: 'block', font: '700 10px Inter,sans-serif', letterSpacing: '.6px', color: '#b9d8c6' }}>YOUR ASSESSMENT</span><span style={{ display: 'block', font: '600 15px Inter,sans-serif', marginTop: '3px' }}>{my[0]}</span><span style={{ display: 'block', font: '400 12px Inter,sans-serif', color: '#cfe6d8', marginTop: '3px' }}>{my[1]}</span></span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', height: '34px', padding: '0 14px', borderRadius: '999px', background: '#fff', color: '#0d3b2a', font: '600 13px Inter,sans-serif', whiteSpace: 'nowrap' }}>{my[2]}<i className="icon-arrow-right" style={{ fontSize: '14px' }}></i></span>
          </button>
          <Card title="Needs your attention" flush style={{ flex: '1' }}>
            {attention.length ? attention.map((a, i) => (
              <button key={i} type="button" onClick={a.go} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', border: '0', borderBottom: '1px solid rgba(15,35,65,.07)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#fff7ed', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className={a.icon} style={{ fontSize: '15px' }}></i></span>
                <span style={{ flex: '1', font: '500 13.5px Inter,sans-serif', color: '#111827' }}>{a.text}</span><i className="icon-chevron-right" style={{ color: '#9ca3af' }}></i>
              </button>)) : <EmptyState icon="icon-circle-check" title="All caught up" text="Nothing needs your review right now." />}
          </Card>
        </div>
        <Card title="Assessment cycles" sub="Open, scheduled and draft" actions={<Btn small kind="ghost" onClick={() => go('cycles')}>Manage</Btn>} flush style={{ flex: '1.4 1 380px' }}>
          {live.length ? live.map(c => (
            <button key={c.id} type="button" onClick={() => go('cycles')} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '13px 20px', border: '0', borderBottom: '1px solid rgba(15,35,65,.07)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: '44px', textAlign: 'center', flex: 'none' }}><span style={{ display: 'block', font: '700 17px Inter,sans-serif', color: '#0d3b2a' }}>{new Date(c.start + 'T00:00').getDate()}</span><span style={{ font: '600 10px Inter,sans-serif', color: '#6b7280', textTransform: 'uppercase' }}>{new Date(c.start + 'T00:00').toLocaleString('en', { month: 'short' })}</span></span>
              <span style={{ flex: '1 1 200px', minWidth: '0' }}><span style={{ display: 'block', font: '600 13.5px Inter,sans-serif', color: '#111827' }}>{c.name}</span><span style={{ fontSize: '12px', color: '#6b7280' }}>{c.depts === 'all' ? 'All departments' : c.depts.join(', ')} · {fmtDate(c.start)} · {c.open}–{c.close}</span></span>
              <Badge bg={SC[c.status][0]} fg={SC[c.status][1]}>{c.status}</Badge>
            </button>)) : <EmptyState icon="icon-calendar-plus" title="No upcoming cycles" action={<Btn kind="primary" onClick={() => go('cycles')}>Create a cycle</Btn>} />}
        </Card>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        <Card title="Departments at a glance" sub={C.short + ' · click through to the dashboard for detail'} flush style={{ flex: '2 1 480px' }}>
          <DataTable minWidth={520} rows={depts} rowKey={r => r.name} columns={[
            { key: 'name', label: 'Department', render: r => <b style={{ fontWeight: 500 }}>{r.name}</b> }, { key: 'staff', label: 'Staff', align: 'center' },
            { key: 'pct', label: 'Completion', render: r => <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><span style={{ width: '80px', height: '6px', borderRadius: '999px', background: '#eef0f3', overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: r.pct + '%', background: '#0d3b2a' }}></span></span>{r.pct}%</span> },
            { key: 'gap', label: 'Avg gap', render: r => <GapBadge gap={Math.round(r.gap)} GAP={D.GAP} note={r.gap.toFixed(1)} /> },
            { key: 'review', label: 'To review', align: 'center', render: r => r.review ? <Badge bg="#ffedd5" fg="#9a3412">{r.review}</Badge> : <span style={{ color: '#9ca3af' }}>0</span> }]} />
        </Card>
        <Card title="Top training needs" sub="Staff with a gap of 3 or more" actions={<Btn small kind="ghost" onClick={() => go('training')}>All needs</Btn>} flush style={{ flex: '1 1 320px' }}>
          {topNeeds.length ? topNeeds.map(t => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 20px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
              <span style={{ flex: '1', minWidth: '0' }}><span style={{ display: 'block', font: '500 13.5px Inter,sans-serif' }}>{t.name}</span><span style={{ fontSize: '11.5px', color: '#6b7280' }}>{t.tr ? t.tr.name : ''}</span></span>
              <b style={{ font: "700 14px 'JetBrains Mono',monospace" }}>{t.n}</b>
            </div>)) : <EmptyState icon="icon-graduation-cap" title="No intensive training needs" />}
        </Card>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' }}>
        {[['icon-file-pen-line', 'Form Builder', 'Build and version assessment forms', 'forms'], ['icon-file-spreadsheet', 'Report Builder', 'Individual and aggregated reports', 'reports'], ['icon-crosshair', 'Target Profiles', 'Org-wide and department targets', 'targets'], ['icon-user-cog', 'User Management', 'Accounts, roles and passwords', 'users']].map(([icon, t, s, k]) => (
          <button key={k} type="button" onClick={() => go(k)} style={{ ...CARD, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e6f2ea', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className={icon} style={{ fontSize: '17px' }}></i></span>
            <span style={{ flex: '1' }}><span style={{ display: 'block', font: '600 14px Inter,sans-serif', color: '#111827' }}>{t}</span><span style={{ font: '400 11.5px Inter,sans-serif', color: '#6b7280' }}>{s}</span></span>
            <i className="icon-chevron-right" style={{ color: '#9ca3af' }}></i>
          </button>))}
      </div>
    </Page>
  );
}
