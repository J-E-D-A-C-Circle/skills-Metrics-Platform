// =============================================================================
// reminders.js · Deadline reminders: "closes soon" (within 48 hours) and "has closed" for people not yet finished
// Screen / URL: none; server only. Run by POST /api/jobs/reminders (a scheduled job, or "Send reminders now" on
//   the Assignments page)
// Used by: app/api/jobs/reminders/route.js   Depends on: lib/server/{db,notify}, app/api/assignments/{progress,rules}.js
// Sections (search for these markers): REMINDERS · Run
// Safe to run as often as you like: each reminder is keyed to the person, the assignment that sets their deadline
// and that deadline (rules.js reminderDedupe), so re-running never repeats one; an extension (a new deadline)
// can earn a fresh "closes soon". People reached by several assignments get one reminder per assessment.
// =============================================================================
import 'server-only';
import { db } from './db';
import { notify, fmtDate } from './notify';
import { loadProgress, takerAccounts } from '../../app/api/assignments/progress';
import { reminderKind, reminderDedupe } from '../../app/api/assignments/rules';

// ===== REMINDERS · Run =====
// Checks every person on every PUBLISHED assessment's assignments. Returns counts:
// { checked (people), soon, passed (notifications created), skipped (already sent / no login), failed }.
export async function runReminders(now = new Date()) {
  const ids = (await db.assessment.findMany({ where: { status: 'PUBLISHED', assignments: { some: {} } }, select: { id: true } })).map(a => a.id);
  const out = { checked: 0, soon: 0, passed: 0, skipped: 0, failed: 0 };
  if (!ids.length) return out;
  const { assignments, people } = await loadProgress(ids, null, now);
  const title = new Map(assignments.map(a => [a.assessmentId, a.assessment.title]));
  const due = [];
  for (const p of people.values()) {
    out.checked++;
    const kind = reminderKind(p.entry, p.attempts, now);
    if (kind) due.push({ ...p, kind });
  }
  const accounts = await takerAccounts([...new Set(due.map(p => p.staffId))]);
  for (const p of due) {
    const ids = accounts.get(p.staffId) || [];
    if (!ids.length) { out.skipped++; continue; }
    try {
      const made = await notify({
        accountIds: ids, key: p.kind === 'soon' ? 'assessment.deadline.soon' : 'assessment.deadline.passed',
        vars: { title: title.get(p.assessmentId), deadline: fmtDate(p.entry.deadline), used: p.attempts.length, max: p.entry.maxAttempts },
        link: '/assessments', dedupe: reminderDedupe(p.kind, p.entry.deadlineAssignmentId, p.staffId, p.entry.deadline),
        calendarEvent: p.entry ? { assessmentId: p.assessmentId, title: title.get(p.assessmentId), startsAt: p.entry.startsAt, deadline: p.entry.deadline } : null,
      });
      if (made) out[p.kind] += made; else out.skipped++;
    } catch (e) {
      // Two runs at the same moment: the unique dedupe key stops the second copy; anything else is logged.
      if (e && e.code === 'P2002') out.skipped++; else { out.failed++; console.error('[reminders]', e); }
    }
  }
  return out;
}
