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

A feature that is `false` disappears from the sidebar, routes, Profile tabs, Home cards, notifications, filters and in-page links. Its code is still in place. Plan Approvals only turns on when **both** `planApprovals` and `developmentPlan` are `true`. Typing the URL of a hidden page redirects to Home.

**Currently hidden:** Audit Logs (`/audit`), Development Plan (`/plan` and `/profile?tab=plan`), 360° Feedback (`/feedback`, plus 360° rows, filters, timeline steps and the anonymity setting), Evidence & Certifications (`/evidence`, the Upload Evidence buttons and evidence notes) and Plan Approvals (`/approvals`).

## Sidebar by role

| Group | Admin | Manager | Creator | Staff |
|---|---|---|---|---|
| Overview | Home | Home | Home | Home |
| Analytics | Executive Dashboard · Skill Heatmap · Training Needs · Report Builder · Scheduled Reports | Dashboard · Heatmap · Training Needs (own department) | | |
| Assessments | Assessment Cycles · Form Builder · Staff Evaluations · My Assessments | Staff Evaluations (own department) · My Assessments | Form Builder · My Assessments | My Assessments |
| Skill Framework | Competency Library · Target Profiles · Rating Scales | | Competency Library · Target Profiles · Rating Scales | |
| Administration | User Management · System Settings | | | |

- Take Assessment is not a sidebar item. Start an assessment from the Home card, from My Assessments, or from the notification.
- Profile opens from the avatar/name in the header. Its tabs (Account, Skill Profile, History) are only inside the Profile page.
- Help & Guides is in the sidebar footer quick actions.
- Admins have a department selector in the header ("All departments" or one department), remembered in localStorage (`skm-scope`). The Dashboard, Heatmap, Training Needs, Report Builder, Staff Evaluations and Target Profiles all use it. Each of those pages can override it with its own filter. Managers are always locked to their own department.

## Routes

`/` home · `/profile` (`?tab=skills|history`) · `/take` · `/assessments` · `/staff-evals` · `/dashboard` · `/heatmap` · `/training` · `/reports` · `/schedules` · `/cycles` · `/forms` · `/library` · `/targets` · `/scales` · `/users` · `/settings` · `/help` · `/report?id=<staffId>` (individual report) · `/signin`

Every route has its own folder under `app/`. Old and umbrella URLs still work: `/builder` → `/cycles`, `/team-evals` and `/team` → `/staff-evals`, `/analytics` → `/dashboard`, `/framework` → `/library`, `/system` → `/settings`. Hidden routes: `/audit`, `/plan`, `/feedback`, `/evidence`, `/approvals` (they redirect to Home while their flag is off). Back and forward work, and redirects replace the history entry.

## Structure

```
app/
  layout.jsx            fonts, icon font, global CSS
  globals.css           body reset, link colours, Select animation
  page.jsx              Home route (/)
  not-found.jsx         fallback route (renders Home)
  <route>/page.jsx      one folder per URL; each renders <AppRouter initialPage="<route>" />
    home · profile · assessments · take · signin · help
    dashboard · heatmap · training · reports · schedules · report (individual report, ?id=)
    cycles · forms · staff-evals · library · targets · scales · users · settings
    analytics → dashboard · team, team-evals → staff-evals · framework → library · system → settings · builder → cycles
    plan · evidence · feedback · approvals · audit (hidden by FEATURES; they redirect Home while off)
components/
  AppRouter.jsx         URL → app (page, ?tab, ?id); pushState/replaceState; back/forward
  SkillMatrixApp.jsx    FEATURES, buildData() (all sample data), NAV, routing/guards, header scope, shell
  dvlaBanks.js          job levels, RBDI and HR frameworks and the eight question banks (generated from the PDFs)
  smModel.js            derived model: automatic scoring, interpretation bands, target-profile resolution, gaps, training, report data
  smUI.jsx              shared UI: PageHeader, Card, DataTable, badges, EmptyState, Drawer, StaffDrawer, ScopeSelect
  ui/select.jsx         shadcn-style Select used for every dropdown (no native <select> anywhere)
  SMHome.jsx            personal Home (staff/manager/creator); SMAdminHome.jsx is the admin overview
  SMProfile.jsx         Profile (Account with profile photo, Skill Profile, History)
  SMAnalytics.jsx       Executive Dashboard, Skill Heatmap, Report Builder, Scheduled Reports
  SMTraining.jsx        Training Needs (by competency / by staff)
  SMStaffReport.jsx     individual report page + exports (also used by the Report Builder)
  SMStaffEvals.jsx      Staff Evaluations (review, confirm, adjust)
  SMTeam.jsx            routes Staff Evaluations; keeps the hidden 360° Feedback and Plan Approvals code
  SMCycles.jsx          Assessment Cycles: table, editor, SheetJS upload with validated preview
  SMFramework.jsx       Competency Library, Target Profiles, Rating Scales
  SMFormBuilder.jsx     Form Builder (WYSIWYG canvas, configurable Likert); exports form storage helpers
  SMAssessments.jsx · SMAssessmentSession.jsx · SMSystem.jsx · SMSignIn.jsx
  *.module.css          hover/focus states
public/assets/dvla-logo.png
```

## How the numbers are made

Everything on screen is derived from `buildData()` plus browser state. No totals are hard-coded.

- **Organisation:** 4 departments (IT, Human Resources, Research, Business Development & Innovation, Corporate Affairs) and 43 staff across the four job levels. Every person is assessed on the 5 general skills plus their department's technical competencies. Training is a structured programme for gaps of 3 or more and coached practice for smaller gaps; HR (L&D) assigns the actual programme.
- **Results:** each submitted staff member has item-level answers. HR and RBDI staff answer the real question bank for their job level (a correct answer scores 1). The other competencies are rated on the proficiency scale (a rating of v scores v × 20%). The overall score uses the tools' interpretation: 80–100% High Competency, 60–79% Moderate, 40–59% Basic, below 40% Training Required. Each competency's percentage maps to a level with the same cut-offs (Expert ≥90, Proficient ≥80, Competent ≥60, Basic ≥40, otherwise Novice), and the pass mark is 60%. Staff Evaluations shows each answer next to the answer key. Open-text answers count once a reviewer scores them. **Gap = max(0, Target − Actual)**, shown with the 0–5 bands in `DATA.GAP`. Staff who have not submitted show their Q3 result. Because levels run from 1 to 5, the largest possible gap is 4, so the Critical (5) band is never reached with the current scale.
- **Statuses:** Not started → In progress → Submitted (open text waiting) → Auto-scored (ready to confirm) → Confirmed. Reviewers score the open text, then confirm or adjust a competency with a mandatory reason. System and final scores are shown side by side.
- **Targets:** profiles are mapped by job level and career track, with Technical and General category targets. Corporate Affairs has department overrides that reproduce the sample's required levels. An org-wide profile applies everywhere; a department override replaces it in that department. Category targets can be fine-tuned per competency.

## Browser storage

`skm-scope` (header department) · `skm-target-profiles` · `skm-evals` (reviews, adjustments, confirmations) · `skm-cycles` · `skm-forms` · `skm-qbank` (uploaded question bank) · `skm-users` · `skm-notes` · `skm-session` · `skm-nav-pin` · `skm-user-avatar` (profile photo). To reset the demo, clear site data. When the sample data changes shape, bump `DATA_VERSION` in `SkillMatrixApp.jsx`; browsers then clear the old saved state once. Staff Evaluations also has a "Reset demo reviews" button.

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
