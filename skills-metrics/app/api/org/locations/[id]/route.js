// Route PATCH /api/org/locations/:id · rename, change region, deactivate or reactivate a location
// Route DELETE /api/org/locations/:id · delete a location with no stations or assignments
// =============================================================================
// Used by: components/SMOrganisation.jsx (Stations & Locations tab)
// Depends on: lib/server/{session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): LOCATION · Edit, LOCATION · Delete
// Needs "Manage structure".
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { handle, readBody } from '@/lib/server/http';
import { LocationInput } from '@/lib/server/org';
import { idOf, updateStructure, deleteStructure } from '../../_lib';

// ===== LOCATION · Edit =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  const id = await idOf(params, 'Location');
  const b = await readBody(req, LocationInput.partial());
  return updateStructure(ctx, req, 'location', id, b);
});

// ===== LOCATION · Delete =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  return deleteStructure(ctx, req, 'location', await idOf(params, 'Location'));
});
