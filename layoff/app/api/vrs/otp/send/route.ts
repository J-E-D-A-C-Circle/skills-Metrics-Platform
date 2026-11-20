import { NextRequest, NextResponse } from "next/server";
import { sendVRSVerificationOTP } from "@/lib/vrs-otp-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vin } = body;

    if (!vin) {
      return NextResponse.json(
        { success: false, error: "VIN/Chassis number is required." },
        { status: 400 }
      );
    }

    const result = await sendVRSVerificationOTP(vin);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("VRS send OTP endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error while sending verification OTP." },
      { status: 500 }
    );
  }
}
