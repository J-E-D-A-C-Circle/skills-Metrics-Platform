/**
 * Roadworthiness Eligibility Calculation & Strict Cutoff Validation
 * 
 * Business Rules (Section 4):
 * - Private vehicles: Roadworthiness certificate expiry date must be strictly LATER than
 *   the date obtained by adding three calendar months to the application date.
 * - Commercial vehicles: Expiry date must be strictly LATER than the date obtained by
 *   adding two calendar months to the application date.
 * - Strict Cutoff Rule: If the expiry date falls exactly on the applicable cutoff date,
 *   the application MUST be rejected as ineligible. Expiry must be strictly AFTER cutoff.
 */

export interface RoadworthinessValidationResult {
  isValid: boolean;
  classification: "Private" | "Commercial";
  applicationDate: string; // YYYY-MM-DD
  requiredMonths: number;  // 3 for Private, 2 for Commercial
  cutoffDate: string;       // YYYY-MM-DD
  expiryDate: string;       // YYYY-MM-DD
  reason?: string;
  isEmergencyMechanicalFailure?: boolean;
  requiresEmergencyFee?: boolean;
}

export interface EmergencyFeeEvaluationResult {
  isEmergencyMechanicalFailure: boolean;
  classification: "Private" | "Commercial";
  requiredMonths: number;
  cutoffDate: string;
  expiryDate: string;
  hasSufficientValidity: boolean;
  requiresEmergencyFee: boolean;
  reason: string;
}

/**
 * Calculates the exact cutoff date using calendar-month additions and month-end clamping.
 * e.g. Nov 30 + 3 calendar months = Feb 28 (or Feb 29 in leap year).
 */
export function calculateRoadworthinessCutoff(
  applicationDateInput: string | Date,
  classification: "Private" | "Commercial"
): { cutoffDate: string; requiredMonths: number } {
  const appDate = typeof applicationDateInput === "string"
    ? new Date(applicationDateInput.includes("T") ? applicationDateInput : `${applicationDateInput}T00:00:00Z`)
    : new Date(applicationDateInput);

  const requiredMonths = classification === "Commercial" ? 2 : 3;

  const year = appDate.getUTCFullYear();
  const month = appDate.getUTCMonth();
  const day = appDate.getUTCDate();

  // Target month
  const targetMonth = month + requiredMonths;
  const targetYear = year + Math.floor(targetMonth / 12);
  const normalizedMonth = targetMonth % 12;

  // Maximum days in the target month (handles February leap year, 30 vs 31 days)
  const daysInTargetMonth = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, daysInTargetMonth);

  const cutoff = new Date(Date.UTC(targetYear, normalizedMonth, targetDay));
  const cutoffDate = cutoff.toISOString().split("T")[0];

  return { cutoffDate, requiredMonths };
}

/**
 * Evaluates whether an emergency mechanical failure application requires an additional fee.
 * 
 * Business Rules (Section 3):
 * - Private vehicles: Less than 3 months of roadworthiness validity remaining (expiryDate <= cutoffDate)
 * - Commercial vehicles: Less than 2 months of roadworthiness validity remaining (expiryDate <= cutoffDate)
 * - If remaining validity is less than the applicable minimum, applicant must pay an additional emergency fee.
 * - If remaining validity meets or exceeds the threshold, no emergency fee is required.
 */
export function evaluateEmergencyMechanicalFailure(
  expiryDateStr: string,
  applicationDateStr: string,
  classification: "Private" | "Commercial",
  isEmergencyMechanicalFailure: boolean
): EmergencyFeeEvaluationResult {
  const { cutoffDate, requiredMonths } = calculateRoadworthinessCutoff(applicationDateStr, classification);
  const cleanExpiry = expiryDateStr.split("T")[0].trim();
  const expiryTime = new Date(`${cleanExpiry}T00:00:00Z`).getTime();
  const cutoffTime = new Date(`${cutoffDate}T00:00:00Z`).getTime();

  // Expiry <= cutoffDate means remaining validity is LESS than the required statutory period (3 months for Private, 2 for Commercial)
  const hasLessValidityThanMinimum = isNaN(expiryTime) || expiryTime <= cutoffTime;

  if (!isEmergencyMechanicalFailure) {
    return {
      isEmergencyMechanicalFailure: false,
      classification,
      requiredMonths,
      cutoffDate,
      expiryDate: cleanExpiry,
      hasSufficientValidity: !hasLessValidityThanMinimum,
      requiresEmergencyFee: false,
      reason: hasLessValidityThanMinimum
        ? `Standard application requires strictly more than ${requiredMonths} months roadworthiness validity (Cutoff: ${cutoffDate}).`
        : "Standard roadworthiness validity satisfied.",
    };
  }

  // Emergency mechanical failure scenario
  if (hasLessValidityThanMinimum) {
    return {
      isEmergencyMechanicalFailure: true,
      classification,
      requiredMonths,
      cutoffDate,
      expiryDate: cleanExpiry,
      hasSufficientValidity: false,
      requiresEmergencyFee: true,
      reason: `Emergency Mechanical Failure: Vehicle has less than the mandatory ${requiredMonths} months of roadworthiness validity remaining (Statutory cutoff: ${cutoffDate}). An additional emergency surcharge applies.`,
    };
  }

  return {
    isEmergencyMechanicalFailure: true,
    classification,
    requiredMonths,
    cutoffDate,
    expiryDate: cleanExpiry,
    hasSufficientValidity: true,
    requiresEmergencyFee: false,
    reason: `Emergency Mechanical Failure: Vehicle certificate has at least ${requiredMonths} months of roadworthiness validity remaining (Cutoff: ${cutoffDate}). No emergency fee applies.`,
  };
}

