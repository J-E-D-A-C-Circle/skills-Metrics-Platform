// =============================================================================
// settings.js · System settings, scoring configuration versions, notification template rules and audit-log filters
// Screen / URL: Settings (/settings General, ?tab=scoring, ?tab=notifications, ?tab=audit)
// Used by: app/api/settings/**, app/api/audit/**, tests/settings.test.js; other routes read the general settings
//   with getGeneralSettings(db) and the thresholds with activeScoringConfig(db)
// Depends on: zod, lib/scoring.js (validateConfig, DEFAULT_CONFIG)
// Sections (search for these markers): SETTINGS · General settings, SETTINGS · Scoring configuration,
//   SETTINGS · Notification templates, SETTINGS · Channels, SETTINGS · Audit log filters, SETTINGS · CSV
// Kept free of database imports so the rules can be unit-tested; functions that read the database take the Prisma
//   client as an argument.
// =============================================================================
import { z } from 'zod';
import { validateConfig, DEFAULT_CONFIG } from '../scoring.js';

// ===== SETTINGS · General settings =====
// Stored as one SystemSetting row (key "general", value = the object below). Missing keys fall back to defaults,
// so adding a setting later never breaks older rows.
//   orgName               shown on reports and exports
//   defaultResultRelease  result-release setting a new assessment starts with (IMMEDIATE | AFTER_DEADLINE | MANUAL)
//   defaultDeadlineDays   deadline policy: a new assignment's deadline defaults to this many days after it opens
//   reminderLeadHours     "closes soon" reminders go out this many hours before a deadline
export const GENERAL_KEY = 'general';
export const RESULT_RELEASE = ['IMMEDIATE', 'AFTER_DEADLINE', 'MANUAL'];
export const RESULT_RELEASE_LABEL = { IMMEDIATE: 'As soon as an attempt is submitted', AFTER_DEADLINE: 'After the deadline has passed', MANUAL: 'Only when released by an administrator' };
export const GENERAL_DEFAULTS = Object.freeze({ orgName: 'Driver and Vehicle Licensing Authority (DVLA)', defaultResultRelease: 'IMMEDIATE', defaultDeadlineDays: 14, reminderLeadHours: 48 });
export const GeneralSchema = z.object({
  orgName: z.string().trim().min(2, 'Enter the organisation name.').max(150),
  defaultResultRelease: z.enum(RESULT_RELEASE),
  defaultDeadlineDays: z.number().int('Use a whole number of days.').min(1, 'At least 1 day.').max(365, 'At most 365 days.'),
  reminderLeadHours: z.number().int('Use a whole number of hours.').min(1, 'At least 1 hour.').max(336, 'At most 336 hours (14 days).'),
}).strict();
export const mergeGeneral = value => ({ ...GENERAL_DEFAULTS, ...(value && typeof value === 'object' ? value : {}) });
export async function getGeneralSettings(client) {
  const row = await client.systemSetting.findUnique({ where: { key: GENERAL_KEY } });
  return mergeGeneral(row?.value);
}
// Session idle time is set by the server's environment (lib/server/session.js); the screen shows it read-only.
export const sessionTimeoutMinutes = () => Number(process.env.SESSION_IDLE_MINUTES || 60);

