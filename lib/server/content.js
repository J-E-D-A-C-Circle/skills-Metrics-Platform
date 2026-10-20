// =============================================================================
// content.js · Assessment Content rules: workflow statuses, who may act, question checks, bulk-upload parsing,
//   and the database helpers the content routes share
// Screen / URL: Assessment Content (/forms, /forms?id=<assessment id>)
// Used by: app/api/content/** (server) and components/SMContent.jsx (the same checks run in the browser for instant
//   hints; the server always re-checks). tests/content.test.js tests the pure rules.
// Depends on: nothing at import time. The database helpers take the Prisma client / transaction as their first
//   argument, so this file stays free of server-only imports and can be unit-tested and shared with the screen.
// Sections (search for these markers): CONTENT · Statuses & labels, CONTENT · Workflow rules, CONTENT · Who may act,
//   CONTENT · Question checks, CONTENT · Assessment checks, CONTENT · Bulk upload template, CONTENT · Bulk upload parsing,
//   CONTENT · Arranging questions, CONTENT · Planned audience, CONTENT · Database helpers,
//   CONTENT · Shapes sent to the screen
// Workflow: Draft -> Submitted for review -> Returned (for revision) | Rejected | Approved -> Published -> Archived.
//   Questions belong to a version. A published version is never edited: "New version" copies it into versionNo+1 as a
//   Draft that goes through review again, and attempts keep pointing at the version they used.
// =============================================================================

// ===== CONTENT · Statuses & labels =====
// Text label + neutral colour pair for each status (never colour alone).
export const STATUS_LABEL = { DRAFT: 'Draft', SUBMITTED: 'Submitted for review', RETURNED: 'Returned for revision', REJECTED: 'Rejected', APPROVED: 'Approved', PUBLISHED: 'Published', ARCHIVED: 'Archived' };
export const STATUS_COLOURS = { DRAFT: ['#f3f4f6', '#374151'], SUBMITTED: ['#e0e7ff', '#3730a3'], RETURNED: ['#fef3c7', '#92400e'], REJECTED: ['#fee2e2', '#b91c1c'], APPROVED: ['#e0f2fe', '#0369a1'], PUBLISHED: ['#dcfce7', '#15803d'], ARCHIVED: ['#f3f4f6', '#6b7280'] };
export const STATUSES = Object.keys(STATUS_LABEL);
export const TYPE_LABEL = { SINGLE_CHOICE: 'Single choice', MULTIPLE_CHOICE: 'Multiple choice', TRUE_FALSE: 'True / false', TEXT: 'Written answer (marked manually)' };
export const QUESTION_TYPES = Object.keys(TYPE_LABEL);
export const RELEASE_LABEL = { IMMEDIATE: 'As soon as an attempt is completed', AFTER_DEADLINE: 'After the deadline', MANUAL: 'When an administrator releases them' };
export const ACTION_LABEL = { CREATE: 'Created', SUBMIT: 'Submitted for review', APPROVE: 'Approved', REJECT: 'Rejected', RETURN: 'Returned for revision', PUBLISH: 'Published', ARCHIVE: 'Archived', SUPERSEDE: 'Replaced by a newer version' };
export const LIMITS = { title: 200, description: 2000, instructions: 4000, text: 2000, option: 500, skillArea: 120, options: 10, competencies: 10, points: 100, weight: 100, maxAttempts: 10, importRows: 1000, feedback: 2000 };

// ===== CONTENT · Workflow rules =====
// Version statuses a creator may still change, the statuses everyone with "View" may open, and the transitions.
export const EDITABLE = ['DRAFT', 'RETURNED', 'REJECTED'];
export const IN_PROGRESS = ['DRAFT', 'SUBMITTED', 'RETURNED', 'REJECTED'];
export const SHARED = ['APPROVED', 'PUBLISHED', 'ARCHIVED'];
// action -> { from: allowed current version statuses, to: new status, perm: permission key, event: review event action }
export const TRANSITIONS = {
  submit: { from: ['DRAFT', 'RETURNED', 'REJECTED'], to: 'SUBMITTED', perm: 'forms.edit', event: 'SUBMIT' },
  approve: { from: ['SUBMITTED'], to: 'APPROVED', perm: 'forms.review', event: 'APPROVE' },
  return: { from: ['SUBMITTED'], to: 'RETURNED', perm: 'forms.review', event: 'RETURN', feedback: true },
  reject: { from: ['SUBMITTED'], to: 'REJECTED', perm: 'forms.review', event: 'REJECT', feedback: true },
  publish: { from: ['APPROVED'], to: 'PUBLISHED', perm: 'forms.publish', event: 'PUBLISH' },
};
export const canMove = (action, status) => !!TRANSITIONS[action] && TRANSITIONS[action].from.includes(status);

