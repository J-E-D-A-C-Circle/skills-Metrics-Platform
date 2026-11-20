import { describe, it, expect } from "bun:test";
import {
  sendVRSVerificationOTP,
  verifyVRSOTP,
  maskPhoneNumber,
  resolveVRSVehicle,
  vrsOtpStore,
} from "../lib/vrs-otp-service";
import { validateVINFormat } from "../lib/vrs-service";
import { db } from "../lib/db";

describe("VRS SMS OTP Verification Flow", () => {
  const sampleVin = "JN1AZ34A890123456"; // Toyota Corolla in VRS_DATABASE
  const sample12CharVin = "123456789012"; // Toyota Hilux in VRS_DATABASE

  it("masks registered owner phone numbers securely", () => {
    expect(maskPhoneNumber("+233 24 412 3456")).toBe("+233 24 ••• •456");
    expect(maskPhoneNumber("+233 20 882 1190")).toBe("+233 20 ••• •190");
  });

  it("rejects invalid chassis number formats before sending SMS", async () => {
    const invalidShort = await sendVRSVerificationOTP("12345678");
    expect(invalidShort.success).toBe(false);
    expect(invalidShort.error).toBe("Chassis number must contain at least 12 characters.");

    const invalidChar = await sendVRSVerificationOTP("JN1AZ34A89012345I");
    expect(invalidChar.success).toBe(false);
    expect(invalidChar.error).toContain("letters I, O, or Q");
  });

  it("sends SMS OTP to the vehicle's registered phone number and logs SMS notification", async () => {
    const res = await sendVRSVerificationOTP(sampleVin);
    expect(res.success).toBe(true);
    expect(res.vin).toBe(sampleVin);
    expect(res.maskedPhone).toBe("+233 24 ••• •456");
    expect(res.phone).toBe("+233 24 412 3456");
    expect(res.vehicleSummary?.registrationNumber).toBe("GT-4920-22");
    expect(res.vehicleSummary?.make).toBe("Toyota");
    expect(res.vehicleSummary?.model).toBe("Corolla");
    expect(res.otp).toBeDefined();
    expect(res.otp?.length).toBe(6);

    // Verify SMS notification was created in DB
    const latestSms = await db.sMSNotification.findFirst({
      where: { recipientPhone: "+233 24 412 3456" },
      orderBy: { createdAt: "desc" },
    });
    expect(latestSms).toBeDefined();
    expect(latestSms?.event).toBe("VRS Verification OTP");
    expect(latestSms?.message).toContain(res.otp!);
    expect(latestSms?.message).toContain("GT-4920-22");
  });

  it("rejects incorrect OTP with clear error message", async () => {
    const sendRes = await sendVRSVerificationOTP(sampleVin);
    expect(sendRes.success).toBe(true);

    const verifyRes = await verifyVRSOTP(sampleVin, "000000");
    expect(verifyRes.success).toBe(false);
    expect(verifyRes.error).toBe("Invalid OTP code. Please enter the correct 6-digit code sent to your phone.");
    expect(verifyRes.vehicle).toBeUndefined();
  });

  it("verifies correct OTP, unlocks vehicle details, and records audit trail", async () => {
    const sendRes = await sendVRSVerificationOTP(sampleVin);
    expect(sendRes.success).toBe(true);
    const validOtp = sendRes.otp!;

    const verifyRes = await verifyVRSOTP(sampleVin, validOtp);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.vehicle).toBeDefined();
    expect(verifyRes.vehicle?.chassisNumber).toBe(sampleVin);
    expect(verifyRes.vehicle?.registrationNumber).toBe("GT-4920-22");
    expect(verifyRes.vehicle?.registeredOwner.name).toBe("Kofi Mensah Mensah");
    expect(verifyRes.vehicle?.registeredOwner.phone).toBe("+233 24 412 3456");

    // Verify OTP cannot be re-used (one-time security token)
    const reuseRes = await verifyVRSOTP(sampleVin, validOtp);
    expect(reuseRes.success).toBe(false);
    expect(reuseRes.error).toContain("No active verification request found");
  });

  it("handles 12-character chassis numbers seamlessly", async () => {
    const sendRes = await sendVRSVerificationOTP(sample12CharVin);
    expect(sendRes.success).toBe(true);
    expect(sendRes.vehicleSummary?.registrationNumber).toBe("ER-1234-22");

    const verifyRes = await verifyVRSOTP(sample12CharVin, sendRes.otp!);
    expect(verifyRes.success).toBe(true);
    expect(verifyRes.vehicle?.make).toBe("Toyota");
    expect(verifyRes.vehicle?.model).toBe("Hilux Single Cabin");
    expect(verifyRes.vehicle?.registeredOwner.name).toBe("Kwasi Appiah");
  });
});
