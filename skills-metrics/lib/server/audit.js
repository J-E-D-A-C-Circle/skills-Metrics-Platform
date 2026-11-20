// =============================================================================
// audit.js · Writes to the append-only audit log (AuditLog table)
// Screen / URL: Settings > Audit Log (moves to the server in phase 8)
// Used by: app/api/auth/* and every later route that changes data   Depends on: lib/server/db.js
// Sections (search for these markers): AUDIT · Write, AUDIT · Removing secrets
// =============================================================================
import 'server-only';
import { db } from './db';

// ===== AUDIT · Removing secrets =====
// Fields with these names are blanked before saving, wherever they appear in before/after ("pass" alone or any
// name containing password / token / secret / hash / cookie; a field like "passed" is kept). Dates are saved as
// ISO text so they don't turn into empty objects.
const SECRET = /^pass$|password|token|secret|hash|cookie/i;
function scrub(v) {
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, SECRET.test(k) ? '[removed]' : scrub(x)]));
  return v;
}

// ===== AUDIT · Write =====
// entry: { actorId, action, entityType, entityId, outcome, before, after, ip }. `tx` lets a caller write the
// audit row inside its own transaction so the change and its record succeed or fail together.
export async function audit(entry, tx = db) {
  const { actorId = null, action, entityType = null, entityId = null, outcome = 'SUCCESS', before, after, ip = null } = entry;
  return tx.auditLog.create({
    data: { actorId, action, entityType, entityId: entityId == null ? null : String(entityId), outcome, before: before === undefined ? undefined : scrub(before), after: after === undefined ? undefined : scrub(after), ip },
  });
}
