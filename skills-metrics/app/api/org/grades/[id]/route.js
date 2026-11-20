// Route PATCH /api/org/grades/:id · rename, deactivate or reactivate a grade
// Route DELETE /api/org/grades/:id · delete a grade nothing points at
// =============================================================================
// Used by: components/SMOrganisation.jsx (Grades tab)
// Depends on: lib/server/{session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): GRADE · Edit, GRADE · Delete
// Needs "Manage structure". The order is changed with PUT /api/org/grades/order.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { handle, readBody } from '@/lib/server/http';
import { GradeInput } from '@/lib/server/org';
import { idOf, updateStructure, deleteStructure } from '../../_lib';

// ===== GRADE · Edit =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  const id = await idOf(params, 'Grade');
  const b = await readBody(req, GradeInput.partial());
  return updateStructure(ctx, req, 'grade', id, b);
});

// ===== GRADE · Delete =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  return deleteStructure(ctx, req, 'grade', await idOf(params, 'Grade'));
});
