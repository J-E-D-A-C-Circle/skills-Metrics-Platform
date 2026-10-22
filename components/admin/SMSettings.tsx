'use client';
// =============================================================================
// SMSettings.jsx · Settings: General (system settings), Scoring & Attempts (versioned thresholds), Notifications
//   (template wording and channels) and the Audit Log viewer
// Screen / URL: /settings (General), /settings?tab=scoring, /settings?tab=notifications, /settings?tab=audit
//   (User Management, /settings?tab=users, is drawn by SMSystem.jsx)
// Who sees it: each tab needs its own permission: settings.general, settings.scoring, settings.notifications,
//   settings.audit (and settings.audit-export for the CSV download). The server checks them again.
// Used by: SkillMatrixApp.jsx (page "settings", prop `view`: settings | scoring | notif-templates | audit)
// Depends on: smUI (kit), smApi (api, useLoad, qs, fmtDateTime), lib/scoring.js (validateConfig, statuses, labels)
// Server: /api/settings/general, /api/settings/scoring, /api/settings/templates(/:key), /api/audit(/export)
// Sections (search for these markers): SETTINGS · Shared parts, SETTINGS · Router, GENERAL · Form, SCORING · Form,
//   SCORING · Example results, SCORING · History, TEMPLATES · List, TEMPLATES · Editor, AUDIT · Filters, AUDIT · Table,
//   AUDIT · Detail drawer
// =============================================================================
import React, { useEffect, useMemo, useState } from 'react';
import { Page, PageHeader, Card, Btn, Sel, Search, Field, Toggle, Badge, Confirm, EmptyState, DataTable, Drawer, CompetencyBadge, GapStatusBadge, download, INPUT } from '@/components/shared/smUI';
import { api, useLoad, qs, fmtDateTime } from '@/components/shared/smApi';
import { validateConfig, competencyStatus, gapStatus, formatAverage } from '@/lib/scoring';

