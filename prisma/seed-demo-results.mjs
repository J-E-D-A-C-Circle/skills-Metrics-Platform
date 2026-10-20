// =============================================================================
// seed-demo-results.mjs · TEST DATA ONLY: extra staff, published assessments, assignments and completed attempts,
//   so the dashboards, team results and reports have something to show on a test machine.
// Run: part of `npm run db:seed` when SEED_DEMO=true (never on live data). Safe to run more than once: it stops
//   when demo attempts already exist.
// Used by: prisma/seed.mjs   Depends on: lib/scoring.js (the same scoring engine the app uses)
// Sections (search for these markers): DEMO RESULTS · Random numbers, DEMO RESULTS · Staff, DEMO RESULTS · Publish & assign,
//   DEMO RESULTS · Attempts, DEMO RESULTS · Final results
// Every demo staff ID starts with DEMO-. Answers are random but repeatable (fixed seed), so two machines get the
// same numbers. Ama Owusu and Efua Asante are left with no attempts so taking an assessment can be tried from new.
// =============================================================================
import { scoreAttempt, summarize, COUNTED_STATUSES } from '../lib/scoring.js';

// ===== DEMO RESULTS · Random numbers =====
// Small fixed-seed generator (mulberry32) so the demo data is the same every time.
function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FIRST = ['Kwame', 'Akosua', 'Yaw', 'Adwoa', 'Kwabena', 'Abena', 'Kofi', 'Afua', 'Kwaku', 'Yaa', 'Kojo', 'Esi', 'Fiifi', 'Ekua', 'Selorm', 'Dzifa', 'Mawuli', 'Elikem', 'Nii', 'Naa'];
const LAST = ['Mensah', 'Owusu', 'Asante', 'Boateng', 'Addo', 'Ofori', 'Agyeman', 'Amoah', 'Darko', 'Tetteh', 'Quartey', 'Lamptey', 'Danso', 'Acheampong', 'Badu', 'Gyamfi'];
const DAY = 24 * 60 * 60 * 1000;

