import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INITIAL_APPLICATIONS, formatLayoffReferenceId } from "@/lib/mock-data";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const cleanId = id.trim().toUpperCase();

    const demoMatch = INITIAL_APPLICATIONS.find(
      (a) =>
        a.id.toUpperCase() === cleanId ||
        a.registrationNumber.toUpperCase() === cleanId ||
        a.chassisNumber.toUpperCase() === cleanId ||
        (a.invoiceNumber && a.invoiceNumber.toUpperCase() === cleanId)
    );

    let application: any = null;
    try {
      application = await db.application.findFirst({
        where: {
          OR: [
            { id: id },
            { registrationNumber: id },
            { chassisNumber: id },
            { invoiceNumber: id },
          ],
        },
        include: {
          attachments: true,
          invoices: true,
        },
      });
    } catch {
      application = null;
    }

    if (!application) {
      if (demoMatch) {
        return NextResponse.json(demoMatch);
      }
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const docCategories = ["document", "document_title", "representative_auth", "inspection_report"];
    const applicantPhotoCategories = [
      "photo",
      "photo_front",
      "photo_side",
      "photo_rear",
      "photo_engine",
      "photo_chassis",
    ];

    const documents = application.attachments
      .filter((att: any) => docCategories.includes(att.category))
      .map((att: any) => ({
        name: att.fileName,
        size: att.fileSize,
        type: att.fileType,
        url: att.fileUrl,
        category: att.category,
      }));

    const photos = application.attachments
      .filter((att: any) => applicantPhotoCategories.includes(att.category))
      .map((att: any) => att.fileUrl);

    const inspectionPhotos = application.attachments
      .filter((att: any) => att.category === "technical_inspection_photo")
      .map((att: any) => att.fileUrl);

    const mandatoryPhotographs = {
      front: application.attachments.find((a: any) => a.category === "photo_front")?.fileUrl || photos[0] || "",
      side: application.attachments.find((a: any) => a.category === "photo_side")?.fileUrl || photos[1] || "",
      rear: application.attachments.find((a: any) => a.category === "photo_rear")?.fileUrl || photos[2] || "",
      engine: application.attachments.find((a: any) => a.category === "photo_engine")?.fileUrl || photos[3] || "",
      chassis: application.attachments.find((a: any) => a.category === "photo_chassis")?.fileUrl || photos[4] || "",
    };

    const isFlagshipDemo =
      demoMatch && (demoMatch.id === "LAY-2026-GT492022" || demoMatch.id === "LAY-2026-GE489224");

    return NextResponse.json({
      ...application,
      id: formatLayoffReferenceId(application.registrationNumber, application.submittedAt),
      ...(isFlagshipDemo
        ? {
            status: demoMatch.status,
            applicationStatus: demoMatch.applicationStatus,
            adminApprovalStatus: demoMatch.adminApprovalStatus,
            adminApprovedBy: demoMatch.adminApprovedBy,
            adminApprovedAt: demoMatch.adminApprovedAt,
            invoiceNumber: demoMatch.invoiceNumber,
            invoiceStatus: demoMatch.invoiceStatus,
            paymentStatus: demoMatch.paymentStatus,
            paymentReference: demoMatch.paymentReference,
            paymentConfirmedAt: demoMatch.paymentConfirmedAt,
            vehicleRoadStatus: demoMatch.vehicleRoadStatus,
            layoffStartDate: demoMatch.layoffStartDate,
            layoffExpiryDate: demoMatch.layoffExpiryDate,
            inspectionStatus: demoMatch.inspectionStatus,
            inspectionOutcome: demoMatch.inspectionOutcome,
            inspectionFindings: demoMatch.inspectionFindings,
            inspectionDate: demoMatch.inspectionDate,
          }
        : {}),
      documents: documents.length > 0 ? documents : demoMatch?.documents || [],
      photos: photos.length > 0 ? photos : demoMatch?.photos || [],
      inspectionPhotos,
      mandatoryPhotographs,
    });
  } catch (error) {
    console.error("Failed to fetch application detail:", error);
    return NextResponse.json({ error: "Failed to fetch application" }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const existing = await db.application.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    const {
      // General / workflow statuses
      status,
      applicationStatus,
      verificationOutcome,
      verificationNote,
      rejectionReason,

      // Administrative review
      adminApprovalStatus,
      adminApprovedBy,
      adminComments,

      // Technical inspection
      inspectionStatus,
      assignedOfficerId,
      assignedOfficerName,
      inspectionDate,
      inspectionFindings,
      inspectionDefects,
      inspectionOutcome,
      inspectionPhotos, // Array of URLs or objects with { url, category, capturedAt }
      inspectionReportUrl,
      inspectionReportFileName,
      inspectionReportUploadedAt,
      inspectionReportUploadedBy,

      // Invoicing / payment
      invoiceNumber,
      invoiceStatus,
      paymentStatus,
      paymentReference,
      layoffStartDate,
      layoffExpiryDate,
      extensionCount,

      // Vehicle Road Status
      vehicleRoadStatus,
      roadStatusReason,
      roadStatusChangedBy,

      // Actor metadata
      actorName = "DVLA System",
      actorRole = "DVLA Administrator",
    } = body;

    const now = new Date().toISOString().replace("T", " ").slice(0, 19);

    // Prepare update data
    const updateData: any = {};

    if (status !== undefined) updateData.status = status;
    if (applicationStatus !== undefined) updateData.applicationStatus = applicationStatus;
    if (verificationOutcome !== undefined) updateData.verificationOutcome = verificationOutcome;
    if (verificationNote !== undefined) updateData.verificationNote = verificationNote;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;

    // Technical inspection updates
    if (inspectionStatus !== undefined) updateData.inspectionStatus = inspectionStatus;
    if (assignedOfficerId !== undefined) updateData.assignedOfficerId = assignedOfficerId;
    if (assignedOfficerName !== undefined) updateData.assignedOfficerName = assignedOfficerName;
    if (inspectionDate !== undefined) updateData.inspectionDate = inspectionDate;
    if (inspectionFindings !== undefined) updateData.inspectionFindings = inspectionFindings;
    if (inspectionDefects !== undefined) updateData.inspectionDefects = inspectionDefects;
    if (inspectionOutcome !== undefined) updateData.inspectionOutcome = inspectionOutcome;
    if (inspectionOutcome && !existing.inspectionReportSubmittedAt) updateData.inspectionReportSubmittedAt = now;

    // Post-submission Vehicle Inspection Report (Requirement 6)
    if (inspectionReportUrl !== undefined) {
      updateData.inspectionReportUrl = inspectionReportUrl;
      updateData.inspectionReportFileName = inspectionReportFileName || "Vehicle_Inspection_Report.pdf";
      updateData.inspectionReportUploadedAt = inspectionReportUploadedAt || now;
      updateData.inspectionReportUploadedBy = inspectionReportUploadedBy || actorName;
    }

    // Admin approval updates
    if (adminApprovalStatus !== undefined) {
      updateData.adminApprovalStatus = adminApprovalStatus;
      updateData.adminApprovedAt = now;
      if (adminApprovedBy) updateData.adminApprovedBy = adminApprovedBy;
      if (adminComments !== undefined) updateData.adminComments = adminComments;
    }

    // Invoicing / Payment updates
    if (invoiceNumber !== undefined) updateData.invoiceNumber = invoiceNumber;
    if (invoiceStatus !== undefined) updateData.invoiceStatus = invoiceStatus;
    if (paymentStatus !== undefined) updateData.paymentStatus = paymentStatus;
    if (paymentReference !== undefined) updateData.paymentReference = paymentReference;
    if (layoffStartDate !== undefined) updateData.layoffStartDate = layoffStartDate;
    if (layoffExpiryDate !== undefined) updateData.layoffExpiryDate = layoffExpiryDate;
    if (extensionCount !== undefined) updateData.extensionCount = extensionCount;

    // Vehicle road status
    if (vehicleRoadStatus !== undefined) {
      updateData.vehicleRoadStatus = vehicleRoadStatus;
      updateData.roadStatusChangedAt = now;
      updateData.roadStatusReason = roadStatusReason || updateData.roadStatusReason;
      updateData.roadStatusChangedBy = roadStatusChangedBy || actorName;
    }

    const updatedApp = await db.application.update({
      where: { id },
      data: updateData,
    });

    // Handle Technical Inspection Photos upload (Requirement 5: Captured on-site using device camera)
    if (inspectionPhotos && Array.isArray(inspectionPhotos)) {
      for (let i = 0; i < inspectionPhotos.length; i++) {
        const item = inspectionPhotos[i];
        const photoUrl = typeof item === "string" ? item : item.url;
        const photoCategory = typeof item === "object" && item.category ? item.category : `view_${i + 1}`;
        const photoCapturedAt = typeof item === "object" && item.capturedAt ? item.capturedAt : now;

        await db.attachment.create({
          data: {
            applicationId: id,
            fileName: `Technical_Inspection_Photo_${photoCategory}.jpg`,
            fileUrl: photoUrl,
            fileType: "image/jpeg",
            fileSize: "1.8 MB",
            category: "technical_inspection_photo",
            uploaderRole: "TECHNICAL_OFFICER",
            uploaderName: assignedOfficerName || actorName,
            capturedAt: photoCapturedAt,
          },
        });
      }
    }

    // Handle Post-submission Inspection Report Attachment (Requirement 6)
    if (inspectionReportUrl) {
      await db.attachment.create({
        data: {
          applicationId: id,
          fileName: inspectionReportFileName || "Vehicle_Inspection_Report.pdf",
          fileUrl: inspectionReportUrl,
          fileType: "application/pdf",
          fileSize: "2.4 MB",
          category: "inspection_report",
          uploaderRole: "TECHNICAL_OFFICER",
          uploaderName: actorName,
          capturedAt: now,
        },
      });

      await recordAuditLog({
        applicationReference: id,
        vehicleReference: existing.registrationNumber,
        userName: actorName,
        userRole: "Technical Officer",
        action: "INSPECTION_REPORT_UPLOADED",
        processIdentifier: "INSPECTION_MODULE",
        previousStatus: existing.inspectionStatus,
        newStatus: existing.inspectionStatus,
        details: `Vehicle inspection report (${inspectionReportFileName || "Vehicle_Inspection_Report.pdf"}) uploaded by ${actorName}. Ready for administrative review.`,
      });
    }

    // Record Audit Logs for significant workflow events
    if (adminApprovalStatus && adminApprovalStatus !== existing.adminApprovalStatus) {
      await recordAuditLog({
        applicationReference: id,
        vehicleReference: existing.registrationNumber,
        userName: actorName,
        userRole: "DVLA Administrator",
        action: `ADMIN_REVIEW_${adminApprovalStatus.toUpperCase()}`,
        processIdentifier: "ADMIN_CONSOLE",
        previousStatus: existing.adminApprovalStatus,
        newStatus: adminApprovalStatus,
        details: `Administrative review decision: ${adminApprovalStatus}. Comments: ${adminComments || rejectionReason || "None"}`,
      });

      if (adminApprovalStatus === "Rejected") {
        await sendSMSNotification({
          recipientPhone: existing.applicantPhone,
          message: `DVLA NOTICE: Layoff application ${id} for ${existing.registrationNumber} was not approved. Reason: ${rejectionReason || "Requirements not met."}`,
          event: "Application Rejected",
          applicationId: id,
          registrationNumber: existing.registrationNumber,
        });
      }
    }

    if (inspectionOutcome && inspectionOutcome !== existing.inspectionOutcome) {
      await recordAuditLog({
        applicationReference: id,
        vehicleReference: existing.registrationNumber,
        userName: assignedOfficerName || actorName,
        userRole: "Technical Officer",
        action: "TECHNICAL_INSPECTION_SUBMITTED",
        processIdentifier: "INSPECTION_MODULE",
        previousStatus: existing.inspectionStatus,
        newStatus: inspectionStatus || "Completed",
        details: `Technical inspection submitted by ${assignedOfficerName || actorName}. Outcome: ${inspectionOutcome}. Findings: ${inspectionFindings || "None"}. Defects: ${inspectionDefects || "None"}.`,
      });
    }

    return NextResponse.json(updatedApp);
  } catch (error) {
    console.error("Failed to update application:", error);
    return NextResponse.json({ error: "Failed to update application" }, { status: 500 });
  }
}
