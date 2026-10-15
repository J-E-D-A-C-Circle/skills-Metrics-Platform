# DVLA · Skill Matrix & Assessment Platform (Next.js)

A Next.js 15 (App Router) front-end prototype of the Skill Matrix platform. This build is the **Administrator / super-user console**: every screen is designed for someone who oversees all departments. It keeps the liquid-glass UI, the hover/pin sidebar and the timed one-day assessment. It adds a department scope, automatic scoring with manager review, click-through analytics, training needs, cycle management with spreadsheet upload, and target profiles with department overrides.

Front end only: there is no backend, database, API route or real authentication. Sample data lives in `buildData()` and `components/dvlaBanks.js`, and browser state lives in localStorage.

## Source content

The competency framework, question banks and scales come from the DVLA documents:

- **RBDI Competency Capacity Assessment Tools** (Assistant Officer; Officer & Senior Officer; Assistant Manager & Manager; Deputy Director & Director): 8 competencies with 41 skill areas, 82 scenario questions per level with the published answer keys.
- **HR Skill Matrix Question Banks** (same four levels): Talent Acquisition & Selection (1.1–1.6) and Learning & Development Management (2.1–2.7), 5 questions per sub-skill. The Officer & Senior Officer bank has 64 questions because sub-skill 1.4 has only four in the source.
- **Skills Matrix Data Analysis sample:** the five general skills used for every department, the Corporate Affairs technical skills, and the five Public Relations records (their required and current ratings are loaded as-is, so the Corporate Affairs averages match the sample: technical gap 2.64, general gap 0.72).
- **SRS:** the proficiency, importance and gap scales, and the Department → major skill → specific competency hierarchy.

`components/dvlaBanks.js` holds the question text, options and answer keys verbatim (line breaks from the PDFs were joined). The four job levels above replace the earlier grades. IT keeps the prototype's original technical skills because no IT document was supplied. Staff names, results and importance ratings for HR/RBDI (set to 4) are sample data.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Demo sign-in: **denzilasiam.adjei** / **Password@1** (go to `/signin`). Every seeded user has the password `Password@1`. To try other roles, sign in as `joseph.abandoh-sam` (manager), `esi.mensah` (assessment creator) or `ama.owusu` (participant).
Set `NEXT_PUBLIC_DEMO_ROLE` to `staff`, `manager`, `creator` or `admin` to change the default role before sign-in.

## Feature flags

`FEATURES` at the top of `components/SkillMatrixApp.jsx`:

```js
const FEATURES = { auditLogs: false, developmentPlan: false, feedback360: false, evidence: false, planApprovals: false };
```

A feature that is `false` loses its tab (Settings, Staff Evaluations or Profile), Home cards, notifications, filters and in-page links. Its code is still in place. Plan Approvals only turns on when **both** `planApprovals` and `developmentPlan` are `true`. A URL to a hidden feature opens the first tab of its page instead.

**Currently hidden:** Audit Logs (`/audit`), Development Plan (`/plan` and `/profile?tab=plan`), 360° Feedback (`/feedback`, plus 360° rows, filters, timeline steps and the anonymity setting), Evidence & Certifications (`/evidence`, the Upload Evidence buttons and evidence notes) and Plan Approvals (`/approvals`).

## Sidebar by role

Pages that are really parts of another page are tabs on that page, not sidebar items.

| Group | Admin | Manager | Creator | Staff |
|---|---|---|---|---|
| Overview | Home | Home | Home | Home |
| Assessments | Assessment Cycles · Forms · Staff Evaluations | Staff Evaluations (own department) · My Assessments | Forms · My Assessments | My Assessments |
| Analytics | Analytics · Training Needs · Reports | Analytics · Training Needs (own department) | | |
| Administration | Skill Framework | | Skill Framework | |

Administrators don't take assessments: they have no My Assessments, no assessment card on Home, no assessment notifications, no Skill Profile or Assessment History tab, and `/take` sends them Home.

Tabs (the same tab bar as Profile; a tab whose feature is off is removed, and a page with one tab left shows no tab bar):

