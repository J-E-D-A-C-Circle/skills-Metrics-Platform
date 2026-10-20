import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import { JOB_LEVELS, BANKS, RBDI_FRAMEWORK, HR_FRAMEWORK } from '../components/dvlaBanks.js';
import { ROLE_PERMS } from '../components/smAccess.js';

// Password hash for 'Password123!'
const HASH = 'scrypt$32768$8$1$FcO6pcNPFgyj87mbN4shYQ==$32hJ0OEFIihATbvRA2fdG/yzBvm8NgxJGm63z9KNnMAjjASw7So/qXfmhPQxPO+ecVBUzqyjjkp2fyiOx5OTDw==';

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''") + "'";
}

function escapeJson(obj) {
  if (!obj) return 'NULL';
  return escapeSql(JSON.stringify(obj)) + '::jsonb';
}

function main() {
  console.log('Building complete schema.sql with real HR & RBDI staff list and question banks...');

  const sql = [];

  sql.push(`-- =============================================================================
-- schema.sql · Skill Matrix & Assessment Platform (PostgreSQL 16)
-- Complete standalone schema definition, constraints, triggers, baseline data,
-- all 17 official HR & RBDI staff accounts, and full question banks + assignments.
--
-- How to apply on your server:
--   psql -h <host> -p 5432 -U <user> -d <database> -f schema.sql
--
-- Or via Docker:
--   Automatically mounted to /docker-entrypoint-initdb.d/01-schema.sql
-- =============================================================================

BEGIN;

-- =============================================================================
-- 1. CUSTOM ENUMS
-- =============================================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffStatus') THEN
    CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LEFT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccountStatus') THEN
    CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'MUST_CHANGE_PASSWORD', 'SUSPENDED', 'DISABLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'Role') THEN
    CREATE TYPE "Role" AS ENUM ('STAFF', 'SUPERVISOR', 'CREATOR', 'ADMIN', 'TICKET_RESOLVER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeptScope') THEN
    CREATE TYPE "DeptScope" AS ENUM ('ALL', 'OWN', 'SELECTED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssessmentStatus') THEN
    CREATE TYPE "AssessmentStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RETURNED', 'REJECTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ResultRelease') THEN
    CREATE TYPE "ResultRelease" AS ENUM ('IMMEDIATE', 'AFTER_DEADLINE', 'MANUAL');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'QuestionType') THEN
    CREATE TYPE "QuestionType" AS ENUM ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AssignmentTarget') THEN
    CREATE TYPE "AssignmentTarget" AS ENUM ('INDIVIDUAL', 'DEPARTMENT', 'GRADE', 'STATION', 'LOCATION');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AttemptStatus') THEN
    CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'SUBMITTED', 'PENDING_MARKING', 'COMPLETED', 'ABANDONED', 'EXPIRED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketStatus') THEN
    CREATE TYPE "TicketStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TicketPriority') THEN
    CREATE TYPE "TicketPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
  END IF;
END $$;

-- =============================================================================
-- 2. TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS "Department" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Grade" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Location" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Station" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "locationId" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Station_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GradeSupervisoryMapping" (
    "id" SERIAL NOT NULL,
    "gradeId" INTEGER NOT NULL,
    "stationId" INTEGER,
    "roleLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GradeSupervisoryMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffRecord" (
    "id" SERIAL NOT NULL,
    "staffNo" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "otherNames" TEXT,
    "email" TEXT,
    "designation" TEXT,
    "departmentId" INTEGER,
    "gradeId" INTEGER,
    "stationId" INTEGER,
    "supervisorId" INTEGER,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StaffRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StaffPlacementHistory" (
    "id" SERIAL NOT NULL,
    "staffId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "stationId" INTEGER,
    "fromDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "toDate" TIMESTAMP(3),
    "reason" TEXT,
    "changedById" INTEGER,
    CONSTRAINT "StaffPlacementHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Account" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'MUST_CHANGE_PASSWORD',
    "staffId" INTEGER,
    "deptScope" "DeptScope" NOT NULL DEFAULT 'OWN',
    "lastLoginAt" TIMESTAMP(3),
    "passwordSetAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "accountId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,
    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LoginAttempt" (
    "id" SERIAL NOT NULL,
    "identifier" TEXT NOT NULL,
    "ip" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AccountRole" (
    "accountId" INTEGER NOT NULL,
    "role" "Role" NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AccountRole_pkey" PRIMARY KEY ("accountId","role")
);

CREATE TABLE IF NOT EXISTS "AccountPermission" (
    "accountId" INTEGER NOT NULL,
    "key" TEXT NOT NULL,
    CONSTRAINT "AccountPermission_pkey" PRIMARY KEY ("accountId","key")
);

CREATE TABLE IF NOT EXISTS "AccountScopeDepartment" (
    "accountId" INTEGER NOT NULL,
    "departmentId" INTEGER NOT NULL,
    CONSTRAINT "AccountScopeDepartment_pkey" PRIMARY KEY ("accountId","departmentId")
);

CREATE TABLE IF NOT EXISTS "SupervisorAssignment" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupervisorAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompetencyCategory" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "group" TEXT NOT NULL,
    CONSTRAINT "CompetencyCategory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Competency" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "departmentId" INTEGER,
    "importance" INTEGER NOT NULL DEFAULT 4,
    "requiredLevel" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "skillAreas" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Competency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Assessment" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "instructions" TEXT,
    "createdById" INTEGER NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "resultRelease" "ResultRelease" NOT NULL DEFAULT 'IMMEDIATE',
    "resultsReleasedAt" TIMESTAMP(3),
    "sourceRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentVersion" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "versionNo" INTEGER NOT NULL,
    "status" "AssessmentStatus" NOT NULL DEFAULT 'DRAFT',
    "scoringConfigId" INTEGER,
    "submittedAt" TIMESTAMP(3),
    "approvedById" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "publishedById" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AssessmentReviewEvent" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "feedback" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentReviewEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Question" (
    "id" SERIAL NOT NULL,
    "versionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL DEFAULT 'SINGLE_CHOICE',
    "text" TEXT NOT NULL,
    "skillArea" TEXT,
    "points" DECIMAL(6,2) NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AnswerOption" (
    "id" SERIAL NOT NULL,
    "questionId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "AnswerOption_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "QuestionCompetency" (
    "questionId" INTEGER NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "weight" DECIMAL(6,2) NOT NULL DEFAULT 1,
    CONSTRAINT "QuestionCompetency_pkey" PRIMARY KEY ("questionId","competencyId")
);

CREATE TABLE IF NOT EXISTS "AssessmentAssignment" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "targetType" "AssignmentTarget" NOT NULL,
    "staffId" INTEGER,
    "departmentId" INTEGER,
    "gradeId" INTEGER,
    "stationId" INTEGER,
    "locationId" INTEGER,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "maxAttempts" INTEGER,
    "createdById" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssessmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "DeadlineExtension" (
    "id" SERIAL NOT NULL,
    "assignmentId" INTEGER NOT NULL,
    "staffId" INTEGER,
    "originalDeadline" TIMESTAMP(3) NOT NULL,
    "newDeadline" TIMESTAMP(3) NOT NULL,
    "reason" TEXT NOT NULL,
    "approvedById" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeadlineExtension_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Attempt" (
    "id" SERIAL NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "versionId" INTEGER NOT NULL,
    "staffId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "attemptNo" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "elapsedSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttemptResponse" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER NOT NULL,
    "optionId" INTEGER,
    "textAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "activeSeconds" INTEGER NOT NULL DEFAULT 0,
    "savedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AttemptResponse_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActiveTimeSegment" (
    "id" SERIAL NOT NULL,
    "attemptId" INTEGER NOT NULL,
    "questionId" INTEGER,
    "tabId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3) NOT NULL,
    "seconds" INTEGER NOT NULL,
    CONSTRAINT "ActiveTimeSegment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompetencyAttemptResult" (
    "attemptId" INTEGER NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "score" DECIMAL(8,6) NOT NULL,
    "asked" INTEGER NOT NULL,
    "correct" INTEGER NOT NULL,
    CONSTRAINT "CompetencyAttemptResult_pkey" PRIMARY KEY ("attemptId","competencyId")
);

CREATE TABLE IF NOT EXISTS "FinalCompetencyResult" (
    "staffId" INTEGER NOT NULL,
    "assessmentId" INTEGER NOT NULL,
    "competencyId" INTEGER NOT NULL,
    "average" DECIMAL(8,6) NOT NULL,
    "attemptsIncluded" INTEGER NOT NULL,
    "competencyStatus" TEXT NOT NULL,
    "gapStatus" TEXT NOT NULL,
    "scoringConfigId" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FinalCompetencyResult_pkey" PRIMARY KEY ("staffId","assessmentId","competencyId")
);

CREATE TABLE IF NOT EXISTS "ScoringConfig" (
    "id" SERIAL NOT NULL,
    "version" INTEGER NOT NULL,
    "requiredLevel" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "competentFrom" DECIMAL(4,2) NOT NULL DEFAULT 4,
    "proficientFrom" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "moderateGapFrom" DECIMAL(4,2) NOT NULL DEFAULT 2.5,
    "noGapFrom" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "defaultMaxAttempts" INTEGER NOT NULL DEFAULT 3,
    "reason" TEXT NOT NULL,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "ScoringConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationTemplate" (
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "channels" TEXT[] DEFAULT ARRAY['in_app']::TEXT[],
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("key")
);

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupeKey" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "NotificationDelivery" (
    "id" SERIAL NOT NULL,
    "notificationId" INTEGER NOT NULL,
    "channel" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "error" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Ticket" (
    "id" SERIAL NOT NULL,
    "reference" TEXT NOT NULL,
    "requesterId" INTEGER NOT NULL,
    "assigneeId" INTEGER,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priority" "TicketPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "TicketStatus" NOT NULL DEFAULT 'OPEN',
    "assessmentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TicketMessage" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "internal" BOOLEAN NOT NULL DEFAULT false,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketMessage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TicketAttachment" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storagePath" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketAttachment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TicketEvent" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "field" TEXT NOT NULL,
    "fromVal" TEXT,
    "toVal" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TicketEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" BIGSERIAL NOT NULL,
    "actorId" INTEGER,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- =============================================================================
-- 3. INDEXES & UNIQUE CONSTRAINTS
-- =============================================================================
CREATE UNIQUE INDEX IF NOT EXISTS "Department_code_key" ON "Department"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Department_name_key" ON "Department"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Grade_name_key" ON "Grade"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Grade_rank_key" ON "Grade"("rank");
CREATE UNIQUE INDEX IF NOT EXISTS "Location_name_key" ON "Location"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "Station_locationId_name_key" ON "Station"("locationId", "name");
CREATE UNIQUE INDEX IF NOT EXISTS "GradeSupervisoryMapping_gradeId_stationId_roleLabel_key" ON "GradeSupervisoryMapping"("gradeId", "stationId", "roleLabel");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffRecord_staffNo_key" ON "StaffRecord"("staffNo");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffRecord_email_key" ON "StaffRecord"("email");
CREATE INDEX IF NOT EXISTS "StaffRecord_departmentId_idx" ON "StaffRecord"("departmentId");
CREATE INDEX IF NOT EXISTS "StaffRecord_gradeId_idx" ON "StaffRecord"("gradeId");
CREATE INDEX IF NOT EXISTS "StaffRecord_stationId_idx" ON "StaffRecord"("stationId");
CREATE INDEX IF NOT EXISTS "StaffPlacementHistory_staffId_fromDate_idx" ON "StaffPlacementHistory"("staffId", "fromDate");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_username_key" ON "Account"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "Account_email_key" ON "Account"("email");
CREATE INDEX IF NOT EXISTS "Account_staffId_idx" ON "Account"("staffId");
CREATE UNIQUE INDEX IF NOT EXISTS "Session_tokenHash_key" ON "Session"("tokenHash");
CREATE INDEX IF NOT EXISTS "Session_accountId_idx" ON "Session"("accountId");
CREATE INDEX IF NOT EXISTS "LoginAttempt_identifier_at_idx" ON "LoginAttempt"("identifier", "at");
CREATE INDEX IF NOT EXISTS "LoginAttempt_ip_at_idx" ON "LoginAttempt"("ip", "at");
CREATE UNIQUE INDEX IF NOT EXISTS "SupervisorAssignment_accountId_departmentId_key" ON "SupervisorAssignment"("accountId", "departmentId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompetencyCategory_name_group_key" ON "CompetencyCategory"("name", "group");
CREATE UNIQUE INDEX IF NOT EXISTS "Competency_code_key" ON "Competency"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Assessment_sourceRef_key" ON "Assessment"("sourceRef");
CREATE UNIQUE INDEX IF NOT EXISTS "AssessmentVersion_assessmentId_versionNo_key" ON "AssessmentVersion"("assessmentId", "versionNo");
CREATE INDEX IF NOT EXISTS "AssessmentReviewEvent_versionId_at_idx" ON "AssessmentReviewEvent"("versionId", "at");
CREATE UNIQUE INDEX IF NOT EXISTS "Question_versionId_order_key" ON "Question"("versionId", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "AnswerOption_questionId_order_key" ON "AnswerOption"("questionId", "order");
CREATE INDEX IF NOT EXISTS "AssessmentAssignment_assessmentId_idx" ON "AssessmentAssignment"("assessmentId");
CREATE INDEX IF NOT EXISTS "DeadlineExtension_assignmentId_staffId_idx" ON "DeadlineExtension"("assignmentId", "staffId");
CREATE INDEX IF NOT EXISTS "Attempt_staffId_assessmentId_status_idx" ON "Attempt"("staffId", "assessmentId", "status");
CREATE UNIQUE INDEX IF NOT EXISTS "Attempt_staffId_assessmentId_attemptNo_key" ON "Attempt"("staffId", "assessmentId", "attemptNo");
CREATE UNIQUE INDEX IF NOT EXISTS "AttemptResponse_attemptId_questionId_key" ON "AttemptResponse"("attemptId", "questionId");
CREATE INDEX IF NOT EXISTS "ActiveTimeSegment_attemptId_idx" ON "ActiveTimeSegment"("attemptId");
CREATE UNIQUE INDEX IF NOT EXISTS "ScoringConfig_version_key" ON "ScoringConfig"("version");
CREATE UNIQUE INDEX IF NOT EXISTS "Notification_dedupeKey_key" ON "Notification"("dedupeKey");
CREATE INDEX IF NOT EXISTS "Notification_accountId_readAt_idx" ON "Notification"("accountId", "readAt");
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_reference_key" ON "Ticket"("reference");
CREATE INDEX IF NOT EXISTS "Ticket_status_priority_idx" ON "Ticket"("status", "priority");
CREATE INDEX IF NOT EXISTS "Ticket_assigneeId_idx" ON "Ticket"("assigneeId");
CREATE INDEX IF NOT EXISTS "AuditLog_at_idx" ON "AuditLog"("at");
CREATE INDEX IF NOT EXISTS "AuditLog_actorId_at_idx" ON "AuditLog"("actorId", "at");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- =============================================================================
-- 4. FOREIGN KEY CONSTRAINTS
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE "Station" ADD CONSTRAINT "Station_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GradeSupervisoryMapping" ADD CONSTRAINT "GradeSupervisoryMapping_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "GradeSupervisoryMapping" ADD CONSTRAINT "GradeSupervisoryMapping_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffRecord" ADD CONSTRAINT "StaffRecord_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "StaffRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffPlacementHistory" ADD CONSTRAINT "StaffPlacementHistory_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffPlacementHistory" ADD CONSTRAINT "StaffPlacementHistory_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffPlacementHistory" ADD CONSTRAINT "StaffPlacementHistory_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StaffPlacementHistory" ADD CONSTRAINT "StaffPlacementHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Account" ADD CONSTRAINT "Account_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Session" ADD CONSTRAINT "Session_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AccountRole" ADD CONSTRAINT "AccountRole_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AccountPermission" ADD CONSTRAINT "AccountPermission_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AccountScopeDepartment" ADD CONSTRAINT "AccountScopeDepartment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AccountScopeDepartment" ADD CONSTRAINT "AccountScopeDepartment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupervisorAssignment" ADD CONSTRAINT "SupervisorAssignment_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SupervisorAssignment" ADD CONSTRAINT "SupervisorAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Competency" ADD CONSTRAINT "Competency_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "CompetencyCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Competency" ADD CONSTRAINT "Competency_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentVersion" ADD CONSTRAINT "AssessmentVersion_scoringConfigId_fkey" FOREIGN KEY ("scoringConfigId") REFERENCES "ScoringConfig"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentReviewEvent" ADD CONSTRAINT "AssessmentReviewEvent_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentReviewEvent" ADD CONSTRAINT "AssessmentReviewEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Question" ADD CONSTRAINT "Question_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AnswerOption" ADD CONSTRAINT "AnswerOption_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuestionCompetency" ADD CONSTRAINT "QuestionCompetency_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "QuestionCompetency" ADD CONSTRAINT "QuestionCompetency_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_stationId_fkey" FOREIGN KEY ("stationId") REFERENCES "Station"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AssessmentAssignment" ADD CONSTRAINT "AssessmentAssignment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeadlineExtension" ADD CONSTRAINT "DeadlineExtension_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "AssessmentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeadlineExtension" ADD CONSTRAINT "DeadlineExtension_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "DeadlineExtension" ADD CONSTRAINT "DeadlineExtension_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "AssessmentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AttemptResponse" ADD CONSTRAINT "AttemptResponse_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AttemptResponse" ADD CONSTRAINT "AttemptResponse_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AttemptResponse" ADD CONSTRAINT "AttemptResponse_optionId_fkey" FOREIGN KEY ("optionId") REFERENCES "AnswerOption"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ActiveTimeSegment" ADD CONSTRAINT "ActiveTimeSegment_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompetencyAttemptResult" ADD CONSTRAINT "CompetencyAttemptResult_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CompetencyAttemptResult" ADD CONSTRAINT "CompetencyAttemptResult_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinalCompetencyResult" ADD CONSTRAINT "FinalCompetencyResult_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffRecord"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinalCompetencyResult" ADD CONSTRAINT "FinalCompetencyResult_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinalCompetencyResult" ADD CONSTRAINT "FinalCompetencyResult_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "Competency"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinalCompetencyResult" ADD CONSTRAINT "FinalCompetencyResult_scoringConfigId_fkey" FOREIGN KEY ("scoringConfigId") REFERENCES "ScoringConfig"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ScoringConfig" ADD CONSTRAINT "ScoringConfig_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketMessage" ADD CONSTRAINT "TicketMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketAttachment" ADD CONSTRAINT "TicketAttachment_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TicketEvent" ADD CONSTRAINT "TicketEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SystemSetting" ADD CONSTRAINT "SystemSetting_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 5. AUDIT LOG TRIGGER (APPEND-ONLY ENFORCEMENT)
-- =============================================================================
CREATE OR REPLACE FUNCTION audit_log_is_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS audit_log_no_update_delete ON "AuditLog";
CREATE TRIGGER audit_log_no_update_delete
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION audit_log_is_append_only();

-- =============================================================================
-- 6. VALUE BOUNDARY CHECK CONSTRAINTS
-- =============================================================================
DO $$ BEGIN
  ALTER TABLE "CompetencyAttemptResult" ADD CONSTRAINT "competency_score_0_to_5" CHECK ("score" >= 0 AND "score" <= 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "FinalCompetencyResult" ADD CONSTRAINT "final_average_0_to_5" CHECK ("average" >= 0 AND "average" <= 5);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "Attempt" ADD CONSTRAINT "attempt_no_positive" CHECK ("attemptNo" >= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "ScoringConfig" ADD CONSTRAINT "scoring_thresholds_ordered" CHECK (
    "moderateGapFrom" > 0 AND 
    "moderateGapFrom" <= "noGapFrom" AND 
    "competentFrom" <= "proficientFrom" AND 
    "proficientFrom" <= "requiredLevel" AND 
    "noGapFrom" <= "requiredLevel"
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- =============================================================================
-- 7. PRISMA MIGRATION TRACKING
-- =============================================================================
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL PRIMARY KEY,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "applied_steps_count" INTEGER NOT NULL DEFAULT 1
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "logs", "rolled_back_at", "started_at", "applied_steps_count")
SELECT 
    '7f8b9e01-2026-4113-a000-000000000001',
    '01b2783620a854e0390903583dc4a14de093cf734a1cbbb7ab5d123c709f0975',
    CURRENT_TIMESTAMP,
    '20261019141133_init',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    1
WHERE NOT EXISTS (
    SELECT 1 FROM "_prisma_migrations" WHERE "migration_name" = '20261019141133_init'
);

-- =============================================================================
-- 8. BASELINE ORGANISATION & SCORING
-- =============================================================================

INSERT INTO "ScoringConfig" ("id", "version", "requiredLevel", "competentFrom", "proficientFrom", "moderateGapFrom", "noGapFrom", "defaultMaxAttempts", "reason", "active")
VALUES (1, 1, 5.00, 4.00, 5.00, 2.50, 5.00, 3, 'Defaults from the Skills Metrics specification', true)
ON CONFLICT ("version") DO NOTHING;

INSERT INTO "Department" ("id", "code", "name", "active", "updatedAt") VALUES
(1, 'IT', 'IT Department', true, CURRENT_TIMESTAMP),
(2, 'HR', 'Human Resources', true, CURRENT_TIMESTAMP),
(3, 'RBDI', 'Research, Business Development & Innovation', true, CURRENT_TIMESTAMP),
(4, 'CA', 'Corporate Affairs', true, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "Grade" ("id", "name", "rank", "active", "updatedAt") VALUES
(1, 'Assistant Officer', 0, true, CURRENT_TIMESTAMP),
(2, 'Officer & Senior Officer', 1, true, CURRENT_TIMESTAMP),
(3, 'Assistant Manager & Manager', 2, true, CURRENT_TIMESTAMP),
(4, 'Deputy Director & Director', 3, true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Location" ("id", "name", "region", "active", "updatedAt") VALUES
(1, 'Head Office, Accra', 'Greater Accra', true, CURRENT_TIMESTAMP),
(2, 'Accra (37) Office', 'Greater Accra', true, CURRENT_TIMESTAMP),
(3, 'Tema Office', 'Greater Accra', true, CURRENT_TIMESTAMP),
(4, 'Kumasi Office', 'Ashanti', true, CURRENT_TIMESTAMP),
(5, 'Takoradi Office', 'Western', true, CURRENT_TIMESTAMP),
(6, 'Tamale Office', 'Northern', true, CURRENT_TIMESTAMP),
(7, 'Ho Office', 'Volta', true, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

INSERT INTO "Station" ("id", "name", "locationId", "active", "updatedAt") VALUES
(1, 'Head Office, Accra', 1, true, CURRENT_TIMESTAMP),
(2, 'Accra (37) Office', 2, true, CURRENT_TIMESTAMP),
(3, 'Tema Office', 3, true, CURRENT_TIMESTAMP),
(4, 'Kumasi Office', 4, true, CURRENT_TIMESTAMP),
(5, 'Takoradi Office', 5, true, CURRENT_TIMESTAMP),
(6, 'Tamale Office', 6, true, CURRENT_TIMESTAMP),
(7, 'Ho Office', 7, true, CURRENT_TIMESTAMP)
ON CONFLICT ("locationId", "name") DO NOTHING;

-- Standard Notification Event Templates
INSERT INTO "NotificationTemplate" ("key", "title", "body", "channels", "updatedAt") VALUES
('assessment.assigned', 'New assessment: {title}', 'You have been assigned {title}. It opens {startsAt} and closes {deadline}.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('assessment.deadline.soon', '{title} closes soon', '{title} closes {deadline}. You have used {used} of {max} attempts.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('assessment.deadline.passed', '{title} has closed', 'The deadline for {title} has passed.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('assessment.extension', 'More time for {title}', 'The deadline for {title} has moved to {deadline}.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('assessment.completed', 'Attempt submitted: {title}', 'Your attempt {attemptNo} of {title} was submitted.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('results.released', 'Results ready: {title}', 'Your results for {title} are ready to view.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('content.approved', 'Approved: {title}', '{title} was approved by {reviewer}.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('content.rejected', 'Rejected: {title}', '{title} was rejected. Feedback: {feedback}', ARRAY['in_app'], CURRENT_TIMESTAMP),
('content.returned', 'Changes requested: {title}', '{title} was returned for revision. Feedback: {feedback}', ARRAY['in_app'], CURRENT_TIMESTAMP),
('content.submitted', 'Review needed: {title}', '{author} submitted version {versionNo} of {title} for review.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('content.published', 'Published: {title}', 'Version {versionNo} of {title} is now published and can be assigned.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('ticket.updated', 'Ticket {reference} updated', 'Your support ticket {reference} is now {status}.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('ticket.created', 'New support ticket {reference}', '{requester} raised {reference}: {title} ({priority} priority).', ARRAY['in_app'], CURRENT_TIMESTAMP),
('ticket.assigned', 'Ticket {reference} assigned to you', '{reference}: {title} ({priority} priority) is now assigned to you.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('ticket.activity', 'New reply on {reference}', '{actor} replied on {reference}: {title}.', ARRAY['in_app'], CURRENT_TIMESTAMP),
('account.changed', 'Your account was updated', '{change}', ARRAY['in_app'], CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;
`);

  // =============================================================================
  // 9. READ HR & RBDI STAFF LIST SPREADSHEET & CREATE ALL STAFF & ACCOUNTS
  // Password for all: Password123!
  // =============================================================================
  const excelPath = path.resolve('HR & RBDI STAFF LIST (1).xlsx');
  const wb = xlsx.readFile(excelPath);
  const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  function getGradeId(desig) {
    const d = desig.toUpperCase();
    if (d.includes('DIRECTOR')) return 4; // Deputy Director & Director (Rank 3)
    if (d.includes('MANAGER')) return 3;  // Assistant Manager & Manager (Rank 2)
    if (d.includes('OFFICER')) return 2;  // Officer & Senior Officer (Rank 1)
    return 1;                             // Assistant Officer (Rank 0)
  }

  function getRole(desig, name) {
    const d = desig.toUpperCase();
    if (d.includes('DIRECTOR') || d.includes('MANAGER HR') || d.includes('MANAGER RBDI')) return 'SUPERVISOR';
    if (d.includes('ASSISTANT MANAGER HR')) return 'CREATOR';
    return 'STAFF';
  }

  function getUsername(name) {
    const clean = name.trim().replace(/\s+/g, ' ');
    const parts = clean.split(' ');
    const first = parts[0].toLowerCase();
    const last = parts[parts.length - 1].toLowerCase();
    return (first + '.' + last).replace(/[^a-z0-9._-]/g, '');
  }

  function splitNames(fullName) {
    const parts = fullName.trim().replace(/\s+/g, ' ').split(' ');
    const firstName = parts[0];
    const lastName = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const otherNames = parts.length > 2 ? parts.slice(1, -1).join(' ') : null;
    return { firstName, lastName, otherNames };
  }

  // Build staff records
  const staffRecords = [
    {
      id: 1, staffNo: 'DVLA-ADM-001', firstName: 'System', lastName: 'Administrator', otherNames: null,
      email: 'admin@dvla.gov.gh', designation: 'Senior Systems Administrator', departmentId: 1, gradeId: 4, stationId: 1,
      username: 'admin', role: 'ADMIN', deptScope: 'ALL'
    },
    {
      id: 2, staffNo: 'DVLA-IT-001', firstName: 'Abena', lastName: 'Sarpong', otherNames: null,
      email: 'abena.sarpong@dvla.gov.gh', designation: 'Technical Support Specialist', departmentId: 1, gradeId: 2, stationId: 1,
      username: 'support.it', role: 'TICKET_RESOLVER', deptScope: 'OWN'
    }
  ];

  let nextId = 3;
  for (const r of rawRows) {
    const empId = String(r['Employee Id']).trim();
    const fullName = r['Employee Name'].trim();
    const { firstName, lastName, otherNames } = splitNames(fullName);
    const desig = r.Designation.trim();
    const isHR = r.Department.trim().toUpperCase().includes('HUMAN');
    const deptId = isHR ? 2 : 3;
    const gradeId = getGradeId(desig);
    const role = getRole(desig, fullName);
    const username = getUsername(fullName);
    const email = `${username}@dvla.gov.gh`;
    const isTamale = String(r['Location\t'] || r['Location'] || '').toUpperCase().includes('TAMALE');
    const stationId = isTamale ? 6 : 1; // 6 = Tamale Office, 1 = Head Office

    staffRecords.push({
      id: nextId++,
      staffNo: empId,
      firstName,
      lastName,
      otherNames,
      email,
      designation: desig,
      departmentId: deptId,
      gradeId,
      stationId,
      username,
      role,
      deptScope: 'OWN'
    });
  }

  sql.push(`
-- =============================================================================
-- 9. REAL HR & RBDI STAFF & ACCOUNTS (PASSWORD: Password123!)
-- Clears denzilasiam.adjei and loads all 17 official staff from HR & RBDI Staff List
-- =============================================================================

-- Clean out denzilasiam.adjei
DELETE FROM "Session" WHERE "accountId" IN (SELECT "id" FROM "Account" WHERE "username" = 'denzilasiam.adjei');
DELETE FROM "AccountRole" WHERE "accountId" IN (SELECT "id" FROM "Account" WHERE "username" = 'denzilasiam.adjei');
DELETE FROM "AccountPermission" WHERE "accountId" IN (SELECT "id" FROM "Account" WHERE "username" = 'denzilasiam.adjei');
DELETE FROM "Account" WHERE "username" = 'denzilasiam.adjei');
`);

  // Insert Staff Records
  sql.push(`INSERT INTO "StaffRecord" ("id", "staffNo", "firstName", "lastName", "otherNames", "email", "designation", "departmentId", "gradeId", "stationId", "status") VALUES`);
  const sRows = staffRecords.map(s =>
    `(${s.id}, ${escapeSql(s.staffNo)}, ${escapeSql(s.firstName)}, ${escapeSql(s.lastName)}, ${escapeSql(s.otherNames)}, ${escapeSql(s.email)}, ${escapeSql(s.designation)}, ${s.departmentId}, ${s.gradeId}, ${s.stationId}, 'ACTIVE')`
  );
  sql.push(sRows.join(',\n') + '\nON CONFLICT ("staffNo") DO UPDATE SET "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName", "designation" = EXCLUDED."designation";\n');

  // Insert Accounts
  sql.push(`INSERT INTO "Account" ("id", "username", "email", "displayName", "passwordHash", "status", "staffId", "deptScope") VALUES`);
  const aRows = staffRecords.map(s => {
    const dispName = s.otherNames ? `${s.firstName} ${s.otherNames} ${s.lastName}` : `${s.firstName} ${s.lastName}`;
    return `(${s.id}, ${escapeSql(s.username)}, ${escapeSql(s.email)}, ${escapeSql(dispName)}, '${HASH}', 'ACTIVE', ${s.id}, ${escapeSql(s.deptScope)})`;
  });
  sql.push(aRows.join(',\n') + '\nON CONFLICT ("username") DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", "status" = \'ACTIVE\';\n');

  // Insert Roles
  sql.push(`DELETE FROM "AccountRole" WHERE "accountId" BETWEEN 1 AND ${staffRecords.length};`);
  sql.push(`INSERT INTO "AccountRole" ("accountId", "role") VALUES`);
  const rRows = staffRecords.map(s => `(${s.id}, '${s.role}')`);
  sql.push(rRows.join(',\n') + '\nON CONFLICT ("accountId", "role") DO NOTHING;\n');

  // Insert Permissions
  sql.push(`DELETE FROM "AccountPermission" WHERE "accountId" BETWEEN 1 AND ${staffRecords.length};`);
  sql.push(`INSERT INTO "AccountPermission" ("accountId", "key") VALUES`);
  const pRows = [];
  for (const s of staffRecords) {
    let perms = ROLE_PERMS.Participant;
    if (s.role === 'ADMIN') perms = ROLE_PERMS.Administrator;
    else if (s.role === 'SUPERVISOR') perms = ROLE_PERMS['Manager / Supervisor'];
    else if (s.role === 'CREATOR') perms = ROLE_PERMS['Assessment Creator'];
    else if (s.role === 'TICKET_RESOLVER') perms = ROLE_PERMS['Ticket Resolver'];

    for (const p of perms) {
      pRows.push(`(${s.id}, ${escapeSql(p)})`);
    }
  }
  sql.push(pRows.join(',\n') + '\nON CONFLICT ("accountId", "key") DO NOTHING;\n');

  // Insert Supervisor Assignments for Department Heads / Managers
  sql.push(`DELETE FROM "SupervisorAssignment" WHERE "accountId" BETWEEN 1 AND ${staffRecords.length};`);
  sql.push(`INSERT INTO "SupervisorAssignment" ("accountId", "departmentId") VALUES`);
  const supRows = staffRecords.filter(s => s.role === 'SUPERVISOR').map(s => `(${s.id}, ${s.departmentId})`);
  sql.push(supRows.join(',\n') + '\nON CONFLICT ("accountId", "departmentId") DO NOTHING;\n');

  // =============================================================================
  // 10. COMPETENCY CATEGORIES & COMPETENCIES (RBDI & HR)
  // =============================================================================
  sql.push(`-- =============================================================================
-- 10. COMPETENCY CATEGORIES & COMPETENCIES (RBDI & HR)
-- =============================================================================
INSERT INTO "CompetencyCategory" ("id", "name", "group") VALUES
(1, 'Technical', 'RBDI Technical Competencies'),
(2, 'Technical', 'Talent Acquisition & Selection'),
(3, 'Technical', 'Learning & Development Management'),
(4, 'General', 'General Skills')
ON CONFLICT ("name", "group") DO NOTHING;
`);

  // Insert Competencies
  sql.push(`INSERT INTO "Competency" ("id", "code", "name", "short", "categoryId", "departmentId", "importance", "requiredLevel", "skillAreas", "active") VALUES`);
  const compRows = [];
  let compId = 1;
  const compCodeToId = {};

  for (const c of RBDI_FRAMEWORK) {
    compCodeToId[c.id] = compId;
    compRows.push(`(${compId}, ${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.short)}, 1, 3, 4, 5.00, ${escapeJson(c.areas)}, true)`);
    compId++;
  }

  for (const c of HR_FRAMEWORK) {
    const catId = c.group === 'Talent Acquisition & Selection' ? 2 : 3;
    compCodeToId[c.id] = compId;
    compRows.push(`(${compId}, ${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.short)}, ${catId}, 2, 4, 5.00, NULL, true)`);
    compId++;
  }
  sql.push(compRows.join(',\n') + `\nON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "skillAreas" = EXCLUDED."skillAreas";\n`);

  // =============================================================================
  // 11. ASSESSMENTS & QUESTIONS (RBDI & HR BANKS)
  // =============================================================================
  sql.push(`-- =============================================================================
-- 11. ASSESSMENTS, VERSIONS, QUESTIONS, ANSWER OPTIONS & QUESTION-COMPETENCIES
-- Full verbatim questions, answers and keys from official DVLA banks
-- =============================================================================
`);

  let assessmentId = 1;
  let versionId = 1;
  let questionId = 1;
  let optionId = 1;

  for (const b of BANKS) {
    const deptId = b.dept === 'RBDI' ? 3 : 2;
    const gradeId = b.level + 1; // 1 to 4
    const sourceRef = 'bank:' + b.id;

    sql.push(`-- Assessment: ${b.title}`);
    sql.push(`INSERT INTO "Assessment" ("id", "title", "description", "instructions", "createdById", "status", "maxAttempts", "resultRelease", "sourceRef")
VALUES (${assessmentId}, ${escapeSql(b.title)}, ${escapeSql('Official DVLA assessment loaded from ' + b.source)}, ${escapeSql('Answer all scenario questions based on your designated role and duties. Each question tests specific competency skill areas.')}, 1, 'PUBLISHED', 3, 'IMMEDIATE', ${escapeSql(sourceRef)})
ON CONFLICT ("sourceRef") DO UPDATE SET "status" = 'PUBLISHED';
`);

    sql.push(`INSERT INTO "AssessmentVersion" ("id", "assessmentId", "versionNo", "status", "scoringConfigId", "approvedById", "approvedAt", "publishedById", "publishedAt")
VALUES (${versionId}, ${assessmentId}, 1, 'PUBLISHED', 1, 1, CURRENT_TIMESTAMP, 1, CURRENT_TIMESTAMP)
ON CONFLICT ("assessmentId", "versionNo") DO UPDATE SET "status" = 'PUBLISHED';
`);

    const qRows = [];
    const optRows = [];
    const qcRows = [];

    for (let i = 0; i < b.items.length; i++) {
      const [code, area, text, options, correctIdx] = b.items[i];
      const curQId = questionId++;

      qRows.push(`(${curQId}, ${versionId}, ${i + 1}, 'SINGLE_CHOICE', ${escapeSql(text)}, ${escapeSql(area)}, 1.00)`);

      const mappedCompId = compCodeToId[code];
      if (mappedCompId) {
        qcRows.push(`(${curQId}, ${mappedCompId}, 1.00)`);
      }

      for (let j = 0; j < options.length; j++) {
        const curOptId = optionId++;
        const isCorrect = j === correctIdx;
        optRows.push(`(${curOptId}, ${curQId}, ${j + 1}, ${escapeSql(options[j])}, ${isCorrect})`);
      }
    }

    sql.push(`INSERT INTO "Question" ("id", "versionId", "order", "type", "text", "skillArea", "points") VALUES\n` + qRows.join(',\n') + '\nON CONFLICT ("versionId", "order") DO NOTHING;\n');
    sql.push(`INSERT INTO "AnswerOption" ("id", "questionId", "order", "text", "isCorrect") VALUES\n` + optRows.join(',\n') + '\nON CONFLICT ("questionId", "order") DO NOTHING;\n');
    if (qcRows.length) {
      sql.push(`INSERT INTO "QuestionCompetency" ("questionId", "competencyId", "weight") VALUES\n` + qcRows.join(',\n') + '\nON CONFLICT ("questionId", "competencyId") DO NOTHING;\n');
    }

    sql.push(`-- Assignment for ${b.title} to Department ${b.dept} & Grade ${JOB_LEVELS[b.level]}
INSERT INTO "AssessmentAssignment" ("id", "assessmentId", "targetType", "departmentId", "gradeId", "startsAt", "deadline", "maxAttempts", "createdById")
VALUES (${assessmentId}, ${assessmentId}, 'DEPARTMENT', ${deptId}, ${gradeId}, CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP + INTERVAL '90 days', 3, 1)
ON CONFLICT ("id") DO NOTHING;
`);

    assessmentId++;
    versionId++;
  }

  sql.push(`
-- =============================================================================
-- 12. UPDATE POSTGRES SEQUENCES
-- =============================================================================
SELECT setval(pg_get_serial_sequence('"Department"', 'id'), coalesce(max(id), 1)) FROM "Department";
SELECT setval(pg_get_serial_sequence('"Grade"', 'id'), coalesce(max(id), 1)) FROM "Grade";
SELECT setval(pg_get_serial_sequence('"Location"', 'id'), coalesce(max(id), 1)) FROM "Location";
SELECT setval(pg_get_serial_sequence('"Station"', 'id'), coalesce(max(id), 1)) FROM "Station";
SELECT setval(pg_get_serial_sequence('"StaffRecord"', 'id'), coalesce(max(id), 1)) FROM "StaffRecord";
SELECT setval(pg_get_serial_sequence('"Account"', 'id'), coalesce(max(id), 1)) FROM "Account";
SELECT setval(pg_get_serial_sequence('"CompetencyCategory"', 'id'), coalesce(max(id), 1)) FROM "CompetencyCategory";
SELECT setval(pg_get_serial_sequence('"Competency"', 'id'), coalesce(max(id), 1)) FROM "Competency";
SELECT setval(pg_get_serial_sequence('"ScoringConfig"', 'id'), coalesce(max(id), 1)) FROM "ScoringConfig";
SELECT setval(pg_get_serial_sequence('"Assessment"', 'id'), coalesce(max(id), 1)) FROM "Assessment";
SELECT setval(pg_get_serial_sequence('"AssessmentVersion"', 'id'), coalesce(max(id), 1)) FROM "AssessmentVersion";
SELECT setval(pg_get_serial_sequence('"Question"', 'id'), coalesce(max(id), 1)) FROM "Question";
SELECT setval(pg_get_serial_sequence('"AnswerOption"', 'id'), coalesce(max(id), 1)) FROM "AnswerOption";
SELECT setval(pg_get_serial_sequence('"AssessmentAssignment"', 'id'), coalesce(max(id), 1)) FROM "AssessmentAssignment";

COMMIT;
`);

  const outPath = path.resolve('schema.sql');
  fs.writeFileSync(outPath, sql.join('\n'), 'utf8');
  console.log('Successfully wrote', outPath, 'Bytes:', fs.statSync(outPath).size, 'Staff count:', staffRecords.length);
}

main();
