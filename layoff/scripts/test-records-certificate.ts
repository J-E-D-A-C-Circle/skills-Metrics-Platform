import { db } from "../lib/db";

async function runTests() {
  console.log("=== 1. VERIFYING SEEDED OFFICIAL ACCOUNTS IN DATABASE ===");
  const userRows = await db.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      region: true,
      stationLocation: true,
      isActive: true,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });
  console.log(`Total users in DB: ${userRows.length}`);
  userRows.forEach((u) => {
    console.log(` - [${u.role}] ${u.email} | ${u.fullName} (${u.region} - ${u.stationLocation}) Active: ${u.isActive}`);
  });

  console.log("\n=== 2. VERIFYING RECORDS AGGREGATION API ===");
  // Test search against local dev server
  const testQueries = ["0244123456", "Kwame", "GT-4920-22"];

  for (const q of testQueries) {
    console.log(`\nTesting search with query: "${q}"...`);
    try {
      const res = await fetch(`http://localhost:3000/api/records/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        console.error(`HTTP error: ${res.status} ${res.statusText}`);
        const errText = await res.text();
        console.error(errText);
        continue;
      }
      const data = await res.json();
      if (!data.found || !data.dossier) {
        console.log(`No records found for query "${q}". Response:`, data);
        continue;
      }
      const dossier = data.dossier;
      console.log(`✔ Query "${q}" returned dossier for: ${dossier.citizen.legalName} (${dossier.citizen.phone})`);
      console.log(`  - Citizen ID / Ghana Card: ${dossier.citizen.idNumber}`);
      console.log(`  - Total Applications: ${dossier.metrics.totalApplications}`);
      console.log(`  - Active Layoffs: ${dossier.metrics.activeLayoffsCount}`);
      console.log(`  - Total Months Off Road: ${dossier.metrics.totalMonthsLaidOff}`);
      console.log(`  - Total Fees Paid: GHS ${dossier.metrics.totalLifetimeFeesPaid}`);
      console.log(`  - Compliance Rate: ${dossier.metrics.inspectionComplianceRate}%`);
      console.log(`  - Dossier Docket: ${dossier.dossierReference}`);
      console.log(`  - Evidential Checksum (SHA-256): ${dossier.integrityChecksum}`);
      console.log(`  - Evidence Act Citation: ${dossier.evidentialAdmissibility}`);

      dossier.records.forEach((app: any, idx: number) => {
        console.log(`    [#${idx + 1}] Plate: ${app.registrationNumber} | Approval: ${app.adminApprovalStatus} | Payment: ${app.paymentStatus} | RoadStatus: ${app.vehicleRoadStatus}`);
        console.log(`         Certificate Eligible: ${app.isEligibleForCertificate} ${app.certificateBlockReason ? `(Reason: ${app.certificateBlockReason})` : "✔ UNLOCKED"}`);
      });
    } catch (e: any) {
      console.error(`Fetch failed:`, e.message);
    }
  }

  console.log("\n=== 3. VERIFYING STATUTORY CERTIFICATE GATEKEEPING RULES ===");
  const apps = await db.application.findMany({
    select: {
      id: true,
      registrationNumber: true,
      adminApprovalStatus: true,
      paymentStatus: true,
    },
    take: 5,
  });
  apps.forEach((a) => {
    const isApproved = a.adminApprovalStatus === "Approved";
    const isPaid = a.paymentStatus === "Paid";
    const isEligible = isApproved && isPaid;
    console.log(`App ${a.id} (${a.registrationNumber}): Approved=${isApproved}, Paid=${isPaid} => Certificate Eligible: ${isEligible}`);
  });

  process.exit(0);
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
