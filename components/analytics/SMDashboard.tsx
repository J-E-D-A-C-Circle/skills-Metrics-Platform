'use client';
// =============================================================================
// SMDashboard.jsx · Home: the original Home design (SMHome.jsx) for the signed-in person, then the sections built for
//   their roles from live records
// Screen / URL: / and /home
// Who sees it: everyone. Everyone: the welcome banner with the DVLA building and the facts row. People who take
//   assessments: the green-to-gold assessment strip, KPI cards, Priority Skill Gaps, Quick Actions, calendar and their
//   recent activity (SMHome.jsx). Supervisors: also a team summary. Administrators: organisation KPIs, completion, gaps,
//   content awaiting review, tickets and recent activity. Assessment Creators: their content by status. Ticket
//   resolvers: tickets assigned to them.
// Used by: SkillMatrixApp.jsx (page "home")
// Depends on: SMHome.jsx (welcome banner + personal home), smUI.jsx, smApi.js, SMTeamResults.jsx (helpers),
//   SMOrgDashboard.jsx (charts), lib/scoring.js; GET /api/dashboard
// Sections (search for these markers): HOME · Screen, HOME · Welcome, HOME · Activity, notifications & tickets,
//   HOME · Team, HOME · Organisation, HOME · Content, HOME · Assigned tickets
// Empty states only: nothing on this page is made up.
// =============================================================================
import React from 'react';
import { Page, Card, Btn, Badge, Avg, EmptyState, DataTable, KpiTile } from '@/components/shared/smUI';
import { useLoad, fmtDate, fmtDateTime } from '@/components/shared/smApi';
import { ProgressBadge, GapCounts, pct, goTeam } from '@/components/analytics/SMTeamResults';
import { StackBar, gapParts, statusParts, HBars } from '@/components/analytics/SMOrgDashboard';
import { GAP_COLOURS } from '@/lib/scoring';
import PersonalHome, { WelcomeCard } from '@/components/participant/SMHome';

