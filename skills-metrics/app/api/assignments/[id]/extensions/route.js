// Route POST /api/assignments/:id/extensions · give one person, or everyone on the assignment, a later deadline
// =============================================================================
// Used by: components/SMAssignments.jsx (Extend deadline dialogs in the assignment drawer)
// Depends on: lib/server/{db,session,scope,audit,notify,http,assigned}, ../../progress.js, ../../rules.js
// Sections (search for these markers): EXTENSION · Input, EXTENSION · Checks, EXTENSION · Save & notify
// Needs "Extend deadlines". Records the original and new deadline, the assessment, the person (or the whole
// assignment), the reason, who approved it and when (DeadlineExtension + audit), then tells the people affected.
// A supervisor may extend for a person they can see; extending for everyone needs the same reach as assigning.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { assertStaffVisible } from '@/lib/server/scope';
import { audit } from '@/lib/server/audit';
import { notify, fmtDate } from '@/lib/server/notify';
import { coveredWhere, deadlineFor } from '@/lib/server/assigned';
import { json, handle, readBody, badRequest, ApiError, clientIp } from '@/lib/server/http';
import { assertCanManage, findAssignment, takerAccounts, allAccounts, plain } from '../../progress';
import { checkExtension } from '../../rules';

// ===== EXTENSION · Input =====
// staffId empty / null = the whole assignment.
const Body = z.object({ staffId: z.number().int().positive().nullable().optional(), newDeadline: z.coerce.date(), reason: z.string().trim().min(5, 'Give a reason of at least 5 characters.').max(500) });

export const POST = handle(async (req, { params }) => {
  const ctx = await requirePermission('cycles.extend');
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, 'Assignment not found.');
  const b = await readBody(req, Body), staffId = b.staffId ?? null;
  const a = await findAssignment(id);

  // ===== EXTENSION · Checks =====
  if (staffId) {
    const s = await db.staffRecord.findUnique({ where: { id: staffId }, select: { id: true, departmentId: true, supervisorId: true } });
    assertStaffVisible(ctx, s);
    if (!(await db.staffRecord.count({ where: { AND: [{ id: staffId }, coveredWhere(a)] } }))) throw badRequest('This person is not covered by this assignment.');
  } else assertCanManage(ctx, a);
  const current = deadlineFor(a, staffId);
  const err = checkExtension(current, b.newDeadline);
  if (err) throw badRequest(err, { fields: { newDeadline: [err] } });

  // ===== EXTENSION · Save & notify =====
  const result = await db.$transaction(async tx => {
    const x = await tx.deadlineExtension.create({ data: { assignmentId: a.id, staffId, originalDeadline: current, newDeadline: b.newDeadline, reason: b.reason, approvedById: ctx.account.id } });
    await audit({ actorId: ctx.account.id, action: 'assignment.extend', entityType: 'AssessmentAssignment', entityId: a.id, before: plain({ deadline: current }), after: plain({ extensionId: x.id, assessmentId: a.assessmentId, title: a.assessment.title, staffId, scope: staffId ? 'person' : 'whole assignment', originalDeadline: current, newDeadline: b.newDeadline, reason: b.reason }), ip: clientIp(req) }, tx);
    const people = staffId ? [staffId] : (await tx.staffRecord.findMany({ where: coveredWhere(a), select: { id: true } })).map(s => s.id);
    const notified = await notify({ accountIds: allAccounts(await takerAccounts(people, tx)), key: 'assessment.extension', vars: { title: a.assessment.title, deadline: fmtDate(b.newDeadline) }, link: '/assessments', dedupe: 'extension:' + x.id }, tx);
    return { extension: { id: x.id, staffId, originalDeadline: current, newDeadline: x.newDeadline }, people: people.length, notified };
  }, { timeout: 30000 });
  return json(result, 201);
});
