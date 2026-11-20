// Route POST /api/org/supervisors/links · set (or clear) the supervisor of one or more staff records
// =============================================================================
// Used by: components/SMOrganisation.jsx (Supervisors tab > Staff and their supervisors)
// Depends on: lib/server/{db,session,scope,audit,http,org}, app/api/org/_lib.js
// Sections (search for these markers): SUPERVISOR LINKS · Checks, SUPERVISOR LINKS · Save
// Needs "Manage supervisors". Every staff record must be in a department the editor can see; the supervisor must be
// an active staff record the editor can see, and the change must not make a loop. Each change is audited.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { assertStaffVisible } from '@/lib/server/scope';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { SupervisorLinkInput, fullName } from '@/lib/server/org';
import { assertCanEdit, loops } from '../../_lib';

// ===== SUPERVISOR LINKS · Checks =====
export const POST = handle(async req => {
  const ctx = await requirePermission('org.supervisors');
  const { staffIds, supervisorId = null } = await readBody(req, SupervisorLinkInput);
  const ids = [...new Set(staffIds)];
  const staff = await db.staffRecord.findMany({ where: { id: { in: ids } } });
  if (staff.length !== ids.length) throw badRequest('One of the staff records was not found.');
  staff.forEach(s => { assertStaffVisible(ctx, s, { allowSelf: false }); assertCanEdit(ctx, s); });
  let sup = null;
  if (supervisorId != null) {
    sup = await db.staffRecord.findUnique({ where: { id: supervisorId } });
    assertStaffVisible(ctx, sup);
    if (sup.status !== 'ACTIVE') throw badRequest('The chosen supervisor\'s staff record is not active.');
    if (ids.includes(supervisorId)) throw badRequest('A person cannot be their own supervisor. Untick ' + fullName(sup) + '.');
    for (const s of staff) if (await loops(s.id, supervisorId)) throw badRequest(fullName(s) + ' already supervises ' + fullName(sup) + ' (directly or further up), so that would make a loop.');
  }

  // ===== SUPERVISOR LINKS · Save =====
  const changing = staff.filter(s => (s.supervisorId ?? null) !== supervisorId);
  await db.$transaction(async tx => {
    for (const s of changing) {
      await tx.staffRecord.update({ where: { id: s.id }, data: { supervisorId } });
      await audit({ actorId: ctx.account.id, action: 'staff.supervisor.change', entityType: 'StaffRecord', entityId: s.id, before: { staffNo: s.staffNo, supervisorId: s.supervisorId }, after: { staffNo: s.staffNo, supervisorId, supervisor: sup ? sup.staffNo : null }, ip: clientIp(req) }, tx);
    }
  });
  return json({ changed: changing.length, unchanged: staff.length - changing.length });
});
