'use client';
// =============================================================================
// SMProfile.jsx · My Profile: my account and staff details, change password, my competency results and my
//   assessment history
// Screen / URL: /profile?tab=account|skills|history
// Who sees it: everyone signed in. Skill Profile and Assessment History only for accounts that take assessments
//   (administrators and creators without the Staff role see the Account tab only)
// Used by: SkillMatrixApp.jsx (page "profile")
// Depends on: smUI.jsx, smApi.js, SMStaffProfile.jsx (ProfileKpis, ResultsTable, DevelopmentList,
//   AssessmentHistory, InfoGrid), lib/passwordRules.js; GET /api/me, POST /api/auth/password
// Sections (search for these markers): MY PROFILE · Photo, MY PROFILE · Tabs, MY PROFILE · Screen,
//   MY PROFILE · Header card, MY PROFILE · Account tab, MY PROFILE · Change password, MY PROFILE · Skills tab,
//   MY PROFILE · History tab
// =============================================================================
import React, { useEffect, useState } from 'react';
import { Page, PageHeader, Card, Btn, Field, Badge, EmptyState, INPUT, avatarKey } from '@/components/shared/smUI';
import { useLoad, api, fmtDateTime } from '@/components/shared/smApi';
import { ProfileKpis, ResultsTable, DevelopmentList, AssessmentHistory, InfoGrid } from '@/components/analytics/SMStaffProfile';
import { PASSWORD_RULES, failedPasswordRules } from '@/lib/passwordRules';

// ===== MY PROFILE · Photo =====
// The photo is a per-browser convenience kept in localStorage (avatarKey); the header and Home read the same key.
function resizeImage(file, done) {
  if (!file || !file.type.startsWith('image/')) return;
  const rd = new FileReader();
  rd.onload = e => { const img = new Image(); img.onload = () => {
    const k = Math.min(1, 400 / Math.max(img.width, img.height)), c = document.createElement('canvas');
    c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    done(c.toDataURL('image/jpeg', 0.88)); }; img.src = e.target.result; };
  rd.readAsDataURL(file);
}
function usePhoto() {
  const [photo, setPhoto] = useState(null);
  useEffect(() => { try { setPhoto(localStorage.getItem(avatarKey())); } catch (e) {} }, []);
  const save = v => { try { if (v) localStorage.setItem(avatarKey(), v); else localStorage.removeItem(avatarKey()); window.dispatchEvent(new Event('skm-avatar-changed')); } catch (e) {} setPhoto(v); };
  return [photo, save];
}

// ===== MY PROFILE · Tabs =====
const TAB_LIST = [['account', 'Account', 'icon-user'], ['skills', 'Skill Profile', 'icon-chart-column'], ['history', 'Assessment History', 'icon-history']];
function Tabs({ items, active, onSelect }) {
  if (items.length < 2) return null;
  return <div role="tablist" style={{ background: 'rgba(118,118,128,.12)', borderRadius: '12px', padding: '4px', display: 'flex', gap: '6px', overflowX: 'auto' }}>
    {items.map(([k, l, i]) => { const on = k === active; return <button key={k} type="button" role="tab" aria-selected={on} onClick={() => !on && onSelect(k)}
      style={{ flex: 'none', display: 'flex', alignItems: 'center', gap: '9px', height: '36px', padding: '0 14px', border: 0, borderRadius: '7px', cursor: 'pointer', whiteSpace: 'nowrap', font: '500 14.5px Inter,sans-serif', color: on ? '#111827' : '#4b5563', background: on ? '#fff' : 'transparent', boxShadow: on ? '0 1px 2px rgba(0,0,0,.08)' : 'none' }}>
      <i className={i} style={{ fontSize: '16px' }}></i>{l}</button>; })}
  </div>;
}

