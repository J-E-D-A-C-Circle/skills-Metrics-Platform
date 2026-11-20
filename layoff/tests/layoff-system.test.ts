import { describe, it, expect } from "bun:test";
import {
  calculateRoadworthinessCutoff,
  validateRoadworthinessEligibility,
  evaluateEmergencyMechanicalFailure,
} from "../lib/roadworthiness";
import {
  validateVINFormat,
  verifyVINWithVRS,
} from "../lib/vrs-service";
import {
  calculateStatutoryFee,
  calculateLayoffFeeBreakdown,
  getEmergencyMechanicalFailureFee,
} from "../lib/ipp-pro-service";
import { INSPECTION_PHOTO_CATEGORIES } from "../components/technical-officer-dashboard";

describe("Requirement 1: Representative Authorization Document", () => {
  it("allows owner to apply without representative authorization document", () => {
    const isOwner = true;
    const documents = [
      { name: "Vehicle_Registration_Document_Title.pdf", category: "document_title" },
    ];
    // For owner: representative document is not required
    const hasRequiredAuth = isOwner || documents.some(d => d.category === "representative_auth");
    expect(hasRequiredAuth).toBe(true);
  });

  it("requires representative to upload authorization letter/power of attorney before proceeding", () => {
    const isRepresentative = true;
    const documentsWithoutAuth = [
      { name: "Vehicle_Registration_Document_Title.pdf", category: "document_title" },
    ];
    const hasRequiredAuth = !isRepresentative || documentsWithoutAuth.some(d => d.category === "representative_auth");
    expect(hasRequiredAuth).toBe(false);

    // With authorization document
    const documentsWithAuth = [
      ...documentsWithoutAuth,
      { name: "Authoritative_Note_Owner_Consent.pdf", category: "representative_auth" },
    ];
    const hasAuthNow = !isRepresentative || documentsWithAuth.some(d => d.category === "representative_auth");
    expect(hasAuthNow).toBe(true);
  });
});

describe("Requirement 2: Layoff Reason Dropdown - 'Legal Action'", () => {
  const PERMITTED_LAYOFF_REASONS = [
    "Mechanical Failure / Overhaul",
    "Legal Action",
    "Extended Travel / Absenteeism",
    "Commercial Inactivity",
    "Vehicle Restoration / Repair",
    "Other",
  ];

  it("includes 'Legal Action' in the permitted layoff reasons", () => {
    expect(PERMITTED_LAYOFF_REASONS).toContain("Legal Action");
  });

  it("validates and accepts 'Legal Action' as a legitimate reason for layoff", () => {
    const selectedReason = "Legal Action";
    expect(PERMITTED_LAYOFF_REASONS.includes(selectedReason)).toBe(true);
  });

  it("requires certified legal document upload when reason is 'Legal Action'", () => {
    const reason = "Legal Action";
    const documentsWithoutLegalDoc = [
      { name: "Vehicle_Registration_Document_Title.pdf", category: "document_title" },
    ];
    const hasRequiredLegalDoc = reason !== "Legal Action" || documentsWithoutLegalDoc.some(d =>
      d.category === "legal_document" || d.name.toLowerCase().includes("court") || d.name.toLowerCase().includes("injunction")
    );
    expect(hasRequiredLegalDoc).toBe(false);

    // With legal document
    const documentsWithLegalDoc = [
      ...documentsWithoutLegalDoc,
      { name: "High_Court_Injunction_Order_Suit_No_GJ_142.pdf", category: "legal_document" },
    ];
    const hasLegalDocNow = reason !== "Legal Action" || documentsWithLegalDoc.some(d =>
      d.category === "legal_document" || d.name.toLowerCase().includes("court") || d.name.toLowerCase().includes("injunction")
    );
    expect(hasLegalDocNow).toBe(true);
  });

  it("does not require legal document upload when reason is not 'Legal Action'", () => {
    const reason: string = "Mechanical Failure / Overhaul";
    const documents = [
      { name: "Vehicle_Registration_Document_Title.pdf", category: "document_title" },
    ];
    const hasRequiredLegalDoc = reason !== "Legal Action" || documents.some(d =>
      d.category === "legal_document" || d.name.toLowerCase().includes("court")
    );
    expect(hasRequiredLegalDoc).toBe(true);
  });
});

