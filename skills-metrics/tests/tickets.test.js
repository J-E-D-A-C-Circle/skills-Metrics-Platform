// =============================================================================
// tickets.test.js · Tests for lib/server/tickets.js (support ticket rules)
// Run: npm test
// Sections (search for these markers): TEST · Reference numbers, TEST · Who sees which ticket, TEST · Internal notes,
//   TEST · Status changes, TEST · Input checks, TEST · Attachments
// =============================================================================
import { describe, it, expect } from 'vitest';
import { formatReference, parseReference, ticketRole, ticketListWhere, ticketFilterWhere, visibleMessages, visibleEvents, ticketDetail, actionsFor,
  allowedStatuses, statusAfterRequesterReply, statusAfterAssign, NewTicket, TicketChange, checkAttachment, safeFileName, resolveStored } from '../lib/server/tickets.js';

const admin = { id: 1, perms: ['tickets.manage', 'settings.general'] };
const resolver = { id: 9, perms: ['tickets.resolve', 'assessments.view'] };
const ama = { id: 4, perms: ['assessments.view'] };
const kofi = { id: 5, perms: ['assessments.view'] };
const ticket = (o = {}) => ({ id: 1, reference: 'SKM-2026-000001', requesterId: 4, assigneeId: null, status: 'OPEN', priority: 'MEDIUM', title: 'T', category: 'General enquiry', description: 'D', ...o });

// ===== TEST · Reference numbers =====
describe('reference numbers', () => {
  it('use SKM-<year>-<6 digits>', () => {
    expect(formatReference(2026, 123)).toBe('SKM-2026-000123');
    expect(formatReference(2026, 1)).toBe('SKM-2026-000001');
  });
  it('parse back, and reject anything else', () => {
    expect(parseReference('SKM-2026-000123')).toEqual({ year: 2026, n: 123 });
    expect(parseReference('SKM-26-1')).toBeNull();
    expect(parseReference('')).toBeNull();
  });
});