// ===== MY PROFILE · Screen =====
export default function SMProfile({ me, tab, onTab, toast, go }) {
  const { data, error } = useLoad('/api/me');
  const [photo, setPhoto] = usePhoto();
  const participant = data ? data.participant : !!(me && me.staffId && (me.perms || []).includes('assessments.view'));
  const items = TAB_LIST.filter(([k]) => k === 'account' || participant);
  const active = items.some(([k]) => k === tab) ? tab : 'account';
  const select = k => (onTab ? onTab(k === 'account' ? undefined : k) : null);
  const p = data?.profile;
  return (
    <Page>
      <PageHeader title="My Profile" description="Your account, your staff record and your own results." />
      {/* ===== MY PROFILE · Header card ===== */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <label title="Change photo" style={{ position: 'relative', width: '72px', height: '72px', borderRadius: '50%', flex: 'none', cursor: 'pointer', overflow: 'hidden', background: photo ? '#fff' : 'linear-gradient(135deg,#054218,#15904c)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', font: '700 24px Inter,sans-serif', boxShadow: '0 4px 14px rgba(0,0,0,.15)' }}>
            {photo ? <img src={photo} alt="Your photo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (me?.name || '?').split(/\s+/).map(x => x[0]).slice(0, 2).join('').toUpperCase()}
            <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { resizeImage(e.target.files[0], v => { setPhoto(v); toast && toast('Photo updated'); }); e.target.value = ''; }} />
          </label>
          <div style={{ flex: '1 1 220px', minWidth: 0 }}>
            <div style={{ fontSize: '20px', fontWeight: 700 }}>{me?.name}</div>
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '2px' }}>{[me?.designation, me?.dept, me?.staffNo ? 'Staff ID ' + me.staffNo : null].filter(Boolean).join(' · ') || me?.email}</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>{(data?.account.roles || [me?.role]).filter(Boolean).map(r => <Badge key={r} bg="#e6f2ea" fg="#0d3b2a">{r}</Badge>)}</div>
          </div>
          {photo ? <Btn small kind="ghost" icon="icon-trash-2" onClick={() => { setPhoto(null); toast && toast('Photo removed'); }}>Remove photo</Btn> : null}
        </div>
      </Card>
      <Tabs items={items} active={active} onSelect={select} />
      {error ? <Card><EmptyState icon="icon-circle-alert" title="Your profile could not be loaded" text={error} /></Card>
        : !data ? <Card><EmptyState icon="icon-loader" title="Loading your profile…" /></Card>
        : active === 'account' ? <AccountTab data={data} toast={toast} />
        : active === 'skills' ? <SkillsTab p={p} go={go} />
        : <AssessmentHistory p={p} own />}
    </Page>
  );
}

// ===== MY PROFILE · Account tab =====
function AccountTab({ data, toast }) {
  const a = data.account, s = data.staff;
  return <>
    <Card title="Account"><InfoGrid items={[['Name', a.name], ['Username', a.username], ['Email', a.email], ['Roles', a.roles.join(', ')], ['Account status', a.status], ['Departments you can see', a.scope], ['Last sign-in', fmtDateTime(a.lastLoginAt)], ['Password last set', fmtDateTime(a.passwordSetAt)]]} /></Card>
    {s ? <Card title="Staff record" sub="Your organisational details. Ask an administrator if anything is wrong.">
      <InfoGrid items={[['Staff ID', s.staffNo], ['Department', s.department], ['Grade', s.grade], ['Station', s.station], ['Location', s.location], ['Designation', s.designation], ['Supervisor / HoD', s.supervisor]]} /></Card>
      : <Card title="Staff record"><div style={{ fontSize: '13.5px', color: '#4b5563' }}>This account is not linked to a staff record. Administrator accounts never take assessments, so there are no results or history here.</div></Card>}
    <OutlookSettingsCard data={data} toast={toast} />
    <PasswordCard toast={toast} />
  </>;
}

