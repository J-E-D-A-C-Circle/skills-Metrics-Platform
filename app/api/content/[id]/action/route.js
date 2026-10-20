// Route POST /api/content/[id]/action · move content through the review workflow:
//   submit · approve · return · reject · publish · archive · new-version
// =============================================================================
// Used by: components/SMContent.jsx (workflow buttons on the assessment page)
// Depends on: lib/server/{db,session,audit,notify,http,content}, app/api/content/_shared.js
// Sections (search for these markers): WORKFLOW · Input, WORKFLOW · Checks, WORKFLOW · Submit, WORKFLOW · Review,
//   WORKFLOW · Publish, WORKFLOW · Archive, WORKFLOW · New version
// Permissions: submit = "Edit & submit drafts" (author only) · approve / return / reject = "Review content" ·
//   publish = "Publish content" (both Administrator-only, lib/permissions.js) · archive = "Archive content" ·
//   new-version = "Create drafts". Nobody may approve or publish a version they authored or submitted.
// Every change checks the version's CURRENT status inside the transaction (a conditional update), records an
// AssessmentReviewEvent, writes the audit log and sends notifications.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { notify, adminAccounts } from '@/lib/server/notify';
import { json, handle, readBody, clientIp, ApiError, forbidden } from '@/lib/server/http';
import { TRANSITIONS, STATUS_LABEL, LIMITS, isOwnWork, versionAuthorId, assessmentProblems, competencyMap, plainQuestion, QUESTION_INCLUDE, questionCreate, syncAssessmentStatus, pendingKey, IN_PROGRESS, EDITABLE } from '@/lib/server/content';
import { getAssessment, editableVersion, idParam, ensureTemplates } from '../../_shared';

// ===== WORKFLOW · Input =====
// versionId: the version the person was looking at, so they never act on a version that changed meanwhile.
const Body = z.object({
  action: z.enum(['submit', 'approve', 'return', 'reject', 'publish', 'archive', 'new-version']),
  versionId: z.coerce.number().int().positive(),
  feedback: z.string().trim().max(LIMITS.feedback).optional().default(''),
});
const PERM = { submit: 'forms.edit', approve: 'forms.review', return: 'forms.review', reject: 'forms.review', publish: 'forms.publish', archive: 'forms.archive', 'new-version': 'forms.create' };
const CHANGED = 'This version has changed since you opened it. Refresh the page and try again.';