// ===== TEST · Who sees which ticket =====
describe('who sees which ticket', () => {
  it('managers see every ticket', () => {
    expect(ticketListWhere(admin)).toEqual({});
    expect(ticketRole(admin, ticket())).toBe('manager');
  });
  it('a ticket resolver sees only tickets assigned to them (plus their own)', () => {
    expect(ticketListWhere(resolver)).toEqual({ OR: [{ assigneeId: 9 }, { requesterId: 9 }] });
    expect(ticketRole(resolver, ticket())).toBeNull();
    expect(ticketRole(resolver, ticket({ assigneeId: 9 }))).toBe('assignee');
    expect(ticketRole(resolver, ticket({ assigneeId: 2 }))).toBeNull();
    expect(ticketRole(resolver, ticket({ requesterId: 9 }))).toBe('requester');
  });
  it('staff see only their own tickets', () => {
    expect(ticketListWhere(ama)).toEqual({ requesterId: 4 });
    expect(ticketRole(ama, ticket())).toBe('requester');
    expect(ticketRole(kofi, ticket())).toBeNull();
  });
  it('filters are always combined with what the person may see', () => {
    const w = ticketFilterWhere(ama, { q: 'x', status: 'ACTIVE', assignee: 'none' });
    expect(w.AND[0]).toEqual({ requesterId: 4 });
    expect(w.AND).toContainEqual({ status: { in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER'] } });
  });
});

// ===== TEST · Internal notes =====
describe('internal notes', () => {
  const msgs = [{ id: 1, body: 'public', internal: false }, { id: 2, body: 'secret', internal: true }];
  const evs = [{ id: 1, field: 'reply' }, { id: 2, field: 'note' }, { id: 3, field: 'status' }];
  it('are removed for the requester', () => {
    expect(visibleMessages(msgs, 'requester').map(m => m.id)).toEqual([1]);
    expect(visibleEvents(evs, 'requester').map(e => e.id)).toEqual([1, 3]);
  });
  it('are kept for the manager and the assignee', () => {
    expect(visibleMessages(msgs, 'manager')).toHaveLength(2);
    expect(visibleMessages(msgs, 'assignee')).toHaveLength(2);
  });
  it('never reach the requester through the full ticket shape', () => {
    const t = ticket({ messages: msgs.map(m => ({ ...m, at: new Date(), author: null })), events: evs.map(e => ({ ...e, at: new Date(), actor: null })), attachments: [] });
    const d = ticketDetail(t, 'requester');
    expect(JSON.stringify(d)).not.toContain('secret');
    expect(d.actions.note).toBe(false);
    expect(ticketDetail(t, 'assignee').actions.note).toBe(true);
  });
});

// ===== TEST · Status changes =====
describe('status changes', () => {
  it('managers can assign and set any status; resolvers only working statuses; requesters only close', () => {
    expect(actionsFor('manager', ticket()).assign).toBe(true);
    expect(actionsFor('assignee', ticket({ assigneeId: 9 })).assign).toBe(false);
    expect(allowedStatuses('assignee', ticket({ status: 'ASSIGNED', assigneeId: 9 }))).toEqual(['IN_PROGRESS', 'PENDING_USER', 'RESOLVED']);
    expect(allowedStatuses('requester', ticket())).toEqual(['CLOSED']);
    expect(allowedStatuses('manager', ticket())).not.toContain('ASSIGNED'); // needs an assignee first
    expect(allowedStatuses('manager', ticket({ assigneeId: 9 }))).toContain('ASSIGNED');
    expect(allowedStatuses(null, ticket())).toEqual([]);
  });
  it('a closed ticket takes no replies', () => {
    expect(actionsFor('requester', ticket({ status: 'CLOSED' })).reply).toBe(false);
  });
  it('a requester reply hands a waiting ticket back to support', () => {
    expect(statusAfterRequesterReply(ticket({ status: 'PENDING_USER', assigneeId: 9 }))).toBe('IN_PROGRESS');
    expect(statusAfterRequesterReply(ticket({ status: 'RESOLVED' }))).toBe('OPEN');
    expect(statusAfterRequesterReply(ticket({ status: 'IN_PROGRESS' }))).toBe('IN_PROGRESS');
  });
  it('assigning moves Open to Assigned, unassigning moves it back', () => {
    expect(statusAfterAssign(ticket(), 9)).toBe('ASSIGNED');
    expect(statusAfterAssign(ticket({ status: 'ASSIGNED', assigneeId: 9 }), null)).toBe('OPEN');
    expect(statusAfterAssign(ticket({ status: 'IN_PROGRESS', assigneeId: 9 }), 1)).toBe('IN_PROGRESS');
  });
});

// ===== TEST · Input checks =====
describe('input checks', () => {
  it('needs a title, a listed category and a description', () => {
    expect(NewTicket.safeParse({ title: 'Cannot sign in', category: 'Account access', description: 'It says my password is wrong.' }).success).toBe(true);
    expect(NewTicket.safeParse({ title: 'Hi', category: 'Account access', description: 'It says my password is wrong.' }).success).toBe(false);
    expect(NewTicket.safeParse({ title: 'Cannot sign in', category: 'Made up', description: 'It says my password is wrong.' }).success).toBe(false);
  });
  it('a change must change something', () => {
    expect(TicketChange.safeParse({}).success).toBe(false);
    expect(TicketChange.safeParse({ assigneeId: null }).success).toBe(true);
  });
});

// ===== TEST · Attachments =====
describe('attachments', () => {
  const pdf = Buffer.from('%PDF-1.4 hello');
  it('accept allowed types whose bytes match', () => {
    expect(checkAttachment('report.pdf', pdf.length, pdf)).toMatchObject({ ok: true, ext: 'pdf', mime: 'application/pdf' });
    expect(checkAttachment('notes.txt', 5, Buffer.from('hello'))).toMatchObject({ ok: true, mime: 'text/plain' });
    expect(checkAttachment('photo.JPEG', 4, Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toMatchObject({ ok: true, ext: 'jpg' });
  });
  it('refuse other types, renamed files, empty files and files over 5 MB', () => {
    expect(checkAttachment('virus.exe', 10, Buffer.from('MZ')).ok).toBe(false);
    expect(checkAttachment('fake.pdf', 10, Buffer.from('MZ\x90\x00')).ok).toBe(false);
    expect(checkAttachment('empty.txt', 0, Buffer.alloc(0)).ok).toBe(false);
    expect(checkAttachment('big.pdf', 5 * 1024 * 1024 + 1, pdf).ok).toBe(false);
  });
  it('clean file names and never resolve outside the storage folder', () => {
    expect(safeFileName('../../etc/"passwd".txt')).toBe('passwd.txt');
    expect(() => resolveStored('../../etc/passwd')).toThrow();
    expect(() => resolveStored('tickets/1/abc.pdf')).not.toThrow();
  });
});
