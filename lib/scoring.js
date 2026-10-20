// =============================================================================
// scoring.js · The one scoring engine: competency scores, final averages, Competent / Proficient and gap status
// Screen / URL: no screen of its own; every dashboard, report and export must use these functions
// Who sees it: everyone (server and browser can both import it; it has no database or browser code)
// Used by: lib/server/results.js (from phase 5), tests/scoring.test.js   Depends on: nothing
// Sections (search for these markers): SCORING · Default thresholds, SCORING · Checking a configuration,
//   SCORING · Score labels (0 to 5), SCORING · One attempt, SCORING · Final average across attempts,
//   SCORING · Competent / Proficient, SCORING · Gap status, SCORING · Full summary, SCORING · Display helpers
// Business rules (Skills Metrics prompt, sections 11 to 14):
//   - Scale is 0 to 5. A competency score in one attempt = 5 x (points earned / points available) for the
//     questions mapped to that competency, kept unrounded (agreed default, 19 Oct 2026).
//   - Final result = arithmetic average of ALL valid COMPLETED attempts that assessed that competency.
//     Never the best or latest attempt. In-progress, abandoned and expired attempts are left out.
//   - A competency not asked in an attempt is skipped for that attempt (no zero is inserted).
//   - "No result" (null) is kept separate from a real score of 0.
//   - Thresholds are compared with the UNROUNDED average; display rounds to 2 decimals.
// =============================================================================

// ===== SCORING · Default thresholds =====
// Matches the ScoringConfig table defaults. Admins can save new versions (phase 8); old versions stay for old reports.
export const DEFAULT_CONFIG = Object.freeze({
  requiredLevel: 5, // required proficiency level for every competency
  competentFrom: 4, // 4.00 and above = Competent
  proficientFrom: 5, // exactly 5.00 = Proficient
  moderateGapFrom: 2.5, // below 2.50 = Critical Gap, 2.50 up to (not incl.) noGapFrom = Moderate Gap
  noGapFrom: 5, // 5.00 = No Gap
  defaultMaxAttempts: 3,
});

// Tiny tolerance so values like 4.0000000000001 / 3.9999999999 from floating point land on the right side of
// a threshold. It is far smaller than any real score difference (two decimals are shown).
const EPS = 1e-9;
const atLeast = (value, threshold) => value >= threshold - EPS;

// Attempt statuses that count towards the final average.
export const COUNTED_STATUSES = Object.freeze(['COMPLETED']);

// ===== SCORING · Checking a configuration =====
// Returns a list of problems (empty = fine). Ranges must not overlap or leave gaps.
export function validateConfig(cfg) {
  const c = { ...DEFAULT_CONFIG, ...cfg }, errors = [];
  const nums = ['requiredLevel', 'competentFrom', 'proficientFrom', 'moderateGapFrom', 'noGapFrom', 'defaultMaxAttempts'];
  nums.forEach(k => { if (typeof c[k] !== 'number' || !Number.isFinite(c[k])) errors.push(k + ' must be a number'); });
  if (errors.length) return errors;
  if (c.requiredLevel <= 0 || c.requiredLevel > 5) errors.push('Required level must be above 0 and at most 5');
  if (c.competentFrom <= 0 || c.competentFrom > c.proficientFrom) errors.push('Competent must start above 0 and not above Proficient');
  if (c.proficientFrom > c.requiredLevel) errors.push('Proficient cannot be above the required level');
  if (c.moderateGapFrom <= 0 || c.moderateGapFrom >= c.noGapFrom) errors.push('Moderate Gap must start above 0 and below No Gap');
  if (c.noGapFrom > c.requiredLevel) errors.push('No Gap cannot be above the required level');
  if (!Number.isInteger(c.defaultMaxAttempts) || c.defaultMaxAttempts < 1) errors.push('Attempt limit must be a whole number of at least 1');
  return errors;
}

// ===== SCORING · Score labels (0 to 5) =====
// Meaning of each whole score point (section 11). A score of 3.5 reads as "Moderate" (its whole-number part).
export const SCORE_LABELS = Object.freeze([
  { score: 0, label: 'Critically Low', meaning: 'No demonstrated competency or critically low performance.' },
  { score: 1, label: 'Very Low', meaning: 'Very limited understanding or ability.' },
  { score: 2, label: 'Low', meaning: 'Partial understanding; substantial development required.' },
  { score: 3, label: 'Moderate', meaning: 'Moderate competency, below the required Competent threshold.' },
  { score: 4, label: 'Competent', meaning: 'Meets the defined working competency threshold.' },
  { score: 5, label: 'Proficient', meaning: 'Attains the full required proficiency level.' },
]);
export function scoreLabel(score) {
  if (score == null || !Number.isFinite(score)) return null;
  const whole = Math.max(0, Math.min(5, Math.floor(score + EPS)));
  return SCORE_LABELS[whole];
}