// ===== SETTINGS · Shared parts =====
const ErrorLine = ({ text }) => (text ? <div role="alert" style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', borderRadius: '10px', padding: '8px 12px', fontSize: '13px' }}>{text}</div> : null);
const Loading = ({ text = 'Loading…' }) => <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>{text}</div>;
const LoadError = ({ L }) => <Card><ErrorLine text={L.error} /><div style={{ marginTop: '10px' }}><Btn icon="icon-refresh-cw" onClick={L.reload}>Try again</Btn></div></Card>;
const TEXTAREA = { ...INPUT, height: 'auto', minHeight: '80px', padding: '8px 10px', resize: 'vertical', lineHeight: 1.45 };
const fieldErr = (fields, k) => (fields && fields[k] ? <span style={{ color: '#b91c1c', font: '400 11.5px Inter,sans-serif' }}>{fields[k][0]}</span> : null);
const Changed = ({ at, by }) => <span style={{ fontSize: '12px', color: '#6b7280' }}>{at ? 'Last changed ' + fmtDateTime(at) + (by ? ' by ' + by : '') : 'Using the built-in defaults'}</span>;

// ===== SETTINGS · Router =====
export default function SMSettings(S) {
  const { view } = S;
  return (
    <Page>
      {view === 'scoring' ? <ScoringView {...S} /> : view === 'notif-templates' ? <TemplatesView {...S} /> : view === 'audit' ? <AuditView {...S} /> : <GeneralView {...S} />}
    </Page>
  );
}

// ===== GENERAL · Form =====
// Organisation name, result-release default, deadline policy and reminder lead time. Saved after a confirmation.
function GeneralView({ toast }) {
  const L = useLoad('/api/settings/general');
  const [v, setV] = useState(null), [err, setErr] = useState(''), [fields, setFields] = useState({}), [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  useEffect(() => { if (L.data) setV({ ...L.data.settings }); }, [L.data]);
  const D = L.data;
  const header = <PageHeader title="Settings" description="Organisation details and the defaults new assessments and assignments start with." />;
  if (L.error) return <>{header}<LoadError L={L} /></>;
  if (!D || !v) return <>{header}<Card><Loading /></Card></>;
  const num = k => e => setV(x => ({ ...x, [k]: e.target.value === '' ? '' : Number(e.target.value) }));
  const diff = Object.keys(D.settings).filter(k => D.settings[k] !== v[k]);
  const NAMES = { orgName: 'Organisation name', defaultResultRelease: 'Result release for new assessments', defaultDeadlineDays: 'Default deadline (days)', reminderLeadHours: 'Deadline reminder (hours before)' };
  const show = (k, x) => (k === 'defaultResultRelease' ? D.resultRelease.find(r => r.key === x)?.label : String(x));
  const save = async () => {
    setBusy(true); setErr(''); setFields({});
    try { await api('PUT', '/api/settings/general', v); await L.reload(); toast('Settings saved'); }
    catch (e) { setErr(e.message); setFields(e.fields || {}); } finally { setBusy(false); setAsk(false); }
  };
  return (<>
    <PageHeader title="Settings" description="Organisation details and the defaults new assessments and assignments start with."
      actions={<><Btn icon="icon-rotate-ccw" disabled={!diff.length || busy} onClick={() => setV({ ...D.settings })}>Undo changes</Btn><Btn kind="primary" icon="icon-check" disabled={!diff.length || busy} onClick={() => setAsk(true)}>Save settings</Btn></>} />
    <ErrorLine text={err} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,420px),1fr))', gap: '20px', alignItems: 'start' }}>
      <Card title="Organisation" sub={<Changed at={D.updatedAt} by={D.updatedBy} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="ORGANISATION NAME" hint="Shown on reports and exports."><input value={v.orgName} maxLength={150} onChange={e => setV(x => ({ ...x, orgName: e.target.value }))} style={INPUT} />{fieldErr(fields, 'orgName')}</Field>
          <Field label="SIGNED-IN SESSION TIMEOUT" hint="Set on the server (SESSION_IDLE_MINUTES). People are signed out after this long without activity.">
            <input value={D.sessionTimeoutMinutes + ' minutes'} readOnly disabled style={{ ...INPUT, background: '#f9fafb', color: '#6b7280' }} /></Field>
        </div>
      </Card>
      <Card title="Assessment defaults" sub="Used when a new assessment or assignment is created; each one can still be changed on its own.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="RESULT RELEASE FOR NEW ASSESSMENTS" hint="When staff can see their scores.">
            <Sel value={v.defaultResultRelease} onChange={x => setV(y => ({ ...y, defaultResultRelease: x }))} options={D.resultRelease.map(r => [r.key, r.label])} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
            <Field label="DEFAULT DEADLINE (DAYS)" hint="Deadline policy: days after the assessment opens."><input type="number" min={1} max={365} step={1} value={v.defaultDeadlineDays} onChange={num('defaultDeadlineDays')} style={INPUT} />{fieldErr(fields, 'defaultDeadlineDays')}</Field>
            <Field label="REMINDER (HOURS BEFORE)" hint="When the &quot;closes soon&quot; reminder is sent."><input type="number" min={1} max={336} step={1} value={v.reminderLeadHours} onChange={num('reminderLeadHours')} style={INPUT} />{fieldErr(fields, 'reminderLeadHours')}</Field>
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>Attempt limits and score thresholds are under <b>Scoring &amp; Attempts</b>.</div>
        </div>
      </Card>
    </div>
    <Confirm open={ask} title="Save these settings?" confirmText="Save settings" busy={busy} onCancel={() => setAsk(false)} onConfirm={save}
      text="The change is recorded in the audit log. Existing assessments and assignments keep their own settings.">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
        {diff.map(k => <div key={k}><b>{NAMES[k]}</b>: <span style={{ color: '#6b7280', textDecoration: 'line-through' }}>{show(k, D.settings[k])}</span> → {show(k, v[k])}</div>)}
      </div>
    </Confirm>
  </>);
}

