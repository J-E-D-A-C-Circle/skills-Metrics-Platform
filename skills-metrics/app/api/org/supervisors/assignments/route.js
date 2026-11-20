// Route POST /api/org/supervisors/assignments · make a supervisor / HoD account cover a department
// =============================================================================
// Used by: components/SMOrganisation.jsx (Supervisors tab > Department supervisors)
// Depends on: lib/server/{db,session,audit,http,org}
// Sections (search for these markers): SUPERVISOR ASSIGNMENT · Checks, SUPERVISOR ASSIGNMENT · Save
// Needs "Manage supervisors" and the department must be one the editor can see. Covering a department is what lets
// a supervisor see that department's staff and results: the department is added to the account's department access
// (AccountScopeDepartment, scope "Selected departments") in the same transaction. Accounts with "All departments"
// keep it.
// =============================================================================
import { db } from '@/lib/server/db';
import { requirePermission } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, readBody, badRequest, forbidden, clientIp } from '@/lib/server/http';
import { SupervisorAssignmentInput, deptInScope } from '@/lib/server/org';

// ===== SUPERVISOR ASSIGNMENT · Checks =====
export const POST = handle(async req => {
  const ctx = await requirePermission('org.supervisors');
  const b = await readBody(req, SupervisorAssignmentInput);
  if (!deptInScope(ctx, b.departmentId)) throw forbidden('You can only assign supervisors to departments you can see.');
  const [dept, acc] = await Promise.all([
    db.department.findUnique({ where: { id: b.departmentId } }),
    db.account.findUnique({ where: { id: b.accountId }, include: { roles: true, scopeDepartments: true, staff: { select: { departmentId: true } } } }),
  ]);
  if (!dept) throw badRequest('Department not found.');
  if (!dept.active) throw badRequest('That department is no longer active.');
  if (!acc || acc.status === 'DISABLED') throw badRequest('Account not found.');
  if (ctx.visibleDepartmentIds !== null && !deptInScope(ctx, acc.staff?.departmentId ?? null)) throw badRequest('Account not found.');
  if (!acc.roles.some(r => r.role === 'SUPERVISOR')) throw badRequest('Only accounts with the Manager / Supervisor role can cover a department. Change the role in Settings > User Management first.');
  if (await db.supervisorAssignment.findFirst({ where: { accountId: acc.id, departmentId: dept.id } })) throw badRequest(acc.displayName + ' already covers ' + dept.name + '.');

  // ===== SUPERVISOR ASSIGNMENT · Save =====
  const beforeScope = { scope: acc.deptScope, departments: acc.scopeDepartments.map(d => d.departmentId) };
  const row = await db.$transaction(async tx => {
    const r = await tx.supervisorAssignment.create({ data: { accountId: acc.id, departmentId: dept.id } });
    let afterScope = beforeScope;
    if (acc.deptScope !== 'ALL' && acc.staff?.departmentId !== dept.id) {
      await tx.accountScopeDepartment.upsert({ where: { accountId_departmentId: { accountId: acc.id, departmentId: dept.id } }, create: { accountId: acc.id, departmentId: dept.id }, update: {} });
      if (acc.deptScope === 'OWN') await tx.account.update({ where: { id: acc.id }, data: { deptScope: 'SELECTED' } });
      afterScope = { scope: 'SELECTED', departments: [...new Set([...beforeScope.departments, dept.id])] };
    }
    await audit({ actorId: ctx.account.id, action: 'supervisor.assign', entityType: 'SupervisorAssignment', entityId: r.id, before: { access: beforeScope }, after: { accountId: acc.id, username: acc.username, departmentId: dept.id, department: dept.name, access: afterScope }, ip: clientIp(req) }, tx);
    return r;
  });
  return json({ row }, 201);
});
