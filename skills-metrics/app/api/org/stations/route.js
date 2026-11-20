// Route GET /api/org/stations · stations with their location and how many records point at each
// Route POST /api/org/stations · add a station at a location
// =============================================================================
// Used by: components/SMOrganisation.jsx (Stations & Locations tab)
// Depends on: lib/server/{db,session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): STATIONS · List, STATIONS · Add
// Listing needs "View organisation"; adding needs "Manage structure". A station's name is unique within its location.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { json, handle, readBody, badRequest } from '@/lib/server/http';
import { StationInput } from '@/lib/server/org';
import { listStructure, createStructure } from '../_lib';

const LOC = { location: { select: { id: true, name: true, active: true } } };

// ===== STATIONS · List =====
export const GET = handle(async () => {
  await requirePermission('org.view');
  return json({ rows: await listStructure('station', LOC) });
});

// ===== STATIONS · Add =====
export const POST = handle(async req => {
  const ctx = await requirePermission('org.structure');
  const b = await readBody(req, StationInput);
  const loc = await db.location.findUnique({ where: { id: b.locationId } });
  if (!loc) throw badRequest('Location not found.', { fields: { locationId: ['Not found.'] } });
  if (!loc.active) throw badRequest('That location is no longer active.', { fields: { locationId: ['Inactive.'] } });
  return createStructure(ctx, req, 'station', { name: b.name, locationId: b.locationId, active: b.active ?? true }, LOC);
});
