// =============================================================================
// drizzle/schema.js · Complete MySQL 8 Schema for Skill Matrix & Assessment Platform
// Managed with Drizzle ORM
// =============================================================================
import {
  mysqlTable,
  int,
  varchar,
  text,
  boolean,
  timestamp,
  decimal,
  json,
  mysqlEnum,
  bigint,
  uniqueIndex,
  index,
  primaryKey
} from 'drizzle-orm/mysql-core';
import { relations } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

// ===== ENUMS =====
export const staffStatusEnum = (col = 'status') => mysqlEnum(col, ['ACTIVE', 'INACTIVE', 'LEFT']);
export const accountStatusEnum = (col = 'status') => mysqlEnum(col, ['ACTIVE', 'MUST_CHANGE_PASSWORD', 'SUSPENDED', 'DISABLED']);
export const roleEnum = (col = 'role') => mysqlEnum(col, ['STAFF', 'SUPERVISOR', 'STATION_MANAGER', 'CREATOR', 'ADMIN', 'TICKET_RESOLVER']);
export const deptScopeEnum = (col = 'deptScope') => mysqlEnum(col, ['ALL', 'OWN', 'SELECTED']);
export const skillTypeEnum = (col = 'skillType') => mysqlEnum(col, ['GENERAL', 'TECHNICAL']);
export const assessmentStatusEnum = (col = 'status') => mysqlEnum(col, ['DRAFT', 'SUBMITTED', 'RETURNED', 'REJECTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED']);
export const resultReleaseEnum = (col = 'resultRelease') => mysqlEnum(col, ['IMMEDIATE', 'AFTER_DEADLINE', 'MANUAL']);
export const questionTypeEnum = (col = 'type') => mysqlEnum(col, ['SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT']);
export const assignmentTargetEnum = (col = 'targetType') => mysqlEnum(col, ['INDIVIDUAL', 'DEPARTMENT', 'GRADE', 'STATION', 'LOCATION']);
export const attemptStatusEnum = (col = 'status') => mysqlEnum(col, ['IN_PROGRESS', 'SUBMITTED', 'PENDING_MARKING', 'COMPLETED', 'ABANDONED', 'EXPIRED']);
export const ticketStatusEnum = (col = 'status') => mysqlEnum(col, ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED']);
export const ticketPriorityEnum = (col = 'priority') => mysqlEnum(col, ['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// ===== 1. ORGANISATION =====

export const departments = mysqlTable('Department', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 191 }).notNull().unique(),
  name: varchar('name', { length: 191 }).notNull().unique(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const grades = mysqlTable('Grade', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull().unique(),
  rank: int('rank').notNull().unique(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const locations = mysqlTable('Location', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull().unique(),
  region: varchar('region', { length: 191 }),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const stations = mysqlTable('Station', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  locationId: int('locationId').notNull().references(() => locations.id),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex('Station_locationId_name_key').on(table.locationId, table.name),
]);

export const gradeSupervisoryMappings = mysqlTable('GradeSupervisoryMapping', {
  id: int('id').autoincrement().primaryKey(),
  gradeId: int('gradeId').notNull().references(() => grades.id),
  stationId: int('stationId').references(() => stations.id),
  roleLabel: varchar('roleLabel', { length: 191 }).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('GradeSupervisoryMapping_gradeId_stationId_roleLabel_key').on(table.gradeId, table.stationId, table.roleLabel),
]);

// ===== 2. STAFF RECORDS =====

export const staffRecords = mysqlTable('StaffRecord', {
  id: int('id').autoincrement().primaryKey(),
  staffNo: varchar('staffNo', { length: 191 }).notNull().unique(),
  firstName: varchar('firstName', { length: 191 }).notNull(),
  lastName: varchar('lastName', { length: 191 }).notNull(),
  otherNames: varchar('otherNames', { length: 191 }),
  email: varchar('email', { length: 191 }).unique(),
  designation: varchar('designation', { length: 191 }),
  departmentId: int('departmentId').references(() => departments.id),
  gradeId: int('gradeId').references(() => grades.id),
  stationId: int('stationId').references(() => stations.id),
  supervisorId: int('supervisorId').references(() => staffRecords.id),
  status: staffStatusEnum('status').default('ACTIVE').notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index('StaffRecord_departmentId_idx').on(table.departmentId),
  index('StaffRecord_gradeId_idx').on(table.gradeId),
  index('StaffRecord_stationId_idx').on(table.stationId),
]);

export const staffPlacementHistories = mysqlTable('StaffPlacementHistory', {
  id: int('id').autoincrement().primaryKey(),
  staffId: int('staffId').notNull().references(() => staffRecords.id),
  departmentId: int('departmentId').references(() => departments.id),
  stationId: int('stationId').references(() => stations.id),
  fromDate: timestamp('fromDate', { fsp: 3 }).defaultNow().notNull(),
  toDate: timestamp('toDate', { fsp: 3 }),
  reason: text('reason'),
  changedById: int('changedById').references(() => accounts.id),
}, (table) => [
  index('StaffPlacementHistory_staffId_fromDate_idx').on(table.staffId, table.fromDate),
]);

// ===== 3. ACCOUNTS & SIGN-IN =====

export const accounts = mysqlTable('Account', {
  id: int('id').autoincrement().primaryKey(),
  username: varchar('username', { length: 191 }).notNull().unique(),
  email: varchar('email', { length: 191 }).notNull().unique(),
  displayName: varchar('displayName', { length: 191 }).notNull(),
  passwordHash: varchar('passwordHash', { length: 255 }).notNull(),
  role: roleEnum('role').default('STAFF').notNull(),
  status: accountStatusEnum('status').default('MUST_CHANGE_PASSWORD').notNull(),
  staffId: int('staffId').references(() => staffRecords.id),
  deptScope: deptScopeEnum('deptScope').default('OWN').notNull(),
  lastLoginAt: timestamp('lastLoginAt', { fsp: 3 }),
  passwordSetAt: timestamp('passwordSetAt', { fsp: 3 }),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index('Account_staffId_idx').on(table.staffId),
]);

export const sessions = mysqlTable('Session', {
  id: varchar('id', { length: 191 }).primaryKey().$defaultFn(() => randomUUID()),
  tokenHash: varchar('tokenHash', { length: 191 }).notNull().unique(),
  accountId: int('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  expiresAt: timestamp('expiresAt', { fsp: 3 }).notNull(),
  lastSeenAt: timestamp('lastSeenAt', { fsp: 3 }).defaultNow().notNull(),
  revokedAt: timestamp('revokedAt', { fsp: 3 }),
  ip: varchar('ip', { length: 191 }),
  userAgent: text('userAgent'),
}, (table) => [
  index('Session_accountId_idx').on(table.accountId),
]);

export const loginAttempts = mysqlTable('LoginAttempt', {
  id: int('id').autoincrement().primaryKey(),
  identifier: varchar('identifier', { length: 191 }).notNull(),
  ip: varchar('ip', { length: 191 }),
  success: boolean('success').notNull(),
  reason: varchar('reason', { length: 191 }),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  index('LoginAttempt_identifier_at_idx').on(table.identifier, table.at),
  index('LoginAttempt_ip_at_idx').on(table.ip, table.at),
]);

export const accountRoles = mysqlTable('AccountRole', {
  accountId: int('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  role: roleEnum('role').notNull(),
  grantedAt: timestamp('grantedAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.role] }),
]);

export const accountPermissions = mysqlTable('AccountPermission', {
  accountId: int('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  key: varchar('key', { length: 191 }).notNull(),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.key] }),
]);

export const accountScopeDepartments = mysqlTable('AccountScopeDepartment', {
  accountId: int('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  departmentId: int('departmentId').notNull().references(() => departments.id),
}, (table) => [
  primaryKey({ columns: [table.accountId, table.departmentId] }),
]);

export const supervisorAssignments = mysqlTable('SupervisorAssignment', {
  id: int('id').autoincrement().primaryKey(),
  accountId: int('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  departmentId: int('departmentId').references(() => departments.id),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('SupervisorAssignment_accountId_departmentId_key').on(table.accountId, table.departmentId),
]);

// ===== 4. COMPETENCY FRAMEWORK =====

export const competencyCategories = mysqlTable('CompetencyCategory', {
  id: int('id').autoincrement().primaryKey(),
  name: varchar('name', { length: 191 }).notNull(),
  group: varchar('group', { length: 191 }).notNull(),
}, (table) => [
  uniqueIndex('CompetencyCategory_name_group_key').on(table.name, table.group),
]);

export const competencies = mysqlTable('Competency', {
  id: int('id').autoincrement().primaryKey(),
  code: varchar('code', { length: 191 }).notNull().unique(),
  name: varchar('name', { length: 191 }).notNull(),
  short: varchar('short', { length: 191 }).notNull(),
  categoryId: int('categoryId').notNull().references(() => competencyCategories.id),
  departmentId: int('departmentId').references(() => departments.id),
  importance: int('importance').default(4).notNull(),
  requiredLevel: decimal('requiredLevel', { precision: 4, scale: 2 }).default('5.00').notNull(),
  skillAreas: json('skillAreas'),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

// ===== 5. ASSESSMENTS & VERSIONS =====

export const assessments = mysqlTable('Assessment', {
  id: int('id').autoincrement().primaryKey(),
  title: varchar('title', { length: 191 }).notNull(),
  description: text('description'),
  instructions: text('instructions'),
  createdById: int('createdById').notNull().references(() => accounts.id),
  departmentId: int('departmentId').references(() => departments.id),
  skillType: skillTypeEnum('skillType').default('TECHNICAL').notNull(),
  jobLevel: varchar('jobLevel', { length: 100 }),
  status: assessmentStatusEnum('status').default('DRAFT').notNull(),
  maxAttempts: int('maxAttempts').default(3),
  resultRelease: resultReleaseEnum('resultRelease').default('IMMEDIATE').notNull(),
  resultsReleasedAt: timestamp('resultsReleasedAt', { fsp: 3 }),
  sourceRef: varchar('sourceRef', { length: 191 }).unique(),
  plannedAssignment: json('plannedAssignment'),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index('Assessment_departmentId_idx').on(table.departmentId),
]);

export const assessmentVersions = mysqlTable('AssessmentVersion', {
  id: int('id').autoincrement().primaryKey(),
  assessmentId: int('assessmentId').notNull().references(() => assessments.id),
  versionNo: int('versionNo').notNull(),
  status: assessmentStatusEnum('status').default('DRAFT').notNull(),
  scoringConfigId: int('scoringConfigId').references(() => scoringConfigs.id),
  submittedAt: timestamp('submittedAt', { fsp: 3 }),
  approvedById: int('approvedById'),
  approvedAt: timestamp('approvedAt', { fsp: 3 }),
  publishedById: int('publishedById'),
  publishedAt: timestamp('publishedAt', { fsp: 3 }),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('AssessmentVersion_assessmentId_versionNo_key').on(table.assessmentId, table.versionNo),
]);

export const assessmentReviewEvents = mysqlTable('AssessmentReviewEvent', {
  id: int('id').autoincrement().primaryKey(),
  versionId: int('versionId').notNull().references(() => assessmentVersions.id),
  actorId: int('actorId').notNull().references(() => accounts.id),
  action: varchar('action', { length: 191 }).notNull(),
  feedback: text('feedback'),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  index('AssessmentReviewEvent_versionId_at_idx').on(table.versionId, table.at),
]);

// ===== 6. QUESTIONS =====

export const questions = mysqlTable('Question', {
  id: int('id').autoincrement().primaryKey(),
  versionId: int('versionId').notNull().references(() => assessmentVersions.id, { onDelete: 'cascade' }),
  order: int('order').notNull(),
  type: questionTypeEnum('type').default('SINGLE_CHOICE').notNull(),
  text: text('text').notNull(),
  skillArea: varchar('skillArea', { length: 191 }),
  points: decimal('points', { precision: 6, scale: 2 }).default('1.00').notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('Question_versionId_order_key').on(table.versionId, table.order),
]);

export const answerOptions = mysqlTable('AnswerOption', {
  id: int('id').autoincrement().primaryKey(),
  questionId: int('questionId').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  order: int('order').notNull(),
  text: text('text').notNull(),
  isCorrect: boolean('isCorrect').default(false).notNull(),
}, (table) => [
  uniqueIndex('AnswerOption_questionId_order_key').on(table.questionId, table.order),
]);

export const questionCompetencies = mysqlTable('QuestionCompetency', {
  questionId: int('questionId').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  competencyId: int('competencyId').notNull().references(() => competencies.id),
  weight: decimal('weight', { precision: 6, scale: 2 }).default('1.00').notNull(),
}, (table) => [
  primaryKey({ columns: [table.questionId, table.competencyId] }),
]);

// ===== 7. ASSIGNMENTS & DEADLINES =====

export const assessmentAssignments = mysqlTable('AssessmentAssignment', {
  id: int('id').autoincrement().primaryKey(),
  assessmentId: int('assessmentId').notNull().references(() => assessments.id),
  targetType: assignmentTargetEnum('targetType').notNull(),
  staffId: int('staffId').references(() => staffRecords.id),
  departmentId: int('departmentId').references(() => departments.id),
  gradeId: int('gradeId').references(() => grades.id),
  stationId: int('stationId').references(() => stations.id),
  locationId: int('locationId').references(() => locations.id),
  startsAt: timestamp('startsAt', { fsp: 3 }).notNull(),
  deadline: timestamp('deadline', { fsp: 3 }).notNull(),
  maxAttempts: int('maxAttempts'),
  createdById: int('createdById').notNull().references(() => accounts.id),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  index('AssessmentAssignment_assessmentId_idx').on(table.assessmentId),
]);

export const deadlineExtensions = mysqlTable('DeadlineExtension', {
  id: int('id').autoincrement().primaryKey(),
  assignmentId: int('assignmentId').notNull().references(() => assessmentAssignments.id),
  staffId: int('staffId').references(() => staffRecords.id),
  originalDeadline: timestamp('originalDeadline', { fsp: 3 }).notNull(),
  newDeadline: timestamp('newDeadline', { fsp: 3 }).notNull(),
  reason: text('reason').notNull(),
  approvedById: int('approvedById').notNull().references(() => accounts.id),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  index('DeadlineExtension_assignmentId_staffId_idx').on(table.assignmentId, table.staffId),
]);

// ===== 8. ATTEMPTS & RESPONSES =====

export const attempts = mysqlTable('Attempt', {
  id: int('id').autoincrement().primaryKey(),
  assessmentId: int('assessmentId').notNull().references(() => assessments.id),
  versionId: int('versionId').notNull().references(() => assessmentVersions.id),
  staffId: int('staffId').notNull().references(() => staffRecords.id),
  accountId: int('accountId').notNull().references(() => accounts.id),
  attemptNo: int('attemptNo').notNull(),
  status: attemptStatusEnum('status').default('IN_PROGRESS').notNull(),
  startedAt: timestamp('startedAt', { fsp: 3 }).defaultNow().notNull(),
  submittedAt: timestamp('submittedAt', { fsp: 3 }),
  completedAt: timestamp('completedAt', { fsp: 3 }),
  activeSeconds: int('activeSeconds').default(0).notNull(),
  elapsedSeconds: int('elapsedSeconds').default(0).notNull(),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  uniqueIndex('Attempt_staffId_assessmentId_attemptNo_key').on(table.staffId, table.assessmentId, table.attemptNo),
  index('Attempt_staffId_assessmentId_status_idx').on(table.staffId, table.assessmentId, table.status),
]);

export const attemptResponses = mysqlTable('AttemptResponse', {
  id: int('id').autoincrement().primaryKey(),
  attemptId: int('attemptId').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  questionId: int('questionId').notNull().references(() => questions.id),
  optionId: int('optionId').references(() => answerOptions.id),
  textAnswer: text('textAnswer'),
  isCorrect: boolean('isCorrect'),
  activeSeconds: int('activeSeconds').default(0).notNull(),
  savedAt: timestamp('savedAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex('AttemptResponse_attemptId_questionId_key').on(table.attemptId, table.questionId),
]);

export const activeTimeSegments = mysqlTable('ActiveTimeSegment', {
  id: int('id').autoincrement().primaryKey(),
  attemptId: int('attemptId').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  questionId: int('questionId'),
  tabId: varchar('tabId', { length: 191 }).notNull(),
  startedAt: timestamp('startedAt', { fsp: 3 }).notNull(),
  endedAt: timestamp('endedAt', { fsp: 3 }).notNull(),
  seconds: int('seconds').notNull(),
}, (table) => [
  index('ActiveTimeSegment_attemptId_idx').on(table.attemptId),
]);

// ===== 9. RESULTS =====

export const competencyAttemptResults = mysqlTable('CompetencyAttemptResult', {
  attemptId: int('attemptId').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  competencyId: int('competencyId').notNull().references(() => competencies.id),
  score: decimal('score', { precision: 8, scale: 6 }).notNull(),
  asked: int('asked').notNull(),
  correct: int('correct').notNull(),
}, (table) => [
  primaryKey({ columns: [table.attemptId, table.competencyId] }),
]);

export const finalCompetencyResults = mysqlTable('FinalCompetencyResult', {
  staffId: int('staffId').notNull().references(() => staffRecords.id),
  assessmentId: int('assessmentId').notNull().references(() => assessments.id),
  competencyId: int('competencyId').notNull().references(() => competencies.id),
  average: decimal('average', { precision: 8, scale: 6 }).notNull(),
  attemptsIncluded: int('attemptsIncluded').notNull(),
  competencyStatus: varchar('competencyStatus', { length: 191 }).notNull(),
  gapStatus: varchar('gapStatus', { length: 191 }).notNull(),
  scoringConfigId: int('scoringConfigId').notNull().references(() => scoringConfigs.id),
  computedAt: timestamp('computedAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  primaryKey({ columns: [table.staffId, table.assessmentId, table.competencyId] }),
]);

// ===== 10. SCORING CONFIGURATION =====

export const scoringConfigs = mysqlTable('ScoringConfig', {
  id: int('id').autoincrement().primaryKey(),
  version: int('version').unique().notNull(),
  requiredLevel: decimal('requiredLevel', { precision: 4, scale: 2 }).default('5.00').notNull(),
  competentFrom: decimal('competentFrom', { precision: 4, scale: 2 }).default('4.00').notNull(),
  proficientFrom: decimal('proficientFrom', { precision: 4, scale: 2 }).default('5.00').notNull(),
  moderateGapFrom: decimal('moderateGapFrom', { precision: 4, scale: 2 }).default('2.50').notNull(),
  noGapFrom: decimal('noGapFrom', { precision: 4, scale: 2 }).default('5.00').notNull(),
  defaultMaxAttempts: int('defaultMaxAttempts').default(3).notNull(),
  reason: varchar('reason', { length: 255 }).notNull(),
  createdById: int('createdById').references(() => accounts.id),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  active: boolean('active').default(true).notNull(),
});

// ===== 11. NOTIFICATIONS =====

export const notificationTemplates = mysqlTable('NotificationTemplate', {
  key: varchar('key', { length: 191 }).primaryKey(),
  title: varchar('title', { length: 191 }).notNull(),
  body: text('body').notNull(),
  channels: json('channels').$default(() => ['in_app']).notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

export const notifications = mysqlTable('Notification', {
  id: int('id').autoincrement().primaryKey(),
  accountId: int('accountId').notNull().references(() => accounts.id, { onDelete: 'cascade' }),
  type: varchar('type', { length: 191 }).notNull(),
  title: varchar('title', { length: 191 }).notNull(),
  body: text('body').notNull(),
  link: varchar('link', { length: 255 }),
  dedupeKey: varchar('dedupeKey', { length: 191 }).unique(),
  readAt: timestamp('readAt', { fsp: 3 }),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  index('Notification_accountId_readAt_idx').on(table.accountId, table.readAt),
]);

export const notificationDeliveries = mysqlTable('NotificationDelivery', {
  id: int('id').autoincrement().primaryKey(),
  notificationId: int('notificationId').notNull().references(() => notifications.id, { onDelete: 'cascade' }),
  channel: varchar('channel', { length: 191 }).notNull(),
  status: varchar('status', { length: 191 }).notNull(),
  error: text('error'),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
});

// ===== 12. SUPPORT TICKETS =====

export const tickets = mysqlTable('Ticket', {
  id: int('id').autoincrement().primaryKey(),
  reference: varchar('reference', { length: 191 }).notNull().unique(),
  requesterId: int('requesterId').notNull().references(() => accounts.id),
  assigneeId: int('assigneeId').references(() => accounts.id),
  title: varchar('title', { length: 191 }).notNull(),
  category: varchar('category', { length: 191 }).notNull(),
  description: text('description').notNull(),
  priority: ticketPriorityEnum('priority').default('MEDIUM').notNull(),
  status: ticketStatusEnum('status').default('OPEN').notNull(),
  assessmentId: int('assessmentId').references(() => assessments.id),
  createdAt: timestamp('createdAt', { fsp: 3 }).defaultNow().notNull(),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
}, (table) => [
  index('Ticket_status_priority_idx').on(table.status, table.priority),
  index('Ticket_assigneeId_idx').on(table.assigneeId),
]);

export const ticketMessages = mysqlTable('TicketMessage', {
  id: int('id').autoincrement().primaryKey(),
  ticketId: int('ticketId').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  authorId: int('authorId').notNull().references(() => accounts.id),
  body: text('body').notNull(),
  internal: boolean('internal').default(false).notNull(),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
});

export const ticketAttachments = mysqlTable('TicketAttachment', {
  id: int('id').autoincrement().primaryKey(),
  ticketId: int('ticketId').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  fileName: varchar('fileName', { length: 191 }).notNull(),
  mimeType: varchar('mimeType', { length: 191 }).notNull(),
  sizeBytes: int('sizeBytes').notNull(),
  storagePath: varchar('storagePath', { length: 255 }).notNull(),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
});

export const ticketEvents = mysqlTable('TicketEvent', {
  id: int('id').autoincrement().primaryKey(),
  ticketId: int('ticketId').notNull().references(() => tickets.id, { onDelete: 'cascade' }),
  actorId: int('actorId').notNull().references(() => accounts.id),
  field: varchar('field', { length: 191 }).notNull(),
  fromVal: varchar('fromVal', { length: 191 }),
  toVal: varchar('toVal', { length: 191 }),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
});

// ===== 13. AUDIT LOG & SYSTEM SETTINGS =====

export const auditLogs = mysqlTable('AuditLog', {
  id: bigint('id', { mode: 'number' }).autoincrement().primaryKey(),
  actorId: int('actorId').references(() => accounts.id),
  action: varchar('action', { length: 191 }).notNull(),
  entityType: varchar('entityType', { length: 191 }),
  entityId: varchar('entityId', { length: 191 }),
  outcome: varchar('outcome', { length: 191 }).default('SUCCESS').notNull(),
  before: json('before'),
  after: json('after'),
  ip: varchar('ip', { length: 191 }),
  at: timestamp('at', { fsp: 3 }).defaultNow().notNull(),
}, (table) => [
  index('AuditLog_at_idx').on(table.at),
  index('AuditLog_actorId_at_idx').on(table.actorId, table.at),
  index('AuditLog_entityType_entityId_idx').on(table.entityType, table.entityId),
]);

export const systemSettings = mysqlTable('SystemSetting', {
  key: varchar('key', { length: 191 }).primaryKey(),
  value: json('value').notNull(),
  updatedById: int('updatedById').references(() => accounts.id),
  updatedAt: timestamp('updatedAt', { fsp: 3 }).defaultNow().onUpdateNow().notNull(),
});

// ===== RELATIONS =====

export const departmentsRelations = relations(departments, ({ many }) => ({
  staff: many(staffRecords),
  competencies: many(competencies),
  assessments: many(assessments),
  scopeAccounts: many(accountScopeDepartments),
  supervisorLinks: many(supervisorAssignments),
  assignments: many(assessmentAssignments),
  locationHistory: many(staffPlacementHistories),
}));

export const gradesRelations = relations(grades, ({ many }) => ({
  staff: many(staffRecords),
  supervisoryMapping: many(gradeSupervisoryMappings),
  assignments: many(assessmentAssignments),
}));

export const locationsRelations = relations(locations, ({ many }) => ({
  stations: many(stations),
  assignments: many(assessmentAssignments),
}));

export const stationsRelations = relations(stations, ({ one, many }) => ({
  location: one(locations, { fields: [stations.locationId], references: [locations.id] }),
  staff: many(staffRecords),
  supervisoryMapping: many(gradeSupervisoryMappings),
  assignments: many(assessmentAssignments),
  placementHistory: many(staffPlacementHistories),
}));

export const gradeSupervisoryMappingsRelations = relations(gradeSupervisoryMappings, ({ one }) => ({
  grade: one(grades, { fields: [gradeSupervisoryMappings.gradeId], references: [grades.id] }),
  station: one(stations, { fields: [gradeSupervisoryMappings.stationId], references: [stations.id] }),
}));

export const staffRecordsRelations = relations(staffRecords, ({ one, many }) => ({
  department: one(departments, { fields: [staffRecords.departmentId], references: [departments.id] }),
  grade: one(grades, { fields: [staffRecords.gradeId], references: [grades.id] }),
  station: one(stations, { fields: [staffRecords.stationId], references: [stations.id] }),
  supervisor: one(staffRecords, { fields: [staffRecords.supervisorId], references: [staffRecords.id], relationName: 'Supervises' }),
  reports: many(staffRecords, { relationName: 'Supervises' }),
  accounts: many(accounts),
  placements: many(staffPlacementHistories),
  attempts: many(attempts),
  finalResults: many(finalCompetencyResults),
  assignments: many(assessmentAssignments),
  extensions: many(deadlineExtensions),
}));

export const staffPlacementHistoriesRelations = relations(staffPlacementHistories, ({ one }) => ({
  staff: one(staffRecords, { fields: [staffPlacementHistories.staffId], references: [staffRecords.id] }),
  department: one(departments, { fields: [staffPlacementHistories.departmentId], references: [departments.id] }),
  station: one(stations, { fields: [staffPlacementHistories.stationId], references: [stations.id] }),
  changedBy: one(accounts, { fields: [staffPlacementHistories.changedById], references: [accounts.id] }),
}));

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  staff: one(staffRecords, { fields: [accounts.staffId], references: [staffRecords.id] }),
  roles: many(accountRoles),
  permissions: many(accountPermissions),
  scopeDepartments: many(accountScopeDepartments),
  sessions: many(sessions),
  supervisorLinks: many(supervisorAssignments),
  createdAssessments: many(assessments, { relationName: 'AssessmentCreator' }),
  reviewEvents: many(assessmentReviewEvents),
  assignmentsMade: many(assessmentAssignments, { relationName: 'AssignedBy' }),
  extensionsApproved: many(deadlineExtensions),
  attempts: many(attempts),
  scoringConfigs: many(scoringConfigs),
  notifications: many(notifications),
  ticketsRaised: many(tickets, { relationName: 'TicketRequester' }),
  ticketsAssigned: many(tickets, { relationName: 'TicketAssignee' }),
  ticketMessages: many(ticketMessages),
  ticketEvents: many(ticketEvents),
  auditEntries: many(auditLogs),
  placementChanges: many(staffPlacementHistories),
  settingsChanged: many(systemSettings),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  account: one(accounts, { fields: [sessions.accountId], references: [accounts.id] }),
}));

export const accountRolesRelations = relations(accountRoles, ({ one }) => ({
  account: one(accounts, { fields: [accountRoles.accountId], references: [accounts.id] }),
}));

export const accountPermissionsRelations = relations(accountPermissions, ({ one }) => ({
  account: one(accounts, { fields: [accountPermissions.accountId], references: [accounts.id] }),
}));

export const accountScopeDepartmentsRelations = relations(accountScopeDepartments, ({ one }) => ({
  account: one(accounts, { fields: [accountScopeDepartments.accountId], references: [accounts.id] }),
  department: one(departments, { fields: [accountScopeDepartments.departmentId], references: [departments.id] }),
}));

export const supervisorAssignmentsRelations = relations(supervisorAssignments, ({ one }) => ({
  account: one(accounts, { fields: [supervisorAssignments.accountId], references: [accounts.id] }),
  department: one(departments, { fields: [supervisorAssignments.departmentId], references: [departments.id] }),
}));

export const competencyCategoriesRelations = relations(competencyCategories, ({ many }) => ({
  competencies: many(competencies),
}));

export const competenciesRelations = relations(competencies, ({ one, many }) => ({
  category: one(competencyCategories, { fields: [competencies.categoryId], references: [competencyCategories.id] }),
  department: one(departments, { fields: [competencies.departmentId], references: [departments.id] }),
  questions: many(questionCompetencies),
  attemptResults: many(competencyAttemptResults),
  finalResults: many(finalCompetencyResults),
}));

export const assessmentsRelations = relations(assessments, ({ one, many }) => ({
  createdBy: one(accounts, { fields: [assessments.createdById], references: [accounts.id], relationName: 'AssessmentCreator' }),
  department: one(departments, { fields: [assessments.departmentId], references: [departments.id] }),
  versions: many(assessmentVersions),
  assignments: many(assessmentAssignments),
  attempts: many(attempts),
  finalResults: many(finalCompetencyResults),
  tickets: many(tickets),
}));

export const assessmentVersionsRelations = relations(assessmentVersions, ({ one, many }) => ({
  assessment: one(assessments, { fields: [assessmentVersions.assessmentId], references: [assessments.id] }),
  scoringConfig: one(scoringConfigs, { fields: [assessmentVersions.scoringConfigId], references: [scoringConfigs.id] }),
  questions: many(questions),
  reviewEvents: many(assessmentReviewEvents),
  attempts: many(attempts),
}));

export const assessmentReviewEventsRelations = relations(assessmentReviewEvents, ({ one }) => ({
  version: one(assessmentVersions, { fields: [assessmentReviewEvents.versionId], references: [assessmentVersions.id] }),
  actor: one(accounts, { fields: [assessmentReviewEvents.actorId], references: [accounts.id] }),
}));

export const questionsRelations = relations(questions, ({ one, many }) => ({
  version: one(assessmentVersions, { fields: [questions.versionId], references: [assessmentVersions.id] }),
  options: many(answerOptions),
  competencies: many(questionCompetencies),
  responses: many(attemptResponses),
}));

export const answerOptionsRelations = relations(answerOptions, ({ one, many }) => ({
  question: one(questions, { fields: [answerOptions.questionId], references: [questions.id] }),
  responses: many(attemptResponses),
}));

export const questionCompetenciesRelations = relations(questionCompetencies, ({ one }) => ({
  question: one(questions, { fields: [questionCompetencies.questionId], references: [questions.id] }),
  competency: one(competencies, { fields: [questionCompetencies.competencyId], references: [competencies.id] }),
}));

export const assessmentAssignmentsRelations = relations(assessmentAssignments, ({ one, many }) => ({
  assessment: one(assessments, { fields: [assessmentAssignments.assessmentId], references: [assessments.id] }),
  staff: one(staffRecords, { fields: [assessmentAssignments.staffId], references: [staffRecords.id] }),
  department: one(departments, { fields: [assessmentAssignments.departmentId], references: [departments.id] }),
  grade: one(grades, { fields: [assessmentAssignments.gradeId], references: [grades.id] }),
  station: one(stations, { fields: [assessmentAssignments.stationId], references: [stations.id] }),
  location: one(locations, { fields: [assessmentAssignments.locationId], references: [locations.id] }),
  createdBy: one(accounts, { fields: [assessmentAssignments.createdById], references: [accounts.id], relationName: 'AssignedBy' }),
  extensions: many(deadlineExtensions),
}));

export const deadlineExtensionsRelations = relations(deadlineExtensions, ({ one }) => ({
  assignment: one(assessmentAssignments, { fields: [deadlineExtensions.assignmentId], references: [assessmentAssignments.id] }),
  staff: one(staffRecords, { fields: [deadlineExtensions.staffId], references: [staffRecords.id] }),
  approvedBy: one(accounts, { fields: [deadlineExtensions.approvedById], references: [accounts.id] }),
}));

export const attemptsRelations = relations(attempts, ({ one, many }) => ({
  assessment: one(assessments, { fields: [attempts.assessmentId], references: [assessments.id] }),
  version: one(assessmentVersions, { fields: [attempts.versionId], references: [assessmentVersions.id] }),
  staff: one(staffRecords, { fields: [attempts.staffId], references: [staffRecords.id] }),
  account: one(accounts, { fields: [attempts.accountId], references: [accounts.id] }),
  responses: many(attemptResponses),
  results: many(competencyAttemptResults),
  timeLog: many(activeTimeSegments),
}));

export const attemptResponsesRelations = relations(attemptResponses, ({ one }) => ({
  attempt: one(attempts, { fields: [attemptResponses.attemptId], references: [attempts.id] }),
  question: one(questions, { fields: [attemptResponses.questionId], references: [questions.id] }),
  option: one(answerOptions, { fields: [attemptResponses.optionId], references: [answerOptions.id] }),
}));

export const activeTimeSegmentsRelations = relations(activeTimeSegments, ({ one }) => ({
  attempt: one(attempts, { fields: [activeTimeSegments.attemptId], references: [attempts.id] }),
}));

export const competencyAttemptResultsRelations = relations(competencyAttemptResults, ({ one }) => ({
  attempt: one(attempts, { fields: [competencyAttemptResults.attemptId], references: [attempts.id] }),
  competency: one(competencies, { fields: [competencyAttemptResults.competencyId], references: [competencies.id] }),
}));

export const finalCompetencyResultsRelations = relations(finalCompetencyResults, ({ one }) => ({
  staff: one(staffRecords, { fields: [finalCompetencyResults.staffId], references: [staffRecords.id] }),
  assessment: one(assessments, { fields: [finalCompetencyResults.assessmentId], references: [assessments.id] }),
  competency: one(competencies, { fields: [finalCompetencyResults.competencyId], references: [competencies.id] }),
  scoringConfig: one(scoringConfigs, { fields: [finalCompetencyResults.scoringConfigId], references: [scoringConfigs.id] }),
}));

export const scoringConfigsRelations = relations(scoringConfigs, ({ one, many }) => ({
  createdBy: one(accounts, { fields: [scoringConfigs.createdById], references: [accounts.id] }),
  versions: many(assessmentVersions),
  finalResults: many(finalCompetencyResults),
}));

export const notificationsRelations = relations(notifications, ({ one, many }) => ({
  account: one(accounts, { fields: [notifications.accountId], references: [accounts.id] }),
  deliveries: many(notificationDeliveries),
}));

export const notificationDeliveriesRelations = relations(notificationDeliveries, ({ one }) => ({
  notification: one(notifications, { fields: [notificationDeliveries.notificationId], references: [notifications.id] }),
}));

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  requester: one(accounts, { fields: [tickets.requesterId], references: [accounts.id], relationName: 'TicketRequester' }),
  assignee: one(accounts, { fields: [tickets.assigneeId], references: [accounts.id], relationName: 'TicketAssignee' }),
  assessment: one(assessments, { fields: [tickets.assessmentId], references: [assessments.id] }),
  messages: many(ticketMessages),
  attachments: many(ticketAttachments),
  events: many(ticketEvents),
}));

export const ticketMessagesRelations = relations(ticketMessages, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketMessages.ticketId], references: [tickets.id] }),
  author: one(accounts, { fields: [ticketMessages.authorId], references: [accounts.id] }),
}));

export const ticketAttachmentsRelations = relations(ticketAttachments, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketAttachments.ticketId], references: [tickets.id] }),
}));

export const ticketEventsRelations = relations(ticketEvents, ({ one }) => ({
  ticket: one(tickets, { fields: [ticketEvents.ticketId], references: [tickets.id] }),
  actor: one(accounts, { fields: [ticketEvents.actorId], references: [accounts.id] }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(accounts, { fields: [auditLogs.actorId], references: [accounts.id] }),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updatedBy: one(accounts, { fields: [systemSettings.updatedById], references: [accounts.id] }),
}));
