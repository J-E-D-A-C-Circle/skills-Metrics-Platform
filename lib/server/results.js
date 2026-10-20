// =============================================================================
// results.js · Taking assessments on the server: starting / resuming attempts, marking, submitting, final results
//   and active page time
// Screen / URL: none; server only. Used by My Assessments (/assessments) and Take Assessment (/take?id=)
// Used by: app/api/my/**, app/api/attempts/**, any module that completes an attempt or corrects a score
//   (call rebuildFinalResults / completeMarkedAttempt inside its own transaction)
// Depends on: lib/server/{db,http,audit,notify,assigned}.js, lib/scoring.js
// Sections (search for these markers): RESULTS · Marking answers, RESULTS · Start rules, RESULTS · Active time slices,
//   RESULTS · Scoring configuration, RESULTS · Final results rebuild, RESULTS · Staff record & assignment,
//   RESULTS · Expiring overdue attempts, RESULTS · Starting an attempt, RESULTS · Saving an answer,
//   RESULTS · Recording active time, RESULTS · Scoring and completing, RESULTS · Submitting an attempt,
//   RESULTS · Results for the participant, RESULTS · My assessments list
// Rules (Skills Metrics prompt, sections 9 to 14):
//   - Attempts belong to the STAFF RECORD (never to a login), so a second linked account can't add attempts.
//   - Every started attempt uses one of the allowed attempts (assigned.js attemptsUsed). Starting is serialised per
//     person and assessment (an advisory lock + the unique (staffId, assessmentId, attemptNo)), so double clicks
//     and two tabs never create two attempts; an IN_PROGRESS attempt is resumed instead.
//   - An attempt still IN_PROGRESS when the person's deadline (with extensions) passes becomes EXPIRED and is never
//     counted. Answers can't be saved or submitted after the deadline.
//   - Submitting marks every answer, stores a score per competency (lib/scoring.js scoreAttempt), completes the
//     attempt and rebuilds FinalCompetencyResult from ALL completed attempts (lib/scoring.js summarize) in ONE
//     transaction. Submitting twice does nothing the second time.
//   - Multiple choice is marked right only when the chosen set exactly matches the correct set (no part marks).
//     The chosen option ids are kept in AttemptResponse.textAnswer as JSON ("[3,5]") because a response row holds
//     only one optionId. TEXT questions leave the attempt PENDING_MARKING until a marker sets isCorrect and calls
//     completeMarkedAttempt().
//   - Active page time never affects scores. Slices from several tabs that overlap are counted once.
// =============================================================================
import 'server-only';
import { db } from './db';
import { ApiError } from './http';
import { audit } from './audit';
import { notify, accountsForStaff, fmtDate } from './notify';
import { assessmentsForStaff, assignmentFor, attemptsUsed, attemptsCompleted, progressStatus, resultsReleased, PROGRESS_LABEL } from './assigned';
import { scoreAttempt, summarize, gapValue, COUNTED_STATUSES, DEFAULT_CONFIG } from '../scoring';

