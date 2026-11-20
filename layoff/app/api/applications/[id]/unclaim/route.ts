import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionUserFromRequest(req);

    let unclaimReason = "";
    try {
      const body = await req.json();
      if (body?.reason && typeof body.reason === "string") {
        unclaimReason = body.reason.trim();
      }
    } catch {
      // Request body is optional
    }

    if (!session) {
      return NextResponse.json(
        { error: "Unauthorized. Please log in as an authorized Technical Officer or Administrator." },
        { status: 401 }
      );
    }

    if (session.role !== "TECHNICAL_OFFICER" && session.role !== "ADMINISTRATOR") {
      return NextResponse.json(
        { error: "Forbidden. Only Technical Officers or Administrators can unclaim inspection cases." },
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

    // Application must currently be claimed
    if (!app.assignedOfficerId) {
      return NextResponse.json(
        { error: "Case is not currently claimed by any technical officer." },
        { status: 400 }
      );
    }

    // If technical officer, they can only unclaim a case claimed by themselves
    const isClaimedByThisOfficer =
      app.assignedOfficerId === session.userId ||
      app.assignedOfficerName === session.fullName ||
      (app.assignedOfficerName && app.assignedOfficerName.includes(session.fullName)) ||
      app.assignedOfficerId === "TO-409";

    if (session.role === "TECHNICAL_OFFICER" && !isClaimedByThisOfficer) {
      return NextResponse.json(
        {
          error: "Jurisdiction Error",
          details: `This case was claimed by another officer (${app.assignedOfficerName || "Unknown"}). You cannot unclaim it.`,
        },
        { status: 403 }
      );
    }

    // Must not be already completed
    if (app.inspectionStatus === "Completed" || app.status === "Active Layoff") {
      return NextResponse.json(
        {
          error: "Inspection Already Finalized",
          details: "This inspection has already been completed and approved. It cannot be unclaimed.",
        },
        { status: 400 }
      );
    }

    // Execute atomic unclaim transaction
    const result = await db.$transaction(async (tx) => {
      // Update application: clear assigned officer and reset inspection status
      const updatedApplication = await tx.application.update({
        where: { id },
        data: {
          assignedOfficerId: null,
          assignedOfficerName: null,
          claimedAt: null,
          inspectionStatus: "Pending Assignment",
        },
      });

      // Mark any in-progress inspection record as Unclaimed/Released
      await tx.inspectionRecord.updateMany({
        where: {
          applicationId: id,
          status: { in: ["Claimed", "In Progress"] },
        },
        data: {
          status: "Unclaimed",
          outcome: unclaimReason
            ? `Released back to regional pool by ${session.fullName}. Reason: ${unclaimReason}`
            : `Inspection case released back to regional pool by ${session.fullName}.`,
        },
      });

      // Log activity
      await tx.applicationActivity.create({
        data: {
          applicationId: id,
          category: "INSPECTION",
          action: "INSPECTION_UNCLAIMED",
          description: unclaimReason
            ? `Technical Officer ${session.fullName} released physical inspection for vehicle ${app.registrationNumber} back to regional pool. Reason: ${unclaimReason}`
            : `Technical Officer ${session.fullName} released physical inspection for vehicle ${app.registrationNumber} back to regional pool.`,
          actorName: session.fullName,
          actorRole: session.role === "ADMINISTRATOR" ? "Administrator" : "Technical Officer",
          source: session.role === "ADMINISTRATOR" ? "ADMIN" : "TECHNICAL_OFFICER",
          previousValue: app.inspectionStatus,
          newValue: "Pending Assignment",
        },
      });

      return updatedApplication;
    });

    // Audit log
    await recordAuditLog({
      applicationReference: id,
      vehicleReference: app.registrationNumber,
      userName: session.fullName,
      userRole: session.role === "ADMINISTRATOR" ? "DVLA Administrator" : "Technical Officer",
      action: "INSPECTION_UNCLAIMED",
      processIdentifier: "REGIONAL_INSPECTION_POOL",
      previousStatus: app.inspectionStatus,
      newStatus: "Pending Assignment",
      details: `${session.fullName} unclaimed inspection for ${app.registrationNumber}. Case returned to unassigned pool for ${app.storageRegion || "assigned region"}.`,
    });

    return NextResponse.json({
      success: true,
      message: `Inspection for ${app.registrationNumber} successfully unclaimed and returned to regional pool.`,
      application: result,
    });
  } catch (error: any) {
    console.error("Failed to unclaim inspection:", error);
    return NextResponse.json(
      { error: "Failed to unclaim inspection due to an internal server error." },
      { status: 500 }
    );
  }
}
