// Route GET /api/assignments/:id · one assignment: details, extension history and each covered person's progress
// Route PATCH /api/assignments/:id · change its start date, deadline or attempt limit
// Route DELETE /api/assignments/:id · cancel it (only while nobody it covers has started the assessment)
// =============================================================================
// Used by: components/SMAssignments.jsx (assignment drawer)
// Depends on: lib/server/{db,session,audit,http,assigned}, ../progress.js, ../rules.js
// Sections (search for these markers): ASSIGNMENT · Read, ASSIGNMENT · Change dates & limit, ASSIGNMENT · Cancel
// Needs "View assignments" to read and "Change dates & attempt limits" to change or cancel. A supervisor only
// sees people in their scope and may only change assignments aimed at their own departments or staff.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { coveredWhere } from '@/lib/server/assigned';
import { json, handle, readBody, badRequest, ApiError, clientIp } from '@/lib/server/http';
import { loadProgress, canSeeAssignment, assertCanManage, findAssignment, assignmentRow, personRow, staffName, plain } from '../progress';
import { summarize, assignmentState, filterPeople, pageOf, checkDates } from '../rules';

const idOf = async params => { const id = Number((await params).id); if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Assignment not found.'); return id; };
// Attempts (any status) by anyone this assignment covers, for the cancel and attempt-limit checks.
const attemptsOf = a => db.attempt.groupBy({ by: ['staffId'], where: { assessmentId: a.assessmentId, staff: coveredWhere(a) }, _count: { _all: true } });

// ===== ASSIGNMENT · Read =====
// Query: status (ALL or a progress status), q (name, staff ID or department), page, pageSize.
export const GET = handle(async (req, { params }) => {
  const ctx = await requirePermission('cycles.view');
  const id = await idOf(params), now = new Date(), p = req.nextUrl.searchParams;
  const a = await findAssignment(id);
  const { people, coveredBy } = await loadProgress([a.assessmentId], ctx, now);
  const covered = coveredBy.get(a.id) || [];
  if (!canSeeAssignment(ctx, a, covered)) throw new ApiError(404, 'Assignment not found.');
  const rows = covered.map(sid => personRow(people.get(a.assessmentId + ':' + sid), a)).sort((x, y) => x.name.localeCompare(y.name));
  const pg = pageOf(filterPeople(rows, { status: p.get('status') || 'ALL', q: p.get('q') || '' }), p.get('page'), p.get('pageSize') || 25);
  let canManage = true; try { assertCanManage(ctx, a); } catch (e) { canManage = false; }
  const started = await attemptsOf(a);
  return json({
    assignment: {
      ...assignmentRow(a), state: assignmentState(a, now), canManage, hasAttempts: started.length > 0,
      maxUsed: Math.max(0, ...started.map(s => s._count._all)), assessmentLimit: a.assessment.maxAttempts,
      history: a.extensions.map(x => ({ id: x.id, who: x.staff ? staffName(x.staff) + ' (' + x.staff.staffNo + ')' : 'Everyone on this assignment', staffId: x.staffId, originalDeadline: x.originalDeadline, newDeadline: x.newDeadline, reason: x.reason, approvedBy: x.approvedBy?.displayName || null, at: x.at })),
    },
    stats: summarize(rows.map(r => r.status)), people: pg.rows, page: pg.page, pages: pg.pages, total: pg.total,
  });
});

// ===== ASSIGNMENT · Change dates & limit =====
// maxAttempts null = use the assessment's own limit. The limit can't go below what someone has already used.
const Patch = z.object({ startsAt: z.coerce.date().optional(), deadline: z.coerce.date().optional(), maxAttempts: z.number().int().min(1).max(10).nullable().optional() })
  .refine(b => b.startsAt || b.deadline || b.maxAttempts !== undefined, 'Nothing to change.');
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('cycles.edit');
  const id = await idOf(params), b = await readBody(req, Patch);
  const a = await findAssignment(id);
  assertCanManage(ctx, a);
  const next = { startsAt: b.startsAt ?? a.startsAt, deadline: b.deadline ?? a.deadline, maxAttempts: b.maxAttempts === undefined ? a.maxAttempts : b.maxAttempts };
  const dateErr = checkDates(next.startsAt, next.deadline);
  if (dateErr) throw badRequest(dateErr, { fields: { deadline: [dateErr] } });
  const used = Math.max(0, ...(await attemptsOf(a)).map(s => s._count._all)), limit = next.maxAttempts ?? a.assessment.maxAttempts ?? 3;
  if (limit < used) throw badRequest('Someone on this assignment has already used ' + used + ' attempts, so the limit can\'t be lower than that.', { fields: { maxAttempts: ['below attempts used'] } });
  const before = { startsAt: a.startsAt, deadline: a.deadline, maxAttempts: a.maxAttempts };
  const saved = await db.$transaction(async tx => {
    const u = await tx.assessmentAssignment.update({ where: { id }, data: next });
    await audit({ actorId: ctx.account.id, action: 'assignment.update', entityType: 'AssessmentAssignment', entityId: id, before: plain(before), after: plain(next), ip: clientIp(req) }, tx);
    return u;
  });
  return json({ assignment: { id: saved.id, startsAt: saved.startsAt, deadline: saved.deadline, maxAttempts: saved.maxAttempts } });
});

// ===== ASSIGNMENT · Cancel =====
// Removes the assignment and its extensions (the audit log keeps what it was). Refused once anyone has started.
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('cycles.edit');
  const id = await idOf(params);
  const a = await findAssignment(id);
  assertCanManage(ctx, a);
  if ((await attemptsOf(a)).length) throw badRequest('People on this assignment have already started the assessment, so it can\'t be cancelled. Change its deadline instead.');
  await db.$transaction(async tx => {
    await tx.deadlineExtension.deleteMany({ where: { assignmentId: id } });
    await tx.assessmentAssignment.delete({ where: { id } });
    await audit({ actorId: ctx.account.id, action: 'assignment.cancel', entityType: 'AssessmentAssignment', entityId: id, before: plain({ assessmentId: a.assessmentId, title: a.assessment.title, targetType: a.targetType, target: assignmentRow(a).target, startsAt: a.startsAt, deadline: a.deadline, maxAttempts: a.maxAttempts, extensions: a.extensions.length }), ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
