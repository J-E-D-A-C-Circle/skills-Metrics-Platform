'use client';
// =============================================================================
// SMAdminHome · Administrator Home: organisation-wide overview (shortcuts, KPIs, attention list, cycles)
// Screen / URL: Home, "/" and "/home" when signed in as admin
// Who sees it: admin only
// Used by: components/SMHome.jsx (when role is admin)   Depends on: smUI (Page, Card, KpiTile...), smModel (inScope, avg)
// Sections (search for these markers): ADMIN HOME · Constants & helpers, Component, State & helpers, Needs your attention items,
//   Render, Page header, Shortcut cards, KPI tiles, Attention + Cycles row, Needs your attention card, Assessment cycles card
// =============================================================================
import React from 'react';
import { Page, PageHeader, Card, Btn, Badge, GapBadge, EmptyState, DataTable, KpiTile, CARD, GREEN } from './smUI';
import { ALL, inScope, avg } from './smModel';

// ===== ADMIN HOME · Constants & helpers =====
// SC = badge colours [background, text] per cycle status; fmtDate turns "2026-10-13" into "13 Oct".
const SC = { Draft: ['#fef3c7', '#92400e'], Scheduled: ['#e0e7ff', '#3730a3'], Open: ['#dcfce7', '#15803d'], Closed: ['#f3f4f6', '#4b5563'] };
const fmtDate = s => new Date(s + 'T00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

// ===== ADMIN HOME · Component =====
// Administrator Home: an overview across every department. Administrators don't take assessments, so there is no assessment card.
export default function AdminHome({ data: D, model, go, scope, status }) {
  // ===== ADMIN HOME · State & helpers (figures for the cards) =====
  // scope = ALL (every department) or one department name; all figures below only count staff in scope.
  const staff = inScope(model, scope);
  const label = scope === ALL ? 'All departments' : scope;
  const done = staff.filter(s => s.scored).length, pct = staff.length ? Math.round(done / staff.length * 100) : 0;
  const pendingText = staff.filter(s => s.status === 'Submitted').length, toConfirm = staff.filter(s => s.status === 'Auto-scored').length;
  const severe = staff.flatMap(s => s.comps.filter(c => c.gap >= 3).map(c => ({ s, c })));
  // Cycles: edits saved by the Cycles page in localStorage 'skm-cycles' replace the seed list D.cycles.
  let cycles = D.cycles;
  try { const v = JSON.parse(localStorage.getItem('skm-cycles') || 'null'); if (Array.isArray(v) && v.length) cycles = v; } catch (e) {}
  // Upcoming cycles card: open / scheduled / draft cycles, soonest first, at most 4.
  const live = cycles.filter(c => c.status === 'Open' || c.status === 'Scheduled' || c.status === 'Draft').sort((a, b) => a.start.localeCompare(b.start)).slice(0, 4);
  const depts = D.depts.filter(d => scope === ALL || d.name === scope).map(d => { const l = model.staff.filter(s => s.dept === d.name); return { name: d.name, staff: l.length, pct: Math.round(l.filter(s => s.scored).length / l.length * 100), gap: avg(l.map(s => s.avgGap)), review: l.filter(s => s.status === 'Submitted' || s.status === 'Auto-scored').length }; });
  // Department with the lowest completion feeds the attention list.
  const outstandingTop = [...depts].sort((a, b) => a.pct - b.pct)[0];
  // Greeting by time of day: before 12 morning, before 17 afternoon, else evening.
  const hour = new Date().getHours(), greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const C = D.cycle;
  // ===== ADMIN HOME · Needs your attention items =====
  // Each item only appears when its count is above zero; clicking goes to the page that fixes it.
  const attention = [
    pendingText ? { icon: 'icon-message-square-text', text: pendingText + ' open-text answer' + (pendingText > 1 ? 's' : '') + ' waiting to be scored', go: () => go('staff-evals') } : null,
    toConfirm ? { icon: 'icon-badge-check', text: toConfirm + ' auto-scored result' + (toConfirm > 1 ? 's' : '') + ' ready to confirm', go: () => go('staff-evals') } : null,
    outstandingTop && outstandingTop.pct < 100 ? { icon: 'icon-hourglass', text: outstandingTop.name + ' is at ' + outstandingTop.pct + '% completion, the lowest in scope', go: () => go('analytics', 'departments') } : null,
    severe.length ? { icon: 'icon-graduation-cap', text: new Set(severe.map(x => x.s.id)).size + ' staff need intensive training (gap 3+)', go: () => go('training', 'top-needs') } : null,
  ].filter(Boolean);
  // ===== ADMIN HOME · Render =====
  return (
    <Page>
      {/* ===== ADMIN HOME · Page header (greeting + Assessment cycles / Analytics buttons) ===== */}
      <PageHeader title={greet + ', ' + D.user.firstName} description={'Administrator overview · ' + label + ' · ' + C.name} actions={<><Btn icon="icon-calendar-cog" onClick={() => go('cycles')}>Assessment cycles</Btn><Btn kind="primary" icon="icon-chart-column" onClick={() => go('analytics')}>Analytics</Btn></>} />
      {/* ===== ADMIN HOME · Shortcut cards (Forms, Reports, Target Profiles, User Management) ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '12px' }}>
        {[['icon-file-pen-line', 'Forms', 'Build and version assessment forms', 'forms'], ['icon-file-spreadsheet', 'Reports', 'Individual and aggregated reports', 'reports'], ['icon-crosshair', 'Target Profiles', 'Org-wide and department targets', 'framework', 'targets'], ['icon-user-cog', 'User Management', 'Accounts, roles and passwords', 'users']].map(([icon, t, s, k, tab]) => (
          <button key={k} type="button" onClick={() => go(k, tab)} style={{ ...CARD, borderRadius: '18px', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', cursor: 'pointer', textAlign: 'left' }}>
            <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: '#e6f2ea', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className={icon} style={{ fontSize: '17px' }}></i></span>
            <span style={{ flex: '1' }}><span style={{ display: 'block', font: '600 14px Inter,sans-serif', color: '#111827' }}>{t}</span><span style={{ font: '400 11.5px Inter,sans-serif', color: '#6b7280' }}>{s}</span></span>
            <i className="icon-chevron-right" style={{ color: '#9ca3af' }}></i>
          </button>))}
      </div>
      {/* ===== ADMIN HOME · KPI tiles ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '12px' }}>
        <KpiTile label="Staff in scope" value={staff.length} sub={scope === ALL ? D.depts.length + ' departments' : scope} onClick={() => go('analytics')} />
        <KpiTile label="Completion" value={pct + '%'} sub={done + ' of ' + staff.length + ' assessed'} onClick={() => go('analytics')} />
        <KpiTile label="Awaiting review" value={pendingText + toConfirm} sub={pendingText + ' open text · ' + toConfirm + ' to confirm'} subColor={pendingText + toConfirm ? '#b45309' : '#15803d'} onClick={() => go('staff-evals')} />
        <KpiTile label="Gaps of 3 or more" value={severe.length} sub="person × competency" subColor="#b91c1c" onClick={() => go('training')} />
      </div>
      {/* ===== ADMIN HOME · Attention + Cycles row ===== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* ===== ADMIN HOME · Needs your attention card ===== */}
          <Card title="Needs your attention" flush style={{ flex: '1' }}>
            {attention.length ? attention.map((a, i) => (
              <button key={i} type="button" onClick={a.go} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', border: '0', borderBottom: '1px solid rgba(15,35,65,.07)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: '34px', height: '34px', borderRadius: '10px', background: '#fff7ed', color: '#c2410c', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className={a.icon} style={{ fontSize: '15px' }}></i></span>
                <span style={{ flex: '1', font: '500 13.5px Inter,sans-serif', color: '#111827' }}>{a.text}</span><i className="icon-chevron-right" style={{ color: '#9ca3af' }}></i>
              </button>)) : <EmptyState icon="icon-circle-check" title="All caught up" text="Nothing needs your review right now." />}
          </Card>
        </div>
        {/* ===== ADMIN HOME · Assessment cycles card ===== */}
        <Card title="Assessment cycles" sub="Open, scheduled and draft" actions={<Btn small kind="ghost" onClick={() => go('cycles')}>Manage</Btn>} flush style={{ flex: '1.4 1 380px' }}>
          {live.length ? live.map(c => (
            <button key={c.id} type="button" onClick={() => go('cycles')} style={{ width: '100%', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px', padding: '13px 20px', border: '0', borderBottom: '1px solid rgba(15,35,65,.07)', background: 'transparent', cursor: 'pointer', textAlign: 'left' }}>
              <span style={{ width: '44px', textAlign: 'center', flex: 'none' }}><span style={{ display: 'block', font: '700 17px Inter,sans-serif', color: '#0d3b2a' }}>{new Date(c.start + 'T00:00').getDate()}</span><span style={{ font: '600 10px Inter,sans-serif', color: '#6b7280', textTransform: 'uppercase' }}>{new Date(c.start + 'T00:00').toLocaleString('en', { month: 'short' })}</span></span>
              <span style={{ flex: '1 1 200px', minWidth: '0' }}><span style={{ display: 'block', font: '600 13.5px Inter,sans-serif', color: '#111827' }}>{c.name}</span><span style={{ fontSize: '12px', color: '#6b7280' }}>{c.depts === 'all' ? 'All departments' : c.depts.join(', ')} · {fmtDate(c.start)} · {c.open}–{c.close}</span></span>
              <Badge bg={SC[c.status][0]} fg={SC[c.status][1]}>{c.status}</Badge>
            </button>)) : <EmptyState icon="icon-calendar-plus" title="No upcoming cycles" action={<Btn kind="primary" onClick={() => go('cycles')}>Create a cycle</Btn>} />}
        </Card>
      </div>
    </Page>
  );
}
