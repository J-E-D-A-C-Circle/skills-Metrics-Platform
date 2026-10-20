'use client';
// =============================================================================
// SMHelp.jsx · Help & Guides: answers about assessments, scoring and results, plus the Rating Scales tab
// Screen / URL: /help (Help & Guides) and /help?tab=ratings (Rating Scales); open to every signed-in person
// Used by: components/SkillMatrixApp.jsx (help page)   Depends on: smUI, smApi (GET /api/lookups), lib/scoring.js
// Sections (search for these markers): HELP · Questions & answers, HELP · Screen, HELP · Quick links, HELP · Answers,
//   HELP · Rating Scales
// Every rule described here is the one the server applies (lib/scoring.js and the active scoring version), so the
// thresholds shown always match the results people see.
// =============================================================================
import React, { useMemo, useState } from 'react';
import { Page, PageHeader, Card, Search, EmptyState, Badge } from './smUI';
import { useLoad } from './smApi';
import { SCORE_LABELS, DEFAULT_CONFIG, COMPETENCY_LABEL, GAP_LABEL, COMPETENCY_COLOURS, GAP_COLOURS } from '../lib/scoring';

const n2 = v => Number(v).toFixed(2);
const below = v => n2(Math.round(v * 100 - 1) / 100); // 4.00 -> "3.99"

// ===== HELP · Questions & answers =====
// c = the active scoring thresholds (from the server, or the defaults while loading).
const faqs = c => [
  ['Is there a countdown timer?', 'No. Take the time you need before the deadline. The system only records how long the page was actually open and in front of you; that time never changes your score.'],
  ['Can I stop and come back later?', 'Yes. Every answer is saved as you go. Close the page or press Save & exit, then press Resume on My Assessments to carry on from where you stopped, until the deadline.'],
  ['How many attempts do I get?', `Usually ${c.defaultMaxAttempts}, unless the assessment or its assignment says otherwise. Every attempt you start counts as one, so opening the assessment in a second tab never gives you an extra try. My Assessments shows how many you have left.`],
  ['How is my score worked out?', 'Each competency is scored from 0 to 5: 5 × the share of its questions you answered correctly. Your final result for a competency is the average of all your completed attempts, not just the best or the last one. Attempts you started but did not submit are not counted.'],
  ['What do Competent and Proficient mean?', `Competent means a final average of ${n2(c.competentFrom)} or more. Proficient means ${n2(c.proficientFrom)}, the full required level. Below ${n2(c.competentFrom)} is Not Competent. The exact unrounded average is used, so ${below(c.competentFrom)} is still Not Competent.`],
  ['What is a gap?', `The gap is how far your average is from the required level (${n2(c.requiredLevel)}). Below ${n2(c.moderateGapFrom)} is a Critical Gap, ${n2(c.moderateGapFrom)} to ${below(c.noGapFrom)} is a Moderate Gap and ${n2(c.noGapFrom)} is No Gap. You can be Competent and still have a Moderate Gap.`],
  ['When can I see my results?', 'It depends on the assessment: straight after you submit, after the deadline, or when an administrator releases them. My Assessments tells you which.'],
  ['Who can see my results?', 'You, your supervisor or Head of Department for the departments they are assigned to, and administrators. Supervisors never see other departments.'],
  ['I missed a deadline. What can I do?', 'Ask your supervisor or raise a support ticket. An administrator or supervisor can grant an extension, which is recorded with a reason.'],
  ['Something looks wrong. How do I get help?', 'Raise a ticket under Support Tickets (bottom of the sidebar). You will get a reference number and a notification each time it is updated.'],
];

// ===== HELP · Screen =====
export default function SMHelp({ me, go, view }) {
  const { data } = useLoad('/api/lookups');
  const c = { ...DEFAULT_CONFIG, ...(data?.scoring || {}) };
  return <Page>{view === 'ratings' ? <Ratings c={c} version={data?.scoring?.version} /> : <Guides c={c} me={me} go={go} />}</Page>;
}

