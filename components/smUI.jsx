'use client';
// =============================================================================
// smUI.jsx · Shared UI kit: page header and tabs, cards, buttons, inputs, badges, tables, KPI tiles, drawers, CSV export
// Screen / URL: used on every page inside the shell (Home, Analytics, Training, Staff Evaluations, Framework, Cycles, Forms, Settings, Profile...)
// Who sees it: admin / manager / creator / staff (participant)
// Used by: SkillMatrixApp.jsx and nearly every SM*.jsx page   Depends on: smModel.js (STATUS_C, STATUS_HINT, ALL), ui/select.jsx
// Sections (search for these markers): UI KIT
// =============================================================================
// Shared building blocks so every admin page uses the same header, cards, tables, badges and drawers.
import React, { useMemo, useState } from 'react';
import { STATUS_C, STATUS_HINT, ALL } from './smModel';
import { Select } from './ui/select';

// ===== UI KIT · Style constants =====
export const CARD = { background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', border: '1px solid rgba(255,255,255,.85)', borderRadius: '22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)' };
export const PAGE = { padding: 'clamp(16px,2.6vw,30px) clamp(14px,2.4vw,32px) 48px', display: 'flex', flexDirection: 'column', gap: '20px' };
export const INPUT = { height: '36px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', padding: '0 10px', font: '400 13px Inter,sans-serif', background: '#fff', color: '#111827', minWidth: '0' };
export const LABEL = { display: 'flex', flexDirection: 'column', gap: '5px', font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' };
export const GREEN = 'linear-gradient(180deg,#2fb36b,#15904c)';

// ===== UI KIT · Page wrapper =====
export function Page({ children }) { return <div style={PAGE}>{children}</div>; }

// ===== UI KIT · Page tabs =====
// Pages whose sub-pages are tabs (Dashboard, Reports, Skill Framework, Settings, Staff Evaluations).
// The shell provides { title, items, active, onSelect }; PageHeader then shows the page title and the tab bar.
export const TabsContext = React.createContext(null);
export function PageTabs() {
  const t = React.useContext(TabsContext);
  if (!t || !t.items || t.items.length < 2) return null;
  return (
    <div role="tablist" aria-label={t.title} style={{ background: 'rgba(118,118,128,.12)', borderRadius: '12px', padding: '4px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
      {t.items.map(i => { const on = i.key === t.active; return (
        <button key={i.key} type="button" role="tab" aria-selected={on} onClick={() => { if (!on) t.onSelect(i.key); }}
          style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '9px', height: '36px', padding: '0 14px', border: '0', borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap', font: '500 14.5px Inter,sans-serif',
            color: on ? '#111827' : '#4b5563', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
          <i className={i.icon} style={{ fontSize: '16px' }}></i>{i.label}</button>); })}
    </div>
  );
}

// ===== UI KIT · Avatar key =====
// localStorage key for the signed-in person's profile photo. The seeded administrator keeps the original key.
export function avatarKey() {
  try { const me = localStorage.getItem('skm-me'); return me && me !== 'denzilasiam.adjei' ? 'skm-user-avatar:' + me : 'skm-user-avatar'; } catch (e) { return 'skm-user-avatar'; }
}

// ===== UI KIT · Page header =====
export function PageHeader({ title, description, actions, filters }) {
  const tabs = React.useContext(TabsContext);
  if (tabs && tabs.title) title = tabs.title;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: '12px' }}>
        <div style={{ minWidth: '0' }}>
          <h1 style={{ margin: '0', fontSize: 'clamp(24px,3vw,30px)', fontWeight: '700', letterSpacing: '-0.5px' }}>{title}</h1>
          {description ? <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '6px' }}>{description}</div> : null}
        </div>
        {actions ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>{actions}</div> : null}
      </div>
      <PageTabs />
      {filters ? <div style={{ ...CARD, borderRadius: '16px', padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>{filters}</div> : null}
    </div>
  );
}

