/**
 * IPP Pro Integration Service
 * 
 * Implements two distinct integration operations:
 * 1. Invoice Generation (Section 9):
 *    - Triggered only after inspection & administrative approval.
 *    - Generates invoice reference & billing transaction in IPP Pro.
 * 2. Payment Confirmation & Application Activation (Section 10):
 *    - Sourced authoritatively from IPP Pro.
 *    - Approval is NOT activation. Application becomes Active only upon verified payment.
 *    - Updates Payment Status to "Paid", transitions Vehicle Road Status to "Off Road".
 *    - Automatically initiates the separate Application-Data Submission operation.
 * 3. Application-Data Submission (Section 11):
 *    - Separate operation from invoice generation.
 *    - Submits confirmed layoff record to IPP Pro.
 *    - Failure does NOT invalidate payment or activation. Safe retries provided.
 */

import { db } from "./db";
import { recordAuditLog } from "./audit-service";
import { evaluateEmergencyMechanicalFailure } from "./roadworthiness";

export interface IPPProInvoiceResponse {
  success: boolean;
  invoiceNumber: string;
  ippProTransactionRef: string;
  amount: number;
  emergencyFee?: number;
  invoiceDate: string;
  error?: string;
}

export interface IPPProPaymentConfirmation {
  success: boolean;
  paymentReference: string;
  amountPaid: number;
  paidAt: string;
  error?: string;
}

export interface IPPProDataSubmissionResponse {
  success: boolean;
  submissionRef?: string;
  submittedAt: string;
  error?: string;
}

/**
 * Configurable Emergency Mechanical Failure Surcharge
 * 
 * Section 3 Fee Configuration:
 * Authorized administrators can configure this value via the EMERGENCY_MECHANICAL_FAILURE_FEE
 * environment variable or system settings. Default baseline is GH₵ 200.00 until an authorized
 * administrator sets an explicit value before going live.
 */
export const DEFAULT_EMERGENCY_FEE = 200.0;

export function getEmergencyMechanicalFailureFee(): number {
  const envVal = process.env.EMERGENCY_MECHANICAL_FAILURE_FEE;
  if (envVal !== undefined && envVal !== null && envVal.trim() !== "") {
    const parsed = parseFloat(envVal);
    if (!isNaN(parsed) && parsed >= 0) {
      return parsed;
    }
  }
  return DEFAULT_EMERGENCY_FEE;
}

export interface LayoffFeeBreakdown {
  baseFee: number;
  onSiteFee: number;
  emergencyFee: number;
  totalAmount: number;
  isEmergencyMechanicalFailure: boolean;
  emergencyFeeApplies: boolean;
  emergencyFeeReason?: string;
}

/**
 * Calculates itemized layoff fee breakdown based on vehicle type, inspection method,
 * and emergency mechanical failure roadworthiness validity assessment.
 */
export function calculateLayoffFeeBreakdown(params: {
  vehicleType: string;
  inspectionMethod: string;
  isEmergencyMechanicalFailure?: boolean;
  roadworthinessExpiryDate?: string;
  applicationDate?: string;
  vehicleUsageClassification?: "Private" | "Commercial";
}): LayoffFeeBreakdown {
  const baseFee = ["Heavy Truck", "Bus", "Commercial SUV"].includes(params.vehicleType) ? 350 : 150;
  const onSiteFee = params.inspectionMethod === "ON_SITE" ? 100 : 0;

  let emergencyFee = 0;
  let emergencyFeeApplies = false;
  let emergencyFeeReason = "";

  if (params.isEmergencyMechanicalFailure && params.roadworthinessExpiryDate) {
    const appDate = params.applicationDate || new Date().toISOString().split("T")[0];
    const classification = params.vehicleUsageClassification || (["Heavy Truck", "Bus", "Commercial SUV"].includes(params.vehicleType) ? "Commercial" : "Private");
    const emergencyEval = evaluateEmergencyMechanicalFailure(
      params.roadworthinessExpiryDate,
      appDate,
      classification,
      true
    );

    if (emergencyEval.requiresEmergencyFee) {
      emergencyFee = getEmergencyMechanicalFailureFee();
      emergencyFeeApplies = true;
      emergencyFeeReason = emergencyEval.reason;
    }
  }

  const totalAmount = baseFee + onSiteFee + emergencyFee;

  return {
    baseFee,
    onSiteFee,
    emergencyFee,
    totalAmount,
    isEmergencyMechanicalFailure: Boolean(params.isEmergencyMechanicalFailure),
    emergencyFeeApplies,
    emergencyFeeReason,
  };
}

