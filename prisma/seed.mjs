// =============================================================================
// seed.mjs · Loads the starting data into an empty (or existing) database. Safe to run more than once.
// Run: npm run db:seed   (after npm run db:migrate)
// Environment: SEED_ADMIN_PASSWORD (required, temporary; the admin must change it on first sign-in)
//   SEED_ADMIN_USERNAME / SEED_ADMIN_EMAIL / SEED_ADMIN_NAME (optional), SEED_DEMO=true + SEED_DEMO_PASSWORD for test accounts
// Depends on: prisma/seed-data.mjs, @prisma/client
// Sections (search for these markers): SEED · Helpers, SEED · Organisation, SEED · Competency framework,
//   SEED · Scoring configuration, SEED · Administrator account, SEED · DVLA question banks, SEED · Notification templates,
//   SEED · Demo accounts (test only)
// Loads: departments, grades (job levels), locations and stations, the competency framework, scoring thresholds v1,
//   the administrator, the 8 DVLA question banks (as Approved assessments, not yet published or assigned) and
//   notification templates. No made-up staff or results unless SEED_DEMO=true.
// =============================================================================
import fs from 'node:fs';
import xlsx from 'xlsx';
import { PrismaClient } from '@prisma/client';
import { scrypt, randomBytes } from 'node:crypto';
import { DEPARTMENTS, LOCATIONS, COMPETENCIES, JOB_LEVELS, BANKS, DEMO_ACCOUNTS, NOTIFICATION_TEMPLATES } from './seed-data.mjs';
import { ROLE_PERMS } from '../components/smAccess.js';
import { seedDemoResults } from './seed-demo-results.mjs';

const db = new PrismaClient();

// ===== SEED · Helpers =====
// Same hash format as lib/server/password.js.
const hashPassword = plain => new Promise((ok, bad) => {
  const salt = randomBytes(16);
  scrypt(String(plain), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (e, k) => (e ? bad(e) : ok(['scrypt', 32768, 8, 1, salt.toString('base64'), k.toString('base64')].join('$'))));
});
const ROLE_LABEL = { ADMIN: 'Administrator', CREATOR: 'Assessment Creator', SUPERVISOR: 'Manager / Supervisor', STAFF: 'Participant', TICKET_RESOLVER: 'Ticket Resolver' };
const log = (...a) => console.log('  ·', ...a);

