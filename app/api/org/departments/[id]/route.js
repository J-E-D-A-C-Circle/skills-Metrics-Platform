// Route PATCH /api/org/departments/:id · rename, change code, deactivate or reactivate a department
// Route DELETE /api/org/departments/:id · delete a department nothing points at
// =============================================================================
// Used by: components/SMOrganisation.jsx (Departments tab)
// Depends on: lib/server/{session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): DEPARTMENT · Edit, DEPARTMENT · Delete
// Needs "Manage structure". Deactivating keeps the name on old results; delete is refused while anything uses it.
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { handle, readBody } from '@/lib/server/http';
import { DepartmentInput } from '@/lib/server/org';
import { idOf, updateStructure, deleteStructure } from '../../_lib';

// ===== DEPARTMENT · Edit =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  const id = await idOf(params, 'Department');
  const b = await readBody(req, DepartmentInput.partial());
  return updateStructure(ctx, req, 'department', id, b);
});

// ===== DEPARTMENT · Delete =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  return deleteStructure(ctx, req, 'department', await idOf(params, 'Department'));
});
