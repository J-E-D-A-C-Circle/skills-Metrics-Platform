// =============================================================================
// levels.js · Job level configuration and automatic assessment title generation
// Baseline starting from Level 9 for Assistant Officer (Option A)
// =============================================================================

export const JOB_LEVELS = [
  { id: 'LEVEL_9', levelNo: 9, label: 'Level 9 · Assistant Officer', shortRole: 'Assistant Officer' },
  { id: 'LEVEL_10', levelNo: 10, label: 'Level 10 · Officer & Senior Officer', shortRole: 'Officer & Senior Officer' },
  { id: 'LEVEL_11', levelNo: 11, label: 'Level 11 · Assistant Manager & Manager', shortRole: 'Assistant Manager & Manager' },
  { id: 'LEVEL_12', levelNo: 12, label: 'Level 12 · Deputy Director & Director', shortRole: 'Deputy Director & Director' },
];

export const JOB_LEVEL_LABEL = Object.fromEntries(JOB_LEVELS.map(j => [j.id, j.label]));

/**
 * Automatically compute assessment title from skill type, department and level
 * @param {'TECHNICAL'|'GENERAL'} skillType
 * @param {string|number|null} departmentId
 * @param {string} jobLevel
 * @param {Array<{ id: number, name: string }>} depts
 * @returns {string}
 */
export function computeAssessmentTitle(skillType, departmentId, jobLevel, depts = []) {
  const lvl = JOB_LEVELS.find(l => l.id === jobLevel) || JOB_LEVELS[0];
  const roleStr = `Level ${lvl.levelNo} (${lvl.shortRole})`;
  if (skillType === 'GENERAL') {
    return `General Skills Competency Assessment · ${roleStr}`;
  }
  const dept = (depts || []).find(d => String(d.id) === String(departmentId));
  const deptName = dept ? dept.name : 'Department';
  return `${deptName} Technical Assessment · ${roleStr}`;
}
