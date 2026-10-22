'use client';
// =============================================================================
// SMHome.jsx · The Home page design: welcome banner with the DVLA head-office photo, the facts row, the green-to-gold
//   assessment strip, the KPI cards, Priority Skill Gaps, Quick Actions and the assessment calendar, all filled from
//   live records (nothing made up)
// Screen / URL: Home, "/" and "/home"
// Who sees it: everyone gets the welcome banner and facts row (WelcomeCard). People who take assessments also get the
//   rest (PersonalHome); administrators get no assessment strip.
// Used by: components/SMDashboard.jsx (which adds the team / organisation / content / ticket sections below)
// Depends on: smUI (avatarKey, GapStatusBadge), SMHome.module.css,
//   lib/scoring.js (gap colours, importance colours, thresholds), GET /api/dashboard "me" section (from SMDashboard)
// Sections (search for these markers): HOME · Constants, HOME · Profile photo, HOME · Welcome banner, HOME · Facts row,
//   HOME · Current assessment, HOME · Assessment strip, HOME · KPI cards, HOME · Priority skill gaps, HOME · Quick actions,
//   HOME · Side panel, HOME · Calendar, HOME · Today, HOME · Timeline, HOME · Personal home layout
// Same look as the original Home (54ae253 SMHome.jsx). The assessment strip follows the person's real assignments:
//   in progress → Resume · open → Start · opens later → when · completed → submitted, and when results are released ·
//   nothing assigned → a calm notice.
// =============================================================================
import React, { useEffect, useState } from 'react';
import __css from './SMHome.module.css';
import { avatarKey, GapStatusBadge } from '@/components/shared/smUI';
import { GAP_COLOURS, GAP_LABEL, IMPORTANCE, competencyStatus, formatAverage, COMPETENCY_LABEL, DEFAULT_CONFIG } from '@/lib/scoring';

