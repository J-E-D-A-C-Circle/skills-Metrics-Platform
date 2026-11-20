import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const applicationId = searchParams.get("applicationId");
    const status = searchParams.get("status");

    const where: any = {};
    if (applicationId) where.applicationId = applicationId;
    if (status && status !== "All") where.status = status;

    const extensions = await db.extensionRequest.findMany({
      where,
      include: {
        application: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(extensions);
  } catch (error) {
    console.error("Failed to fetch extension requests:", error);
    return NextResponse.json({ error: "Failed to fetch extension requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId, requestedMonths, requestedPeriodMonths, reason } = body;
    const monthsParam = requestedMonths ?? requestedPeriodMonths ?? 3;

    if (!applicationId) {
      return NextResponse.json({ error: "Application reference is required." }, { status: 400 });
    }

    if (!reason || reason.trim().length < 5) {
      return NextResponse.json({ error: "A valid statutory reason for extending the layoff is required." }, { status: 400 });
    }

    const app = await db.application.findUnique({
      where: { id: applicationId },
      include: {
        extensionRequests: true,
      },
    });

    if (!app) {
      return NextResponse.json({ error: "Layoff application record not found." }, { status: 404 });
    }

    // Check if there is already a pending extension request
    const pendingExisting = app.extensionRequests.find(r => r.status === "Pending" || r.status === "Pending Review");
    if (pendingExisting) {
      return NextResponse.json(
        {
          error: "Pending Request Exists",
          details: `There is already an active pending extension request (${pendingExisting.id}) awaiting administrative review.`,
        },
        { status: 409 }
      );
    }

    // Calculate proposed new expiry date
    const currentExpiryStr = app.layoffExpiryDate || new Date().toISOString().split("T")[0];
    const currentExpiry = new Date(`${currentExpiryStr}T00:00:00Z`);

    const monthsToAdd = Number(monthsParam);
    const targetMonth = currentExpiry.getUTCMonth() + monthsToAdd;
    const targetYear = currentExpiry.getUTCFullYear() + Math.floor(targetMonth / 12);
    const normalizedMonth = targetMonth % 12;
    const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
    const targetDay = Math.min(currentExpiry.getUTCDate(), daysInTargetMonth);

    const proposedNewExpiry = new Date(Date.UTC(targetYear, normalizedMonth, targetDay));
    const proposedNewExpiryDate = proposedNewExpiry.toISOString().split("T")[0];

    // Fetch extension rate from SystemConfig or default to GH₵ 75 / month
    let monthlyRate = 75.0;
    try {
      const config = await db.systemConfig.findUnique({
        where: { configKey: "EXTENSION_MONTHLY_RATE" },
      });
      if (config && config.configValue) {
        const parsed = parseFloat(config.configValue);
        if (!isNaN(parsed) && parsed > 0) monthlyRate = parsed;
      }
    } catch {
      // use default
    }

    const feeAmount = monthlyRate * monthsToAdd;

    const extensionRequest = await db.extensionRequest.create({
      data: {
        applicationId: app.id,
        extensionNumber: (app.extensionCount || 0) + 1,
        previousExpiryDate: currentExpiryStr,
        requestedMonths: monthsToAdd,
        calculatedFee: feeAmount,
        status: "Pending",
        reviewComments: reason ? reason.trim() : null,
        newExpiryDate: proposedNewExpiryDate,
        paymentStatus: "Pending",
      },
    });

    // Log Activity
    await db.applicationActivity.create({
      data: {
        applicationId: app.id,
        category: "EXTENSION",
        action: "EXTENSION_REQUESTED",
        description: `Applicant ${app.applicantName} requested a ${monthsToAdd}-month layoff extension until ${proposedNewExpiryDate}. Reason: "${reason.trim()}". Calculated Fee: GH₵ ${feeAmount.toFixed(2)}.`,
        actorName: app.applicantName,
        actorRole: "Applicant",
        source: "APPLICANT",
        newValue: `Requested +${monthsToAdd} months (${proposedNewExpiryDate})`,
        referenceNumber: extensionRequest.id,
      },
    });

    // Audit log
    await recordAuditLog({
      applicationReference: app.id,
      vehicleReference: app.registrationNumber,
      userName: app.applicantName,
      userRole: "Applicant",
      action: "EXTENSION_REQUEST_SUBMITTED",
      processIdentifier: "CITIZEN_EXTENSION_MODULE",
      details: `Extension request (${extensionRequest.id}) submitted for ${monthsToAdd} months. Proposed expiry: ${proposedNewExpiryDate}.`,
    });

    // Send SMS notification
    await sendSMSNotification({
      recipientPhone: app.applicantPhone,
      message: `DVLA NOTICE: Layoff extension request for ${app.registrationNumber} (Ref: ${app.id}) received. Requested: ${monthsToAdd} months until ${proposedNewExpiryDate}. Awaiting administrative review.`,
      event: "Extension Confirmed",
      applicationId: app.id,
      registrationNumber: app.registrationNumber,
    });

    return NextResponse.json(
      {
        success: true,
        message: "Extension request submitted successfully.",
        extensionRequest,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to submit extension request:", error);
    return NextResponse.json({ error: "Failed to submit extension request" }, { status: 500 });
  }
}