// Assessment.status is what the rest of the app reads (assignments, My Assessments): ARCHIVED once retired,
// PUBLISHED while any version is live (a newer draft in review does not take it offline), otherwise the newest
// version's status. versions: [{ versionNo, status }].
export function assessmentStatus(versions, archived) {
  if (archived) return 'ARCHIVED';
  if ((versions || []).some(v => v.status === 'PUBLISHED')) return 'PUBLISHED';
  const latest = [...(versions || [])].sort((a, b) => b.versionNo - a.versionNo)[0];
  return latest ? latest.status : 'DRAFT';
}

// ===== CONTENT · Who may act =====
// The author of a version is the person who created it (its CREATE review event); version 1 of content loaded
// before events were recorded falls back to the assessment's creator. Submitters also count as authors, so a
// creator can never approve or publish their own work, whatever ticks they hold.
export function versionAuthorId(version, assessment) {
  const ev = (version.reviewEvents || []).find(e => e.action === 'CREATE');
  return ev ? ev.actorId : version.versionNo === 1 ? assessment.createdById : null;
}
export function isOwnWork(actorId, version, assessment) {
  if (versionAuthorId(version, assessment) === actorId) return true;
  return (version.reviewEvents || []).some(e => e.action === 'SUBMIT' && e.actorId === actorId);
}
// May this person open this version's questions? Reviewers see everything; others see shared versions and their own.
export function canSeeVersion(user, version, assessment) {
  if (user.perms.includes('forms.review')) return true;
  if (SHARED.includes(version.status)) return true;
  return isOwnWork(user.id, version, assessment);
}
// Buttons the screen may show (the server checks the same things again when the action arrives).
// versions must include reviewEvents; sorted any order.
export function allowedActions(user, assessment, versions) {
  const p = k => user.perms.includes(k);
  const byNo = [...versions].sort((a, b) => b.versionNo - a.versionNo);
  const latest = byNo[0];
  const archived = assessment.status === 'ARCHIVED';
  const mine = latest && versionAuthorId(latest, assessment) === user.id;
  const editable = !archived && latest && EDITABLE.includes(latest.status) && mine;
  const submitted = byNo.find(v => v.status === 'SUBMITTED');
  const live = byNo.find(v => v.status === 'PUBLISHED');
  const approved = byNo.find(v => v.status === 'APPROVED' && (!live || v.versionNo > live.versionNo));
  return {
    edit: !!(editable && p('forms.edit')),
    upload: !!(editable && p('forms.create')),
    submit: !!(editable && p('forms.edit')),
    review: !!(!archived && submitted && p('forms.review') && !isOwnWork(user.id, submitted, assessment)),
    reviewOwn: !!(!archived && submitted && p('forms.review') && isOwnWork(user.id, submitted, assessment)),
    publish: !!(!archived && approved && p('forms.publish') && !isOwnWork(user.id, approved, assessment)),
    publishOwn: !!(!archived && approved && p('forms.publish') && isOwnWork(user.id, approved, assessment)),
    newVersion: !!(!archived && latest && ['APPROVED', 'PUBLISHED'].includes(latest.status) && p('forms.create')),
    archive: !!(!archived && p('forms.archive')),
    submittedVersionId: submitted ? submitted.id : null,
    approvedVersionId: approved ? approved.id : null,
    latestVersionId: latest ? latest.id : null,
  };
}

