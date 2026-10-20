// Route GET /api/dashboard · Home: the sections the signed-in person should see, built from live records
// =============================================================================
// Used by: components/SMDashboard.jsx (Home)
// Depends on: lib/server/{db,session,scope,analytics,http}, lib/scoring.js
// Sections (search for these markers): HOME · My section, HOME · Team section, HOME · Organisation section,
//   HOME · Content section, HOME · Tickets section, HOME · Read
// Any signed-in account; each section has its own rule:
//   me      - accounts that take assessments (own staff record + "Take assessments"); results only when released
//   team    - "View team results" (supervisors; administrators get the organisation section instead)
//   org     - Administrators: organisation KPIs, completion, gaps, content awaiting review, open tickets, activity
//   content - Assessment Creators: their own content by status and the latest review feedback
//   tickets - ticket resolvers: tickets assigned to them that are still open
// Nothing here is made up: an empty database gives zeros and empty lists, and the screen shows empty states.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { viaStaff } from '@/lib/server/scope';
import { loadScope, personProfile, groupSummary, byAssessment, statsFor, rankPriorities, personRow, fullName } from '@/lib/server/analytics';
import { formatAverage } from '@/lib/scoring';
import { json, handle } from '@/lib/server/http';

const OPEN_TICKET = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER'];
const countBy = rows => Object.fromEntries(rows.map(r => [r.status, r._count._all]));

// ===== HOME · My section =====
async function mySection(ctx) {
  const p = await personProfile(ctx.account.staffId, { own: true });
  const [notifications, unread, tickets] = await Promise.all([
    db.notification.findMany({ where: { accountId: ctx.account.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, title: true, body: true, link: true, readAt: true, createdAt: true } }),
    db.notification.count({ where: { accountId: ctx.account.id, readAt: null } }),
    db.ticket.findMany({ where: { requesterId: ctx.account.id }, orderBy: { updatedAt: 'desc' }, take: 3, select: { id: true, reference: true, title: true, status: true, updatedAt: true } }),
  ]);
  const ticketOpen = await db.ticket.count({ where: { requesterId: ctx.account.id, status: { in: OPEN_TICKET } } });
  const assigned = p.assessments.filter(a => a.assigned);
  return {
    staff: p.staff, counts: p.counts, completion: p.completion, pendingRelease: p.pendingRelease,
    assessments: assigned.map(({ results, ...a }) => a), results: p.results,
    history: p.history.slice(0, 6).map(({ scores, ...h }) => h),
    attempts: { used: assigned.reduce((s, a) => s + a.used, 0), remaining: assigned.reduce((s, a) => s + a.remaining, 0) },
    notifications, unread, tickets, ticketOpen,
  };
}

// ===== HOME · Team section =====
async function teamSection(ctx) {
  const d = await loadScope(ctx);
  const sum = groupSummary(d.people), stats = statsFor(d.people, d.competencies, d.cfg);
  const overdue = d.people.filter(p => p.status === 'OVERDUE').map(p => ({ id: p.id, name: p.name, department: p.department, assessments: p.progress.filter(x => x.status === 'OVERDUE').map(x => x.title) }));
  return { summary: { ...sum, overallDisplay: formatAverage(sum.results.overall) }, overdue: overdue.slice(0, 8), overdueTotal: overdue.length, assessments: byAssessment(d.people, d.now),
    topGaps: rankPriorities(stats).slice(0, 5), departments: [...new Set(d.people.map(p => p.department).filter(Boolean))] };
}