// ===== RESULTS · Marking answers =====
// Chosen option ids for a stored response: optionId for single choice / true-false, the JSON list for multiple choice.
export function chosenIds(resp) {
  if (!resp) return [];
  if (resp.optionId != null) return [resp.optionId];
  if (resp.textAnswer && /^\s*\[/.test(resp.textAnswer)) { try { const v = JSON.parse(resp.textAnswer); return Array.isArray(v) ? v.filter(Number.isInteger) : []; } catch (e) { return []; } }
  return [];
}
// true / false for an answered choice question, null for TEXT (needs a marker) and for unanswered questions.
// question: { type, options: [{ id, isCorrect }] }.
export function markResponse(question, resp) {
  if (!resp) return null;
  if (question.type === 'TEXT') return resp.isCorrect ?? null; // set by a marker
  const picked = [...new Set(chosenIds(resp))];
  if (!picked.length) return null;
  const right = question.options.filter(o => o.isCorrect).map(o => o.id);
  if (question.type === 'MULTIPLE_CHOICE') return picked.length === right.length && picked.every(id => right.includes(id));
  return picked.length === 1 && right.includes(picked[0]);
}
// Marks for lib/scoring.js scoreAttempt: { [questionId]: true | false | undefined (unanswered) }.
export function marksFor(questions, responses) {
  const byQ = new Map(responses.map(r => [r.questionId, r])), marks = {};
  for (const q of questions) { const m = markResponse(q, byQ.get(q.id)); if (m != null) marks[q.id] = m; }
  return marks;
}
// The question list in the shape scoreAttempt expects.
export const scoringQuestions = questions => questions.map(q => ({ id: q.id, points: Number(q.points), competencies: q.competencies.map(c => c.competencyId) }));

// ===== RESULTS · Start rules =====
// Pure decision for "Start" (used by the server and its tests). entry = assessmentsForStaff entry (or null),
// attempts = this person's attempts on the assessment (any status, already expired if overdue).
// Returns { action: 'resume', attempt } | { action: 'create', attemptNo } | { action: 'refuse', status, message, code }.
export function startDecision({ entry, attempts, now = new Date() }) {
  const refuse = (status, code, message) => ({ action: 'refuse', status, code, message });
  if (!entry) return refuse(403, 'NOT_ASSIGNED', 'This assessment is not assigned to you.');
  if (entry.assessment.status !== 'PUBLISHED') return refuse(409, 'NOT_PUBLISHED', 'This assessment is not open for attempts at the moment.');
  if (now < entry.startsAt) return refuse(409, 'NOT_OPEN', 'This assessment opens on ' + fmtDate(entry.startsAt) + '.');
  if (now > entry.deadline) return refuse(409, 'PAST_DEADLINE', 'The deadline (' + fmtDate(entry.deadline) + ') has passed, so a new attempt cannot be started.');
  const open = attempts.find(a => a.status === 'IN_PROGRESS');
  if (open) return { action: 'resume', attempt: open };
  if (attemptsUsed(attempts) >= entry.maxAttempts) return refuse(409, 'LIMIT', 'You have used all ' + entry.maxAttempts + ' attempts allowed for this assessment.');
  return { action: 'create', attemptNo: attempts.reduce((m, a) => Math.max(m, a.attemptNo), 0) + 1 };
}

// ===== RESULTS · Active time slices =====
// The browser sends slices { questionId, start, end } (ms since 1970, by its own clock) plus sentAt (its clock when
// sending). cleanSlices moves them onto the server clock, drops nonsense, and clamps each slice to maxSliceMs and to
// the window from the attempt's start to now. Returns [{ questionId, start, end }] sorted by start.
export const MAX_SLICE_MS = 120e3; // the browser closes a slice every 15 s, so 2 minutes is already generous
export const MIN_PIECE_MS = 200;
export function cleanSlices(slices, { offsetMs = 0, nowMs, attemptStartMs, maxSliceMs = MAX_SLICE_MS }) {
  const out = [];
  for (const s of slices || []) {
    let start = Number(s.start) + offsetMs, end = Number(s.end) + offsetMs;
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
    if (end > nowMs) end = nowMs;
    if (start < attemptStartMs) start = attemptStartMs;
    if (end - start > maxSliceMs) start = end - maxSliceMs;
    if (end - start < MIN_PIECE_MS) continue;
    out.push({ questionId: s.questionId ?? null, start, end });
  }
  return out.sort((a, b) => a.start - b.start);
}
// Parts of [start, end) not already covered by any interval in `covered` ([{ start, end }]).
export function subtractCovered(piece, covered) {
  let parts = [{ start: piece.start, end: piece.end }];
  for (const c of covered) {
    if (c.end <= piece.start || c.start >= piece.end) continue;
    parts = parts.flatMap(p => {
      if (c.end <= p.start || c.start >= p.end) return [p];
      const keep = [];
      if (c.start > p.start) keep.push({ start: p.start, end: c.start });
      if (c.end < p.end) keep.push({ start: c.end, end: p.end });
      return keep;
    });
  }
  return parts.filter(p => p.end - p.start >= MIN_PIECE_MS).map(p => ({ ...piece, ...p }));
}
// New pieces to store: each slice minus what is already stored (any tab) and minus earlier slices in this batch.
export function newPieces(slices, existing) {
  const covered = existing.map(e => ({ start: e.start, end: e.end })), out = [];
  for (const s of slices) { const parts = subtractCovered(s, covered); out.push(...parts); covered.push(...parts); }
  return out;
}

// ===== RESULTS · Scoring configuration =====
// Newest active ScoringConfig row (thresholds as numbers) for new results.
export async function activeConfig(tx = db) {
  const row = (await tx.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } })) || (await tx.scoringConfig.findFirst({ orderBy: { version: 'desc' } }));
  if (!row) throw new ApiError(500, 'Scoring thresholds have not been set up yet. Please contact the administrator.');
  return { row, cfg: { requiredLevel: Number(row.requiredLevel), competentFrom: Number(row.competentFrom), proficientFrom: Number(row.proficientFrom), moderateGapFrom: Number(row.moderateGapFrom), noGapFrom: Number(row.noGapFrom), defaultMaxAttempts: row.defaultMaxAttempts } };
}

