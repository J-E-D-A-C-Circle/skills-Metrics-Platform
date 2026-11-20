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

    if (!session || session.role !== "ADMINISTRATOR") {
      return NextResponse.json(
        { error: "Unauthorized. Administrator credentials required to review extensions." },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { decision = "Approved", reviewNotes = "" } = body;

    const extension = await db.extensionRequest.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!extension) {
      return NextResponse.json({ error: "Extension request not found" }, { status: 404 });
    }

    if (extension.status !== "Pending" && extension.status !== "Pending Review") {
      return NextResponse.json(
        { error: `This extension request has already been ${extension.status.toLowerCase()}.` },
        { status: 400 }
      );
    }

    const now = new Date();
    const app = extension.application;

    if (decision === "Approved") {
      // Generate extension invoice number
      const invoiceNumber = `INV-EXT-${Date.now().toString().slice(-6)}`;

      // Create Invoice record in database
      const invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          applicationId: app.id,
          registrationNumber: app.registrationNumber,
          chassisNumber: app.chassisNumber,
          applicantName: app.applicantName,
          amount: extension.calculatedFee,
          invoiceDate: now.toISOString().split("T")[0],
          layoffStartDate: app.layoffStartDate || now.toISOString().split("T")[0],
          layoffExpiryDate: extension.newExpiryDate || app.layoffExpiryDate || "",
          paymentStatus: "Pending",
          extensionStatus: "Approved Pending Payment",
          billingDetails: JSON.stringify({
            extensionRequestId: extension.id,
            monthsAdded: extension.requestedMonths,
            previousExpiryDate: extension.previousExpiryDate || app.layoffExpiryDate,
            newExpiryDate: extension.newExpiryDate,
          }),
        },
      });

      // Update Extension Request
      const updatedExtension = await db.extensionRequest.update({
        where: { id },
        data: {
          status: "Approved",
          reviewedBy: session.fullName,
          reviewedAt: now,
          reviewComments: reviewNotes || "Statutory layoff extension approved.",
          invoiceNumber: invoice.invoiceNumber,
        },
      });

      // Log Application Activity
      await db.applicationActivity.create({
        data: {
          applicationId: app.id,
          category: "EXTENSION",
          action: "EXTENSION_APPROVED",
          description: `Administrator ${session.fullName} approved ${extension.requestedMonths}-month layoff extension until ${extension.newExpiryDate}. Invoice ${invoice.invoiceNumber} generated for GH₵ ${extension.calculatedFee.toFixed(2)}.`,
          actorName: session.fullName,
          actorRole: "DVLA Administrator",
          source: "ADMINISTRATOR",
          previousValue: "Pending",
          newValue: `Approved (Invoice: ${invoice.invoiceNumber})`,
          referenceNumber: invoice.invoiceNumber,
        },
      });

      // Record Audit Log
      await recordAuditLog({
        applicationReference: app.id,
        vehicleReference: app.registrationNumber,
        userName: session.fullName,
        userRole: "DVLA Administrator",
        action: "EXTENSION_REQUEST_APPROVED",
        processIdentifier: "ADMIN_EXTENSION_CONSOLE",
        details: `Approved extension for ${app.registrationNumber} (+${extension.requestedMonths} months). Invoice ${invoice.invoiceNumber} generated.`,
      });

      // Send SMS with payment instructions
      await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message: `DVLA NOTICE: Layoff extension approved for ${app.registrationNumber}. New expiry: ${extension.newExpiryDate}. Please pay invoice ${invoice.invoiceNumber} (GH₵ ${extension.calculatedFee.toFixed(2)}) via IPP Pro or at any DVLA banking center.`,
        event: "Invoice Generated",
        applicationId: app.id,
        registrationNumber: app.registrationNumber,
      });

      return NextResponse.json({
        success: true,
        message: "Extension approved and invoice generated.",
        extensionRequest: updatedExtension,
        invoice,
      });
    } else {
      // Rejection
      const updatedExtension = await db.extensionRequest.update({
        where: { id },
        data: {
          status: "Rejected",
          reviewedBy: session.fullName,
          reviewedAt: now,
          reviewComments: reviewNotes || "Extension request did not meet statutory requirements.",
        },
      });

      await db.applicationActivity.create({
        data: {
          applicationId: app.id,
          category: "EXTENSION",
          action: "EXTENSION_REJECTED",
          description: `Administrator ${session.fullName} rejected the extension request. Reason: "${reviewNotes || "Not approved"}".`,
          actorName: session.fullName,
          actorRole: "DVLA Administrator",
          source: "ADMINISTRATOR",
          previousValue: "Pending",
          newValue: "Rejected",
        },
      });

      await recordAuditLog({
        applicationReference: app.id,
        vehicleReference: app.registrationNumber,
        userName: session.fullName,
        userRole: "DVLA Administrator",
        action: "EXTENSION_REQUEST_REJECTED",
        processIdentifier: "ADMIN_EXTENSION_CONSOLE",
        details: `Rejected extension for ${app.registrationNumber}. Reason: ${reviewNotes}`,
      });

      await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message: `DVLA NOTICE: Layoff extension request for ${app.registrationNumber} was not approved. Reason: ${reviewNotes || "Statutory conditions not met."}`,
        event: "Application Rejected",
        applicationId: app.id,
        registrationNumber: app.registrationNumber,
      });

      return NextResponse.json({
        success: true,
        message: "Extension request rejected.",
        extensionRequest: updatedExtension,
      });
    }
  } catch (error) {
    console.error("Failed to process extension review:", error);
    return NextResponse.json({ error: "Failed to process extension review" }, { status: 500 });
  }
}