// ===== CONTENT · Question checks =====
// A question as the editor and the importer hand it over:
//   { type, text, skillArea, points, options: [{ text, isCorrect }], competencies: [{ competencyId, weight }] }
// compById: Map(competencyId -> { id, code, name, active }) of known competencies.
// Returns a list of plain-English problems (empty when the question is fine).
const clean = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
export const sameText = s => clean(s).toLowerCase().replace(/[^a-z0-9 ]/g, '');
export function questionProblems(q, compById) {
  const out = [];
  const type = q.type || 'SINGLE_CHOICE';
  if (!QUESTION_TYPES.includes(type)) out.push('Choose a question type.');
  if (!clean(q.text)) out.push('Enter the question text.');
  else if (clean(q.text).length > LIMITS.text) out.push('The question text is too long (' + LIMITS.text + ' characters at most).');
  const pts = Number(q.points);
  if (q.points === '' || q.points == null || !Number.isFinite(pts) || pts <= 0 || pts > LIMITS.points) out.push('Points must be a number greater than 0 and no more than ' + LIMITS.points + '.');
  if (type !== 'TEXT') {
    const opts = (q.options || []).map(o => ({ text: clean(o.text), isCorrect: !!o.isCorrect }));
    const correct = opts.filter(o => o.isCorrect).length;
    if (opts.length < 2) out.push('Add at least 2 answer options.');
    if (opts.length > LIMITS.options) out.push('Use no more than ' + LIMITS.options + ' answer options.');
    if (opts.some(o => !o.text)) out.push('Every answer option needs text (remove empty ones).');
    if (opts.some(o => o.text.length > LIMITS.option)) out.push('An answer option is too long (' + LIMITS.option + ' characters at most).');
    const seen = new Set();
    if (opts.some(o => { const k = sameText(o.text); if (!k) return false; if (seen.has(k)) return true; seen.add(k); return false; })) out.push('Two answer options are the same.');
    if (correct === 0) out.push('Mark the correct answer.');
    else if (type !== 'MULTIPLE_CHOICE' && correct > 1) out.push('A ' + (type === 'TRUE_FALSE' ? 'true / false' : 'single-choice') + ' question can only have one correct answer.');
    if (type === 'TRUE_FALSE' && opts.length !== 2) out.push('A true / false question has exactly 2 options.');
  }
  const comps = q.competencies || [];
  if (!comps.length) out.push('Map the question to at least one competency.');
  if (comps.length > LIMITS.competencies) out.push('Map the question to no more than ' + LIMITS.competencies + ' competencies.');
  const ids = new Set();
  comps.forEach(c => {
    const k = compById && compById.get(Number(c.competencyId));
    if (!k) out.push('A mapped competency no longer exists.');
    else if (!k.active) out.push(k.name + ' is retired; map the question to an active competency.');
    if (ids.has(Number(c.competencyId))) out.push('The same competency is mapped twice.');
    ids.add(Number(c.competencyId));
    const w = Number(c.weight);
    if (c.weight === '' || c.weight == null || !Number.isFinite(w) || w <= 0 || w > LIMITS.weight) out.push('Competency weight must be greater than 0 and no more than ' + LIMITS.weight + '.');
  });
  if (clean(q.skillArea).length > LIMITS.skillArea) out.push('The skill area is too long.');
  return [...new Set(out)];
}
// The stored shape of a question, tidied (trimmed text, numbers, true/false options fixed, written answers without options).
export function normaliseQuestion(q) {
  const type = QUESTION_TYPES.includes(q.type) ? q.type : 'SINGLE_CHOICE';
  let options = type === 'TEXT' ? [] : (q.options || []).map(o => ({ text: clean(o.text), isCorrect: !!o.isCorrect }));
  if (type === 'TRUE_FALSE' && !options.length) options = [{ text: 'True', isCorrect: false }, { text: 'False', isCorrect: false }];
  return {
    type, text: clean(q.text), skillArea: clean(q.skillArea) || null, points: Number(q.points),
    options, competencies: (q.competencies || []).map(c => ({ competencyId: Number(c.competencyId), weight: Number(c.weight) })),
  };
}

// ===== CONTENT · Assessment checks =====
// Run before submitting for review (and shown live in the editor). questions: stored questions in order.
// Returns [{ order: question number or null for the whole assessment, message }].
export function assessmentProblems({ title, questions }, compById) {
  const out = [];
  if (!clean(title)) out.push({ order: null, message: 'Give the assessment a title.' });
  if (!(questions || []).length) out.push({ order: null, message: 'Add at least one question.' });
  const firstSeen = new Map();
  (questions || []).forEach((q, i) => {
    const n = q.order || i + 1;
    questionProblems(q, compById).forEach(message => out.push({ order: n, message }));
    const k = sameText(q.text);
    if (k) { if (firstSeen.has(k)) out.push({ order: n, message: 'Same question as question ' + firstSeen.get(k) + '.' }); else firstSeen.set(k, n); }
  });
  return out;
}

