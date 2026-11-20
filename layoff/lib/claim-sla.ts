import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export const CLAIM_SLA_DAYS = 4;
export const CLAIM_SLA_MS = CLAIM_SLA_DAYS * 24 * 60 * 60 * 1000; // 4 days (96 hours) in milliseconds
export const CLAIM_WARNING_24H_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

/**
 * Checks whether a claimed timestamp has exceeded the 4-day completion window.
 */
export function isClaimExpired(claimedAt?: string | Date | null): boolean {
  if (!claimedAt) return false;
  const claimedTime = new Date(claimedAt).getTime();
  if (Number.isNaN(claimedTime)) return false;
  return Date.now() - claimedTime >= CLAIM_SLA_MS;
}

/**
 * Computes human-readable remaining time before a claimed case is auto-released back to the pool.
 */
export function getClaimSlaRemaining(claimedAt?: string | Date | null): {
  expired: boolean;
  isWithin24Hours: boolean;
  daysLeft: number;
  hoursLeft: number;
  label: string;
  deadlineIso: string | null;
} {
  if (!claimedAt) {
    return {
      expired: false,
      isWithin24Hours: false,
      daysLeft: CLAIM_SLA_DAYS,
      hoursLeft: 0,
      label: `${CLAIM_SLA_DAYS} days remaining (Auto-releases after 4 days)`,
      deadlineIso: null,
    };
  }

  const claimedMs = new Date(claimedAt).getTime();
  if (Number.isNaN(claimedMs)) {
    return {
      expired: false,
      isWithin24Hours: false,
      daysLeft: CLAIM_SLA_DAYS,
      hoursLeft: 0,
      label: `${CLAIM_SLA_DAYS} days remaining`,
      deadlineIso: null,
    };
  }

  const deadlineMs = claimedMs + CLAIM_SLA_MS;
  const diffMs = deadlineMs - Date.now();
  const deadlineIso = new Date(deadlineMs).toISOString().slice(0, 10);

  if (diffMs <= 0) {
    return {
      expired: true,
      isWithin24Hours: false,
      daysLeft: 0,
      hoursLeft: 0,
      label: "4-Day Window Expired — Released to Regional Pool",
      deadlineIso,
    };
  }

  const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
  const daysLeft = Math.floor(totalHours / 24);
  const hoursLeft = totalHours % 24;
  const isWithin24Hours = diffMs <= CLAIM_WARNING_24H_MS;

  const label =
    daysLeft > 0
      ? `${daysLeft}d ${hoursLeft}h left before auto-release`
      : `${Math.max(1, hoursLeft)}h left (24hr SMS Reminder Active)`;

  return {
    expired: false,
    isWithin24Hours,
    daysLeft,
    hoursLeft,
    label,
    deadlineIso,
  };
}

/**
 * Scans the database for any claimed inspection cases where `inspectionStatus` is not "Completed":
 * 1. If <= 24 hours remain before the 4-day deadline, dispatches a 24-hour reminder SMS to the Technical Officer:
 *    "Complete this case <id> (<reg>) in 24 hours else it will be released into the pool."
 * 2. If `claimedAt` is older than 4 days, atomically releases the case back into the regional pool.
 */
