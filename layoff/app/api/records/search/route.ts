import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INITIAL_APPLICATIONS, INITIAL_INVOICES } from "@/lib/mock-data";
import { sha256Bytes, bytesToBase64Url } from "@/lib/crypto-portable";
import { recordAuditLog } from "@/lib/audit-service";

/**
 * DVLA Layoff Registry Evidential Dossier & Multi-Record Search API
 * 
 * Statutory Authority: Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28
 * Evidence Act, 1975 (N.R.C.D. 323), Section 51 (Public Registry Records)
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim() || "";

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Search query must be at least 2 characters long." },
        { status: 400 }
      );
    }

    const cleanQuery = query.toUpperCase();
    const cleanDigits = query.replace(/\D/g, "");

    // Helper to convert a mock application into a DB-shaped application record
    const mapMockApp = (mockApp: any) => ({
      ...mockApp,
      invoices: INITIAL_INVOICES.filter(
        (inv) => inv.applicationId === mockApp.id || inv.invoiceNumber === mockApp.invoiceNumber
      ),
      inspectionRecords: [],
      extensionRequests: [],
      declarationAcceptances: [
        {
          applicantName: mockApp.ownerName || mockApp.applicantName,
          acceptedAt: mockApp.submittedAt ? new Date(mockApp.submittedAt.replace(" ", "T")).toISOString() : new Date().toISOString(),
        },
      ],
      attachments: [],
      activities: [],
    });

    // 1. First find any matching application matching the specific search term
    let matchedApps: any[] = [];
    try {
      matchedApps = await db.application.findMany({
        where: {
          OR: [
            { id: { contains: query } },
            { registrationNumber: { contains: query } },
            { chassisNumber: { contains: query } },
            { idNumber: { contains: query } },
            { applicantName: { contains: query } },
            { applicantEmail: { contains: query } },
            { ownerName: { contains: query } },
            { adminApprovedBy: { contains: query } },
            { invoiceNumber: { contains: query } },
            ...(cleanDigits.length >= 6 ? [{ applicantPhone: { contains: cleanDigits } }] : []),
            { invoices: { some: { invoiceNumber: { contains: query } } } },
          ],
        },
        include: {
          invoices: { orderBy: { createdAt: "desc" } },
          inspectionRecords: { orderBy: { createdAt: "desc" } },
          extensionRequests: { orderBy: { createdAt: "desc" } },
          declarationAcceptances: true,
          attachments: true,
          activities: { orderBy: { timestamp: "desc" }, take: 20 },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      matchedApps = [];
    }

    // Also match against INITIAL_APPLICATIONS for demo certificate records
    const mockMatches = INITIAL_APPLICATIONS.filter((a) => {
      const appDigits = (a.applicantPhone || "").replace(/\D/g, "");
      const ownerDigits = (a.ownerPhone || "").replace(/\D/g, "");
      return (
        a.id.toUpperCase().includes(cleanQuery) ||
        a.registrationNumber.toUpperCase().includes(cleanQuery) ||
        a.chassisNumber.toUpperCase().includes(cleanQuery) ||
        (a.idNumber && a.idNumber.toUpperCase().includes(cleanQuery)) ||
        (a.ownerIdNumber && a.ownerIdNumber.toUpperCase().includes(cleanQuery)) ||
        a.applicantName.toUpperCase().includes(cleanQuery) ||
        (a.ownerName && a.ownerName.toUpperCase().includes(cleanQuery)) ||
        (a.applicantEmail && a.applicantEmail.toUpperCase().includes(cleanQuery)) ||
        (a.invoiceNumber && a.invoiceNumber.toUpperCase().includes(cleanQuery)) ||
        (a.adminApprovedBy && a.adminApprovedBy.toUpperCase().includes(cleanQuery)) ||
        (cleanDigits.length >= 6 && (appDigits.includes(cleanDigits.slice(-7)) || ownerDigits.includes(cleanDigits.slice(-7))))
      );
    }).map(mapMockApp);

    for (const mm of mockMatches) {
      const existingIdx = matchedApps.findIndex(
        (m) => m.id === mm.id || m.registrationNumber === mm.registrationNumber
      );
      if (existingIdx >= 0) {
        if (mm.id === "LAY-2026-GT492022" || mm.id === "LAY-2026-GE489224") {
          matchedApps[existingIdx] = {
            ...matchedApps[existingIdx],
            id: mm.id,
            status: mm.status,
            applicationStatus: mm.applicationStatus,
            adminApprovalStatus: mm.adminApprovalStatus,
            adminApprovedBy: mm.adminApprovedBy,
            adminApprovedAt: mm.adminApprovedAt,
            invoiceNumber: mm.invoiceNumber,
            invoiceStatus: mm.invoiceStatus,
            paymentStatus: mm.paymentStatus,
            paymentReference: mm.paymentReference,
            paymentConfirmedAt: mm.paymentConfirmedAt,
            vehicleRoadStatus: mm.vehicleRoadStatus,
            layoffStartDate: mm.layoffStartDate,
            layoffExpiryDate: mm.layoffExpiryDate,
            inspectionStatus: mm.inspectionStatus,
            inspectionOutcome: mm.inspectionOutcome,
            inspectionFindings: mm.inspectionFindings,
            inspectionDate: mm.inspectionDate,
            invoices: matchedApps[existingIdx].invoices?.length > 0 ? matchedApps[existingIdx].invoices : mm.invoices,
          };
        }
      } else {
        matchedApps.push(mm);
      }
    }

    if (matchedApps.length === 0) {
      return NextResponse.json({
        found: false,
        query,
        message: `No statutory layoff records found matching "${query}".`,
        dossier: null,
      });
    }

    // 2. Identify the primary citizen identity from the best match
    // To aggregate all records by that individual, extract phone numbers, Ghana Card IDs, and names
    const primaryApp = matchedApps[0];
    const citizenPhones = new Set<string>();
    const citizenIdNumbers = new Set<string>();
    const citizenNames = new Set<string>();

    matchedApps.forEach(app => {
      if (app.applicantPhone) {
        const norm = app.applicantPhone.replace(/\D/g, "").slice(-9);
        if (norm) citizenPhones.add(norm);
      }
      if (app.idNumber && app.idNumber.length > 5) {
        citizenIdNumbers.add(app.idNumber.trim().toUpperCase());
      }
      if (app.applicantName && app.applicantName.length > 3) {
        citizenNames.add(app.applicantName.trim());
      }
    });

    // 3. Query the complete historical dossier of all applications belonging to this individual
    const orConditions: any[] = [];
    citizenPhones.forEach(phone => {
      orConditions.push({ applicantPhone: { contains: phone } });
    });
    citizenIdNumbers.forEach(idNum => {
      orConditions.push({ idNumber: idNum });
    });
    citizenNames.forEach(name => {
      orConditions.push({ applicantName: name });
    });

    let allCitizenApps: any[] = [];
    try {
      allCitizenApps = await db.application.findMany({
        where: {
          OR: orConditions.length > 0 ? orConditions : [{ id: primaryApp.id }],
        },
        include: {
          invoices: { orderBy: { createdAt: "desc" } },
          inspectionRecords: { orderBy: { createdAt: "desc" } },
          extensionRequests: { orderBy: { createdAt: "desc" } },
          declarationAcceptances: true,
          attachments: true,
          activities: { orderBy: { timestamp: "desc" }, take: 10 },
        },
        orderBy: { createdAt: "desc" },
      });
    } catch {
      allCitizenApps = [];
    }

    // Merge matchedApps (including demo records) into allCitizenApps
    for (const ma of matchedApps) {
      const idx = allCitizenApps.findIndex(
        (c) => c.id === ma.id || c.registrationNumber === ma.registrationNumber
      );
      if (idx >= 0) {
        if (ma.id === "LAY-2026-GT492022" || ma.id === "LAY-2026-GE489224") {
          allCitizenApps[idx] = ma;
        }
      } else {
        allCitizenApps.push(ma);
      }
    }

    // 4. Compute Aggregate Lifetime Citizen Metrics
    const todayStr = new Date().toISOString().split("T")[0];
    let totalLifetimeFeesPaid = 0;
    let totalMonthsLaidOff = 0;
    let activeLayoffsCount = 0;
    let completedLayoffsCount = 0;
    let expiredLayoffsCount = 0;
    let pendingReviewCount = 0;
    let inspectionPassedCount = 0;

    const vehiclesSet = new Set<string>();

    allCitizenApps.forEach(app => {
      vehiclesSet.add(app.registrationNumber);
      totalMonthsLaidOff += (app.layoffPeriodMonths || 0);

      // Invoices fees
      (app.invoices || []).forEach((inv: any) => {
        if (inv.paymentStatus === "Paid") {
          totalLifetimeFeesPaid += inv.amount;
        }
      });

      // Status categorization
      const isExpired = app.layoffExpiryDate ? app.layoffExpiryDate < todayStr : false;
      const isOffRoad = app.vehicleRoadStatus === "Off Road";

      if (isOffRoad && !isExpired) {
        activeLayoffsCount++;
      } else if (isExpired) {
        expiredLayoffsCount++;
      } else if (app.applicationStatus === "Completed" || app.status === "Completed") {
        completedLayoffsCount++;
      } else {
        pendingReviewCount++;
      }

      if (app.inspectionOutcome?.toLowerCase().includes("success") || app.inspectionStatus === "Completed") {
        inspectionPassedCount++;
      }
    });

    // 5. Generate Dynamic Cryptographic Integrity Fingerprint (SHA-256)
    // Hash includes: primary citizen ID, app references, total fees, timestamp
    const integrityPayload = JSON.stringify({
      statute: "Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28",
      applicantName: primaryApp.applicantName,
      idNumber: primaryApp.idNumber,
      applicantPhone: primaryApp.applicantPhone,
      applicationCount: allCitizenApps.length,
      records: allCitizenApps.map(a => ({
        id: a.id,
        reg: a.registrationNumber,
        vin: a.chassisNumber,
        status: a.status,
        expiry: a.layoffExpiryDate,
        paid: a.paymentStatus,
      })),
      timestamp: new Date().toISOString(),
    });

    const enc = new TextEncoder();
    const hashBytes = sha256Bytes(enc.encode(integrityPayload));
    const integrityChecksum = bytesToBase64Url(hashBytes).slice(0, 32);
    const dossierReference = `DOS-DVLA-${primaryApp.idNumber ? primaryApp.idNumber.replace(/\W/g, "").slice(-8) : primaryApp.id.replace(/\W/g, "").slice(-8)}`;

    // 6. Log evidential dossier query into DVLA audit trail
    await recordAuditLog({
      applicationReference: primaryApp.id,
      vehicleReference: primaryApp.registrationNumber,
      userName: "Registry Search Engine",
      userRole: "System / Search",
      action: "EVIDENTIAL_DOSSIER_ACCESSED",
      processIdentifier: "REGISTRY_RECORDS_HUB",
      details: `Citizen dossier query for "${query}". Retrieved ${allCitizenApps.length} linked vehicle layoff records. Integrity checksum: ${integrityChecksum}.`,
    });

    return NextResponse.json({
      found: true,
      query,
      dossier: {
        dossierReference,
        integrityChecksum,
        statutoryAuthority: "Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28",
        evidentialAdmissibility: "Certified Public Record pursuant to Evidence Act, 1975 (N.R.C.D. 323), Section 51",
        generatedAt: new Date().toISOString(),

        // Primary Citizen Particulars
        citizen: {
          legalName: primaryApp.applicantName,
          phone: primaryApp.applicantPhone,
          email: primaryApp.applicantEmail,
          idNumber: primaryApp.idNumber || "Not Recorded",
          residentialAddress: primaryApp.residentialAddress || "Declared Location",
          digitalAddress: primaryApp.digitalAddress || "Not Recorded",
          applicantType: primaryApp.applicantType || "OWNER",
        },

        // Lifetime Metrics
        metrics: {
          totalApplications: allCitizenApps.length,
          uniqueVehiclesCount: vehiclesSet.size,
          activeLayoffsCount,
          completedLayoffsCount,
          expiredLayoffsCount,
          pendingReviewCount,
          totalMonthsLaidOff,
          totalLifetimeFeesPaid,
          inspectionComplianceRate: allCitizenApps.length > 0 
            ? Math.round((inspectionPassedCount / allCitizenApps.length) * 100) 
            : 100,
        },

        // All Linked Layoff Records
        records: allCitizenApps.map(app => {
          const isEligibleForCertificate = 
            app.adminApprovalStatus === "Approved" && 
            app.paymentStatus === "Paid";

          return {
            id: app.id,
            registrationNumber: app.registrationNumber,
            chassisNumber: app.chassisNumber,
            engineNumber: app.engineNumber,
            make: app.make,
            model: app.model,
            yearOfMake: app.yearOfMake,
            vehicleType: app.vehicleType,
            colour: app.colour,
            vehicleUsageClassification: app.vehicleUsageClassification,
            
            // Road & Layoff Status
            vehicleRoadStatus: app.vehicleRoadStatus,
            status: app.status,
            applicationStatus: app.applicationStatus,
            adminApprovalStatus: app.adminApprovalStatus,
            adminApprovedBy: app.adminApprovedBy,
            adminApprovedAt: app.adminApprovedAt,
            adminComments: app.adminComments,

            // Dates & Duration
            layoffPeriodMonths: app.layoffPeriodMonths,
            layoffStartDate: app.layoffStartDate,
            layoffExpiryDate: app.layoffExpiryDate,
            submittedAt: app.submittedAt,

            // Storage Details
            storageFacilityName: app.storageFacilityName,
            storageRegion: app.storageRegion,
            reason: app.reason,
            explanation: app.explanation,

            // Inspection
            inspectionMethod: app.inspectionMethod,
            inspectionStatus: app.inspectionStatus,
            assignedOfficerName: app.assignedOfficerName,
            inspectionDate: app.inspectionDate,
            inspectionOutcome: app.inspectionOutcome,
            inspectionFindings: app.inspectionFindings,
            inspectionDefects: app.inspectionDefects,
            inspectionReportUrl: app.inspectionReportUrl,

            // Invoicing & Payment
            invoiceNumber: app.invoiceNumber,
            paymentStatus: app.paymentStatus,
            paymentReference: app.paymentReference,
            paymentConfirmedAt: app.paymentConfirmedAt,
            isEmergencyMechanicalFailure: app.isEmergencyMechanicalFailure,
            emergencyFee: app.emergencyFee,

            // Extensions
            extensionCount: app.extensionCount,
            extensions: app.extensionRequests,

            // Invoices list
            invoices: app.invoices,

            // Declaration Acceptance
            declaration: app.declarationAcceptances[0] || null,

            // Certificate Issuance State
            isEligibleForCertificate,
            certificateBlockReason: !isEligibleForCertificate
              ? app.adminApprovalStatus !== "Approved"
                ? "Awaiting Administrative Review & Approval"
                : "Awaiting IPP Pro Statutory Fee Settlement"
              : null,
          };
        }),
      },
    });
  } catch (error) {
    console.error("Records search API error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve evidential registry records." },
      { status: 500 }
    );
  }
}