// ===== CONTENT · Bulk upload template =====
// Columns of the Excel / CSV template (the first row of the sheet). Matching ignores case, spaces and punctuation.
export const OPTION_LETTERS = 'ABCDEFGHIJ'.split('');
export const TEMPLATE_HEADERS = ['Question', 'Type', 'Option A', 'Option B', 'Option C', 'Option D', 'Option E', 'Option F', 'Correct answer(s)', 'Points', 'Skill area', 'Competency codes'];
export const TEMPLATE_EXAMPLES = [
  ['Which document must accompany every request for a new driving licence?', 'Single choice', 'A completed application form', 'A vehicle invoice', 'A tax clearance certificate', 'None of these', '', '', 'A', 1, 'Front-desk service', 'service'],
  ['Which of these are good ways to confirm a caller is who they say they are? (choose all that apply)', 'Multiple choice', 'Ask for their licence number', 'Ask for their date of birth', 'Accept their name only', '', '', '', 'A, B', 2, 'Data protection', 'service; comm:0.5'],
  ['A customer complaint should always be written down in the complaints register.', 'True / false', 'True', 'False', '', '', '', '', 'True', 1, '', 'service'],
];
export const TEMPLATE_NOTES = [
  ['How to fill in the question template'],
  ['One question per row on the "Questions" sheet. Keep the first row (the column names) as it is.'],
  ['Type: Single choice, Multiple choice, True / false or Written (written answers are marked manually). Empty = Single choice.'],
  ['Options: fill Option A, Option B ... in order (at least 2). For True / false you can leave the options empty.'],
  ['Correct answer(s): the option letter (A), several letters for Multiple choice (A, C), or True / False.'],
  ['Points: a number greater than 0 (empty = 1).'],
  ['Competency codes: one or more codes from the "Competencies" sheet, separated by ";". Add ":weight" to weight one (e.g. rb1; rb2:0.5).'],
  ['Nothing is imported until every row is valid. Errors are listed by row number so you can fix the file and upload it again.'],
];

// ===== CONTENT · Bulk upload parsing =====
// rows: the sheet as an array of rows (arrays of cell values), first row = headers.
// comps: [{ id, code, name, active }]. existingTexts: question texts already in the version (when appending).
// Returns { questions: [normalised question + row], errors: [{ row, messages }], fileErrors: [message], total }.
const key = h => String(h == null ? '' : h).toLowerCase().replace(/[^a-z0-9]/g, '');
const HEADER_KEYS = {
  text: ['question', 'questiontext', 'text'], type: ['type', 'questiontype'], correct: ['correctanswers', 'correctanswer', 'correct', 'answer', 'answers', 'answerkey'],
  points: ['points', 'point', 'marks', 'score'], skillArea: ['skillarea', 'area'], competencies: ['competencycodes', 'competencycode', 'competencies', 'competency'],
};
const TYPE_WORDS = { singlechoice: 'SINGLE_CHOICE', single: 'SINGLE_CHOICE', singleanswer: 'SINGLE_CHOICE', sc: 'SINGLE_CHOICE', mcq: 'SINGLE_CHOICE',
  multiplechoice: 'MULTIPLE_CHOICE', multiple: 'MULTIPLE_CHOICE', multi: 'MULTIPLE_CHOICE', multipleselect: 'MULTIPLE_CHOICE', multiselect: 'MULTIPLE_CHOICE', mc: 'MULTIPLE_CHOICE',
  truefalse: 'TRUE_FALSE', trueorfalse: 'TRUE_FALSE', tf: 'TRUE_FALSE', written: 'TEXT', text: 'TEXT', writtenanswer: 'TEXT', open: 'TEXT', opentext: 'TEXT' };