export async function releaseExpiredClaimedCases(): Promise<number> {
  try {
    const claimedCases = await db.application.findMany({
      where: {
        assignedOfficerId: { not: null },
        inspectionStatus: { in: ["In Progress", "Assigned"] },
        claimedAt: { not: null },
      },
      include: {
        inspectionRecords: true,
      },
    });

    let releasedCount = 0;

    for (const app of claimedCases) {
      if (!app.claimedAt) continue;
      const claimedMs = new Date(app.claimedAt).getTime();
      if (Number.isNaN(claimedMs)) continue;

      const deadlineMs = claimedMs + CLAIM_SLA_MS;
      const diffMs = deadlineMs - Date.now();

      // Resolve Technical Officer phone number
      let officerPhone = "+233 24 987 6543";
      const activeInspRecord = app.inspectionRecords?.find(
        (r) => r.status === "In Progress" || r.status === "Claimed"
      );
      if (activeInspRecord?.officerPhone) {
        officerPhone = activeInspRecord.officerPhone;
      } else if (app.assignedOfficerId) {
        const officerUser = await db.user.findFirst({
          where: {
            OR: [{ id: app.assignedOfficerId }, { staffId: app.assignedOfficerId }],
          },
        });
        if (officerUser?.phone) {
          officerPhone = officerUser.phone;
        }
      }

      // CASE 1: 24-Hour Warning Window (between 0 and 24 hours left before 4-day expiry)
      if (diffMs > 0 && diffMs <= CLAIM_WARNING_24H_MS) {
        const officerCleanName =
          app.assignedOfficerName?.replace(/\s*\(.*?\)\s*/g, "").trim() ||
          app.assignedOfficerId ||
          "Technical Officer";
        const warningMsg = `Officer ${officerCleanName}, complete this case ${app.id} (${app.registrationNumber}) in 24 hours else it will be released into the pool.`;

        // Deduplicate so we only send one 24h warning per claim cycle
        const alreadySent = await db.sMSNotification.findFirst({
          where: {
            recipientPhone: officerPhone,
            event: "24-Hour Case Reminder",
            message: { contains: app.id },
          },
        });

        if (!alreadySent) {
          await sendSMSNotification({
            recipientPhone: officerPhone,
            message: warningMsg,
            event: "24-Hour Case Reminder",
            applicationId: app.id,
            registrationNumber: app.registrationNumber,
          });
        }
        continue;
      }

      // CASE 2: 4-Day Window Expired -> Release back into the Regional Pool
      if (diffMs <= 0) {
        const previousOfficerName =
          app.assignedOfficerName || app.assignedOfficerId || "Technical Officer";

        await db.$transaction(async (tx) => {
          await tx.application.update({
            where: { id: app.id },
            data: {
              assignedOfficerId: null,
              assignedOfficerName: null,
              claimedAt: null,
              inspectionStatus: "Pending Assignment",
            },
          });

          await tx.inspectionRecord.updateMany({
            where: {
              applicationId: app.id,
              status: { in: ["Claimed", "In Progress"] },
            },
            data: {
              status: "Unclaimed",
              outcome: `Automatically released back to regional pool after ${CLAIM_SLA_DAYS} days without completion by ${previousOfficerName}.`,
            },
          });

          await tx.applicationActivity.create({
            data: {
              applicationId: app.id,
              category: "INSPECTION",
              action: "INSPECTION_AUTO_RELEASED_SLA_EXPIRED",
              description: `Case ${app.id} (${app.registrationNumber}) was automatically released back to the ${app.storageRegion || "regional"} pool because ${previousOfficerName} did not complete the inspection within ${CLAIM_SLA_DAYS} days of claiming.`,
              actorName: "DVLA SLA Enforcement Daemon",
              actorRole: "System",
              source: "SYSTEM",
              previousValue: app.inspectionStatus,
              newValue: "Pending Assignment",
            },
          });
        });

        await recordAuditLog({
          applicationReference: app.id,
          vehicleReference: app.registrationNumber,
          userName: "DVLA SLA Enforcement Daemon",
          userRole: "System Admin",
          action: "INSPECTION_AUTO_RELEASED_SLA_EXPIRED",
          processIdentifier: "REGIONAL_INSPECTION_POOL",
          previousStatus: "In Progress",
          newStatus: "Pending Assignment",
          details: `Case claimed by ${previousOfficerName} on ${app.claimedAt} exceeded the ${CLAIM_SLA_DAYS}-day inspection completion window and was automatically released back into the regional pool.`,
        });

        releasedCount++;
      }
    }

    return releasedCount;
  } catch (err) {
    console.error("Failed to check/release expired claimed cases:", err);
    return 0;
  }
}