// ===== SETTINGS · Scoring configuration =====
// Saving never edits an old row: it adds version N+1. Results keep the scoringConfigId they were worked out with,
// so earlier reports can be reproduced. The newest active row is the one new results use.
const num = z.number({ invalid_type_error: 'Enter a number.' }).finite();
export const ScoringInput = z.object({
  requiredLevel: num, competentFrom: num, proficientFrom: num, moderateGapFrom: num, noGapFrom: num,
  defaultMaxAttempts: z.number().int('Use a whole number.'),
  reason: z.string().trim().min(5, 'Give a reason of at least 5 characters.').max(500),
}).strict();
export const SCORING_FIELDS = ['requiredLevel', 'competentFrom', 'proficientFrom', 'moderateGapFrom', 'noGapFrom', 'defaultMaxAttempts'];
// Decimal columns -> plain numbers.
export function plainConfig(row) {
  if (!row) return null;
  const out = { id: row.id, version: row.version, reason: row.reason, active: row.active, createdAt: row.createdAt, createdById: row.createdById ?? null };
  SCORING_FIELDS.forEach(k => { out[k] = row[k] == null ? DEFAULT_CONFIG[k] : Number(row[k]); });
  return out;
}
// The 2-decimal columns can't hold more precision than that.
const twoDp = n => Math.round(n * 100) === n * 100 || Math.abs(Math.round(n * 100) - n * 100) < 1e-6;
export function scoringProblems(input) {
  const errs = validateConfig(input);
  ['requiredLevel', 'competentFrom', 'proficientFrom', 'moderateGapFrom', 'noGapFrom'].forEach(k => { if (typeof input[k] === 'number' && !twoDp(input[k])) errs.push('Use at most 2 decimal places'); });
  if (input.defaultMaxAttempts > 10) errs.push('Attempt limit can be at most 10');
  return [...new Set(errs)];
}
export const sameConfig = (a, b) => !!a && !!b && SCORING_FIELDS.every(k => Number(a[k]) === Number(b[k]));
export async function activeScoringConfig(client) {
  return plainConfig(await client.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } }));
}

// ===== SETTINGS · Notification templates =====
// What each template is for and the {placeholders} the sending code fills in (with example values for the preview).
// Unknown keys (added later by other modules) still show, with no placeholder list.
export const TEMPLATE_INFO = {
  'assessment.assigned': { label: 'New assessment assigned', to: 'Staff the assessment is assigned to', vars: { title: 'IT Skills Assessment', startsAt: '20 Oct 2026, 09:00', deadline: '3 Nov 2026, 17:00' } },
  'assessment.deadline.soon': { label: 'Deadline coming up', to: 'Staff who have not completed the assessment', vars: { title: 'IT Skills Assessment', deadline: '3 Nov 2026, 17:00', used: '1', max: '3' } },
  'assessment.deadline.passed': { label: 'Deadline passed', to: 'Staff who did not complete in time', vars: { title: 'IT Skills Assessment' } },
  'assessment.extension': { label: 'Deadline extended', to: 'Staff given more time', vars: { title: 'IT Skills Assessment', deadline: '10 Nov 2026, 17:00' } },
  'assessment.completed': { label: 'Attempt submitted', to: 'The staff member who submitted', vars: { title: 'IT Skills Assessment', attemptNo: '2' } },
  'results.released': { label: 'Results released', to: 'Staff whose results are now visible', vars: { title: 'IT Skills Assessment' } },
  'content.approved': { label: 'Content approved', to: 'The assessment creator', vars: { title: 'IT Skills Assessment', reviewer: 'Adjei Denzil Asiam' } },
  'content.rejected': { label: 'Content rejected', to: 'The assessment creator', vars: { title: 'IT Skills Assessment', feedback: 'Questions 4 and 7 are duplicates.' } },
  'content.returned': { label: 'Content returned for revision', to: 'The assessment creator', vars: { title: 'IT Skills Assessment', feedback: 'Please map question 3 to a competency.' } },
  'ticket.updated': { label: 'Support ticket updated', to: 'The person who raised the ticket', vars: { reference: 'SKM-2026-000123', status: 'In progress' } },
  'ticket.created': { label: 'New support ticket', to: 'Administrators who manage tickets', vars: { reference: 'SKM-2026-000123', requester: 'Ama Owusu', title: 'Cannot open my assessment', priority: 'Medium' } },
  'ticket.assigned': { label: 'Ticket assigned to you', to: 'The person the ticket is assigned to', vars: { reference: 'SKM-2026-000123', title: 'Cannot open my assessment', priority: 'Medium' } },
  'ticket.activity': { label: 'Reply on a ticket you handle', to: 'The assignee (or administrators when unassigned)', vars: { reference: 'SKM-2026-000123', actor: 'Ama Owusu', title: 'Cannot open my assessment' } },
  'account.changed': { label: 'Account changed', to: 'The account holder', vars: { change: 'Your role was changed to Manager / Supervisor.' } },
};
export const placeholdersIn = text => [...new Set([...String(text || '').matchAll(/\{(\w+)\}/g)].map(m => m[1]))];
// Same rule as fill() in lib/server/notify.js: {name} -> value, unknown names become blank.
export const fillPreview = (text, vars = {}) => String(text).replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
export const TemplateInput = z.object({
  title: z.string().trim().min(3, 'The title needs at least 3 characters.').max(150),
  body: z.string().trim().min(3, 'The message needs at least 3 characters.').max(1000),
  channels: z.array(z.enum(['in_app', 'email', 'sms'])).max(3),
}).strict();
// Problems with a template edit (unknown placeholders, missing in-app channel, unconfigured channel).
export function templateProblems(key, input, available) {
  const errs = [], info = TEMPLATE_INFO[key];
  if (info) {
    const bad = placeholdersIn(input.title + ' ' + input.body).filter(p => !(p in info.vars));
    if (bad.length) errs.push('Unknown placeholder' + (bad.length > 1 ? 's' : '') + ': ' + bad.map(b => '{' + b + '}').join(', ') + '. Use only the ones listed.');
  }
  if (!input.channels.includes('in_app')) errs.push('In-app notifications are always on.');
  input.channels.filter(c => c !== 'in_app' && !available[c]).forEach(c => errs.push((c === 'sms' ? 'SMS' : 'Email') + ' is not configured on this server.'));
  return errs;
}