const grid = min => ({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(' + min + ',1fr))', gap: '16px' });
const ASM_LABEL = { DRAFT: 'Draft', SUBMITTED: 'Awaiting review', RETURNED: 'Returned for revision', REJECTED: 'Rejected', APPROVED: 'Approved', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
const REVIEW_LABEL = { APPROVE: ['Approved', '#dcfce7', '#15803d'], REJECT: ['Rejected', '#fee2e2', '#b91c1c'], RETURN: ['Returned for revision', '#fef3c7', '#92400e'], PUBLISH: ['Published', '#dbeafe', '#1d4ed8'] };
const TICKET_LABEL = { OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', PENDING_USER: 'Waiting for you', RESOLVED: 'Resolved', CLOSED: 'Closed' };
const ATTEMPT_LABEL = { IN_PROGRESS: 'In progress', SUBMITTED: 'Submitted', PENDING_MARKING: 'Pending marking', COMPLETED: 'Completed', ABANDONED: 'Abandoned', EXPIRED: 'Expired' };
const Row = ({ children, onClick }) => <button type="button" onClick={onClick} disabled={!onClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%', padding: '10px 0', border: 0, borderBottom: '1px solid rgba(15,35,65,.07)', background: 'none', textAlign: 'left', cursor: onClick ? 'pointer' : 'default', font: 'inherit', color: 'inherit' }}>{children}</button>;
const Muted = ({ children }) => <span style={{ fontSize: '12px', color: '#6b7280' }}>{children}</span>;

// ===== HOME · Screen =====
export default function SMDashboard({ me, go }) {
  const { data: d, error } = useLoad('/api/dashboard');
  const perms = me?.perms || [];
  return (
    <Page>
      {/* ===== HOME · Welcome ===== */}
      {/* People who take assessments get the full personal Home (SMHome.jsx); everyone else the welcome banner and
          facts row above their role sections. */}
      {d && d.me ? <PersonalHome me={me} m={d.me} go={go}><MyActivity m={d.me} go={go} /></PersonalHome> : <WelcomeCard me={me} staff={null} current={null} go={go} />}
      {error ? <Card><EmptyState icon="icon-circle-alert" title="Your dashboard could not be loaded" text={error} /></Card>
        : !d ? <Card><EmptyState icon="icon-loader" title="Loading your dashboard…" /></Card>
        : <>
          {d.org ? <OrgSection o={d.org} go={go} perms={perms} /> : null}
          {d.team ? <TeamSection t={d.team} go={go} perms={perms} /> : null}
          {d.content ? <ContentSection c={d.content} go={go} /> : null}
          {d.tickets ? <TicketSection t={d.tickets} go={go} /> : null}
          {!d.org && !d.me && !d.team && !d.content && !d.tickets ? <Card><EmptyState icon="icon-house" title="Nothing to show yet" text="Use the menu to open the pages you have access to." /></Card> : null}
        </>}
    </Page>
  );
}
const Heading = ({ children, sub }) => <div style={{ marginTop: '6px' }}><div style={{ font: '700 18px Inter,sans-serif', letterSpacing: '-0.2px' }}>{children}</div>{sub ? <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '3px' }}>{sub}</div> : null}</div>;

// ===== HOME · Activity, notifications & tickets =====
function MyActivity({ m, go }) {
  return (
    <div style={grid('300px')}>
      <Card title="Recent activity" actions={<Btn small kind="ghost" onClick={() => go('profile', 'history')}>History</Btn>}>
        {!m.history.length ? <EmptyState icon="icon-history" title="No attempts yet" /> : m.history.map(h => <Row key={h.id}>
          <span style={{ flex: '1 1 160px', minWidth: 0 }}><span style={{ display: 'block', fontSize: '13px', fontWeight: 500 }}>{h.title}</span><Muted>Attempt {h.attemptNo} · {fmtDateTime(h.completedAt || h.startedAt)}</Muted></span>
          <Badge>{ATTEMPT_LABEL[h.status] || h.status}</Badge></Row>)}
      </Card>
      <Card title="Notifications" sub={m.unread ? m.unread + ' unread' : 'All read'}>
        {!m.notifications.length ? <EmptyState icon="icon-bell" title="No notifications" /> : m.notifications.map(n => <Row key={n.id}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: n.readAt ? 'transparent' : '#15904c', flex: 'none' }} title={n.readAt ? 'Read' : 'Unread'}></span>
          <span style={{ flex: '1 1 160px', minWidth: 0 }}><span style={{ display: 'block', fontSize: '13px', fontWeight: n.readAt ? 400 : 600 }}>{n.title}</span><Muted>{fmtDateTime(n.createdAt)}</Muted></span></Row>)}
      </Card>
      <Card title="Support tickets" sub={m.ticketOpen + ' open'} actions={<Btn small kind="ghost" onClick={() => go('tickets')}>Open tickets</Btn>}>
        {!m.tickets.length ? <EmptyState icon="icon-life-buoy" title="No tickets" text="Need help? Raise a support ticket." action={<Btn small onClick={() => go('tickets')}>Raise a ticket</Btn>} /> : m.tickets.map(t => <Row key={t.id} onClick={() => go('tickets', undefined, t.id)}>
          <span style={{ flex: '1 1 160px', minWidth: 0 }}><span style={{ display: 'block', fontSize: '13px', fontWeight: 500 }}>{t.title}</span><Muted>{t.reference} · updated {fmtDate(t.updatedAt)}</Muted></span><Badge>{TICKET_LABEL[t.status] || t.status}</Badge></Row>)}
      </Card>
    </div>
  );
}

