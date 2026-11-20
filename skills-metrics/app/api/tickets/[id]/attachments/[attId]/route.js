// Route GET /api/tickets/:id/attachments/:attId · download a ticket attachment
// =============================================================================
// Used by: components/SMTickets.jsx (ticket drawer: file links)
// Depends on: lib/server/{db,session,tickets,http}
// Sections (search for these markers): TICKET ATTACHMENT · Download
// Only people who may see the ticket (requester, its assignee, ticket managers) can download; anyone else gets 404.
// Always sent as a download (never shown inline) with nosniff, so an uploaded file can't run in the site.
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { handle, ApiError } from '@/lib/server/http';
import { findTicketFor, readAttachmentFile } from '@/lib/server/tickets';

// ===== TICKET ATTACHMENT · Download =====
export const GET = handle(async (req, { params }) => {
  const ctx = await requireUser(), p = await params;
  const hit = await findTicketFor(db, ctx.user, p.id, { attachments: true });
  const a = hit && hit.ticket.attachments.find(x => x.id === Number(p.attId));
  if (!a) throw new ApiError(404, 'File not found.');
  let buf;
  try { buf = await readAttachmentFile(a.storagePath); } catch (e) { throw new ApiError(404, 'This file is no longer available.'); }
  const ascii = a.fileName.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return new Response(new Uint8Array(buf), { headers: {
    'Content-Type': a.mimeType, 'Content-Length': String(buf.length), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(a.fileName)}`,
  } });
});