// ===== HOME · Organisation section =====
async function orgSection(ctx) {
  const d = await loadScope(ctx);
  const sum = groupSummary(d.people), stats = statsFor(d.people, d.competencies, d.cfg);
  const [staffBy, accountsBy, depts, grades, stations, locations, asmBy, ticketsOpen, ticketsUrgent, audits, recent] = await Promise.all([
    db.staffRecord.groupBy({ by: ['status'], _count: { _all: true } }),
    db.account.groupBy({ by: ['status'], _count: { _all: true } }),
    db.department.count({ where: { active: true } }), db.grade.count({ where: { active: true } }), db.station.count({ where: { active: true } }), db.location.count({ where: { active: true } }),
    db.assessment.groupBy({ by: ['status'], _count: { _all: true } }),
    db.ticket.count({ where: { status: { in: OPEN_TICKET } } }),
    db.ticket.count({ where: { status: { in: OPEN_TICKET }, priority: { in: ['HIGH', 'URGENT'] } } }),
    db.auditLog.findMany({ where: { NOT: { action: { startsWith: 'auth.' } } }, orderBy: { at: 'desc' }, take: 8, include: { actor: { select: { displayName: true } } } }),
    db.attempt.findMany({ where: viaStaff(ctx), orderBy: { updatedAt: 'desc' }, take: 8, select: { id: true, status: true, attemptNo: true, startedAt: true, completedAt: true, updatedAt: true, staff: { select: { id: true, firstName: true, lastName: true, otherNames: true } }, assessment: { select: { title: true } } } }),
  ]);
  const people = d.people.map(personRow);
  return {
    summary: { ...sum, overallDisplay: formatAverage(sum.results.overall) },
    staff: countBy(staffBy), accounts: countBy(accountsBy), structure: { departments: depts, grades, stations, locations }, assessments: countBy(asmBy),
    tickets: { open: ticketsOpen, urgent: ticketsUrgent },
    outstandingPeople: people.filter(p => p.outstanding > 0).length, participation: byAssessment(d.people, d.now), topGaps: rankPriorities(stats).slice(0, 5),
    recentAttempts: recent.map(a => ({ id: a.id, staffId: a.staff.id, name: fullName(a.staff), assessment: a.assessment.title, attemptNo: a.attemptNo, status: a.status, at: a.completedAt || a.updatedAt })),
    recentChanges: audits.map(a => ({ id: String(a.id), action: a.action, entityType: a.entityType, entityId: a.entityId, outcome: a.outcome, actor: a.actor?.displayName || 'System', at: a.at })),
  };
}

// ===== HOME · Content section =====
async function contentSection(ctx) {
  const mine = { createdById: ctx.account.id };
  const [by, feedback] = await Promise.all([
    db.assessment.groupBy({ by: ['status'], where: mine, _count: { _all: true } }),
    db.assessmentReviewEvent.findMany({ where: { version: { assessment: mine }, action: { in: ['APPROVE', 'REJECT', 'RETURN', 'PUBLISH'] } }, orderBy: { at: 'desc' }, take: 5,
      include: { actor: { select: { displayName: true } }, version: { select: { versionNo: true, assessment: { select: { id: true, title: true } } } } } }),
  ]);
  return { counts: countBy(by), feedback: feedback.map(f => ({ id: f.id, action: f.action, feedback: f.feedback, at: f.at, by: f.actor.displayName, assessment: f.version.assessment.title, assessmentId: f.version.assessment.id, versionNo: f.version.versionNo })) };
}

// ===== HOME · Tickets section =====
async function ticketSection(ctx) {
  const [open, list] = await Promise.all([
    db.ticket.count({ where: { assigneeId: ctx.account.id, status: { in: OPEN_TICKET } } }),
    db.ticket.findMany({ where: { assigneeId: ctx.account.id, status: { in: OPEN_TICKET } }, orderBy: { updatedAt: 'desc' }, take: 5, select: { id: true, reference: true, title: true, status: true, priority: true, updatedAt: true } }),
  ]);
  return { open, list };
}

// ===== HOME · Read =====
export const GET = handle(async () => {
  const ctx = await requireUser();
  const perms = ctx.user.perms, roles = ctx.user.roles, admin = roles.includes('ADMIN');
  const [me, team, org, content, tickets] = await Promise.all([
    ctx.account.staffId && perms.includes('assessments.view') ? mySection(ctx) : null,
    !admin && perms.includes('staff-evals.view') ? teamSection(ctx) : null,
    admin ? orgSection(ctx) : null,
    roles.includes('CREATOR') ? contentSection(ctx) : null,
    !admin && perms.includes('tickets.resolve') ? ticketSection(ctx) : null,
  ]);
  return json({ me, team, org, content, tickets });
});
