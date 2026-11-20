import { NextRequest, NextResponse } from "next/server";
import { verifyVINWithVRS } from "@/lib/vrs-service";
import { recordAuditLog } from "@/lib/audit-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { vin, simulateError } = body;

    if (!vin) {
      return NextResponse.json(
        { success: false, error: "VIN/Chassis number is required." },
        { status: 400 }
      );
    }

    const result = await verifyVINWithVRS(vin, { simulateError });

    // Record audit log for VRS verification request
    await recordAuditLog({
      applicationReference: `VRS-REQ-${vin.slice(-6)}`,
      vehicleReference: result.vehicle?.registrationNumber || vin,
      userName: "Applicant Portal",
      userRole: "Applicant",
      action: result.success ? "VRS_VERIFICATION_SUCCESS" : "VRS_VERIFICATION_FAILED",
      processIdentifier: "VRS_GATEWAY",
      details: result.success
        ? `Successfully verified VIN ${vin} against VRS. Retrieved ${result.vehicle?.make} ${result.vehicle?.model} (${result.vehicle?.registrationNumber}).`
        : `VRS verification failed for VIN ${vin}: ${result.error}`,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    console.error("VRS verification endpoint error:", error);
    return NextResponse.json(
      { success: false, error: "Internal server error during VRS verification." },
      { status: 500 }
    );
  }
}
