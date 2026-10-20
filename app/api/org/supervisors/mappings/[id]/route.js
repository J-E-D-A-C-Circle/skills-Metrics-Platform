// Route DELETE /api/org/supervisors/mappings/:id · remove a grade-to-station-manager mapping
// =============================================================================
// Used by: components/SMOrganisation.jsx (Supervisors tab > Grade-to-station-manager mappings > Remove)
// Depends on: lib/server/{db,session,audit,http}, app/api/org/_lib.js
// Sections (search for these markers): REMOVE GRADE MAPPING
// Needs "Manage supervisors".
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, clientIp, ApiError } from '@/lib/server/http';
import { idOf } from '../../../_lib';

// ===== REMOVE GRADE MAPPING =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.supervisors');
  const id = await idOf(params, 'Mapping');
  const m = await db.gradeSupervisoryMapping.findUnique({ where: { id }, include: { grade: true, station: true } });
  if (!m) throw new ApiError(404, 'Mapping not found.');
  await db.$transaction(async tx => {
    await tx.gradeSupervisoryMapping.delete({ where: { id } });
    await audit({ actorId: ctx.account.id, action: 'grade-mapping.delete', entityType: 'GradeSupervisoryMapping', entityId: id, before: { grade: m.grade.name, station: m.station?.name || 'All stations', roleLabel: m.roleLabel }, ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