// ===== UI KIT · Card =====
export function Card({ title, sub, actions, children, style, bodyStyle, flush }) {
  return (
    <div style={{ ...CARD, minWidth: '0', ...(style || {}) }}>
      {title || actions ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '16px 20px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
          <div style={{ minWidth: '0' }}>
            <div style={{ fontSize: '16.5px', fontWeight: '600' }}>{title}</div>
            {sub ? <div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '4px' }}>{sub}</div> : null}
          </div>
          {actions ? <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>{actions}</div> : null}
        </div>
      ) : null}
      <div style={flush ? bodyStyle : { padding: '16px 20px', ...(bodyStyle || {}) }}>{children}</div>
    </div>
  );
}

// ===== UI KIT · Buttons =====
export function Btn({ kind = 'secondary', icon, children, onClick, disabled, title, small, type }) {
  const h = small ? '30px' : '36px';
  const base = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', height: h, padding: small ? '0 10px' : '0 14px', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', font: (kind === 'primary' ? '600 ' : '500 ') + (small ? '12px' : '13px') + ' Inter,sans-serif', opacity: disabled ? 0.55 : 1 };
  const k = {
    primary: { border: '0', borderRadius: '999px', background: disabled ? '#a3acb9' : GREEN, boxShadow: disabled ? 'none' : '0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)', color: '#fff' },
    secondary: { border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', background: '#fff', color: '#374151' },
    danger: { border: '1px solid #fecaca', borderRadius: '10px', background: '#fff', color: '#b91c1c' },
    ghost: { border: '0', borderRadius: '10px', background: 'transparent', color: '#127a42', padding: '0 6px' },
  }[kind];
  return <button type={type || 'button'} title={title} aria-label={title} disabled={disabled} onClick={disabled ? undefined : onClick} style={{ ...base, ...k }}>{icon ? <i className={icon} style={{ fontSize: small ? '13px' : '14px' }}></i> : null}{children}</button>;
}

// ===== UI KIT · Form controls (select, search, field, toggle) =====
export function Sel({ value, onChange, options, style, disabled, title }) {
  return (
    <Select title={title} disabled={disabled} value={value} onValueChange={onChange} options={options} style={{ ...INPUT, padding: '0 10px', ...(style || {}) }} />
  );
}

export function Search({ value, onChange, placeholder, style }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '36px', border: '1px solid rgba(15,35,65,.14)', borderRadius: '10px', padding: '0 10px', background: '#fff', flex: '1 1 200px', minWidth: '0', ...(style || {}) }}>
      <i className="icon-search" style={{ fontSize: '14px', color: '#9ca3af' }}></i>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || 'Search'} style={{ border: '0', outline: '0', flex: '1', minWidth: '0', font: '400 13.5px Inter,sans-serif', background: 'transparent' }} />
    </div>
  );
}

export function Field({ label, hint, children, style }) {
  return <label style={{ ...LABEL, ...(style || {}) }}>{label}{children}{hint ? <span style={{ font: '400 11.5px Inter,sans-serif', letterSpacing: '0', color: '#6b7280' }}>{hint}</span> : null}</label>;
}

export function Toggle({ on, onClick, label, desc, disabled }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} style={{ display: 'flex', alignItems: 'center', gap: '9px', background: 'none', border: '0', padding: '0', cursor: disabled ? 'not-allowed' : 'pointer', textAlign: 'left', opacity: disabled ? 0.55 : 1 }}>
      <span style={{ flex: 'none', width: '34px', height: '20px', borderRadius: '999px', padding: '2px', display: 'flex', justifyContent: on ? 'flex-end' : 'flex-start', background: on ? '#0d3b2a' : '#d1d5db' }}>
        <span style={{ width: '16px', height: '16px', borderRadius: '50%', background: '#fff' }}></span>
      </span>
      <span style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ font: '500 13px Inter,sans-serif', color: '#111827' }}>{label}</span>
        {desc ? <span style={{ font: '400 11.5px Inter,sans-serif', color: '#6b7280' }}>{desc}</span> : null}
      </span>
    </button>
  );
}

