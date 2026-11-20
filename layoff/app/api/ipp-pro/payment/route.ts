import { NextRequest, NextResponse } from "next/server";
import { confirmIPPProPayment } from "@/lib/ipp-pro-service";
import { sendSMSNotification } from "@/lib/sms-service";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId, paymentReference, actorName = "IPP Pro Gateway" } = body;

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const result = await confirmIPPProPayment(applicationId, paymentReference, actorName);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    // Send confirmation SMS
    const app = await db.application.findUnique({ where: { id: applicationId } });
    if (app) {
      await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message: `DVLA NOTICE: Payment confirmed (Ref: ${app.paymentReference}). Vehicle ${app.registrationNumber} is now legally laid off (Off Road) until ${app.layoffExpiryDate}. Regulation 48 applies.`,
        event: "Payment Confirmed",
        applicationId: app.id,
        registrationNumber: app.registrationNumber,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Payment confirmed, application activated, vehicle road status set to Off Road.",
      application: result.application,
    });
  } catch (error) {
    console.error("IPP Pro payment confirmation error:", error);
    return NextResponse.json({ error: "Failed to confirm payment." }, { status: 500 });
  }
}
