// =============================================================================
// formBuilder.js · The Form Builder canvas model: questions and section cards in one list, drag-and-drop moves,
//   and what has to be saved. Pure functions (no React, no database), shared by the screen and the tests.
// Screen / URL: Form Builder (/forms?id=<assessment id>, Build tab)
// Used by: components/SMFormBuilder.jsx, tests/formBuilder.test.js   Depends on: lib/server/content.js (checks only)
// Sections (search for these markers): BUILDER · Question types, BUILDER · Canvas from saved questions,
//   BUILDER · Sections, BUILDER · Moves, BUILDER · What to save
// How sections work (no extra table): a Section card is a header on the canvas. Every question below it, down to
//   the next Section card, gets the section's title as its skill area. So renaming a section renames the skill area
//   of its questions, moving a section moves its questions with it, and deleting a section card keeps its questions
//   (they join the section above, or have no section). When the canvas is rebuilt from the database, a new Section
//   card starts wherever the skill area changes. An empty section (no questions yet) lives only on the screen until a
//   question is added under it.
// =============================================================================
import { questionProblems, normaliseQuestion } from './server/content';

// ===== BUILDER · Question types =====
// Only the types the scoring understands. Multiple select is stored as MULTIPLE_CHOICE.
export const BUILDER_TYPES = {
  section: ['Section', 'icon-heading'],
  SINGLE_CHOICE: ['Single choice', 'icon-circle-dot'],
  MULTIPLE_CHOICE: ['Multiple select', 'icon-list-checks'],
  TRUE_FALSE: ['True / false', 'icon-toggle-left'],
  TEXT: ['Open text', 'icon-text'],
};
let seq = 0;
export const newKey = p => p + Date.now().toString(36) + (seq++).toString(36);
// A new question of one type. competencies: copied from the question above, so a run of questions on one
// competency needs no extra clicks (the server still insists on at least one).
export function blankQuestion(type, competencies = []) {
  const options = type === 'TRUE_FALSE' ? [{ text: 'True', isCorrect: false }, { text: 'False', isCorrect: false }]
    : type === 'TEXT' ? [] : type === 'MULTIPLE_CHOICE' ? ['Option A', 'Option B', 'Option C'].map(text => ({ text, isCorrect: false }))
    : ['Option A', 'Option B'].map(text => ({ text, isCorrect: false }));
  return { type, text: type === 'TEXT' ? 'Describe how you would…' : 'New question', points: 1, options, competencies: competencies.map(c => ({ competencyId: c.competencyId, weight: c.weight })) };
}
// The editable part of a stored question.
export const draftOf = q => ({ type: q.type, text: q.text, points: q.points, options: (q.options || []).map(o => ({ text: o.text, isCorrect: !!o.isCorrect })), competencies: (q.competencies || []).map(c => ({ competencyId: c.competencyId, weight: c.weight })) });
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ===== BUILDER · Canvas from saved questions =====
// questions: stored questions in order (plainQuestion shape). Returns canvas items:
//   { key, kind: 'section', title } | { key, kind: 'question', id, q, saved }   (q = current edits, saved = last saved)
export function itemsFromQuestions(questions) {
  const out = [];
  let cur = null;
  (questions || []).forEach((q, i) => {
    const area = String(q.skillArea || '').trim();
    if (i === 0 ? !!area : area !== cur) out.push({ key: 's' + q.id, kind: 'section', title: area });
    cur = area;
    const d = draftOf(q);
    out.push({ key: 'q' + q.id, kind: 'question', id: q.id, q: d, saved: d });
  });
  return out;
}

// ===== BUILDER · Sections =====
// Title of the section a canvas position belongs to ('' = none).
export function areaAt(items, index) {
  for (let i = index; i >= 0; i--) if (items[i] && items[i].kind === 'section') return String(items[i].title || '').trim();
  return '';
}
// [start, end) of the block that starts at a section card (the card and its questions).
export function blockOf(items, start) {
  let end = start + 1;
  while (end < items.length && items[end].kind !== 'section') end++;
  return [start, end];
}
export const questionNumbers = items => { let n = 0; const out = {}; items.forEach(it => { if (it.kind === 'question') out[it.key] = ++n; }); return out; };

// ===== BUILDER · Moves =====
// Drop the item at `from` before position `to` (0..length). A section card carries its whole block with it.
export function moveTo(items, from, to) {
  const [s, e] = items[from] && items[from].kind === 'section' ? blockOf(items, from) : [from, from + 1];
  if (to >= s && to <= e) return items;
  const block = items.slice(s, e), rest = [...items.slice(0, s), ...items.slice(e)];
  const at = to > e ? to - (e - s) : to;
  rest.splice(at, 0, ...block);
  return rest;
}
// Up / down buttons: a question swaps with its neighbour (which may move it into the next section); a section card
// moves its block above the previous block or below the next one.
export function step(items, i, dir) {
  const it = items[i];
  if (!it) return items;
  if (it.kind === 'question') {
    const j = i + dir;
    if (j < 0 || j >= items.length) return items;
    const a = [...items]; [a[i], a[j]] = [a[j], a[i]]; return a;
  }
  if (dir < 0) {
    let p = i - 1;
    while (p >= 0 && items[p].kind !== 'section') p--;
    return moveTo(items, i, Math.max(0, p));
  }
  const [, e] = blockOf(items, i);
  if (e >= items.length) return items;
  const [, e2] = blockOf(items, e);
  return moveTo(items, i, e2);
}
export function insertAt(items, item, at) { const a = [...items]; a.splice(at == null ? a.length : at, 0, item); return a; }

// ===== BUILDER · What to save =====
// The payload for one question at its place on the canvas (skill area from its section).
export const payloadOf = (items, i) => ({ ...items[i].q, skillArea: areaAt(items, i) || '' });
// Problems that stop a question being saved (the server's own checks). compById: Map of competencies.
export const problemsOf = (payload, compById) => questionProblems(normaliseQuestion(payload), compById);
export const isDirty = it => it.kind === 'question' && (!it.id || !same(it.q, it.saved));
// The order and sections of the saved questions as the canvas shows them: [{ id, skillArea }].
export const layoutOf = items => items.map((it, i) => (it.kind === 'question' && it.id ? { id: it.id, skillArea: areaAt(items, i) || null } : null)).filter(Boolean);
// Does the canvas layout differ from the stored one? stored: [{ id, skillArea }] in stored order.
export const layoutChanged = (items, stored) => !same(layoutOf(items), (stored || []).map(q => ({ id: q.id, skillArea: q.skillArea || null })));
