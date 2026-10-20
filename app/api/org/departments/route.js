// Route GET /api/org/departments · departments with how many records point at each
// Route POST /api/org/departments · add a department
// =============================================================================
// Used by: components/SMOrganisation.jsx (Departments tab)
// Depends on: lib/server/{session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): DEPARTMENTS · List, DEPARTMENTS · Add
// Listing needs "View organisation"; adding needs "Manage structure". Every change is audited (see _lib.js).
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { json, handle, readBody } from '@/lib/server/http';
import { DepartmentInput } from '@/lib/server/org';
import { listStructure, createStructure } from '../_lib';

// ===== DEPARTMENTS · List =====
export const GET = handle(async () => {
  await requirePermission('org.view');
  return json({ rows: await listStructure('department') });
});

// ===== DEPARTMENTS · Add =====
export const POST = handle(async req => {
  const ctx = await requirePermission('org.structure');
  const b = await readBody(req, DepartmentInput);
  return createStructure(ctx, req, 'department', { code: b.code, name: b.name, active: b.active ?? true });
});