export async function seedDemoResults(db, log = console.log) {
  if (await db.attempt.findFirst({ where: { staff: { staffNo: { startsWith: 'DEMO-' } } } })) { log('demo results already loaded'); return; }
  const rand = rng(20261019);
  const admin = await db.account.findFirst({ where: { roles: { some: { role: 'ADMIN' } } }, orderBy: { id: 'asc' } });
  const depts = await db.department.findMany({ orderBy: { id: 'asc' } });
  const grades = await db.grade.findMany({ orderBy: { rank: 'asc' } });
  const stations = await db.station.findMany({ orderBy: { id: 'asc' } });

  // ===== DEMO RESULTS · Staff =====
  // Each department's demo supervisor becomes the supervisor of that department's demo staff.
  const supers = await db.account.findMany({ where: { roles: { some: { role: 'SUPERVISOR' } }, staffId: { not: null } }, include: { staff: true } });
  const supOf = Object.fromEntries(supers.map(s => [s.staff.departmentId, s.staff.id]));
  const demoStaff = await db.staffRecord.findMany({ where: { staffNo: { startsWith: 'DEMO-' } } });
  for (const s of demoStaff) if (supOf[s.departmentId] && supOf[s.departmentId] !== s.id && !s.supervisorId) await db.staffRecord.update({ where: { id: s.id }, data: { supervisorId: supOf[s.departmentId] } });
  for (let i = 0; i < 40; i++) {
    const staffNo = 'DEMO-' + String(100 + i).padStart(4, '0');
    const d = depts[i % depts.length], st = stations[i % stations.length], g = grades[Math.min(grades.length - 1, Math.floor(rand() * 3))];
    const first = FIRST[i % FIRST.length], last = LAST[(i * 7) % LAST.length]; // every name different
    await db.staffRecord.upsert({ where: { staffNo }, update: {}, create: {
      staffNo, firstName: first, lastName: last, email: `${first}.${last}.${i}@demo.dvla.gov.gh`.toLowerCase(), designation: g.name,
      departmentId: d.id, gradeId: g.id, stationId: st.id, supervisorId: supOf[d.id] || null,
      placements: { create: [{ departmentId: d.id, stationId: st.id, reason: 'Demo seed' }] } } });
  }
  log('40 extra demo staff');

  // ===== DEMO RESULTS · Publish & assign =====
  // The two "Assistant Officer" banks (RBDI and HR) are published and assigned to every department. One of the
  // IT assignments already closed 3 days ago, so "Overdue" shows up too.
  const banks = await db.assessment.findMany({ where: { status: 'APPROVED', title: { contains: 'Assistant Officer' } }, orderBy: { id: 'asc' }, take: 2, include: { versions: { orderBy: { versionNo: 'desc' }, take: 1 } } });
  const now = Date.now();
  for (const a of banks) {
    const v = a.versions[0];
    await db.assessment.update({ where: { id: a.id }, data: { status: 'PUBLISHED' } });
    await db.assessmentVersion.update({ where: { id: v.id }, data: { status: 'PUBLISHED', publishedById: admin.id, publishedAt: new Date(now - 30 * DAY) } });
    await db.assessmentReviewEvent.create({ data: { versionId: v.id, actorId: admin.id, action: 'PUBLISH', feedback: 'Demo data', at: new Date(now - 30 * DAY) } });
    for (const d of depts) {
      const closed = d.code === 'IT' && a.id === banks[1].id;
      await db.assessmentAssignment.create({ data: { assessmentId: a.id, targetType: 'DEPARTMENT', departmentId: d.id, startsAt: new Date(now - 28 * DAY), deadline: new Date(now + (closed ? -3 : 14) * DAY), createdById: admin.id } });
    }
  }
  log(banks.length, 'assessments published and assigned to every department');

  // ===== DEMO RESULTS · Attempts =====
  // About three in four staff have taken each assessment, 1 to 3 times, each person with their own skill level.
  const versions = await db.assessmentVersion.findMany({ where: { assessmentId: { in: banks.map(b => b.id) }, status: 'PUBLISHED' }, include: { questions: { include: { options: true, competencies: true } } } });
  const staff = await db.staffRecord.findMany({ where: { staffNo: { startsWith: 'DEMO-' }, status: 'ACTIVE' }, include: { accounts: true } });
  const skipNew = new Set(['ama.owusu', 'efua.asante']);
  const config = await db.scoringConfig.findFirst({ where: { active: true }, orderBy: { version: 'desc' } });
  const cfg = { requiredLevel: +config.requiredLevel, competentFrom: +config.competentFrom, proficientFrom: +config.proficientFrom, moderateGapFrom: +config.moderateGapFrom, noGapFrom: +config.noGapFrom, defaultMaxAttempts: config.defaultMaxAttempts };
  let made = 0;
  for (const s of staff) {
    if (s.accounts.some(a => skipNew.has(a.username))) continue;
    const ability = 0.35 + rand() * 0.65; // share of questions this person tends to get right
    for (const v of versions) {
      if (rand() < 0.25) continue;
      const tries = 1 + Math.floor(rand() * 3), accountId = s.accounts[0]?.id || admin.id, perAttempt = [];
      for (let n = 1; n <= tries; n++) {
        const started = new Date(now - (25 - n * 5) * DAY - Math.floor(rand() * DAY)), secs = 900 + Math.floor(rand() * 1800);
        const inProgress = n === tries && tries > 1 && rand() < 0.15;
        const marks = {}, responses = [];
        for (const q of v.questions) {
          const right = rand() < Math.min(1, ability + n * 0.04);
          const opt = right ? q.options.find(o => o.isCorrect) : q.options.find(o => !o.isCorrect) || q.options[0];
          marks[q.id] = !!opt?.isCorrect;
          responses.push({ questionId: q.id, optionId: opt?.id ?? null, isCorrect: !!opt?.isCorrect, activeSeconds: Math.floor(secs / v.questions.length) });
        }
        const at = await db.attempt.create({ data: {
          assessmentId: v.assessmentId, versionId: v.id, staffId: s.id, accountId, attemptNo: n, status: inProgress ? 'IN_PROGRESS' : 'COMPLETED',
          startedAt: started, submittedAt: inProgress ? null : new Date(started.getTime() + secs * 1000), completedAt: inProgress ? null : new Date(started.getTime() + secs * 1000),
          activeSeconds: secs, elapsedSeconds: secs + Math.floor(rand() * 600), responses: { create: inProgress ? responses.slice(0, 10) : responses } } });
        made++;
        if (inProgress) continue;
        const scores = scoreAttempt(v.questions.map(q => ({ id: q.id, points: +q.points, competencies: q.competencies.map(c => c.competencyId) })), marks);
        await db.competencyAttemptResult.createMany({ data: Object.entries(scores).filter(([, r]) => r.score != null).map(([cid, r]) => ({ attemptId: at.id, competencyId: +cid, score: r.score, asked: r.asked, correct: r.correct })) });
        perAttempt.push({ status: 'COMPLETED', scores: Object.fromEntries(Object.entries(scores).map(([cid, r]) => [cid, r.score])) });
      }

      // ===== DEMO RESULTS · Final results =====
      // Same rule as the app: the average of every COMPLETED attempt, per competency.
      const cids = [...new Set(perAttempt.flatMap(p => Object.keys(p.scores)))];
      for (const cid of cids) {
        const r = summarize(perAttempt.filter(p => COUNTED_STATUSES.includes(p.status)), cid, cfg);
        if (r.average == null) continue;
        await db.finalCompetencyResult.create({ data: { staffId: s.id, assessmentId: v.assessmentId, competencyId: +cid, average: r.average, attemptsIncluded: r.attemptsIncluded, competencyStatus: r.competencyStatus, gapStatus: r.gapStatus, scoringConfigId: config.id } });
      }
    }
  }
  log(made, 'demo attempts with results');
}
