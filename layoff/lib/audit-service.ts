/**
 * Centralized Application Activity Log and System Audit Trail Service
 * 
 * Enforces Section 4 & 13:
 * - Dedicated, comprehensive Activity Log per application throughout its lifecycle.
 * - Categories: APPLICATION, PAYMENT, INSPECTION, EXTENSION, COMMUNICATION, ADMINISTRATIVE.
 * - Captures actor, role, category, source (APPLICANT, ADMINISTRATOR, TECHNICAL_OFFICER, SYSTEM_AUTOMATION),
 *   previous/new values, timestamps, reference numbers, and expandable metadata.
 * - Protected against unauthorized modification or deletion.
 */

import { db } from "./db";

export type ActivityCategory =
  | "APPLICATION"
  | "PAYMENT"
  | "INSPECTION"
  | "EXTENSION"
  | "COMMUNICATION"
  | "ADMINISTRATIVE";

export type ActivitySource =
  | "APPLICANT"
  | "ADMINISTRATOR"
  | "TECHNICAL_OFFICER"
  | "SYSTEM_AUTOMATION";

export interface RecordActivityParams {
  applicationId: string;
  category: ActivityCategory;
  action: string;
  description: string;
  actorName: string;
  actorRole: string;
  source?: ActivitySource;
  previousValue?: string | null;
  newValue?: string | null;
  referenceNumber?: string | null;
  metadata?: Record<string, any> | string | null;
}

export interface CreateAuditLogParams {
  applicationReference: string;
  vehicleReference?: string;
  userName: string;
  userRole: "Applicant" | "Representative" | "Technical Officer" | "DVLA Administrator" | "System Admin" | string;
  action: string;
  processIdentifier?: string;
  previousStatus?: string | null;
  newStatus?: string | null;
  details: string;
  category?: ActivityCategory;
}

/**
 * Records a detailed chronological activity for a specific application
 */
export async function recordApplicationActivity(params: RecordActivityParams) {
  try {
    const metaStr =
      typeof params.metadata === "object" && params.metadata !== null
        ? JSON.stringify(params.metadata)
        : params.metadata || null;

    const activity = await db.applicationActivity.create({
      data: {
        applicationId: params.applicationId,
        category: params.category,
        action: params.action,
        description: params.description,
        actorName: params.actorName,
        actorRole: params.actorRole,
        source: params.source || "SYSTEM_AUTOMATION",
        previousValue: params.previousValue || null,
        newValue: params.newValue || null,
        referenceNumber: params.referenceNumber || null,
        metadata: metaStr,
      },
    });

    // Also mirror to global audit_logs table for legacy audit compliance
    const logId = `LOG-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

    await db.auditLog.create({
      data: {
        id: logId,
        timestamp,
        userRole: params.actorRole,
        userName: params.actorName,
        action: params.action,
        referenceNumber: params.applicationId,
        previousStatus: params.previousValue || null,
        newStatus: params.newValue || null,
        processIdentifier: params.category,
        details: params.description,
      },
    });

    return activity;
  } catch (error) {
    console.error("Failed to record application activity:", error);
    return null;
  }
}

/**
 * Global audit log helper maintaining backward compatibility while writing to both tables
 */
export async function recordAuditLog(params: CreateAuditLogParams) {
  try {
    const id = `LOG-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);

    const log = await db.auditLog.create({
      data: {
        id,
        timestamp,
        userRole: params.userRole,
        userName: params.userName,
        action: params.action,
        referenceNumber: params.applicationReference,
        vehicleReference: params.vehicleReference || null,
        previousStatus: params.previousStatus || null,
        newStatus: params.newStatus || null,
        processIdentifier: params.processIdentifier || null,
        details: params.details,
      },
    });

    // Map to an activity category if application reference exists
    if (params.applicationReference) {
      let inferredCategory: ActivityCategory = "ADMINISTRATIVE";
      let inferredSource: ActivitySource = "SYSTEM_AUTOMATION";

      if (params.action.includes("PAYMENT") || params.action.includes("INVOICE")) {
        inferredCategory = "PAYMENT";
      } else if (params.action.includes("INSPECTION")) {
        inferredCategory = "INSPECTION";
        inferredSource = "TECHNICAL_OFFICER";
      } else if (params.action.includes("SMS") || params.action.includes("EMAIL")) {
        inferredCategory = "COMMUNICATION";
      } else if (params.action.includes("EXTENSION")) {
        inferredCategory = "EXTENSION";
      } else if (params.action.includes("SUBMITTED")) {
        inferredCategory = "APPLICATION";
        inferredSource = "APPLICANT";
      } else if (params.userRole.toLowerCase().includes("admin")) {
        inferredSource = "ADMINISTRATOR";
      }

      await db.applicationActivity.create({
        data: {
          applicationId: params.applicationReference,
          category: params.category || inferredCategory,
          action: params.action,
          description: params.details,
          actorName: params.userName,
          actorRole: params.userRole,
          source: inferredSource,
          previousValue: params.previousStatus || null,
          newValue: params.newStatus || null,
          referenceNumber: params.vehicleReference || params.applicationReference,
        },
      }).catch(() => null); // Silently ignore if app doesn't exist yet
    }

    return log;
  } catch (error) {
    console.error("Failed to write audit log:", error);
    return null;
  }
}

/**
 * Retrieves the complete chronological activity log for an application
 */
export async function getApplicationActivities(applicationId: string) {
  return db.applicationActivity.findMany({
    where: { applicationId },
    orderBy: { timestamp: "desc" },
  });
}
