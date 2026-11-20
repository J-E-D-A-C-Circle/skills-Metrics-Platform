import { NextRequest, NextResponse } from "next/server";
import { returnVehicleToRoad } from "@/lib/ipp-pro-service";
import { sendSMSNotification } from "@/lib/sms-service";
import { db } from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { officerName = "DVLA Compliance Officer", notes = "" } = body;

    const result = await returnVehicleToRoad(id, officerName, notes);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    const app = await db.application.findUnique({ where: { id } });
    if (app) {
      await sendSMSNotification({
        recipientPhone: app.applicantPhone,
        message: `DVLA NOTICE: Vehicle ${app.registrationNumber} has been formally returned to road use following compliance verification. Road status is now ON ROAD. Safe driving.`,
        event: "Return To Road",
        applicationId: id,
        registrationNumber: app.registrationNumber,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Vehicle formally returned to road use. Road status updated to On Road.",
    });
  } catch (error) {
    console.error("Return to road error:", error);
    return NextResponse.json({ error: "Failed to return vehicle to road." }, { status: 500 });
  }
}