// ===== HOME · Team =====
function TeamSection({ t, go, perms }) {
  const s = t.summary, c = s.completion, canOpen = perms.includes('staff-evals.report');
  return <>
    <Heading sub={(t.departments.join(', ') || 'Your team') + ' · completion rate = assessments completed ÷ assigned and open'}>My team</Heading>
    <div style={grid('160px')}>
      <KpiTile label="Team members" value={s.people} sub={s.peopleAssessed + ' with results'} onClick={() => go('staff-evals')} />
      <KpiTile label="Completion rate" value={pct(c.rate)} sub={c.completed + ' of ' + c.open + ' completed'} />
      <KpiTile label="Overdue" value={t.overdueTotal} sub="people with an overdue assessment" subColor={t.overdueTotal ? '#b91c1c' : undefined} onClick={t.overdueTotal ? () => goTeam(go, { status: 'OVERDUE' }) : undefined} />
      <KpiTile label="Critical Gaps" value={s.results.critical} sub={s.peopleWithCritical + ' people affected'} subColor={s.results.critical ? '#b91c1c' : undefined} onClick={s.peopleWithCritical ? () => goTeam(go, { gap: 'CRITICAL' }) : undefined} />
      <KpiTile label="Team average" value={s.overallDisplay} sub={s.results.proficient + ' Proficient results'} />
    </div>
    <div style={grid('320px')}>
      <Card title="Top gaps" sub="Most Critical Gaps first" actions={perms.includes('training.view') ? <Btn small kind="ghost" onClick={() => go('training')}>Development Priorities</Btn> : null}>
        {!t.topGaps.length ? <EmptyState icon="icon-award" title="No gaps recorded yet" /> : t.topGaps.map(g => <div key={g.competencyId} style={{ padding: '8px 0', borderBottom: '1px solid rgba(15,35,65,.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '13px', marginBottom: '6px' }}><b style={{ fontWeight: 600 }}>{g.rank}. {g.name}</b><Avg value={g.average} /></div>
          <StackBar parts={gapParts(g)} height={8} legend={false} /><div style={{ marginTop: '4px' }}><GapCounts c={g} compact /></div></div>)}
      </Card>
      <Card title="Overdue" sub={t.overdueTotal ? t.overdueTotal + ' people' : 'Nobody is overdue'} actions={t.overdueTotal ? <Btn small kind="ghost" onClick={() => goTeam(go, { status: 'OVERDUE' })}>See all</Btn> : null}>
        {!t.overdue.length ? <EmptyState icon="icon-circle-check" title="Nobody is overdue" /> : t.overdue.map(p => <Row key={p.id} onClick={canOpen ? () => go('report', undefined, p.id) : undefined}>
          <span style={{ flex: '1 1 160px', minWidth: 0 }}><span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{p.name}</span><Muted>{p.assessments.join(', ')}</Muted></span><ProgressBadge status="OVERDUE" /></Row>)}
      </Card>
      <Card title="Assessment completion">
        <HBars rows={t.assessments.map(a => ({ key: a.id, label: a.title, sub: a.completed + ' of ' + a.open, value: a.rate || 0, display: pct(a.rate), onClick: () => goTeam(go, { assessmentId: String(a.id) }) }))} empty={<EmptyState icon="icon-calendar" title="No assessments assigned to your team" />} />
      </Card>
    </div>
  </>;
}

// ===== HOME · Organisation =====
function OrgSection({ o, go, perms }) {
  const s = o.summary, c = s.completion, n = (m, k) => (m && m[k]) || 0;
  const staffTotal = Object.values(o.staff).reduce((a, b) => a + b, 0), accTotal = Object.values(o.accounts).reduce((a, b) => a + b, 0);
  const asmTotal = Object.values(o.assessments).reduce((a, b) => a + b, 0);
  return <>
    <Heading sub="Live figures for the whole organisation · completion rate = assessments completed ÷ assigned and open">Organisation overview</Heading>
    <div style={grid('165px')}>
      <KpiTile label="Staff" value={staffTotal} sub={n(o.staff, 'ACTIVE') + ' active · ' + (staffTotal - n(o.staff, 'ACTIVE')) + ' inactive or left'} onClick={perms.includes('org.view') ? () => go('organisation') : undefined} />
      <KpiTile label="Accounts" value={accTotal} sub={n(o.accounts, 'ACTIVE') + ' active · ' + (n(o.accounts, 'SUSPENDED') + n(o.accounts, 'DISABLED')) + ' suspended or disabled'} onClick={perms.includes('settings.users') ? () => go('settings', 'users') : undefined} />
      <KpiTile label="Assessments" value={asmTotal} sub={n(o.assessments, 'PUBLISHED') + ' published · ' + n(o.assessments, 'DRAFT') + ' draft'} onClick={perms.includes('forms.view') ? () => go('forms') : undefined} />
      <KpiTile label="Awaiting review" value={n(o.assessments, 'SUBMITTED')} sub="content submitted by creators" subColor={n(o.assessments, 'SUBMITTED') ? '#92400e' : undefined} onClick={perms.includes('forms.review') ? () => go('forms') : undefined} />
      <KpiTile label="Completion rate" value={pct(c.rate)} sub={c.completed + ' of ' + c.open + ' completed'} onClick={() => go('analytics')} />
      <KpiTile label="Staff with outstanding work" value={o.outstandingPeople} sub={c.overdue + ' assessments overdue'} subColor={c.overdue ? '#b91c1c' : undefined} onClick={perms.includes('staff-evals.view') ? () => goTeam(go, { status: c.overdue ? 'OVERDUE' : 'NOT_STARTED' }) : undefined} />
      <KpiTile label="Critical Gaps" value={s.results.critical} sub={s.peopleWithCritical + ' people affected'} subColor={s.results.critical ? '#b91c1c' : undefined} onClick={perms.includes('staff-evals.view') ? () => goTeam(go, { gap: 'CRITICAL' }) : undefined} />
      <KpiTile label="Open tickets" value={o.tickets.open} sub={o.tickets.urgent + ' high or urgent'} subColor={o.tickets.urgent ? '#b91c1c' : undefined} onClick={() => go('tickets')} />
    </div>
    <div style={grid('320px')}>
      <Card title="Gap status" sub={s.results.assessed + ' competency results · overall average ' + s.overallDisplay}>
        {s.results.assessed ? <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}><StackBar parts={gapParts(s.results)} /><StackBar parts={statusParts(s.results)} /></div> : <EmptyState title="No results yet" />}
        <div style={{ marginTop: '12px', fontSize: '12.5px', color: '#374151' }}>{s.peopleAllProficient} staff Proficient in every competency assessed.</div>
      </Card>
      <Card title="Participation and deadlines" sub="Per assessment">
        {!o.participation.length ? <EmptyState icon="icon-calendar" title="No assessments assigned yet" /> : o.participation.map(a => <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(15,35,65,.06)' }}>
          <HBars rows={[{ key: a.id, label: a.title, value: a.rate || 0, display: pct(a.rate), onClick: perms.includes('staff-evals.view') ? () => goTeam(go, { assessmentId: String(a.id) }) : undefined }]} />
          <Muted>{a.completed} of {a.open} completed · {a.outstanding} outstanding{a.overdue ? ' · ' + a.overdue + ' overdue' : ''}{a.nextDeadline ? ' · next deadline ' + fmtDate(a.nextDeadline) : ''}</Muted></div>)}
      </Card>
      <Card title="Top gaps" sub="Most Critical Gaps first" actions={<Btn small kind="ghost" onClick={() => go('training')}>Priorities</Btn>}>
        {!o.topGaps.length ? <EmptyState icon="icon-award" title="No gaps recorded yet" /> : <HBars rows={o.topGaps.map(g => ({ key: g.competencyId, label: g.rank + '. ' + g.name, sub: g.critical + ' Critical · ' + g.moderate + ' Moderate', value: g.needShare || 0, display: pct(g.needShare), color: g.critical ? GAP_COLOURS.CRITICAL[1] : GAP_COLOURS.MODERATE[1] }))} />}
      </Card>
    </div>
    <div style={grid('360px')}>
      <Card title="Recent assessment activity" flush>
        <DataTable minWidth={520} rowKey={r => r.id} rows={o.recentAttempts} empty={<EmptyState icon="icon-history" title="No attempts yet" />} columns={[
          { key: 'name', label: 'Staff', render: r => perms.includes('staff-evals.report') ? <button type="button" onClick={() => go('report', undefined, r.staffId)} style={{ background: 'none', border: 0, padding: 0, cursor: 'pointer', color: '#127a42', font: '600 13px Inter,sans-serif', textAlign: 'left' }}>{r.name}</button> : r.name },
          { key: 'assessment', label: 'Assessment', render: r => <span style={{ fontSize: '12.5px' }}>{r.assessment} · #{r.attemptNo}</span> },
          { key: 'status', label: 'Status', render: r => <Badge>{ATTEMPT_LABEL[r.status] || r.status}</Badge> },
          { key: 'at', label: 'When', render: r => <Muted>{fmtDateTime(r.at)}</Muted> },
        ]} />
      </Card>
      <Card title="Recent administrative changes" flush actions={perms.includes('settings.audit') ? <Btn small kind="ghost" onClick={() => go('settings', 'audit')}>Audit log</Btn> : null}>
        <DataTable minWidth={480} rowKey={r => r.id} rows={o.recentChanges} empty={<EmptyState icon="icon-scroll-text" title="No changes recorded yet" />} columns={[
          { key: 'action', label: 'Change', render: r => <span style={{ font: "500 12px 'JetBrains Mono',monospace" }}>{r.action}</span> },
          { key: 'actor', label: 'By' },
          { key: 'outcome', label: 'Outcome', render: r => <Badge bg={r.outcome === 'SUCCESS' ? '#dcfce7' : '#fee2e2'} fg={r.outcome === 'SUCCESS' ? '#15803d' : '#b91c1c'}>{r.outcome === 'SUCCESS' ? 'Done' : r.outcome === 'DENIED' ? 'Denied' : 'Failed'}</Badge> },
          { key: 'at', label: 'When', render: r => <Muted>{fmtDateTime(r.at)}</Muted> },
        ]} />
      </Card>
    </div>
    <Card title="Organisation structure"><div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>{Object.entries(o.structure).map(([k, v]) => <Badge key={k} bg="#e6f2ea" fg="#0d3b2a">{v} {k}</Badge>)}</div></Card>
  </>;
}

// ===== HOME · Content =====
function ContentSection({ c, go }) {
  const keys = ['DRAFT', 'SUBMITTED', 'RETURNED', 'REJECTED', 'APPROVED', 'PUBLISHED'];
  return <>
    <Heading sub="Assessments you created, by status">My assessment content</Heading>
    <div style={grid('150px')}>{keys.map(k => <KpiTile key={k} label={ASM_LABEL[k]} value={c.counts[k] || 0} onClick={() => go('forms')} />)}</div>
    <Card title="Latest review feedback" actions={<Btn small kind="ghost" onClick={() => go('forms')}>Assessment Content</Btn>}>
      {!c.feedback.length ? <EmptyState icon="icon-message-square" title="No review feedback yet" text="When an administrator reviews content you submitted, their decision and comments appear here." /> : c.feedback.map(f => { const l = REVIEW_LABEL[f.action] || [f.action]; return <Row key={f.id} onClick={() => go('forms')}>
        <span style={{ flex: '1 1 200px', minWidth: 0 }}><span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{f.assessment} · v{f.versionNo}</span><Muted>{f.by} · {fmtDateTime(f.at)}{f.feedback ? ' · “' + f.feedback + '”' : ''}</Muted></span><Badge bg={l[1]} fg={l[2]}>{l[0]}</Badge></Row>; })}
    </Card>
  </>;
}

// ===== HOME · Assigned tickets =====
function TicketSection({ t, go }) {
  return <Card title="Tickets assigned to you" sub={t.open + ' open'} actions={<Btn small kind="ghost" onClick={() => go('tickets')}>Support Tickets</Btn>}>
    {!t.list.length ? <EmptyState icon="icon-life-buoy" title="No open tickets assigned to you" /> : t.list.map(x => <Row key={x.id} onClick={() => go('tickets', undefined, x.id)}>
      <span style={{ flex: '1 1 200px', minWidth: 0 }}><span style={{ display: 'block', fontSize: '13px', fontWeight: 600 }}>{x.title}</span><Muted>{x.reference} · {x.priority.toLowerCase()} priority · updated {fmtDate(x.updatedAt)}</Muted></span><Badge>{TICKET_LABEL[x.status] || x.status}</Badge></Row>)}
  </Card>;
}
