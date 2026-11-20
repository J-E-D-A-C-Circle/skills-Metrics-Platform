import { describe, it, expect, beforeAll } from "bun:test";
import { db } from "../lib/db";
import {
  generateIPPProInvoice,
  confirmIPPProPayment,
  submitApplicationDataToIPPPro,
  retryIPPProSubmission,
  returnVehicleToRoad,
} from "../lib/ipp-pro-service";

describe("Sections 8-13: Approval, Invoicing, Payment Activation, and Road Status Workflow", () => {
  const testAppId = `LAY-TEST-${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    // Create test application in "Under Review" state
    await db.application.create({
      data: {
        id: testAppId,
        applicantName: "Integration Test User",
        applicantPhone: "+233 24 000 1122",
        applicantEmail: "test@dvla.gov.gh",
        idNumber: "GHA-000111222-3",
        registrationNumber: "GT-9999-24",
        chassisNumber: "JN1AZ34A890123456",
        make: "Toyota",
        model: "Corolla",
        vehicleType: "Private Saloon",
        colour: "Blue",
        reason: "Commercial Inactivity",
        explanation: "Integration test for approval and IPP Pro.",
        proposedStartDate: "2026-10-20",
        layoffPeriodMonths: 6,
        status: "Pending Approval",
        applicationStatus: "Under Review",
        adminApprovalStatus: "Pending", // NOT yet approved
        submittedAt: "2026-10-18 10:00",
        vehicleRoadStatus: "On Road",
      },
    });
  });

  it("Section 9.1: Prevents invoice generation if application is NOT administratively approved", async () => {
    const res = await generateIPPProInvoice(testAppId);
    expect(res.success).toBe(false);
    expect(res.error).toContain("Application must be approved first");
  });

  it("Section 8.1 & 9.1: Generates invoice once administrative approval is recorded", async () => {
    // Record admin approval
    await db.application.update({
      where: { id: testAppId },
      data: {
        adminApprovalStatus: "Approved",
        adminApprovedBy: "Director of Licensing",
      },
    });

    const res = await generateIPPProInvoice(testAppId);
    expect(res.success).toBe(true);
    expect(res.invoiceNumber).toStartWith("INV-DVLA-");
    expect(res.amount).toBe(150);

    // Verify application state: Approved but still INACTIVE!
    const app = await db.application.findUnique({ where: { id: testAppId } });
    expect(app?.adminApprovalStatus).toBe("Approved");
    expect(app?.paymentStatus).toBe("Pending");
    // Section 10.2: Approval is NOT activation!
    expect(app?.vehicleRoadStatus).toBe("On Road");
    expect(app?.applicationStatus).toBe("Under Review");
  });

  it("Section 10: Payment confirmation updates Payment Status to Paid, activates layoff, and sets Road Status to Off Road", async () => {
    const res = await confirmIPPProPayment(testAppId, "PAY-IPP-TEST-7788");
    expect(res.success).toBe(true);

    const app = await db.application.findUnique({ where: { id: testAppId } });
    expect(app?.paymentStatus).toBe("Paid");
    expect(app?.paymentReference).toBe("PAY-IPP-TEST-7788");
    expect(app?.applicationStatus).toBe("Active");
    expect(app?.status).toBe("Active Layoff");
    // Section 13.1: Road status becomes Off Road
    expect(app?.vehicleRoadStatus).toBe("Off Road");
  });

  it("Section 11.3: IPP Pro application data submission failure preserves payment and activation", async () => {
    // Simulate gateway failure during data sync
    const res = await submitApplicationDataToIPPPro(testAppId, true);
    expect(res.success).toBe(false);

    // Verify payment and active status remain intact!
    const app = await db.application.findUnique({ where: { id: testAppId } });
    expect(app?.paymentStatus).toBe("Paid");
    expect(app?.vehicleRoadStatus).toBe("Off Road");
    expect(app?.ippProSubmissionStatus).toBe("Failed");
    expect(app?.ippProSubmissionError).toContain("504");
  });

  it("Section 11.3: Retrying IPP Pro application data submission succeeds safely", async () => {
    const res = await retryIPPProSubmission(testAppId);
    expect(res.success).toBe(true);
    expect(res.submissionRef).toStartWith("IPP-DATA-REC-");

    const app = await db.application.findUnique({ where: { id: testAppId } });
    expect(app?.ippProSubmissionStatus).toBe("Succeeded");
    expect(app?.paymentStatus).toBe("Paid");
  });

  it("Section 13: Formal return to road action updates road status from Off Road to On Road", async () => {
    const res = await returnVehicleToRoad(testAppId, "Supt. K. Darko", "Passed roadworthiness recommission inspection.");
    expect(res.success).toBe(true);

    const app = await db.application.findUnique({ where: { id: testAppId } });
    expect(app?.vehicleRoadStatus).toBe("On Road");
    expect(app?.applicationStatus).toBe("Completed");
    expect(app?.roadStatusReason).toContain("Passed roadworthiness");
  });
});