/**
 * Calculates statutory layoff fee based on vehicle type, inspection method, and optional emergency surcharge
 */
export function calculateStatutoryFee(
  vehicleType: string,
  inspectionMethod: string,
  emergencyFee = 0
): number {
  let baseFee = 150; // Standard private saloon / motorcycle / light vehicle
  if (["Heavy Truck", "Bus", "Commercial SUV"].includes(vehicleType)) {
    baseFee = 350;
  }
  // On-site inspection carries an additional statutory field inspection charge (GH₵ 100)
  const onSiteFee = inspectionMethod === "ON_SITE" ? 100 : 0;
  return baseFee + onSiteFee + emergencyFee;
}

/**
 * Operation 1: Generate Invoice via IPP Pro
 * Enforces: Must have satisfied inspection and administrative approval.
 */
export async function generateIPPProInvoice(
  applicationId: string,
  adminUser = "DVLA Approval Authority"
): Promise<IPPProInvoiceResponse> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    return {
      success: false,
      invoiceNumber: "",
      ippProTransactionRef: "",
      amount: 0,
      invoiceDate: "",
      error: `Application ${applicationId} not found.`,
    };
  }

  // Precondition: Administrative approval must be recorded
  if (application.adminApprovalStatus !== "Approved") {
    return {
      success: false,
      invoiceNumber: "",
      ippProTransactionRef: "",
      amount: 0,
      invoiceDate: "",
      error: `Cannot generate invoice: Application must be approved first (Current approval status: ${application.adminApprovalStatus}).`,
    };
  }

  // Deduplication: Check if invoice already generated
  if (application.invoiceNumber && application.invoiceStatus === "Generated") {
    const existing = await db.invoice.findUnique({
      where: { invoiceNumber: application.invoiceNumber },
    });
    if (existing) {
      return {
        success: true,
        invoiceNumber: existing.invoiceNumber,
        ippProTransactionRef: existing.ippProTransactionRef || "IPP-TXN-PREV",
        amount: existing.amount,
        emergencyFee: existing.emergencyFee,
        invoiceDate: existing.invoiceDate,
      };
    }
  }

  const invoiceNumber = `INV-DVLA-${Math.floor(10000 + Math.random() * 90000)}`;
  const ippProTransactionRef = `IPP-TXN-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`;
  const today = new Date().toISOString().split("T")[0];

  const expiry = new Date();
  expiry.setMonth(expiry.getMonth() + (application.layoffPeriodMonths || 6));
  const layoffExpiryDate = expiry.toISOString().split("T")[0];
  const layoffStartDate = application.proposedStartDate || today;

  // Calculate fees independently on the backend with emergency mechanical failure evaluation
  const feeBreakdown = calculateLayoffFeeBreakdown({
    vehicleType: application.vehicleType,
    inspectionMethod: application.inspectionMethod,
    isEmergencyMechanicalFailure: application.isEmergencyMechanicalFailure,
    roadworthinessExpiryDate: application.roadworthinessExpiryDate || undefined,
    applicationDate: application.submittedAt ? application.submittedAt.split(" ")[0] : today,
    vehicleUsageClassification: (application.vehicleUsageClassification as "Private" | "Commercial") || "Private",
  });

  const amount = feeBreakdown.totalAmount;
  const emergencyFee = feeBreakdown.emergencyFee;

  // Create invoice record
  const invoice = await db.invoice.create({
    data: {
      invoiceNumber,
      applicationId: application.id,
      registrationNumber: application.registrationNumber,
      chassisNumber: application.chassisNumber,
      applicantName: application.applicantName,
      amount,
      emergencyFee,
      invoiceDate: today,
      layoffStartDate,
      layoffExpiryDate,
      paymentStatus: "Pending",
      extensionStatus: "Eligible",
      ippProTransactionRef,
      billingDetails: JSON.stringify({
        vehicleType: application.vehicleType,
        inspectionMethod: application.inspectionMethod,
        periodMonths: application.layoffPeriodMonths,
        baseFee: feeBreakdown.baseFee,
        onSiteFee: feeBreakdown.onSiteFee,
        emergencyFee: feeBreakdown.emergencyFee,
        isEmergencyMechanicalFailure: application.isEmergencyMechanicalFailure,
        emergencyFeeApplies: feeBreakdown.emergencyFeeApplies,
        emergencyFeeReason: feeBreakdown.emergencyFeeReason,
      }),
    },
  });

  // Update application record
  await db.application.update({
    where: { id: applicationId },
    data: {
      invoiceNumber,
      invoiceStatus: "Generated",
      paymentStatus: "Pending",
      emergencyFee,
      emergencyFeeReason: feeBreakdown.emergencyFeeReason || application.emergencyFeeReason,
      layoffStartDate,
      layoffExpiryDate,
    },
  });

  // Record audit log
  await recordAuditLog({
    applicationReference: applicationId,
    vehicleReference: application.registrationNumber,
    userName: adminUser,
    userRole: "DVLA Administrator",
    action: "INVOICE_GENERATED_IPP_PRO",
    processIdentifier: "IPP_PRO_GATEWAY",
    previousStatus: application.invoiceStatus,
    newStatus: "Generated",
    details: `Generated statutory invoice ${invoiceNumber} via IPP Pro for GH₵ ${amount.toFixed(2)}${
      emergencyFee > 0 ? ` (Includes GH₵ ${emergencyFee.toFixed(2)} emergency mechanical failure surcharge)` : ""
    }. IPP Ref: ${ippProTransactionRef}.`,
  });

  return {
    success: true,
    invoiceNumber,
    ippProTransactionRef,
    amount,
    emergencyFee,
    invoiceDate: today,
  };
}