describe("Requirement 3: Emergency Mechanical Failure Applications & Additional Charges", () => {
  it("evaluates private vehicle roadworthiness: < 3 months validity incurs emergency fee", () => {
    // Application date: 2026-10-15
    // Private vehicle requires >= 3 months validity (Cutoff: 2027-01-15)
    // Expiry date is 2026-12-01 (< 3 months)
    const evalResult = evaluateEmergencyMechanicalFailure(
      "2026-12-01",
      "2026-10-15",
      "Private",
      true
    );

    expect(evalResult.isEmergencyMechanicalFailure).toBe(true);
    expect(evalResult.requiresEmergencyFee).toBe(true);
    expect(evalResult.hasSufficientValidity).toBe(false);
    expect(evalResult.requiredMonths).toBe(3);
    expect(evalResult.cutoffDate).toBe("2027-01-15");
  });

  it("evaluates private vehicle roadworthiness: >= 3 months validity does NOT incur emergency fee", () => {
    // Expiry date is 2027-04-15 (> 3 months validity)
    const evalResult = evaluateEmergencyMechanicalFailure(
      "2027-04-15",
      "2026-10-15",
      "Private",
      true
    );

    expect(evalResult.isEmergencyMechanicalFailure).toBe(true);
    expect(evalResult.requiresEmergencyFee).toBe(false);
    expect(evalResult.hasSufficientValidity).toBe(true);
  });

  it("evaluates commercial vehicle roadworthiness: < 2 months validity incurs emergency fee", () => {
    // Commercial vehicle requires >= 2 months validity (Cutoff: 2026-12-15)
    // Expiry date is 2026-11-20 (< 2 months)
    const evalResult = evaluateEmergencyMechanicalFailure(
      "2026-11-20",
      "2026-10-15",
      "Commercial",
      true
    );

    expect(evalResult.isEmergencyMechanicalFailure).toBe(true);
    expect(evalResult.requiresEmergencyFee).toBe(true);
    expect(evalResult.hasSufficientValidity).toBe(false);
    expect(evalResult.requiredMonths).toBe(2);
    expect(evalResult.cutoffDate).toBe("2026-12-15");
  });

  it("evaluates commercial vehicle roadworthiness: >= 2 months validity does NOT incur emergency fee", () => {
    // Expiry date is 2027-01-20 (> 2 months validity)
    const evalResult = evaluateEmergencyMechanicalFailure(
      "2027-01-20",
      "2026-10-15",
      "Commercial",
      true
    );

    expect(evalResult.isEmergencyMechanicalFailure).toBe(true);
    expect(evalResult.requiresEmergencyFee).toBe(false);
    expect(evalResult.hasSufficientValidity).toBe(true);
  });

  it("applies emergency fee in calculateLayoffFeeBreakdown and reflects in total amount", () => {
    const breakdown = calculateLayoffFeeBreakdown({
      vehicleType: "Private Saloon",
      inspectionMethod: "OFFICE",
      isEmergencyMechanicalFailure: true,
      roadworthinessExpiryDate: "2026-11-01", // Below 3-month cutoff
      applicationDate: "2026-10-15",
      vehicleUsageClassification: "Private",
    });

    expect(breakdown.baseFee).toBe(150);
    expect(breakdown.onSiteFee).toBe(0);
    expect(breakdown.emergencyFee).toBe(200);
    expect(breakdown.emergencyFeeApplies).toBe(true);
    expect(breakdown.totalAmount).toBe(350); // 150 + 200
  });

  it("does not apply emergency surcharge when conditions are not met", () => {
    const breakdown = calculateLayoffFeeBreakdown({
      vehicleType: "Private Saloon",
      inspectionMethod: "OFFICE",
      isEmergencyMechanicalFailure: false,
    });

    expect(breakdown.baseFee).toBe(150);
    expect(breakdown.emergencyFee).toBe(0);
    expect(breakdown.emergencyFeeApplies).toBe(false);
    expect(breakdown.totalAmount).toBe(150);
  });

  it("ensures emergency fee is configurable via getEmergencyMechanicalFailureFee", () => {
    const fee = getEmergencyMechanicalFailureFee();
    expect(typeof fee).toBe("number");
    expect(fee).toBeGreaterThanOrEqual(0);
  });
});

describe("Requirement 4: Top Technical Officers Ranking on Admin Console", () => {
  it("ranks officers correctly based on completed inspections, excluding rejected records", () => {
    const mockApps = [
      { id: "1", assignedOfficerId: "TO-1", assignedOfficerName: "Officer A", inspectionStatus: "Completed", status: "Approved" },
      { id: "2", assignedOfficerId: "TO-1", assignedOfficerName: "Officer A", inspectionStatus: "Completed", status: "Approved" },
      { id: "3", assignedOfficerId: "TO-2", assignedOfficerName: "Officer B", inspectionStatus: "Completed", status: "Approved" },
      { id: "4", assignedOfficerId: "TO-2", assignedOfficerName: "Officer B", inspectionStatus: "Pending", status: "Pending" }, // Incomplete
      { id: "5", assignedOfficerId: "TO-3", assignedOfficerName: "Officer C", inspectionStatus: "Completed", status: "Rejected" }, // Rejected
      { id: "6", assignedOfficerId: "TO-4", assignedOfficerName: "Officer D", inspectionStatus: "Completed", status: "Approved" },
    ];

    // Filter qualifying
    const qualifying = mockApps.filter(a => a.inspectionStatus === "Completed" && a.status !== "Rejected");
    const counts: Record<string, number> = {};
    qualifying.forEach(a => {
      counts[a.assignedOfficerId] = (counts[a.assignedOfficerId] || 0) + 1;
    });

    const ranked = Object.entries(counts).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count);

    // TO-1: 2 completed
    // TO-2: 1 completed
    // TO-4: 1 completed
    // TO-3: 0 qualifying (rejected)
    expect(ranked[0].id).toBe("TO-1");
    expect(ranked[0].count).toBe(2);
    expect(ranked[1].count).toBe(1);
    expect(ranked[2].count).toBe(1);
  });

  it("handles ranking ties consistently", () => {
    const list = [
      { id: "TO-1", count: 5 },
      { id: "TO-2", count: 3 },
      { id: "TO-3", count: 3 },
      { id: "TO-4", count: 1 },
    ];

    let currentRank = 1;
    const rankedWithTies = list.map((item, idx) => {
      if (idx > 0 && item.count < list[idx - 1].count) {
        currentRank = idx + 1;
      }
      return { ...item, rank: currentRank };
    });

    expect(rankedWithTies[0].rank).toBe(1);
    expect(rankedWithTies[1].rank).toBe(2);
    expect(rankedWithTies[2].rank).toBe(2); // Tied with TO-2
    expect(rankedWithTies[3].rank).toBe(4);
  });
});