export function parseType(v) { const k = key(v); return k ? TYPE_WORDS[k] || null : 'SINGLE_CHOICE'; }
export function mapHeaders(headerRow) {
  const cols = {}, optionCols = [];
  (headerRow || []).forEach((h, i) => {
    const k = key(h);
    const m = /^option([a-j])$/.exec(k);
    if (m) { optionCols.push([m[1].toUpperCase(), i]); return; }
    for (const [field, names] of Object.entries(HEADER_KEYS)) if (names.includes(k) && cols[field] == null) cols[field] = i;
  });
  optionCols.sort((a, b) => a[0].localeCompare(b[0]));
  return { cols, optionCols };
}
export function parseCompetencyCell(v) {
  return String(v == null ? '' : v).split(/[;,|\n]+/).map(s => s.trim()).filter(Boolean).map(part => {
    const [code, w] = part.split(':').map(s => s.trim());
    return { code: code.toLowerCase(), weight: w == null || w === '' ? 1 : Number(w), raw: part };
  });
}
export function parseImportRows(rows, comps, existingTexts = []) {
  const fileErrors = [], errors = [], questions = [];
  const all = Array.isArray(rows) ? rows : [];
  const head = all[0] || [];
  const { cols, optionCols } = mapHeaders(head);
  if (cols.text == null) fileErrors.push('The "Question" column is missing. Use the template and keep its first row.');
  if (cols.correct == null) fileErrors.push('The "Correct answer(s)" column is missing.');
  if (cols.competencies == null) fileErrors.push('The "Competency codes" column is missing.');
  if (fileErrors.length) return { questions, errors, fileErrors, total: 0 };
  const byCode = new Map((comps || []).map(c => [String(c.code).toLowerCase(), c]));
  const compById = new Map((comps || []).map(c => [c.id, c]));
  const seen = new Map((existingTexts || []).map(t => [sameText(t), 'an existing question']));
  const cell = (r, i) => (i == null ? '' : r[i] == null ? '' : String(r[i]).trim());
  let total = 0;
  for (let i = 1; i < all.length; i++) {
    const r = Array.isArray(all[i]) ? all[i] : [];
    if (!r.some(c => String(c == null ? '' : c).trim())) continue; // blank line
    total++;
    const rowNo = i + 1, msgs = [];
    if (total > LIMITS.importRows) { fileErrors.push('The file has more than ' + LIMITS.importRows + ' questions. Split it into smaller files.'); break; }
    const type = parseType(cell(r, cols.type));
    if (!type) msgs.push('Unknown type "' + cell(r, cols.type) + '" (use Single choice, Multiple choice, True / false or Written).');
    const t = type || 'SINGLE_CHOICE';
    // Options in letter order; a gap (Option C empty but Option D filled) is an error, not silently closed up.
    let options = [], gap = false;
    optionCols.forEach(([letter, ci]) => { const v = cell(r, ci); if (v) { if (gap) msgs.push('Option ' + letter + ' is filled but an earlier option is empty.'); options.push({ letter, text: v, isCorrect: false }); } else gap = true; });
    if (t === 'TRUE_FALSE' && !options.length) options = [{ letter: 'A', text: 'True', isCorrect: false }, { letter: 'B', text: 'False', isCorrect: false }];
    if (t === 'TEXT') { if (options.length) msgs.push('A written-answer question has no options; leave the option columns empty.'); options = []; }
    // Correct answers: letters, or the option's own text (True / False).
    const correctRaw = cell(r, cols.correct);
    if (t !== 'TEXT') {
      if (!correctRaw) msgs.push('The correct answer is missing.');
      else correctRaw.split(/[;,|\s]+/).filter(Boolean).forEach(tok => {
        const byText = options.find(o => sameText(o.text) === sameText(tok));
        const byLetter = /^[a-j]$/i.test(tok) ? options.find(o => o.letter === tok.toUpperCase()) : null;
        const hit = byLetter || byText;
        if (hit) hit.isCorrect = true;
        else msgs.push(/^[a-j]$/i.test(tok) ? 'The correct answer ' + tok.toUpperCase() + ' points at an empty option.' : 'The correct answer "' + tok + '" does not match an option letter.');
      });
    }
    const ptsRaw = cell(r, cols.points), points = ptsRaw === '' ? 1 : Number(ptsRaw);
    const codes = parseCompetencyCell(cell(r, cols.competencies));
    const competencies = [];
    if (!codes.length) msgs.push('No competency code given.');
    codes.forEach(c => {
      const k = byCode.get(c.code);
      if (!k) msgs.push('Unknown competency code "' + c.code + '".');
      else if (!Number.isFinite(c.weight)) msgs.push('The weight in "' + c.raw + '" is not a number.');
      else competencies.push({ competencyId: k.id, weight: c.weight });
    });
    const q = normaliseQuestion({ type: t, text: cell(r, cols.text), skillArea: cell(r, cols.skillArea), points, options, competencies });
    // The shared question checks, minus the ones already reported more precisely above.
    questionProblems(q, compById).forEach(m => {
      if (/competency/i.test(m) && msgs.some(x => /competency/i.test(x))) return;
      if (m === 'Mark the correct answer.' && msgs.some(x => /correct answer/i.test(x))) return;
      if (/^Points/.test(m) && ptsRaw !== '') msgs.push('Points "' + ptsRaw + '" must be a number greater than 0 and no more than ' + LIMITS.points + '.');
      else msgs.push(m);
    });
    const sk = sameText(q.text);
    if (sk) { if (seen.has(sk)) msgs.push('Duplicate question (same as ' + seen.get(sk) + ').'); else seen.set(sk, 'row ' + rowNo); }
    if (msgs.length) errors.push({ row: rowNo, text: q.text.slice(0, 120), messages: [...new Set(msgs)] });
    else questions.push({ ...q, row: rowNo });
  }
  if (!total && !fileErrors.length) fileErrors.push('The file has no questions under the header row.');
  return { questions, errors, fileErrors, total };
}

