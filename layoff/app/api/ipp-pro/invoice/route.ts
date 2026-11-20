import { NextRequest, NextResponse } from "next/server";
import { generateIPPProInvoice } from "@/lib/ipp-pro-service";
import { sendSMSNotification } from "@/lib/sms-service";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId, adminUser = "DVLA Approval Authority" } = body;

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const result = await generateIPPProInvoice(applicationId, adminUser);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    // Send SMS alert with invoice details
    const app = await db.application.findUnique({ where: { id: applicationId } });
    if (app) {
      await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message: `DVLA NOTICE: Layoff invoice ${result.invoiceNumber} for vehicle ${app.registrationNumber} has been generated for GH₵ ${result.amount.toFixed(2)}. Please pay via IPP Pro to activate your layoff.`,
        event: "Invoice Generated",
        applicationId: app.id,
        registrationNumber: app.registrationNumber,
      });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("IPP Pro invoice generation error:", error);
    return NextResponse.json({ error: "Failed to generate IPP Pro invoice." }, { status: 500 });
  }
}
