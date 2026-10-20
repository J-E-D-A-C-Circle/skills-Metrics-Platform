// Route GET /api/tickets/:id · one ticket with its messages, history and attachments (internal notes only for the
//   people handling it)
// Route PATCH /api/tickets/:id · change status, priority or assignee ({ status?, priority?, assigneeId? })
// =============================================================================
// Used by: components/SMTickets.jsx (ticket drawer)
// Depends on: lib/server/{db,session,tickets,notify,audit,http}
// Sections (search for these markers): TICKET · Read, TICKET CHANGE · Who may change what, TICKET CHANGE · Save
// Who may change what (lib/server/tickets.js allowedStatuses):
//   ticket managers: assignee, priority and any status · the assignee (Ticket Resolver): In progress, Pending user
//   response, Resolved · the requester: Closed. A ticket someone may not see answers 404.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { json, handle, readBody, badRequest, forbidden, clientIp, ApiError } from '@/lib/server/http';
import { TicketChange, findTicketFor, ticketDetail, allowedStatuses, statusAfterAssign, assignableAccounts, ensureTicketTemplates, STATUS_LABEL, PRIORITY_LABEL } from '@/lib/server/tickets';

const notFound = () => new ApiError(404, 'Ticket not found.');

// ===== TICKET · Read =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requireUser(), hit = await findTicketFor(db, ctx.user, (await params).id);
  if (!hit) throw notFound();
  return json({ ticket: ticketDetail(hit.ticket, hit.role) });
});

// ===== TICKET CHANGE · Who may change what =====
export const PATCH = handle(async (req, { params }) => {
  const ctx = await requireUser(), user = ctx.user, b = await readBody(req, TicketChange);
  const hit = await findTicketFor(db, user, (await params).id, { requester: true, assignee: true });
  if (!hit) throw notFound();
  const { ticket: t, role } = hit;
  if ((b.assigneeId !== undefined || b.priority !== undefined) && role !== 'manager') throw forbidden('Only ticket managers can assign tickets or change their priority.');
  let assignee = t.assignee;
  if (b.assigneeId !== undefined && b.assigneeId !== t.assigneeId) {
    if (b.assigneeId === null) assignee = null;
    else {
      const ok = (await assignableAccounts(db)).find(a => a.id === b.assigneeId);
      if (!ok) throw badRequest('Tickets can only be assigned to people who handle tickets (Ticket Resolver or ticket manager).');
      assignee = await db.account.findUnique({ where: { id: b.assigneeId } });
    }
  }
  const assigneeId = assignee ? assignee.id : null, assigneeChanged = assigneeId !== t.assigneeId;
  let status = assigneeChanged ? statusAfterAssign(t, assigneeId) : t.status;
  if (b.status !== undefined && b.status !== t.status) {
    if (!allowedStatuses(role, { ...t, assigneeId }).includes(b.status)) throw forbidden('You cannot move this ticket to ' + STATUS_LABEL[b.status] + '.');
    status = b.status;
  }
  if (status === 'ASSIGNED' && !assigneeId) throw badRequest('Choose who the ticket is assigned to first.');
  const priority = b.priority ?? t.priority;
  const changes = [];
  if (assigneeChanged) changes.push(['assignee', t.assignee?.displayName || null, assignee?.displayName || null, 'ticket.assign', { assigneeId: t.assigneeId }, { assigneeId }]);
  if (status !== t.status) changes.push(['status', t.status, status, 'ticket.status', { status: t.status }, { status }]);
  if (priority !== t.priority) changes.push(['priority', t.priority, priority, 'ticket.priority', { priority: t.priority }, { priority }]);
  if (!changes.length) throw badRequest('Nothing has changed.');

  // ===== TICKET CHANGE · Save =====
  // One TicketEvent and one audit row per field. The requester hears about status and assignment changes; a new
  // assignee is told the ticket is theirs. Dedupe keys use the event id, so a retry never doubles a notification.
  await ensureTicketTemplates(db);
  const ip = clientIp(req);
  await db.$transaction(async tx => {
    await tx.ticket.update({ where: { id: t.id }, data: { assigneeId, status, priority } });
    let tell = null;
    for (const [field, fromVal, toVal, action, before, after] of changes) {
      const ev = await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: ctx.account.id, field, fromVal, toVal } });
      await audit({ actorId: ctx.account.id, action, entityType: 'Ticket', entityId: t.id, before: { reference: t.reference, ...before }, after: { reference: t.reference, ...after }, ip }, tx);
      if (field !== 'priority' && !tell) tell = ev;
      if (field === 'assignee' && assigneeId && assigneeId !== ctx.account.id)
        await notify({ accountIds: [assigneeId], key: 'ticket.assigned', vars: { reference: t.reference, title: t.title, priority: PRIORITY_LABEL[priority] }, link: '/tickets?id=' + t.id, dedupe: 'ticket-assigned:' + ev.id }, tx);
    }
    if (tell && t.requesterId !== ctx.account.id)
      await notify({ accountIds: [t.requesterId], key: 'ticket.updated', vars: { reference: t.reference, status: STATUS_LABEL[status], title: t.title }, link: '/tickets?id=' + t.id, dedupe: 'ticket-event:' + tell.id }, tx);
  });
  const fresh = await findTicketFor(db, user, t.id);
  return json({ ticket: fresh ? ticketDetail(fresh.ticket, fresh.role) : null });
});
