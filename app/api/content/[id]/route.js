// Route GET /api/content/[id] · one assessment: settings, versions, review history, one version's questions, the
//   problems that would stop it being submitted, and which buttons this person may use
// Route PATCH /api/content/[id] · change the settings (title, description, instructions, attempt limit, result release)
//   and who it is for (the planned audience, assigned when it is published)
// =============================================================================
// Used by: components/SMContent.jsx (assessment page: Questions, Settings, Versions & history, Preview)
// Depends on: lib/server/{db,session,audit,http,content,audience}, app/api/content/_shared.js
// Sections (search for these markers): CONTENT ITEM · Read, CONTENT ITEM · Settings input, CONTENT ITEM · Save settings
// GET needs "View assessment content"; PATCH needs "Edit & submit drafts" and only works on the author's own
// Draft / Returned / Rejected version. While a published version is live, new settings wait until the new version
// is published (kept in SystemSetting "content.pending-settings.<versionId>"), so live content never changes.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp, ApiError } from '@/lib/server/http';
import { canSeeVersion, allowedActions, versionRow, plainQuestion, assessmentProblems, competencyMap, QUESTION_INCLUDE, pendingKey, SETTING_FIELDS, LIMITS, EDITABLE, ACTION_LABEL } from '@/lib/server/content';
import { checkedPlan, describePlan, AudienceBody } from '@/lib/server/audience';
import { getAssessment, editableVersion, idParam } from '../_shared';

const settingsOf = a => Object.fromEntries(SETTING_FIELDS.map(k => [k, a[k] ?? (k === 'description' || k === 'instructions' ? '' : a[k])]));

// ===== CONTENT ITEM · Read =====
// ?version=<versionNo> picks the version whose questions are returned (default: the newest one this person may see).
export const GET = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.view');
  const a = await getAssessment(ctx, await idParam(params));
  const visible = a.versions.filter(v => canSeeVersion(ctx.user, v, a));
  const want = Number(req.nextUrl.searchParams.get('version'));
  const sel = visible.find(v => v.versionNo === want) || visible[0];
  const [questions, comps, pending, audience] = await Promise.all([
    db.question.findMany({ where: { versionId: sel.id }, orderBy: { order: 'asc' }, include: QUESTION_INCLUDE }),
    db.competency.findMany({ orderBy: { name: 'asc' }, include: { category: true } }),
    db.systemSetting.findUnique({ where: { key: pendingKey(a.versions[0].id) } }),
    describePlan(db, ctx, a.plannedAssignment),
  ]);
  const plain = questions.map(plainQuestion);
  const can = allowedActions(ctx.user, a, a.versions);
  const compMap = new Map(comps.map(c => [c.id, c]));
  // Problems are worked out for versions still being written or in review (approved content was checked already).
  const issues = ['DRAFT', 'RETURNED', 'REJECTED', 'SUBMITTED'].includes(sel.status) ? assessmentProblems({ title: (pending?.value?.title) ?? a.title, questions: plain }, compMap) : [];
  const measured = [...new Map(plain.flatMap(q => q.competencies).map(c => [c.competencyId, compMap.get(c.competencyId)]).filter(([, c]) => c)).values()];
  const visibleIds = new Set(visible.map(v => v.id));
  const history = a.versions.filter(v => visibleIds.has(v.id)).flatMap(v => v.reviewEvents.map(e => ({ id: e.id, versionNo: v.versionNo, action: e.action, label: ACTION_LABEL[e.action] || e.action, actor: e.actor.displayName, feedback: e.feedback, at: e.at })))
    .sort((x, y) => new Date(y.at) - new Date(x.at) || y.id - x.id);
  return json({
    assessment: { id: a.id, title: a.title, description: a.description, instructions: a.instructions, maxAttempts: a.maxAttempts, resultRelease: a.resultRelease, status: a.status,
      source: a.sourceRef ? 'DVLA question bank' : null, createdBy: a.createdBy.displayName, createdAt: a.createdAt, updatedAt: a.updatedAt,
      liveVersionNo: a.versions.find(v => v.status === 'PUBLISHED')?.versionNo ?? null },
    settings: { ...settingsOf(a), ...(pending ? pending.value : {}) }, settingsPending: !!pending,
    audience, canPickPeople: ctx.user.perms.includes('cycles.assign'),
    versions: a.versions.map(v => ({ ...versionRow(v, a), visible: visibleIds.has(v.id) })),
    history,
    version: { id: sel.id, versionNo: sel.versionNo, status: sel.status, questions: plain },
    measured: measured.map(c => ({ id: c.id, code: c.code, name: c.name, category: c.category.name, group: c.category.group })),
    competencies: comps.map(c => ({ id: c.id, code: c.code, name: c.name, short: c.short, active: c.active, category: c.category.name, group: c.category.group, skillAreas: Array.isArray(c.skillAreas) ? c.skillAreas : [] })),
    issues, can,
  });
});

// ===== CONTENT ITEM · Settings input =====
const Body = z.object({
  title: z.string().trim().min(3, 'Enter a title of at least 3 characters.').max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description),
  instructions: z.string().trim().max(LIMITS.instructions),
  departmentId: z.coerce.number().int().positive().nullable().optional(),
  skillType: z.enum(['GENERAL', 'TECHNICAL']).optional(),
  jobLevel: z.string().trim().nullable().optional(),
  maxAttempts: z.coerce.number().int().min(1).max(LIMITS.maxAttempts).optional().default(3),
  resultRelease: z.enum(['IMMEDIATE', 'AFTER_DEADLINE', 'MANUAL']),
  audience: AudienceBody, // omitted = unchanged · null = decide later on the Assignments page
});

// ===== CONTENT ITEM · Save settings =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.edit');
  const id = await idParam(params);
  const b = await readBody(req, Body);
  const result = await db.$transaction(async tx => {
    const a = await getAssessment(ctx, id, tx);
    const v = await editableVersion(ctx, a, { req, action: 'assessment.settings' });
    if (!EDITABLE.includes(v.status)) throw new ApiError(409, 'This version cannot be changed now.');
    const { audience, ...rest } = b;
    const before = settingsOf(a);
    const after = { ...rest, description: rest.description || null, instructions: rest.instructions || null };
    // Who it is for is stored straight away (it is a plan; nothing is assigned until publishing).
    if (audience !== undefined) {
      if (a.plannedAssignment && a.plannedAssignment.done) throw new ApiError(409, 'The planned audience was already assigned when this assessment was published. Make changes on the Assignments page.');
      const plan = await checkedPlan(tx, ctx, audience);
      await tx.assessment.update({ where: { id: a.id }, data: { plannedAssignment: plan ?? null } });
      await audit({ actorId: ctx.account.id, action: 'assessment.audience', entityType: 'Assessment', entityId: a.id, before: { plannedAssignment: a.plannedAssignment ?? null }, after: { plannedAssignment: plan }, ip: clientIp(req) }, tx);
    }
    const live = a.versions.some(x => x.status === 'PUBLISHED');
    if (live) await tx.systemSetting.upsert({ where: { key: pendingKey(v.id) }, update: { value: after, updatedById: ctx.account.id }, create: { key: pendingKey(v.id), value: after, updatedById: ctx.account.id } });
    else await tx.assessment.update({ where: { id: a.id }, data: after });
    await audit({ actorId: ctx.account.id, action: 'assessment.settings', entityType: 'Assessment', entityId: a.id, before, after: { ...after, versionNo: v.versionNo, waitsForPublish: live }, ip: clientIp(req) }, tx);
    return { pending: live };
  });
  return json({ ok: true, ...result });
});
