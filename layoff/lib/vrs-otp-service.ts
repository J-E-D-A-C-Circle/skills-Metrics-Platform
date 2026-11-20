/**
 * VRS Vehicle Verification OTP Service
 *
 * Implements SMS-based OTP authorization for retrieving and viewing
 * authoritative vehicle details from the Vehicle Registration System (VRS).
 *
 * Flow:
 * 1. User enters Chassis / VIN and clicks "Verify Vehicle with VRS".
 * 2. System identifies the registered vehicle record and owner's mobile number.
 * 3. System dispatches a secure 6-digit OTP via SMS to the registered number.
 * 4. User inputs the OTP into the modal.
 * 5. System verifies the OTP and reveals the authoritative vehicle & owner specs.
 */

import { VRS_DATABASE, VRSVehicleRecord, validateVINFormat } from "./vrs-service";
import { sendSMSNotification } from "./sms-service";
import { recordAuditLog } from "./audit-service";

export interface PendingVRSOTP {
  vin: string;
  otp: string;
  phone: string;
  maskedPhone: string;
  vehicle: VRSVehicleRecord;
  createdAt: number;
  expiresAt: number;
  attempts: number;
}

// Global store to persist OTP state across Next.js dev server hot-reloads
const globalForVrsOtp = globalThis as unknown as {
  vrsOtpStore?: Map<string, PendingVRSOTP>;
};

export const vrsOtpStore = globalForVrsOtp.vrsOtpStore ?? new Map<string, PendingVRSOTP>();
if (process.env.NODE_ENV !== "production") {
  globalForVrsOtp.vrsOtpStore = vrsOtpStore;
}

export function maskPhoneNumber(phone: string): string {
  if (!phone) return "+233 •• ••• ••••";
  const trimmed = phone.trim();
  // Standard format like "+233 24 412 3456" -> "+233 24 ••• •456"
  const parts = trimmed.split(" ");
  if (parts.length >= 4) {
    return `${parts[0]} ${parts[1]} ••• •${parts[3].slice(-3)}`;
  }
  if (trimmed.length > 7) {
    return `${trimmed.slice(0, 6)} ••• •${trimmed.slice(-3)}`;
  }
  return trimmed;
}

/**
 * Resolves vehicle record for a given VIN from VRS_DATABASE or creates a consistent fallback.
 */
export function resolveVRSVehicle(vin: string): VRSVehicleRecord {
  const normalized = vin.trim().toUpperCase();
  if (VRS_DATABASE[normalized]) {
    return VRS_DATABASE[normalized];
  }

  // Dynamic fallback for any valid arbitrary 12-17 character chassis number entered in development/demo
  const lastFour = normalized.slice(-4);
  return {
    chassisNumber: normalized,
    registrationNumber: `GR-${lastFour}-25`,
    make: "Toyota",
    model: "Corolla Executive",
    yearOfMake: "2023",
    vehicleType: "Private Saloon",
    vehicleUsageClassification: "Private",
    colour: "Silver Metallic",
    engineNumber: `2ZR-${lastFour}88`,
    engineCapacityCc: 1800,
    registeredOwner: {
      name: "Kwame Kyei Boateng",
      idNumber: `GHA-${normalized.replace(/\D/g, "7").padEnd(9, "0").slice(0, 9)}-1`,
      phone: "+233 24 412 3456",
      email: "k.boateng@driver-registry.gh",
      residentialAddress: "House No. 12, Ring Road Central, Accra",
      digitalAddress: "GA-145-2036",
    },
    roadworthinessExpiryDate: "2027-05-20",
    registrationStatus: "Active",
  };
}

export interface SendVRSOTPResult {
  success: boolean;
  error?: string;
  vin?: string;
  maskedPhone?: string;
  phone?: string;
  otp?: string;
  vehicleSummary?: {
    make: string;
    model: string;
    registrationNumber: string;
    chassisNumber: string;
  };
  expiresInSeconds?: number;
}

/**
 * Generates and sends a 6-digit verification code to the registered owner's phone.
 */