// ===== RESULTS · Final results rebuild =====
// Pure: attempts [{ status, scores: { [competencyId]: number } }] -> one FinalCompetencyResult row per competency
// that at least one COMPLETED attempt assessed (lib/scoring.js summarize; others are skipped, never 0).
export function buildFinalRows(attempts, cfg = DEFAULT_CONFIG) {
  const counted = attempts.filter(a => COUNTED_STATUSES.includes(a.status));
  const cids = [...new Set(counted.flatMap(a => Object.keys(a.scores || {})))];
  return cids.map(cid => ({ cid, r: summarize(counted, cid, cfg) })).filter(x => x.r.average != null)
    .map(({ cid, r }) => ({ competencyId: Number(cid), average: r.average, attemptsIncluded: r.attemptsIncluded, competencyStatus: r.competencyStatus, gapStatus: r.gapStatus }));
}
// Rebuilds the cached final results for one person and one assessment from ALL their completed attempts with the
// active scoring configuration. Call it inside the transaction that completes an attempt or corrects a score.
export async function rebuildFinalResults(tx, staffId, assessmentId) {
  const { row, cfg } = await activeConfig(tx);
  const attempts = await tx.attempt.findMany({ where: { staffId, assessmentId, status: { in: [...COUNTED_STATUSES] } }, include: { results: true } });
  const rows = buildFinalRows(attempts.map(a => ({ status: a.status, scores: Object.fromEntries(a.results.map(r => [r.competencyId, Number(r.score)])) })), cfg);
  await tx.finalCompetencyResult.deleteMany({ where: { staffId, assessmentId } });
  if (rows.length) await tx.finalCompetencyResult.createMany({ data: rows.map(r => ({ staffId, assessmentId, ...r, scoringConfigId: row.id })) });
  return rows;
}

// ===== RESULTS · Staff record & assignment =====
// The signed-in person's own staff record (never an id from the browser).
export async function myStaff(ctx, tx = db) {
  const id = ctx.account.staffId;
  if (!id) throw new ApiError(403, 'Your account is not linked to a staff record, so it cannot take assessments.');
  const staff = await tx.staffRecord.findUnique({ where: { id }, include: { station: true } });
  if (!staff || staff.status !== 'ACTIVE') throw new ApiError(403, 'Your staff record is not active, so it cannot take assessments.');
  return staff;
}
// Locks one attempt row until the transaction ends (saves, time slices and submit never interleave).
const lockAttempt = (tx, id) => tx.$executeRaw`SELECT 1 FROM "Attempt" WHERE id = ${id} FOR UPDATE`;
// Loads the signed-in person's attempt (404 for anyone else's, so ids can't be probed).
async function ownAttempt(tx, ctx, attemptId) {
  const at = await tx.attempt.findUnique({ where: { id: attemptId }, include: { assessment: true } });
  if (!at || at.staffId !== ctx.account.staffId) throw new ApiError(404, 'Attempt not found.');
  return at;
}

