// =============================================================================
// tickets.js · Support ticket rules: reference numbers, who sees which ticket, what each person may do, internal
//   notes, attachment checks and file storage
// Screen / URL: Support Tickets (/tickets, /tickets?id=12)
// Used by: app/api/tickets/**, tests/tickets.test.js   Depends on: zod, lib/permissions.js, node:path, node:fs, node:crypto
// Sections (search for these markers): TICKETS · Lists & labels, TICKETS · Reference numbers, TICKETS · Who sees what,
//   TICKETS · What each person may do, TICKETS · Status changes, TICKETS · Input checks, TICKETS · Attachments,
//   TICKETS · File storage, TICKETS · Notification templates, TICKETS · Loading, TICKETS · Shaping for the browser
// Kept free of database imports so the rules can be unit-tested; functions that touch the database take the Prisma
//   client (or transaction) as an argument.
// Least privilege (Skills Metrics prompt, section 20):
//   - tickets.manage (Administrators): every ticket; assign, priority, any status, replies and internal notes.
//   - tickets.resolve (Ticket Resolver): ONLY tickets assigned to them; reply, internal note, working statuses.
//   - Everyone else: their own tickets, public messages only. Internal notes never leave the server for them.
// =============================================================================
import { z } from 'zod';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { effectivePermissions } from '../permissions.js';

// ===== TICKETS · Lists & labels =====
export const CATEGORIES = ['Account access', 'Assessment availability', 'Staff information', 'Assessment submission', 'Incorrect results', 'Technical issue', 'General enquiry'];
export const STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED'];
export const STATUS_LABEL = { OPEN: 'Open', ASSIGNED: 'Assigned', IN_PROGRESS: 'In progress', PENDING_USER: 'Pending your response', RESOLVED: 'Resolved', CLOSED: 'Closed' };
// What staff handling the ticket see (the requester sees "Pending your response").
export const STATUS_LABEL_STAFF = { ...STATUS_LABEL, PENDING_USER: 'Pending user response' };
export const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
export const PRIORITY_LABEL = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High', URGENT: 'Urgent' };
export const OPEN_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER'];

// ===== TICKETS · Reference numbers =====
// "SKM-2026-000123": prefix, year raised, then a running number for that year.
export const formatReference = (year, n) => 'SKM-' + year + '-' + String(n).padStart(6, '0');
export function parseReference(ref) {
  const m = /^SKM-(\d{4})-(\d{6,})$/.exec(String(ref || ''));
  return m ? { year: Number(m[1]), n: Number(m[2]) } : null;
}
// Next free reference for the year. Call inside a transaction: the advisory lock makes two tickets raised at the
// same moment wait for each other, so they can never get the same number (the unique index is the last guard).
export async function nextReference(tx, year = new Date().getFullYear()) {
  const prefix = `SKM-${year}-`;
  const rows = await tx.ticket.findMany({
    where: { reference: { startsWith: prefix } },
    select: { reference: true },
    orderBy: { id: 'desc' },
    take: 100,
  });
  let max = 0;
  for (const r of rows) {
    const num = parseInt(r.reference.slice(prefix.length), 10);
    if (!isNaN(num) && num > max) max = num;
  }
  return formatReference(year, max + 1);
}

// ===== TICKETS · Who sees what =====
// user: { id, perms }. Prisma `where` for the tickets list.
export const canManage = user => (user.perms || []).includes('tickets.manage');
export const canResolve = user => (user.perms || []).includes('tickets.resolve');
export function ticketListWhere(user) {
  if (canManage(user)) return {};
  if (canResolve(user)) return { OR: [{ assigneeId: user.id }, { requesterId: user.id }] };
  return { requesterId: user.id };
}
// The part a person plays on one ticket: 'manager' | 'assignee' | 'requester' | null (null = may not see it).
export function ticketRole(user, ticket) {
  if (!ticket) return null;
  if (canManage(user)) return 'manager';
  if (canResolve(user) && ticket.assigneeId === user.id) return 'assignee';
  if (ticket.requesterId === user.id) return 'requester';
  return null;
}
// Internal notes are only for the people handling the ticket.
export const seesInternal = role => role === 'manager' || role === 'assignee';
export const visibleMessages = (messages, role) => (messages || []).filter(m => seesInternal(role) || !m.internal);
export const visibleEvents = (events, role) => (events || []).filter(e => seesInternal(role) || e.field !== 'note');