// ===== HOME · Constants =====
const GLASS = { background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', border: '1px solid rgba(255,255,255,.85)', borderRadius: '22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,.9),0 10px 30px rgba(15,35,65,.07)' };
const KICK = { font: '600 10.5px Inter,sans-serif', letterSpacing: '.6px', color: '#6b7280' };
const VIEW_BTN = { alignSelf: 'flex-start', marginTop: 'auto', height: '28px', padding: '0 14px', border: '0', borderRadius: '999px', background: 'linear-gradient(180deg,#2fb36b,#15904c)', boxShadow: '0 6px 16px rgba(21,144,76,.32),inset 0 1px 0 rgba(255,255,255,.35)', color: '#fff', font: '600 12px Inter,sans-serif', cursor: 'pointer' };
const dayLabel = d => (d ? new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : '—');
const timeLabel = d => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const initials = n => String(n || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const useVw = () => { const [w, setW] = useState(1440); useEffect(() => { const f = () => setW(window.innerWidth); f(); window.addEventListener('resize', f); return () => window.removeEventListener('resize', f); }, []); return w; };

// ===== HOME · Profile photo =====
// Read from localStorage (avatarKey()); refreshed when My Profile fires 'skm-avatar-changed' or another tab changes it.
function useAvatar() {
  const [av, setAv] = useState(null);
  useEffect(() => {
    const read = () => { try { setAv(localStorage.getItem(avatarKey()) || null); } catch (e) {} };
    read(); window.addEventListener('skm-avatar-changed', read); window.addEventListener('storage', read);
    return () => { window.removeEventListener('skm-avatar-changed', read); window.removeEventListener('storage', read); };
  }, []);
  return av;
}

// ===== HOME · Current assessment =====
// The one assessment the strip, facts row and quick action talk about: in progress, else open (earliest deadline),
// else opening later (soonest), else the most recently finished one. null when nothing is assigned.
export function currentAssessment(list) {
  const by = (s, k) => (list || []).filter(a => a.status === s).sort((a, b) => new Date(a[k]) - new Date(b[k]))[0];
  return by('IN_PROGRESS', 'deadline') || by('NOT_STARTED', 'deadline') || by('UPCOMING', 'startsAt') || (list || []).filter(a => a.status === 'COMPLETED').sort((a, b) => new Date(b.deadline) - new Date(a.deadline))[0] || by('OVERDUE', 'deadline') || null;
}
const releaseText = a => (a.released ? 'Your results are ready.' : a.resultRelease === 'AFTER_DEADLINE' ? 'Results are released after the deadline, ' + dayLabel(a.deadline) + '.' : a.resultRelease === 'MANUAL' ? 'Results are released when an administrator releases them.' : 'Your results are ready.');
// Strip text, colour and button for each state (the gradients are the original Home's).
function stripFor(a, go) {
  const tries = a ? a.maxAttempts + ' attempt' + (a.maxAttempts === 1 ? '' : 's') : '';
  if (!a) return { chip: 'ALL CLEAR', icon: 'icon-calendar-check', title: 'No assessment open right now.', text: 'When an assessment is assigned to you it will appear here with its deadline.', cta: 'My Assessments', bg: 'linear-gradient(110deg,#0b4a2e 0%,#15904c 50%,#9a7a45 100%)', kicker: 'NOTHING ASSIGNED', sub: 'Your cycles, results and reports', act: () => go('assessments') };
  if (a.status === 'IN_PROGRESS') return { chip: 'IN PROGRESS', icon: 'icon-alarm-clock', title: 'You have started ' + a.title + '.', text: 'Your answers are saved as you go. Carry on and submit before ' + dayLabel(a.deadline) + ', ' + timeLabel(a.deadline) + '.', cta: 'Resume Assessment', bg: 'linear-gradient(90deg,#7f1d1d 0%,#9f2d20 60%,#c2410c 100%)', kicker: 'IN PROGRESS · DUE ' + dayLabel(a.deadline).toUpperCase(), sub: a.used + ' of ' + a.maxAttempts + ' attempts used', act: () => go('take', undefined, a.id) };
  if (a.status === 'NOT_STARTED') return { chip: 'OPEN', icon: 'icon-timer', title: 'Your ' + a.title + ' is open.', text: 'Complete it before ' + dayLabel(a.deadline) + ', ' + timeLabel(a.deadline) + '. You have ' + tries + '; your answers are saved as you go.', cta: 'Start Assessment', bg: 'linear-gradient(90deg,#0d3b2a 0%,#145a3c 55%,#9a7a45 100%)', kicker: 'OPEN · DUE ' + dayLabel(a.deadline).toUpperCase(), sub: tries + ' · no time limit', act: () => go('take', undefined, a.id) };
  if (a.status === 'UPCOMING') return { chip: 'SOON', icon: 'icon-calendar-clock', title: a.title + ' opens ' + dayLabel(a.startsAt) + '.', text: 'It stays open until ' + dayLabel(a.deadline) + '. You will have ' + tries + '.', cta: 'My Assessments', bg: 'linear-gradient(90deg,#0d3b2a 0%,#145a3c 55%,#9a7a45 100%)', kicker: 'OPENS ' + dayLabel(a.startsAt).toUpperCase(), sub: 'Due ' + dayLabel(a.deadline), act: () => go('assessments') };
  if (a.status === 'OVERDUE') return { chip: 'OVERDUE', icon: 'icon-clock-alert', title: 'The deadline for ' + a.title + ' has passed.', text: 'Ask your supervisor for an extension, or raise a support ticket.', cta: 'My Assessments', bg: 'linear-gradient(90deg,#7f1d1d 0%,#9f2d20 60%,#c2410c 100%)', kicker: 'OVERDUE', sub: 'Deadline was ' + dayLabel(a.deadline), act: () => go('assessments') };
  return { chip: 'DONE', icon: 'icon-circle-check', title: 'Assessment submitted. Thank you.', text: a.title + ' is complete. ' + releaseText(a), cta: a.released ? 'View Results' : 'My Assessments', bg: 'linear-gradient(110deg,#0b4a2e 0%,#15904c 42%,#b8901f 82%,#f2c14e 100%)', kicker: 'SUBMITTED · ' + (a.released ? 'RESULTS READY' : 'RESULTS PENDING'), sub: a.released ? 'Results are ready' : releaseText(a), act: () => (a.released ? go('profile', 'skills') : go('assessments')) };
}

// ===== HOME · Welcome banner =====
// me: the signed-in person (/api/auth/me). staff: their staff record from the dashboard (when they have one).
// current: their current assessment (facts row "Assessment day"), or null.
export function WelcomeCard({ me, staff, current, go }) {
  const vw = useVw(), avatar = useAvatar(), wide = vw >= 760;
  const name = (staff && staff.name) || (me && me.name) || '';
  const place = [staff?.station || me?.station, staff?.location || me?.location].filter(Boolean);
  const chip = (place.length ? (place[0] === place[1] ? [place[0]] : place) : ['DVLA']).join(' · ').toUpperCase();
  return (
    <div style={{ ...GLASS, overflow: 'hidden' }}>
      <div style={{ position: 'relative', minHeight: '180px', background: '#0d3b2a', display: 'flex' }}>
        {wide ? <div style={{ position: 'absolute', inset: '0', background: 'linear-gradient(90deg, rgba(21,144,76,0) 22%, rgba(21,144,76,0.2) 46%, rgba(21,144,76,0.1) 62%, rgba(21,144,76,0) 80%)', pointerEvents: 'none' }} /> : null}
        {/* ===== HOME · Welcome banner · Photo, name & email ===== */}
        <div style={{ position: 'relative', zIndex: '1', flex: '1', padding: '18px clamp(16px,2.4vw,28px) 22px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', margin: '4px 0 0 clamp(0px,2.5vw,32px)' }}>
            <div onClick={() => go('profile')} title="View profile / change photo" style={{ width: '72px', height: '72px', borderRadius: '50%', border: '3px solid #fff', flex: 'none', background: avatar ? 'transparent' : 'linear-gradient(135deg,#0d3b2a 0%,#15904c 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', font: '700 22px Inter,sans-serif', color: '#fff', overflow: 'hidden', boxShadow: '0 4px 14px rgba(0,0,0,.25)', cursor: 'pointer' }}>
              {avatar ? <img src={avatar} alt="Profile" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} /> : initials(name)}
            </div>
            <div style={{ color: '#fff', minWidth: '0', flex: '1 1 auto' }}>
              <div style={{ fontSize: '14.5px', fontWeight: '500' }}>Welcome back,</div>
              <div style={{ fontSize: 'clamp(18px,2vw,22px)', fontWeight: '700', letterSpacing: '-0.2px', marginTop: '2px', textTransform: 'uppercase' }}>{name}</div>
              <div style={{ fontSize: '13px', color: '#d6e9de', marginTop: '3px', overflowWrap: 'break-word' }}>{staff?.email || me?.email}</div>
              <button type="button" onClick={() => go('profile', me?.roles && me.roles.includes('ADMIN') && !staff ? undefined : 'skills')} style={{ marginTop: '6px', background: 'none', border: '0', padding: '0', color: '#fff', font: '600 10px Inter,sans-serif', textDecoration: 'underline', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}>{staff ? 'View Skill Profile' : 'View Profile'}<i className="icon-chevron-right" style={{ fontSize: '11px' }}></i></button>
            </div>
          </div>
        </div>
        {/* ===== HOME · Welcome banner · DVLA head office photo (wide screens only) ===== */}
        {wide ? (
          <div style={{ position: 'absolute', right: '0', top: '0', bottom: '0', width: '58%', backgroundImage: "url('/assets/dvla-head-office.jpg')", backgroundSize: 'cover', backgroundPosition: 'center 38%', backgroundRepeat: 'no-repeat',
            WebkitMaskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 18%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.92) 62%, #000 80%)', maskImage: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.15) 18%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.92) 62%, #000 80%)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', padding: '0 20px 14px 0', pointerEvents: 'none' }}>
            <div style={{ position: 'absolute', inset: '0', background: 'linear-gradient(135deg, rgba(13,59,42,0.4) 0%, rgba(13,59,42,0.1) 40%, rgba(13,59,42,0.3) 100%)', pointerEvents: 'none' }} />
            <div style={{ position: 'relative', zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(13, 59, 42, 0.85)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '6px', padding: '3px 9px', fontSize: '10.5px', fontFamily: "'JetBrains Mono', monospace", fontWeight: '600', color: '#e1f0e7', letterSpacing: '0.4px', boxShadow: '0 2px 8px rgba(0,0,0,0.3)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2fb36b', display: 'inline-block' }}></span>{chip}
            </div>
          </div>) : null}
      </div>
      {/* ===== HOME · Facts row (Staff ID, Department, Designation, Assessment day) ===== */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: '18px', padding: '22px 22px 24px' }}>
        <div><div style={KICK}>STAFF ID</div><div style={{ font: "600 17px 'JetBrains Mono',monospace", marginTop: '9px', color: '#111827' }}>{staff?.staffNo || me?.staffNo || '—'}</div><div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>{(staff?.station || me?.station || '').toUpperCase() || '—'}</div></div>
        <div><div style={KICK}>DEPARTMENT</div><div style={{ fontSize: '18px', fontWeight: '600', marginTop: '6px', textTransform: 'uppercase' }}>{staff?.department || me?.dept || '—'}</div><div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>{staff?.supervisor ? 'Supervisor: ' + staff.supervisor : '—'}</div></div>
        <div><div style={KICK}>DESIGNATION</div><div style={{ fontSize: '18px', fontWeight: '600', marginTop: '6px', textTransform: 'uppercase' }}>{staff?.designation || me?.designation || me?.role || '—'}</div><div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>{staff?.grade || me?.grade ? 'Grade: ' + (staff?.grade || me?.grade) : '—'}</div></div>
        <div><div style={KICK}>ASSESSMENT DAY</div><div style={{ fontSize: '18px', fontWeight: '600', marginTop: '6px' }}>{current ? (current.status === 'UPCOMING' ? dayLabel(current.startsAt) : dayLabel(current.deadline)) : '—'}</div>
          <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px' }}>{current ? (current.status === 'UPCOMING' ? 'Opens · due ' + dayLabel(current.deadline) : 'Deadline ' + timeLabel(current.deadline)) + ' · ' + current.maxAttempts + ' attempt' + (current.maxAttempts === 1 ? '' : 's') : 'No assessment open'}</div></div>
      </div>
    </div>
  );
}

// ===== HOME · Personal home layout =====
// m: the dashboard "me" section. The main column holds the strip, KPI cards, gaps and quick actions; the side panel the
// calendar. `children` (recent activity etc.) goes at the end of the main column.
export default function PersonalHome({ me, m, go, children }) {
  const vw = useVw();
  const cfg = m.config || DEFAULT_CONFIG;
  const current = currentAssessment(m.assessments);
  const B = stripFor(current, go);
  const c = m.counts || {};
  const assessed = c.assessed || 0, total = Math.max(m.measured || 0, assessed);
  const open = (c.critical || 0) + (c.moderate || 0);
  const worst = [...m.results].sort((a, b) => (b.gap ?? 0) - (a.gap ?? 0))[0];
  // Ranked like Development Priorities: Critical before Moderate, then the more important skill, then the lower average.
  const rank = { CRITICAL: 0, MODERATE: 1, NONE: 2 };
  const top = m.results.filter(r => r.gapStatus !== 'NONE').sort((a, b) => rank[a.gapStatus] - rank[b.gapStatus] || (b.competency.importance || 0) - (a.competency.importance || 0) || a.average - b.average).slice(0, 5);
  const segs = [['CRITICAL', c.critical], ['MODERATE', c.moderate], ['NONE', c.none]].filter(([, n]) => n);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '22px', alignItems: 'flex-start' }}>
      <div style={{ flex: '1 1 620px', minWidth: '0', display: 'flex', flexDirection: 'column', gap: '18px' }}>
        <WelcomeCard me={me} staff={m.staff} current={current} go={go} />
        {/* ===== HOME · Assessment strip (green to gold) ===== */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', padding: '14px 20px 14px 18px', borderRadius: '12px', background: B.bg, color: '#fff' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '9px', background: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className={B.icon} style={{ fontSize: '20px' }}></i></div>
          <div style={{ flex: '1 1 320px', minWidth: '0' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
              <span style={{ font: '700 10px Inter,sans-serif', background: 'rgba(255,255,255,.92)', color: '#0d3b2a', borderRadius: '999px', padding: '2px 8px' }}>{B.chip}</span>
              <span style={{ fontSize: '15px', fontWeight: '600' }}>{B.title}</span>
            </div>
            <div style={{ fontSize: '13px', color: '#e1f0e7', marginTop: '4px', textWrap: 'pretty' }}>{B.text}{m.pendingRelease && current && current.status !== 'COMPLETED' ? ' ' + m.pendingRelease + ' finished assessment' + (m.pendingRelease === 1 ? ' is' : 's are') + ' waiting for results to be released.' : ''}</div>
          </div>
          <button type="button" onClick={B.act} style={{ display: 'flex', alignItems: 'center', gap: '8px', height: '34px', padding: '0 16px', border: '0', borderRadius: '999px', background: '#fff', color: '#0d3b2a', font: '600 13.5px Inter,sans-serif', cursor: 'pointer', whiteSpace: 'nowrap' }}>{B.cta}<i className="icon-arrow-right" style={{ fontSize: '15px' }}></i></button>
        </div>
        {/* ===== HOME · KPI cards ===== */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '12px' }}>
          <div style={{ ...GLASS, padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13.5px', color: '#374151' }}>Competencies Assessed</div>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>{assessed} of {total}</div>
            <button type="button" onClick={() => go('profile', 'skills')} style={VIEW_BTN}>View</button>
          </div>
          <div style={{ ...GLASS, padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '13.5px', color: '#374151' }}>Average Score</div>
            <div style={{ fontSize: '15px', fontWeight: '700' }}>{assessed ? formatAverage(c.overall) + ' / 5' : '—'} <span style={{ fontWeight: '500', color: '#6b7280', fontSize: '13px' }}>· {assessed ? COMPETENCY_LABEL[competencyStatus(c.overall, cfg)] : 'No results yet'}</span></div>
            <button type="button" onClick={() => go('profile', 'skills')} style={VIEW_BTN}>View</button>
          </div>
          <div style={{ ...GLASS, gridColumn: 'span ' + (vw >= 1280 ? 2 : 1), padding: '20px 18px 18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontSize: '13.5px', color: '#374151' }}>Skill Gaps <span style={{ color: '#9ca3af' }}>(Required − Final average)</span></div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div><div style={{ ...KICK, fontSize: '9.5px', letterSpacing: '.5px' }}>OPEN GAPS</div><div style={{ fontSize: '19px', fontWeight: '700', marginTop: '4px' }}>{open} of {assessed}</div></div>
              <div><div style={{ ...KICK, fontSize: '9.5px', letterSpacing: '.5px' }}>LARGEST GAP</div><div style={{ fontSize: '19px', fontWeight: '700', marginTop: '4px' }}>{worst && worst.gapStatus !== 'NONE' ? formatAverage(worst.gap) + ' · ' + GAP_LABEL[worst.gapStatus].replace(' Gap', '') : assessed ? 'None' : '—'}</div></div>
            </div>
            <div style={{ display: 'flex', height: '8px', borderRadius: '999px', overflow: 'hidden', marginTop: '6px', gap: '2px', background: segs.length ? 'transparent' : '#eef0f3' }}>
              {segs.map(([k, n]) => <div key={k} title={GAP_LABEL[k] + ': ' + n} style={{ flex: n, background: GAP_COLOURS[k][1] }}></div>)}
            </div>
            <button type="button" onClick={() => go('profile', 'skills')} style={{ ...VIEW_BTN, marginTop: '8px' }}>View</button>
          </div>
        </div>
        {/* ===== HOME · Priority gaps + Quick actions row ===== */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', alignItems: 'flex-start' }}>
          {/* ===== HOME · Priority skill gaps ===== */}
          <div style={{ flex: '1.6 1 420px', minWidth: '0', ...GLASS }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', padding: '18px 18px 12px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
              <div><div style={{ fontSize: '16.5px', fontWeight: '600' }}>Priority Skill Gaps</div><div style={{ fontSize: '13px', color: '#6b7280', marginTop: '5px' }}>Critical gaps first, then how important the skill is to your role</div></div>
              <button type="button" onClick={() => go('profile', 'skills')} style={{ background: 'none', border: '0', cursor: 'pointer', font: '500 13.5px Inter,sans-serif', color: '#127a42', marginTop: '4px', whiteSpace: 'nowrap' }}>See all</button>
            </div>
            {!top.length ? <div style={{ padding: '22px 18px', fontSize: '13px', color: '#6b7280' }}>{assessed ? 'No gaps: every competency has reached the required level.' : 'Your gaps appear here once you complete an assessment and the results are released.'}</div> : (
              <div style={{ overflowX: 'auto' }}>
                <div style={{ minWidth: '540px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 104px 118px', gap: '12px', padding: '10px 18px', font: '600 10px Inter,sans-serif', letterSpacing: '.5px', color: '#6b7280', borderBottom: '1px solid rgba(15,35,65,.07)' }}><span>COMPETENCY</span><span>IMPORTANCE</span><span>REQUIRED → AVERAGE</span><span>GAP</span></div>
                  {top.map(r => { const imp = IMPORTANCE[r.competency.importance]; return (
                    <div key={r.competency.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 150px 104px 118px', gap: '12px', alignItems: 'center', padding: '12px 18px', borderBottom: '1px solid rgba(15,35,65,.07)' }}>
                      <div style={{ minWidth: '0' }}><div style={{ fontSize: '14px', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.competency.name}</div><div style={{ fontSize: '12px', color: '#6b7280', marginTop: '2px' }}>{r.competency.category || ''}</div></div>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151' }}>{imp ? <><span style={{ width: '8px', height: '8px', borderRadius: '2px', background: imp.bg, flex: 'none' }}></span>{imp.n} · {imp.label}</> : '—'}</span>
                      <span style={{ font: "600 13px 'JetBrains Mono',monospace", color: '#111827' }}>{formatAverage(r.competency.requiredLevel ?? cfg.requiredLevel)} → {r.display}</span>
                      <span style={{ justifySelf: 'start' }}><GapStatusBadge gap={r.gapStatus} /></span>
                    </div>); })}
                </div>
              </div>)}
          </div>
          {/* ===== HOME · Quick actions ===== */}
          <div style={{ flex: '1 1 280px', minWidth: '0' }}>
            <div style={{ fontSize: '16.5px', fontWeight: '600', margin: '0 0 12px' }}>Quick Actions</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button type="button" className={__css.h0} onClick={B.act} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderRadius: '12px', border: '0', background: 'linear-gradient(120deg,#0d3b2a,#17603f)', color: '#fff', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ width: '42px', height: '42px', borderRadius: '12px', background: 'rgba(255,255,255,.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className="icon-timer" style={{ fontSize: '19px' }}></i></span>
                <span style={{ flex: '1', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span style={{ font: '700 9px Inter,sans-serif', letterSpacing: '.6px', color: '#b9d8c6' }}>{B.kicker}</span>
                  <span style={{ font: '600 14px Inter,sans-serif', marginTop: '2px' }}>{B.cta}</span>
                  <span style={{ font: '400 11.5px Inter,sans-serif', color: '#cfe6d8', marginTop: '3px' }}>{B.sub}</span>
                </span>
                <i className="icon-arrow-right" style={{ fontSize: '17px' }}></i>
              </button>
              {[{ icon: 'icon-clipboard-list', title: 'My Assessments', sub: 'Your assessments, attempts and results', on: () => go('assessments') }, { icon: 'icon-radar', title: 'Skill Profile', sub: 'Required level vs your average for each competency', on: () => go('profile', 'skills') }].map(q => (
                <button key={q.title} type="button" className={__css.h1} onClick={q.on} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 18px', borderRadius: '18px', background: 'rgba(255,255,255,.62)', backdropFilter: 'blur(20px) saturate(180%)', WebkitBackdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255,255,255,.85)', cursor: 'pointer', textAlign: 'left' }}>
                  <span style={{ width: '38px', height: '38px', borderRadius: '9px', background: '#e6f2ea', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none', color: '#0d3b2a' }}><i className={q.icon} style={{ fontSize: '17px' }}></i></span>
                  <span style={{ flex: '1', display: 'flex', flexDirection: 'column' }}><span style={{ font: '600 14px Inter,sans-serif', color: '#111827' }}>{q.title}</span><span style={{ font: '400 11.5px Inter,sans-serif', color: '#6b7280', marginTop: '3px' }}>{q.sub}</span></span>
                  <i className="icon-chevron-right" style={{ fontSize: '16px', color: '#9ca3af' }}></i>
                </button>))}
            </div>
          </div>
        </div>
        {children}
      </div>
      <SidePanel m={m} current={current} go={go} wide={vw >= 1280} />
    </div>
  );
}

// ===== HOME · Side panel =====
// Calendar of the person's assignments: deadlines filled dark green with an orange dot, opening days and result
// release days with a dark dot. Today lists what is open now; the timeline follows the current assessment.
function SidePanel({ m, current, go, wide }) {
  const now = new Date();
  const [ym, setYm] = useState(() => { const d = current ? new Date(current.status === 'UPCOMING' ? current.startsAt : current.deadline) : now; return [d.getFullYear(), d.getMonth()]; });
  const list = m.assessments.filter(a => a.deadline);
  const same = (d, y, mo, dd) => { if (!d) return false; const x = new Date(d); return x.getFullYear() === y && x.getMonth() === mo && x.getDate() === dd; };
  const releaseDay = a => (a.resultsReleasedAt ? a.resultsReleasedAt : a.resultRelease === 'AFTER_DEADLINE' ? a.deadline : null);
  // ===== HOME · Calendar =====
  const first = new Date(ym[0], ym[1], 1).getDay(), dim = new Date(ym[0], ym[1] + 1, 0).getDate(), days = [];
  for (let i = 0; i < first; i++) days.push(null);
  for (let dd = 1; dd <= dim; dd++) {
    const due = list.filter(a => same(a.deadline, ym[0], ym[1], dd)), opens = list.filter(a => same(a.startsAt, ym[0], ym[1], dd)), rel = list.filter(a => same(releaseDay(a), ym[0], ym[1], dd));
    const today = same(now, ym[0], ym[1], dd);
    days.push({ dd, due: due.length > 0, other: opens.length + rel.length > 0, today, title: [...due.map(a => 'Deadline: ' + a.title), ...opens.map(a => 'Opens: ' + a.title), ...rel.map(a => 'Results: ' + a.title)].join('\n') });
  }
  const shift = k => () => setYm(([y, mo]) => { let n = mo + k, yy = y; if (n < 0) { n = 11; yy--; } if (n > 11) { n = 0; yy++; } return [yy, n]; });
  // ===== HOME · Today =====
  const openNow = list.filter(a => new Date(a.startsAt) <= now && new Date(a.deadline) >= now && ['NOT_STARTED', 'IN_PROGRESS'].includes(a.status));
  // ===== HOME · Timeline =====
  const timeline = current ? [
    { name: 'OPENS', when: dayLabel(current.startsAt), ring: '#111827', fill: new Date(current.startsAt) <= now ? '#111827' : '#fff' },
    { name: 'DEADLINE', when: dayLabel(current.deadline), ring: '#ea7a12', fill: current.status === 'COMPLETED' ? '#ea7a12' : '#fff' },
    { name: 'RESULTS RELEASED', when: current.status === 'COMPLETED' && current.released ? 'Released' : current.resultRelease === 'AFTER_DEADLINE' ? dayLabel(current.deadline) : current.resultRelease === 'MANUAL' ? 'When released' : 'On completion', ring: '#111827', fill: current.status === 'COMPLETED' && current.released ? '#111827' : '#fff' },
  ] : [];
  return (
    <aside className={wide ? __css.stickyAside : undefined} style={{ flex: '1 1 320px', maxWidth: wide ? '380px' : 'none', ...GLASS, padding: '28px 18px 24px', alignSelf: 'flex-start' }}>
      <button type="button" onClick={() => go('assessments')} style={{ background: 'none', border: '0', padding: '0', cursor: 'pointer', font: '500 13px Inter,sans-serif', color: '#127a42' }}>Full Assessment Calendar</button>
      <div style={{ display: 'flex', gap: '16px', marginTop: '14px', fontSize: '11.5px', color: '#4b5563' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#ea7a12' }}></span>Deadline</span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#111827' }}></span>Opens / results</span>
      </div>
      <div style={{ marginTop: '20px', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px 16px 22px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '17px', color: '#1f2937' }}>{new Date(ym[0], ym[1], 1).toLocaleString('en', { month: 'long', year: 'numeric' })}</span>
          <div style={{ display: 'flex', alignItems: 'center', background: '#f3f4f6', borderRadius: '999px' }}>
            <button type="button" onClick={shift(-1)} aria-label="Previous month" style={{ background: 'none', border: '0', cursor: 'pointer', padding: '3px 5px', display: 'flex', color: '#374151' }}><i className="icon-chevron-left" style={{ fontSize: '16px' }}></i></button>
            <span style={{ width: '1px', height: '12px', background: '#d1d5db' }}></span>
            <button type="button" onClick={shift(1)} aria-label="Next month" style={{ background: 'none', border: '0', cursor: 'pointer', padding: '3px 5px', display: 'flex', color: '#374151' }}><i className="icon-chevron-right" style={{ fontSize: '16px' }}></i></button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginTop: '18px', textAlign: 'center', fontSize: '10px', fontWeight: '600', color: '#6b7280' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <span key={i}>{x}</span>)}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', rowGap: '22px', marginTop: '20px' }}>
          {days.map((d, i) => (
            <div key={i} title={d ? d.title : ''} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
              <span style={{ width: '26px', height: '26px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: d && d.due ? '#fff' : '#374151', fontWeight: d && (d.due || d.today) ? 700 : 400, background: d && d.due ? '#0d3b2a' : 'transparent', outline: d && d.today && !d.due ? '1.5px solid #15904c' : 'none' }}>{d ? String(d.dd).padStart(2, '0') : ''}</span>
              <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: d && d.due ? '#ea7a12' : d && d.other ? '#111827' : 'transparent' }}></span>
            </div>))}
        </div>
      </div>
      <div style={{ marginTop: '24px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14.5px', color: '#1f2937', paddingLeft: '4px' }}><i className="icon-calendar-days" style={{ fontSize: '18px', color: '#15904c' }}></i>Today</div>
      {!openNow.length ? <div style={{ marginTop: '12px', paddingLeft: '4px', fontSize: '12px', color: '#6b7280' }}>No assessment open today.</div> : openNow.map(a => (
        <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', marginTop: '14px', paddingLeft: '4px', fontSize: '12px', color: '#1f2937' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}><span style={{ width: '9px', height: '9px', border: '1.5px solid #ea7a12', borderRadius: '50%', flex: 'none' }}></span>{a.title.toUpperCase()}</span>
          <span style={{ fontSize: '11px', color: '#4b5563', whiteSpace: 'nowrap' }}>until {dayLabel(a.deadline)}</span>
        </div>))}
      <div style={{ marginTop: '28px', display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14.5px', color: '#1f2937', paddingLeft: '4px' }}><i className="icon-calendar-clock" style={{ fontSize: '18px', color: '#15904c' }}></i>{current ? 'Timeline · ' + current.title : 'Timeline'}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', marginTop: '16px', paddingLeft: '4px' }}>
        {!timeline.length ? <div style={{ fontSize: '12px', color: '#6b7280' }}>Nothing scheduled.</div> : timeline.map(t => (
          <div key={t.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', fontSize: '12px', color: '#1f2937' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '0' }}><span style={{ width: '9px', height: '9px', borderRadius: '50%', flex: 'none', border: '1.5px solid ' + t.ring, background: t.fill }}></span>{t.name}</span>
            <span style={{ fontSize: '11px', color: '#4b5563', flex: 'none' }}>{t.when}</span>
          </div>))}
      </div>
    </aside>
  );
}
