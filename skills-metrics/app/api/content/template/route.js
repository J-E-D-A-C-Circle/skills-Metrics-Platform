// Route GET /api/content/template · download the bulk question upload template (Excel), with an instructions sheet
//   and the list of competency codes
// =============================================================================
// Used by: components/SMContent.jsx (Bulk upload drawer: "Download template")
// Depends on: xlsx, lib/server/{db,session,http,content}
// Sections (search for these markers): TEMPLATE · Build
// Needs "Create drafts & upload questions". Only active competencies are listed.
// =============================================================================
import * as XLSX from 'xlsx';
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { handle } from '@/lib/server/http';
import { TEMPLATE_HEADERS, TEMPLATE_EXAMPLES, TEMPLATE_NOTES } from '@/lib/server/content';

// ===== TEMPLATE · Build =====
export const GET = handle(async () => {
  await requirePermission('forms.create');
  const comps = await db.competency.findMany({ where: { active: true }, orderBy: [{ category: { name: 'asc' } }, { name: 'asc' }], include: { category: true, department: true } });
  const wb = XLSX.utils.book_new();
  const qs = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLES]);
  qs['!cols'] = TEMPLATE_HEADERS.map((h, i) => ({ wch: i === 0 ? 60 : h.startsWith('Option') ? 26 : 18 }));
  XLSX.utils.book_append_sheet(wb, qs, 'Questions');
  const cs = XLSX.utils.aoa_to_sheet([['Code', 'Competency', 'Category', 'Group', 'Department', 'Skill areas'],
    ...comps.map(c => [c.code, c.name, c.category.name, c.category.group, c.department ? c.department.name : 'All departments', Array.isArray(c.skillAreas) ? c.skillAreas.join('; ') : ''])]);
  cs['!cols'] = [{ wch: 12 }, { wch: 44 }, { wch: 12 }, { wch: 36 }, { wch: 26 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, cs, 'Competencies');
  const ns = XLSX.utils.aoa_to_sheet(TEMPLATE_NOTES);
  ns['!cols'] = [{ wch: 120 }];
  XLSX.utils.book_append_sheet(wb, ns, 'How to fill in');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new Response(buf, { headers: { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="question-upload-template.xlsx"', 'Cache-Control': 'no-store' } });
});