/**
 * Validates roadworthiness eligibility enforcing the strict cutoff rule,
 * while allowing emergency mechanical failure applications with the required emergency surcharge.
 */
export function validateRoadworthinessEligibility(
  expiryDateStr: string,
  applicationDateStr: string,
  classification: "Private" | "Commercial",
  options?: { isEmergencyMechanicalFailure?: boolean }
): RoadworthinessValidationResult {
  const isEmergency = Boolean(options?.isEmergencyMechanicalFailure);
  const { cutoffDate, requiredMonths } = calculateRoadworthinessCutoff(applicationDateStr, classification);

  const cleanExpiry = expiryDateStr.split("T")[0].trim();
  const cleanAppDate = applicationDateStr.split("T")[0].trim();

  // Parse timestamps for strict comparison (UTC)
  const expiryTime = new Date(`${cleanExpiry}T00:00:00Z`).getTime();
  const cutoffTime = new Date(`${cutoffDate}T00:00:00Z`).getTime();

  if (isNaN(expiryTime)) {
    return {
      isValid: false,
      classification,
      applicationDate: cleanAppDate,
      requiredMonths,
      cutoffDate,
      expiryDate: cleanExpiry,
      reason: "Invalid roadworthiness certificate expiry date format.",
      isEmergencyMechanicalFailure: isEmergency,
      requiresEmergencyFee: false,
    };
  }

  const isBelowOrAtCutoff = expiryTime <= cutoffTime;

  // If below or at cutoff:
  if (isBelowOrAtCutoff) {
    if (isEmergency) {
      // Eligible under Emergency Mechanical Failure with surcharge!
      return {
        isValid: true,
        classification,
        applicationDate: cleanAppDate,
        requiredMonths,
        cutoffDate,
        expiryDate: cleanExpiry,
        isEmergencyMechanicalFailure: true,
        requiresEmergencyFee: true,
        reason: `Emergency Mechanical Failure: Vehicle has less than the standard ${requiredMonths}-month roadworthiness validity remaining (${cleanExpiry} vs cutoff ${cutoffDate}). Application allowed with emergency fee.`,
      };
    }

    // Standard application: Strict cutoff rule
    if (expiryTime === cutoffTime) {
      return {
        isValid: false,
        classification,
        applicationDate: cleanAppDate,
        requiredMonths,
        cutoffDate,
        expiryDate: cleanExpiry,
        reason: `Strict Cutoff Ineligibility: Roadworthiness certificate expires exactly on the statutory cutoff date (${cutoffDate}). Regulation requires expiry strictly AFTER this date.`,
        isEmergencyMechanicalFailure: false,
        requiresEmergencyFee: false,
      };
    }

    return {
      isValid: false,
      classification,
      applicationDate: cleanAppDate,
      requiredMonths,
      cutoffDate,
      expiryDate: cleanExpiry,
      reason: `${classification} vehicle roadworthiness certificate expired or expires before the mandatory ${requiredMonths}-month statutory cutoff (${cutoffDate}).`,
      isEmergencyMechanicalFailure: false,
      requiresEmergencyFee: false,
    };
  }

  // Meets or exceeds cutoff
  return {
    isValid: true,
    classification,
    applicationDate: cleanAppDate,
    requiredMonths,
    cutoffDate,
    expiryDate: cleanExpiry,
    isEmergencyMechanicalFailure: isEmergency,
    requiresEmergencyFee: false,
  };
}