// ===== MY PROFILE · Outlook & Calendar Integration =====
function OutlookSettingsCard({ data, toast }) {
  const o = data.outlook || {};
  const [copiedManifest, setCopiedManifest] = useState(false);
  const [copiedFeed, setCopiedFeed] = useState(false);
  const [origin, setOrigin] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') setOrigin(window.location.origin);
  }, []);

  const fullManifestUrl = (origin || '') + (o.manifestUrl || '/api/outlook/manifest');
  const fullFeedUrl = (origin || '') + (o.feedUrl || '');

  const copyManifest = () => {
    navigator.clipboard.writeText(fullManifestUrl);
    setCopiedManifest(true);
    toast && toast('Outlook Add-in URL copied to clipboard');
    setTimeout(() => setCopiedManifest(false), 3000);
  };

  const copyFeed = () => {
    navigator.clipboard.writeText(fullFeedUrl);
    setCopiedFeed(true);
    toast && toast('Personal Calendar Subscription URL copied');
    setTimeout(() => setCopiedFeed(false), 3000);
  };

  return (
    <Card
      title="Outlook & Calendar Integration"
      sub="Synchronize assessment dates and receive deadline reminders directly in your official DVLA Outlook account (webmail.dvla.gov.gh)."
      actions={
        <a href={o.setupUrl || '/outlook'} style={{ textDecoration: 'none' }}>
          <Btn small kind="secondary" icon="icon-external-link">Open Setup Guide</Btn>
        </a>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Link 1: Outlook Add-in (URL & File) */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🧩</span>
              <span style={{ font: '600 13.5px Inter,sans-serif', color: '#0f172a' }}>
                1. DVLA Outlook Add-in (URL &amp; File)
              </span>
            </div>
            <Badge bg="#e6f2ea" fg="#0d3b2a">Outlook Webmail</Badge>
          </div>
          <div style={{ font: '400 12.5px Inter,sans-serif', color: '#64748b', marginBottom: '10px', lineHeight: 1.45 }}>
            Install the official add-in into <b>webmail.dvla.gov.gh</b> to view upcoming tests in your Outlook ribbon and add appointments with one click.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', marginBottom: '10px' }}>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullManifestUrl}
            </span>
            <Btn small kind="primary" icon="icon-copy" onClick={copyManifest}>
              {copiedManifest ? 'Copied!' : 'Copy URL'}
            </Btn>
            <a href={o.manifestFileUrl || '/outlook/manifest.xml'} download="manifest.xml" style={{ textDecoration: 'none' }}>
              <Btn small kind="secondary" icon="icon-download">Download XML</Btn>
            </a>
          </div>

          <div style={{ font: '400 11.5px Inter,sans-serif', color: '#64748b' }}>
            💡 <b>Installation in webmail.dvla.gov.gh:</b> Settings → Customize actions / Manage add-ins → <b>My add-ins</b> → <b>Custom add-ins</b> → <b>Add from URL</b> (paste copied link) or <b>Add from file</b>.
          </div>
        </div>

        {/* Link 2: Live Calendar Feed & Reminders */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '16px' }}>🔔</span>
              <span style={{ font: '600 13.5px Inter,sans-serif', color: '#0f172a' }}>
                2. Live Calendar Feed &amp; Reminders (Subscribe from web)
              </span>
            </div>
            <Badge bg="#e0f2fe" fg="#0369a1">24h &amp; 2h Alarms</Badge>
          </div>
          <div style={{ font: '400 12.5px Inter,sans-serif', color: '#64748b', marginBottom: '10px', lineHeight: 1.45 }}>
            Subscribe to your personal live test calendar. Whenever new assessments are assigned or deadlines extended, Outlook automatically updates with audio and popup reminder alerts.
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '6px 10px', marginBottom: '10px' }}>
            <span style={{ flex: 1, fontFamily: 'monospace', fontSize: '12px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {fullFeedUrl}
            </span>
            <Btn small kind="primary" icon="icon-copy" onClick={copyFeed}>
              {copiedFeed ? 'Copied!' : 'Copy Feed URL'}
            </Btn>
            {o.icsUrl && (
              <a href={o.icsUrl} download="dvla-tests.ics" style={{ textDecoration: 'none' }}>
                <Btn small kind="secondary" icon="icon-download">Download .ics</Btn>
              </a>
            )}
          </div>

          <div style={{ font: '400 11.5px Inter,sans-serif', color: '#64748b' }}>
            💡 <b>How to subscribe in webmail.dvla.gov.gh Calendar:</b> Switch to Calendar view → <b>Add calendar</b> → <b>Subscribe from web</b> → paste the copied Feed URL above.
          </div>
        </div>
      </div>
    </Card>
  );
}