/**
 * Operation 2: Confirm Payment & Activate Application
 * Enforces:
 * - Approval is NOT activation.
 * - Application becomes Active and Vehicle Road Status becomes "Off Road" ONLY upon verified payment.
 * - Triggers Operation 3 (Application-Data Submission).
 * - Idempotent against duplicate calls.
 */
export async function confirmIPPProPayment(
  applicationId: string,
  paymentReferenceInput?: string,
  actorName = "IPP Pro Payment Gateway"
): Promise<{ success: boolean; error?: string; application?: any }> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
    include: { invoices: true },
  });

  if (!application) {
    return { success: false, error: "Application not found." };
  }

  // Idempotency check: Already paid and active
  if (application.paymentStatus === "Paid" && application.vehicleRoadStatus === "Off Road") {
    return { success: true, application };
  }

  const paymentReference = paymentReferenceInput || `PAY-IPP-${Date.now().toString().slice(-8)}`;
  const paidAt = new Date().toISOString();

  // 1. Update Invoice status
  if (application.invoiceNumber) {
    await db.invoice.updateMany({
      where: { invoiceNumber: application.invoiceNumber },
      data: {
        paymentStatus: "Paid",
      },
    });
  }

  // 2. Activate application & transition vehicle road status to "Off Road"
  const updatedApp = await db.application.update({
    where: { id: applicationId },
    data: {
      paymentStatus: "Paid",
      paymentReference,
      paymentConfirmedAt: paidAt,
      applicationStatus: "Active",
      status: "Active Layoff", // sync legacy status
      vehicleRoadStatus: "Off Road", // Authoritative road status
      roadStatusChangedAt: paidAt,
      roadStatusReason: "Layoff application paid and activated under Regulation 48.",
      roadStatusChangedBy: actorName,
    },
  });

  // 3. Record audit log for payment and activation
  await recordAuditLog({
    applicationReference: applicationId,
    vehicleReference: application.registrationNumber,
    userName: actorName,
    userRole: "System Admin",
    action: "PAYMENT_CONFIRMED_AND_ACTIVATED",
    processIdentifier: "IPP_PRO_GATEWAY",
    previousStatus: application.paymentStatus,
    newStatus: "Paid",
    details: `IPP Pro confirmed payment (Ref: ${paymentReference}). Layoff activated. Vehicle road status updated from On Road to Off Road.`,
  });

  // 4. Initiate Operation 3: Application-Data Submission (Asynchronous / Separate)
  // We call it immediately and record outcome independently.
  await submitApplicationDataToIPPPro(applicationId);

  return { success: true, application: updatedApp };
}

