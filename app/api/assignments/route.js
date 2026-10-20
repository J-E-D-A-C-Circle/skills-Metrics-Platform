// Route GET /api/assignments · the Assignments list with progress, the assessments that can be assigned, and totals
// Route POST /api/assignments · assign a published assessment to people, departments, grades, stations or locations
// =============================================================================
// Used by: components/SMAssignments.jsx (Assignments page, /cycles)
// Depends on: lib/server/{db,session,scope,audit,notify,http,assigned}, ./progress.js, ./rules.js
// Sections (search for these markers): ASSIGNMENTS LIST · Read, ASSIGNMENTS LIST · Totals, NEW ASSIGNMENT · Input,
//   NEW ASSIGNMENT · Checks, NEW ASSIGNMENT · Save & notify
// Needs "View assignments" to list and "Assign assessments" to create. Supervisors only see people in their scope
// and may only assign to their own departments or to staff they can see.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { assertStaffVisible } from '@/lib/server/scope';
import { audit } from '@/lib/server/audit';
import { notify, fmtDate } from '@/lib/server/notify';
import { coveredWhere } from '@/lib/server/assigned';
import { json, handle, readBody, badRequest, forbidden, clientIp } from '@/lib/server/http';
import { loadProgress, canSeeAssignment, takerAccounts, assignmentRow, plain } from './progress';
import { TARGETS, TARGET_FIELD, TARGET_LABEL, targetAllowed, checkDates, summarize, assignmentState, pageOf } from './rules';

// ===== ASSIGNMENTS LIST · Read =====
// Query: assessmentId, state (UPCOMING | OPEN | CLOSED), q (assessment or target name), page, pageSize.
// Each row's counts only include people the viewer may see; a person reached by several assignments of the
// same assessment carries one status (their merged dates).
export const GET = handle(async req => {
  const ctx = await requirePermission('cycles.view');
  const p = req.nextUrl.searchParams, now = new Date();
  const assessmentId = Number(p.get('assessmentId')) || null, state = p.get('state') || 'ALL', q = (p.get('q') || '').trim().toLowerCase();
  const assessments = await db.assessment.findMany({
    where: { OR: [{ status: 'PUBLISHED' }, { assignments: { some: {} } }] }, orderBy: { title: 'asc' },
    select: { id: true, title: true, status: true, maxAttempts: true, resultRelease: true, resultsReleasedAt: true, _count: { select: { assignments: true } } },
  });
  const ids = assessmentId ? [assessmentId] : assessments.filter(a => a._count.assignments).map(a => a.id);
  const { assignments, people, coveredBy } = await loadProgress(ids, ctx, now);
  let rows = assignments.filter(a => canSeeAssignment(ctx, a, coveredBy.get(a.id))).map(a => {
    const st = (coveredBy.get(a.id) || []).map(sid => people.get(a.assessmentId + ':' + sid).status);
    return { ...assignmentRow(a), state: assignmentState(a, now), stats: summarize(st) };
  });
  rows = rows.filter(r => (state === 'ALL' || r.state === state) && (!q || (r.assessment + ' ' + r.target).toLowerCase().includes(q)));
  rows.sort((x, y) => new Date(y.createdAt) - new Date(x.createdAt) || y.id - x.id);
  const pg = pageOf(rows, p.get('page'), p.get('pageSize') || 20);

  // ===== ASSIGNMENTS LIST · Totals =====
  // One entry per person per assessment (never double-counted across overlapping assignments).
  const all = [...people.values()];
  const totals = { ...summarize(all.map(x => x.status)), people: new Set(all.map(x => x.staffId)).size, assignments: rows.length };
  return json({
    assignments: pg.rows, page: pg.page, pages: pg.pages, total: pg.total, totals,
    assessments: assessments.map(({ _count, ...a }) => ({ ...a, assignments: _count.assignments })),
    allowed: { all: ctx.visibleDepartmentIds === null, departmentIds: ctx.visibleDepartmentIds },
  });
});

