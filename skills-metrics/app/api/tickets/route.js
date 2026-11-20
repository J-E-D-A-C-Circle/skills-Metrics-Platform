// Route GET /api/tickets · the tickets list (own tickets; assigned tickets for resolvers; all for ticket managers)
// Route POST /api/tickets · raise a new support ticket (anyone signed in)
// =============================================================================
// Used by: components/SMTickets.jsx (list, filters, "New ticket")
// Depends on: lib/server/{db,session,tickets,notify,audit,http}
// Sections (search for these markers): TICKETS LIST · Read, NEW TICKET · Save
// Filters: q (reference, title, description, requester), status (or ACTIVE = not resolved/closed), priority,
//   category, box (raised | assigned), assignee (me | none | id), page, size.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { notify } from '@/lib/server/notify';
import { json, handle, readBody, badRequest, clientIp } from '@/lib/server/http';
import { ListQuery, NewTicket, ticketFilterWhere, ticketListWhere, ticketRow, ticketRole, nextReference, relatedAssessments, assignableAccounts, ensureTicketTemplates, PRIORITY_LABEL } from '@/lib/server/tickets';

// ===== TICKETS LIST · Read =====
export const GET = handle(async req => {
  const ctx = await requireUser(), user = ctx.user;
  const p = ListQuery.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!p.success) throw badRequest('Some filters are not valid.', { fields: p.error.flatten().fieldErrors });
  const f = p.data, where = ticketFilterWhere(user, f);
  const [rows, total, byStatus] = await Promise.all([
    db.ticket.findMany({ where, orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }], skip: (f.page - 1) * f.size, take: f.size,
      include: { requester: { select: { id: true, displayName: true, username: true } }, assignee: { select: { id: true, displayName: true, username: true } }, assessment: { select: { id: true, title: true } } } }),
    db.ticket.count({ where }),
    db.ticket.groupBy({ by: ['status'], where: ticketListWhere(user), _count: { _all: true } }),
  ]);
  const counts = Object.fromEntries(byStatus.map(r => [r.status, r._count._all]));
  return json({ items: rows.map(t => ticketRow(t, ticketRole(user, t))), total, page: f.page, size: f.size, counts });
});

// ===== NEW TICKET · Save =====
// The reference is taken inside the transaction (lib/server/tickets.js nextReference), so two tickets raised at
// the same moment never share a number. Ticket managers are told about every new ticket.
export const POST = handle(async req => {
  const ctx = await requireUser(), b = await readBody(req, NewTicket);
  if (b.assessmentId) {
    const ok = (await relatedAssessments(db, ctx)).some(a => a.id === b.assessmentId);
    if (!ok) throw badRequest('Choose one of your assessments, or leave the assessment empty.', { fields: { assessmentId: ['not available'] } });
  }
  await ensureTicketTemplates(db);
  const managers = (await assignableAccounts(db)).filter(a => a.manager && a.id !== ctx.account.id).map(a => a.id);
  const t = await db.$transaction(async tx => {
    const reference = await nextReference(tx);
    const t = await tx.ticket.create({ data: { reference, requesterId: ctx.account.id, title: b.title, category: b.category, description: b.description, priority: b.priority, assessmentId: b.assessmentId || null } });
    await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: ctx.account.id, field: 'created', toVal: 'OPEN' } });
    await audit({ actorId: ctx.account.id, action: 'ticket.create', entityType: 'Ticket', entityId: t.id, after: { reference, title: b.title, category: b.category, priority: b.priority, assessmentId: b.assessmentId || null }, ip: clientIp(req) }, tx);
    await notify({ accountIds: managers, key: 'ticket.created', vars: { reference, requester: ctx.user.name, title: b.title, priority: PRIORITY_LABEL[b.priority] }, link: '/tickets?id=' + t.id, dedupe: 'ticket-created:' + t.id }, tx);
    return t;
  }, { timeout: 15000 });
  return json({ ticket: { id: t.id, reference: t.reference } }, 201);
});