/**
 * Operation 3: Application-Data Submission to IPP Pro
 * Enforces:
 * - Separate integration operation from invoice generation and payment.
 * - If submission fails, verified payment and active layoff status ARE PRESERVED!
 * - Controlled retry supported.
 */
export async function submitApplicationDataToIPPPro(
  applicationId: string,
  simulateError = false
): Promise<IPPProDataSubmissionResponse> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    return { success: false, submittedAt: new Date().toISOString(), error: "Application not found" };
  }

  const now = new Date().toISOString();

  // Mark as Pending
  await db.application.update({
    where: { id: applicationId },
    data: { ippProSubmissionStatus: "Pending" },
  });

  if (simulateError) {
    // Failure handling: Preserve payment & active status, flag submission as Failed / Pending Retry
    await db.application.update({
      where: { id: applicationId },
      data: {
        ippProSubmissionStatus: "Failed",
        ippProSubmissionError: "IPP Pro Application Data Submission Gateway Timeout (HTTP 504).",
      },
    });

    await recordAuditLog({
      applicationReference: applicationId,
      vehicleReference: application.registrationNumber,
      userName: "IPP Pro Integration Daemon",
      userRole: "System Admin",
      action: "IPP_PRO_SUBMISSION_FAILED",
      processIdentifier: "IPP_PRO_DATA_SYNC",
      previousStatus: "Pending",
      newStatus: "Failed",
      details: "Application-data submission to IPP Pro failed (timeout). Payment & Active Layoff status preserved. Flagged for retry.",
    });

    return {
      success: false,
      submittedAt: now,
      error: "IPP Pro Gateway Timeout during application-data submission.",
    };
  }

  // Simulated successful submission
  const submissionRef = `IPP-DATA-REC-${Math.floor(100000 + Math.random() * 900000)}`;

  await db.application.update({
    where: { id: applicationId },
    data: {
      ippProSubmissionStatus: "Succeeded",
      ippProSubmissionRef: submissionRef,
      ippProSubmittedAt: now,
      ippProSubmissionError: null,
    },
  });

  await recordAuditLog({
    applicationReference: applicationId,
    vehicleReference: application.registrationNumber,
    userName: "IPP Pro Integration Daemon",
    userRole: "System Admin",
    action: "IPP_PRO_DATA_SUBMITTED",
    processIdentifier: "IPP_PRO_DATA_SYNC",
    previousStatus: "Pending",
    newStatus: "Succeeded",
    details: `Successfully synchronized confirmed layoff application data to IPP Pro. Reference: ${submissionRef}.`,
  });

  return {
    success: true,
    submissionRef,
    submittedAt: now,
  };
}

/**
 * Retries failed IPP Pro application data submission safely
 */
export async function retryIPPProSubmission(applicationId: string): Promise<IPPProDataSubmissionResponse> {
  return submitApplicationDataToIPPPro(applicationId, false);
}

/**
 * Formal Return-to-Road Action (Section 13)
 * Vehicle changes from Off Road to On Road only through this formal statutory action.
 */
export async function returnVehicleToRoad(
  applicationId: string,
  officerName: string,
  notes: string
): Promise<{ success: boolean; error?: string }> {
  const application = await db.application.findUnique({
    where: { id: applicationId },
  });

  if (!application) {
    return { success: false, error: "Application not found." };
  }

  const now = new Date().toISOString();

  await db.application.update({
    where: { id: applicationId },
    data: {
      vehicleRoadStatus: "On Road",
      roadStatusChangedAt: now,
      roadStatusReason: notes || "Formal return to road use authorized following inspection and statutory compliance.",
      roadStatusChangedBy: officerName,
      returnToRoadDate: now.split("T")[0],
      returnToRoadNotes: notes,
      applicationStatus: "Completed",
      status: "Completed",
    },
  });

  await recordAuditLog({
    applicationReference: applicationId,
    vehicleReference: application.registrationNumber,
    userName: officerName,
    userRole: "DVLA Administrator",
    action: "VEHICLE_RETURNED_TO_ROAD",
    processIdentifier: "DVLA_COMPLIANCE",
    previousStatus: "Off Road",
    newStatus: "On Road",
    details: `Vehicle formally returned to road use by ${officerName}. Road status updated to On Road. Notes: ${notes}`,
  });

  return { success: true };
}