// ===== NEW ASSIGNMENT · Input =====
// One assignment is created per target id (e.g. two departments at once). maxAttempts empty = the assessment's limit.
const Body = z.object({
  assessmentId: z.number().int().positive(), targetType: z.enum(TARGETS), targetIds: z.array(z.number().int().positive()).min(1).max(100),
  startsAt: z.coerce.date(), deadline: z.coerce.date(), maxAttempts: z.number().int().min(1).max(10).nullable().optional(),
});
const TARGET_MODEL = { DEPARTMENT: 'department', GRADE: 'grade', STATION: 'station', LOCATION: 'location' };

export const POST = handle(async req => {
  const ctx = await requirePermission('cycles.assign');
  const b = await readBody(req, Body), now = new Date();

  // ===== NEW ASSIGNMENT · Checks =====
  const assessment = await db.assessment.findUnique({ where: { id: b.assessmentId } });
  if (!assessment) throw badRequest('Choose an assessment.');
  if (assessment.status !== 'PUBLISHED') throw badRequest('Only published assessments can be assigned.');
  const dateErr = checkDates(b.startsAt, b.deadline);
  if (dateErr) throw badRequest(dateErr, { fields: { deadline: [dateErr] } });
  if (b.deadline <= now) throw badRequest('The deadline must be in the future.', { fields: { deadline: ['in the past'] } });
  const targetIds = [...new Set(b.targetIds)];
  for (const id of targetIds) {
    if (b.targetType === 'INDIVIDUAL') {
      const s = await db.staffRecord.findUnique({ where: { id }, select: { id: true, status: true, departmentId: true, supervisorId: true } });
      assertStaffVisible(ctx, s);
      if (s.status !== 'ACTIVE') throw badRequest('Only active staff can be given an assessment.');
    } else {
      if (!targetAllowed(ctx.visibleDepartmentIds, b.targetType, id)) throw forbidden(b.targetType === 'DEPARTMENT' ? 'You can only assign to departments you manage.' : 'Only people who can see every department can assign by grade, station or location.');
      const t = await db[TARGET_MODEL[b.targetType]].findUnique({ where: { id } });
      if (!t) throw badRequest('That ' + TARGET_LABEL[b.targetType].toLowerCase() + ' was not found.');
      if (t.active === false) throw badRequest(t.name + ' is inactive, so it cannot be assigned to.');
    }
  }
  const field = TARGET_FIELD[b.targetType];
  const dup = await db.assessmentAssignment.findFirst({ where: { assessmentId: assessment.id, targetType: b.targetType, [field]: { in: targetIds } } });
  if (dup) throw badRequest('This assessment is already assigned to one of these ' + (b.targetType === 'INDIVIDUAL' ? 'people' : TARGET_LABEL[b.targetType].toLowerCase() + 's') + '. Change that assignment\'s dates instead.');

  // ===== NEW ASSIGNMENT · Save & notify =====
  // Everyone covered is told once (people reached by two of the new targets get one message).
  const result = await db.$transaction(async tx => {
    const created = [], told = new Set();
    let notified = 0;
    for (const id of targetIds) {
      const a = await tx.assessmentAssignment.create({ data: { assessmentId: assessment.id, targetType: b.targetType, [field]: id, startsAt: b.startsAt, deadline: b.deadline, maxAttempts: b.maxAttempts ?? null, createdById: ctx.account.id } });
      await audit({ actorId: ctx.account.id, action: 'assignment.create', entityType: 'AssessmentAssignment', entityId: a.id, after: plain({ assessmentId: assessment.id, title: assessment.title, targetType: b.targetType, targetId: id, startsAt: b.startsAt, deadline: b.deadline, maxAttempts: b.maxAttempts ?? null }), ip: clientIp(req) }, tx);
      const covered = (await tx.staffRecord.findMany({ where: coveredWhere(a), select: { id: true } })).map(s => s.id).filter(sid => !told.has(sid));
      covered.forEach(sid => told.add(sid));
      const accounts = [...(await takerAccounts(covered, tx)).values()].flat();
      notified += await notify({ accountIds: accounts, key: 'assessment.assigned', vars: { title: assessment.title, startsAt: fmtDate(b.startsAt), deadline: fmtDate(b.deadline) }, link: '/assessments', dedupe: 'assigned:' + a.id }, tx);
      created.push(a.id);
    }
    return { created, covered: told.size, notified };
  }, { timeout: 30000 });
  return json(result, 201);
});
