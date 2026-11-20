// Route GET /api/org/locations · locations (with region) and how many stations and assignments use each
// Route POST /api/org/locations · add a location
// =============================================================================
// Used by: components/SMOrganisation.jsx (Stations & Locations tab)
// Depends on: lib/server/{session,http,org}, app/api/org/_lib.js
// Sections (search for these markers): LOCATIONS · List, LOCATIONS · Add
// Listing needs "View organisation"; adding needs "Manage structure". Every change is audited (see _lib.js).
// =============================================================================
import { requirePermission } from '@/lib/server/session';
import { json, handle, readBody } from '@/lib/server/http';
import { LocationInput } from '@/lib/server/org';
import { listStructure, createStructure } from '../_lib';

// ===== LOCATIONS · List =====
export const GET = handle(async () => {
  await requirePermission('org.view');
  return json({ rows: await listStructure('location') });
});

// ===== LOCATIONS · Add =====
export const POST = handle(async req => {
  const ctx = await requirePermission('org.structure');
  const b = await readBody(req, LocationInput);
  return createStructure(ctx, req, 'location', { name: b.name, region: b.region ?? null, active: b.active ?? true });
});