// ===== RESULTS · Expiring overdue attempts =====
// IN_PROGRESS attempts past the person's deadline become EXPIRED (they still use an attempt but never count).
// Mutates the given attempt objects so callers see the new status.
export async function expireOverdue(tx, entry, attempts, now = new Date()) {
  if (!entry || now <= entry.deadline) return 0;
  const late = attempts.filter(a => a.status === 'IN_PROGRESS');
  if (!late.length) return 0;
  await tx.attempt.updateMany({ where: { id: { in: late.map(a => a.id) }, status: 'IN_PROGRESS' }, data: { status: 'EXPIRED' } });
  for (const a of late) {
    a.status = 'EXPIRED';
    await audit({ actorId: null, action: 'attempt.expire', entityType: 'Attempt', entityId: a.id, before: { status: 'IN_PROGRESS' }, after: { status: 'EXPIRED', deadline: entry.deadline } }, tx);
  }
  return late.length;
}
// Checks an attempt can still be changed (saving answers, time, submitting). Returns the entry, or a reason.
async function editable(tx, ctx, at, now = new Date()) {
  if (at.status !== 'IN_PROGRESS') return { reason: [409, 'This attempt has already been submitted or closed.'] };
  const staff = await myStaff(ctx, tx), entry = await assignmentFor(staff, at.assessmentId, tx);
  if (!entry) return { reason: [403, 'This assessment is no longer assigned to you.'] };
  if (now > entry.deadline) { await expireOverdue(tx, entry, [at], now); return { reason: [409, 'The deadline has passed, so this attempt has been closed. It will not count towards your results.'], expired: true }; }
  if (at.assessment.status !== 'PUBLISHED') return { reason: [409, 'This assessment is not open for attempts at the moment.'] };
  return { entry };
}
// Runs fn in a transaction; when it returns { fail: [status, message] } the transaction is committed (so an
// expiry is saved) and the error is thrown afterwards.
async function txOrFail(fn, opts) {
  const r = await db.$transaction(fn, opts);
  if (r && r.fail) throw new ApiError(r.fail[0], r.fail[1], r.extra);
  return r;
}

