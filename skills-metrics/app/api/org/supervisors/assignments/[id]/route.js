// Route DELETE /api/org/supervisors/assignments/:id · stop a supervisor / HoD covering a department
// =============================================================================
// Used by: components/SMOrganisation.jsx (Supervisors tab > Department supervisors > Remove)
// Depends on: lib/server/{db,session,audit,http,org}, app/api/org/_lib.js
// Sections (search for these markers): REMOVE SUPERVISOR ASSIGNMENT
// Needs "Manage supervisors" and the department must be one the editor can see. The department is also taken out
// of the account's selected department access (their own department always stays visible to them).
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, forbidden, clientIp, ApiError } from '@/lib/server/http';
import { deptInScope } from '@/lib/server/org';
import { idOf } from '../../../_lib';

// ===== REMOVE SUPERVISOR ASSIGNMENT =====
export const DELETE = handle(async (req, { params }) => {
  const ctx = await requirePermission('org.supervisors');
  const id = await idOf(params, 'Assignment');
  const a = await db.supervisorAssignment.findUnique({ where: { id }, include: { department: true, account: { include: { scopeDepartments: true } } } });
  if (!a) throw new ApiError(404, 'Assignment not found.');
  if (!deptInScope(ctx, a.departmentId)) throw forbidden('You can only change supervisors for departments you can see.');
  const acc = a.account, beforeScope = { scope: acc.deptScope, departments: acc.scopeDepartments.map(d => d.departmentId) };
  await db.$transaction(async tx => {
    await tx.supervisorAssignment.delete({ where: { id } });
    let afterScope = beforeScope;
    if (a.departmentId != null && acc.deptScope === 'SELECTED') {
      await tx.accountScopeDepartment.deleteMany({ where: { accountId: acc.id, departmentId: a.departmentId } });
      const left = beforeScope.departments.filter(d => d !== a.departmentId);
      if (!left.length) await tx.account.update({ where: { id: acc.id }, data: { deptScope: 'OWN' } });
      afterScope = { scope: left.length ? 'SELECTED' : 'OWN', departments: left };
    }
    await audit({ actorId: ctx.account.id, action: 'supervisor.unassign', entityType: 'SupervisorAssignment', entityId: id, before: { accountId: acc.id, username: acc.username, departmentId: a.departmentId, department: a.department?.name, access: beforeScope }, after: { access: afterScope }, ip: clientIp(req) }, tx);
  });
  return json({ ok: true });
});