// ===== MY PROFILE · Change password =====
// POST /api/auth/password { currentPassword, newPassword }. Other browsers signed in as you are signed out.
function PasswordCard({ toast }) {
  const [v, setV] = useState({ cur: '', np: '', np2: '' }), [busy, setBusy] = useState(false), [err, setErr] = useState('');
  const failed = failedPasswordRules(v.np, v.cur), mismatch = v.np2 && v.np !== v.np2;
  const ok = v.cur && v.np && !failed.length && v.np === v.np2;
  const submit = async e => {
    e.preventDefault(); if (!ok || busy) return;
    setBusy(true); setErr('');
    try { await api('POST', '/api/auth/password', { currentPassword: v.cur, newPassword: v.np }); setV({ cur: '', np: '', np2: '' }); toast && toast('Password changed. Other browsers were signed out.'); }
    catch (x) { setErr(x.message); } finally { setBusy(false); }
  };
  const inp = k => ({ type: 'password', value: v[k], autoComplete: k === 'cur' ? 'current-password' : 'new-password', onChange: e => setV({ ...v, [k]: e.target.value }), style: { ...INPUT, width: '100%' } });
  return (
    <Card title="Change password" sub="Use a password you don't use anywhere else.">
      <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: '16px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Field label="CURRENT PASSWORD"><input {...inp('cur')} /></Field>
          <Field label="NEW PASSWORD"><input {...inp('np')} /></Field>
          <Field label="CONFIRM NEW PASSWORD" hint={mismatch ? <span style={{ color: '#b91c1c' }}>The two new passwords don't match.</span> : null}><input {...inp('np2')} /></Field>
          {err ? <div role="alert" style={{ fontSize: '13px', color: '#b91c1c', background: '#fee2e2', borderRadius: '10px', padding: '8px 12px' }}>{err}</div> : null}
          <div><Btn kind="primary" type="submit" disabled={!ok || busy}>{busy ? 'Saving…' : 'Change password'}</Btn></div>
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: '12px 14px', borderRadius: '12px', background: 'rgba(15,35,65,.03)', display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px' }}>
          {PASSWORD_RULES.map(([label]) => { const pass = v.np && !failed.includes(label); const text = label === 'Different from your temporary password' ? 'Different from your current password' : label;
            return <li key={label} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: pass ? '#15803d' : '#4b5563' }}><i className={pass ? 'icon-circle-check' : 'icon-circle'} style={{ fontSize: '14px' }}></i>{text}</li>; })}
        </ul>
      </form>
    </Card>
  );
}

// ===== MY PROFILE · Skills tab =====
function SkillsTab({ p, go }) {
  if (!p) return <Card><EmptyState icon="icon-chart-column" title="No skill profile" text="Skill results are only kept for accounts that take assessments." /></Card>;
  return <>
    {p.pendingRelease ? <div style={{ fontSize: '13px', color: '#92400e', background: '#fef3c7', borderRadius: '12px', padding: '10px 14px' }}><i className="icon-clock" style={{ marginRight: '6px' }}></i>{p.pendingRelease} completed assessment{p.pendingRelease === 1 ? ' is' : 's are'} waiting for results to be released.</div> : null}
    <ProfileKpis p={p} />
    {p.results.length ? <Card title="Development priorities" sub="Critical Gaps first, then Moderate Gaps"><DevelopmentList results={p.results} /></Card> : null}
    <Card title="My competency results" sub="Final average = the average of all your completed attempts · Competent from 4.00 · Proficient at 5.00" flush>
      <ResultsTable results={p.results} empty={<EmptyState icon="icon-chart-column" title="No results yet" text="Complete an assigned assessment to see your results here." action={<Btn kind="primary" onClick={() => go('assessments')}>Go to My Assessments</Btn>} />} />
    </Card>
  </>;
}
