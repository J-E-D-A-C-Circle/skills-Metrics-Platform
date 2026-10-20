// Route GET /api/content · the Assessment Content list (search, status filter, paging)
// Route POST /api/content · create a new assessment draft (version 1, Draft), optionally with who it is for
//   (the planned audience, assigned automatically when it is published: lib/server/audience.js)
// =============================================================================
// Used by: components/SMContent.jsx (list and "New assessment")
// Depends on: lib/server/{db,session,audit,http,content,audience}, app/api/content/_shared.js
// Sections (search for these markers): CONTENT LIST · Filters, CONTENT LIST · Read, NEW DRAFT · Input, NEW DRAFT · Save
// Needs "View assessment content" to list and "Create drafts" to create. Creators see shared content plus their own;
// Administrators see everything.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp } from '@/lib/server/http';
import { STATUSES, LIMITS, versionAuthorId, syncAssessmentStatus } from '@/lib/server/content';
import { checkedPlan, AudienceBody } from '@/lib/server/audience';
import { visibleWhere } from './_shared';

// ===== CONTENT LIST · Filters =====
// status: an Assessment status, or REVIEW (a version waiting for review). Draft / Returned / Rejected / Submitted also
// match a newer version in that state, so a published assessment with a draft in progress is found under Draft too.
function statusWhere(status) {
  if (status === 'REVIEW') return { versions: { some: { status: 'SUBMITTED' } } };
  if (!STATUSES.includes(status)) return {};
  if (['PUBLISHED', 'ARCHIVED', 'APPROVED'].includes(status)) return { status };
  return { OR: [{ status }, { versions: { some: { status } } }] };
}

// ===== CONTENT LIST · Read =====
export const GET = handle(async req => {
  const ctx = await requirePermission('forms.view');
  const sp = req.nextUrl.searchParams;
  const q = (sp.get('q') || '').trim().slice(0, 100);
  const size = Math.min(50, Math.max(5, Number(sp.get('size')) || 20));
  const page = Math.max(1, Number(sp.get('page')) || 1);
  const mine = sp.get('mine') === '1';
  const base = visibleWhere(ctx);
  const and = [base];
  if (q) and.push({ OR: [{ title: { contains: q, mode: 'insensitive' } }, { description: { contains: q, mode: 'insensitive' } }] });
  if (mine) and.push({ OR: [{ createdById: ctx.account.id }, { versions: { some: { reviewEvents: { some: { actorId: ctx.account.id, action: 'CREATE' } } } } }] });
  const filtered = { AND: [...and, statusWhere(sp.get('status') || '')] };
  const sort = sp.get('sort') === 'title' ? [{ title: 'asc' }, { id: 'asc' }] : [{ updatedAt: 'desc' }, { id: 'desc' }];
  const [total, rows, groups, review] = await Promise.all([
    db.assessment.count({ where: filtered }),
    db.assessment.findMany({ where: filtered, orderBy: sort, skip: (page - 1) * size, take: size, include: {
      createdBy: { select: { id: true, displayName: true } },
      versions: { orderBy: { versionNo: 'desc' }, include: { reviewEvents: { where: { action: { in: ['CREATE', 'SUBMIT'] } }, select: { action: true, actorId: true } }, _count: { select: { questions: true, attempts: true } } } },
    } }),
    db.assessment.groupBy({ by: ['status'], where: { AND: and }, _count: { _all: true } }),
    db.assessment.count({ where: { AND: [...and, statusWhere('REVIEW')] } }),
  ]);
  const counts = Object.fromEntries(groups.map(g => [g.status, g._count._all]));
  return json({
    page, size, total, counts, review,
    rows: rows.map(a => {
      const latest = a.versions[0], live = a.versions.find(v => v.status === 'PUBLISHED');
      return {
        id: a.id, title: a.title, status: a.status, createdBy: a.createdBy.displayName, updatedAt: a.updatedAt, source: a.sourceRef ? 'DVLA question bank' : null,
        versionNo: latest?.versionNo ?? null, versionStatus: latest?.status ?? null, liveVersionNo: live?.versionNo ?? null,
        questions: latest?._count.questions ?? 0, attempts: a.versions.reduce((s, v) => s + v._count.attempts, 0),
        mine: !!latest && versionAuthorId(latest, a) === ctx.account.id,
      };
    }),
  });
});

// ===== NEW DRAFT · Input =====
const Body = z.object({
  title: z.string().trim().min(3, 'Enter a title of at least 3 characters.').max(LIMITS.title),
  description: z.string().trim().max(LIMITS.description).optional().default(''),
  instructions: z.string().trim().max(LIMITS.instructions).optional().default(''),
  maxAttempts: z.coerce.number().int().min(1).max(LIMITS.maxAttempts).optional(),
  resultRelease: z.enum(['IMMEDIATE', 'AFTER_DEADLINE', 'MANUAL']).optional().default('IMMEDIATE'),
  audience: AudienceBody,
});

// ===== NEW DRAFT · Save =====
// The attempt limit defaults to the newest active scoring configuration's defaultMaxAttempts (3).
export const POST = handle(async req => {
  const ctx = await requirePermission('forms.create');
  const b = await readBody(req, Body);
  const created = await db.$transaction(async tx => {
    const cfg = await tx.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } });
    const plan = await checkedPlan(tx, ctx, b.audience);
    const a = await tx.assessment.create({ data: {
      title: b.title, description: b.description || null, instructions: b.instructions || null, createdById: ctx.account.id, status: 'DRAFT',
      maxAttempts: b.maxAttempts ?? cfg?.defaultMaxAttempts ?? 3, resultRelease: b.resultRelease, ...(plan ? { plannedAssignment: plan } : {}),
    } });
    const v = await tx.assessmentVersion.create({ data: { assessmentId: a.id, versionNo: 1, status: 'DRAFT', scoringConfigId: cfg?.id ?? null } });
    await tx.assessmentReviewEvent.create({ data: { versionId: v.id, actorId: ctx.account.id, action: 'CREATE' } });
    await syncAssessmentStatus(tx, a.id);
    await audit({ actorId: ctx.account.id, action: 'assessment.create', entityType: 'Assessment', entityId: a.id, after: { title: a.title, maxAttempts: a.maxAttempts, resultRelease: a.resultRelease, versionNo: 1, plannedAssignment: plan }, ip: clientIp(req) }, tx);
    return a;
  });
  return json({ id: created.id }, 201);
});