// ===== SETTINGS · Channels =====
// Email / SMS count as configured only when the server's environment turns them on (NOTIFY_EMAIL / NOTIFY_SMS).
const on = v => !!v && !['off', 'false', '0', 'no'].includes(String(v).trim().toLowerCase());
export const channelsAvailable = (env = process.env) => ({ in_app: true, email: on(env.NOTIFY_EMAIL), sms: on(env.NOTIFY_SMS) });

// ===== SETTINGS · Audit log filters =====
// Query string -> Prisma `where` for AuditLog. Dates are whole days (to = end of that day).
export const OUTCOMES = ['SUCCESS', 'FAILURE', 'DENIED'];
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-10-19.');
export const AuditQuery = z.object({
  q: z.string().trim().max(100).optional(), actor: z.string().trim().max(100).optional(), action: z.string().trim().max(100).optional(),
  entity: z.string().trim().max(60).optional(), outcome: z.enum(OUTCOMES).optional(), from: day.optional(), to: day.optional(),
  page: z.coerce.number().int().min(1).max(100000).default(1), size: z.coerce.number().int().min(10).max(200).default(50),
});
export function auditWhere(f) {
  const and = [];
  if (f.actor) {
    const t = f.actor;
    and.push(t.toLowerCase() === 'system' ? { actorId: null } : { actor: { OR: [{ username: { contains: t, mode: 'insensitive' } }, { displayName: { contains: t, mode: 'insensitive' } }] } });
  }
  if (f.action) and.push({ action: { startsWith: f.action } });
  if (f.entity) and.push({ entityType: f.entity });
  if (f.outcome) and.push({ outcome: f.outcome });
  if (f.from) and.push({ at: { gte: new Date(f.from + 'T00:00:00') } });
  if (f.to) and.push({ at: { lt: new Date(new Date(f.to + 'T00:00:00').getTime() + 864e5) } });
  if (f.q) and.push({ OR: [{ action: { contains: f.q, mode: 'insensitive' } }, { entityType: { contains: f.q, mode: 'insensitive' } }, { entityId: f.q }, { ip: { contains: f.q } }, { actor: { displayName: { contains: f.q, mode: 'insensitive' } } }, { actor: { username: { contains: f.q, mode: 'insensitive' } } }] });
  return and.length ? { AND: and } : {};
}
// One audit row as the browser sees it (BigInt id as text).
export const auditRow = r => ({ id: String(r.id), at: r.at, action: r.action, entityType: r.entityType, entityId: r.entityId, outcome: r.outcome, ip: r.ip, before: r.before ?? null, after: r.after ?? null, actor: r.actor ? { id: r.actor.id, name: r.actor.displayName, username: r.actor.username } : null });

// ===== SETTINGS · CSV =====
// Cells starting with = + - @ are prefixed with ' so spreadsheet programs never run them as formulas.
export function csvCell(v) {
  let s = v == null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}
export const toCsv = (headers, rows) => [headers.map(csvCell).join(','), ...rows.map(r => r.map(csvCell).join(','))].join('\r\n');