| Page | Tabs |
|---|---|
| Analytics | Overview (executive dashboard) · Departments · Heatmap |
| Training Needs | All Needs · Top Training Needs |
| Reports | Report Builder · Scheduled |
| Skill Framework | Competencies · Target Profiles |
| Settings | General · User Management · Audit Log (`auditLogs`) |
| Help & Guides | Help & Guides · Rating Scales (open to every role) |
| Staff Evaluations | Reviews · 360° Feedback (`feedback360`) · Plan Approvals (`planApprovals` + `developmentPlan`) |
| Profile | Account · Skill Profile · History · Development Plan (`developmentPlan`) · Evidence (`evidence`) |

- Tabs are defined in `TABS` in `components/SkillMatrixApp.jsx`. A tab can also have its own `roles`; a role that cannot see a tab does not get it.
- Take Assessment is not a sidebar item. Start an assessment from the Home card, from My Assessments, or from the notification.
- Profile opens from the avatar/name in the header.
- The sidebar footer has Help & Guides, Settings (admins only; other roles get My Profile) and Sign out. Settings is not in the sidebar menu. Notifications are only on the header bell.
- There is no department selector in the header. Admins start on "All departments" and pick a department with the filter on each page (Analytics, Training Needs, Reports, Staff Evaluations, Target Profiles). Managers are always locked to their own department.

## Routes

`/` home · `/profile` (`?tab=skills|history|plan|evidence`) · `/take` · `/assessments` · `/analytics` (`?tab=departments|heatmap`) · `/training` (`?tab=top-needs`) · `/reports` (`?tab=scheduled`) · `/cycles` · `/forms` · `/staff-evals` (`?tab=feedback|approvals`) · `/framework` (`?tab=targets`) · `/settings` (`?tab=users|audit`) · `/help` (`?tab=ratings`) · `/report?id=<staffId>` (individual report) · `/signin`

The first tab of a page has no `?tab=`. Switching tabs updates `?tab=` and adds a history entry, so back/forward move between tabs.

Every route has its own folder under `app/`. Old URLs redirect, replacing the history entry:

| Old URL | Goes to |
|---|---|
| `/heatmap` · `/dashboard` | `/analytics?tab=heatmap` · `/analytics` |
| `/users` | `/settings?tab=users` |
| `/schedules` | `/reports?tab=scheduled` |
| `/library` · `/targets` · `/scales` | `/framework` · `/framework?tab=targets` · `/help?tab=ratings` |
| `/audit` · `/system` | `/settings?tab=audit` · `/settings` |
| `/feedback` · `/approvals` · `/team` · `/team-evals` | `/staff-evals?tab=feedback` · `/staff-evals?tab=approvals` · `/staff-evals` |
| `/plan` · `/evidence` | `/profile?tab=plan` · `/profile?tab=evidence` |
| `/builder` | `/cycles` |

A URL to a tab that is switched off or not allowed opens the page's first tab; a page the role cannot see opens Home.

## Structure

```
app/
  layout.jsx            fonts, icon font, global CSS
  globals.css           body reset, link colours, Select animation
  page.jsx              Home route (/)
  not-found.jsx         fallback route (renders Home)
  <route>/page.jsx      one folder per URL; each renders <AppRouter initialPage="<route>" />
    home · profile · assessments · take · signin · help · report (individual report, ?id=)
    analytics · training · reports · cycles · forms · staff-evals · framework · settings
    old URLs, now redirects to a page tab: heatmap · schedules · library · targets · scales · audit · feedback ·
    approvals · plan · evidence · analytics · team · team-evals · system · builder (see Routes)
components/
  AppRouter.jsx         URL → app (page, ?tab, ?id); pushState/replaceState; back/forward
  SkillMatrixApp.jsx    FEATURES, buildData() (all sample data), NAV, routing/guards, signed-in user, shell
  dvlaBanks.js          job levels, RBDI and HR frameworks and the eight question banks (generated from the PDFs)
  smModel.js            derived model: automatic scoring, interpretation bands, target-profile resolution, gaps, training, report data
  smUI.jsx              shared UI: PageHeader (with the page tab bar), Card, DataTable, badges, EmptyState, Drawer, StaffDrawer, ScopeSelect
  ui/select.jsx         shadcn-style Select used for every dropdown (no native <select> anywhere)
  SMHome.jsx            personal Home (staff/manager/creator); SMAdminHome.jsx is the admin overview
  SMProfile.jsx         Profile (Account with profile photo, Skill Profile, History)
  SMAnalytics.jsx       Executive Dashboard, Departments, Top Training Needs (shown under Training Needs), Skill Heatmap, Report Builder, Scheduled Reports
  SMTraining.jsx        Training Needs (by competency / by staff)
  SMStaffReport.jsx     individual report page + exports (also used by the Report Builder)
  SMStaffEvals.jsx      Staff Evaluations (review, confirm, adjust)
  SMTeam.jsx            routes Staff Evaluations; keeps the hidden 360° Feedback and Plan Approvals code
  SMCycles.jsx          Assessment Cycles: table, editor, SheetJS upload with validated preview
  SMFramework.jsx       Competency Library, Target Profiles; exports the Rating Scales cards used on Help & Guides
  SMFormBuilder.jsx     Form Builder (WYSIWYG canvas, configurable Likert); exports form storage helpers
  SMAssessments.jsx · SMAssessmentSession.jsx · SMSystem.jsx · SMSignIn.jsx
  *.module.css          hover/focus states
public/assets/dvla-logo.png
```