// ===== UI KIT · Badges (gap, status, scope) =====
export function Badge({ bg, fg, children, title, style }) {
  return <span title={title} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', font: '600 11px Inter,sans-serif', borderRadius: '999px', padding: '3px 9px', background: bg || '#f3f4f6', color: fg || '#374151', whiteSpace: 'nowrap', ...(style || {}) }}>{children}</span>;
}
export function GapBadge({ gap, GAP, note }) {
  const g = GAP[Math.max(0, Math.min(5, gap))];
  return <Badge bg={g.bg} fg={g.fg} title={g.desc}>{gap} · {g.label}{note ? <span style={{ fontWeight: 500, opacity: 0.85 }}> · {note}</span> : null}</Badge>;
}
export function StatusBadge({ status }) {
  const c = STATUS_C[status] || ['#f3f4f6', '#4b5563'];
  return <Badge bg={c[0]} fg={c[1]} title={STATUS_HINT[status]}>{status}</Badge>;
}
export function ScopeBadge({ override }) {
  return override ? <Badge bg="#fef3c7" fg="#92400e"><i className="icon-git-branch" style={{ fontSize: '11px' }}></i>Department override</Badge>
    : <Badge bg="#e6f2ea" fg="#0d3b2a"><i className="icon-globe" style={{ fontSize: '11px' }}></i>Org-wide</Badge>;
}