// ===== CONTENT · Arranging questions =====
// The Form Builder (components/SMFormBuilder.jsx) sends the whole new order of a version's questions in one go,
// with each question's skill area (its section): [{ id, skillArea }]. It must list every question of the version
// exactly once, so a question added or deleted meanwhile (another tab) is never lost or duplicated.
// current: [{ id, order, skillArea }] as stored. Returns { error } or { changes: [{ id, order, skillArea }] }
// (only the questions whose place or skill area actually changes).
export function arrangePlan(current, wanted) {
  const ids = new Set((current || []).map(q => q.id));
  const seen = new Set();
  for (const w of wanted || []) {
    if (!ids.has(w.id) || seen.has(w.id)) return { error: 'The questions have changed since you opened them. Refresh the page and try again.' };
    seen.add(w.id);
    if (clean(w.skillArea).length > LIMITS.skillArea) return { error: 'A section title is too long (' + LIMITS.skillArea + ' characters at most).' };
  }
  if (seen.size !== ids.size) return { error: 'The questions have changed since you opened them. Refresh the page and try again.' };
  const byId = new Map(current.map(q => [q.id, q]));
  const changes = [];
  wanted.forEach((w, i) => {
    const q = byId.get(w.id), area = clean(w.skillArea) || null;
    if (q.order !== i + 1 || (q.skillArea || null) !== area) changes.push({ id: w.id, order: i + 1, skillArea: area });
  });
  return { changes };
}

// ===== CONTENT · Planned audience =====
// Who the assessment is for, chosen in the New assessment step: { targetType, targetIds, startsAt, deadline }.
// It is only a plan until a version is published; then lib/server/audience.js makes the assignments with the
// same checks as the Assignments page. Individual people can only be picked by someone allowed to assign.
export const AUDIENCE_TARGETS = ['DEPARTMENT', 'GRADE', 'STATION', 'LOCATION', 'INDIVIDUAL'];
export const AUDIENCE_LABEL = { DEPARTMENT: 'Department', GRADE: 'Grade', STATION: 'Station', LOCATION: 'Location', INDIVIDUAL: 'Individual staff' };
// Plain-English problems with a plan (empty when it is fine). now: for the "deadline in the future" rule.
export function audienceProblems(p, now = new Date()) {
  const out = [];
  if (!p) return out;
  if (!AUDIENCE_TARGETS.includes(p.targetType)) out.push('Choose who the assessment is for.');
  const ids = Array.isArray(p.targetIds) ? p.targetIds : [];
  if (!ids.length) out.push('Pick at least one ' + (p.targetType === 'INDIVIDUAL' ? 'person' : (AUDIENCE_LABEL[p.targetType] || 'group').toLowerCase()) + '.');
  if (ids.length > 100) out.push('Pick no more than 100 at once.');
  const s = new Date(p.startsAt), d = new Date(p.deadline);
  if (isNaN(s) || isNaN(d)) out.push('Enter a valid start date and deadline.');
  else {
    if (d <= s) out.push('The deadline must be after the start date.');
    if (d <= now) out.push('The deadline must be in the future.');
  }
  return out;
}