## Where to find things in the code

Every file starts with a header saying what it draws, its web address, who sees it and its section list.
Inside, sections are marked `// ===== AREA · Part =====` (or `{/* ===== AREA · Part ===== */}` in JSX).
Search the project for the marker text (e.g. `HOME · Welcome banner`) to jump straight to it.

| On screen | File (components/) | Search for |
|---|---|---|
| Top green header: logo, title, bell, profile chip | SkillMatrixApp.jsx | `HEADER · Logo & title`, `HEADER · Bell & profile button` |
| Notifications dropdown | SkillMatrixApp.jsx | `NOTIFICATIONS · Dropdown panel` |
| Sidebar menu, its groups and order | SkillMatrixApp.jsx | `SIDEBAR · Menu groups (NAV)`, `SIDEBAR · Menu groups` |
| Sidebar footer: Help, Settings, Sign out | SkillMatrixApp.jsx | `SIDEBAR · Footer quick actions` |
| Page tabs (Analytics, Training, Settings ...) | SkillMatrixApp.jsx | `ROUTER · Tabbed pages (TABS)` |
| Old URL redirects | SkillMatrixApp.jsx | `ROUTER · Old URL redirects (REDIRECT)` |
| Who can open which page | SkillMatrixApp.jsx | `ROUTER · Access guard (normalize)` |
| Which component draws which page | SkillMatrixApp.jsx | `PAGE ROUTER · Page component per route` |
| Who is signed in (name, initials, details) | SkillMatrixApp.jsx | `SIGNED-IN USER · readMe / userFor` |
| Sample data (departments, staff, cycles, current user) | SkillMatrixApp.jsx | `DATA MODEL · ...` |
| Scoring, gaps, target levels, training suggestion | smModel.js | `DATA MODEL · Scoring`, `DATA MODEL · Training suggestion` |
| Shared buttons, cards, tables, drawers, department filter | smUI.jsx | `UI KIT · ...` |
| Dropdown (select) control | ui/select.jsx | `UI KIT · Select component` |
| Sign-in and first-time password change | SMSignIn.jsx | `SIGN IN · Sign-in form`, `SIGN IN · Set your password` |
| Sign-in page photo slideshow (3 DVLA photos in public/assets/dvla-login-1..3.jpg) | SMSignIn.jsx | `SIGN IN · DVLA photo slideshow`, `SIGN IN · Brand panel animations` |
| Home welcome banner (photo, name, DVLA building) | SMHome.jsx | `HOME · Welcome banner` |
| Home info row (Staff ID, department, designation) | SMHome.jsx | `HOME · Info row` |
| Home assessment banner (Start / Resume) | SMHome.jsx | `HOME · Assessment banner` |
| Home KPI cards, priority gaps, quick actions | SMHome.jsx | `HOME · KPI cards`, `HOME · Priority skill gaps table`, `HOME · Quick actions` |
| Home calendar and cycle timeline | SMHome.jsx | `HOME · Calendar`, `HOME · Cycle timeline` |
| Admin Home: shortcut cards, KPI tiles, attention, cycles | SMAdminHome.jsx | `ADMIN HOME · Shortcut cards`, `ADMIN HOME · KPI tiles`, `ADMIN HOME · Needs your attention card` |
| My Profile: header, photo, tabs | SMProfile.jsx | `PROFILE · Profile header card`, `PROFILE · Tabs bar` |
| Profile tabs: account, skills radar, history, plan | SMProfile.jsx | `PROFILE · Account tab`, `PROFILE · Skills tab`, `PROFILE · History tab`, `PROFILE · Development plan tab` |
| My Assessments list and evidence uploads | SMAssessments.jsx | `ASSESSMENTS · Current cycle card`, `ASSESSMENTS · Evidence` |
| Taking the assessment: rules screen | SMAssessmentSession.jsx | `ASSESSMENT · Brief screen` |
| Taking the assessment: questions, timer, integrity | SMAssessmentSession.jsx | `ASSESSMENT · Live question screen`, `ASSESSMENT · Autosave, timer & integrity checks` |
| Assessment receipt after submitting | SMAssessmentSession.jsx | `ASSESSMENT · Submitted screen` |
| Assessment Cycles list, editor, uploads | SMCycles.jsx | `CYCLES · Cycles table`, `CYCLES · Cycle editor`, `CYCLES · Upload drawer` |
| Forms library and builder | SMFormBuilder.jsx | `FORMS · Build tab`, `FORMS · Rubric & Scoring tab`, `FORMS · Preview tab` |
| Staff Evaluations: reviews and review drawer | SMStaffEvals.jsx | `STAFF EVALS · Staff table`, `STAFF EVALS · Review drawer` |
| Staff Evaluations: staff details popup (click a name) | SMStaffEvals.jsx, SMStaffReport.jsx | `STAFF EVALS · Staff details popup`, `REPORT · Staff details popup` |
| Staff details popup: floating staff list on the left (switch person) | SMStaffReport.jsx | `REPORT · Popup staff list (floating panel, left)` |
| 360 feedback and plan approvals | SMTeam.jsx | `STAFF EVALS · 360 Feedback tab`, `STAFF EVALS · Plan Approvals tab` |
| Analytics Overview (KPIs, charts) | SMAnalytics.jsx | `ANALYTICS · Overview dashboard`, `ANALYTICS · KPI tiles` |
| Analytics Departments tab | SMAnalytics.jsx | `ANALYTICS · Departments table` |
| Analytics Heatmap tab | SMAnalytics.jsx | `ANALYTICS · Heatmap tab` |
| Training Needs · All Needs | SMTraining.jsx | `TRAINING · All Needs page` |
| Training Needs · Top Training Needs | SMAnalytics.jsx | `TRAINING · Top Training Needs` |
| Report Builder and Scheduled reports | SMAnalytics.jsx | `REPORTS · Report builder`, `REPORTS · Scheduled reports` |
| Individual staff report (/report?id=) | SMStaffReport.jsx | `REPORT · Page` |
| Skill Framework: competencies, target profiles | SMFramework.jsx | `FRAMEWORK · Competencies tab`, `FRAMEWORK · Target Profiles tab` |
| Settings General tab | SMSystem.jsx | `SETTINGS · General tab` |
| User Management: table, add/edit dialog, delete | SMSystem.jsx | `USERS · Users table`, `USERS · Add / edit user dialog`, `USERS · Delete confirmation dialog` |
| Audit Log | SMSystem.jsx | `AUDIT LOG · Audit Log tab` |
| Help & Guides | SMSystem.jsx | `HELP · Help & Guides tab`, `HELP · Quick links, FAQ & support ticket` |
| Help & Guides: Rating Scales tab | SMSystem.jsx, SMFramework.jsx | `HELP · Rating Scales tab`, `HELP · Rating Scales cards` |
| Question banks (RBDI, HR) | dvlaBanks.js | `QUESTION BANKS` |
| Route files (one per URL) | app/<route>/page.jsx | first line says what the URL opens |