// ===== TICKETS · What each person may do =====
export function actionsFor(role, ticket) {
  const closed = ticket.status === 'CLOSED';
  return {
    reply: !!role && !closed,
    note: seesInternal(role),
    assign: role === 'manager',
    priority: role === 'manager',
    attach: !!role && !closed,
    statuses: allowedStatuses(role, ticket),
  };
}

// ===== TICKETS · Status changes =====
// Statuses a person may move the ticket to from where it is now.
export function allowedStatuses(role, ticket) {
  const cur = ticket.status;
  let list = [];
  if (role === 'manager') list = STATUSES.filter(s => s !== 'ASSIGNED' || ticket.assigneeId);
  else if (role === 'assignee') list = cur === 'CLOSED' ? [] : ['IN_PROGRESS', 'PENDING_USER', 'RESOLVED'];
  else if (role === 'requester') list = cur === 'CLOSED' ? [] : ['CLOSED'];
  return list.filter(s => s !== cur);
}
// A requester answering a ticket that waits on them (or one marked resolved) hands it back to the support team.
export function statusAfterRequesterReply(ticket) {
  if (ticket.status === 'PENDING_USER' || ticket.status === 'RESOLVED') return ticket.assigneeId ? 'IN_PROGRESS' : 'OPEN';
  return ticket.status;
}
// Assigning an open ticket marks it Assigned; taking the assignee off an Assigned ticket puts it back to Open.
export function statusAfterAssign(ticket, assigneeId) {
  if (assigneeId && ticket.status === 'OPEN') return 'ASSIGNED';
  if (!assigneeId && ticket.status === 'ASSIGNED') return 'OPEN';
  return ticket.status;
}

// ===== TICKETS · Input checks =====
const text = (min, max) => z.string().trim().min(min).max(max);
export const NewTicket = z.object({
  title: text(5, 150), category: z.enum(CATEGORIES), description: text(10, 5000),
  priority: z.enum(PRIORITIES).default('MEDIUM'), assessmentId: z.number().int().positive().nullable().optional(),
});
export const TicketChange = z.object({
  status: z.enum(STATUSES).optional(), priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
}).refine(b => b.status !== undefined || b.priority !== undefined || b.assigneeId !== undefined, { message: 'Nothing to change.' });
export const NewMessage = z.object({ body: text(1, 5000), internal: z.boolean().default(false) });
export const ListQuery = z.object({
  q: z.string().trim().max(100).optional(), status: z.enum([...STATUSES, 'ACTIVE']).optional(), priority: z.enum(PRIORITIES).optional(),
  category: z.enum(CATEGORIES).optional(), box: z.enum(['raised', 'assigned']).optional(), assignee: z.union([z.enum(['me', 'none']), z.coerce.number().int().positive()]).optional(),
  page: z.coerce.number().int().min(1).max(10000).default(1), size: z.coerce.number().int().min(5).max(100).default(20),
});

// Query values -> Prisma `where`, always combined with what the person may see (ticketListWhere).
export function ticketFilterWhere(user, f) {
  const and = [ticketListWhere(user)];
  if (f.status) and.push({ status: f.status === 'ACTIVE' ? { in: OPEN_STATUSES } : f.status });
  if (f.priority) and.push({ priority: f.priority });
  if (f.category) and.push({ category: f.category });
  if (f.box === 'raised') and.push({ requesterId: user.id });
  if (f.box === 'assigned') and.push({ assigneeId: user.id });
  if (f.assignee === 'me') and.push({ assigneeId: user.id });
  else if (f.assignee === 'none') and.push({ assigneeId: null });
  else if (typeof f.assignee === 'number') and.push({ assigneeId: f.assignee });
  if (f.q) and.push({ OR: [{ reference: { contains: f.q, mode: 'insensitive' } }, { title: { contains: f.q, mode: 'insensitive' } }, { description: { contains: f.q, mode: 'insensitive' } }, { requester: { displayName: { contains: f.q, mode: 'insensitive' } } }] });
  return { AND: and };
}

