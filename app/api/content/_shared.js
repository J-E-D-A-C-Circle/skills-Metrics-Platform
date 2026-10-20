// =============================================================================
// _shared.js · Server code shared by the Assessment Content routes: loading with the visibility check, the
//   editable-version check, list filters and the two extra notification templates
// Screen / URL: Assessment Content (/forms). Not a route itself (Next only serves files named route.js).
// Used by: app/api/content/**/route.js   Depends on: lib/server/{db,http,content}
// Sections (search for these markers): CONTENT API · Visibility, CONTENT API · Loading, CONTENT API · Editable version,
//   CONTENT API · Question input, CONTENT API · Notification templates, CONTENT API · Route params
// =============================================================================
import 'server-only';
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { ApiError, forbidden, clientIp } from '@/lib/server/http';
import { audit } from '@/lib/server/audit';
import { loadAssessment, canSeeVersion, versionAuthorId, EDITABLE, SHARED, LIMITS, QUESTION_TYPES, normaliseQuestion, questionProblems, competencyMap } from '@/lib/server/content';

// ===== CONTENT API · Visibility =====
// Reviewers (Administrators) see every assessment. Everyone else with "View" sees shared content (approved,
// published, archived) plus assessments they created or authored / submitted a version of.
export function visibleWhere(ctx) {
  if (ctx.user.perms.includes('forms.review')) return {};
  const me = ctx.account.id;
  return { OR: [{ status: { in: SHARED } }, { createdById: me }, { versions: { some: { reviewEvents: { some: { actorId: me, action: { in: ['CREATE', 'SUBMIT'] } } } } } }] };
}
export const canSeeAssessment = (ctx, a) => a.versions.some(v => canSeeVersion(ctx.user, v, a));

// ===== CONTENT API · Loading =====
// The assessment with its versions and review events, or 404 when it does not exist or is not visible
// (404, not 403, so hidden drafts are not revealed).
export async function getAssessment(ctx, id, tx = db) {
  const a = await loadAssessment(tx, id);
  if (!a || !canSeeAssessment(ctx, a)) throw new ApiError(404, 'Assessment not found.');
  return a;
}

// ===== CONTENT API · Editable version =====
// The newest version when this person may change it: it is a Draft / Returned / Rejected version they authored and
// the assessment is not archived. Otherwise a clear 403 / 409.
export async function editableVersion(ctx, a, { req, action } = {}) {
  const latest = a.versions[0];
  if (a.status === 'ARCHIVED') throw new ApiError(409, 'This assessment is archived and can no longer be changed.');
  if (!latest || !EDITABLE.includes(latest.status)) throw new ApiError(409, latest && latest.status === 'SUBMITTED' ? 'This version is waiting for review and cannot be changed now.' : 'Published or approved content is never edited. Create a new version to make changes.');
  if (versionAuthorId(latest, a) !== ctx.account.id) {
    if (action) await audit({ actorId: ctx.account.id, action, entityType: 'AssessmentVersion', entityId: latest.id, outcome: 'DENIED', after: { reason: 'not the author' }, ip: req ? clientIp(req) : null });
    throw forbidden('Only the author of this version can change it.');
  }
  return latest;
}

// ===== CONTENT API · Question input =====
// Size limits only; the content rules (options, correct answers, competencies) are checked by questionProblems so the
// editor, the importer and the submit check all give the same messages.
export const QuestionBody = z.object({
  type: z.enum(QUESTION_TYPES), text: z.string().max(LIMITS.text + 50), skillArea: z.string().max(LIMITS.skillArea + 20).nullable().optional(),
  points: z.coerce.number(),
  options: z.array(z.object({ text: z.string().max(LIMITS.option + 20), isCorrect: z.boolean() })).max(LIMITS.options + 2),
  competencies: z.array(z.object({ competencyId: z.coerce.number().int().positive(), weight: z.coerce.number() })).max(LIMITS.competencies + 2),
});
// Tidies a question and refuses it (400 with the list of problems) when it breaks a rule.
export async function checkedQuestion(body, tx = db) {
  const q = normaliseQuestion(body);
  const problems = questionProblems(q, await competencyMap(tx));
  if (problems.length) throw new ApiError(400, problems[0], { problems });
  return q;
}

// ===== CONTENT API · Notification templates =====
// The seeded templates cover approved / rejected / returned. These two are added the first time they are needed
// (create only, so wording an administrator changed in Settings > Notifications is never overwritten).
const EXTRA_TEMPLATES = [
  ['content.submitted', 'Review needed: {title}', '{author} submitted version {versionNo} of {title} for review.'],
  ['content.published', 'Published: {title}', 'Version {versionNo} of {title} is now published and can be assigned.'],
];
export async function ensureTemplates(tx = db) {
  for (const [key, title, body] of EXTRA_TEMPLATES) {
    if (!(await tx.notificationTemplate.findUnique({ where: { key } }))) await tx.notificationTemplate.create({ data: { key, title, body } }).catch(() => {});
  }
}

// ===== CONTENT API · Route params =====
export async function idParam(params, name = 'id') {
  const p = await params;
  const n = Number(p && p[name]);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(404, 'Not found.');
  return n;
}