// ===== CONTENT · Database helpers =====
// `tx` is the Prisma client or a transaction. Nothing here checks permissions; the routes do.
export const VERSION_INCLUDE = { reviewEvents: { orderBy: { at: 'asc' }, include: { actor: { select: { id: true, displayName: true } } } }, _count: { select: { questions: true, attempts: true } } };
export const QUESTION_INCLUDE = { options: { orderBy: { order: 'asc' } }, competencies: { include: { competency: { select: { id: true, code: true, name: true, short: true, active: true } } } } };
export async function loadAssessment(tx, id) {
  if (!Number.isInteger(id) || id <= 0) return null;
  return tx.assessment.findUnique({ where: { id }, include: { createdBy: { select: { id: true, displayName: true } }, versions: { orderBy: { versionNo: 'desc' }, include: VERSION_INCLUDE } } });
}
// Known competencies as a Map for questionProblems().
export async function competencyMap(tx) {
  const rows = await tx.competency.findMany({ select: { id: true, code: true, name: true, active: true } });
  return new Map(rows.map(c => [c.id, c]));
}
// Stored question -> the plain shape the checks use.
export const plainQuestion = q => ({
  id: q.id, order: q.order, type: q.type, text: q.text, skillArea: q.skillArea, points: Number(q.points),
  options: (q.options || []).map(o => ({ id: o.id, order: o.order, text: o.text, isCorrect: o.isCorrect })),
  competencies: (q.competencies || []).map(c => ({ competencyId: c.competencyId, weight: Number(c.weight), code: c.competency?.code, name: c.competency?.name, short: c.competency?.short, active: c.competency?.active })),
});
// Prisma `create` data for one question in a version.
export const questionCreate = (versionId, order, q) => ({
  versionId, order, type: q.type, text: q.text, skillArea: q.skillArea || null, points: q.points,
  options: { create: q.options.map((o, j) => ({ order: j + 1, text: o.text, isCorrect: !!o.isCorrect })) },
  competencies: { create: q.competencies.map(c => ({ competencyId: c.competencyId, weight: c.weight })) },
});
// Keeps Assessment.status in step with its versions (see assessmentStatus) and touches updatedAt.
export async function syncAssessmentStatus(tx, assessmentId) {
  const a = await tx.assessment.findUnique({ where: { id: assessmentId }, select: { status: true, versions: { select: { versionNo: true, status: true } } } });
  const status = assessmentStatus(a.versions, a.status === 'ARCHIVED');
  await tx.assessment.update({ where: { id: assessmentId }, data: { status, updatedAt: new Date() } });
  return status;
}
// Settings changed while a published version is live wait here until the new version is published, so the
// live assessment never changes under the people taking it. Stored in SystemSetting (no schema change needed).
export const pendingKey = versionId => 'content.pending-settings.' + versionId;
export const SETTING_FIELDS = ['title', 'description', 'instructions', 'maxAttempts', 'resultRelease'];

// ===== CONTENT · Shapes sent to the screen =====
export function versionRow(v, assessment) {
  const ev = a => [...(v.reviewEvents || [])].reverse().find(e => e.action === a);
  const authorId = versionAuthorId(v, assessment);
  const authorEv = (v.reviewEvents || []).find(e => e.action === 'CREATE');
  return {
    id: v.id, versionNo: v.versionNo, status: v.status, createdAt: v.createdAt, submittedAt: v.submittedAt,
    approvedAt: v.approvedAt, approvedBy: ev('APPROVE')?.actor?.displayName || null, publishedAt: v.publishedAt, publishedBy: ev('PUBLISH')?.actor?.displayName || null,
    authorId, author: authorEv?.actor?.displayName || (authorId === assessment.createdById ? assessment.createdBy?.displayName : null) || '—',
    questions: v._count?.questions ?? 0, attempts: v._count?.attempts ?? 0,
  };
}
