-- Who an assessment is for, chosen when it is created; turned into assignments when it is published.
ALTER TABLE "Assessment" ADD COLUMN "plannedAssignment" JSONB;