function Guides({ c, me, go }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState({});
  const list = useMemo(() => faqs(c).filter(([a, b]) => !q.trim() || (a + ' ' + b).toLowerCase().includes(q.trim().toLowerCase())), [c, q]);
  const takes = (me?.perms || []).includes('assessments.view');
  // ===== HELP · Quick links =====
  const links = [
    takes ? { icon: 'icon-clipboard-list', title: 'My assessments', sub: 'Start, resume or see your results', go: () => go('assessments') } : null,
    { icon: 'icon-life-buoy', title: 'Support tickets', sub: 'Report a problem or ask a question', go: () => go('tickets') },
    { icon: 'icon-sliders-horizontal', title: 'Rating scales explained', sub: 'Scores, Competent / Proficient and gaps', go: () => go('help', 'ratings') },
  ].filter(Boolean);
  return (
    <>
      <PageHeader title="Help & Guides" description="How assessments, scoring and results work" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,220px),1fr))', gap: '12px' }}>
        {links.map(k => (
          <button key={k.title} type="button" onClick={k.go} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '16px 18px', borderRadius: '18px', background: 'rgba(255,255,255,.62)', border: '1px solid rgba(255,255,255,.85)', boxShadow: '0 10px 30px rgba(15,35,65,.07)', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}>
            <span style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#e6f2ea', color: '#0d3b2a', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}><i className={k.icon} style={{ fontSize: '18px' }}></i></span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}><span style={{ font: '600 14px Inter,sans-serif', color: '#111827' }}>{k.title}</span><span style={{ font: '400 12px Inter,sans-serif', color: '#6b7280' }}>{k.sub}</span></span>
          </button>))}
      </div>
      {/* ===== HELP · Answers ===== */}
      <Card flush>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(15,35,65,.07)' }}><Search value={q} onChange={setQ} placeholder="Search help" /></div>
        {list.length ? list.map(([question, answer]) => (
          <div key={question} style={{ borderBottom: '1px solid rgba(15,35,65,.07)' }}>
            <button type="button" aria-expanded={!!open[question]} onClick={() => setOpen(o => ({ ...o, [question]: !o[question] }))} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '14px 18px', background: 'none', border: 0, cursor: 'pointer', textAlign: 'left', font: '500 14px Inter,sans-serif', color: '#111827' }}>
              {question}<i className={open[question] ? 'icon-chevron-up' : 'icon-chevron-down'} style={{ color: '#9ca3af' }}></i>
            </button>
            {open[question] ? <div style={{ padding: '0 18px 16px', fontSize: '13.5px', lineHeight: '1.6', color: '#4b5563' }}>{answer}</div> : null}
          </div>)) : <EmptyState icon="icon-search" title="No answers match your search" text="Try other words, or raise a support ticket." />}
      </Card>
    </>
  );
}

// ===== HELP · Rating Scales =====
// The 0-5 score labels, the Competent / Proficient thresholds and the gap bands, from the active scoring version.
function Ratings({ c, version }) {
  const row = (key, left, label, colours, desc) => (
    <div key={key} style={{ display: 'flex', gap: '14px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(15,35,65,.07)', flexWrap: 'wrap' }}>
      <span style={{ flex: 'none', width: '110px', font: "600 14px 'JetBrains Mono',monospace", color: '#111827' }}>{left}</span>
      <span style={{ flex: 'none', minWidth: '130px' }}>{colours ? <Badge bg={colours[0]} fg={colours[1]}>{label}</Badge> : <b style={{ fontSize: '13px' }}>{label}</b>}</span>
      <span style={{ flex: '1 1 220px', fontSize: '13px', lineHeight: '1.5', color: '#374151' }}>{desc}</span>
    </div>);
  return (
    <>
      <PageHeader title="Help & Guides" description={'The scales used for every result' + (version ? ' (scoring version ' + version + ')' : '')} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,440px),1fr))', gap: '20px', alignItems: 'start' }}>
        <Card title="Competency score (0 to 5)" sub="5 × the share of a competency's questions answered correctly; a score of 3.5 reads as Moderate" flush>
          {SCORE_LABELS.map(s => row(s.score, String(s.score), s.label, null, s.meaning))}
        </Card>
        <Card title="Final result" sub="The average of every completed attempt, compared unrounded and shown to 2 decimals" flush>
          {row('nc', '0.00 – ' + below(c.competentFrom), COMPETENCY_LABEL.NOT_COMPETENT, COMPETENCY_COLOURS.NOT_COMPETENT, 'Below the working competency threshold.')}
          {row('c', n2(c.competentFrom) + (c.proficientFrom > c.competentFrom ? ' – ' + below(c.proficientFrom) : ''), COMPETENCY_LABEL.COMPETENT, COMPETENCY_COLOURS.COMPETENT, 'Meets the working competency threshold.')}
          {row('p', n2(c.proficientFrom) + (c.proficientFrom < c.requiredLevel ? ' +' : ''), COMPETENCY_LABEL.PROFICIENT, COMPETENCY_COLOURS.PROFICIENT, 'Has reached the full required proficiency level.')}
        </Card>
        <Card title="Gap status" sub={'Gap = required level (' + n2(c.requiredLevel) + ') minus the final average'} flush>
          {row('cg', '0.00 – ' + below(c.moderateGapFrom), GAP_LABEL.CRITICAL, GAP_COLOURS.CRITICAL, 'A priority for development.')}
          {row('mg', n2(c.moderateGapFrom) + ' – ' + below(c.noGapFrom), GAP_LABEL.MODERATE, GAP_COLOURS.MODERATE, 'Some development still needed, even when Competent.')}
          {row('ng', n2(c.noGapFrom) + (c.noGapFrom < c.requiredLevel ? ' +' : ''), GAP_LABEL.NONE, GAP_COLOURS.NONE, 'The required level is reached.')}
        </Card>
        <Card title="Attempts" flush>
          {row('a1', String(c.defaultMaxAttempts), 'Attempts allowed', null, 'The usual limit; an assessment or assignment can set its own. Every attempt started counts.')}
          {row('a2', 'Average', 'Final result', null, 'All completed attempts count equally. Unfinished, abandoned or expired attempts are never counted, and a competency not assessed is shown as "Not assessed", never 0.')}
        </Card>
      </div>
    </>
  );
}
