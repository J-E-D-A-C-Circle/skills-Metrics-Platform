import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";
import { releaseExpiredClaimedCases, CLAIM_SLA_DAYS } from "@/lib/claim-sla";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionUserFromRequest(req);

    // Release any claimed cases older than 4 days before evaluating claim eligibility
    await releaseExpiredClaimedCases();

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in as an authorized Technical Officer." },
        { status: 401 }
      );
    }

    if (session.role !== "TECHNICAL_OFFICER" && session.role !== "ADMINISTRATOR") {
      return NextResponse.json(
        { error: "Forbidden. Only Technical Officers or Administrators can claim inspection cases." },
        { status: 403 }
      );
    }

    // Fetch target application
    const app = await db.application.findUnique({
      where: { id },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Must be approved by administrator first
    if (app.adminApprovalStatus !== "Approved") {
      return NextResponse.json(
        {
          error: "Case Not Eligible for Claiming",
          details: `Application ${id} has not yet been approved by an Administrator (current status: ${app.adminApprovalStatus || "Pending"}). Only approved applications enter the regional inspection pool.`,
        },
        { status: 400 }
      );
    }

    // Must not be already claimed or completed
    if (app.assignedOfficerId) {
      return NextResponse.json(
        {
          error: "Case Already Claimed",
          details: `This inspection was already claimed by ${app.assignedOfficerName || "another officer"}.`,
        },
        { status: 409 }
      );
    }

    if (app.inspectionStatus === "Completed") {
      return NextResponse.json(
        {
          error: "Inspection Already Completed",
          details: "This vehicle has already undergone technical inspection.",
        },
        { status: 400 }
      );
    }

    // Regional Isolation: Officer must belong to the vehicle storage region
    if (session.role === "TECHNICAL_OFFICER" && app.storageRegion) {
      const officerRegionNorm = session.region.trim().toLowerCase();
      const appRegionNorm = app.storageRegion.trim().toLowerCase();

      if (officerRegionNorm !== appRegionNorm) {
        return NextResponse.json(
          {
            error: "Regional Jurisdiction Restriction",
            details: `Vehicle ${app.registrationNumber} is stored in ${app.storageRegion}. Your operational jurisdiction is ${session.region}. Technical officers can only claim inspections within their assigned region.`,
          },
          { status: 403 }
        );
      }
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Execute atomic transaction to prevent race conditions (double assignment)
    const result = await db.$transaction(async (tx) => {
      // Re-verify inside transaction lock
      const fresh = await tx.application.findUnique({
        where: { id },
      });

      if (!fresh) {
        throw new Error("APPLICATION_NOT_FOUND");
      }

      if (fresh.assignedOfficerId) {
        throw new Error("ALREADY_CLAIMED");
      }

      // Update application
      const updatedApplication = await tx.application.update({
        where: { id },
        data: {
          assignedOfficerId: session.userId,
          assignedOfficerName: session.fullName,
          claimedAt: nowIso,
          inspectionStatus: "In Progress",
          applicationStatus: "Under Review",
        },
      });

      // Create inspection record
      const inspectionRecord = await tx.inspectionRecord.create({
        data: {
          applicationId: id,
          inspectionType: "INITIAL",
          officerId: session.userId,
          officerName: session.fullName,
          officerPhone: session.phone,
          region: session.region,
          status: "In Progress",
          claimedAt: now,
        },
      });

      // Log activity
      await tx.applicationActivity.create({
        data: {
          applicationId: id,
          category: "INSPECTION",
          action: "INSPECTION_CLAIMED",
          description: `Technical Officer ${session.fullName} (${session.phone}, ${session.stationLocation}) claimed physical inspection for vehicle ${fresh.registrationNumber}.`,
          actorName: session.fullName,
          actorRole: "Technical Officer",
          source: "TECHNICAL_OFFICER",
          previousValue: fresh.inspectionStatus,
          newValue: "In Progress",
          referenceNumber: inspectionRecord.id,
        },
      });

      return { updatedApplication, inspectionRecord };
    });

    // Audit log
    await recordAuditLog({
      applicationReference: id,
      vehicleReference: app.registrationNumber,
      userName: session.fullName,
      userRole: "Technical Officer",
      action: "INSPECTION_CLAIMED",
      processIdentifier: "REGIONAL_INSPECTION_POOL",
      previousStatus: app.inspectionStatus,
      newStatus: "In Progress",
      details: `Technical Officer ${session.fullName} (${session.stationLocation}) claimed inspection for ${app.registrationNumber}. Applicant notified via SMS.`,
    });

    // Notify applicant via SMS with assigned officer particulars
    const smsMessage = `DVLA LAYOFF NOTICE: Technical Officer ${session.fullName} (${session.phone}) has claimed your vehicle inspection for ${app.registrationNumber} (Ref: ${app.id}). The officer will contact you shortly to coordinate physical inspection.`;

    await sendSMSNotification({
      recipientPhone: app.applicantPhone,
      message: smsMessage,
      event: "Inspection Assigned",
      applicationId: app.id,
      registrationNumber: app.registrationNumber,
    });

    return NextResponse.json({
      success: true,
      message: `Inspection for ${app.registrationNumber} successfully claimed by ${session.fullName}. Must be completed within ${CLAIM_SLA_DAYS} days or it will be automatically released back to the regional pool.`,
      application: result.updatedApplication,
      inspectionRecord: result.inspectionRecord,
    });
  } catch (error: any) {
    console.error("Failed to claim inspection:", error);
    if (error.message === "ALREADY_CLAIMED") {
      return NextResponse.json(
        {
          error: "Inspection Already Claimed",
          details: "Another Technical Officer has just claimed this inspection.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to claim inspection due to a server error." },
      { status: 500 }
    );
  }
}