// ===== UI KIT · Empty state =====
export function EmptyState({ icon = 'icon-inbox', title, text, action }) {
  return (
    <div style={{ padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
      <span style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#f3f4f6', color: '#9ca3af', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><i className={icon} style={{ fontSize: '20px' }}></i></span>
      <div style={{ fontSize: '14.5px', fontWeight: '600', color: '#111827' }}>{title}</div>
      {text ? <div style={{ fontSize: '13px', color: '#6b7280', maxWidth: '420px' }}>{text}</div> : null}
      {action || null}
    </div>
  );
}

// ===== UI KIT · Data table =====
export const TH = { textAlign: 'left', padding: '10px 14px', font: '600 10px Inter,sans-serif', letterSpacing: '.5px', color: '#6b7280', borderBottom: '1px solid rgba(15,35,65,.07)', whiteSpace: 'nowrap', textTransform: 'uppercase', background: 'rgba(255,255,255,.92)', position: 'sticky', top: '0', zIndex: '1' };
export const TD = { padding: '10px 14px', borderBottom: '1px solid rgba(15,35,65,.07)', color: '#111827', verticalAlign: 'middle' };

// columns: [{ key, label, render?(row), align?, width?, sort?(row) }]
export function DataTable({ columns, rows, empty, minWidth = 640, maxHeight, sort, onSort, rowKey }) {
  if (!rows.length) return empty || <EmptyState title="Nothing to show" text="No records match the current filters." />;
  return (
    <div style={{ overflow: 'auto', maxHeight: maxHeight || 'none' }}>
      <table style={{ width: '100%', minWidth: minWidth + 'px', borderCollapse: 'separate', borderSpacing: '0', font: '400 13px Inter,sans-serif' }}>
        <thead>
          <tr>{columns.map(c => {
            const on = sort && sort.key === c.key;
            return <th key={c.key} style={{ ...TH, textAlign: c.align || 'left', width: c.width, cursor: onSort && c.sortable !== false ? 'pointer' : 'default' }} onClick={onSort && c.sortable !== false ? () => onSort(c.key) : undefined}>
              {c.label}{on ? <i className={sort.dir === 'asc' ? 'icon-arrow-up' : 'icon-arrow-down'} style={{ fontSize: '10px', marginLeft: '4px' }}></i> : null}</th>;
          })}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={rowKey ? rowKey(r, i) : i}>{columns.map(c => <td key={c.key} style={{ ...TD, textAlign: c.align || 'left' }}>{c.render ? c.render(r) : r[c.key]}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  );
}

// ===== UI KIT · KPI tile =====
export function KpiTile({ label, value, sub, subColor, onClick, icon }) {
  return (
    <button type="button" onClick={onClick} disabled={!onClick} style={{ ...CARD, padding: '18px', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', display: 'flex', flexDirection: 'column', gap: '6px', font: 'inherit', color: 'inherit' }}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', color: '#374151' }}>{label}{onClick ? <i className={icon || 'icon-chevron-right'} style={{ fontSize: '14px', color: '#9ca3af' }}></i> : null}</span>
      <span style={{ fontSize: '24px', fontWeight: '700', letterSpacing: '-0.3px' }}>{value}</span>
      {sub ? <span style={{ fontSize: '12px', color: subColor || '#6b7280' }}>{sub}</span> : null}
    </button>
  );
}

// ===== UI KIT · Toast =====
export function Toast({ text }) {
  if (!text) return null;
  return <div style={{ position: 'fixed', left: '50%', bottom: '28px', transform: 'translateX(-50%)', zIndex: '90', background: '#111827', color: '#fff', font: '500 13px Inter,sans-serif', padding: '10px 16px', borderRadius: '12px', boxShadow: '0 10px 30px rgba(0,0,0,.25)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: 'calc(100vw - 32px)' }}><i className="icon-circle-check" style={{ fontSize: '15px', color: '#4ade80' }}></i>{text}</div>;
}

// ===== UI KIT · Drawer =====
export function Drawer({ open, title, sub, onClose, children, footer, width = 780 }) {
  if (!open) return null;
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: '0', zIndex: '75', background: 'rgba(8,12,24,.45)', display: 'flex', justifyContent: 'flex-end' }}>
      <div onClick={e => e.stopPropagation()} style={{ width: 'min(' + width + 'px,100%)', height: '100%', background: '#fff', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,.2)' }}>
        <div style={{ padding: '18px 22px', borderBottom: '1px solid rgba(15,35,65,.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
          <div style={{ minWidth: '0' }}>
            <div style={{ fontSize: '18px', fontWeight: '700' }}>{title}</div>
            {sub ? <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px' }}>{sub}</div> : null}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: '0', cursor: 'pointer', color: '#6b7280', display: 'flex', padding: '4px' }}><i className="icon-x" style={{ fontSize: '18px' }}></i></button>
        </div>
        <div style={{ flex: '1', overflowY: 'auto', minHeight: '0' }}>{children}</div>
        {footer ? <div style={{ padding: '14px 22px', borderTop: '1px solid rgba(15,35,65,.07)' }}>{footer}</div> : null}
      </div>
    </div>
  );
}

// ===== UI KIT · Export helpers (CSV download) =====
export function download(name, text, mime) {
  try { const b = new Blob([text], { type: mime || 'text/plain' }); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = name; document.body.appendChild(a); a.click(); a.remove(); } catch (e) {}
}
const cell = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
export function toCSV(headers, rows) { return [headers.map(cell).join(','), ...rows.map(r => headers.map(h => cell(r[h])).join(','))].join('\n'); }
export const slugify = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ===== UI KIT · Staff drawer =====
// Staff drawer: opened from every dashboard tile, bar, heatmap cell and gap band.
// ctx = { title, sub, rows, aggregated }
export function StaffDrawer({ ctx, D, go, onClose }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState({ key: 'gap', dir: 'desc' });
  const rows = useMemo(() => {
    if (!ctx) return [];
    const t = q.trim().toLowerCase();
    const list = ctx.rows.filter(r => !t || (r.name + ' ' + r.dept + ' ' + r.role + ' ' + (r.comp || '') + ' ' + r.training).toLowerCase().includes(t));
    const k = sort.key, m = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => { const x = a[k], y = b[k]; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * m || a.name.localeCompare(b.name); });
  }, [ctx, q, sort]);
  if (!ctx) return null;
  const agg = ctx.aggregated;
  const onSort = key => setSort(s => ({ key, dir: s.key === key && s.dir === 'desc' ? 'asc' : 'desc' }));
  const people = new Set(ctx.rows.map(r => r.id)).size;
  const exportCsv = () => {
    const H = ['Name', 'Department', 'Role', ...(agg ? [] : ['Competency']), agg ? 'Avg target' : 'Target', agg ? 'Avg actual' : 'Actual', agg ? 'Largest gap' : 'Gap', 'Gap band', 'Assessment status', 'Recommended training'];
    const data = rows.map(r => ({ Name: r.name, Department: r.dept, Role: r.role, Competency: r.comp, [agg ? 'Avg target' : 'Target']: r.target, [agg ? 'Avg actual' : 'Actual']: r.actual, [agg ? 'Largest gap' : 'Gap']: r.gap + (agg ? ' (' + r.gapNote + ')' : ''), 'Gap band': D.GAP[r.gap].label, 'Assessment status': r.status, 'Recommended training': r.training }));
    download(slugify(ctx.title) + '.csv', toCSV(H, data), 'text/csv');
  };
  const cols = [
    { key: 'name', label: 'Name', render: r => <button type="button" onClick={() => { onClose(); go('report', null, r.id); }} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{r.name}</button> },
    { key: 'dept', label: 'Department' },
    { key: 'role', label: 'Role' },
    ...(agg ? [] : [{ key: 'comp', label: 'Competency' }]),
    { key: 'target', label: agg ? 'Avg target' : 'Target', align: 'center', render: r => <span style={{ font: "600 12.5px 'JetBrains Mono',monospace" }}>{r.target}</span> },
    { key: 'actual', label: agg ? 'Avg actual' : 'Actual', align: 'center', render: r => <span style={{ font: "600 12.5px 'JetBrains Mono',monospace" }}>{r.actual}</span> },
    { key: 'gap', label: agg ? 'Largest gap' : 'Gap', render: r => <GapBadge gap={r.gap} GAP={D.GAP} note={agg ? r.gapNote : ''} /> },
    { key: 'status', label: 'Status', render: r => <StatusBadge status={r.status} /> },
    { key: 'training', label: 'Recommended training', render: r => <span style={{ fontSize: '12.5px', color: r.training === '—' ? '#9ca3af' : '#374151' }}>{r.training}</span> },
  ];
  return (
    <Drawer open title={ctx.title} sub={(ctx.sub ? ctx.sub + ' · ' : '') + people + ' staff' + (agg ? '' : ' · ' + ctx.rows.length + ' competency records')} onClose={onClose} width={1040}>
      {/* ===== UI KIT · Staff drawer toolbar (search, sort, export) ===== */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px 22px', borderBottom: '1px solid rgba(15,35,65,.07)', alignItems: 'center' }}>
        <Search value={q} onChange={setQ} placeholder="Search name, department, role or training" />
        <Sel value={sort.key + ':' + sort.dir} onChange={v => { const [key, dir] = v.split(':'); setSort({ key, dir }); }}
          options={[['gap:desc', 'Largest gap first'], ['gap:asc', 'Smallest gap first'], ['name:asc', 'Name A–Z'], ['dept:asc', 'Department'], ['actual:asc', 'Lowest actual'], ['status:asc', 'Status']]} />
        <Btn icon="icon-download" onClick={exportCsv}>Export CSV</Btn>
      </div>
      {/* ===== UI KIT · Staff drawer table ===== */}
      <DataTable columns={cols} rows={rows} sort={sort} onSort={onSort} minWidth={agg ? 900 : 1000} rowKey={(r, i) => r.id + (r.comp || '') + i}
        empty={<EmptyState icon="icon-users" title="No staff in this selection" text={q ? 'Try a different search.' : 'Nobody in scope matches what you clicked.'} />} />
    </Drawer>
  );
}

// ===== UI KIT · Department filter =====
// Department filter used on scoped pages: shows the global scope until the page overrides it.
export function ScopeSelect({ depts, value, globalValue, onChange, locked }) {
  const overridden = false; // no header department selector any more, so there is nothing to reset to
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
      <Sel value={value} onChange={onChange} disabled={locked} title={locked ? 'Managers see their own department only' : 'Department'} options={[[ALL, 'All departments'], ...depts.map(d => [d.name, d.name])]} />
      {overridden ? <button type="button" onClick={() => onChange(null)} title="Use the department chosen in the header" style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '999px', padding: '3px 9px', cursor: 'pointer', font: '500 11.5px Inter,sans-serif', color: '#92400e' }}>Page filter · reset to {globalValue === ALL ? 'all departments' : globalValue}</button> : null}
    </span>
  );
}
