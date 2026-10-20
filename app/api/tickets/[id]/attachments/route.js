// Route POST /api/tickets/:id/attachments · attach one file to a ticket (multipart form, field "file")
// =============================================================================
// Used by: components/SMTickets.jsx (New ticket form and ticket drawer: Attach file)
// Depends on: lib/server/{db,session,tickets,audit,http}
// Sections (search for these markers): TICKET ATTACHMENT · Checks, TICKET ATTACHMENT · Save
// Only PDF, PNG, JPG, DOCX, XLSX and TXT up to 5 MB each, checked here by extension AND the file's first bytes.
// Files are stored under STORAGE_DIR/tickets/<ticketId>/ with a random name; the browser never chooses the path.
// =============================================================================
import { unlink } from 'node:fs/promises';
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { audit } from '@/lib/server/audit';
import { json, handle, badRequest, clientIp, ApiError } from '@/lib/server/http';
import { findTicketFor, checkAttachment, saveAttachmentFile, resolveStored, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS } from '@/lib/server/tickets';

// ===== TICKET ATTACHMENT · Checks =====
export const POST = handle(async (req, { params }) => {
  const ctx = await requireUser();
  const hit = await findTicketFor(db, ctx.user, (await params).id, { _count: { select: { attachments: true } } });
  if (!hit) throw new ApiError(404, 'Ticket not found.');
  const t = hit.ticket;
  if (t.status === 'CLOSED') throw badRequest('This ticket is closed, so no more files can be added.');
  if (t._count.attachments >= MAX_ATTACHMENTS) throw badRequest('A ticket can have at most ' + MAX_ATTACHMENTS + ' files.');
  // Refuse oversized uploads before reading them (the form adds a little overhead around the file).
  if (Number(req.headers.get('content-length') || 0) > MAX_ATTACHMENT_BYTES + 64 * 1024) throw new ApiError(413, 'Each file must be 5 MB or smaller.');
  let file;
  try { file = (await req.formData()).get('file'); } catch (e) { throw badRequest('Send the file as a form upload.'); }
  if (!file || typeof file === 'string') throw badRequest('Choose a file to attach.');
  if (file.size > MAX_ATTACHMENT_BYTES) throw new ApiError(413, 'Each file must be 5 MB or smaller.');
  const bytes = Buffer.from(await file.arrayBuffer());
  const c = checkAttachment(file.name, bytes.length, bytes);
  if (!c.ok) throw badRequest(c.error);

  // ===== TICKET ATTACHMENT · Save =====
  // The file is written first; if the database step fails the file is removed again.
  const rel = await saveAttachmentFile(t.id, c.ext, bytes);
  try {
    const a = await db.$transaction(async tx => {
      const a = await tx.ticketAttachment.create({ data: { ticketId: t.id, fileName: c.name, mimeType: c.mime, sizeBytes: bytes.length, storagePath: rel } });
      await tx.ticketEvent.create({ data: { ticketId: t.id, actorId: ctx.account.id, field: 'attachment', toVal: c.name } });
      await tx.ticket.update({ where: { id: t.id }, data: { updatedAt: new Date() } });
      await audit({ actorId: ctx.account.id, action: 'ticket.attachment.add', entityType: 'Ticket', entityId: t.id, after: { reference: t.reference, attachmentId: a.id, fileName: c.name, sizeBytes: bytes.length, mimeType: c.mime }, ip: clientIp(req) }, tx);
      return a;
    });
    return json({ attachment: { id: a.id, name: a.fileName, mime: a.mimeType, size: a.sizeBytes, at: a.at } }, 201);
  } catch (e) {
    await unlink(resolveStored(rel)).catch(() => null);
    throw e;
  }
});
