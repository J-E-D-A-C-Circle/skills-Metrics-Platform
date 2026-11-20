// Route GET /api/tickets/meta · lists for the ticket forms: categories, priorities, statuses, the assessments the
//   person may link a ticket to, attachment limits and (ticket managers only) who tickets can be assigned to
// =============================================================================
// Used by: components/SMTickets.jsx (New ticket form, filters, Assign drop-down)
// Depends on: lib/server/{db,session,tickets,http}
// Sections (search for these markers): TICKET LISTS · Read
// =============================================================================
import { db } from '@/lib/server/db';
import { requireUser } from '@/lib/server/session';
import { json, handle } from '@/lib/server/http';
import { CATEGORIES, PRIORITIES, PRIORITY_LABEL, STATUSES, STATUS_LABEL, STATUS_LABEL_STAFF, ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, MAX_ATTACHMENTS, canManage, canResolve, relatedAssessments, assignableAccounts } from '@/lib/server/tickets';

// ===== TICKET LISTS · Read =====
export const GET = handle(async () => {
  const ctx = await requireUser(), user = ctx.user, manage = canManage(user), handles = manage || canResolve(user);
  const [assessments, assignees] = await Promise.all([relatedAssessments(db, ctx), manage ? assignableAccounts(db) : []]);
  return json({
    categories: CATEGORIES, priorities: PRIORITIES.map(k => ({ key: k, label: PRIORITY_LABEL[k] })),
    statuses: STATUSES.map(k => ({ key: k, label: (handles ? STATUS_LABEL_STAFF : STATUS_LABEL)[k] })),
    assessments, assignees: assignees.map(a => ({ id: a.id, name: a.name, username: a.username })),
    canManage: manage, canResolve: canResolve(user),
    attachments: { maxBytes: MAX_ATTACHMENT_BYTES, maxFiles: MAX_ATTACHMENTS, types: Object.keys(ATTACHMENT_TYPES).filter(x => x !== 'jpeg') },
  });
});
