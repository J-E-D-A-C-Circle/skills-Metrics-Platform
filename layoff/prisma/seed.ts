import { PrismaClient } from "../lib/prisma-client";
import {
  INITIAL_APPLICATIONS,
  INITIAL_INVOICES,
  INITIAL_AUDIT_LOGS,
  INITIAL_SMS_NOTIFICATIONS,
} from "../lib/mock-data";
import { OFFICIAL_DB_USERS } from "../lib/seed-users";
import { hashPassword } from "../lib/auth";

const db = new PrismaClient();

async function main() {
  console.log("Seeding database with enhanced schema...");

  // Clear existing records
  await db.attachment.deleteMany({});
  await db.invoice.deleteMany({});
  await db.application.deleteMany({});
  await db.auditLog.deleteMany({});
  await db.sMSNotification.deleteMany({});

  // Remove obsolete multi-station demo accounts and upsert official staff accounts in DB
  await db.user.deleteMany({
    where: {
      email: {
        in: ["officer.kumasi@dvla.gov.gh", "officer.western@dvla.gov.gh"],
      },
    },
  });

  const defaultPasswordHash = hashPassword("Password@123");
  for (const u of OFFICIAL_DB_USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: {
        fullName: u.fullName,
        phone: u.phone,
        role: u.role,
        region: u.region,
        stationLocation: u.stationLocation,
        staffId: u.staffId,
        isActive: u.isActive,
      },
      create: {
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        passwordHash: defaultPasswordHash,
        role: u.role,
        region: u.region,
        stationLocation: u.stationLocation,
        staffId: u.staffId,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
      },
    });
  }

  // Seed Applications
  for (const app of INITIAL_APPLICATIONS) {
    const createdApp = await db.application.create({
      data: {
        id: app.id,
        applicantName: app.applicantName,
        applicantPhone: app.applicantPhone,
        applicantEmail: app.applicantEmail,
        idNumber: app.idNumber,
        residentialAddress: app.residentialAddress,
        digitalAddress: app.digitalAddress,

        vrsVerified: app.vrsVerified ?? true,
        vrsVerificationDate: app.vrsVerificationDate,
        applicantType: app.applicantType ?? "OWNER",
        ownerName: app.ownerName,
        ownerIdNumber: app.ownerIdNumber,
        ownerPhone: app.ownerPhone,
        ownerEmail: app.ownerEmail,
        representativeName: app.representativeName,
        representativePhone: app.representativePhone,
        representativeEmail: app.representativeEmail,
        representativeIdType: app.representativeIdType,
        representativeIdNumber: app.representativeIdNumber,
        representativeRelationship: app.representativeRelationship,
        representativeAddress: app.representativeAddress,

        registrationNumber: app.registrationNumber,
        chassisNumber: app.chassisNumber,
        engineNumber: app.engineNumber,
        make: app.make,
        model: app.model,
        yearOfMake: app.yearOfMake,
        vehicleType: app.vehicleType,
        colour: app.colour,

        vehicleUsageClassification: app.vehicleUsageClassification ?? "Private",
        roadworthinessExpiryDate: app.roadworthinessExpiryDate,
        roadworthinessCutoffDate: app.roadworthinessCutoffDate,
        roadworthinessValid: app.roadworthinessValid ?? true,

        reason: app.reason,
        explanation: app.explanation,
        storageFacilityName: app.storageFacilityName,
        storageRegion: app.storageRegion,
        proposedStartDate: app.proposedStartDate,
        layoffPeriodMonths: app.layoffPeriodMonths,

        inspectionMethod: app.inspectionMethod ?? "OFFICE",
        inspectionOfficeLocation: app.inspectionOfficeLocation,
        inspectionSiteAddress: app.inspectionSiteAddress,
        inspectionSiteArea: app.inspectionSiteArea,
        inspectionContactPerson: app.inspectionContactPerson,
        inspectionContactPhone: app.inspectionContactPhone,
        inspectionNotes: app.inspectionNotes,
        inspectionStatus: app.inspectionStatus ?? "Pending Assignment",
        assignedOfficerId: app.assignedOfficerId,
        assignedOfficerName: app.assignedOfficerName,
        inspectionDate: app.inspectionDate,
        inspectionFindings: app.inspectionFindings,
        inspectionDefects: app.inspectionDefects,
        inspectionOutcome: app.inspectionOutcome,
        inspectionReportSubmittedAt: app.inspectionReportSubmittedAt,

        status: app.status,
        applicationStatus: app.applicationStatus ?? "Submitted",
        submittedAt: app.submittedAt,
        verificationOutcome: app.verificationOutcome,
        verificationNote: app.verificationNote,
        rejectionReason: app.rejectionReason,

        adminApprovalStatus: app.adminApprovalStatus ?? "Pending",
        adminApprovedBy: app.adminApprovedBy,
        adminApprovedAt: app.adminApprovedAt,
        adminComments: app.adminComments,

        invoiceNumber: app.invoiceNumber,
        invoiceStatus: app.invoiceStatus ?? (app.invoiceNumber ? "Generated" : "Not Generated"),
        paymentStatus: app.paymentStatus ?? "Pending",
        paymentReference: app.paymentReference,
        paymentConfirmedAt: app.paymentConfirmedAt,
        ippProSubmissionStatus: app.ippProSubmissionStatus ?? "Not Started",
        ippProSubmissionRef: app.ippProSubmissionRef,
        ippProSubmittedAt: app.ippProSubmittedAt,
        ippProSubmissionError: app.ippProSubmissionError,

        vehicleRoadStatus: app.vehicleRoadStatus ?? "On Road",
        roadStatusChangedAt: app.roadStatusChangedAt,
        roadStatusReason: app.roadStatusReason,
        roadStatusChangedBy: app.roadStatusChangedBy,
        returnToRoadDate: app.returnToRoadDate,
        returnToRoadNotes: app.returnToRoadNotes,

        layoffStartDate: app.layoffStartDate,
        layoffExpiryDate: app.layoffExpiryDate,
        extensionCount: app.extensionCount || 0,

        isEmergencyMechanicalFailure: app.isEmergencyMechanicalFailure ?? false,
        emergencyFee: app.emergencyFee,
        emergencyFeeReason: app.emergencyFeeReason,
        inspectionReportUrl: app.inspectionReportUrl,
        inspectionReportFileName: app.inspectionReportFileName,
        inspectionReportUploadedAt: app.inspectionReportUploadedAt,
        inspectionReportUploadedBy: app.inspectionReportUploadedBy,
      },
    });

    // Seed Documents as Attachments
    if (app.documents && app.documents.length > 0) {
      for (const doc of app.documents) {
        await db.attachment.create({
          data: {
            applicationId: createdApp.id,
            fileName: doc.name,
            fileUrl: doc.url || `/api/uploads/${doc.name}`,
            fileType: doc.type,
            fileSize: doc.size,
            category: doc.category || "document",
            uploaderRole: "APPLICANT",
          },
        });
      }
    }

    // Seed Photos as Attachments
    if (app.photos && app.photos.length > 0) {
      for (const photo of app.photos) {
        await db.attachment.create({
          data: {
            applicationId: createdApp.id,
            fileName: photo,
            fileUrl: photo.startsWith("/api") || photo.startsWith("/") ? photo : `/api/uploads/${photo}`,
            fileType: "image/jpeg",
            fileSize: "1.2 MB",
            category: "photo",
            uploaderRole: "APPLICANT",
          },
        });
      }
    }
  }

  // Seed Invoices
  for (const inv of INITIAL_INVOICES) {
    await db.invoice.create({
      data: {
        invoiceNumber: inv.invoiceNumber,
        applicationId: inv.applicationId,
        registrationNumber: inv.registrationNumber,
        chassisNumber: inv.chassisNumber,
        applicantName: inv.applicantName,
        amount: inv.amount,
        invoiceDate: inv.invoiceDate,
        layoffStartDate: inv.layoffStartDate,
        layoffExpiryDate: inv.layoffExpiryDate,
        paymentStatus: inv.paymentStatus,
        extensionStatus: inv.extensionStatus,
        ippProTransactionRef: inv.ippProTransactionRef,
      },
    });
  }

  // Seed Audit Logs
  for (const log of INITIAL_AUDIT_LOGS) {
    await db.auditLog.create({
      data: {
        id: log.id,
        timestamp: log.timestamp,
        userRole: log.userRole,
        userName: log.userName,
        action: log.action,
        referenceNumber: log.referenceNumber,
        vehicleReference: log.vehicleReference,
        previousStatus: log.previousStatus,
        newStatus: log.newStatus,
        processIdentifier: log.processIdentifier,
        details: log.details,
      },
    });
  }

  // Seed SMS Notifications
  for (const sms of INITIAL_SMS_NOTIFICATIONS) {
    await db.sMSNotification.create({
      data: {
        id: sms.id,
        recipientPhone: sms.recipientPhone,
        message: sms.message,
        event: sms.event,
        sentAt: sms.sentAt,
        status: sms.status,
      },
    });
  }

  console.log("Database seeded successfully with enhanced data models!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
