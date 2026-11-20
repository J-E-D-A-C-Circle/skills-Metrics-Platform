// Route PATCH /api/org/stations/:id · rename, move to another location, deactivate or reactivate a station
// Route DELETE /api/org/stations/:id · delete a station nothing points at
// =============================================================================
// Used by: components/SMOrganisation.jsx (Stations & Locations tab)
// Depends on: lib/server/{db,session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): STATION · Edit, STATION · Delete
// Needs "Manage structure". Staff placement history keeps pointing at the same station row, so renaming a station
// renames it in history too; deactivate and add a new station when an office really closes.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { handle, readBody, badRequest } from '@/lib/server/http';
import { StationInput } from '@/lib/server/org';
import { idOf, updateStructure, deleteStructure } from '../../_lib';

const LOC = { location: { select: { id: true, name: true, active: true } } };

// ===== STATION · Edit =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  const id = await idOf(params, 'Station');
  const b = await readBody(req, StationInput.partial());
  if (b.locationId !== undefined) {
    const loc = await db.location.findUnique({ where: { id: b.locationId } });
    if (!loc) throw badRequest('Location not found.', { fields: { locationId: ['Not found.'] } });
  }
  return updateStructure(ctx, req, 'station', id, b, LOC);
});

// ===== STATION · Delete =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.structure');
  return deleteStructure(ctx, req, 'station', await idOf(params, 'Station'));
});
