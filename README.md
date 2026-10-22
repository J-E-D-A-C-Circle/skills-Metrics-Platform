# DVLA · Skill Matrix & Assessment Platform (Next.js)

A Next.js 15 (App Router) application for DVLA staff competency assessments, built with MySQL 8, phpMyAdmin, and Drizzle ORM: secure sign-in, permissions checked on the server, assessment content with review and publishing, assignments and deadlines, assessments without a countdown timer, one scoring engine for every screen and export, dashboards, reports (Excel, PDF, CSV), support tickets, notifications and an append-only audit log. It keeps the DVLA green liquid-glass look.

**Build status (21 Oct 2026):** fully switched to MySQL 8 + phpMyAdmin + Drizzle ORM. All 12 test suites (237 tests) passing.

## Source content

The competency framework, question banks and scales come from the DVLA documents:

- **RBDI Competency Capacity Assessment Tools** (Assistant Officer; Officer & Senior Officer; Assistant Manager & Manager; Deputy Director & Director): 8 competencies with 41 skill areas, 82 scenario questions per level with the published answer keys.
- **HR Skill Matrix Question Banks** (same four levels): Talent Acquisition & Selection (1.1–1.6) and Learning & Development Management (2.1–2.7), 5 questions per sub-skill. The Officer & Senior Officer bank has 64 questions because sub-skill 1.4 has only four in the source.
- **Skills Matrix Data Analysis sample:** the five general skills used for every department, the Corporate Affairs technical skills, and the five Public Relations records (their required and current ratings are loaded as-is, so the Corporate Affairs averages match the sample: technical gap 2.64, general gap 0.72).
- **SRS:** the proficiency, importance and gap scales, and the Department → major skill → specific competency hierarchy.

`components/dvlaBanks.js` holds the question text, options and answer keys verbatim (line breaks from the PDFs were joined). The four job levels above replace the earlier grades. IT keeps the prototype's original technical skills because no IT document was supplied. Staff names, results and importance ratings for HR/RBDI (set to 4) are sample data.

## Run it

### Option A: Run Entire Stack via Docker (App + MySQL 8 + phpMyAdmin)

