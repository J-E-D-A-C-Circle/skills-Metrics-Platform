import fs from 'node:fs';
import path from 'node:path';
import xlsx from 'xlsx';
import { JOB_LEVELS, BANKS, RBDI_FRAMEWORK, HR_FRAMEWORK } from '../components/dvlaBanks.js';
import { ROLE_PERMS } from '../components/smAccess.js';

// Password hash for 'Password123!'
const HASH = 'scrypt$32768$8$1$FcO6pcNPFgyj87mbN4shYQ==$32hJ0OEFIihATbvRA2fdG/yzBvm8NgxJGm63z9KNnMAjjASw7So/qXfmhPQxPO+ecVBUzqyjjkp2fyiOx5OTDw==';

function escapeSql(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

function escapeJson(obj) {
  if (!obj) return 'NULL';
  return escapeSql(JSON.stringify(obj));
}

function main() {
  console.log('Building complete schema.sql for MySQL 8 with real HR & RBDI staff list and question banks...');

  const sql = [];

  sql.push(`-- =============================================================================
-- schema.sql · Skill Matrix & Assessment Platform (MySQL 8)
-- Complete standalone schema definition, tables, constraints, baseline data,
-- all 17 official HR & RBDI staff accounts, and full question banks + assignments.
--
-- How to apply on your server:
--   mysql -h <host> -P 3306 -u <user> -p <database> < schema.sql
--
-- Or via Docker:
--   Automatically mounted to /docker-entrypoint-initdb.d/01-schema.sql
-- =============================================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS \`skill_matrix\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`skill_matrix\`;

-- =============================================================================
-- 1. TABLES
-- =============================================================================

CREATE TABLE IF NOT EXISTS \`Department\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`code\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Department_code_key\` (\`code\`),
    UNIQUE KEY \`Department_name_key\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Grade\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(191) NOT NULL,
    \`rank\` INT NOT NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Grade_name_key\` (\`name\`),
    UNIQUE KEY \`Grade_rank_key\` (\`rank\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Location\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(191) NOT NULL,
    \`region\` VARCHAR(191) NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Location_name_key\` (\`name\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Station\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(191) NOT NULL,
    \`locationId\` INT NOT NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Station_locationId_name_key\` (\`locationId\`, \`name\`),
    CONSTRAINT \`Station_locationId_fkey\` FOREIGN KEY (\`locationId\`) REFERENCES \`Location\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`GradeSupervisoryMapping\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`gradeId\` INT NOT NULL,
    \`stationId\` INT NULL,
    \`roleLabel\` VARCHAR(191) NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`GradeSupervisoryMapping_gradeId_stationId_roleLabel_key\` (\`gradeId\`, \`stationId\`, \`roleLabel\`),
    CONSTRAINT \`GradeSupervisoryMapping_gradeId_fkey\` FOREIGN KEY (\`gradeId\`) REFERENCES \`Grade\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`GradeSupervisoryMapping_stationId_fkey\` FOREIGN KEY (\`stationId\`) REFERENCES \`Station\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`StaffRecord\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`staffNo\` VARCHAR(191) NOT NULL,
    \`firstName\` VARCHAR(191) NOT NULL,
    \`lastName\` VARCHAR(191) NOT NULL,
    \`otherNames\` VARCHAR(191) NULL,
    \`email\` VARCHAR(191) NULL,
    \`designation\` VARCHAR(191) NULL,
    \`departmentId\` INT NULL,
    \`gradeId\` INT NULL,
    \`stationId\` INT NULL,
    \`supervisorId\` INT NULL,
    \`status\` ENUM('ACTIVE', 'INACTIVE', 'LEFT') NOT NULL DEFAULT 'ACTIVE',
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`StaffRecord_staffNo_key\` (\`staffNo\`),
    UNIQUE KEY \`StaffRecord_email_key\` (\`email\`),
    KEY \`StaffRecord_departmentId_idx\` (\`departmentId\`),
    KEY \`StaffRecord_gradeId_idx\` (\`gradeId\`),
    KEY \`StaffRecord_stationId_idx\` (\`stationId\`),
    CONSTRAINT \`StaffRecord_departmentId_fkey\` FOREIGN KEY (\`departmentId\`) REFERENCES \`Department\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`StaffRecord_gradeId_fkey\` FOREIGN KEY (\`gradeId\`) REFERENCES \`Grade\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`StaffRecord_stationId_fkey\` FOREIGN KEY (\`stationId\`) REFERENCES \`Station\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`StaffRecord_supervisorId_fkey\` FOREIGN KEY (\`supervisorId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`StaffPlacementHistory\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`staffId\` INT NOT NULL,
    \`departmentId\` INT NULL,
    \`stationId\` INT NULL,
    \`fromDate\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`toDate\` DATETIME(3) NULL,
    \`reason\` TEXT NULL,
    \`changedById\` INT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`StaffPlacementHistory_staffId_fromDate_idx\` (\`staffId\`, \`fromDate\`),
    CONSTRAINT \`StaffPlacementHistory_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`StaffPlacementHistory_departmentId_fkey\` FOREIGN KEY (\`departmentId\`) REFERENCES \`Department\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`StaffPlacementHistory_stationId_fkey\` FOREIGN KEY (\`stationId\`) REFERENCES \`Station\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Account\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`username\` VARCHAR(191) NOT NULL,
    \`email\` VARCHAR(191) NOT NULL,
    \`displayName\` VARCHAR(191) NOT NULL,
    \`passwordHash\` VARCHAR(255) NOT NULL,
    \`status\` ENUM('ACTIVE', 'MUST_CHANGE_PASSWORD', 'SUSPENDED', 'DISABLED') NOT NULL DEFAULT 'MUST_CHANGE_PASSWORD',
    \`staffId\` INT NULL,
    \`deptScope\` ENUM('ALL', 'OWN', 'SELECTED') NOT NULL DEFAULT 'OWN',
    \`lastLoginAt\` DATETIME(3) NULL,
    \`passwordSetAt\` DATETIME(3) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Account_username_key\` (\`username\`),
    UNIQUE KEY \`Account_email_key\` (\`email\`),
    KEY \`Account_staffId_idx\` (\`staffId\`),
    CONSTRAINT \`Account_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Session\` (
    \`id\` VARCHAR(191) NOT NULL,
    \`tokenHash\` VARCHAR(191) NOT NULL,
    \`accountId\` INT NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`expiresAt\` DATETIME(3) NOT NULL,
    \`lastSeenAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`revokedAt\` DATETIME(3) NULL,
    \`ip\` VARCHAR(191) NULL,
    \`userAgent\` TEXT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Session_tokenHash_key\` (\`tokenHash\`),
    KEY \`Session_accountId_idx\` (\`accountId\`),
    CONSTRAINT \`Session_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`LoginAttempt\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`identifier\` VARCHAR(191) NOT NULL,
    \`ip\` VARCHAR(191) NULL,
    \`success\` TINYINT(1) NOT NULL,
    \`reason\` VARCHAR(191) NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`LoginAttempt_identifier_at_idx\` (\`identifier\`, \`at\`),
    KEY \`LoginAttempt_ip_at_idx\` (\`ip\`, \`at\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AccountRole\` (
    \`accountId\` INT NOT NULL,
    \`role\` ENUM('STAFF', 'SUPERVISOR', 'CREATOR', 'ADMIN', 'TICKET_RESOLVER') NOT NULL,
    \`grantedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`accountId\`, \`role\`),
    CONSTRAINT \`AccountRole_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AccountPermission\` (
    \`accountId\` INT NOT NULL,
    \`key\` VARCHAR(191) NOT NULL,
    PRIMARY KEY (\`accountId\`, \`key\`),
    CONSTRAINT \`AccountPermission_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AccountScopeDepartment\` (
    \`accountId\` INT NOT NULL,
    \`departmentId\` INT NOT NULL,
    PRIMARY KEY (\`accountId\`, \`departmentId\`),
    CONSTRAINT \`AccountScopeDepartment_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`AccountScopeDepartment_departmentId_fkey\` FOREIGN KEY (\`departmentId\`) REFERENCES \`Department\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`SupervisorAssignment\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`accountId\` INT NOT NULL,
    \`departmentId\` INT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`SupervisorAssignment_accountId_departmentId_key\` (\`accountId\`, \`departmentId\`),
    CONSTRAINT \`SupervisorAssignment_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`SupervisorAssignment_departmentId_fkey\` FOREIGN KEY (\`departmentId\`) REFERENCES \`Department\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`CompetencyCategory\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`name\` VARCHAR(191) NOT NULL,
    \`group\` VARCHAR(191) NOT NULL,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`CompetencyCategory_name_group_key\` (\`name\`, \`group\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Competency\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`code\` VARCHAR(191) NOT NULL,
    \`name\` VARCHAR(191) NOT NULL,
    \`short\` VARCHAR(191) NOT NULL,
    \`categoryId\` INT NOT NULL,
    \`departmentId\` INT NULL,
    \`importance\` INT NOT NULL DEFAULT 4,
    \`requiredLevel\` DECIMAL(4,2) NOT NULL DEFAULT 5.00,
    \`skillAreas\` JSON NULL,
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Competency_code_key\` (\`code\`),
    CONSTRAINT \`Competency_categoryId_fkey\` FOREIGN KEY (\`categoryId\`) REFERENCES \`CompetencyCategory\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`Competency_departmentId_fkey\` FOREIGN KEY (\`departmentId\`) REFERENCES \`Department\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Assessment\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`title\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NULL,
    \`instructions\` TEXT NULL,
    \`createdById\` INT NOT NULL,
    \`status\` ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'REJECTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    \`maxAttempts\` INT NOT NULL DEFAULT 3,
    \`resultRelease\` ENUM('IMMEDIATE', 'AFTER_DEADLINE', 'MANUAL') NOT NULL DEFAULT 'IMMEDIATE',
    \`resultsReleasedAt\` DATETIME(3) NULL,
    \`sourceRef\` VARCHAR(191) NULL,
    \`plannedAssignment\` JSON NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Assessment_sourceRef_key\` (\`sourceRef\`),
    CONSTRAINT \`Assessment_createdById_fkey\` FOREIGN KEY (\`createdById\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AssessmentVersion\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`assessmentId\` INT NOT NULL,
    \`versionNo\` INT NOT NULL,
    \`status\` ENUM('DRAFT', 'SUBMITTED', 'RETURNED', 'REJECTED', 'APPROVED', 'PUBLISHED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
    \`scoringConfigId\` INT NULL,
    \`submittedAt\` DATETIME(3) NULL,
    \`approvedById\` INT NULL,
    \`approvedAt\` DATETIME(3) NULL,
    \`publishedById\` INT NULL,
    \`publishedAt\` DATETIME(3) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`AssessmentVersion_assessmentId_versionNo_key\` (\`assessmentId\`, \`versionNo\`),
    CONSTRAINT \`AssessmentVersion_assessmentId_fkey\` FOREIGN KEY (\`assessmentId\`) REFERENCES \`Assessment\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AssessmentReviewEvent\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`versionId\` INT NOT NULL,
    \`actorId\` INT NOT NULL,
    \`action\` VARCHAR(191) NOT NULL,
    \`feedback\` TEXT NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`AssessmentReviewEvent_versionId_at_idx\` (\`versionId\`, \`at\`),
    CONSTRAINT \`AssessmentReviewEvent_versionId_fkey\` FOREIGN KEY (\`versionId\`) REFERENCES \`AssessmentVersion\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentReviewEvent_actorId_fkey\` FOREIGN KEY (\`actorId\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Question\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`versionId\` INT NOT NULL,
    \`order\` INT NOT NULL,
    \`type\` ENUM('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'TEXT') NOT NULL DEFAULT 'SINGLE_CHOICE',
    \`text\` TEXT NOT NULL,
    \`skillArea\` VARCHAR(191) NULL,
    \`points\` DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Question_versionId_order_key\` (\`versionId\`, \`order\`),
    CONSTRAINT \`Question_versionId_fkey\` FOREIGN KEY (\`versionId\`) REFERENCES \`AssessmentVersion\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AnswerOption\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`questionId\` INT NOT NULL,
    \`order\` INT NOT NULL,
    \`text\` TEXT NOT NULL,
    \`isCorrect\` TINYINT(1) NOT NULL DEFAULT 0,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`AnswerOption_questionId_order_key\` (\`questionId\`, \`order\`),
    CONSTRAINT \`AnswerOption_questionId_fkey\` FOREIGN KEY (\`questionId\`) REFERENCES \`Question\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`QuestionCompetency\` (
    \`questionId\` INT NOT NULL,
    \`competencyId\` INT NOT NULL,
    \`weight\` DECIMAL(6,2) NOT NULL DEFAULT 1.00,
    PRIMARY KEY (\`questionId\`, \`competencyId\`),
    CONSTRAINT \`QuestionCompetency_questionId_fkey\` FOREIGN KEY (\`questionId\`) REFERENCES \`Question\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`QuestionCompetency_competencyId_fkey\` FOREIGN KEY (\`competencyId\`) REFERENCES \`Competency\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AssessmentAssignment\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`assessmentId\` INT NOT NULL,
    \`targetType\` ENUM('INDIVIDUAL', 'DEPARTMENT', 'GRADE', 'STATION', 'LOCATION') NOT NULL,
    \`staffId\` INT NULL,
    \`departmentId\` INT NULL,
    \`gradeId\` INT NULL,
    \`stationId\` INT NULL,
    \`locationId\` INT NULL,
    \`startsAt\` DATETIME(3) NOT NULL,
    \`deadline\` DATETIME(3) NOT NULL,
    \`maxAttempts\` INT NULL,
    \`createdById\` INT NOT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`AssessmentAssignment_assessmentId_idx\` (\`assessmentId\`),
    CONSTRAINT \`AssessmentAssignment_assessmentId_fkey\` FOREIGN KEY (\`assessmentId\`) REFERENCES \`Assessment\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentAssignment_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentAssignment_departmentId_fkey\` FOREIGN KEY (\`departmentId\`) REFERENCES \`Department\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentAssignment_gradeId_fkey\` FOREIGN KEY (\`gradeId\`) REFERENCES \`Grade\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentAssignment_stationId_fkey\` FOREIGN KEY (\`stationId\`) REFERENCES \`Station\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentAssignment_locationId_fkey\` FOREIGN KEY (\`locationId\`) REFERENCES \`Location\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`AssessmentAssignment_createdById_fkey\` FOREIGN KEY (\`createdById\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`DeadlineExtension\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`assignmentId\` INT NOT NULL,
    \`staffId\` INT NULL,
    \`originalDeadline\` DATETIME(3) NOT NULL,
    \`newDeadline\` DATETIME(3) NOT NULL,
    \`reason\` TEXT NOT NULL,
    \`approvedById\` INT NOT NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`DeadlineExtension_assignmentId_staffId_idx\` (\`assignmentId\`, \`staffId\`),
    CONSTRAINT \`DeadlineExtension_assignmentId_fkey\` FOREIGN KEY (\`assignmentId\`) REFERENCES \`AssessmentAssignment\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`DeadlineExtension_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`DeadlineExtension_approvedById_fkey\` FOREIGN KEY (\`approvedById\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Attempt\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`assessmentId\` INT NOT NULL,
    \`versionId\` INT NOT NULL,
    \`staffId\` INT NOT NULL,
    \`accountId\` INT NOT NULL,
    \`attemptNo\` INT NOT NULL,
    \`status\` ENUM('IN_PROGRESS', 'SUBMITTED', 'PENDING_MARKING', 'COMPLETED', 'ABANDONED', 'EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
    \`startedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`submittedAt\` DATETIME(3) NULL,
    \`completedAt\` DATETIME(3) NULL,
    \`activeSeconds\` INT NOT NULL DEFAULT 0,
    \`elapsedSeconds\` INT NOT NULL DEFAULT 0,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Attempt_staffId_assessmentId_attemptNo_key\` (\`staffId\`, \`assessmentId\`, \`attemptNo\`),
    KEY \`Attempt_staffId_assessmentId_status_idx\` (\`staffId\`, \`assessmentId\`, \`status\`),
    CONSTRAINT \`Attempt_assessmentId_fkey\` FOREIGN KEY (\`assessmentId\`) REFERENCES \`Assessment\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`Attempt_versionId_fkey\` FOREIGN KEY (\`versionId\`) REFERENCES \`AssessmentVersion\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`Attempt_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`Attempt_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AttemptResponse\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`attemptId\` INT NOT NULL,
    \`questionId\` INT NOT NULL,
    \`optionId\` INT NULL,
    \`textAnswer\` TEXT NULL,
    \`isCorrect\` TINYINT(1) NULL,
    \`activeSeconds\` INT NOT NULL DEFAULT 0,
    \`savedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`AttemptResponse_attemptId_questionId_key\` (\`attemptId\`, \`questionId\`),
    CONSTRAINT \`AttemptResponse_attemptId_fkey\` FOREIGN KEY (\`attemptId\`) REFERENCES \`Attempt\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`AttemptResponse_questionId_fkey\` FOREIGN KEY (\`questionId\`) REFERENCES \`Question\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`AttemptResponse_optionId_fkey\` FOREIGN KEY (\`optionId\`) REFERENCES \`AnswerOption\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`ActiveTimeSegment\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`attemptId\` INT NOT NULL,
    \`questionId\` INT NULL,
    \`tabId\` VARCHAR(191) NOT NULL,
    \`startedAt\` DATETIME(3) NOT NULL,
    \`endedAt\` DATETIME(3) NOT NULL,
    \`seconds\` INT NOT NULL,
    PRIMARY KEY (\`id\`),
    KEY \`ActiveTimeSegment_attemptId_idx\` (\`attemptId\`),
    CONSTRAINT \`ActiveTimeSegment_attemptId_fkey\` FOREIGN KEY (\`attemptId\`) REFERENCES \`Attempt\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`CompetencyAttemptResult\` (
    \`attemptId\` INT NOT NULL,
    \`competencyId\` INT NOT NULL,
    \`score\` DECIMAL(8,6) NOT NULL,
    \`asked\` INT NOT NULL,
    \`correct\` INT NOT NULL,
    PRIMARY KEY (\`attemptId\`, \`competencyId\`),
    CONSTRAINT \`CompetencyAttemptResult_attemptId_fkey\` FOREIGN KEY (\`attemptId\`) REFERENCES \`Attempt\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`CompetencyAttemptResult_competencyId_fkey\` FOREIGN KEY (\`competencyId\`) REFERENCES \`Competency\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`FinalCompetencyResult\` (
    \`staffId\` INT NOT NULL,
    \`assessmentId\` INT NOT NULL,
    \`competencyId\` INT NOT NULL,
    \`average\` DECIMAL(8,6) NOT NULL,
    \`attemptsIncluded\` INT NOT NULL,
    \`competencyStatus\` VARCHAR(191) NOT NULL,
    \`gapStatus\` VARCHAR(191) NOT NULL,
    \`scoringConfigId\` INT NOT NULL,
    \`computedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`staffId\`, \`assessmentId\`, \`competencyId\`),
    CONSTRAINT \`FinalCompetencyResult_staffId_fkey\` FOREIGN KEY (\`staffId\`) REFERENCES \`StaffRecord\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`FinalCompetencyResult_assessmentId_fkey\` FOREIGN KEY (\`assessmentId\`) REFERENCES \`Assessment\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`FinalCompetencyResult_competencyId_fkey\` FOREIGN KEY (\`competencyId\`) REFERENCES \`Competency\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`ScoringConfig\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`version\` INT NOT NULL,
    \`requiredLevel\` DECIMAL(4,2) NOT NULL DEFAULT 5.00,
    \`competentFrom\` DECIMAL(4,2) NOT NULL DEFAULT 4.00,
    \`proficientFrom\` DECIMAL(4,2) NOT NULL DEFAULT 5.00,
    \`moderateGapFrom\` DECIMAL(4,2) NOT NULL DEFAULT 2.50,
    \`noGapFrom\` DECIMAL(4,2) NOT NULL DEFAULT 5.00,
    \`defaultMaxAttempts\` INT NOT NULL DEFAULT 3,
    \`reason\` VARCHAR(255) NOT NULL,
    \`createdById\` INT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`active\` TINYINT(1) NOT NULL DEFAULT 1,
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`ScoringConfig_version_key\` (\`version\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`NotificationTemplate\` (
    \`key\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`body\` TEXT NOT NULL,
    \`channels\` JSON NOT NULL,
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`key\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Notification\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`accountId\` INT NOT NULL,
    \`type\` VARCHAR(191) NOT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`body\` TEXT NOT NULL,
    \`link\` VARCHAR(255) NULL,
    \`dedupeKey\` VARCHAR(191) NULL,
    \`readAt\` DATETIME(3) NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Notification_dedupeKey_key\` (\`dedupeKey\`),
    KEY \`Notification_accountId_readAt_idx\` (\`accountId\`, \`readAt\`),
    CONSTRAINT \`Notification_accountId_fkey\` FOREIGN KEY (\`accountId\`) REFERENCES \`Account\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`NotificationDelivery\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`notificationId\` INT NOT NULL,
    \`channel\` VARCHAR(191) NOT NULL,
    \`status\` VARCHAR(191) NOT NULL,
    \`error\` TEXT NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`NotificationDelivery_notificationId_fkey\` FOREIGN KEY (\`notificationId\`) REFERENCES \`Notification\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`Ticket\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`reference\` VARCHAR(191) NOT NULL,
    \`requesterId\` INT NOT NULL,
    \`assigneeId\` INT NULL,
    \`title\` VARCHAR(191) NOT NULL,
    \`category\` VARCHAR(191) NOT NULL,
    \`description\` TEXT NOT NULL,
    \`priority\` ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') NOT NULL DEFAULT 'MEDIUM',
    \`status\` ENUM('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'RESOLVED', 'CLOSED') NOT NULL DEFAULT 'OPEN',
    \`assessmentId\` INT NULL,
    \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`Ticket_reference_key\` (\`reference\`),
    KEY \`Ticket_status_priority_idx\` (\`status\`, \`priority\`),
    KEY \`Ticket_assigneeId_idx\` (\`assigneeId\`),
    CONSTRAINT \`Ticket_requesterId_fkey\` FOREIGN KEY (\`requesterId\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT \`Ticket_assigneeId_fkey\` FOREIGN KEY (\`assigneeId\`) REFERENCES \`Account\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT \`Ticket_assessmentId_fkey\` FOREIGN KEY (\`assessmentId\`) REFERENCES \`Assessment\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`TicketMessage\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`ticketId\` INT NOT NULL,
    \`authorId\` INT NOT NULL,
    \`body\` TEXT NOT NULL,
    \`internal\` TINYINT(1) NOT NULL DEFAULT 0,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`TicketMessage_ticketId_fkey\` FOREIGN KEY (\`ticketId\`) REFERENCES \`Ticket\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`TicketMessage_authorId_fkey\` FOREIGN KEY (\`authorId\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`TicketAttachment\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`ticketId\` INT NOT NULL,
    \`fileName\` VARCHAR(191) NOT NULL,
    \`mimeType\` VARCHAR(191) NOT NULL,
    \`sizeBytes\` INT NOT NULL,
    \`storagePath\` VARCHAR(255) NOT NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`TicketAttachment_ticketId_fkey\` FOREIGN KEY (\`ticketId\`) REFERENCES \`Ticket\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`TicketEvent\` (
    \`id\` INT NOT NULL AUTO_INCREMENT,
    \`ticketId\` INT NOT NULL,
    \`actorId\` INT NOT NULL,
    \`field\` VARCHAR(191) NOT NULL,
    \`fromVal\` VARCHAR(191) NULL,
    \`toVal\` VARCHAR(191) NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    CONSTRAINT \`TicketEvent_ticketId_fkey\` FOREIGN KEY (\`ticketId\`) REFERENCES \`Ticket\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT \`TicketEvent_actorId_fkey\` FOREIGN KEY (\`actorId\`) REFERENCES \`Account\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`AuditLog\` (
    \`id\` BIGINT NOT NULL AUTO_INCREMENT,
    \`actorId\` INT NULL,
    \`action\` VARCHAR(191) NOT NULL,
    \`entityType\` VARCHAR(191) NULL,
    \`entityId\` VARCHAR(191) NULL,
    \`outcome\` VARCHAR(191) NOT NULL DEFAULT 'SUCCESS',
    \`before\` JSON NULL,
    \`after\` JSON NULL,
    \`ip\` VARCHAR(191) NULL,
    \`at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`id\`),
    KEY \`AuditLog_at_idx\` (\`at\`),
    KEY \`AuditLog_actorId_at_idx\` (\`actorId\`, \`at\`),
    KEY \`AuditLog_entityType_entityId_idx\` (\`entityType\`, \`entityId\`),
    CONSTRAINT \`AuditLog_actorId_fkey\` FOREIGN KEY (\`actorId\`) REFERENCES \`Account\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS \`SystemSetting\` (
    \`key\` VARCHAR(191) NOT NULL,
    \`value\` JSON NOT NULL,
    \`updatedById\` INT NULL,
    \`updatedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    PRIMARY KEY (\`key\`),
    CONSTRAINT \`SystemSetting_updatedById_fkey\` FOREIGN KEY (\`updatedById\`) REFERENCES \`Account\` (\`id\`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =============================================================================
-- 2. BASELINE ORGANISATION & SCORING
-- =============================================================================

INSERT INTO \`ScoringConfig\` (\`id\`, \`version\`, \`requiredLevel\`, \`competentFrom\`, \`proficientFrom\`, \`moderateGapFrom\`, \`noGapFrom\`, \`defaultMaxAttempts\`, \`reason\`, \`active\`)
VALUES (1, 1, 5.00, 4.00, 5.00, 2.50, 5.00, 3, 'Defaults from the Skills Metrics specification', 1)
ON DUPLICATE KEY UPDATE \`reason\` = VALUES(\`reason\`);

INSERT INTO \`Department\` (\`id\`, \`code\`, \`name\`, \`active\`, \`updatedAt\`) VALUES
(1, 'IT', 'IT Department', 1, CURRENT_TIMESTAMP(3)),
(2, 'HR', 'Human Resources', 1, CURRENT_TIMESTAMP(3)),
(3, 'RBDI', 'Research, Business Development & Innovation', 1, CURRENT_TIMESTAMP(3)),
(4, 'CA', 'Corporate Affairs', 1, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);

INSERT INTO \`Grade\` (\`id\`, \`name\`, \`rank\`, \`active\`, \`updatedAt\`) VALUES
(1, 'Assistant Officer', 0, 1, CURRENT_TIMESTAMP(3)),
(2, 'Officer & Senior Officer', 1, 1, CURRENT_TIMESTAMP(3)),
(3, 'Assistant Manager & Manager', 2, 1, CURRENT_TIMESTAMP(3)),
(4, 'Deputy Director & Director', 3, 1, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE \`rank\` = VALUES(\`rank\`);

INSERT INTO \`Location\` (\`id\`, \`name\`, \`region\`, \`active\`, \`updatedAt\`) VALUES
(1, 'Head Office, Accra', 'Greater Accra', 1, CURRENT_TIMESTAMP(3)),
(2, 'Accra (37) Office', 'Greater Accra', 1, CURRENT_TIMESTAMP(3)),
(3, 'Tema Office', 'Greater Accra', 1, CURRENT_TIMESTAMP(3)),
(4, 'Kumasi Office', 'Ashanti', 1, CURRENT_TIMESTAMP(3)),
(5, 'Takoradi Office', 'Western', 1, CURRENT_TIMESTAMP(3)),
(6, 'Tamale Office', 'Northern', 1, CURRENT_TIMESTAMP(3)),
(7, 'Ho Office', 'Volta', 1, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE \`region\` = VALUES(\`region\`);

INSERT INTO \`Station\` (\`id\`, \`name\`, \`locationId\`, \`active\`, \`updatedAt\`) VALUES
(1, 'Head Office, Accra', 1, 1, CURRENT_TIMESTAMP(3)),
(2, 'Accra (37) Office', 2, 1, CURRENT_TIMESTAMP(3)),
(3, 'Tema Office', 3, 1, CURRENT_TIMESTAMP(3)),
(4, 'Kumasi Office', 4, 1, CURRENT_TIMESTAMP(3)),
(5, 'Takoradi Office', 5, 1, CURRENT_TIMESTAMP(3)),
(6, 'Tamale Office', 6, 1, CURRENT_TIMESTAMP(3)),
(7, 'Ho Office', 7, 1, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE \`locationId\` = VALUES(\`locationId\`);

-- Standard Notification Event Templates
INSERT INTO \`NotificationTemplate\` (\`key\`, \`title\`, \`body\`, \`channels\`, \`updatedAt\`) VALUES
('assessment.assigned', 'New assessment: {title}', 'You have been assigned {title}. It opens {startsAt} and closes {deadline}.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('assessment.deadline.soon', '{title} closes soon', '{title} closes {deadline}. You have used {used} of {max} attempts.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('assessment.deadline.passed', '{title} has closed', 'The deadline for {title} has passed.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('assessment.extension', 'More time for {title}', 'The deadline for {title} has moved to {deadline}.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('assessment.completed', 'Attempt submitted: {title}', 'Your attempt {attemptNo} of {title} was submitted.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('results.released', 'Results ready: {title}', 'Your results for {title} are ready to view.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('content.approved', 'Approved: {title}', '{title} was approved by {reviewer}.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('content.rejected', 'Rejected: {title}', '{title} was rejected. Feedback: {feedback}', '["in_app"]', CURRENT_TIMESTAMP(3)),
('content.returned', 'Changes requested: {title}', '{title} was returned for revision. Feedback: {feedback}', '["in_app"]', CURRENT_TIMESTAMP(3)),
('content.submitted', 'Review needed: {title}', '{author} submitted version {versionNo} of {title} for review.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('content.published', 'Published: {title}', 'Version {versionNo} of {title} is now published and can be assigned.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('ticket.updated', 'Ticket {reference} updated', 'Your support ticket {reference} is now {status}.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('ticket.created', 'New support ticket {reference}', '{requester} raised {reference}: {title} ({priority} priority).', '["in_app"]', CURRENT_TIMESTAMP(3)),
('ticket.assigned', 'Ticket {reference} assigned to you', '{reference}: {title} ({priority} priority) is now assigned to you.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('ticket.activity', 'New reply on {reference}', '{actor} replied on {reference}: {title}.', '["in_app"]', CURRENT_TIMESTAMP(3)),
('account.changed', 'Your account was updated', '{change}', '["in_app"]', CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE \`title\` = VALUES(\`title\`), \`body\` = VALUES(\`body\`);
`);

  // =============================================================================
  // 3. READ HR & RBDI STAFF LIST SPREADSHEET & CREATE ALL STAFF & ACCOUNTS
  // =============================================================================
  const excelPath = path.resolve('HR & RBDI STAFF LIST (1).xlsx');
  const wb = xlsx.readFile(excelPath);
  const rawRows = xlsx.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);

  function getGradeId(desig) {
    const d = desig.toUpperCase();
    if (d.includes('DIRECTOR')) return 4;
    if (d.includes('MANAGER')) return 3;
    if (d.includes('OFFICER')) return 2;
    return 1;
  }

  function getRole(desig) {
    const d = desig.toUpperCase();
    if (d.includes('ASSISTANT MANAGER HR')) return 'CREATOR';
    if (d.includes('DIRECTOR') || d.includes('MANAGER')) return 'SUPERVISOR';
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
    const role = getRole(desig);
    const username = getUsername(fullName);
    const email = `${username}@dvla.gov.gh`;
    const isTamale = String(r['Location\t'] || r['Location'] || '').toUpperCase().includes('TAMALE');
    const stationId = isTamale ? 6 : 1;

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

  // Insert Staff Records
  sql.push(`-- Official Staff Records & Accounts`);
  sql.push(`INSERT INTO \`StaffRecord\` (\`id\`, \`staffNo\`, \`firstName\`, \`lastName\`, \`otherNames\`, \`email\`, \`designation\`, \`departmentId\`, \`gradeId\`, \`stationId\`, \`status\`) VALUES`);
  const sRows = staffRecords.map(s =>
    `(${s.id}, ${escapeSql(s.staffNo)}, ${escapeSql(s.firstName)}, ${escapeSql(s.lastName)}, ${escapeSql(s.otherNames)}, ${escapeSql(s.email)}, ${escapeSql(s.designation)}, ${s.departmentId}, ${s.gradeId}, ${s.stationId}, 'ACTIVE')`
  );
  sql.push(sRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`firstName\` = VALUES(\`firstName\`), \`lastName\` = VALUES(\`lastName\`), \`designation\` = VALUES(\`designation\`);\n');

  // Insert Accounts
  sql.push(`INSERT INTO \`Account\` (\`id\`, \`username\`, \`email\`, \`displayName\`, \`passwordHash\`, \`status\`, \`staffId\`, \`deptScope\`) VALUES`);
  const aRows = staffRecords.map(s => {
    const dispName = s.otherNames ? `${s.firstName} ${s.otherNames} ${s.lastName}` : `${s.firstName} ${s.lastName}`;
    return `(${s.id}, ${escapeSql(s.username)}, ${escapeSql(s.email)}, ${escapeSql(dispName)}, '${HASH}', 'ACTIVE', ${s.id}, ${escapeSql(s.deptScope)})`;
  });
  sql.push(aRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`passwordHash\` = VALUES(\`passwordHash\`), \`status\` = \'ACTIVE\';\n');

  // Insert Roles
  sql.push(`INSERT INTO \`AccountRole\` (\`accountId\`, \`role\`) VALUES`);
  const rRows = staffRecords.map(s => `(${s.id}, '${s.role}')`);
  sql.push(rRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`role\` = VALUES(\`role\`);\n');

  // Insert Permissions
  sql.push(`INSERT INTO \`AccountPermission\` (\`accountId\`, \`key\`) VALUES`);
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
  sql.push(pRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`key\` = VALUES(\`key\`);\n');

  // Supervisor Assignments
  const supRows = staffRecords.filter(s => s.role === 'SUPERVISOR').map(s => `(${s.id}, ${s.departmentId})`);
  if (supRows.length) {
    sql.push(`INSERT INTO \`SupervisorAssignment\` (\`accountId\`, \`departmentId\`) VALUES\n` + supRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`departmentId\` = VALUES(\`departmentId\`);\n');
  }

  // =============================================================================
  // 4. COMPETENCIES
  // =============================================================================
  sql.push(`-- Competencies & Categories
INSERT INTO \`CompetencyCategory\` (\`id\`, \`name\`, \`group\`) VALUES
(1, 'Technical', 'RBDI Technical Competencies'),
(2, 'Technical', 'Talent Acquisition & Selection'),
(3, 'Technical', 'Learning & Development Management'),
(4, 'General', 'General Skills')
ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);
`);

  sql.push(`INSERT INTO \`Competency\` (\`id\`, \`code\`, \`name\`, \`short\`, \`categoryId\`, \`departmentId\`, \`importance\`, \`requiredLevel\`, \`skillAreas\`, \`active\`) VALUES`);
  const compRows = [];
  let compId = 1;
  const compCodeToId = {};

  for (const c of RBDI_FRAMEWORK) {
    compCodeToId[c.id] = compId;
    compRows.push(`(${compId}, ${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.short)}, 1, 3, 4, 5.00, ${escapeJson(c.areas)}, 1)`);
    compId++;
  }

  for (const c of HR_FRAMEWORK) {
    const catId = c.group === 'Talent Acquisition & Selection' ? 2 : 3;
    compCodeToId[c.id] = compId;
    compRows.push(`(${compId}, ${escapeSql(c.id)}, ${escapeSql(c.name)}, ${escapeSql(c.short)}, ${catId}, 2, 4, 5.00, NULL, 1)`);
    compId++;
  }
  sql.push(compRows.join(',\n') + `\nON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`), \`skillAreas\` = VALUES(\`skillAreas\`);\n`);

  // =============================================================================
  // 5. ASSESSMENTS & QUESTIONS
  // =============================================================================
  sql.push(`-- Assessments, Questions, and Question Banks`);

  let assessmentId = 1;
  let versionId = 1;
  let questionId = 1;
  let optionId = 1;

  for (const b of BANKS) {
    const deptId = b.dept === 'RBDI' ? 3 : 2;
    const gradeId = b.level + 1;
    const sourceRef = 'bank:' + b.id;

    sql.push(`INSERT INTO \`Assessment\` (\`id\`, \`title\`, \`description\`, \`instructions\`, \`createdById\`, \`status\`, \`maxAttempts\`, \`resultRelease\`, \`sourceRef\`)
VALUES (${assessmentId}, ${escapeSql(b.title)}, ${escapeSql('Official DVLA assessment loaded from ' + b.source)}, ${escapeSql('Answer all scenario questions based on your designated role and duties. Each question tests specific competency skill areas.')}, 1, 'PUBLISHED', 3, 'IMMEDIATE', ${escapeSql(sourceRef)})
ON DUPLICATE KEY UPDATE \`status\` = 'PUBLISHED';
`);

    sql.push(`INSERT INTO \`AssessmentVersion\` (\`id\`, \`assessmentId\`, \`versionNo\`, \`status\`, \`scoringConfigId\`, \`approvedById\`, \`approvedAt\`, \`publishedById\`, \`publishedAt\`)
VALUES (${versionId}, ${assessmentId}, 1, 'PUBLISHED', 1, 1, CURRENT_TIMESTAMP(3), 1, CURRENT_TIMESTAMP(3))
ON DUPLICATE KEY UPDATE \`status\` = 'PUBLISHED';
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
        const isCorrect = j === correctIdx ? 1 : 0;
        optRows.push(`(${curOptId}, ${curQId}, ${j + 1}, ${escapeSql(options[j])}, ${isCorrect})`);
      }
    }

    sql.push(`INSERT INTO \`Question\` (\`id\`, \`versionId\`, \`order\`, \`type\`, \`text\`, \`skillArea\`, \`points\`) VALUES\n` + qRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`text\` = VALUES(\`text\`);\n');
    sql.push(`INSERT INTO \`AnswerOption\` (\`id\`, \`questionId\`, \`order\`, \`text\`, \`isCorrect\`) VALUES\n` + optRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`text\` = VALUES(\`text\`);\n');
    if (qcRows.length) {
      sql.push(`INSERT INTO \`QuestionCompetency\` (\`questionId\`, \`competencyId\`, \`weight\`) VALUES\n` + qcRows.join(',\n') + '\nON DUPLICATE KEY UPDATE \`weight\` = VALUES(\`weight\`);\n');
    }

    sql.push(`INSERT INTO \`AssessmentAssignment\` (\`id\`, \`assessmentId\`, \`targetType\`, \`departmentId\`, \`gradeId\`, \`startsAt\`, \`deadline\`, \`maxAttempts\`, \`createdById\`)
VALUES (${assessmentId}, ${assessmentId}, 'DEPARTMENT', ${deptId}, ${gradeId}, DATE_SUB(CURRENT_TIMESTAMP(3), INTERVAL 1 DAY), DATE_ADD(CURRENT_TIMESTAMP(3), INTERVAL 90 DAY), 3, 1)
ON DUPLICATE KEY UPDATE \`deadline\` = VALUES(\`deadline\`);
`);

    assessmentId++;
    versionId++;
  }

  sql.push(`
SET FOREIGN_KEY_CHECKS = 1;
`);

  const outPath = path.resolve('schema.sql');
  fs.writeFileSync(outPath, sql.join('\n'), 'utf8');
  console.log('Successfully wrote MySQL', outPath, 'Bytes:', fs.statSync(outPath).size, 'Staff count:', staffRecords.length);
}

main();
