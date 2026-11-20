import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";
import { ensureDatabaseUsersPopulated } from "@/lib/seed-users";
import { formatLayoffReferenceId } from "@/lib/mock-data";

export async function GET(req: NextRequest) {
  try {
    await ensureDatabaseUsersPopulated();

    const session = getSessionUserFromRequest(req);
    const { searchParams } = new URL(req.url);
    const regionFilter =
      searchParams.get("region") ||
      (session?.role === "TECHNICAL_OFFICER" ? session.region : null);

    const todayStr = new Date().toISOString().split("T")[0];
    const regionNorm = (regionFilter || "Greater Accra").trim().toLowerCase();

    // Fetch applications that have completed their first (initial) inspection
    const allApps = await db.application.findMany({
      where: {
        inspectionStatus: "Completed",
      },
      include: {
        inspectionRecords: {
          orderBy: { createdAt: "desc" },
        },
        attachments: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Filter to region (matching storageRegion or inspection station in Greater Accra)
    const regionalApps = allApps.filter((app) => {
      if (!regionFilter || regionFilter === "All") return true;
      const appReg = (app.storageRegion || "Greater Accra").trim().toLowerCase();
      if (appReg === regionNorm) return true;
      if (
        regionNorm === "greater accra" &&
        (app.inspectionOfficeLocation?.toLowerCase().includes("accra") ||
          app.inspectionOfficeLocation?.toLowerCase().includes("37") ||
          app.inspectionOfficeLocation?.toLowerCase().includes("tema"))
      ) {
        return true;
      }
      return false;
    });

    const requiredFollowUps = regionalApps.map((app) => {
      const normalizedId = formatLayoffReferenceId(app.registrationNumber, app.submittedAt);
      const isExpired = app.layoffExpiryDate ? app.layoffExpiryDate < todayStr : false;
      const existingFollowUp = app.inspectionRecords.find(
        (r) => r.inspectionType === "FOLLOW_UP" && r.status !== "Unclaimed"
      );

      // Extract First Inspection photos submitted by the previous Technical Officer
      const firstPhotos = app.attachments
        .filter(
          (att) =>
            att.category === "technical_inspection_photo" ||
            att.category.startsWith("photo")
        )
        .map((att) => att.fileUrl);

      const followUpPhotos = app.attachments
        .filter((att) => att.category === "followup_inspection_photo")
        .map((att) => att.fileUrl);

      const followUpStatus = existingFollowUp
        ? existingFollowUp.status === "Completed"
          ? "Completed"
          : existingFollowUp.status === "In Progress" || existingFollowUp.status === "Claimed"
          ? "In Progress"
          : "Pending Assignment"
        : "Pending Assignment";

      return {
        applicationId: normalizedId,
        rawApplicationId: app.id,
        registrationNumber: app.registrationNumber,
        make: app.make,
        model: app.model,
        yearOfMake: app.yearOfMake || "2022",
        colour: app.colour || "Standard",
        chassisNumber: app.chassisNumber,
        applicantName: app.applicantName,
        applicantPhone: app.applicantPhone,
        ownerName: app.ownerName || app.applicantName,
        storageRegion: app.storageRegion || "Greater Accra",
        storageFacilityName: app.storageFacilityName || "Declared Storage Facility",
        inspectionMethod: app.inspectionMethod || "OFFICE",
        inspectionOfficeLocation: app.inspectionOfficeLocation,
        inspectionSiteAddress: app.inspectionSiteAddress,
        inspectionSiteArea: app.inspectionSiteArea,
        inspectionContactPerson: app.inspectionContactPerson,
        inspectionContactPhone: app.inspectionContactPhone,
        layoffStartDate: app.layoffStartDate || app.proposedStartDate,
        layoffExpiryDate: app.layoffExpiryDate || "2027-03-01",
        vehicleRoadStatus: app.vehicleRoadStatus || "Off Road",
        isExpired,

        // Previous Technical Officer's First Inspection Submission Details
        previousOfficerId: app.assignedOfficerId || "TO-409",
        previousOfficerName: app.assignedOfficerName || "Ing. Samuel Annan",
        firstInspectionDate: app.inspectionDate || app.submittedAt?.slice(0, 10) || "2026-09-02",
        firstInspectionFindings:
          app.inspectionFindings ||
          "Physical inspection completed. Vehicle immobilized and verified at declared storage location.",
        firstInspectionDefects:
          app.inspectionDefects || "No critical structural defects beyond declared mechanical overhaul.",
        firstInspectionOutcome:
          app.inspectionOutcome || "Inspection completed successfully",
        firstInspectionPhotos:
          firstPhotos.length > 0
            ? firstPhotos.slice(0, 5)
            : [
                "/placeholder-car-front.jpg",
                "/placeholder-car-side.jpg",
                "/placeholder-car-rear.jpg",
                "/placeholder-car-engine.jpg",
                "/placeholder-car-chassis.jpg",
              ],
        firstInspectionReportUrl: app.inspectionReportUrl || null,
        firstInspectionReportFileName: app.inspectionReportFileName || null,

        // Current Follow-Up Claim & Submission State
        followUpStatus,
        hasFollowUpScheduled: followUpStatus !== "Pending Assignment",
        followUpRecordId: existingFollowUp?.id || null,
        followUpOfficerId: existingFollowUp?.officerId || null,
        followUpOfficerName: existingFollowUp?.officerName || null,
        followUpOfficerPhone: existingFollowUp?.officerPhone || null,
        followUpClaimedAt: existingFollowUp?.claimedAt
          ? existingFollowUp.claimedAt.toISOString()
          : null,
        followUpConductedAt: existingFollowUp?.conductedAt
          ? existingFollowUp.conductedAt.toISOString().slice(0, 10)
          : null,
        followUpFindings: existingFollowUp?.findings || null,
        followUpDefects: existingFollowUp?.defects || null,
        followUpOutcome: existingFollowUp?.outcome || null,
        followUpReportUrl: existingFollowUp?.reportUrl || null,
        followUpPhotos,
      };
    });

    return NextResponse.json({
      requiredFollowUps,
    });
  } catch (error) {
    console.error("Failed to fetch follow up inspections:", error);
    return NextResponse.json(
      { error: "Failed to fetch follow-up inspections", requiredFollowUps: [] },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseUsersPopulated();

    const session = getSessionUserFromRequest(req);
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const {
      applicationId,
      action = "CLAIM", // "CLAIM" | "UNCLAIM" | "COMPLETE"
      findings,
      defects,
      outcome,
      photos = [],
      reportUrl,
      reason,
    } = body;

    if (!applicationId) {
      return NextResponse.json({ error: "Missing applicationId" }, { status: 400 });
    }

    // Find application by ID or registration number derived from LAY-YEAR-REG
    const cleanRegFromId = applicationId.replace(/^LAY-\d{4}-/i, "");
    const app = await db.application.findFirst({
      where: {
        OR: [
          { id: applicationId },
          { registrationNumber: cleanRegFromId },
        ],
      },
      include: {
        inspectionRecords: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "Application not found" }, { status: 404 });
    }

    // Resolve valid User ID in DB for foreign key on InspectionRecord
    let dbOfficer = await db.user.findFirst({
      where: {
        OR: [
          { id: session.userId },
          { email: session.email },
          ...(session.staffId ? [{ staffId: session.staffId }] : []),
        ],
      },
    });

    if (!dbOfficer) {
      dbOfficer = await db.user.findFirst({
        where: { role: "TECHNICAL_OFFICER" },
      });
    }

    const validOfficerId = dbOfficer?.id || session.userId;

    const existingFollowUp = app.inspectionRecords.find(
      (r) => r.inspectionType === "FOLLOW_UP" && r.status !== "Unclaimed"
    );

    // ─── ACTION 1: CLAIM FOLLOW-UP CASE ───
    if (action === "CLAIM") {
      if (existingFollowUp && (existingFollowUp.status === "In Progress" || existingFollowUp.status === "Completed")) {
        return NextResponse.json(
          {
            error: "Follow-Up Case Already Claimed",
            details: `This follow-up inspection is already claimed by ${existingFollowUp.officerName}.`,
          },
          { status: 409 }
        );
      }

      const record = await db.inspectionRecord.create({
        data: {
          applicationId: app.id,
          inspectionType: "FOLLOW_UP",
          officerId: validOfficerId,
          officerName: session.fullName,
          officerPhone: session.phone,
          region: session.region,
          status: "In Progress",
          claimedAt: new Date(),
          recommendations: `Follow-up inspection claimed after initial inspection by ${app.assignedOfficerName || "Previous Officer"}.`,
        },
      });

      await db.applicationActivity.create({
        data: {
          applicationId: app.id,
          category: "INSPECTION",
          action: "FOLLOW_UP_CLAIMED",
          description: `Technical Officer ${session.fullName} (${session.stationLocation}) claimed Follow-Up Inspection for vehicle ${app.registrationNumber}.`,
          actorName: session.fullName,
          actorRole: "Technical Officer",
          source: "TECHNICAL_OFFICER",
          previousValue: "Pending Follow-Up",
          newValue: "Follow-Up In Progress",
          referenceNumber: record.id,
        },
      });

      await recordAuditLog({
        applicationReference: app.id,
        vehicleReference: app.registrationNumber,
        userName: session.fullName,
        userRole: "Technical Officer",
        action: "FOLLOW_UP_INSPECTION_CLAIMED",
        processIdentifier: "FOLLOW_UP_INSPECTION_POOL",
        details: `Technical Officer ${session.fullName} claimed follow-up inspection for ${app.registrationNumber} (First inspection was conducted by ${app.assignedOfficerName || "Technical Officer"}).`,
      });

      await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message: `DVLA NOTICE: Technical Officer ${session.fullName} (${session.phone}) has claimed the statutory follow-up inspection for vehicle ${app.registrationNumber} (Ref: ${app.id}).`,
        event: "Inspection Assigned",
        applicationId: app.id,
        registrationNumber: app.registrationNumber,
      });

      return NextResponse.json({
        success: true,
        message: `Follow-up inspection for ${app.registrationNumber} claimed by ${session.fullName}. Moved to My Active Inspections (Follow-Up switcher).`,
        record,
      });
    }

    // ─── ACTION 2: UNCLAIM FOLLOW-UP CASE ───
    if (action === "UNCLAIM") {
      if (!existingFollowUp) {
        return NextResponse.json(
          { error: "Follow-up case is not currently claimed." },
          { status: 400 }
        );
      }

      await db.inspectionRecord.update({
        where: { id: existingFollowUp.id },
        data: {
          status: "Unclaimed",
          outcome: reason
            ? `Follow-up released back to pool by ${session.fullName}: ${reason}`
            : `Follow-up released back to pool by ${session.fullName}.`,
        },
      });

      await recordAuditLog({
        applicationReference: app.id,
        vehicleReference: app.registrationNumber,
        userName: session.fullName,
        userRole: "Technical Officer",
        action: "FOLLOW_UP_INSPECTION_UNCLAIMED",
        processIdentifier: "FOLLOW_UP_INSPECTION_POOL",
        details: `Technical Officer ${session.fullName} released follow-up inspection for ${app.registrationNumber} back into the regional follow-up pool.`,
      });

      return NextResponse.json({
        success: true,
        message: `Follow-up inspection for ${app.registrationNumber} released back to the follow-up pool.`,
      });
    }

    // ─── ACTION 3: COMPLETE & SUBMIT FOLLOW-UP INSPECTION FINDINGS + PHOTOS ───
    if (action === "COMPLETE") {
      if (!findings || !findings.trim()) {
        return NextResponse.json(
          { error: "Please provide detailed follow-up inspection findings." },
          { status: 400 }
        );
      }

      let recordId = existingFollowUp?.id;
      if (recordId) {
        await db.inspectionRecord.update({
          where: { id: recordId },
          data: {
            status: "Completed",
            conductedAt: new Date(),
            findings: findings.trim(),
            defects: (defects && defects.trim()) || "No new defects observed during follow-up.",
            outcome: outcome || "Inspection completed successfully",
            reportUrl: reportUrl || existingFollowUp?.reportUrl || null,
          },
        });
      } else {
        const created = await db.inspectionRecord.create({
          data: {
            applicationId: app.id,
            inspectionType: "FOLLOW_UP",
            officerId: validOfficerId,
            officerName: session.fullName,
            officerPhone: session.phone,
            region: session.region,
            status: "Completed",
            claimedAt: new Date(),
            conductedAt: new Date(),
            findings: findings.trim(),
            defects: (defects && defects.trim()) || "No new defects observed during follow-up.",
            outcome: outcome || "Inspection completed successfully",
            reportUrl: reportUrl || null,
          },
        });
        recordId = created.id;
      }

      // Save follow-up inspection photos
      if (Array.isArray(photos) && photos.length > 0) {
        await db.attachment.deleteMany({
          where: {
            applicationId: app.id,
            category: "followup_inspection_photo",
          },
        });

        for (let idx = 0; idx < photos.length; idx++) {
          const photoUrl = photos[idx];
          if (!photoUrl) continue;
          await db.attachment.create({
            data: {
              applicationId: app.id,
              fileName: `FollowUp_Photo_${idx + 1}.jpg`,
              fileUrl: photoUrl,
              fileType: "image/jpeg",
              fileSize: "420 KB",
              category: "followup_inspection_photo",
              uploaderRole: "TECHNICAL_OFFICER",
            },
          });
        }
      }

      await db.applicationActivity.create({
        data: {
          applicationId: app.id,
          category: "INSPECTION",
          action: "FOLLOW_UP_COMPLETED",
          description: `Follow-up physical inspection completed by Technical Officer ${session.fullName}. Outcome: ${outcome || "Inspection completed successfully"}.`,
          actorName: session.fullName,
          actorRole: "Technical Officer",
          source: "TECHNICAL_OFFICER",
          previousValue: "Follow-Up In Progress",
          newValue: "Follow-Up Completed",
          referenceNumber: recordId,
        },
      });

      await recordAuditLog({
        applicationReference: app.id,
        vehicleReference: app.registrationNumber,
        userName: session.fullName,
        userRole: "Technical Officer",
        action: "FOLLOW_UP_INSPECTION_COMPLETED",
        processIdentifier: "FOLLOW_UP_INSPECTION_POOL",
        details: `Follow-up inspection finalized by ${session.fullName} for ${app.registrationNumber}. Findings: ${findings.trim()}`,
      });

      return NextResponse.json({
        success: true,
        message: `Follow-up inspection findings and photos submitted for ${app.registrationNumber}.`,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("Failed to process follow up inspection:", error);
    return NextResponse.json(
      { error: "Failed to process follow-up inspection" },
      { status: 500 }
    );
  }
}