// ===== RESULTS · Starting an attempt =====
// Start or resume. Serialised per person + assessment with a transaction-scoped advisory lock; the unique
// (staffId, assessmentId, attemptNo) is the last line of defence (a clash is retried once and then resumes).
export async function startAttempt({ ctx, assessmentId, ip }, retry = true) {
  try {
    return await txOrFail(async tx => {
      const staff = await myStaff(ctx, tx);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${staff.id}::int4, ${assessmentId}::int4)`;
      const entry = await assignmentFor(staff, assessmentId, tx), now = new Date();
      const attempts = await tx.attempt.findMany({ where: { staffId: staff.id, assessmentId }, orderBy: { attemptNo: 'asc' } });
      await expireOverdue(tx, entry, attempts, now);
      const d = startDecision({ entry, attempts, now });
      if (d.action === 'refuse') {
        await audit({ actorId: ctx.account.id, action: 'attempt.start', entityType: 'Assessment', entityId: assessmentId, outcome: 'DENIED', after: { reason: d.code }, ip }, tx);
        return { fail: [d.status, d.message], extra: { code: d.code } };
      }
      if (d.action === 'resume') return { attempt: d.attempt, resumed: true };
      const version = await tx.assessmentVersion.findFirst({ where: { assessmentId, status: 'PUBLISHED' }, orderBy: { versionNo: 'desc' } });
      if (!version) return { fail: [409, 'This assessment has no published questions yet.'] };
      const attempt = await tx.attempt.create({ data: { assessmentId, versionId: version.id, staffId: staff.id, accountId: ctx.account.id, attemptNo: d.attemptNo, status: 'IN_PROGRESS', startedAt: now } });
      await audit({ actorId: ctx.account.id, action: 'attempt.start', entityType: 'Attempt', entityId: attempt.id, after: { assessmentId, staffId: staff.id, attemptNo: d.attemptNo, versionId: version.id, maxAttempts: entry.maxAttempts }, ip }, tx);
      return { attempt, resumed: false };
    });
  } catch (e) {
    if (retry && e && e.code === 'P2002') return startAttempt({ ctx, assessmentId, ip }, false);
    throw e;
  }
}

// ===== RESULTS · Saving an answer =====
// b: { questionId, optionId?, optionIds?, textAnswer? }. Nothing chosen = the answer is cleared.
export async function saveAnswer({ ctx, attemptId, b }) {
  return txOrFail(async tx => {
    await lockAttempt(tx, attemptId);
    const at = await ownAttempt(tx, ctx, attemptId), ok = await editable(tx, ctx, at);
    if (ok.reason) return { fail: ok.reason, extra: ok.expired ? { code: 'EXPIRED' } : undefined };
    const q = await tx.question.findFirst({ where: { id: b.questionId, versionId: at.versionId }, include: { options: true } });
    if (!q) return { fail: [400, 'That question is not part of this attempt.'] };
    const valid = new Set(q.options.map(o => o.id));
    let data;
    if (q.type === 'TEXT') {
      const t = (b.textAnswer || '').trim();
      data = t ? { optionId: null, textAnswer: t } : null;
    } else if (q.type === 'MULTIPLE_CHOICE') {
      const ids = [...new Set(b.optionIds || (b.optionId != null ? [b.optionId] : []))];
      if (ids.some(id => !valid.has(id))) return { fail: [400, 'That answer is not one of the options.'] };
      data = ids.length ? { optionId: null, textAnswer: JSON.stringify(ids.sort((x, y) => x - y)) } : null;
    } else {
      const id = b.optionId ?? (b.optionIds && b.optionIds[0]);
      if (id != null && !valid.has(id)) return { fail: [400, 'That answer is not one of the options.'] };
      data = id != null ? { optionId: id, textAnswer: null } : null;
    }
    const where = { attemptId_questionId: { attemptId, questionId: q.id } }, savedAt = new Date();
    if (!data) { await tx.attemptResponse.deleteMany({ where: { attemptId, questionId: q.id } }); return { saved: true, cleared: true, savedAt }; }
    await tx.attemptResponse.upsert({ where, create: { attemptId, questionId: q.id, ...data, savedAt }, update: { ...data, isCorrect: null, savedAt } });
    return { saved: true, savedAt };
  });
}

// ===== RESULTS · Recording active time =====
// Stores the visible-page slices one tab sends. Overlaps with what any tab already sent are dropped, so two open
// tabs never double the time. Updates attempt.activeSeconds and elapsedSeconds. Ignored once the attempt is closed.
export async function recordTime({ ctx, attemptId, tabId, sentAt, slices }) {
  return db.$transaction(async tx => {
    await lockAttempt(tx, attemptId);
    const at = await ownAttempt(tx, ctx, attemptId);
    if (at.status !== 'IN_PROGRESS') return { ignored: true, activeSeconds: at.activeSeconds };
    const nowMs = Date.now(), offsetMs = Number.isFinite(sentAt) ? nowMs - sentAt : 0;
    const clean = cleanSlices(slices, { offsetMs, nowMs, attemptStartMs: at.startedAt.getTime() });
    if (!clean.length) return { stored: 0, activeSeconds: at.activeSeconds };
    const qIds = new Set((await tx.question.findMany({ where: { versionId: at.versionId }, select: { id: true } })).map(q => q.id));
    const from = new Date(clean[0].start), to = new Date(Math.max(...clean.map(s => s.end)));
    const existing = await tx.activeTimeSegment.findMany({ where: { attemptId, endedAt: { gt: from }, startedAt: { lt: to } }, select: { startedAt: true, endedAt: true } });
    const pieces = newPieces(clean, existing.map(e => ({ start: e.startedAt.getTime(), end: e.endedAt.getTime() })));
    if (pieces.length) await tx.activeTimeSegment.createMany({ data: pieces.map(p => ({ attemptId, tabId, questionId: qIds.has(p.questionId) ? p.questionId : null, startedAt: new Date(p.start), endedAt: new Date(p.end), seconds: Math.round((p.end - p.start) / 1000) })) });
    const totals = await timeTotals(tx, attemptId);
    await tx.attempt.update({ where: { id: attemptId }, data: { activeSeconds: totals, elapsedSeconds: Math.max(0, Math.round((nowMs - at.startedAt.getTime()) / 1000)) } });
    return { stored: pieces.length, activeSeconds: totals };
  });
}
// Whole seconds of stored active time for an attempt (summed from exact timestamps, so rounding never drifts).
async function timeTotals(tx, attemptId) {
  const r = await tx.$queryRaw`SELECT COALESCE(SUM(EXTRACT(EPOCH FROM ("endedAt" - "startedAt"))), 0)::float8 AS s FROM "ActiveTimeSegment" WHERE "attemptId" = ${attemptId}`;
  return Math.round(Number(r[0]?.s || 0));
}

// ===== RESULTS · Scoring and completing =====
// Scores a marked attempt (every response has isCorrect, or is unanswered), stores one CompetencyAttemptResult per
// competency asked, sets it COMPLETED and rebuilds the final results. Used by submit and by a marker finishing the
// TEXT answers of a PENDING_MARKING attempt. Returns the per-competency scores.
export async function completeMarkedAttempt(tx, attemptId, now = new Date()) {
  const at = await tx.attempt.findUnique({ where: { id: attemptId }, include: { responses: true, version: { include: { questions: { include: { options: true, competencies: true } } } } } });
  if (!at) throw new ApiError(404, 'Attempt not found.');
  const questions = at.version.questions, marks = {};
  for (const r of at.responses) if (r.isCorrect != null) marks[r.questionId] = r.isCorrect;
  const scores = scoreAttempt(scoringQuestions(questions), marks);
  await tx.competencyAttemptResult.deleteMany({ where: { attemptId } });
  const rows = Object.entries(scores).filter(([, r]) => r.score != null).map(([cid, r]) => ({ attemptId, competencyId: Number(cid), score: r.score, asked: r.asked, correct: r.correct }));
  if (rows.length) await tx.competencyAttemptResult.createMany({ data: rows });
  await tx.attempt.update({ where: { id: attemptId }, data: { status: 'COMPLETED', completedAt: now } });
  await rebuildFinalResults(tx, at.staffId, at.assessmentId);
  return scores;
}

// ===== RESULTS · Submitting an attempt =====
// One transaction: mark every answer, save per-question time, then complete (or leave PENDING_MARKING when the
// version has TEXT questions), notify and audit. A second submit of the same attempt returns { already: true }.
export async function submitAttempt({ ctx, attemptId, ip }) {
  return txOrFail(async tx => {
    await lockAttempt(tx, attemptId);
    const at = await ownAttempt(tx, ctx, attemptId);
    if (at.status !== 'IN_PROGRESS') return { already: true, status: at.status, attemptId };
    const ok = await editable(tx, ctx, at);
    if (ok.reason) return { fail: ok.reason, extra: ok.expired ? { code: 'EXPIRED' } : undefined };
    const now = new Date();
    const version = await tx.assessmentVersion.findUnique({ where: { id: at.versionId }, include: { questions: { include: { options: true } } } });
    const responses = await tx.attemptResponse.findMany({ where: { attemptId } });
    const qById = new Map(version.questions.map(q => [q.id, q])), right = [], wrong = [];
    for (const r of responses) { const q = qById.get(r.questionId); if (!q || q.type === 'TEXT') continue; (markResponse(q, r) ? right : wrong).push(r.id); }
    if (right.length) await tx.attemptResponse.updateMany({ where: { id: { in: right } }, data: { isCorrect: true } });
    if (wrong.length) await tx.attemptResponse.updateMany({ where: { id: { in: wrong } }, data: { isCorrect: false } });
    await tx.$executeRaw`UPDATE "AttemptResponse" r SET "activeSeconds" = COALESCE((SELECT ROUND(SUM(EXTRACT(EPOCH FROM (s."endedAt" - s."startedAt"))))::int FROM "ActiveTimeSegment" s WHERE s."attemptId" = r."attemptId" AND s."questionId" = r."questionId"), 0) WHERE r."attemptId" = ${attemptId}`;
    const activeSeconds = await timeTotals(tx, attemptId), elapsedSeconds = Math.max(0, Math.round((now.getTime() - at.startedAt.getTime()) / 1000));
    const pending = version.questions.some(q => q.type === 'TEXT');
    await tx.attempt.update({ where: { id: attemptId }, data: { status: pending ? 'PENDING_MARKING' : 'SUBMITTED', submittedAt: now, activeSeconds, elapsedSeconds } });
    if (!pending) await completeMarkedAttempt(tx, attemptId, now);
    const status = pending ? 'PENDING_MARKING' : 'COMPLETED';
    await notify({ accountIds: await accountsForStaff([at.staffId], tx), key: 'assessment.completed', vars: { title: at.assessment.title, attemptNo: at.attemptNo }, link: '/assessments', dedupe: 'attempt.completed:' + attemptId }, tx);
    await audit({ actorId: ctx.account.id, action: 'attempt.submit', entityType: 'Attempt', entityId: attemptId, before: { status: 'IN_PROGRESS' }, after: { status, answered: responses.length, questions: version.questions.length, activeSeconds, elapsedSeconds }, ip }, tx);
    return { already: false, status, attemptId };
  }, { timeout: 30000 });
}

// ===== RESULTS · Results for the participant =====
// Final average per competency (from FinalCompetencyResult) and each completed attempt's score per competency.
export async function resultsFor(tx, staffId, assessmentId) {
  const [finals, attempts] = await Promise.all([
    tx.finalCompetencyResult.findMany({ where: { staffId, assessmentId }, include: { competency: { select: { id: true, code: true, name: true, short: true } }, scoringConfig: true } }),
    tx.attempt.findMany({ where: { staffId, assessmentId, status: { in: [...COUNTED_STATUSES] } }, orderBy: { attemptNo: 'asc' }, include: { results: true } }),
  ]);
  const rows = finals.map(f => {
    const avg = Number(f.average), cfg = { requiredLevel: Number(f.scoringConfig.requiredLevel) };
    return { competencyId: f.competencyId, code: f.competency.code, name: f.competency.name, short: f.competency.short, average: avg, attemptsIncluded: f.attemptsIncluded, competencyStatus: f.competencyStatus, gapStatus: f.gapStatus, gap: gapValue(avg, { ...DEFAULT_CONFIG, ...cfg }) };
  }).sort((a, b) => a.name.localeCompare(b.name));
  return {
    competencies: rows,
    attempts: attempts.map(a => ({ id: a.id, attemptNo: a.attemptNo, completedAt: a.completedAt, scores: Object.fromEntries(a.results.map(r => [r.competencyId, Number(r.score)])) })),
    // Separately labelled: the plain mean of the competency averages (no weighting). Never replaces a competency result.
    overall: rows.length ? rows.reduce((s, r) => s + r.average, 0) / rows.length : null,
  };
}
// Wording for "results not released yet".
export function releaseNote(assessment, entry) {
  if (assessment.resultRelease === 'MANUAL') return 'Results will be available once the administrator releases them.';
  if (assessment.resultRelease === 'AFTER_DEADLINE') return 'Results will be available after the deadline' + (entry ? ' (' + fmtDate(entry.deadline) + ')' : '') + '.';
  return 'Results will be available soon.';
}

// ===== RESULTS · My assessments list =====
// One entry per assessment assigned to the signed-in person (plus assessments they attempted that are no longer
// assigned, as history). With assessmentId, only that one (404 when it is neither assigned nor attempted).
export async function myAssessments(ctx, { assessmentId, withResults = false } = {}) {
  return db.$transaction(async tx => {
    const staff = await myStaff(ctx, tx), now = new Date();
    let entries = await assessmentsForStaff(staff, tx);
    const attempts = await tx.attempt.findMany({ where: { staffId: staff.id, ...(assessmentId ? { assessmentId } : {}) }, orderBy: { attemptNo: 'asc' } });
    if (assessmentId) entries = entries.filter(e => e.assessmentId === assessmentId);
    const extra = [...new Set(attempts.map(a => a.assessmentId))].filter(id => !entries.some(e => e.assessmentId === id));
    const extraAssessments = extra.length ? await tx.assessment.findMany({ where: { id: { in: extra } } }) : [];
    const list = [...entries, ...extraAssessments.map(a => ({ assessment: a, assessmentId: a.id, assignmentIds: [], startsAt: null, deadline: null, maxAttempts: a.maxAttempts, unassigned: true }))];
    if (assessmentId && !list.length) throw new ApiError(404, 'This assessment is not assigned to you.');
    // Deadlines that came from an extension (shown as "Extended").
    const ids = list.flatMap(e => e.assignmentIds);
    const assignments = ids.length ? await tx.assessmentAssignment.findMany({ where: { id: { in: ids } }, include: { extensions: { where: { OR: [{ staffId: null }, { staffId: staff.id }] }, orderBy: { at: 'desc' } } } }) : [];
    const out = [];
    for (const e of list) {
      const mine = attempts.filter(a => a.assessmentId === e.assessmentId), entry = e.unassigned ? null : e;
      await expireOverdue(tx, entry, mine, now);
      const a = e.assessment, released = resultsReleased(a, entry, now);
      const d = startDecision({ entry, attempts: mine, now });
      const open = mine.find(x => x.status === 'IN_PROGRESS');
      const base = assignments.filter(x => e.assignmentIds.includes(x.id));
      const baseDeadline = base.length ? new Date(Math.max(...base.map(x => new Date(x.deadline).getTime()))) : null;
      const ext = base.flatMap(x => x.extensions).find(x => entry && new Date(x.newDeadline).getTime() === entry.deadline.getTime());
      const item = {
        assessmentId: e.assessmentId, title: a.title, description: a.description, instructions: a.instructions, assessmentStatus: a.status,
        startsAt: e.startsAt, deadline: e.deadline, originalDeadline: ext ? baseDeadline : null, extensionReason: ext ? ext.reason : null, unassigned: !!e.unassigned,
        maxAttempts: e.maxAttempts, used: attemptsUsed(mine), completed: attemptsCompleted(mine), remaining: Math.max(0, e.maxAttempts - attemptsUsed(mine)),
        progress: entry ? progressStatus(entry, mine, now) : 'COMPLETED', inProgressAttemptId: open ? open.id : null,
        canStart: d.action === 'create', canResume: d.action === 'resume', blockedReason: d.action === 'refuse' ? d.message : null,
        released, releaseNote: released ? null : releaseNote(a, entry), resultRelease: a.resultRelease,
        attempts: mine.map(x => ({ id: x.id, attemptNo: x.attemptNo, status: x.status, startedAt: x.startedAt, submittedAt: x.submittedAt, completedAt: x.completedAt, activeSeconds: x.status === 'IN_PROGRESS' ? null : x.activeSeconds, elapsedSeconds: x.status === 'IN_PROGRESS' ? null : x.elapsedSeconds })),
      };
      if (e.unassigned) item.progress = attemptsCompleted(mine) ? 'COMPLETED' : 'NOT_STARTED';
      item.progressLabel = e.unassigned ? 'No longer assigned' : PROGRESS_LABEL[item.progress];
      if (released && item.completed) {
        const r = await resultsFor(tx, staff.id, e.assessmentId);
        item.summary = { competencies: r.competencies.length, competent: r.competencies.filter(c => c.competencyStatus !== 'NOT_COMPETENT').length, proficient: r.competencies.filter(c => c.competencyStatus === 'PROFICIENT').length, critical: r.competencies.filter(c => c.gapStatus === 'CRITICAL').length, moderate: r.competencies.filter(c => c.gapStatus === 'MODERATE').length, noGap: r.competencies.filter(c => c.gapStatus === 'NONE').length };
        if (withResults) item.results = r;
      }
      out.push(item);
    }
    const order = { IN_PROGRESS: 0, NOT_STARTED: 1, OVERDUE: 2, UPCOMING: 3, COMPLETED: 4 };
    const t = d => (d ? new Date(d).getTime() : Infinity);
    return out.sort((x, y) => (x.unassigned - y.unassigned) || (order[x.progress] - order[y.progress]) || (t(x.deadline) - t(y.deadline)) || x.title.localeCompare(y.title));
  }, { timeout: 20000 });
}
