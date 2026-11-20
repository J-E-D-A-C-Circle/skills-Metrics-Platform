// Route POST /api/tickets/:id/messages · add a reply ({ body }) or an internal note ({ body, internal: true })
// =============================================================================
// Used by: components/SMTickets.jsx (ticket drawer: Reply / Internal note)
// Depends on: lib/server/{db,session,tickets,notify,audit,http}
// Sections (search for these markers): TICKET MESSAGE · Checks, TICKET MESSAGE · Save
// Internal notes: ticket managers and the assignee only; never shown to the requester (filtered on the server).
// A requester answering a ticket that is "Pending user response" or "Resolved" hands it back to the support team.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { json, handle, readBody, badRequest, forbidden, clientIp, ApiError } from '@/lib/server/http';
import { NewMessage, findTicketFor, ticketDetail, seesInternal, statusAfterRequesterReply, assignableAccounts, ensureTicketTemplates, STATUS_LABEL } from '@/lib/server/tickets';

// ===== TICKET MESSAGE · Checks =====
export const POST = handle(async (req, { params }) => {
  const ctx = await requireUser(), user = ctx.user, b = await readBody(req, NewMessage);
  const hit = await findTicketFor(db, user, (await params).id, {});
  if (!hit) throw new ApiError(404, 'Ticket not found.');
  const { ticket: t, role } = hit;
  if (t.status === 'CLOSED') throw badRequest('This ticket is closed. Raise a new ticket if you still need help.');
  if (b.internal && !seesInternal(role)) throw forbidden('Only the people handling this ticket can add internal notes.');
  const me = ctx.account.id, fromRequester = role === 'requester';
  let status = t.status;
  if (!b.internal && fromRequester) status = statusAfterRequesterReply(t);
  if (!b.internal && role === 'assignee' && t.status === 'ASSIGNED') status = 'IN_PROGRESS';

  // ===== TICKET MESSAGE · Save =====
  // Public replies from the support side notify the requester; replies from the requester notify the assignee
  // (or the ticket managers when nobody is assigned). Internal notes notify nobody outside the support team.
  await ensureTicketTemplates(db);
  const managers = fromRequester && !t.assigneeId ? (await assignableAccounts(db)).filter(a => a.manager && a.id !== me).map(a => a.id) : [];
  const ip = clientIp(req);
  await db.$transaction(async tx => {
    const m = await tx.ticketMessage.create({ data: { ticketId: t.id, authorId: me, body: b.body, internal: b.internal } });
    await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: me, field: b.internal ? 'note' : 'reply' } });
    await audit({ actorId: me, action: b.internal ? 'ticket.note' : 'ticket.reply', entityType: 'Ticket', entityId: t.id, after: { reference: t.reference, messageId: m.id, internal: b.internal }, ip }, tx);
    if (status !== t.status) {
      await tx.ticket.update({ where: { id: t.id }, data: { status } });
      await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: me, field: 'status', fromVal: t.status, toVal: status } });
      await audit({ actorId: me, action: 'ticket.status', entityType: 'Ticket', entityId: t.id, before: { reference: t.reference, status: t.status }, after: { reference: t.reference, status, reason: 'reply' }, ip }, tx);
    } else await tx.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
    if (b.internal) return;
    if (fromRequester) {
      const to = t.assigneeId ? [t.assigneeId] : managers;
      await notify({ accountIds: to.filter(x => x !== me), key: 'ticket.activity', vars: { reference: t.reference, actor: user.name, title: t.title }, link: '/tickets?id=' + t.id, dedupe: 'ticket-msg:' + m.id }, tx);
    } else if (t.requesterId !== me) {
      await notify({ accountIds: [t.requesterId], key: 'ticket.updated', vars: { reference: t.reference, status: STATUS_LABEL[status], title: t.title }, link: '/tickets?id=' + t.id, dedupe: 'ticket-msg:' + m.id }, tx);
    }
  });
  const fresh = await findTicketFor(db, user, t.id);
  return json({ ticket: fresh ? ticketDetail(fresh.ticket, fresh.role) : null }, 201);
});
