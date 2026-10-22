CREATE TABLE `AccountPermission` (
	`accountId` int NOT NULL,
	`key` varchar(191) NOT NULL,
	CONSTRAINT `AccountPermission_accountId_key_pk` PRIMARY KEY(`accountId`,`key`)
);
--> statement-breakpoint
CREATE TABLE `AccountRole` (
	`accountId` int NOT NULL,
	`role` enum('STAFF','SUPERVISOR','CREATOR','ADMIN','TICKET_RESOLVER') NOT NULL,
	`grantedAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `AccountRole_accountId_role_pk` PRIMARY KEY(`accountId`,`role`)
);
--> statement-breakpoint
CREATE TABLE `AccountScopeDepartment` (
	`accountId` int NOT NULL,
	`departmentId` int NOT NULL,
	CONSTRAINT `AccountScopeDepartment_accountId_departmentId_pk` PRIMARY KEY(`accountId`,`departmentId`)
);
--> statement-breakpoint
CREATE TABLE `Account` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(191) NOT NULL,
	`email` varchar(191) NOT NULL,
	`displayName` varchar(191) NOT NULL,
	`passwordHash` varchar(255) NOT NULL,
	`status` enum('ACTIVE','MUST_CHANGE_PASSWORD','SUSPENDED','DISABLED') NOT NULL DEFAULT 'MUST_CHANGE_PASSWORD',
	`staffId` int,
	`deptScope` enum('ALL','OWN','SELECTED') NOT NULL DEFAULT 'OWN',
	`lastLoginAt` timestamp(3),
	`passwordSetAt` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Account_id` PRIMARY KEY(`id`),
	CONSTRAINT `Account_username_unique` UNIQUE(`username`),
	CONSTRAINT `Account_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `ActiveTimeSegment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`questionId` int,
	`tabId` varchar(191) NOT NULL,
	`startedAt` timestamp(3) NOT NULL,
	`endedAt` timestamp(3) NOT NULL,
	`seconds` int NOT NULL,
	CONSTRAINT `ActiveTimeSegment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `AnswerOption` (
	`id` int AUTO_INCREMENT NOT NULL,
	`questionId` int NOT NULL,
	`order` int NOT NULL,
	`text` text NOT NULL,
	`isCorrect` boolean NOT NULL DEFAULT false,
	CONSTRAINT `AnswerOption_id` PRIMARY KEY(`id`),
	CONSTRAINT `AnswerOption_questionId_order_key` UNIQUE(`questionId`,`order`)
);
--> statement-breakpoint
CREATE TABLE `AssessmentAssignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`targetType` enum('INDIVIDUAL','DEPARTMENT','GRADE','STATION','LOCATION') NOT NULL,
	`staffId` int,
	`departmentId` int,
	`gradeId` int,
	`stationId` int,
	`locationId` int,
	`startsAt` timestamp(3) NOT NULL,
	`deadline` timestamp(3) NOT NULL,
	`maxAttempts` int,
	`createdById` int NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `AssessmentAssignment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `AssessmentReviewEvent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versionId` int NOT NULL,
	`actorId` int NOT NULL,
	`action` varchar(191) NOT NULL,
	`feedback` text,
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `AssessmentReviewEvent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `AssessmentVersion` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`versionNo` int NOT NULL,
	`status` enum('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`scoringConfigId` int,
	`submittedAt` timestamp(3),
	`approvedById` int,
	`approvedAt` timestamp(3),
	`publishedById` int,
	`publishedAt` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `AssessmentVersion_id` PRIMARY KEY(`id`),
	CONSTRAINT `AssessmentVersion_assessmentId_versionNo_key` UNIQUE(`assessmentId`,`versionNo`)
);
--> statement-breakpoint
CREATE TABLE `Assessment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(191) NOT NULL,
	`description` text,
	`instructions` text,
	`createdById` int NOT NULL,
	`status` enum('DRAFT','SUBMITTED','RETURNED','REJECTED','APPROVED','PUBLISHED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
	`maxAttempts` int NOT NULL DEFAULT 3,
	`resultRelease` enum('IMMEDIATE','AFTER_DEADLINE','MANUAL') NOT NULL DEFAULT 'IMMEDIATE',
	`resultsReleasedAt` timestamp(3),
	`sourceRef` varchar(191),
	`plannedAssignment` json,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Assessment_id` PRIMARY KEY(`id`),
	CONSTRAINT `Assessment_sourceRef_unique` UNIQUE(`sourceRef`)
);
--> statement-breakpoint
CREATE TABLE `AttemptResponse` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`questionId` int NOT NULL,
	`optionId` int,
	`textAnswer` text,
	`isCorrect` boolean,
	`activeSeconds` int NOT NULL DEFAULT 0,
	`savedAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `AttemptResponse_id` PRIMARY KEY(`id`),
	CONSTRAINT `AttemptResponse_attemptId_questionId_key` UNIQUE(`attemptId`,`questionId`)
);
--> statement-breakpoint
CREATE TABLE `Attempt` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assessmentId` int NOT NULL,
	`versionId` int NOT NULL,
	`staffId` int NOT NULL,
	`accountId` int NOT NULL,
	`attemptNo` int NOT NULL,
	`status` enum('IN_PROGRESS','SUBMITTED','PENDING_MARKING','COMPLETED','ABANDONED','EXPIRED') NOT NULL DEFAULT 'IN_PROGRESS',
	`startedAt` timestamp(3) NOT NULL DEFAULT (now()),
	`submittedAt` timestamp(3),
	`completedAt` timestamp(3),
	`activeSeconds` int NOT NULL DEFAULT 0,
	`elapsedSeconds` int NOT NULL DEFAULT 0,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Attempt_id` PRIMARY KEY(`id`),
	CONSTRAINT `Attempt_staffId_assessmentId_attemptNo_key` UNIQUE(`staffId`,`assessmentId`,`attemptNo`)
);
--> statement-breakpoint
CREATE TABLE `AuditLog` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`action` varchar(191) NOT NULL,
	`entityType` varchar(191),
	`entityId` varchar(191),
	`outcome` varchar(191) NOT NULL DEFAULT 'SUCCESS',
	`before` json,
	`after` json,
	`ip` varchar(191),
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `AuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Competency` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(191) NOT NULL,
	`name` varchar(191) NOT NULL,
	`short` varchar(191) NOT NULL,
	`categoryId` int NOT NULL,
	`departmentId` int,
	`importance` int NOT NULL DEFAULT 4,
	`requiredLevel` decimal(4,2) NOT NULL DEFAULT '5.00',
	`skillAreas` json,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Competency_id` PRIMARY KEY(`id`),
	CONSTRAINT `Competency_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `CompetencyAttemptResult` (
	`attemptId` int NOT NULL,
	`competencyId` int NOT NULL,
	`score` decimal(8,6) NOT NULL,
	`asked` int NOT NULL,
	`correct` int NOT NULL,
	CONSTRAINT `CompetencyAttemptResult_attemptId_competencyId_pk` PRIMARY KEY(`attemptId`,`competencyId`)
);
--> statement-breakpoint
CREATE TABLE `CompetencyCategory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`group` varchar(191) NOT NULL,
	CONSTRAINT `CompetencyCategory_id` PRIMARY KEY(`id`),
	CONSTRAINT `CompetencyCategory_name_group_key` UNIQUE(`name`,`group`)
);
--> statement-breakpoint
CREATE TABLE `DeadlineExtension` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`staffId` int,
	`originalDeadline` timestamp(3) NOT NULL,
	`newDeadline` timestamp(3) NOT NULL,
	`reason` text NOT NULL,
	`approvedById` int NOT NULL,
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `DeadlineExtension_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Department` (
	`id` int AUTO_INCREMENT NOT NULL,
	`code` varchar(191) NOT NULL,
	`name` varchar(191) NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Department_id` PRIMARY KEY(`id`),
	CONSTRAINT `Department_code_unique` UNIQUE(`code`),
	CONSTRAINT `Department_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `FinalCompetencyResult` (
	`staffId` int NOT NULL,
	`assessmentId` int NOT NULL,
	`competencyId` int NOT NULL,
	`average` decimal(8,6) NOT NULL,
	`attemptsIncluded` int NOT NULL,
	`competencyStatus` varchar(191) NOT NULL,
	`gapStatus` varchar(191) NOT NULL,
	`scoringConfigId` int NOT NULL,
	`computedAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `FinalCompetencyResult_staffId_assessmentId_competencyId_pk` PRIMARY KEY(`staffId`,`assessmentId`,`competencyId`)
);
--> statement-breakpoint
CREATE TABLE `GradeSupervisoryMapping` (
	`id` int AUTO_INCREMENT NOT NULL,
	`gradeId` int NOT NULL,
	`stationId` int,
	`roleLabel` varchar(191) NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `GradeSupervisoryMapping_id` PRIMARY KEY(`id`),
	CONSTRAINT `GradeSupervisoryMapping_gradeId_stationId_roleLabel_key` UNIQUE(`gradeId`,`stationId`,`roleLabel`)
);
--> statement-breakpoint
CREATE TABLE `Grade` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`rank` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Grade_id` PRIMARY KEY(`id`),
	CONSTRAINT `Grade_name_unique` UNIQUE(`name`),
	CONSTRAINT `Grade_rank_unique` UNIQUE(`rank`)
);
--> statement-breakpoint
CREATE TABLE `Location` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`region` varchar(191),
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Location_id` PRIMARY KEY(`id`),
	CONSTRAINT `Location_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `LoginAttempt` (
	`id` int AUTO_INCREMENT NOT NULL,
	`identifier` varchar(191) NOT NULL,
	`ip` varchar(191),
	`success` boolean NOT NULL,
	`reason` varchar(191),
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `LoginAttempt_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `NotificationDelivery` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationId` int NOT NULL,
	`channel` varchar(191) NOT NULL,
	`status` varchar(191) NOT NULL,
	`error` text,
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `NotificationDelivery_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `NotificationTemplate` (
	`key` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`body` text NOT NULL,
	`channels` json NOT NULL,
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `NotificationTemplate_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `Notification` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`type` varchar(191) NOT NULL,
	`title` varchar(191) NOT NULL,
	`body` text NOT NULL,
	`link` varchar(255),
	`dedupeKey` varchar(191),
	`readAt` timestamp(3),
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `Notification_id` PRIMARY KEY(`id`),
	CONSTRAINT `Notification_dedupeKey_unique` UNIQUE(`dedupeKey`)
);
--> statement-breakpoint
CREATE TABLE `QuestionCompetency` (
	`questionId` int NOT NULL,
	`competencyId` int NOT NULL,
	`weight` decimal(6,2) NOT NULL DEFAULT '1.00',
	CONSTRAINT `QuestionCompetency_questionId_competencyId_pk` PRIMARY KEY(`questionId`,`competencyId`)
);
--> statement-breakpoint
CREATE TABLE `Question` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versionId` int NOT NULL,
	`order` int NOT NULL,
	`type` enum('SINGLE_CHOICE','MULTIPLE_CHOICE','TRUE_FALSE','TEXT') NOT NULL DEFAULT 'SINGLE_CHOICE',
	`text` text NOT NULL,
	`skillArea` varchar(191),
	`points` decimal(6,2) NOT NULL DEFAULT '1.00',
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `Question_id` PRIMARY KEY(`id`),
	CONSTRAINT `Question_versionId_order_key` UNIQUE(`versionId`,`order`)
);
--> statement-breakpoint
CREATE TABLE `ScoringConfig` (
	`id` int AUTO_INCREMENT NOT NULL,
	`version` int NOT NULL,
	`requiredLevel` decimal(4,2) NOT NULL DEFAULT '5.00',
	`competentFrom` decimal(4,2) NOT NULL DEFAULT '4.00',
	`proficientFrom` decimal(4,2) NOT NULL DEFAULT '5.00',
	`moderateGapFrom` decimal(4,2) NOT NULL DEFAULT '2.50',
	`noGapFrom` decimal(4,2) NOT NULL DEFAULT '5.00',
	`defaultMaxAttempts` int NOT NULL DEFAULT 3,
	`reason` varchar(255) NOT NULL,
	`createdById` int,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`active` boolean NOT NULL DEFAULT true,
	CONSTRAINT `ScoringConfig_id` PRIMARY KEY(`id`),
	CONSTRAINT `ScoringConfig_version_unique` UNIQUE(`version`)
);
--> statement-breakpoint
CREATE TABLE `Session` (
	`id` varchar(191) NOT NULL,
	`tokenHash` varchar(191) NOT NULL,
	`accountId` int NOT NULL,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`expiresAt` timestamp(3) NOT NULL,
	`lastSeenAt` timestamp(3) NOT NULL DEFAULT (now()),
	`revokedAt` timestamp(3),
	`ip` varchar(191),
	`userAgent` text,
	CONSTRAINT `Session_id` PRIMARY KEY(`id`),
	CONSTRAINT `Session_tokenHash_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `StaffPlacementHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffId` int NOT NULL,
	`departmentId` int,
	`stationId` int,
	`fromDate` timestamp(3) NOT NULL DEFAULT (now()),
	`toDate` timestamp(3),
	`reason` text,
	`changedById` int,
	CONSTRAINT `StaffPlacementHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `StaffRecord` (
	`id` int AUTO_INCREMENT NOT NULL,
	`staffNo` varchar(191) NOT NULL,
	`firstName` varchar(191) NOT NULL,
	`lastName` varchar(191) NOT NULL,
	`otherNames` varchar(191),
	`email` varchar(191),
	`designation` varchar(191),
	`departmentId` int,
	`gradeId` int,
	`stationId` int,
	`supervisorId` int,
	`status` enum('ACTIVE','INACTIVE','LEFT') NOT NULL DEFAULT 'ACTIVE',
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `StaffRecord_id` PRIMARY KEY(`id`),
	CONSTRAINT `StaffRecord_staffNo_unique` UNIQUE(`staffNo`),
	CONSTRAINT `StaffRecord_email_unique` UNIQUE(`email`)
);
--> statement-breakpoint
CREATE TABLE `Station` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(191) NOT NULL,
	`locationId` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Station_id` PRIMARY KEY(`id`),
	CONSTRAINT `Station_locationId_name_key` UNIQUE(`locationId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `SupervisorAssignment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` int NOT NULL,
	`departmentId` int,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `SupervisorAssignment_id` PRIMARY KEY(`id`),
	CONSTRAINT `SupervisorAssignment_accountId_departmentId_key` UNIQUE(`accountId`,`departmentId`)
);
--> statement-breakpoint
CREATE TABLE `SystemSetting` (
	`key` varchar(191) NOT NULL,
	`value` json NOT NULL,
	`updatedById` int,
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `SystemSetting_key` PRIMARY KEY(`key`)
);
--> statement-breakpoint
CREATE TABLE `TicketAttachment` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`fileName` varchar(191) NOT NULL,
	`mimeType` varchar(191) NOT NULL,
	`sizeBytes` int NOT NULL,
	`storagePath` varchar(255) NOT NULL,
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `TicketAttachment_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `TicketEvent` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`actorId` int NOT NULL,
	`field` varchar(191) NOT NULL,
	`fromVal` varchar(191),
	`toVal` varchar(191),
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `TicketEvent_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `TicketMessage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorId` int NOT NULL,
	`body` text NOT NULL,
	`internal` boolean NOT NULL DEFAULT false,
	`at` timestamp(3) NOT NULL DEFAULT (now()),
	CONSTRAINT `TicketMessage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `Ticket` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reference` varchar(191) NOT NULL,
	`requesterId` int NOT NULL,
	`assigneeId` int,
	`title` varchar(191) NOT NULL,
	`category` varchar(191) NOT NULL,
	`description` text NOT NULL,
	`priority` enum('LOW','MEDIUM','HIGH','URGENT') NOT NULL DEFAULT 'MEDIUM',
	`status` enum('OPEN','ASSIGNED','IN_PROGRESS','PENDING_USER','RESOLVED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`assessmentId` int,
	`createdAt` timestamp(3) NOT NULL DEFAULT (now()),
	`updatedAt` timestamp(3) NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `Ticket_id` PRIMARY KEY(`id`),
	CONSTRAINT `Ticket_reference_unique` UNIQUE(`reference`)
);
--> statement-breakpoint
ALTER TABLE `AccountPermission` ADD CONSTRAINT `AccountPermission_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AccountRole` ADD CONSTRAINT `AccountRole_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AccountScopeDepartment` ADD CONSTRAINT `AccountScopeDepartment_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AccountScopeDepartment` ADD CONSTRAINT `AccountScopeDepartment_departmentId_Department_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Account` ADD CONSTRAINT `Account_staffId_StaffRecord_id_fk` FOREIGN KEY (`staffId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ActiveTimeSegment` ADD CONSTRAINT `ActiveTimeSegment_attemptId_Attempt_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AnswerOption` ADD CONSTRAINT `AnswerOption_questionId_Question_id_fk` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_assessmentId_Assessment_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_staffId_StaffRecord_id_fk` FOREIGN KEY (`staffId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_departmentId_Department_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_gradeId_Grade_id_fk` FOREIGN KEY (`gradeId`) REFERENCES `Grade`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_stationId_Station_id_fk` FOREIGN KEY (`stationId`) REFERENCES `Station`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_locationId_Location_id_fk` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentAssignment` ADD CONSTRAINT `AssessmentAssignment_createdById_Account_id_fk` FOREIGN KEY (`createdById`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentReviewEvent` ADD CONSTRAINT `AssessmentReviewEvent_versionId_AssessmentVersion_id_fk` FOREIGN KEY (`versionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentReviewEvent` ADD CONSTRAINT `AssessmentReviewEvent_actorId_Account_id_fk` FOREIGN KEY (`actorId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentVersion` ADD CONSTRAINT `AssessmentVersion_assessmentId_Assessment_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AssessmentVersion` ADD CONSTRAINT `AssessmentVersion_scoringConfigId_ScoringConfig_id_fk` FOREIGN KEY (`scoringConfigId`) REFERENCES `ScoringConfig`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Assessment` ADD CONSTRAINT `Assessment_createdById_Account_id_fk` FOREIGN KEY (`createdById`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AttemptResponse` ADD CONSTRAINT `AttemptResponse_attemptId_Attempt_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AttemptResponse` ADD CONSTRAINT `AttemptResponse_questionId_Question_id_fk` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AttemptResponse` ADD CONSTRAINT `AttemptResponse_optionId_AnswerOption_id_fk` FOREIGN KEY (`optionId`) REFERENCES `AnswerOption`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_assessmentId_Assessment_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_versionId_AssessmentVersion_id_fk` FOREIGN KEY (`versionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_staffId_StaffRecord_id_fk` FOREIGN KEY (`staffId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Attempt` ADD CONSTRAINT `Attempt_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `AuditLog` ADD CONSTRAINT `AuditLog_actorId_Account_id_fk` FOREIGN KEY (`actorId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Competency` ADD CONSTRAINT `Competency_categoryId_CompetencyCategory_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `CompetencyCategory`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Competency` ADD CONSTRAINT `Competency_departmentId_Department_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `CompetencyAttemptResult` ADD CONSTRAINT `CompetencyAttemptResult_attemptId_Attempt_id_fk` FOREIGN KEY (`attemptId`) REFERENCES `Attempt`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `CompetencyAttemptResult` ADD CONSTRAINT `CompetencyAttemptResult_competencyId_Competency_id_fk` FOREIGN KEY (`competencyId`) REFERENCES `Competency`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `DeadlineExtension` ADD CONSTRAINT `DeadlineExtension_assignmentId_AssessmentAssignment_id_fk` FOREIGN KEY (`assignmentId`) REFERENCES `AssessmentAssignment`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `DeadlineExtension` ADD CONSTRAINT `DeadlineExtension_staffId_StaffRecord_id_fk` FOREIGN KEY (`staffId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `DeadlineExtension` ADD CONSTRAINT `DeadlineExtension_approvedById_Account_id_fk` FOREIGN KEY (`approvedById`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `FinalCompetencyResult` ADD CONSTRAINT `FinalCompetencyResult_staffId_StaffRecord_id_fk` FOREIGN KEY (`staffId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `FinalCompetencyResult` ADD CONSTRAINT `FinalCompetencyResult_assessmentId_Assessment_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `FinalCompetencyResult` ADD CONSTRAINT `FinalCompetencyResult_competencyId_Competency_id_fk` FOREIGN KEY (`competencyId`) REFERENCES `Competency`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `FinalCompetencyResult` ADD CONSTRAINT `FinalCompetencyResult_scoringConfigId_ScoringConfig_id_fk` FOREIGN KEY (`scoringConfigId`) REFERENCES `ScoringConfig`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `GradeSupervisoryMapping` ADD CONSTRAINT `GradeSupervisoryMapping_gradeId_Grade_id_fk` FOREIGN KEY (`gradeId`) REFERENCES `Grade`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `GradeSupervisoryMapping` ADD CONSTRAINT `GradeSupervisoryMapping_stationId_Station_id_fk` FOREIGN KEY (`stationId`) REFERENCES `Station`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `NotificationDelivery` ADD CONSTRAINT `NotificationDelivery_notificationId_Notification_id_fk` FOREIGN KEY (`notificationId`) REFERENCES `Notification`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Notification` ADD CONSTRAINT `Notification_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `QuestionCompetency` ADD CONSTRAINT `QuestionCompetency_questionId_Question_id_fk` FOREIGN KEY (`questionId`) REFERENCES `Question`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `QuestionCompetency` ADD CONSTRAINT `QuestionCompetency_competencyId_Competency_id_fk` FOREIGN KEY (`competencyId`) REFERENCES `Competency`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Question` ADD CONSTRAINT `Question_versionId_AssessmentVersion_id_fk` FOREIGN KEY (`versionId`) REFERENCES `AssessmentVersion`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ScoringConfig` ADD CONSTRAINT `ScoringConfig_createdById_Account_id_fk` FOREIGN KEY (`createdById`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Session` ADD CONSTRAINT `Session_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffPlacementHistory` ADD CONSTRAINT `StaffPlacementHistory_staffId_StaffRecord_id_fk` FOREIGN KEY (`staffId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffPlacementHistory` ADD CONSTRAINT `StaffPlacementHistory_departmentId_Department_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffPlacementHistory` ADD CONSTRAINT `StaffPlacementHistory_stationId_Station_id_fk` FOREIGN KEY (`stationId`) REFERENCES `Station`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffPlacementHistory` ADD CONSTRAINT `StaffPlacementHistory_changedById_Account_id_fk` FOREIGN KEY (`changedById`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffRecord` ADD CONSTRAINT `StaffRecord_departmentId_Department_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffRecord` ADD CONSTRAINT `StaffRecord_gradeId_Grade_id_fk` FOREIGN KEY (`gradeId`) REFERENCES `Grade`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffRecord` ADD CONSTRAINT `StaffRecord_stationId_Station_id_fk` FOREIGN KEY (`stationId`) REFERENCES `Station`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `StaffRecord` ADD CONSTRAINT `StaffRecord_supervisorId_StaffRecord_id_fk` FOREIGN KEY (`supervisorId`) REFERENCES `StaffRecord`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Station` ADD CONSTRAINT `Station_locationId_Location_id_fk` FOREIGN KEY (`locationId`) REFERENCES `Location`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `SupervisorAssignment` ADD CONSTRAINT `SupervisorAssignment_accountId_Account_id_fk` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `SupervisorAssignment` ADD CONSTRAINT `SupervisorAssignment_departmentId_Department_id_fk` FOREIGN KEY (`departmentId`) REFERENCES `Department`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `SystemSetting` ADD CONSTRAINT `SystemSetting_updatedById_Account_id_fk` FOREIGN KEY (`updatedById`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `TicketAttachment` ADD CONSTRAINT `TicketAttachment_ticketId_Ticket_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `TicketEvent` ADD CONSTRAINT `TicketEvent_ticketId_Ticket_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `TicketEvent` ADD CONSTRAINT `TicketEvent_actorId_Account_id_fk` FOREIGN KEY (`actorId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_ticketId_Ticket_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `Ticket`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `TicketMessage` ADD CONSTRAINT `TicketMessage_authorId_Account_id_fk` FOREIGN KEY (`authorId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_requesterId_Account_id_fk` FOREIGN KEY (`requesterId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assigneeId_Account_id_fk` FOREIGN KEY (`assigneeId`) REFERENCES `Account`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `Ticket` ADD CONSTRAINT `Ticket_assessmentId_Assessment_id_fk` FOREIGN KEY (`assessmentId`) REFERENCES `Assessment`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `Account_staffId_idx` ON `Account` (`staffId`);--> statement-breakpoint
CREATE INDEX `ActiveTimeSegment_attemptId_idx` ON `ActiveTimeSegment` (`attemptId`);--> statement-breakpoint
CREATE INDEX `AssessmentAssignment_assessmentId_idx` ON `AssessmentAssignment` (`assessmentId`);--> statement-breakpoint
CREATE INDEX `AssessmentReviewEvent_versionId_at_idx` ON `AssessmentReviewEvent` (`versionId`,`at`);--> statement-breakpoint
CREATE INDEX `Attempt_staffId_assessmentId_status_idx` ON `Attempt` (`staffId`,`assessmentId`,`status`);--> statement-breakpoint
CREATE INDEX `AuditLog_at_idx` ON `AuditLog` (`at`);--> statement-breakpoint
CREATE INDEX `AuditLog_actorId_at_idx` ON `AuditLog` (`actorId`,`at`);--> statement-breakpoint
CREATE INDEX `AuditLog_entityType_entityId_idx` ON `AuditLog` (`entityType`,`entityId`);--> statement-breakpoint
CREATE INDEX `DeadlineExtension_assignmentId_staffId_idx` ON `DeadlineExtension` (`assignmentId`,`staffId`);--> statement-breakpoint
CREATE INDEX `LoginAttempt_identifier_at_idx` ON `LoginAttempt` (`identifier`,`at`);--> statement-breakpoint
CREATE INDEX `LoginAttempt_ip_at_idx` ON `LoginAttempt` (`ip`,`at`);--> statement-breakpoint
CREATE INDEX `Notification_accountId_readAt_idx` ON `Notification` (`accountId`,`readAt`);--> statement-breakpoint
CREATE INDEX `Session_accountId_idx` ON `Session` (`accountId`);--> statement-breakpoint
CREATE INDEX `StaffPlacementHistory_staffId_fromDate_idx` ON `StaffPlacementHistory` (`staffId`,`fromDate`);--> statement-breakpoint
CREATE INDEX `StaffRecord_departmentId_idx` ON `StaffRecord` (`departmentId`);--> statement-breakpoint
CREATE INDEX `StaffRecord_gradeId_idx` ON `StaffRecord` (`gradeId`);--> statement-breakpoint
CREATE INDEX `StaffRecord_stationId_idx` ON `StaffRecord` (`stationId`);--> statement-breakpoint
CREATE INDEX `Ticket_status_priority_idx` ON `Ticket` (`status`,`priority`);--> statement-breakpoint
CREATE INDEX `Ticket_assigneeId_idx` ON `Ticket` (`assigneeId`);