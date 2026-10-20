// Route POST /api/org/supervisors/mappings · map a grade to a station-manager / supervisory role (at one station or all)
// =============================================================================
// Used by: components/SMOrganisation.jsx (Supervisors tab > Grade-to-station-manager mappings)
// Depends on: lib/server/{db,session,audit,http,org}
// Sections (search for these markers): GRADE MAPPING · Add
// Needs "Manage supervisors". A mapping is a record of who is expected to manage a station; it never grants
// system permissions (those come from roles and ticks only).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { GradeMappingInput } from '@/lib/server/org';

// ===== GRADE MAPPING · Add =====
export const POST = handle(async req => {
  const ctx = await requirePermission('org.supervisors');
  const b = await readBody(req, GradeMappingInput);
  const grade = await db.grade.findUnique({ where: { id: b.gradeId } });
  if (!grade || !grade.active) throw badRequest('Pick an active grade.');
  const station = b.stationId ? await db.station.findUnique({ where: { id: b.stationId } }) : null;
  if (b.stationId && (!station || !station.active)) throw badRequest('Pick an active station, or "All stations".');
  if (await db.gradeSupervisoryMapping.findFirst({ where: { gradeId: b.gradeId, stationId: b.stationId ?? null, roleLabel: { equals: b.roleLabel, mode: 'insensitive' } } })) throw badRequest('That mapping already exists.');
  const row = await db.$transaction(async tx => {
    const r = await tx.gradeSupervisoryMapping.create({ data: { gradeId: b.gradeId, stationId: b.stationId ?? null, roleLabel: b.roleLabel } });
    await audit({ actorId: ctx.account.id, action: 'grade-mapping.create', entityType: 'GradeSupervisoryMapping', entityId: r.id, after: { grade: grade.name, station: station?.name || 'All stations', roleLabel: b.roleLabel }, ip: clientIp(req) }, tx);
    return r;
  });
  return json({ row }, 201);
});