// ===== SCORING · Form =====
// Saving always adds a new version; results already worked out keep the version they used.
const SCORE_FIELDS = [
  ['requiredLevel', 'Required proficiency level', 'Gap = this level − final average.', 0.01],
  ['competentFrom', 'Competent from', 'Final average at or above this is Competent.', 0.01],
  ['proficientFrom', 'Proficient from', 'Final average at or above this is Proficient.', 0.01],
  ['moderateGapFrom', 'Moderate Gap from', 'Below this is a Critical Gap.', 0.01],
  ['noGapFrom', 'No Gap from', 'At or above this there is no gap.', 0.01],
  ['defaultMaxAttempts', 'Default attempt limit', 'Attempts allowed unless an assessment or assignment sets its own.', 1],
];
const EXAMPLES = [1.5, 2.49, 2.5, 3.99, 4, 4.33, 4.99, 5];
function ScoringView({ toast }) {
  const L = useLoad('/api/settings/scoring');
  const [v, setV] = useState(null), [reason, setReason] = useState(''), [err, setErr] = useState(''), [ask, setAsk] = useState(false), [busy, setBusy] = useState(false);
  const D = L.data, active = D?.active;
  const fromRow = r => Object.fromEntries(SCORE_FIELDS.map(([k]) => [k, String(r[k])]));
  useEffect(() => { if (active) setV(fromRow(active)); }, [active]);
  const cfg = useMemo(() => (v ? Object.fromEntries(SCORE_FIELDS.map(([k]) => [k, v[k] === '' ? NaN : Number(v[k])])) : null), [v]);
  const problems = cfg ? validateConfig(cfg) : [];
  const same = cfg && active && SCORE_FIELDS.every(([k]) => cfg[k] === active[k]);
  const header = <PageHeader title="Settings" description="Competent, Proficient and gap thresholds, the required level and the default attempt limit." />;
  if (L.error) return <>{header}<LoadError L={L} /></>;
  if (!D || !v) return <>{header}<Card><Loading /></Card></>;
  const save = async () => {
    setBusy(true); setErr('');
    try { await api('POST', '/api/settings/scoring', { ...cfg, reason: reason.trim() }); await L.reload(); setReason(''); toast('New scoring version saved'); }
    catch (e) { setErr(e.message); } finally { setBusy(false); setAsk(false); }
  };
  const canSave = !problems.length && !same && reason.trim().length >= 5;
  const histCols = [
    { key: 'version', label: 'Version', render: r => <span style={{ display: 'flex', gap: '6px', alignItems: 'center' }}><b>v{r.version}</b>{r.id === active?.id ? <Badge bg="#dcfce7" fg="#15803d">In use</Badge> : null}</span> },
    { key: 'vals', label: 'Competent / Proficient', render: r => formatAverage(r.competentFrom) + ' / ' + formatAverage(r.proficientFrom) },
    { key: 'gaps', label: 'Moderate / No Gap from', render: r => formatAverage(r.moderateGapFrom) + ' / ' + formatAverage(r.noGapFrom) },
    { key: 'req', label: 'Required · attempts', render: r => formatAverage(r.requiredLevel) + ' · ' + r.defaultMaxAttempts },
    { key: 'reason', label: 'Reason', render: r => <span style={{ fontSize: '12.5px' }}>{r.reason}</span> },
    { key: 'by', label: 'Saved', render: r => <span style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{fmtDateTime(r.createdAt)}<br /><span style={{ color: '#6b7280' }}>{r.createdBy}</span></span> },
    { key: 'used', label: 'Used by', render: r => <span style={{ fontSize: '12.5px' }}>{r.results} results</span> },
    { key: 'act', label: '', render: r => (r.id === active?.id ? null : <Btn small kind="ghost" icon="icon-copy" onClick={() => { setV(fromRow(r)); setReason('Back to version ' + r.version + ' values'); window.scrollTo && window.scrollTo(0, 0); }}>Use these values</Btn>) },
  ];
  return (<>
    <PageHeader title="Settings" description="Competent, Proficient and gap thresholds, the required level and the default attempt limit." />
    <ErrorLine text={err} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: '20px', alignItems: 'start' }}>
      <Card title={'Thresholds · new version ' + (Math.max(0, ...D.history.map(h => h.version)) + 1)} sub={active ? 'Version ' + active.version + ' is in use, saved ' + fmtDateTime(active.createdAt) + ' by ' + active.createdBy + '.' : 'No configuration saved yet.'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '12px' }}>
            {SCORE_FIELDS.map(([k, label, hint, step]) => (
              <Field key={k} label={label.toUpperCase()} hint={hint}>
                <input type="number" step={step} min={step === 1 ? 1 : 0} max={step === 1 ? 10 : 5} value={v[k]} onChange={e => setV(x => ({ ...x, [k]: e.target.value }))}
                  style={{ ...INPUT, border: '1px solid ' + (active && Number(v[k]) !== active[k] ? '#15904c' : 'rgba(15,35,65,.14)') }} />
              </Field>))}
          </div>
          {problems.length ? <ErrorLine text={problems.join('. ') + '.'} /> : same ? <div style={{ fontSize: '12.5px', color: '#6b7280' }}>These are the values in use. Change at least one to save a new version.</div> : null}
          <Field label="REASON FOR THE CHANGE" hint="Required. Kept with the version and in the audit log."><textarea value={reason} onChange={e => setReason(e.target.value)} maxLength={500} rows={2} style={TEXTAREA} placeholder="e.g. Approved by the HR committee on 15 Oct 2026" /></Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Btn icon="icon-rotate-ccw" disabled={busy || same} onClick={() => setV(fromRow(active))}>Undo changes</Btn>
            <Btn kind="primary" icon="icon-check" disabled={busy || !canSave} title={!canSave && !problems.length && !same ? 'Give a reason first' : undefined} onClick={() => setAsk(true)}>Save as new version</Btn>
          </div>
        </div>
      </Card>
      {/* ===== SCORING · Example results ===== */}
      <Card title="How averages will be classified" sub="Examples with the values on the left (compared before rounding).">
        {problems.length ? <EmptyState icon="icon-sliders-horizontal" title="Fix the values first" text="The examples appear when the thresholds are valid." /> : (
          <DataTable minWidth={360} rows={EXAMPLES.map(a => ({ a }))} rowKey={r => r.a} columns={[
            { key: 'a', label: 'Final average', render: r => <span style={{ font: "600 13px 'JetBrains Mono',monospace" }}>{formatAverage(r.a)}</span> },
            { key: 'c', label: 'Competency', render: r => <CompetencyBadge status={competencyStatus(r.a, cfg)} /> },
            { key: 'g', label: 'Gap', render: r => <GapStatusBadge gap={gapStatus(r.a, cfg)} /> },
          ]} />)}
      </Card>
    </div>
    {/* ===== SCORING · History ===== */}
    <Card title="Version history" sub="Old versions are never changed, so earlier results and reports can be reproduced exactly." flush>
      <DataTable columns={histCols} rows={D.history} minWidth={980} rowKey={r => r.id} />
    </Card>
    <Confirm open={ask} title="Save new scoring version?" confirmText="Save new version" busy={busy} onCancel={() => setAsk(false)} onConfirm={save}
      text={'Results worked out from now on will use the new thresholds. Results already calculated keep version ' + (active?.version ?? '—') + ', so existing reports do not change. This is recorded in the audit log.'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '13px' }}>
        {SCORE_FIELDS.filter(([k]) => cfg[k] !== active?.[k]).map(([k, label]) => <div key={k}><b>{label}</b>: <span style={{ color: '#6b7280', textDecoration: 'line-through' }}>{active?.[k]}</span> → {cfg[k]}</div>)}
        <div style={{ color: '#6b7280' }}>Reason: {reason.trim()}</div>
      </div>
    </Confirm>
  </>);
}

