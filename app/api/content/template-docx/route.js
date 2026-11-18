// Route GET /api/content/template-docx · download the bulk question upload template as a Word document (.docx)
// =============================================================================
// Used by: components/SMContent.jsx (Bulk upload drawer: "Download Word (.docx) template")
// Depends on: lib/docxTemplate.js, lib/server/{db,session,http}
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { handle } from '@/lib/server/http';
import { createDocxQuestionTemplate } from '@/lib/docxTemplate';

export const GET = handle(async () => {
  await requirePermission('forms.create');
  const comps = await db.competency.findMany({
    where: { active: true },
    orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }],
    select: { code: true, name: true },
  });

  const buf = await createDocxQuestionTemplate(comps);

  return new Response(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': 'attachment; filename="question-upload-template.docx"',
      'Cache-Control': 'no-store',
    },
  });
});