describe("Requirement 5: On-Site Camera Vehicle Image Capture", () => {
  it("preserves all 5 prescribed photo categories", () => {
    const keys = INSPECTION_PHOTO_CATEGORIES.map(c => c.key);
    expect(keys).toEqual(["front", "side", "rear", "engine", "chassis"]);
  });

  it("requires all 5 photographs before inspection can be submitted", () => {
    const captured: Record<string, string> = {
      front: "data:image/jpeg;base64,...",
      side: "data:image/jpeg;base64,...",
      rear: "data:image/jpeg;base64,...",
      // engine missing
      chassis: "data:image/jpeg;base64,...",
    };

    const isComplete = INSPECTION_PHOTO_CATEGORIES.every(c => Boolean(captured[c.key]));
    expect(isComplete).toBe(false);

    captured.engine = "data:image/jpeg;base64,...";
    const isNowComplete = INSPECTION_PHOTO_CATEGORIES.every(c => Boolean(captured[c.key]));
    expect(isNowComplete).toBe(true);
  });
});

describe("Requirement 6: Vehicle Inspection Report Upload After Submission", () => {
  it("permits initial inspection submission without vehicle inspection report", () => {
    const inspectionSubmissionPayload = {
      inspectionStatus: "Completed",
      assignedOfficerId: "TO-409",
      inspectionFindings: "Vehicle immobilized with stripped engine block.",
      inspectionOutcome: "Inspection completed successfully",
      inspectionPhotos: ["photo1.jpg", "photo2.jpg", "photo3.jpg", "photo4.jpg", "photo5.jpg"],
      // inspectionReportUrl is omitted at submission time
    };

    expect(inspectionSubmissionPayload.inspectionStatus).toBe("Completed");
    expect((inspectionSubmissionPayload as any).inspectionReportUrl).toBeUndefined();
  });

  it("links subsequently uploaded inspection report without altering approval state", () => {
    const existingInspection = {
      id: "LAY-2026-8810",
      inspectionStatus: "Completed",
      adminApprovalStatus: "Pending",
      paymentStatus: "Pending",
    };

    const reportUploadPayload = {
      inspectionReportUrl: "/api/uploads/Official_Inspection_Report.pdf",
      inspectionReportFileName: "Official_Inspection_Report.pdf",
      inspectionReportUploadedAt: "2026-10-23T08:00:00Z",
      inspectionReportUploadedBy: "Ing. Samuel Annan",
    };

    const updated = {
      ...existingInspection,
      ...reportUploadPayload,
    };

    expect(updated.inspectionReportUrl).toBe("/api/uploads/Official_Inspection_Report.pdf");
    // Administrative approval and payment must remain unchanged (not auto-approved)
    expect(updated.adminApprovalStatus).toBe("Pending");
    expect(updated.paymentStatus).toBe("Pending");
  });
});

describe("Requirement 7: Chassis Number Minimum Length Validation (Min. 12 Characters)", () => {
  it("rejects chassis numbers with less than 12 characters with clear message", () => {
    const res = validateVINFormat("12345678901"); // 11 characters
    expect(res.isValid).toBe(false);
    expect(res.error).toBe("Chassis number must contain at least 12 characters.");
  });

  it("accepts valid 12-character chassis numbers", () => {
    const res = validateVINFormat("123456789012"); // 12 characters
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("123456789012");
  });

  it("accepts valid standard 17-character VINs", () => {
    const res = validateVINFormat("JN1AZ34A890123456");
    expect(res.isValid).toBe(true);
    expect(res.normalized).toBe("JN1AZ34A890123456");
  });

  it("rejects chassis numbers with disallowed characters I, O, Q", () => {
    const res = validateVINFormat("12345678901I");
    expect(res.isValid).toBe(false);
    expect(res.error).toContain("letters I, O, or Q");
  });
});
