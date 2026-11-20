import { db } from "../lib/db";

async function testCitizenSubmission() {
  console.log("=================================================================");
  console.log("CITIZEN WIZARD & STATUTORY DECLARATION VERIFICATION TEST");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // Test Citizen Application with L.I. 2519 Regulation 28 Statutory Acceptance
  const testRef = `LAY-2026-TEST-${Date.now().toString().slice(-4)}`;
  const payload = {
    id: testRef,
    applicantName: "Kwame Asante Mensah",
    applicantPhone: "0244123456",
    applicantEmail: "kwame.mensah@example.com",
    idNumber: "GHA-723456789-1",
    residentialAddress: "House No 14, Ring Road Central, Accra",
    digitalAddress: "GA-183-4920",

    // VRS & Vehicle
    vrsVerified: true,
    vrsVerificationDate: new Date().toISOString().split("T")[0],
    applicantType: "OWNER",
    registrationNumber: "GS-8910-24",
    chassisNumber: "KMHCT41ERHU129845",
    engineNumber: "G4FA-948102",
    make: "Hyundai",
    model: "Elantra",
    yearOfMake: "2021",
    vehicleType: "Saloon Car",
    colour: "Silver Metallic",
    vehicleUsageClassification: "Private",
    roadworthinessExpiryDate: "2027-04-15", // valid roadworthiness (>3 months from current date)
    roadworthinessValid: true,
    isEmergencyMechanicalFailure: false,
    emergencyFee: 0,

    // Layoff details
    reason: "Protracted overseas study assignment and lack of secure operational garage.",
    explanation: "Vehicle will be securely jacked on stands in a locked, covered residential storage compound in Madina.",
    storageFacilityName: "Private Covered Residential Garage",
    storageRegion: "Greater Accra",
    proposedStartDate: new Date().toISOString().split("T")[0],
    layoffPeriodMonths: 6,

    // Inspection
    inspectionMethod: "OFFICE",
    inspectionOfficeLocation: "DVLA 37 Operational Center",

    // Statutory Declaration acceptance (L.I. 2519 Regulation 28)
    declarationAccepted: true,
    declarationText: "I solemnly declare that vehicle GS-8910-24 will remain strictly immobilized and laid off in accordance with Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28.",
    declarationApplicantName: "Kwame Asante Mensah",
    declarationIdNumber: "GHA-723456789-1",
  };

  console.log(`Submitting new citizen application ${testRef}...`);
  const res = await fetch(`${baseUrl}/api/applications`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  console.log("Submission Status:", res.status);
  console.log("Success:", data.success);
  console.log("Application ID:", data.application?.id);
  console.log("Status:", data.application?.status);
  console.log("Road Status:", data.application?.vehicleRoadStatus);

  // Verify declaration acceptance in database
  const declarationRecord = await db.declarationAcceptance.findUnique({
    where: { applicationId: testRef },
  });
  console.log("Declaration Record in DB:", declarationRecord ? "EXISTS" : "NOT FOUND");
  console.log("Declaration Statute:", declarationRecord?.statutoryReference);
  console.log("Declaration Applicant:", declarationRecord?.applicantName);

  // Verify SMS notification was dispatched
  const sms = await db.sMSNotification.findFirst({
    where: { message: { contains: testRef } },
    orderBy: { createdAt: "desc" },
  });
  console.log("Dispatched SMS Message:", sms?.message);

  const testPassed = res.status === 201 && 
    declarationRecord !== null && 
    declarationRecord?.statutoryReference.includes("L.I. 2519") &&
    sms?.message.includes("/tracking");

  console.log("\nCitizen Application & Declaration Result:", testPassed ? "PASS" : "FAIL");

  // Clean up test application and declaration to keep test records pristine
  if (data.application) {
    await db.declarationAcceptance.deleteMany({ where: { applicationId: testRef } });
    await db.invoice.deleteMany({ where: { applicationId: testRef } });
    await db.applicationActivity.deleteMany({ where: { applicationId: testRef } });
    await db.application.delete({ where: { id: testRef } });
    console.log(`Cleaned up ephemeral test record ${testRef}`);
  }
}

testCitizenSubmission().catch(console.error);
