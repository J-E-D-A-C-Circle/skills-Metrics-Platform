// Route POST /api/content/[id]/import · bulk question upload: check every row (mode "check") and, only when every
//   row is valid, add them all in one transaction (mode "import")
// =============================================================================
// Used by: components/SMContent.jsx (Bulk upload drawer)
// Depends on: lib/server/{db,session,audit,http,content}, app/api/content/_shared.js
// Sections (search for these markers): IMPORT · Input, IMPORT · Check, IMPORT · Save
// Needs "Create drafts & upload questions" and the author's own Draft / Returned / Rejected version.
// The browser reads the Excel / CSV file and sends the cells as JSON (size-limited here), so the server never parses
// an uploaded binary file. Nothing is imported while any row has a problem: errors come back by row number.
// =============================================================================
import { z } from 'zod';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, clientIp, ApiError } from '@/lib/server/http';
import { parseImportRows, questionCreate, LIMITS } from '@/lib/server/content';
import { getAssessment, editableVersion, idParam } from '../../_shared';

// ===== IMPORT · Input =====
const Cell = z.union([z.string().max(LIMITS.text + 100), z.number(), z.boolean(), z.null()]);
const Body = z.object({
  mode: z.enum(['check', 'import']),
  replace: z.boolean().optional().default(false),
  fileName: z.string().max(200).optional().default(''),
  rows: z.array(z.array(Cell).max(40)).min(1).max(LIMITS.importRows + 50),
});

export const POST = handle(async (req, { params }) => {
  const ctx = await requirePermission('forms.create');
  const id = await idParam(params);
  const b = await readBody(req, Body);
  const result = await db.$transaction(async tx => {
    const a = await getAssessment(ctx, id, tx);
    const v = await editableVersion(ctx, a, { req, action: 'assessment.questions.import' });

    // ===== IMPORT · Check =====
    const comps = await tx.competency.findMany({ select: { id: true, code: true, name: true, active: true } });
    const existing = b.replace ? [] : (await tx.question.findMany({ where: { versionId: v.id }, select: { text: true } })).map(q => q.text);
    const parsed = parseImportRows(b.rows, comps, existing);
    const clean = !parsed.fileErrors.length && !parsed.errors.length && parsed.questions.length > 0;
    const summary = { total: parsed.total, valid: parsed.questions.length, errors: parsed.errors, fileErrors: parsed.fileErrors,
      preview: parsed.questions.slice(0, 5).map(q => ({ row: q.row, text: q.text, type: q.type, options: q.options.length, correct: q.options.filter(o => o.isCorrect).length })) };
    if (b.mode === 'check') return { ...summary, imported: 0 };
    if (!clean) {
      await audit({ actorId: ctx.account.id, action: 'assessment.questions.import', entityType: 'AssessmentVersion', entityId: v.id, outcome: 'FAILURE', after: { fileName: b.fileName, rows: parsed.total, rowErrors: parsed.errors.length } });
      throw new ApiError(400, 'Nothing was imported: fix the rows listed and upload the file again.', summary);
    }

    // ===== IMPORT · Save =====
    let start = 0;
    if (b.replace) await tx.question.deleteMany({ where: { versionId: v.id } });
    else start = (await tx.question.findFirst({ where: { versionId: v.id }, orderBy: { order: 'desc' }, select: { order: true } }))?.order || 0;
    for (const [i, q] of parsed.questions.entries()) await tx.question.create({ data: questionCreate(v.id, start + i + 1, q) });
    await tx.assessment.update({ where: { id: a.id }, data: { updatedAt: new Date() } });
    await audit({ actorId: ctx.account.id, action: 'assessment.questions.import', entityType: 'AssessmentVersion', entityId: v.id, after: { assessmentId: a.id, versionNo: v.versionNo, fileName: b.fileName, imported: parsed.questions.length, replaced: b.replace }, ip: clientIp(req) }, tx);
    return { ...summary, imported: parsed.questions.length };
  }, { timeout: 120000 });
  return json(result);
});