// ===== SCORING · One attempt =====
// questions: [{ id, points?, competencies: [competencyId, ...] }]
// marks:     { [questionId]: true | false | number between 0 and 1 (part marks) | null/undefined (unanswered) }
// Unanswered questions in a submitted attempt earn 0 points but still count as asked.
// Returns { [competencyId]: { score, asked, correct, earned, available } } for every competency asked.
export function scoreAttempt(questions, marks) {
  const per = {};
  (questions || []).forEach(q => {
    const pts = q.points == null ? 1 : Number(q.points);
    const m = marks ? marks[q.id] : undefined;
    const frac = m === true ? 1 : typeof m === 'number' && Number.isFinite(m) ? Math.max(0, Math.min(1, m)) : 0;
    (q.competencies || []).forEach(cid => {
      const p = per[cid] || (per[cid] = { asked: 0, correct: 0, earned: 0, available: 0 });
      p.asked += 1; p.available += pts; p.earned += pts * frac;
      if (frac === 1) p.correct += 1;
    });
  });
  const out = {};
  Object.keys(per).forEach(cid => {
    const p = per[cid];
    out[cid] = { ...p, score: p.available > 0 ? (5 * p.earned) / p.available : null };
  });
  return out;
}

// ===== SCORING · Final average across attempts =====
// attempts: [{ status, scores: { [competencyId]: number | null } }]
// Returns { average, attemptsIncluded, scores } or null when no completed attempt assessed the competency.
export function finalAverage(attempts, competencyId) {
  const scores = [];
  (attempts || []).forEach(a => {
    if (!COUNTED_STATUSES.includes(a.status)) return;
    const s = a.scores ? a.scores[competencyId] : undefined;
    if (s == null || !Number.isFinite(Number(s))) return; // not assessed in this attempt: skip, never insert 0
    scores.push(Number(s));
  });
  if (!scores.length) return null;
  const sum = scores.reduce((x, y) => x + y, 0);
  return { average: sum / scores.length, attemptsIncluded: scores.length, scores };
}

// ===== SCORING · Competent / Proficient =====
// null average (no result) -> null, never "Not Competent".
export const COMPETENCY_STATUS = Object.freeze({ NOT_COMPETENT: 'NOT_COMPETENT', COMPETENT: 'COMPETENT', PROFICIENT: 'PROFICIENT' });
export function competencyStatus(average, cfg = DEFAULT_CONFIG) {
  if (average == null || !Number.isFinite(average)) return null;
  const c = { ...DEFAULT_CONFIG, ...cfg };
  if (atLeast(average, c.proficientFrom)) return COMPETENCY_STATUS.PROFICIENT;
  if (atLeast(average, c.competentFrom)) return COMPETENCY_STATUS.COMPETENT;
  return COMPETENCY_STATUS.NOT_COMPETENT;
}

// ===== SCORING · Gap status =====
// Gap = required level minus the final average (never below 0). Status is separate from Competent / Proficient:
// 4.00 is Competent but still a Moderate Gap.
export const GAP_STATUS = Object.freeze({ CRITICAL: 'CRITICAL', MODERATE: 'MODERATE', NONE: 'NONE' });
export function gapValue(average, cfg = DEFAULT_CONFIG) {
  if (average == null || !Number.isFinite(average)) return null;
  const c = { ...DEFAULT_CONFIG, ...cfg };
  const g = c.requiredLevel - average;
  return g < EPS ? 0 : g;
}
export function gapStatus(average, cfg = DEFAULT_CONFIG) {
  if (average == null || !Number.isFinite(average)) return null;
  const c = { ...DEFAULT_CONFIG, ...cfg };
  if (atLeast(average, c.noGapFrom)) return GAP_STATUS.NONE;
  if (atLeast(average, c.moderateGapFrom)) return GAP_STATUS.MODERATE;
  return GAP_STATUS.CRITICAL;
}

// ===== SCORING · Full summary =====
// Everything a dashboard row needs for one person and one competency.
export function summarize(attempts, competencyId, cfg = DEFAULT_CONFIG) {
  const f = finalAverage(attempts, competencyId);
  if (!f) return { average: null, display: '—', attemptsIncluded: 0, scores: [], competencyStatus: null, gapStatus: null, gap: null };
  return { ...f, display: formatAverage(f.average), competencyStatus: competencyStatus(f.average, cfg), gapStatus: gapStatus(f.average, cfg), gap: gapValue(f.average, cfg) };
}

// ===== SCORING · Display helpers =====
// Two decimals by default. Labels always go with colour (never colour alone).
export const formatAverage = n => (n == null || !Number.isFinite(n) ? '—' : (Math.round((n + EPS) * 100) / 100).toFixed(2));
export const COMPETENCY_LABEL = Object.freeze({ NOT_COMPETENT: 'Not Competent', COMPETENT: 'Competent', PROFICIENT: 'Proficient' });
export const GAP_LABEL = Object.freeze({ CRITICAL: 'Critical Gap', MODERATE: 'Moderate Gap', NONE: 'No Gap' });
// Colours from the prompt: red / blue / green for competency, red / amber / green for gaps.
export const COMPETENCY_COLOURS = Object.freeze({ NOT_COMPETENT: ['#fee2e2', '#b91c1c'], COMPETENT: ['#dbeafe', '#1d4ed8'], PROFICIENT: ['#dcfce7', '#15803d'] });
export const GAP_COLOURS = Object.freeze({ CRITICAL: ['#fee2e2', '#b91c1c'], MODERATE: ['#fef3c7', '#92400e'], NONE: ['#dcfce7', '#15803d'] });
