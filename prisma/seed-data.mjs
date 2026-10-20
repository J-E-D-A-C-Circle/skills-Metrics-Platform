// =============================================================================
// seed-data.mjs · Starting organisation and framework data loaded by prisma/seed.mjs
// Screen / URL: none; after seeding, admins manage all of this in the app (organisation CMS, phase 2)
// Used by: prisma/seed.mjs   Depends on: components/dvlaBanks.js (job levels, HR and RBDI frameworks, question banks)
// Sections (search for these markers): SEED DATA · Departments, SEED DATA · Locations & stations,
//   SEED DATA · Competency framework, SEED DATA · Demo accounts (test only), SEED DATA · Notification templates
// Copied from the prototype's buildData() in components/SkillMatrixApp.jsx so the database starts with the same
// departments and competencies the screens show today.
// =============================================================================
import { JOB_LEVELS, BANKS, HR_FRAMEWORK, RBDI_FRAMEWORK } from '../components/dvlaBanks.js';
export { JOB_LEVELS, BANKS };

// ===== SEED DATA · Departments =====
export const RBDI = 'Research, Business Development & Innovation';
export const DEPARTMENTS = [
  { code: 'IT', name: 'IT Department' },
  { code: 'HR', name: 'Human Resources' },
  { code: 'RBDI', name: RBDI },
  { code: 'CA', name: 'Corporate Affairs' },
];

// ===== SEED DATA · Locations & stations =====
// The offices the prototype uses. One station per location to start with; admins add more in the app.
export const LOCATIONS = [
  { name: 'Head Office, Accra', region: 'Greater Accra' },
  { name: 'Accra (37) Office', region: 'Greater Accra' },
  { name: 'Tema Office', region: 'Greater Accra' },
  { name: 'Kumasi Office', region: 'Ashanti' },
  { name: 'Takoradi Office', region: 'Western' },
  { name: 'Tamale Office', region: 'Northern' },
  { name: 'Ho Office', region: 'Volta' },
];

// ===== SEED DATA · Competency framework =====
// [code, name, short, importance]. General skills apply to every department (department: null).
const GENERAL = [['lead', 'Leadership & Management', 'Leadership', 5], ['comm', 'Communication', 'Communication', 5], ['service', 'Customer Service', 'Customer Service', 5],
  ['team', 'Collaboration & Teamwork', 'Teamwork', 5], ['digital', 'Digital Skills', 'Digital Skills', 4]];
const CA_TECH = [['media', 'Media Relation', 'Media Relation', 5], ['brand', 'Branding & Position', 'Branding', 5], ['graphic', 'Graphic Design', 'Graphic Design', 4], ['social', 'Social Media', 'Social Media', 5], ['video', 'Video Editing', 'Video Editing', 4]];
// IT has no DVLA source document yet, so it keeps the prototype's own technical skills (same codes it1 to it12).
const IT_SKILLS = [
  ['Systems & Infrastructure', [['Network Administration', 'Network', 5], ['Server Management', 'Servers', 4], ['Backup & Disaster Recovery', 'Backup & DR', 4]]],
  ['Software & Data', [['Database Administration', 'Databases', 4], ['Application Support', 'App Support', 5], ['Data Analysis & Reporting', 'Data & Reports', 3]]],
  ['Cybersecurity', [['Identity & Access Management', 'IAM', 5], ['Incident Response', 'Incident Resp.', 5], ['Cloud Services', 'Cloud', 3]]],
  ['IT Service Management', [['Helpdesk & Ticketing', 'Helpdesk', 4], ['Change Management', 'Change Mgmt', 3], ['Stakeholder Communication', 'Communication', 3]]],
];
let itNo = 0;
export const COMPETENCIES = [
  ...GENERAL.map(([code, name, short, importance]) => ({ code, name, short, importance, category: 'General', group: 'General Skills', dept: null })),
  ...IT_SKILLS.flatMap(([group, items]) => items.map(([name, short, importance]) => ({ code: 'it' + ++itNo, name, short, importance, category: 'Technical', group, dept: 'IT' }))),
  ...HR_FRAMEWORK.map(c => ({ code: c.id, name: c.name, short: c.short, importance: 4, category: 'Technical', group: c.group, dept: 'HR' })),
  ...RBDI_FRAMEWORK.map(c => ({ code: c.id, name: c.name, short: c.short, importance: 4, category: 'Technical', group: 'RBDI Technical Competencies', dept: 'RBDI', areas: c.areas })),
  ...CA_TECH.map(([code, name, short, importance]) => ({ code, name, short, importance, category: 'Technical', group: 'Corporate Affairs Technical Skills', dept: 'CA' })),
];

// ===== SEED DATA · Demo accounts (test only) =====
// Loaded only when SEED_DEMO=true. Staff IDs start with "DEMO-" so they can never be mistaken for real staff.
// [username, display name, department code, role, grade index]
export const DEMO_ACCOUNTS = [
  ['joseph.abandoh-sam', 'Joseph Ahor Abandoh-Sam', 'IT', 'SUPERVISOR', 3],
  ['esi.mensah', 'Esi Mensah', 'HR', 'CREATOR', 2],
  ['ama.owusu', 'Ama Owusu', 'IT', 'STAFF', 1],
  ['kofi.boateng', 'Kofi Boateng', 'IT', 'STAFF', 1],
  ['efua.asante', 'Efua Asante', 'IT', 'STAFF', 0],
  ['nana.appiah', 'Nana Appiah', 'RBDI', 'SUPERVISOR', 3],
  ['kojo.quaye', 'Kojo Quaye', 'CA', 'SUPERVISOR', 2],
  ['abena.sarpong', 'Abena Sarpong', 'IT', 'TICKET_RESOLVER', 1],
];

// ===== SEED DATA · Notification templates =====
// {placeholders} are filled in when a notification is sent (phase 8).
export const NOTIFICATION_TEMPLATES = [
  ['assessment.assigned', 'New assessment: {title}', 'You have been assigned {title}. It opens {startsAt} and closes {deadline}.'],
  ['assessment.deadline.soon', '{title} closes soon', '{title} closes {deadline}. You have used {used} of {max} attempts.'],
  ['assessment.deadline.passed', '{title} has closed', 'The deadline for {title} has passed.'],
  ['assessment.extension', 'More time for {title}', 'The deadline for {title} has moved to {deadline}.'],
  ['assessment.completed', 'Attempt submitted: {title}', 'Your attempt {attemptNo} of {title} was submitted.'],
  ['results.released', 'Results ready: {title}', 'Your results for {title} are ready to view.'],
  ['content.approved', 'Approved: {title}', '{title} was approved by {reviewer}.'],
  ['content.rejected', 'Rejected: {title}', '{title} was rejected. Feedback: {feedback}'],
  ['content.returned', 'Changes requested: {title}', '{title} was returned for revision. Feedback: {feedback}'],
  ['content.submitted', 'Review needed: {title}', '{author} submitted version {versionNo} of {title} for review.'],
  ['content.published', 'Published: {title}', 'Version {versionNo} of {title} is now published and can be assigned.'],
  ['ticket.updated', 'Ticket {reference} updated', 'Your support ticket {reference} is now {status}.'],
  ['ticket.created', 'New support ticket {reference}', '{requester} raised {reference}: {title} ({priority} priority).'],
  ['ticket.assigned', 'Ticket {reference} assigned to you', '{reference}: {title} ({priority} priority) is now assigned to you.'],
  ['ticket.activity', 'New reply on {reference}', '{actor} replied on {reference}: {title}.'],
  ['account.changed', 'Your account was updated', '{change}'],
];
