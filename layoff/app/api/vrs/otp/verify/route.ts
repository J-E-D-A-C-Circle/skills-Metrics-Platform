import { NextRequest, NextResponse } from "next/server";
import { verifyVRSOTP } from "@/lib/vrs-otp-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vin, otp } = body;

    if (!vin || !otp) {
      return NextResponse.json(
        { success: false, error: "Both VIN/Chassis number and OTP code are required." },
        { status: 400 }
      );
    }

    const result = await verifyVRSOTP(vin, otp);

    if (!result.success) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("VRS verify OTP endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error while verifying OTP code." },
      { status: 500 }
    );
  }
}
