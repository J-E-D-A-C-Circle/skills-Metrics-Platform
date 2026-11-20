import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { paymentReference = `PAY-EXT-${Date.now().toString().slice(-6)}`, paymentMethod = "IPP_PRO_MOBILE_MONEY" } = body;

    const extension = await db.extensionRequest.findUnique({
      where: { id },
      include: {
        application: true,
      },
    });

    if (!extension) {
      return NextResponse.json({ error: "Extension request not found" }, { status: 404 });
    }

    if (extension.status !== "Approved") {
      return NextResponse.json(
        { error: `Cannot pay for an extension with status "${extension.status}". Must be Approved first.` },
        { status: 400 }
      );
    }

    if (extension.paymentStatus === "Paid") {
      return NextResponse.json(
        { error: "This extension fee has already been paid." },
        { status: 409 }
      );
    }

    const app = extension.application;
    const previousExpiry = app.layoffExpiryDate || "Not Specified";
    const newExpiry = extension.newExpiryDate || app.layoffExpiryDate || "";

    // Execute atomic transaction
    const result = await db.$transaction(async (tx) => {
      // 1. Update extension request
      const updatedExtension = await tx.extensionRequest.update({
        where: { id },
        data: {
          paymentStatus: "Paid",
          paymentReference,
        },
      });

      // 2. Update invoice if exists
      if (extension.invoiceNumber) {
        await tx.invoice.updateMany({
          where: { invoiceNumber: extension.invoiceNumber },
          data: {
            paymentStatus: "Paid",
            extensionStatus: "Extended",
            ippProTransactionRef: paymentReference,
          },
        });
      }

      // 3. Update application
      const updatedApp = await tx.application.update({
        where: { id: app.id },
        data: {
          layoffExpiryDate: newExpiry,
          extensionCount: { increment: 1 },
          status: "Extended",
        },
      });

      // 4. Log application activity
      await tx.applicationActivity.create({
        data: {
          applicationId: app.id,
          category: "EXTENSION",
          action: "EXTENSION_ACTIVATED",
          description: `Layoff extension confirmed upon payment of GH₵ ${extension.calculatedFee.toFixed(2)} (Ref: ${paymentReference}). Expiry extended from ${previousExpiry} to ${newExpiry}. Extension count: ${app.extensionCount + 1}.`,
          actorName: "IPP Pro Payment Gateway",
          actorRole: "Payment Gateway",
          source: "SYSTEM_AUTOMATION",
          previousValue: previousExpiry,
          newValue: newExpiry,
          referenceNumber: paymentReference,
        },
      });

      return { updatedExtension, updatedApp };
    });

    // Record audit log
    await recordAuditLog({
      applicationReference: app.id,
      vehicleReference: app.registrationNumber,
      userName: "IPP Pro Payment Gateway",
      userRole: "Payment System",
      action: "EXTENSION_PAYMENT_CONFIRMED",
      processIdentifier: "IPP_PRO_GATEWAY",
      details: `Payment confirmed for extension ${id} (${paymentReference}). Layoff valid until ${newExpiry}.`,
    });

    // Send confirmation SMS to applicant
    await sendSMSNotification({
      recipientPhone: app.applicantPhone,
      message: `DVLA NOTICE: Layoff extension for vehicle ${app.registrationNumber} (Ref: ${app.id}) is now ACTIVE. New statutory expiry date is ${newExpiry}. Payment Ref: ${paymentReference}.`,
      event: "Extension Confirmed",
      applicationId: app.id,
      registrationNumber: app.registrationNumber,
    });

    return NextResponse.json({
      success: true,
      message: `Layoff period successfully extended to ${newExpiry}.`,
      extensionRequest: result.updatedExtension,
      application: result.updatedApp,
    });
  } catch (error) {
    console.error("Failed to confirm extension payment:", error);
    return NextResponse.json({ error: "Failed to process extension payment" }, { status: 500 });
  }
}