export async function sendVRSVerificationOTP(vinInput: string): Promise<SendVRSOTPResult> {
  const formatCheck = validateVINFormat(vinInput);
  if (!formatCheck.isValid) {
    return {
      success: false,
      error: formatCheck.error || "Invalid chassis number format.",
    };
  }

  const vin = formatCheck.normalized;
  const vehicle = resolveVRSVehicle(vin);
  const phone = vehicle.registeredOwner.phone;
  const maskedPhone = maskPhoneNumber(phone);

  // Generate 6-digit numeric OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresInSeconds = 600; // 10 minutes
  const now = Date.now();

  // Save to OTP cache
  vrsOtpStore.set(vin, {
    vin,
    otp,
    phone,
    maskedPhone,
    vehicle,
    createdAt: now,
    expiresAt: now + expiresInSeconds * 1000,
    attempts: 0,
  });

  // Construct message
  const smsMessage = `DVLA VRS VERIFICATION: Your One-Time Password (OTP) for vehicle ${vehicle.registrationNumber} (Chassis: ${vehicle.chassisNumber}) is: ${otp}. Valid for 10 minutes. Do not share this code.`;

  // Dispatch SMS
  await sendSMSNotification({
    recipientPhone: phone,
    message: smsMessage,
    event: "VRS Verification OTP",
    registrationNumber: vehicle.registrationNumber,
  });

  // Log in Audit Trail
  await recordAuditLog({
    applicationReference: `VRS-OTP-${vin.slice(-6)}`,
    vehicleReference: vehicle.registrationNumber,
    userName: "Applicant Portal",
    userRole: "Applicant",
    action: "VRS_OTP_DISPATCHED",
    processIdentifier: "VRS_SECURITY_GATEWAY",
    details: `Dispatched VRS verification OTP to registered owner mobile (${maskedPhone}) for vehicle ${vehicle.registrationNumber} (Chassis: ${vin}).`,
  });

  return {
    success: true,
    vin,
    maskedPhone,
    phone,
    otp, // Provided for live simulation/convenience
    vehicleSummary: {
      make: vehicle.make,
      model: vehicle.model,
      registrationNumber: vehicle.registrationNumber,
      chassisNumber: vehicle.chassisNumber,
    },
    expiresInSeconds,
  };
}

export interface VerifyVRSOTPResult {
  success: boolean;
  error?: string;
  vehicle?: VRSVehicleRecord;
}

/**
 * Validates the entered OTP code against the pending session.
 */
export async function verifyVRSOTP(vinInput: string, enteredOtp: string): Promise<VerifyVRSOTPResult> {
  const formatCheck = validateVINFormat(vinInput);
  if (!formatCheck.isValid) {
    return {
      success: false,
      error: formatCheck.error || "Invalid chassis number format.",
    };
  }

  const vin = formatCheck.normalized;
  const pending = vrsOtpStore.get(vin);

  if (!pending) {
    return {
      success: false,
      error: "No active verification request found for this vehicle. Please click 'Verify with VRS' to receive a code.",
    };
  }

  if (Date.now() > pending.expiresAt) {
    vrsOtpStore.delete(vin);
    return {
      success: false,
      error: "Verification code has expired (10 min limit). Please request a new code.",
    };
  }

  pending.attempts += 1;
  if (pending.attempts > 5) {
    vrsOtpStore.delete(vin);
    return {
      success: false,
      error: "Maximum verification attempts exceeded. Please request a new code.",
    };
  }

  const cleanOtp = enteredOtp?.trim();
  if (cleanOtp !== pending.otp) {
    return {
      success: false,
      error: "Invalid OTP code. Please enter the correct 6-digit code sent to your phone.",
    };
  }

  // Verification successful!
  const verifiedVehicle = pending.vehicle;
  vrsOtpStore.delete(vin);

  // Record audit log
  await recordAuditLog({
    applicationReference: `VRS-AUTH-${vin.slice(-6)}`,
    vehicleReference: verifiedVehicle.registrationNumber,
    userName: "Applicant Portal",
    userRole: "Applicant",
    action: "VRS_OTP_VERIFIED_SUCCESS",
    processIdentifier: "VRS_SECURITY_GATEWAY",
    details: `Successfully validated registered owner SMS OTP for VIN ${vin} (${verifiedVehicle.make} ${verifiedVehicle.model}, ${verifiedVehicle.registrationNumber}). Official vehicle and owner records unlocked.`,
  });

  return {
    success: true,
    vehicle: verifiedVehicle,
  };
}