export const POST = handle(async (req, { params }) => {
  const id = await idParam(params);
  const b = await readBody(req, Body);
  const ctx = await requirePermission(PERM[b.action]);
  const me = ctx.account.id, ip = clientIp(req);
  await ensureTemplates();

  const out = await db.$transaction(async tx => {
    // ===== WORKFLOW · Checks =====
    const a = await getAssessment(ctx, id, tx);
    const v = a.versions.find(x => x.id === b.versionId);
    if (!v) throw new ApiError(404, 'Version not found.');
    if (a.status === 'ARCHIVED') throw new ApiError(409, 'This assessment is archived.');
    const t = TRANSITIONS[b.action];
    if (t && !t.from.includes(v.status)) throw new ApiError(409, 'Version ' + v.versionNo + ' is ' + STATUS_LABEL[v.status].toLowerCase() + ', so it cannot be ' + { submit: 'submitted', approve: 'approved', return: 'returned', reject: 'rejected', publish: 'published' }[b.action] + '.');
    if (t && t.feedback && b.feedback.length < 5) throw new ApiError(400, 'Write feedback for the author (at least a few words) so they know what to change.', { fields: { feedback: ['required'] } });
    if (['approve', 'return', 'reject', 'publish'].includes(b.action) && isOwnWork(me, v, a)) {
      await audit({ actorId: me, action: 'assessment.' + b.action, entityType: 'AssessmentVersion', entityId: v.id, outcome: 'DENIED', after: { reason: 'own work' }, ip });
      throw forbidden('You cannot ' + b.action + ' content you created or submitted. Another administrator must do this.');
    }
    const authorId = versionAuthorId(v, a);
    const authors = [...new Set([authorId, ...v.reviewEvents.filter(e => e.action === 'SUBMIT').map(e => e.actorId)].filter(Boolean))];
    const vars = { title: a.title, versionNo: v.versionNo, reviewer: ctx.user.name, author: ctx.user.name, feedback: b.feedback || '—' };
    const link = '/forms?id=' + a.id;
    const event = (action, feedback, versionId = v.id) => tx.assessmentReviewEvent.create({ data: { versionId, actorId: me, action, feedback: feedback || null } });
    // Conditional update: succeeds only if the status is still what we checked.
    const move = async (from, data) => { const r = await tx.assessmentVersion.updateMany({ where: { id: v.id, status: { in: from } }, data }); if (r.count !== 1) throw new ApiError(409, CHANGED); };

    // ===== WORKFLOW · Submit =====
    // Only the author; the content must pass every check first (the problems come back to the screen).
    if (b.action === 'submit') {
      const latest = await editableVersion(ctx, a, { req, action: 'assessment.submit' });
      if (latest.id !== v.id) throw new ApiError(409, CHANGED);
      const pending = await tx.systemSetting.findUnique({ where: { key: pendingKey(v.id) } });
      const qs = (await tx.question.findMany({ where: { versionId: v.id }, orderBy: { order: 'asc' }, include: QUESTION_INCLUDE })).map(plainQuestion);
      const issues = assessmentProblems({ title: pending?.value?.title ?? a.title, questions: qs }, await competencyMap(tx));
      if (issues.length) throw new ApiError(400, 'Fix ' + issues.length + ' problem' + (issues.length === 1 ? '' : 's') + ' before submitting.', { issues });
      await move(EDITABLE, { status: 'SUBMITTED', submittedAt: new Date() });
      await event('SUBMIT', b.feedback);
      await notify({ accountIds: (await adminAccounts(tx)).filter(x => x !== me), key: 'content.submitted', vars: { ...vars, author: ctx.user.name }, link, dedupe: 'content.submitted:' + v.id + ':' + Date.now() }, tx);
    }

    // ===== WORKFLOW · Review =====
    // Approve, return for revision (author edits and resubmits) or reject (author may still revise and resubmit).
    if (['approve', 'return', 'reject'].includes(b.action)) {
      await move(['SUBMITTED'], b.action === 'approve' ? { status: 'APPROVED', approvedById: me, approvedAt: new Date() } : { status: t.to });
      await event(t.event, b.feedback);
      await notify({ accountIds: authors.filter(x => x !== me), key: { approve: 'content.approved', return: 'content.returned', reject: 'content.rejected' }[b.action], vars, link, dedupe: 'content.' + b.action + ':' + v.id + ':' + Date.now() }, tx);
    }

    // ===== WORKFLOW · Publish =====
    // The approved version goes live; any older live or approved version is marked Archived (superseded) but keeps
    // its attempts and results. Settings waiting for this version are applied now.
    if (b.action === 'publish') {
      const live = a.versions.find(x => x.status === 'PUBLISHED');
      if (live && live.versionNo > v.versionNo) throw new ApiError(409, 'A newer version is already published.');
      await move(['APPROVED'], { status: 'PUBLISHED', publishedById: me, publishedAt: new Date() });
      await event('PUBLISH', b.feedback);
      for (const old of a.versions.filter(x => x.versionNo < v.versionNo && ['PUBLISHED', 'APPROVED'].includes(x.status))) {
        await tx.assessmentVersion.update({ where: { id: old.id }, data: { status: 'ARCHIVED' } });
        await event('SUPERSEDE', 'Replaced by version ' + v.versionNo, old.id);
      }
      const pending = await tx.systemSetting.findUnique({ where: { key: pendingKey(v.id) } });
      if (pending) { await tx.assessment.update({ where: { id: a.id }, data: pending.value }); await tx.systemSetting.delete({ where: { key: pending.key } }); }
      await notify({ accountIds: authors.filter(x => x !== me), key: 'content.published', vars, link, dedupe: 'content.published:' + v.id }, tx);
    }

    // ===== WORKFLOW · Archive =====
    // Retires the whole assessment: it can no longer be assigned or started; attempts and results stay. Versions still
    // being written or reviewed are closed too, so nothing is left waiting for review.
    if (b.action === 'archive') {
      for (const x of a.versions.filter(x => ['PUBLISHED', 'APPROVED', 'DRAFT', 'SUBMITTED', 'RETURNED'].includes(x.status))) await tx.assessmentVersion.update({ where: { id: x.id }, data: { status: 'ARCHIVED' } });
      await event('ARCHIVE', b.feedback, a.versions[0].id);
      await tx.assessment.update({ where: { id: a.id }, data: { status: 'ARCHIVED' } });
    }

    // ===== WORKFLOW · New version =====
    // Copies the questions of the newest (approved or published) version into versionNo + 1 as a Draft for this person.
    let newVersion = null;
    if (b.action === 'new-version') {
      const latest = a.versions[0];
      if (latest.id !== v.id) throw new ApiError(409, CHANGED);
      if (a.versions.some(x => IN_PROGRESS.includes(x.status))) throw new ApiError(409, 'Version ' + a.versions.find(x => IN_PROGRESS.includes(x.status)).versionNo + ' is already being worked on.');
      if (!['APPROVED', 'PUBLISHED'].includes(v.status)) throw new ApiError(409, 'Only approved or published content can be copied into a new version.');
      const cfg = await tx.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } });
      newVersion = await tx.assessmentVersion.create({ data: { assessmentId: a.id, versionNo: v.versionNo + 1, status: 'DRAFT', scoringConfigId: cfg?.id ?? v.scoringConfigId } });
      await event('CREATE', 'Copied from version ' + v.versionNo, newVersion.id);
      const qs = (await tx.question.findMany({ where: { versionId: v.id }, orderBy: { order: 'asc' }, include: QUESTION_INCLUDE })).map(plainQuestion);
      for (const q of qs) await tx.question.create({ data: questionCreate(newVersion.id, q.order, q) });
    }

    const status = await syncAssessmentStatus(tx, a.id);
    await audit({ actorId: me, action: 'assessment.' + (b.action === 'new-version' ? 'version.create' : b.action), entityType: 'AssessmentVersion', entityId: newVersion ? newVersion.id : v.id,
      before: { status: v.status, versionNo: v.versionNo }, after: { assessmentId: a.id, assessmentStatus: status, versionNo: newVersion ? newVersion.versionNo : v.versionNo, feedback: b.feedback || undefined }, ip }, tx);
    return { status, versionNo: newVersion ? newVersion.versionNo : v.versionNo };
  }, { timeout: 60000 });
  return json({ ok: true, ...out });
});
