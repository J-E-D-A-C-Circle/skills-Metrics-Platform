import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INITIAL_APPLICATIONS, formatLayoffReferenceId } from "@/lib/mock-data";
import { validateRoadworthinessEligibility } from "@/lib/roadworthiness";
import { validateVINFormat } from "@/lib/vrs-service";
import { calculateLayoffFeeBreakdown } from "@/lib/ipp-pro-service";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";
import { releaseExpiredClaimedCases } from "@/lib/claim-sla";

export async function GET(req: NextRequest) {
  try {
    // Automatically release any claimed cases that have exceeded the 4-day completion window
    await releaseExpiredClaimedCases();

    const { searchParams } = new URL(req.url);
    const region = searchParams.get("region");
    const assignedOfficerId = searchParams.get("assignedOfficerId");
    const inspectionStatus = searchParams.get("inspectionStatus");
    const adminApprovalStatus = searchParams.get("adminApprovalStatus");
    const search = searchParams.get("search");

    const where: any = {};
    if (region && region !== "All") {
      where.storageRegion = region;
    }
    if (assignedOfficerId) {
      where.assignedOfficerId = assignedOfficerId;
    }
    if (inspectionStatus && inspectionStatus !== "All") {
      if (inspectionStatus === "Pending") {
        where.OR = [
          { inspectionStatus: { startsWith: "Pending" } },
          { inspectionStatus: "Assigned" },
        ];
      } else {
        where.inspectionStatus = inspectionStatus;
      }
    }
    if (adminApprovalStatus && adminApprovalStatus !== "All") {
      where.adminApprovalStatus = adminApprovalStatus;
    }
    if (search) {
      const q = search.trim();
      where.OR = [
        { id: { contains: q } },
        { registrationNumber: { contains: q } },
        { chassisNumber: { contains: q } },
        { applicantName: { contains: q } },
      ];
    }

    const applications = await db.application.findMany({
      where,
      include: {
        attachments: true,
        invoices: true,
        inspectionRecords: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    const formatted = applications.map((app: any) => {
      // Split attachments by category
      const docCategories = ["document", "document_title", "representative_auth", "inspection_report", "legal_document"];
      const applicantPhotoCategories = [
        "photo",
        "photo_front",
        "photo_side",
        "photo_rear",
        "photo_engine",
        "photo_chassis",
      ];

      const documents = app.attachments
        .filter((att: any) => docCategories.includes(att.category))
        .map((att: any) => ({
          name: att.fileName,
          size: att.fileSize,
          type: att.fileType,
          url: att.fileUrl,
          category: att.category,
        }));

      const photos = app.attachments
        .filter((att: any) => applicantPhotoCategories.includes(att.category))
        .map((att: any) => att.fileUrl);

      const inspectionPhotos = app.attachments
        .filter((att: any) => att.category === "technical_inspection_photo")
        .map((att: any) => att.fileUrl);

      // Extract mandatory photos map if available
      const mandatoryPhotographs = {
        front: app.attachments.find((a: any) => a.category === "photo_front")?.fileUrl || photos[0] || "",
        side: app.attachments.find((a: any) => a.category === "photo_side")?.fileUrl || photos[1] || "",
        rear: app.attachments.find((a: any) => a.category === "photo_rear")?.fileUrl || photos[2] || "",
        engine: app.attachments.find((a: any) => a.category === "photo_engine")?.fileUrl || photos[3] || "",
        chassis: app.attachments.find((a: any) => a.category === "photo_chassis")?.fileUrl || photos[4] || "",
      };

      // Overlay demo certificate state for the two flagship demo records so they always have active certificates
      const normalizedRefId = formatLayoffReferenceId(app.registrationNumber, app.submittedAt);
      const demoCertMatch = INITIAL_APPLICATIONS.find(
        (d) =>
          (d.id === "LAY-2026-GT492022" || d.id === "LAY-2026-GE489224") &&
          (d.id === app.id || d.id === normalizedRefId || d.registrationNumber === app.registrationNumber)
      );

      return {
        ...app,
        id: normalizedRefId,
        ...(demoCertMatch
          ? {
              status: demoCertMatch.status,
              applicationStatus: demoCertMatch.applicationStatus,
              adminApprovalStatus: demoCertMatch.adminApprovalStatus,
              adminApprovedBy: demoCertMatch.adminApprovedBy,
              adminApprovedAt: demoCertMatch.adminApprovedAt,
              invoiceNumber: demoCertMatch.invoiceNumber,
              invoiceStatus: demoCertMatch.invoiceStatus,
              paymentStatus: demoCertMatch.paymentStatus,
              paymentReference: demoCertMatch.paymentReference,
              paymentConfirmedAt: demoCertMatch.paymentConfirmedAt,
              vehicleRoadStatus: demoCertMatch.vehicleRoadStatus,
              layoffStartDate: demoCertMatch.layoffStartDate,
              layoffExpiryDate: demoCertMatch.layoffExpiryDate,
              inspectionStatus: demoCertMatch.inspectionStatus,
              inspectionOutcome: demoCertMatch.inspectionOutcome,
              inspectionFindings: demoCertMatch.inspectionFindings,
              inspectionDate: demoCertMatch.inspectionDate,
            }
          : {}),
        documents: documents.length > 0 ? documents : demoCertMatch?.documents || [],
        photos: photos.length > 0 ? photos : demoCertMatch?.photos || [],
        inspectionPhotos,
        mandatoryPhotographs,
      };
    });

    // Ensure both flagship demo certificate records are present when fetching the general list
    if (!assignedOfficerId && (!inspectionStatus || inspectionStatus === "All") && (!adminApprovalStatus || adminApprovalStatus === "All" || adminApprovalStatus === "Approved")) {
      const demoCertApps = INITIAL_APPLICATIONS.filter(
        (d) => d.id === "LAY-2026-GT492022" || d.id === "LAY-2026-GE489224"
      );
      for (const demoApp of demoCertApps) {
        if (region && region !== "All" && demoApp.storageRegion !== region) continue;
        const alreadyExists = formatted.some(
          (f: any) => f.id === demoApp.id || f.registrationNumber === demoApp.registrationNumber
        );
        if (!alreadyExists) {
          formatted.unshift(demoApp);
        }
      }
    }

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch applications, using fallback demo records:", error);
    return NextResponse.json(INITIAL_APPLICATIONS);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const {
      id,
      applicantName,
      applicantPhone,
      applicantEmail,
      idNumber,
      residentialAddress,
      digitalAddress,

      // VRS & Ownership details
      vrsVerified = false,
      vrsVerificationDate,
      applicantType = "OWNER",
      ownerName,
      ownerIdNumber,
      ownerPhone,
      ownerEmail,
      representativeName,
      representativePhone,
      representativeEmail,
      representativeIdType,
      representativeIdNumber,
      representativeRelationship,
      representativeAddress,

      // Vehicle Specifications
      registrationNumber,
      chassisNumber,
      engineNumber,
      make,
      model,
      yearOfMake,
      vehicleType,
      colour,

      // Classification & Roadworthiness
      vehicleUsageClassification = "Private",
      roadworthinessExpiryDate,
      isEmergencyMechanicalFailure = false,

      // Layoff details
      reason,
      explanation,
      storageFacilityName,
      storageRegion,
      proposedStartDate,
      layoffPeriodMonths = 6,

      // Inspection method
      inspectionMethod = "OFFICE",
      inspectionOfficeLocation,
      inspectionSiteAddress,
      inspectionSiteArea,
      inspectionContactPerson,
      inspectionContactPhone,
      inspectionNotes,

      // Attachments & 5 Mandatory Photographs
      documents = [],
      photos = [],
      mandatoryPhotographs,

      status = "Pending Verification",
    } = body;

    // 1. Mandatory Fields Validation
    if (!registrationNumber || !chassisNumber || !applicantName || !applicantPhone || !idNumber) {
      return NextResponse.json(
        { error: "Missing mandatory fields: registration, chassis, applicant name, phone, and ID are required." },
        { status: 400 }
      );
    }

    // 2. Chassis Number Validation (Requirement 7: Minimum 12 characters)
    const chassisCheck = validateVINFormat(chassisNumber);
    if (!chassisCheck.isValid) {
      return NextResponse.json(
        { error: "Invalid Chassis Number", details: chassisCheck.error || "Chassis number must contain at least 12 characters." },
        { status: 400 }
      );
    }

    // 3. Representative Authorization Document Validation (Requirement 1)
    if (applicantType === "REPRESENTATIVE") {
      const hasAuthDoc = Array.isArray(documents) && documents.some((d: any) =>
        d && (
          d.category === "representative_auth" ||
          d.name?.toLowerCase().includes("authorization") ||
          d.name?.toLowerCase().includes("power_of_attorney") ||
          d.name?.toLowerCase().includes("representative")
        )
      );

      if (!hasAuthDoc) {
        return NextResponse.json(
          {
            error: "Missing Representative Authorization Document",
            details: "An Authoritative Note/Authorization Letter from the Vehicle Owner is mandatory when applying as a representative.",
          },
          { status: 400 }
        );
      }
    }

    // 3.5. Legal Action Document Validation
    if (reason === "Legal Action") {
      const hasLegalDoc = Array.isArray(documents) && documents.some((d: any) =>
        d && (
          d.category === "legal_document" ||
          d.name?.toLowerCase().includes("court") ||
          d.name?.toLowerCase().includes("legal") ||
          d.name?.toLowerCase().includes("suit") ||
          d.name?.toLowerCase().includes("injunction") ||
          d.name?.toLowerCase().includes("order") ||
          d.name?.toLowerCase().includes("police")
        )
      );

      if (!hasLegalDoc) {
        return NextResponse.json(
          {
            error: "Missing Legal Action Document",
            details: "A certified Court Order, Injunction, or Statutory Legal Notice is mandatory when Legal Action is selected as the layoff reason.",
          },
          { status: 400 }
        );
      }
    }

    const applicationDate = new Date().toISOString().split("T")[0];

    // 4. Roadworthiness Eligibility & Emergency Mechanical Failure Assessment (Requirement 3)
    const isEmergency = Boolean(isEmergencyMechanicalFailure);
    let emergencyFee = 0;
    let emergencyFeeReason: string | null = null;

    if (roadworthinessExpiryDate) {
      const roadworthinessCheck = validateRoadworthinessEligibility(
        roadworthinessExpiryDate,
        applicationDate,
        vehicleUsageClassification as "Private" | "Commercial",
        { isEmergencyMechanicalFailure: isEmergency }
      );

      if (!roadworthinessCheck.isValid) {
        return NextResponse.json(
          {
            error: "Roadworthiness Ineligible",
            details: roadworthinessCheck.reason,
            cutoffDate: roadworthinessCheck.cutoffDate,
            requiredMonths: roadworthinessCheck.requiredMonths,
          },
          { status: 422 }
        );
      }

      if (roadworthinessCheck.requiresEmergencyFee) {
        const feeBreakdown = calculateLayoffFeeBreakdown({
          vehicleType: vehicleType || "Private Saloon",
          inspectionMethod: inspectionMethod || "OFFICE",
          isEmergencyMechanicalFailure: true,
          roadworthinessExpiryDate,
          applicationDate,
          vehicleUsageClassification: vehicleUsageClassification as "Private" | "Commercial",
        });
        emergencyFee = feeBreakdown.emergencyFee;
        emergencyFeeReason = roadworthinessCheck.reason || "Emergency mechanical failure surcharge applied.";
      }
    }

    const generatedId = id || formatLayoffReferenceId(registrationNumber);
    const submittedAt = new Date().toISOString().replace("T", " ").slice(0, 16);

    // Compute cutoff date for record keeping
    const { cutoffDate } = roadworthinessExpiryDate
      ? validateRoadworthinessEligibility(roadworthinessExpiryDate, applicationDate, vehicleUsageClassification as "Private" | "Commercial", { isEmergencyMechanicalFailure: isEmergency })
      : { cutoffDate: null };

    // 5. Create Application Record
    const application = await db.application.create({
      data: {
        id: generatedId,
        applicantName,
        applicantPhone,
        applicantEmail,
        idNumber,
        residentialAddress,
        digitalAddress,

        vrsVerified: Boolean(vrsVerified),
        vrsVerificationDate: vrsVerificationDate || (vrsVerified ? submittedAt : null),
        applicantType,
        ownerName: ownerName || (applicantType === "OWNER" ? applicantName : null),
        ownerIdNumber: ownerIdNumber || (applicantType === "OWNER" ? idNumber : null),
        ownerPhone: ownerPhone || (applicantType === "OWNER" ? applicantPhone : null),
        ownerEmail: ownerEmail || (applicantType === "OWNER" ? applicantEmail : null),
        representativeName,
        representativePhone,
        representativeEmail,
        representativeIdType,
        representativeIdNumber,
        representativeRelationship,
        representativeAddress,

        registrationNumber,
        chassisNumber: chassisCheck.normalized,
        engineNumber,
        make,
        model,
        yearOfMake,
        vehicleType,
        colour,

        vehicleUsageClassification,
        roadworthinessExpiryDate: roadworthinessExpiryDate || null,
        roadworthinessCutoffDate: cutoffDate,
        roadworthinessValid: true,
        isEmergencyMechanicalFailure: isEmergency,
        emergencyFee,
        emergencyFeeReason,

        reason,
        explanation: explanation || "",
        storageFacilityName,
        storageRegion,
        proposedStartDate: proposedStartDate || applicationDate,
        layoffPeriodMonths: Number(layoffPeriodMonths),

        inspectionMethod,
        inspectionOfficeLocation: inspectionMethod === "OFFICE" ? (inspectionOfficeLocation || "DVLA 37 Head Office - Accra") : null,
        inspectionSiteAddress: inspectionMethod === "ON_SITE" ? inspectionSiteAddress : null,
        inspectionSiteArea: inspectionMethod === "ON_SITE" ? inspectionSiteArea : null,
        inspectionContactPerson: inspectionMethod === "ON_SITE" ? (inspectionContactPerson || applicantName) : null,
        inspectionContactPhone: inspectionMethod === "ON_SITE" ? (inspectionContactPhone || applicantPhone) : null,
        inspectionNotes,
        inspectionStatus: "Pending Assignment",

        status,
        applicationStatus: "Submitted",
        submittedAt,

        adminApprovalStatus: "Pending",
        invoiceStatus: "Not Generated",
        paymentStatus: "Pending",
        ippProSubmissionStatus: "Not Started",
        vehicleRoadStatus: "On Road", // Remains On Road until payment & activation
      },
    });

    // 4. Save Attachments (Documents)
    for (const doc of documents) {
      await db.attachment.create({
        data: {
          applicationId: application.id,
          fileName: doc.name || doc.fileName || "Document.pdf",
          fileUrl: doc.url || doc.fileUrl || `/api/uploads/${doc.name}`,
          fileType: doc.type || "PDF",
          fileSize: doc.size || "1.0 MB",
          category: doc.category || (doc.name?.toLowerCase().includes("title") || doc.name?.toLowerCase().includes("logbook") ? "document_title" : "document"),
          uploaderRole: "APPLICANT",
          uploaderName: applicantName,
        },
      });
    }

    // 5. Save 5 Mandatory Photographs with specific categories
    const photoCategories: Array<{ key: keyof typeof mandatoryPhotographs; category: string; fallbackName: string }> = [
      { key: "front", category: "photo_front", fallbackName: "Photo_Front_View.jpg" },
      { key: "side", category: "photo_side", fallbackName: "Photo_Side_View.jpg" },
      { key: "rear", category: "photo_rear", fallbackName: "Photo_Rear_View.jpg" },
      { key: "engine", category: "photo_engine", fallbackName: "Photo_Engine_Bay.jpg" },
      { key: "chassis", category: "photo_chassis", fallbackName: "Photo_Chassis_VIN.jpg" },
    ];

    if (mandatoryPhotographs) {
      for (const item of photoCategories) {
        const fileUrl = mandatoryPhotographs[item.key];
        if (fileUrl) {
          await db.attachment.create({
            data: {
              applicationId: application.id,
              fileName: item.fallbackName,
              fileUrl: typeof fileUrl === "string" ? fileUrl : (fileUrl.url || `/api/uploads/${item.fallbackName}`),
              fileType: "image/jpeg",
              fileSize: "1.5 MB",
              category: item.category,
              uploaderRole: "APPLICANT",
              uploaderName: applicantName,
            },
          });
        }
      }
    } else if (photos && Array.isArray(photos)) {
      // Fallback for general photo list
      for (let i = 0; i < photos.length; i++) {
        const p = photos[i];
        const category = photoCategories[i]?.category || "photo";
        const photoName = typeof p === "string" ? p : p.name || `Vehicle_Photo_${i + 1}.jpg`;
        const photoUrl = typeof p === "string" ? (p.startsWith("/") ? p : `/api/uploads/${p}`) : (p.url || `/api/uploads/${photoName}`);

        await db.attachment.create({
          data: {
            applicationId: application.id,
            fileName: photoName,
            fileUrl: photoUrl,
            fileType: "image/jpeg",
            fileSize: "1.5 MB",
            category,
            uploaderRole: "APPLICANT",
            uploaderName: applicantName,
          },
        });
      }
    }

    const ipAddress = req.headers.get("x-forwarded-for") || "127.0.0.1";
    const userAgent = req.headers.get("user-agent") || "Web Client";

    // 6. Record Immutable Statutory Declaration Acceptance (L.I. 2519 Regulation 28)
    await db.declarationAcceptance.create({
      data: {
        applicationId: application.id,
        declarationText: "I solemnly declare that the particulars submitted are accurate and complete. I formally undertake that the vehicle shall remain immobilized and strictly OFF public roads while the vehicle registration certificate is cancelled under Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28. If operated on any public road during the statutory layoff period, I am liable under Regulation 28(3) to pay all accrued road licensing and testing charges, without prejudice to prosecution and penalties under Regulation 243. An authorized vehicle inspector or police Officer possess full statutory right to inspect the vehicle at the declared storage facility.",
        statutoryReference: "Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28",
        applicantName,
        idNumber,
        ipAddress,
        userAgent,
      },
    });

    // 7. Record Application Activity Logs
    await db.applicationActivity.create({
      data: {
        applicationId: application.id,
        category: "APPLICATION",
        action: "APPLICATION_SUBMITTED",
        description: `New statutory layoff application submitted for ${make} ${model} (${registrationNumber}). Inspection Method: ${inspectionMethod}. Usage: ${vehicleUsageClassification}. Emergency Provision: ${isEmergency ? "YES" : "NO"}.`,
        actorName: applicantName,
        actorRole: applicantType === "REPRESENTATIVE" ? "Representative" : "Applicant",
        source: "APPLICANT",
        newValue: "Submitted",
      },
    });

    await db.applicationActivity.create({
      data: {
        applicationId: application.id,
        category: "ADMINISTRATIVE",
        action: "STATUTORY_DECLARATION_ACCEPTED",
        description: `Applicant accepted legal declaration pursuant to L.I. 2519 Regulation 28 from IP ${ipAddress}.`,
        actorName: applicantName,
        actorRole: "Applicant",
        source: "APPLICANT",
      },
    });

    await recordAuditLog({
      applicationReference: application.id,
      vehicleReference: application.registrationNumber,
      userName: applicantName,
      userRole: applicantType === "REPRESENTATIVE" ? "Representative" : "Applicant",
      action: "APPLICATION_SUBMITTED",
      processIdentifier: "APPLICANT_PORTAL",
      newStatus: "Submitted",
      details: `New layoff application submitted for ${make} ${model} (${registrationNumber}). Method: ${inspectionMethod}. Classification: ${vehicleUsageClassification}. Legal declaration recorded.`,
    });

    // 8. Send Official Submission & Tracking SMS Confirmation (Phase 6)
    const trackingUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    await sendSMSNotification({
      recipientPhone: applicantPhone,
      message: `Your DVLA Vehicle Layoff application has been received successfully. Your reference number is ${application.id}. Track your application here: ${trackingUrl}/tracking. Please keep your reference number for future enquiries.`,
      event: "Application Submitted",
      applicationId: application.id,
      registrationNumber: application.registrationNumber,
    });

    return NextResponse.json(application, { status: 201 });
  } catch (error) {
    console.error("Failed to create application:", error);
    return NextResponse.json({ error: "Failed to create application" }, { status: 500 });
  }
}