// ===== TEMPLATES · List =====
const CHANNEL_L = { in_app: 'In-app', email: 'Email', sms: 'SMS' };
const fill = (text, vars) => String(text).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k]))); // same rule as lib/server/notify.js fill()
function TemplatesView({ toast }) {
  const L = useLoad('/api/settings/templates');
  const [q, setQ] = useState(''), [edit, setEdit] = useState(null);
  const D = L.data;
  const header = <PageHeader title="Settings" description="The wording of the notifications people receive. {Placeholders} are filled in when a notification is sent." />;
  if (L.error) return <>{header}<LoadError L={L} /></>;
  if (!D) return <>{header}<Card><Loading /></Card></>;
  const t = q.trim().toLowerCase();
  const rows = D.templates.filter(x => !t || (x.label + ' ' + x.key + ' ' + x.title + ' ' + x.body).toLowerCase().includes(t));
  const cols = [
    { key: 'label', label: 'Notification', render: r => <div><div style={{ fontWeight: 600 }}>{r.label}</div><div style={{ fontSize: '11.5px', color: '#6b7280', fontFamily: "'JetBrains Mono',monospace" }}>{r.key}</div></div> },
    { key: 'to', label: 'Sent to', render: r => <span style={{ fontSize: '12.5px' }}>{r.to || '—'}</span> },
    { key: 'text', label: 'Wording', render: r => <div style={{ maxWidth: '420px' }}><div style={{ fontWeight: 500 }}>{r.title}</div><div style={{ fontSize: '12.5px', color: '#6b7280' }}>{r.body}</div></div> },
    { key: 'ch', label: 'Channels', render: r => <span style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>{r.channels.map(c => <Badge key={c}>{CHANNEL_L[c] || c}</Badge>)}</span> },
    { key: 'act', label: '', render: r => <Btn small icon="icon-pencil" onClick={() => setEdit(r)}>Edit</Btn> },
  ];
  return (<>
    <PageHeader title="Settings" description="The wording of the notifications people receive. {Placeholders} are filled in when a notification is sent."
      filters={<><Search value={q} onChange={setQ} placeholder="Search notifications" />
        <span style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', fontSize: '12.5px', color: '#4b5563', alignItems: 'center' }}>Channels:
          {Object.entries(D.channels).map(([c, ok]) => <Badge key={c} bg={ok ? '#dcfce7' : '#f3f4f6'} fg={ok ? '#15803d' : '#6b7280'}>{CHANNEL_L[c]} · {c === 'in_app' ? 'always on' : ok ? 'configured' : 'not configured'}</Badge>)}</span></>} />
    <Card flush><DataTable columns={cols} rows={rows} minWidth={860} rowKey={r => r.key} empty={<EmptyState icon="icon-bell" title="No templates match" text="Try a different search." />} /></Card>
    {edit ? <TemplateEditor key={edit.key} T={edit} channels={D.channels} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); L.reload(); toast('Template saved'); }} /> : null}
  </>);
}