async function main() {
  console.log('Seeding the Skill Matrix database…');

  // ===== SEED · Organisation =====
  const dept = {};
  for (const d of DEPARTMENTS) dept[d.code] = await db.department.upsert({ where: { code: d.code }, update: { name: d.name }, create: d });
  const grades = [];
  for (const [rank, name] of JOB_LEVELS.entries()) grades.push(await db.grade.upsert({ where: { name }, update: { rank }, create: { name, rank } }));
  const stations = {};
  for (const l of LOCATIONS) {
    const loc = await db.location.upsert({ where: { name: l.name }, update: { region: l.region }, create: l });
    stations[l.name] = await db.station.upsert({ where: { locationId_name: { locationId: loc.id, name: l.name } }, update: {}, create: { name: l.name, locationId: loc.id } });
  }
  log(DEPARTMENTS.length, 'departments,', JOB_LEVELS.length, 'grades,', LOCATIONS.length, 'locations');

  // ===== SEED · Competency framework =====
  const comp = {};
  for (const c of COMPETENCIES) {
    const cat = await db.competencyCategory.upsert({ where: { name_group: { name: c.category, group: c.group } }, update: {}, create: { name: c.category, group: c.group } });
    const data = { name: c.name, short: c.short, importance: c.importance, categoryId: cat.id, departmentId: c.dept ? dept[c.dept].id : null, skillAreas: c.areas || undefined };
    comp[c.code] = await db.competency.upsert({ where: { code: c.code }, update: data, create: { code: c.code, ...data } });
  }
  log(COMPETENCIES.length, 'competencies');

  // ===== SEED · Scoring configuration =====
  const scoring = await db.scoringConfig.upsert({ where: { version: 1 }, update: {}, create: { version: 1, reason: 'Defaults from the Skills Metrics prompt (19 Oct 2026)' } });

  // ===== SEED · Administrator account =====
  // Created once, on a temporary password. Re-running the seed never resets an existing password.
  const adminUser = (process.env.SEED_ADMIN_USERNAME || 'admin').toLowerCase();
  let admin = await db.account.findUnique({ where: { username: adminUser } });
  if (!admin) {
    const pw = process.env.SEED_ADMIN_PASSWORD || 'Password123!';
    admin = await db.account.create({ data: {
      username: adminUser, email: (process.env.SEED_ADMIN_EMAIL || adminUser + '@dvla.gov.gh').toLowerCase(), displayName: process.env.SEED_ADMIN_NAME || 'System Administrator',
      passwordHash: await hashPassword(pw), status: 'ACTIVE', deptScope: 'ALL', roles: { create: [{ role: 'ADMIN' }] },
    } });
    await db.auditLog.create({ data: { action: 'account.create', entityType: 'Account', entityId: String(admin.id), after: { username: admin.username, roles: ['ADMIN'], source: 'seed' } } });
    log('administrator', adminUser, 'created (must change password on first sign-in)');
  } else log('administrator', adminUser, 'already exists (password unchanged)');

  // ===== SEED · DVLA question banks =====
  // One assessment per bank, version 1, status Approved. An administrator publishes and assigns them (phase 3).
  for (const b of BANKS) {
    const ref = 'bank:' + b.id;
    if (await db.assessment.findUnique({ where: { sourceRef: ref } })) continue;
    await db.$transaction(async tx => {
      const a = await tx.assessment.create({ data: { title: b.title, description: 'Loaded from the DVLA source document ' + b.source + '.', createdById: admin.id, status: 'APPROVED', sourceRef: ref } });
      const v = await tx.assessmentVersion.create({ data: { assessmentId: a.id, versionNo: 1, status: 'APPROVED', scoringConfigId: scoring.id, approvedById: admin.id, approvedAt: new Date() } });
      await tx.assessmentReviewEvent.create({ data: { versionId: v.id, actorId: admin.id, action: 'APPROVE', feedback: 'Official DVLA question bank, loaded unchanged from ' + b.source } });
      for (const [i, [code, area, text, options, correct]] of b.items.entries()) {
        await tx.question.create({ data: {
          versionId: v.id, order: i + 1, type: 'SINGLE_CHOICE', text, skillArea: area,
          options: { create: options.map((o, j) => ({ order: j + 1, text: o, isCorrect: j === correct })) },
          competencies: { create: [{ competencyId: comp[code].id }] },
        } });
      }
    }, { timeout: 120000 });
    log('question bank', b.id, '·', b.items.length, 'questions');
  }

  // ===== SEED · Notification templates =====
  for (const [key, title, body] of NOTIFICATION_TEMPLATES) await db.notificationTemplate.upsert({ where: { key }, update: {}, create: { key, title, body } });

  // ===== SEED · Official HR & RBDI Staff List =====
  const excelFile = 'HR & RBDI STAFF LIST (1).xlsx';
  if (fs.existsSync(excelFile)) {
    const wb = xlsx.readFile(excelFile);
    const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
    const defaultPw = process.env.SEED_DEMO_PASSWORD || 'Password123!';
    const staffHash = await hashPassword(defaultPw);
    const head = stations['Head Office, Accra'] || Object.values(stations)[0];

    for (const r of rawRows) {
      const empId = String(r['Employee Id']).trim();
      const fullName = r['Employee Name'].trim();
      const parts = fullName.replace(/\s+/g, ' ').split(' ');
      const desig = r.Designation.trim();
      const isHR = r.Department.trim().toUpperCase().includes('HUMAN');
      const deptCode = isHR ? 'HR' : 'RBDI';
      const dUpper = desig.toUpperCase();
      let gradeRank = 0;
      if (dUpper.includes('DIRECTOR')) gradeRank = 3;
      else if (dUpper.includes('MANAGER')) gradeRank = 2;
      else if (dUpper.includes('OFFICER')) gradeRank = 1;

      let role = 'STAFF';
      if (dUpper.includes('DIRECTOR') || dUpper.includes('MANAGER HR') || dUpper.includes('MANAGER RBDI')) role = 'SUPERVISOR';
      else if (dUpper.includes('ASSISTANT MANAGER HR')) role = 'CREATOR';

      const username = (parts[0].toLowerCase() + '.' + parts[parts.length - 1].toLowerCase()).replace(/[^a-z0-9._-]/g, '');
      const email = `${username}@dvla.gov.gh`;
      const isTamale = String(r['Location\t'] || r['Location'] || '').toUpperCase().includes('TAMALE');
      const station = (isTamale && stations['Tamale Office']) ? stations['Tamale Office'] : head;

      const staff = await db.staffRecord.upsert({
        where: { staffNo: empId },
        update: { designation: desig, departmentId: dept[deptCode].id, gradeId: grades[gradeRank].id, stationId: station.id },
        create: {
          staffNo: empId,
          firstName: parts[0],
          lastName: parts[parts.length - 1],
          otherNames: parts.length > 2 ? parts.slice(1, -1).join(' ') : null,
          email,
          designation: desig,
          departmentId: dept[deptCode].id,
          gradeId: grades[gradeRank].id,
          stationId: station.id,
        }
      });

      const existingAccount = await db.account.findUnique({ where: { username } });
      if (!existingAccount) {
        const roles = role === 'SUPERVISOR' ? ['SUPERVISOR', 'STAFF'] : [role];
        await db.account.create({
          data: {
            username,
            email,
            displayName: fullName,
            passwordHash: staffHash,
            status: 'ACTIVE',
            staffId: staff.id,
            deptScope: 'OWN',
            roles: { create: roles.map(r => ({ role: r })) },
            permissions: { create: [...new Set(roles.flatMap(r => ROLE_PERMS[ROLE_LABEL[r]] || []))].map(key => ({ key })) },
            supervisorLinks: role === 'SUPERVISOR' ? { create: [{ departmentId: dept[deptCode].id }] } : undefined,
          }
        });
      }
    }
    log(rawRows.length, 'official HR & RBDI staff accounts loaded from Excel');
  }

  // ===== SEED · Demo accounts (test only) =====
  if (process.env.SEED_DEMO === 'true') {
    const pw = process.env.SEED_DEMO_PASSWORD;
    if (!pw) throw new Error('Set SEED_DEMO_PASSWORD when SEED_DEMO=true.');
    const hash = await hashPassword(pw), head = stations['Head Office, Accra'];
    for (const [i, [username, name, code, role, g]] of DEMO_ACCOUNTS.entries()) {
      if (await db.account.findUnique({ where: { username } })) continue;
      const parts = name.split(' ');
      const staff = await db.staffRecord.upsert({ where: { staffNo: 'DEMO-' + String(i + 1).padStart(4, '0') }, update: {}, create: {
        staffNo: 'DEMO-' + String(i + 1).padStart(4, '0'), firstName: parts[0], lastName: parts[parts.length - 1], otherNames: parts.slice(1, -1).join(' ') || null,
        email: username + '@dvla.gov.gh', departmentId: dept[code].id, gradeId: grades[g].id, stationId: head.id,
        placements: { create: [{ departmentId: dept[code].id, stationId: head.id, reason: 'Demo seed' }] } } });
      // Supervisors and ticket resolvers also take assessments as staff; creators get no participant role by default
      // (prompt section 5.3).
      const roles = role === 'SUPERVISOR' || role === 'TICKET_RESOLVER' ? [role, 'STAFF'] : [role];
      await db.account.create({ data: {
        username, email: username + '@dvla.gov.gh', displayName: name, passwordHash: hash, status: 'ACTIVE', staffId: staff.id, deptScope: 'OWN',
        roles: { create: [...new Set(roles)].map(r => ({ role: r })) },
        permissions: { create: [...new Set(roles.flatMap(r => ROLE_PERMS[ROLE_LABEL[r]] || []))].map(key => ({ key })) },
        supervisorLinks: role === 'SUPERVISOR' ? { create: [{ departmentId: dept[code].id }] } : undefined,
      } });
    }
    log(DEMO_ACCOUNTS.length, 'demo accounts (test data, staff IDs start with DEMO-)');
    // Extra demo staff, published assessments, assignments and completed attempts so dashboards and reports have data.
    await seedDemoResults(db, log);
  }
  console.log('Done.');
}

main().catch(e => { console.error(e.message || e); process.exitCode = 1; }).finally(() => db.$disconnect());