// ===== TICKETS · Attachments =====
// Allowed types, checked on the server by extension AND by the file's first bytes (so a renamed .exe is refused).
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;
export const MAX_ATTACHMENTS = 10;
export const ATTACHMENT_TYPES = {
  pdf: 'application/pdf', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', txt: 'text/plain',
};
const starts = (buf, bytes) => bytes.every((b, i) => buf[i] === b);
function contentMatches(ext, buf) {
  switch (ext) {
    case 'pdf': return starts(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'png': return starts(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case 'jpg': case 'jpeg': return starts(buf, [0xff, 0xd8, 0xff]);
    case 'docx': case 'xlsx': return starts(buf, [0x50, 0x4b, 0x03, 0x04]); // Office files are zip archives
    case 'txt': return !buf.includes(0); // plain text has no NUL bytes
    default: return false;
  }
}
// Keeps a readable name for the download, without folders, control characters or quotes.
export function safeFileName(name) {
  const base = String(name || 'file').split(/[\\/]/).pop().replace(/[\u0000-\u001f\u007f"<>|:*?]/g, '').trim();
  return (base || 'file').slice(-120);
}
// name, size and the file's bytes (Buffer/Uint8Array) -> { ok: true, ext, mime, name } or { ok: false, error }.
export function checkAttachment(name, size, bytes) {
  const clean = safeFileName(name), ext = (clean.match(/\.([a-z0-9]+)$/i) || [])[1]?.toLowerCase();
  if (!ext || !ATTACHMENT_TYPES[ext]) return { ok: false, error: 'Only PDF, PNG, JPG, Word (.docx), Excel (.xlsx) and text (.txt) files can be attached.' };
  if (!size) return { ok: false, error: 'The file is empty.' };
  if (size > MAX_ATTACHMENT_BYTES) return { ok: false, error: 'Each file must be 5 MB or smaller.' };
  if (!bytes || !contentMatches(ext, bytes)) return { ok: false, error: "The file's contents don't match its type (." + ext + ').' };
  return { ok: true, ext: ext === 'jpeg' ? 'jpg' : ext, mime: ATTACHMENT_TYPES[ext], name: clean };
}

// ===== TICKETS · File storage =====
// Files live outside the web root: STORAGE_DIR (default <repo>/storage)/tickets/<ticketId>/<random>.<ext>.
// The database keeps the relative path; the browser only ever gets them through the download route.
export const storageRoot = () => path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));
export async function saveAttachmentFile(ticketId, ext, bytes) {
  const rel = path.join('tickets', String(Number(ticketId)), randomBytes(16).toString('hex') + '.' + ext);
  const full = path.join(storageRoot(), rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes, { flag: 'wx' });
  return rel;
}
// Refuses any stored path that would point outside the storage folder.
export function resolveStored(rel) {
  const root = storageRoot(), full = path.resolve(root, String(rel || ''));
  if (!full.startsWith(root + path.sep)) throw new Error('Bad storage path');
  return full;
}
export const readAttachmentFile = rel => readFile(resolveStored(rel));

// ===== TICKETS · Notification templates =====
// ticket.updated comes from the seed. These extra ones are added the first time they are needed (no migration),
// and can then be reworded in Settings > Notifications like any other template.
export const TICKET_TEMPLATES = [
  ['ticket.created', 'New support ticket {reference}', '{requester} raised {reference}: {title} ({priority} priority).'],
  ['ticket.assigned', 'Ticket {reference} assigned to you', '{reference}: {title} ({priority} priority) is now assigned to you.'],
  ['ticket.activity', 'New reply on {reference}', '{actor} replied on {reference}: {title}.'],
];
// skipDuplicates (ON CONFLICT DO NOTHING) never overwrites wording an administrator has changed.
let templatesReady = false;
export async function ensureTicketTemplates(client) {
  if (templatesReady) return;
  await client.notificationTemplate.createMany({ data: TICKET_TEMPLATES.map(([key, title, body]) => ({ key, title, body, channels: ['in_app'] })), skipDuplicates: true });
  templatesReady = true;
}

// ===== TICKETS · Loading =====
const PERSON = { select: { id: true, displayName: true, username: true } };
export const TICKET_INCLUDE = {
  requester: PERSON, assignee: PERSON, assessment: { select: { id: true, title: true } },
  messages: { orderBy: { at: 'asc' }, include: { author: PERSON } },
  events: { orderBy: { at: 'asc' }, include: { actor: PERSON } },
  attachments: { orderBy: { at: 'asc' } },
};
// One ticket with the part this person plays on it, or null when it doesn't exist or they may not see it
// (the route answers 404 either way, so nobody learns which tickets exist).
export async function findTicketFor(client, user, id, include = TICKET_INCLUDE) {
  const n = Number(id);
  if (!Number.isInteger(n) || n < 1) return null;
  const ticket = await client.ticket.findUnique({ where: { id: n }, include });
  const role = ticketRole(user, ticket);
  return role ? { ticket, role } : null;
}
// Active accounts that may be given tickets: anyone holding tickets.resolve or tickets.manage.
export async function assignableAccounts(client) {
  const rows = await client.account.findMany({ where: { status: { in: ['ACTIVE', 'MUST_CHANGE_PASSWORD'] } }, include: { roles: true, permissions: true }, orderBy: { displayName: 'asc' } });
  return rows.filter(a => {
    const p = effectivePermissions({ roles: a.roles.map(r => r.role), permissions: a.permissions.map(x => x.key) });
    return p.includes('tickets.resolve') || p.includes('tickets.manage');
  }).map(a => ({ id: a.id, name: a.displayName, username: a.username, manager: effectivePermissions({ roles: a.roles.map(r => r.role), permissions: a.permissions.map(x => x.key) }).includes('tickets.manage') }));
}

// Assessments a person may link a ticket to: those assigned to them as staff, those they created (content
// writers) and, for ticket managers, every assessment that has left draft. lib/server/assigned.js is loaded only
// when this runs, so the unit tests never pull in the database.
export async function relatedAssessments(client, ctx) {
  const ids = new Set(), perms = ctx.user.perms || [];
  if (ctx.account.staffId) {
    const { assessmentsForStaff } = await import('./assigned.js');
    const staff = await client.staffRecord.findUnique({ where: { id: ctx.account.staffId }, include: { station: true } });
    if (staff) (await assessmentsForStaff(staff, client)).forEach(e => ids.add(e.assessmentId));
  }
  const or = [{ id: { in: [...ids] } }];
  if (perms.includes('forms.view')) or.push({ createdById: ctx.account.id });
  if (perms.includes('tickets.manage')) or.push({ status: { not: 'DRAFT' } });
  return client.assessment.findMany({ where: { OR: or }, select: { id: true, title: true }, orderBy: { title: 'asc' } });
}

// ===== TICKETS · Shaping for the browser =====
const person = p => (p ? { id: p.id, name: p.displayName, username: p.username } : null);
export const statusLabel = (status, role) => (role === 'requester' ? STATUS_LABEL : STATUS_LABEL_STAFF)[status] || status;
export function ticketRow(t, role) {
  return {
    id: t.id, reference: t.reference, title: t.title, category: t.category, priority: t.priority, status: t.status,
    statusLabel: statusLabel(t.status, role), requester: person(t.requester), assignee: person(t.assignee),
    assessment: t.assessment ? { id: t.assessment.id, title: t.assessment.title } : null, createdAt: t.createdAt, updatedAt: t.updatedAt,
  };
}
// Full ticket for the drawer. Internal notes and note events are removed here for requesters (server-side).
export function ticketDetail(t, role) {
  return {
    ...ticketRow(t, role), description: t.description, role, actions: actionsFor(role, t),
    messages: visibleMessages(t.messages, role).map(m => ({ id: m.id, body: m.body, internal: m.internal, at: m.at, author: person(m.author) })),
    events: visibleEvents(t.events, role).map(e => ({ id: e.id, field: e.field, from: e.fromVal, to: e.toVal, at: e.at, actor: person(e.actor) })),
    attachments: (t.attachments || []).map(a => ({ id: a.id, name: a.fileName, mime: a.mimeType, size: a.sizeBytes, at: a.at })),
  };
}