## How the numbers are made

Everything on screen is derived from `buildData()` plus browser state. No totals are hard-coded.

- **Organisation:** 4 departments (IT, Human Resources, Research, Business Development & Innovation, Corporate Affairs) and 43 staff across the four job levels. Every person is assessed on the 5 general skills plus their department's technical competencies. Training is a structured programme for gaps of 3 or more and coached practice for smaller gaps; HR (L&D) assigns the actual programme.
- **Results:** each submitted staff member has item-level answers. HR and RBDI staff answer the real question bank for their job level (a correct answer scores 1). The other competencies are rated on the proficiency scale (a rating of v scores v × 20%). The overall score uses the tools' interpretation: 80–100% High Competency, 60–79% Moderate, 40–59% Basic, below 40% Training Required. Each competency's percentage maps to a level with the same cut-offs (Expert ≥90, Proficient ≥80, Competent ≥60, Basic ≥40, otherwise Novice), and the pass mark is 60%. Staff Evaluations shows each answer next to the answer key. Open-text answers count once a reviewer scores them. **Gap = max(0, Target − Actual)**, shown with the 0–5 bands in `DATA.GAP`. Staff who have not submitted show their Q3 result. Because levels run from 1 to 5, the largest possible gap is 4, so the Critical (5) band is never reached with the current scale.
- **Statuses:** Not started → In progress → Submitted (open text waiting) → Auto-scored (ready to confirm) → Confirmed. Reviewers score the open text, then confirm or adjust a competency with a mandatory reason. System and final scores are shown side by side.
- **Targets:** profiles are mapped by job level and career track, with Technical and General category targets. Corporate Affairs has department overrides that reproduce the sample's required levels. An org-wide profile applies everywhere; a department override replaces it in that department. Category targets can be fine-tuned per competency.

