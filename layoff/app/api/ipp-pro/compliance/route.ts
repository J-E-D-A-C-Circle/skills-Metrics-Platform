import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { recordAuditLog } from "@/lib/audit-service";

/**
 * IPP Pro Compliance & Roadside Enforcement Verification API
 * 
 * Statutory Authority: Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28
 * 
 * Endpoint used by:
 * - DVLA Compliance and Enforcement Unit (Accident & Roadside Inspection Teams)
 * - MTTD (Motor Traffic and Transport Department) Highway Patrol Officers
 * - Automated ANPR (Automatic Number Plate Recognition) Roadside Cameras
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const reg = searchParams.get("registrationNumber") || searchParams.get("reg");
    const vin = searchParams.get("chassisNumber") || searchParams.get("vin");

    if (!reg && !vin) {
      return NextResponse.json(
        {
          error: "Missing query parameter",
          details: "Provide registrationNumber (or reg) or chassisNumber (or vin).",
        },
        { status: 400 }
      );
    }

    const where: any = {};
    if (reg) where.registrationNumber = reg.trim().toUpperCase();
    if (vin) where.chassisNumber = vin.trim().toUpperCase();

    const application = await db.application.findFirst({
      where,
      include: {
        invoices: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
        inspectionRecords: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();
    const todayStr = now.toISOString().split("T")[0];

    // If no record found in layoff registry
    if (!application) {
      return NextResponse.json({
        found: false,
        registrationNumber: reg?.toUpperCase() || null,
        chassisNumber: vin?.toUpperCase() || null,
        vehicleRoadStatus: "On Road",
        layoffStatus: "No Layoff Record",
        isStatutorilyLaidOff: false,
        complianceAlert: "STANDARD_ROAD_VEHICLE",
        message: "No statutory layoff declaration recorded for this vehicle. Permitted on public roads subject to valid roadworthiness and insurance.",
        statute: "Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28",
        queriedAt: now.toISOString(),
      });
    }

    // Determine layoff validity
    const isExpired = application.layoffExpiryDate ? application.layoffExpiryDate < todayStr : false;
    const isOffRoad = application.vehicleRoadStatus === "Off Road";
    const isPaid = application.paymentStatus === "Paid";
    const isApproved = application.adminApprovalStatus === "Approved";

    let complianceAlert = "UNKNOWN";
    let complianceSummary = "";

    if (isOffRoad) {
      if (isExpired) {
        complianceAlert = "EXPIRED_LAYOFF_VIOLATION";
        complianceSummary = `STATUTORY VIOLATION: Layoff certificate expired on ${application.layoffExpiryDate}. Vehicle must undergo return-to-road recommissioning or renewal. Operation on public roads constitutes an offense under L.I. 2519 Reg 28(3) and Reg 243.`;
      } else {
        complianceAlert = "ACTIVE_OFF_ROAD_PROHIBITED";
        complianceSummary = `STATUTORY OFF-ROAD NOTICE: Vehicle is officially grounded under L.I. 2519 Regulation 28 until ${application.layoffExpiryDate}. Any physical operation on public roads is strictly prohibited and subject to immediate impoundment and retroactive fee liability under Reg 28(3).`;
      }
    } else {
      complianceAlert = "ON_ROAD_PERMITTED";
      complianceSummary = "Vehicle is officially registered as ON ROAD. Authorized for public highway use subject to valid roadworthiness certificate.";
    }

    // Log compliance query into audit trail
    await recordAuditLog({
      applicationReference: application.id,
      vehicleReference: application.registrationNumber,
      userName: "Compliance & Enforcement Gateway",
      userRole: "Compliance Officer",
      action: "ENFORCEMENT_QUERY",
      processIdentifier: "IPP_PRO_COMPLIANCE",
      details: `Roadside compliance query for ${application.registrationNumber} (Chassis: ${application.chassisNumber}). Status: ${application.vehicleRoadStatus}. Alert: ${complianceAlert}.`,
    });

    return NextResponse.json({
      found: true,
      applicationId: application.id,
      registrationNumber: application.registrationNumber,
      chassisNumber: application.chassisNumber,
      engineNumber: application.engineNumber,
      make: application.make,
      model: application.model,
      yearOfMake: application.yearOfMake,
      vehicleType: application.vehicleType,
      colour: application.colour,
      vehicleUsageClassification: application.vehicleUsageClassification,
      registeredOwner: application.ownerName || application.applicantName,

      // Authoritative Status
      vehicleRoadStatus: application.vehicleRoadStatus, // "On Road" | "Off Road"
      isStatutorilyLaidOff: isOffRoad && !isExpired,
      layoffStatus: isExpired ? "Expired Layoff" : isOffRoad ? "Active Layoff" : application.applicationStatus,
      layoffStartDate: application.layoffStartDate,
      layoffExpiryDate: application.layoffExpiryDate,
      declaredStorageLocation: application.storageFacilityName || application.storageRegion,
      storageRegion: application.storageRegion,

      // Fees & Admin Status
      paymentStatus: application.paymentStatus,
      invoiceNumber: application.invoiceNumber,
      adminApprovalStatus: application.adminApprovalStatus,
      lastInspectionDate: application.inspectionDate,
      lastInspectionOutcome: application.inspectionOutcome,

      // Compliance Verdict
      complianceAlert,
      complianceSummary,
      statute: "Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28",
      queriedAt: now.toISOString(),
    });
  } catch (error) {
    console.error("Compliance query error:", error);
    return NextResponse.json({ error: "Failed to process compliance query" }, { status: 500 });
  }
}