```bash
cp .env.example .env          # set SEED_ADMIN_PASSWORD and any custom settings
docker compose up -d --build  # builds and starts MySQL 8, phpMyAdmin (port 8085) and Next.js (port 3000)
docker compose exec app npm run db:seed # seed initial administrator and frameworks
```
- App: [http://localhost:3000](http://localhost:3000)
- phpMyAdmin: [http://localhost:8085](http://localhost:8085) (User: `skm`, Password: `change-me`, or root `change-me-root`)

### Option B: Local Node.js Development (Docker for MySQL only)

```bash
cp .env.example .env          # DATABASE_URL="mysql://skm:change-me@localhost:3306/skill_matrix"
docker compose up -d db       # starts MySQL 8 and loads schema.sql
npm install                   # install dependencies
npm run db:push               # synchronize schema via Drizzle Kit (or npm run db:migrate)
npm run db:seed               # seeds baseline organisation, competencies, question banks, staff & admin
npm run dev                   # open http://localhost:3000
npm test                      # unit tests (scoring, permissions, every module's rules)
```

Sign in as **admin** with password `Password123!`.

### Demo Accounts for Testing & Presentation (Password: `Password123!`)

| Username | Role | Department | Designation / Purpose |
|---|---|---|---|
| `admin` | Administrator | IT Department | Full system admin & configuration |
| `creator.hr` | Assessment Creator | Human Resources | Designs and drafts assessment tools |
| `manager.rbdi` | Manager / Supervisor | RBDI | Views team skill matrices & gap analysis |
| `staff.rbdi` | Participant (Staff) | RBDI | Takes RBDI Assistant Officer assessments |
| `staff.hr` | Participant (Staff) | Human Resources | Takes HR Officer assessments |
| `resolver.it` | Ticket Resolver | IT Department | Resolves technical support requests |
| `manager.ca` | Manager / Supervisor | Corporate Affairs | Corporate Affairs team oversight |

| Username | Role | Department |
|---|---|---|
| `esi.mensah` | Assessment Creator | Human Resources |
| `joseph.abandoh-sam` | Manager / Supervisor (+ takes assessments) | IT Department |
| `nana.appiah`, `kojo.quaye` | Manager / Supervisor | RBDI, Corporate Affairs |
| `ama.owusu`, `kofi.boateng`, `efua.asante` | Participant (Ama and Efua start with no attempts) | IT Department |
| `abena.sarpong` | Ticket Resolver (+ takes assessments) | IT Department |

**Deadline reminders:** `POST /api/jobs/reminders` with header `x-jobs-secret: $JOBS_SECRET` sends "closes soon" and "has closed" notifications (never twice). Run it on a schedule, for example hourly with cron:
`0 * * * * curl -fsS -X POST -H "x-jobs-secret: $JOBS_SECRET" http://localhost:3000/api/jobs/reminders`

**Ticket attachments** are saved under `STORAGE_DIR` (default `storage/` in the project, ignored by git). Back it up with the database.

## What each role gets

What a person sees comes from their permission ticks (Settings > User Management), not from the role name; the role only picks the starting ticks. The server checks every permission again on every request.

| Role | Main pages |
|---|---|
| Administrator | Home (organisation overview), Assessment Content (review, approve, publish), Assignments, Team Results, Dashboards, Development Priorities, Reports, Organisation, Competency Framework, Support Tickets (all), Settings |
| Assessment Creator | Home, Assessment Content (own drafts; submit for review), Competency Framework, My Assessments only if the account also has the Staff role |
| Manager / Supervisor | Home (own results and team summary), My Assessments, Team Results, Assignments (progress), Dashboards, Development Priorities, Reports, all limited to the departments assigned to them and their direct reports |
| Participant | Home, My Assessments, My Profile, Support Tickets (own) |
| Ticket Resolver | Participant pages plus the tickets assigned to them |

Rules no tick can override: an Administrator never takes assessments; only an Administrator can approve or publish content, and nobody can approve their own work; a supervisor never sees departments they were not given; supervisor and staff grades never grant admin rights.

## Routes

`/` Home · `/assessments` My Assessments · `/take?id=<assessment>` take an assessment (full screen, no timer) · `/forms` Assessment Content · `/cycles` Assignments · `/staff-evals` Team Results · `/analytics` (`?tab=departments|heatmap`) Dashboards · `/training` (`?tab=top-needs`) Development Priorities · `/reports` · `/organisation` (`?tab=departments|grades|stations|supervisors`) · `/framework` Competency Framework · `/tickets` (`?id=`) · `/settings` (`?tab=scoring|notifications|users|audit`) · `/profile` (`?tab=skills|history`) · `/report?id=<staff record>` individual competency profile · `/help` (`?tab=ratings`) · `/signin`

The first tab of a page has no `?tab=`. A tab or page a person may not open sends them to the first allowed tab or to Home. Old URLs from the prototype redirect (see `REDIRECT` in `components/SkillMatrixApp.jsx`).

## Server API

Every route checks the session and the permission named in its header comment, filters staff and results through `lib/server/scope.js`, validates input with zod, and writes important changes to the audit log. Changes sent from another website are refused (`lib/server/http.js`).

| Path | What |
|---|---|
| `app/api/auth/*` | sign in, sign out, who am I, change password |
| `app/api/accounts/*` | User Management (list, add, edit, delete, reset password) |
| `app/api/lookups` | names for drop-down lists and the scoring thresholds in use |
| `app/api/org/*` | staff records (with placement history and Excel/CSV import), departments, grades, stations, locations, supervisors |
| `app/api/competencies/*` | competency framework and categories |
| `app/api/content/*` | assessment content: drafts (with who it is for), questions (add, edit, delete, re-order and sections in one PUT), bulk upload, submit / approve / return / reject / publish (makes the planned assignments) / archive, new versions |
| `app/api/assignments/*` | assignments, progress, extensions, result release |
| `app/api/my/*`, `app/api/attempts/*` | My Assessments, starting / resuming, autosave, active page time, submit (scores written in `lib/server/results.js`) |
| `app/api/dashboard/*`, `app/api/team/*`, `app/api/staff/*`, `app/api/me` | dashboards, team results, development priorities, individual profiles, My Profile |
| `app/api/reports/*` | the 15 reports and their Excel / PDF / CSV exports |
| `app/api/tickets/*` | support tickets, replies, internal notes, attachments |
| `app/api/notifications` | the header bell |
| `app/api/settings/*`, `app/api/audit/*` | general settings, scoring versions, notification templates, audit log and its export |
| `app/api/jobs/reminders` | deadline reminders (secret header or an admin session) |
| `app/api/health` | database check |

## Structure

```
app/
  (admin)/              admin pages (settings, users, audit, organisation, framework, scales, targets, library, cycles, schedules, forms, builder, system)
  (participant)/        participant pages (home, profile, take, assessments, evidence, plan)
  (manager)/            manager pages (team, team-evals, staff-evals, feedback, approvals)
  (analytics)/          analytics & reporting (analytics, dashboard, heatmap, reports, report, training)
  (support)/            support pages (tickets, help)
  (auth)/               authentication (signin)
  api/**                server API routes (accounts, assignments, attempts, content, org, reports, tickets, etc.)
components/
  admin/                administration CMS components (Organisation, Settings, System, Competencies, Content, Framework, FormBuilder)
  participant/          participant assessment components (Home, MyAssessments, Profile, Take)
  analytics/            analytics, dashboard, heatmap and reporting components (Dashboard, OrgDashboard, Reports, Priorities, StaffProfile, TeamResults)
  support/              support ticket and help center components (Tickets, Help)
  auth/                 authentication gateway components (SignIn)
  layout/               app shell (SkillMatrixApp) & client-side router (AppRouter)
  shared/               shared UI kit (smUI), models (smModel), banks (dvlaBanks), and permission utilities (smAccess)
drizzle/                drizzle/schema.js (MySQL 8 schema definition & relations)
lib/
  scoring.js            THE scoring engine (0-5, final average of completed attempts, Competent / Proficient, gaps)
  formBuilder.js        Form Builder canvas model: sections (= skill areas), drag-and-drop moves, what to save
  permissions.js        effective permissions, hard rules, department scope
  server/               db (Drizzle ORM), drizzleBridge, sessions, passwords, audit, scope, notify, assigned, results, etc.
scripts/                seed-mysql.mjs, db-reset.mjs, db-migrate.mjs, generate_schema_mysql.mjs
tests/                  vitest: scoring, permissions, results, attempts, content, assignments, org, analytics,
                        reports, tickets, settings, formBuilder
```

## Where to find things in the code

Every file starts with a header saying what it is, its web address, who uses it and its section list. Inside, sections are marked `// ===== AREA · Part =====` (or `{/* ===== AREA · Part ===== */}` in JSX). Search the project for the marker text to jump straight to it.

| On screen | File | Search for |
|---|---|---|
| Header, bell, sidebar, tabs, page guard | components/SkillMatrixApp.jsx | `HEADER ·`, `NOTIFICATIONS ·`, `SIDEBAR ·`, `ROUTER ·`, `PAGE ROUTER ·` |
| Home | SMDashboard.jsx | `HOME · My assessments`, `HOME · Team`, `HOME · Organisation`, `HOME · Content` |
| My Assessments / taking one | SMMyAssessments.jsx, SMTake.jsx | `MY ASSESSMENTS · Assessment card`, `TAKE · Question`, `TAKE · Review`, `TAKE · Active page time` |
| Assessment Content | SMContent.jsx | `CONTENT · List page`, `CONTENT · New assessment drawer`, `CONTENT · Who it is for (planned audience)`, `CONTENT · Workflow actions`, `CONTENT · Bulk upload` |
| Form Builder | SMFormBuilder.jsx, lib/formBuilder.js | `FORMS · Question types palette`, `FORMS · Canvas`, `FORMS · Inspector`, `FORMS · Saving`, `FORMS · Rubric & Scoring tab`, `FORMS · Preview tab`, `BUILDER · Sections` |
| Planned audience (assigned on publish) | lib/server/audience.js, app/api/assignments/create.js | `AUDIENCE · On publish`, `CREATE · Save & notify` |
| Assignments | SMAssignments.jsx | `ASSIGNMENTS · New assignment drawer`, `ASSIGNMENTS · Dialogs (edit, extend, cancel)` |
| Team Results / profile | SMTeamResults.jsx, SMStaffProfile.jsx | `TEAM · Summary table`, `TEAM · Matrix`, `PROFILE · Screen` |
| Dashboards / priorities | SMOrgDashboard.jsx, SMPriorities.jsx | `DASHBOARDS · Overview`, `DASHBOARDS · Heatmap`, `PRIORITIES · Top needs` |
| Reports | SMReports.jsx, lib/server/reports.js, lib/server/exporters.js | `REPORTS · Export`, the report list at the top of reports.js |
| Organisation | SMOrganisation.jsx | `ORG · Staff Records`, `ORG · Bulk import`, `ORG · Supervisors` |
| Competency Framework | SMCompetencies.jsx | `FRAMEWORK · Competency form` |
| Tickets | SMTickets.jsx | `TICKETS · Ticket drawer`, `TICKETS · Conversation` |
| Settings | SMSettings.jsx (users: SMSystem.jsx) | `GENERAL · Form`, `SCORING · Form`, `TEMPLATES · Editor`, `AUDIT · Table`, `USERS · Add / edit user dialog` |
| Permission list and role defaults | smAccess.js | `ACCESS · Permission list (areas & actions)`, `ACCESS · Role defaults` |
| Help & Rating Scales | SMHelp.jsx | `HELP · Answers`, `HELP · Rating Scales` |

## How the numbers are made

- **One engine:** `lib/scoring.js`. A competency score in one attempt is 5 × correct ÷ asked (0 to 5). The final result is the average of all COMPLETED attempts; unfinished, abandoned and expired attempts never count, and a competency that was not assessed is "Not assessed", never 0. Final results are cached in `FinalCompetencyResult`, rebuilt in the same transaction that completes an attempt.
- **Classification** (default thresholds, changeable as a new scoring version in Settings > Scoring): Competent from 4.00, Proficient at 5.00; Critical Gap below 2.50, Moderate Gap 2.50 to 4.99, No Gap at 5.00. Thresholds use the unrounded average; screens show 2 decimals.
- **Groups:** a person's result for a competency across several assessments is the average of every completed attempt that assessed it. A department's (or grade's, station's) average is the mean of its people's results. Dashboards, Team Results and Reports use the same rules, so their numbers match.
- **Progress:** `lib/server/assigned.js` decides who an assessment covers, each person's deadline (with extensions), attempt limit and status (Upcoming, Not started, In progress, Completed, Overdue). Completion rate = people with a completed attempt ÷ people assigned whose assessment has opened.

## Uploads

Spreadsheets (assessment questions in Assessment Content, staff records in Organisation) are read in the browser with SheetJS; only the cell text goes to the server, which checks every row and shows row-by-row errors before anything is saved. Each screen has a Download template button. Ticket attachments (pdf, png, jpg, docx, xlsx, txt, up to 5 MB) are checked by type and content on the server.

## Browser storage

The session is the `skm_session` cookie (scripts can't read it). The browser keeps only conveniences: `skm-me` (username, for the shell), `skm-nav-pin`, `skm-user-avatar` (profile photo) and remembered filters. No results or records are kept in the browser.

## Before production

- **Passwords and secrets:** set strong values in `.env` (database password, `JOBS_SECRET`), serve over HTTPS (the session cookie is marked Secure in production) and turn `SEED_DEMO` off.
- **Email / SMS:** notifications are in-app. Templates already have email/SMS channels that switch on when a mail or SMS service is configured (`NOTIFY_EMAIL` / `NOTIFY_SMS`); the sending itself still needs wiring to DVLA's service.
- **Reminders:** schedule `/api/jobs/reminders` (see Run it).
- **Backups:** the MySQL database and the `storage/` folder.
- **Dependency:** `xlsx` 0.18.5 from npm has known advisories for crafted files. Uploaded spreadsheets are therefore only read in the uploader's own browser, never on the server; the server only writes spreadsheets. Moving to SheetJS 0.20.x from `https://cdn.sheetjs.com/` is still recommended.
- **Single sign-on:** sign-in is local accounts; SSO can be added later.
