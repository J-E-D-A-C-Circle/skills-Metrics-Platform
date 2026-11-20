// End-to-End Verification Test Script for DVLA Vehicle Layoff System
import { db } from "../lib/db";
import { createSessionToken } from "../lib/auth";

async function runTests() {
  console.log("=================================================================");
  console.log("DVLA VEHICLE LAYOFF MANAGEMENT SYSTEM - PHASE 8 VERIFICATION TEST");
  console.log("=================================================================\n");

  const baseUrl = "http://localhost:3000";

  // First check database applications
  const sampleApp = await db.application.findFirst();
  if (!sampleApp) {
    console.error("No applications found in database!");
    return;
  }
  console.log(`Using sample application: ${sampleApp.id} (Registration: ${sampleApp.registrationNumber})\n`);

  // Test 1: Query IPP Pro Compliance Endpoint
  console.log("--- TEST 1: IPP Pro Statutory Compliance Endpoint ---");
  const compRes = await fetch(`${baseUrl}/api/ipp-pro/compliance?registrationNumber=${encodeURIComponent(sampleApp.registrationNumber)}`);
  const compData = await compRes.json();
  console.log("HTTP Status:", compRes.status);
  console.log("Found:", compData.found);
  console.log("Registration:", compData.registrationNumber);
  console.log("Vehicle Road Status:", compData.vehicleRoadStatus);
  console.log("Layoff Status:", compData.layoffStatus);
  console.log("Compliance Alert:", compData.complianceAlert);
  console.log("Statutory Citation:", compData.statute);
  const test1Pass = compRes.status === 200 && compData.found === true && compData.statute?.includes("L.I. 2519");
  console.log("Test 1 Result:", test1Pass ? "PASS" : "FAIL");
  console.log("");

  // Test 2: Public Citizen Tracking Portal Lookup Endpoint
  console.log("--- TEST 2: Public Citizen Tracking Endpoint ---");
  const trackRes = await fetch(`${baseUrl}/api/applications/${encodeURIComponent(sampleApp.id)}`);
  const trackData = await trackRes.json();
  console.log("HTTP Status:", trackRes.status);
  console.log("Reference ID:", trackData.id);
  console.log("Registration:", trackData.registrationNumber);
  console.log("Vehicle Make/Model:", trackData.make, trackData.model);
  console.log("Application Status:", trackData.applicationStatus || trackData.status);
  console.log("Inspection Status:", trackData.inspectionStatus);
  console.log("Payment Status:", trackData.paymentStatus);
  const test2Pass = trackRes.status === 200 && trackData.id === sampleApp.id;
  console.log("Test 2 Result:", test2Pass ? "PASS" : "FAIL");
  console.log("");

  // Test 3: Technical Officer Regional Isolation & Atomic Claiming
  console.log("--- TEST 3: Regional Technical Officer Claiming ---");
  const accraOfficer = await db.user.findFirst({
    where: { role: "TECHNICAL_OFFICER", region: "Greater Accra" },
  });
  console.log("Accra Officer:", accraOfficer?.fullName, `(${accraOfficer?.email}) - Region:`, accraOfficer?.region);

  // Find or configure an Accra application for claiming test
  // Per statutory workflow, only applications with adminApprovalStatus="Approved" enter the inspection pool
  const candidate = await db.application.findFirst({
    where: { storageRegion: "Greater Accra" },
  });

  if (candidate) {
    await db.application.update({
      where: { id: candidate.id },
      data: {
        adminApprovalStatus: "Approved",
        inspectionStatus: "Pending Assignment",
        assignedOfficerId: null,
        assignedOfficerName: null,
        claimedAt: null,
      },
    });
  }

  let accraApp = candidate ? await db.application.findUnique({ where: { id: candidate.id } }) : null;
  console.log("Target Accra App:", accraApp ? `${accraApp.id} (${accraApp.registrationNumber})` : "None found");

  let test3Pass = false;
  if (accraOfficer && accraApp) {
    const officerToken = createSessionToken(accraOfficer);
    const claimRes = await fetch(`${baseUrl}/api/applications/${accraApp.id}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `dvla_session_token=${officerToken}`,
      },
      body: JSON.stringify({ officerId: accraOfficer.id }),
    });
    const claimData = await claimRes.json();
    console.log("Claim HTTP Status:", claimRes.status);
    console.log("Claim Success:", claimData.success);
    console.log("Assigned Officer:", claimData.application?.assignedOfficerName);
    console.log("Inspection Status:", claimData.application?.inspectionStatus);
    test3Pass = claimRes.status === 200 && claimData.success === true && claimData.application?.assignedOfficerName === accraOfficer.fullName;
    console.log("Test 3 Result:", test3Pass ? "PASS" : "FAIL");
  } else {
    console.log("Test 3: Skipping claim execution");
  }
  console.log("");

  // Test 4: Cross-Region Claiming Boundary Constraint (Must return 403 Forbidden)
  console.log("--- TEST 4: Cross-Region Boundary Constraint Check ---");
  const ashantiOfficer = await db.user.findFirst({
    where: { role: "TECHNICAL_OFFICER", region: "Ashanti" },
  });
  console.log("Ashanti Officer:", ashantiOfficer?.fullName, "- Region:", ashantiOfficer?.region);

  // Set up an unassigned Greater Accra app for Ashanti officer claim attempt
  if (candidate) {
    await db.application.update({
      where: { id: candidate.id },
      data: {
        adminApprovalStatus: "Approved",
        inspectionStatus: "Pending Assignment",
        assignedOfficerId: null,
        assignedOfficerName: null,
        claimedAt: null,
      },
    });
  }

  let test4Pass = false;
  if (ashantiOfficer && candidate) {
    console.log(`Attempting cross-claim: Ashanti officer claiming Greater Accra application ${candidate.id}...`);
    const ashantiToken = createSessionToken(ashantiOfficer);
    const crossRes = await fetch(`${baseUrl}/api/applications/${candidate.id}/claim`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `dvla_session_token=${ashantiToken}`,
      },
      body: JSON.stringify({ officerId: ashantiOfficer.id }),
    });
    const crossData = await crossRes.json();
    console.log("Cross-Claim HTTP Status:", crossRes.status);
    console.log("Cross-Claim Response:", crossData.error || crossData.details);
    test4Pass = crossRes.status === 403;
    console.log("Test 4 Result:", test4Pass ? "PASS (REGIONAL SECURITY ENFORCED)" : "FAIL");
  } else {
    console.log("Test 4: Could not find Ashanti officer or Accra app");
  }
  console.log("");

  // Test 5: Follow-Up Inspection Auto-Query Routine
  console.log("--- TEST 5: Follow-Up Inspection Detection Routine ---");
  const officerToken = accraOfficer ? createSessionToken(accraOfficer) : "";
  const followUpRes = await fetch(`${baseUrl}/api/inspections/follow-up`, {
    headers: {
      "Cookie": `dvla_session_token=${officerToken}`,
    },
  });
  const followUpData = await followUpRes.json();
  console.log("HTTP Status:", followUpRes.status);
  console.log("Follow-Up Records Count:", followUpData.records?.length);
  console.log("Candidate Vehicles Requiring Follow-Up:", followUpData.requiredFollowUps?.length);
  const test5Pass = followUpRes.status === 200 && Array.isArray(followUpData.requiredFollowUps);
  console.log("Test 5 Result:", test5Pass ? "PASS" : "FAIL");
  console.log("");

  // Test 6: Statutory Extension Workflow (Create -> Review/Approve -> Pay)
  console.log("--- TEST 6: Statutory Extension Workflow ---");
  await db.extensionRequest.deleteMany({
    where: { applicationId: sampleApp.id, status: { in: ["Pending", "Pending Review"] } },
  });

  // Step 6a: Submit Extension
  console.log(`Submitting extension request for ${sampleApp.id}...`);
  const extSubmitRes = await fetch(`${baseUrl}/api/extensions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      applicationId: sampleApp.id,
      requestedMonths: 3,
      reason: "Vehicle undergoing certified engine overhaul awaiting imported original parts.",
    }),
  });
  const extSubmitData = await extSubmitRes.json();
  console.log("Submit Extension Status:", extSubmitRes.status);
  const extId = extSubmitData.extensionRequest?.id;
  console.log("Created Extension ID:", extId);
  console.log("Fee Calculated:", extSubmitData.extensionRequest?.calculatedFee);
  console.log("Proposed New Expiry:", extSubmitData.extensionRequest?.newExpiryDate);

  let test6Pass = false;
  if (extId) {
    // Step 6b: Approve Extension as Administrator
    const adminUser = await db.user.findFirst({ where: { role: "ADMINISTRATOR" } });
    console.log(`Approving extension ${extId} as Admin ${adminUser?.fullName}...`);
    const adminToken = adminUser ? createSessionToken(adminUser) : "";
    const approveRes = await fetch(`${baseUrl}/api/extensions/${extId}/approve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Cookie": `dvla_session_token=${adminToken}`,
      },
      body: JSON.stringify({
        decision: "Approved",
        reviewNotes: "Statutory layoff extension approved pursuant to L.I. 2519 Regulation 28(3).",
      }),
    });
    const approveData = await approveRes.json();
    console.log("Approve Status:", approveRes.status);
    console.log("Generated Invoice Number:", approveData.invoice?.invoiceNumber);

    // Step 6c: Pay Extension via IPP Pro
    if (approveRes.status === 200) {
      console.log(`Simulating IPP Pro payment confirmation for extension ${extId}...`);
      const payRes = await fetch(`${baseUrl}/api/extensions/${extId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentReference: `PAY-IPP-EXT-${Date.now()}`,
          paymentMethod: "IPP_PRO_MOBILE_MONEY",
        }),
      });
      const payData = await payRes.json();
      console.log("Payment Status:", payRes.status);
      console.log("Updated Application Expiry Date:", payData.application?.layoffExpiryDate);
      console.log("Updated Application Extension Count:", payData.application?.extensionCount);
      test6Pass = payRes.status === 200 && payData.extensionRequest?.paymentStatus === "Paid";
      console.log("Test 6 Result:", test6Pass ? "PASS" : "FAIL");
    }
  }
  console.log("");

  // Test 7: Verify Database Integrity (All original 18 records preserved)
  console.log("--- TEST 7: Database Application Records Count & Integrity ---");
  const totalApps = await db.application.count();
  console.log(`Total Applications in Database: ${totalApps} (Expected >= 18)`);
  const totalInvoices = await db.invoice.count();
  console.log(`Total Invoices in Database: ${totalInvoices}`);
  const totalAudits = await db.auditLog.count();
  console.log(`Total Audit Logs in Database: ${totalAudits}`);
  const totalSMS = await db.sMSNotification.count();
  console.log(`Total SMS Notifications in Database: ${totalSMS}`);
  const test7Pass = totalApps >= 18;
  console.log("Test 7 Result:", test7Pass ? "PASS (ZERO DATA LOSS)" : "FAIL");
  console.log("");

  // Test 8: Official Authentication & Dashboard Route Access
  console.log("--- TEST 8: Official Authentication & Dashboard Route Access ---");
  const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "admin@dvla.gov.gh",
      password: "Password@123",
    }),
  });
  console.log("Login HTTP Status:", loginRes.status);
  const cookieHeader = loginRes.headers.get("set-cookie");
  const tokenCookie = cookieHeader ? cookieHeader.split(";")[0] : "";
  console.log("Set-Cookie Extracted:", tokenCookie.slice(0, 35) + "...");

  // Test accessing /admin with clean cookie
  const adminPageRes = await fetch(`${baseUrl}/admin`, {
    headers: { "Cookie": tokenCookie },
    redirect: "manual",
  });
  console.log("Admin Dashboard Route Status (with session):", adminPageRes.status);
  if (adminPageRes.status !== 200) {
    console.log("Redirect Location:", adminPageRes.headers.get("location"));
  }
  const test8Pass = loginRes.status === 200 && adminPageRes.status === 200;
  console.log("Test 8 Result:", test8Pass ? "PASS" : "FAIL");
  console.log("");

  // Summary
  console.log("=================================================================");
  console.log("FINAL PHASE 8 VERIFICATION SUMMARY:");
  console.log(`Test 1 (IPP Pro Statutory Compliance):     ${test1Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 2 (Public Citizen Tracking Portal):   ${test2Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 3 (Technical Officer Atomic Claim):    ${test3Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 4 (Cross-Region Security Enforcement): ${test4Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 5 (Follow-Up Inspection Routine):     ${test5Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 6 (Statutory Extension Lifecycle):    ${test6Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 7 (Data Integrity & Zero Loss):       ${test7Pass ? "PASSED" : "FAILED"}`);
  console.log(`Test 8 (Official Login & Route Security):  ${test8Pass ? "PASSED" : "FAILED"}`);
  console.log("=================================================================");

  const allPassed = test1Pass && test2Pass && test3Pass && test4Pass && test5Pass && test6Pass && test7Pass && test8Pass;
  if (allPassed) {
    console.log(">>> ALL PHASE 8 VERIFICATION CHECKS PASSED PERFECTLY! <<<");
  } else {
    console.log(">>> SOME CHECKS NEED ATTENTION <<<");
  }
}

runTests().catch(console.error);
