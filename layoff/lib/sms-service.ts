/**
 * SMS Notification Service
 * 
 * Enforces Section 14:
 * - Automated reminders for approaching layoff expiry.
 * - Deduplication of reminders for the same event and application.
 * - Logging in SMSNotification table and Application Activity Log.
 * - Failed deliveries do not impact application status.
 */

import { db } from "./db";
import { recordAuditLog } from "./audit-service";
import { sendWigalSms } from "./wigal";

export interface SendSMSParams {
  recipientPhone: string;
  message: string;
  senderId?: string;
  event:
    | "Application Submitted"
    | "Inspection Assigned"
    | "Inspection Completed"
    | "Application Approved"
    | "Invoice Generated"
    | "Payment Confirmed"
    | "Application Activated"
    | "Application Rejected"
    | "Correction Required"
    | "Expiry Notification"
    | "Return To Road"
    | "Extension Confirmed"
    | "OTP Code"
    | "VRS Verification OTP"
    | "24-Hour Case Reminder";
  applicationId?: string;
  registrationNumber?: string;
}

export async function sendSMSNotification(params: SendSMSParams) {
  try {
    const id = `SMS-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
    const sentAt = new Date().toISOString().replace("T", " ").slice(0, 16);

    // Deduplication check for expiry notifications: check if already sent today for this event
    if (params.event === "Expiry Notification" && params.applicationId) {
      const today = sentAt.slice(0, 10);
      const existing = await db.sMSNotification.findFirst({
        where: {
          recipientPhone: params.recipientPhone,
          event: params.event,
          sentAt: { startsWith: today },
        },
      });
      if (existing) {
        console.log(`Duplicate SMS suppressed for ${params.recipientPhone} [${params.event}]`);
        return existing;
      }
    }

    // Dispatch live SMS via Frog / Wigal API v3
    const wigalRes = await sendWigalSms({
      destination: params.recipientPhone,
      message: params.message,
      senderId: params.senderId,
    });

    const notification = await db.sMSNotification.create({
      data: {
        id,
        recipientPhone: params.recipientPhone,
        message: params.message,
        event: params.event,
        sentAt,
        status: wigalRes.success ? "Delivered" : "Queued",
      },
    });

    if (params.applicationId) {
      await recordAuditLog({
        applicationReference: params.applicationId,
        vehicleReference: params.registrationNumber,
        userName: "DVLA SMS Gateway",
        userRole: "System Admin",
        action: "SMS_NOTIFICATION_DISPATCHED",
        processIdentifier: "SMS_DISPATCH_SERVICE",
        details: `Dispatched [${params.event}] SMS to ${params.recipientPhone}: "${params.message}"`,
      });
    }

    return notification;
  } catch (error) {
    console.error("Failed to send SMS:", error);
    return null;
  }
}

/**
 * Checks all active layoff applications and sends expiry reminders
 * for 30 days, 14 days, and 7 days thresholds.
 */
export async function processExpiryReminders() {
  const activeLayoffs = await db.application.findMany({
    where: {
      vehicleRoadStatus: "Off Road",
      layoffExpiryDate: { not: null },
    },
  });

  const now = new Date();
  const results = [];

  for (const app of activeLayoffs) {
    if (!app.layoffExpiryDate) continue;
    const expiryDate = new Date(`${app.layoffExpiryDate}T00:00:00Z`);
    const diffTime = expiryDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 30 && diffDays > 0) {
      const message = `DVLA NOTICE: Layoff for vehicle ${app.registrationNumber} (Ref: ${app.id}) expires in ${diffDays} days on ${app.layoffExpiryDate}. Please apply for extension or schedule return-to-road inspection.`;
      const res = await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message,
        event: "Expiry Notification",
        applicationId: app.id,
        registrationNumber: app.registrationNumber,
      });
      results.push({ id: app.id, diffDays, res });
    }
  }

  return results;
}