// ===== TEMPLATES · Editor =====
// Live preview fills the placeholders with example values. Email / SMS can only be ticked when configured.
function TemplateEditor({ T, channels, onClose, onSaved }) {
  const [v, setV] = useState({ title: T.title, body: T.body, channels: T.channels.includes('in_app') ? T.channels : ['in_app', ...T.channels] });
  const [err, setErr] = useState(''), [busy, setBusy] = useState(false), [focus, setFocus] = useState('body');
  const allowed = T.placeholders, used = [...new Set([...(v.title + ' ' + v.body).matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
  const unknown = allowed ? used.filter(p => !allowed.includes(p)) : [];
  const changed = v.title !== T.title || v.body !== T.body || v.channels.slice().sort().join() !== T.channels.slice().sort().join();
  const toggle = c => setV(x => ({ ...x, channels: x.channels.includes(c) ? x.channels.filter(y => y !== c) : [...x.channels, c] }));
  const save = async () => {
    setBusy(true); setErr('');
    try { await api('PUT', '/api/settings/templates/' + encodeURIComponent(T.key), v); onSaved(); }
    catch (e) { setErr(e.message); setBusy(false); }
  };
  return (
    <Drawer open title={'Edit: ' + T.label} sub={T.key + (T.to ? ' · sent to ' + T.to.toLowerCase() : '')} onClose={busy ? undefined : onClose} width={680}
      footer={<div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}><Btn onClick={onClose} disabled={busy}>Cancel</Btn><Btn kind="primary" icon="icon-check" onClick={save} disabled={busy || !changed || unknown.length > 0 || v.title.trim().length < 3 || v.body.trim().length < 3}>{busy ? 'Saving…' : 'Save template'}</Btn></div>}>
      <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <ErrorLine text={err} />
        <Field label="TITLE"><input value={v.title} maxLength={150} onFocus={() => setFocus('title')} onChange={e => setV(x => ({ ...x, title: e.target.value }))} style={INPUT} /></Field>
        <Field label="MESSAGE"><textarea value={v.body} maxLength={1000} rows={4} onFocus={() => setFocus('body')} onChange={e => setV(x => ({ ...x, body: e.target.value }))} style={TEXTAREA} /></Field>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>PLACEHOLDERS YOU CAN USE · CLICK TO ADD TO THE {focus === 'title' ? 'TITLE' : 'MESSAGE'}</div>
          {allowed ? <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>{allowed.map(p => (
            <button key={p} type="button" onClick={() => setV(x => ({ ...x, [focus]: x[focus] + (x[focus].endsWith(' ') || !x[focus] ? '' : ' ') + '{' + p + '}' }))} title={'Example: ' + T.examples[p]}
              style={{ border: '1px solid rgba(15,35,65,.14)', background: '#fff', borderRadius: '999px', padding: '3px 10px', cursor: 'pointer', font: "500 12px 'JetBrains Mono',monospace", color: '#127a42' }}>{'{' + p + '}'}</button>))}</div>
            : <div style={{ fontSize: '12.5px', color: '#6b7280' }}>No placeholder list is known for this notification; keep the existing ones.</div>}
          {unknown.length ? <ErrorLine text={'Not available here: ' + unknown.map(p => '{' + p + '}').join(', ') + '. Use only the placeholders listed.'} /> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>CHANNELS</div>
          <Toggle on label="In-app" desc="Always on: shown under the bell in the header" disabled />
          {['email', 'sms'].map(c => <Toggle key={c} on={v.channels.includes(c)} onClick={() => toggle(c)} disabled={!channels[c]} label={CHANNEL_L[c]} desc={channels[c] ? 'Configured on this server' : 'Not configured on this server (NOTIFY_' + c.toUpperCase() + ')'} />)}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280' }}>PREVIEW (EXAMPLE VALUES)</div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', border: '1px solid rgba(15,35,65,.1)', borderRadius: '14px', padding: '12px 14px', background: '#fff' }}>
            <i className="icon-bell-dot" style={{ fontSize: '18px', color: '#15904c', marginTop: '2px' }}></i>
            <div style={{ minWidth: 0 }}><div style={{ fontWeight: 600, fontSize: '13.5px', overflowWrap: 'anywhere' }}>{fill(v.title, T.examples) || '—'}</div><div style={{ fontSize: '12.5px', color: '#6b7280', marginTop: '3px', overflowWrap: 'anywhere' }}>{fill(v.body, T.examples) || '—'}</div></div>
          </div>
        </div>
      </div>
    </Drawer>
  );
}

// ===== AUDIT · Filters =====
const OUTCOME_C = { SUCCESS: ['#dcfce7', '#15803d'], FAILURE: ['#fee2e2', '#b91c1c'], DENIED: ['#fef3c7', '#92400e'] };
const OUTCOME_L = { SUCCESS: 'Success', FAILURE: 'Failed', DENIED: 'Denied' };
const AUDIT_SIZE = 50;
function AuditView({ me, toast }) {
  const [f, setF] = useState({ q: '', actor: '', action: 'All', entity: 'All', outcome: 'All', from: '', to: '' });
  const [q, setQ] = useState(''), [actor, setActor] = useState(''), [page, setPage] = useState(1), [open, setOpen] = useState(null), [exporting, setExporting] = useState(false);
  useEffect(() => { const t = setTimeout(() => { setF(x => ({ ...x, q, actor })); setPage(1); }, 300); return () => clearTimeout(t); }, [q, actor]);
  const set = k => v => { setF(x => ({ ...x, [k]: v && v.target ? v.target.value : v })); setPage(1); };
  const query = qs({ ...f, action: f.action === 'All' ? '' : f.action, entity: f.entity === 'All' ? '' : f.entity });
  const L = useLoad('/api/audit' + (query ? query + '&' : '?') + 'page=' + page + '&size=' + AUDIT_SIZE);
  const D = L.data, canExport = (me?.perms || []).includes('settings.audit-export');
  // Action groups ("ticket.", "settings.") plus every exact action seen.
  const actionOpts = useMemo(() => { const a = D?.actions || [], groups = [...new Set(a.map(x => x.split('.')[0] + '.'))]; return [['All', 'Every action'], ...groups.map(g => [g, g.slice(0, -1) + ' (all)']), ...a.map(x => [x, x])]; }, [D]);
  const exportCsv = async () => {
    setExporting(true);
    try {
      const r = await fetch('/api/audit/export' + query, { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) { let d = {}; try { d = await r.json(); } catch (e) {} throw new Error(d.error || 'The export failed.'); }
      download('audit-log-' + new Date().toISOString().slice(0, 10) + '.csv', await r.text(), 'text/csv');
      toast('Audit log exported');
    } catch (e) { toast(e.message); } finally { setExporting(false); }
  };
  const filters = (<>
    <Search value={q} onChange={setQ} placeholder="Search action, record, IP or person" />
    <Search value={actor} onChange={setActor} placeholder="Actor (name, username or “system”)" style={{ flex: '0 1 220px' }} />
    <Sel title="Action" value={f.action} onChange={set('action')} options={actionOpts} />
    <Sel title="Record type" value={f.entity} onChange={set('entity')} options={[['All', 'Every record type'], ...(D?.entities || []).map(e => [e, e])]} />
    <Sel title="Outcome" value={f.outcome} onChange={set('outcome')} options={[['All', 'Any outcome'], ...Object.entries(OUTCOME_L)]} />
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#4b5563' }}>From<input type="date" value={f.from} max={f.to || undefined} onChange={set('from')} style={INPUT} /></label>
    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#4b5563' }}>To<input type="date" value={f.to} min={f.from || undefined} onChange={set('to')} style={INPUT} /></label>
  </>);

  // ===== AUDIT · Table =====
  const cols = [
    { key: 'at', label: 'When', render: r => <span style={{ whiteSpace: 'nowrap' }}>{fmtDateTime(r.at)}</span> },
    { key: 'actor', label: 'Actor', render: r => (r.actor ? <div><div style={{ fontWeight: 500 }}>{r.actor.name}</div><div style={{ fontSize: '11.5px', color: '#6b7280' }}>{r.actor.username}</div></div> : <span style={{ color: '#6b7280' }}>System</span>) },
    { key: 'action', label: 'Action', render: r => <button type="button" onClick={() => setOpen(r)} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', color: '#127a42', font: "600 12.5px 'JetBrains Mono',monospace", textAlign: 'left' }}>{r.action}</button> },
    { key: 'entity', label: 'Record', render: r => (r.entityType ? r.entityType + (r.entityId ? ' #' + r.entityId : '') : '—') },
    { key: 'outcome', label: 'Outcome', render: r => <Badge bg={OUTCOME_C[r.outcome]?.[0]} fg={OUTCOME_C[r.outcome]?.[1]}>{OUTCOME_L[r.outcome] || r.outcome}</Badge> },
    { key: 'ip', label: 'IP address', render: r => <span style={{ fontSize: '12.5px', color: '#4b5563' }}>{r.ip || '—'}</span> },
    { key: 'd', label: '', render: r => <Btn small kind="ghost" icon="icon-eye" onClick={() => setOpen(r)}>Details</Btn> },
  ];
  const total = D?.total || 0, from = total ? (page - 1) * AUDIT_SIZE + 1 : 0, to = Math.min(total, page * AUDIT_SIZE);
  return (<>
    <PageHeader title="Settings" description="Sign-ins, changes and exports. Records can't be edited or deleted."
      actions={canExport ? <Btn icon="icon-download" onClick={exportCsv} disabled={exporting || !total}>{exporting ? 'Exporting…' : 'Export CSV'}</Btn> : null} filters={filters} />
    <Card flush>
      {L.error ? <div style={{ padding: '16px 20px' }}><ErrorLine text={L.error} /></div> : !D ? <Loading text="Loading the audit log…" /> :
        <DataTable columns={cols} rows={D.items} minWidth={900} rowKey={r => r.id} empty={<EmptyState icon="icon-scroll-text" title="No audit records match" text="Try a wider date range or fewer filters." />} />}
      {total ? (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px 20px', fontSize: '13px', color: '#6b7280', flexWrap: 'wrap' }}>
          <span>Showing {from}–{to} of {total.toLocaleString('en-GB')}</span>
          <span style={{ display: 'flex', gap: '8px' }}><Btn small icon="icon-chevron-left" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Btn><Btn small disabled={to >= total} onClick={() => setPage(p => p + 1)}>Next<i className="icon-chevron-right" style={{ fontSize: '13px' }}></i></Btn></span>
        </div>) : null}
    </Card>
    {open ? <AuditDetail r={open} onClose={() => setOpen(null)} /> : null}
  </>);
}

// ===== AUDIT · Detail drawer =====
// Before / after side by side, one line per field; changed fields are highlighted.
const show = v => (v === undefined ? '—' : v === null ? 'empty' : typeof v === 'object' ? JSON.stringify(v) : String(v));
function AuditDetail({ r, onClose }) {
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : x == null ? {} : { value: x });
  const b = obj(r.before), a = obj(r.after), keys = [...new Set([...Object.keys(b), ...Object.keys(a)])];
  return (
    <Drawer open title={r.action} sub={fmtDateTime(r.at) + ' · ' + (r.actor ? r.actor.name + ' (' + r.actor.username + ')' : 'System')} onClose={onClose} width={720}>
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: '10px 16px', fontSize: '13px' }}>
          {[['Record', r.entityType ? r.entityType + (r.entityId ? ' #' + r.entityId : '') : '—'], ['Outcome', OUTCOME_L[r.outcome] || r.outcome], ['IP address', r.ip || '—'], ['Entry', '#' + r.id]].map(([k, v]) => (
            <div key={k}><div style={{ font: '600 10.5px Inter,sans-serif', letterSpacing: '.4px', color: '#6b7280', textTransform: 'uppercase' }}>{k}</div><div style={{ marginTop: '3px' }}>{v}</div></div>))}
        </div>
        {keys.length ? (
          <DataTable minWidth={520} rows={keys.map(k => ({ k, b: b[k], a: a[k], changed: JSON.stringify(b[k]) !== JSON.stringify(a[k]) }))} rowKey={x => x.k} columns={[
            { key: 'k', label: 'Field', render: x => <span style={{ font: "600 12px 'JetBrains Mono',monospace" }}>{x.k}</span> },
            { key: 'b', label: 'Before', render: x => <span style={{ fontSize: '12.5px', color: '#6b7280', overflowWrap: 'anywhere' }}>{r.before == null ? '—' : show(x.b)}</span> },
            { key: 'a', label: 'After', render: x => <span style={{ fontSize: '12.5px', overflowWrap: 'anywhere', fontWeight: x.changed && r.before != null ? 600 : 400, background: x.changed && r.before != null ? '#fef9c3' : 'transparent', borderRadius: '4px', padding: '0 3px' }}>{r.after == null ? '—' : show(x.a)}</span> },
          ]} />) : <div style={{ fontSize: '13px', color: '#6b7280' }}>No before or after values were recorded for this entry.</div>}
      </div>
    </Drawer>
  );
}