## Browser storage

`skm-me` (username of whoever is signed in; their name, initials and department show in the header, sidebar, Home and Profile) · `skm-target-profiles` · `skm-evals` (reviews, adjustments, confirmations) · `skm-cycles` · `skm-forms` · `skm-qbank` (uploaded question bank) · `skm-users` · `skm-notes` · `skm-session` · `skm-nav-pin` · `skm-user-avatar` (profile photo). To reset the demo, clear site data. When the sample data changes shape, bump `DATA_VERSION` in `SkillMatrixApp.jsx`; browsers then clear the old saved state once. Staff Evaluations also has a "Reset demo reviews" button.

## Uploads (Assessment Cycles)

Uploads are parsed in the browser with SheetJS (`xlsx`, the only added dependency).
- **Upload assessment** (.xlsx/.csv/.json) creates a draft cycle and a matching draft form in the Form Builder. In .xlsx, the `Assessment` sheet holds name, departments, dates, window, duration and attempts, and the `Questions` sheet holds the questions. A .csv is treated as questions only, and the name comes from the file name. JSON uses `{ assessment: {...}, questions: [...] }`.
- **Upload questions** adds questions to an existing form (a published form gets a new draft version) or to the question bank.
- Question columns: `competency, question, type (likert/single/multiple/numeric/text), options (pipe-separated), correct answer, weight, required`.
- Use **Download template** for either upload. The preview flags unknown competencies, missing question text, bad types, missing or invalid options and answers, and bad weights. You can fix cells or skip rows before importing.

## Before production

- **Data:** replace `buildData()` and localStorage with API routes or a database (e.g. Route Handlers + Prisma/Postgres). Scoring in `smModel.js` must run on the server so results can't be altered in the browser.
- **Auth:** passwords are stored in plain text in the browser for the demo. Use real authentication (NextAuth/Auth.js or your SSO), hash passwords on the server, and enforce roles and department scope server-side. The role checks in the client only hide UI.
- **Assessment integrity:** the timer, attempt limit and window-leave count must also be enforced on the server.
- **Email:** invitations, reminders and scheduled reports only show confirmations. Wire them to your mail service.
- **Exports:** CSV, JSON, XML and Excel download in the browser. PDF only shows a confirmation and needs a server-side generator.
- **Dependency:** the npm-registry release of `xlsx` (0.18.5) has known advisories (`npm audit`). For production, install SheetJS from its official CDN tarball (`https://cdn.sheetjs.com/`) or parse uploads on the server.
