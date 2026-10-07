# DVLA · Skill Matrix & Assessment Platform (Next.js)

A Next.js 15 (App Router) version of the Skill Matrix prototype: the liquid-glass UI, the hover/pin sidebar, the timed one-day assessment, the Form Builder, user management with first sign-in password change, analytics and reports.

## Run it

```bash
npm install
npm run dev
# open http://localhost:3000
```

Demo sign-in: **denzilasiam.adjei** / **Password@1** (go to `/signin`).
Set `NEXT_PUBLIC_DEMO_ROLE` to `staff`, `manager`, `creator` or `admin` to change the default role before sign-in.

## Structure

```
app/
  layout.jsx            fonts, icon font, global CSS
  globals.css           body reset and link colours
  page.jsx              Home dashboard route (/)
  home/page.jsx         Home route (/home)
  profile/page.jsx      My Profile route (/profile)
  plan/page.jsx         Development Plan route (/plan)
  assessments/page.jsx  My Assessments route (/assessments)
  evidence/page.jsx     Evidence & Certifications route (/evidence)
  take/page.jsx         Take Assessment route (/take)
  team/page.jsx         Team Evaluations route (/team)
  team-evals/page.jsx   Team Evaluations route (/team-evals)
  feedback/page.jsx     360° Feedback route (/feedback)
  approvals/page.jsx    Plan Approvals route (/approvals)
  analytics/page.jsx    Analytics route (/analytics)
  dashboard/page.jsx    Executive Dashboard route (/dashboard)
  heatmap/page.jsx      Skill Heatmap route (/heatmap)
  reports/page.jsx      Report Builder route (/reports)
  schedules/page.jsx    Scheduled Reports route (/schedules)
  framework/page.jsx    Skill Framework route (/framework)
  forms/page.jsx        Form Builder route (/forms)
  library/page.jsx      Competency Library route (/library)
  targets/page.jsx      Target Profiles route (/targets)
  scales/page.jsx       Rating Scales route (/scales)
  builder/page.jsx      Assessment Scheduling route (/builder)
  system/page.jsx       System Administration route (/system)
  users/page.jsx        User Management route (/users)
  audit/page.jsx        Audit Logs route (/audit)
  settings/page.jsx     System Settings route (/settings)
  help/page.jsx         Help & Guides route (/help)
  signin/page.jsx       Sign In route (/signin)
  not-found.jsx         Fallback Not Found route
components/
  AppRouter.jsx         Client-side router bridge for page state & back/forward support
  SkillMatrixApp.jsx    Shell: glass header, hover/pin sidebar, notes, notifications, routing
  SMHome.jsx            Home dashboard
  SMProfile.jsx         Profile (Account, Skill Profile, History, Development Plan)
  SMAssessmentSession.jsx  timed one-day assessment (timer, autosave, integrity checks)
  SMAssessments.jsx     My Assessments and Evidence
  SMTeam.jsx            Team evaluations, 360° feedback, plan approvals
  SMAnalytics.jsx       Executive dashboard, heatmap, report builder, scheduled reports
  SMFramework.jsx       Competency library, target profiles, rating scales, scheduling
  SMFormBuilder.jsx     drag-and-drop Form Builder (SRS Module 1)
  SMSystem.jsx          User management, audit logs, settings, help
  SMSignIn.jsx          Sign in and first sign-in password change
  *.module.css          hover/focus states
public/assets/dvla-logo.png
```

## Routes

`/` home · `/profile` (`?tab=skills|history|plan`) · `/take` · `/assessments` · `/evidence` · `/team-evals` · `/feedback` · `/approvals` · `/dashboard` · `/heatmap` · `/reports` · `/schedules` · `/forms` · `/library` · `/targets` · `/scales` · `/builder` · `/users` · `/audit` · `/settings` · `/help` · `/signin`

## Before production

- **Data:** all data is sample data in `buildData()` (SkillMatrixApp.jsx). Users (`skm-users`), forms (`skm-forms`), notes and the assessment attempt live in localStorage. Replace these with API routes or a database (e.g. Route Handlers + Prisma/Postgres).
- **Auth:** passwords are stored in plain text in the browser for the demo. Use real authentication (NextAuth/Auth.js or your SSO), hash passwords on the server, and enforce the "must change password" flag server-side.
- **Assessment integrity:** the timer, attempt limit and window-leave count must also be enforced on the server. The client checks are only deterrents.
- **Email:** "Email sign-in details" and scheduled reports only show confirmations. Wire them to your mail service.
- **Exports:** CSV, JSON and XML download in the browser. PDF and Excel only show a confirmation and need a server-side generator.
