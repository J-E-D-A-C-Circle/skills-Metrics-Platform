import { db } from "../lib/db";
import { hashPassword } from "../lib/auth";

async function seedUsersAndConfig() {
  console.log("Seeding DVLA Users and System Configuration...");

  const defaultPasswordHash = hashPassword("Password@123");

  const users = [
    {
      id: "usr-admin-01",
      fullName: "Chief Supt. Osei Tutu",
      staffId: "DVLA-ADM-001",
      email: "admin@dvla.gov.gh",
      phone: "+233 24 411 2233",
      passwordHash: defaultPasswordHash,
      role: "ADMINISTRATOR",
      region: "Greater Accra",
      stationLocation: "DVLA 37 Head Office",
    },
    {
      id: "usr-to-accra-01",
      fullName: "Ing. Samuel Annan",
      staffId: "DVLA-TO-409",
      email: "officer.accra@dvla.gov.gh",
      phone: "+233 24 987 6543",
      passwordHash: defaultPasswordHash,
      role: "TECHNICAL_OFFICER",
      region: "Greater Accra",
      stationLocation: "DVLA 37 Head Office",
    },
    {
      id: "usr-to-kumasi-01",
      fullName: "Ing. Kwame Boateng",
      staffId: "DVLA-TO-215",
      email: "officer.kumasi@dvla.gov.gh",
      phone: "+233 20 882 1190",
      passwordHash: defaultPasswordHash,
      role: "TECHNICAL_OFFICER",
      region: "Ashanti",
      stationLocation: "Kumasi Central Office",
    },
    {
      id: "usr-to-western-01",
      fullName: "Ing. Emmanuel Mensah",
      staffId: "DVLA-TO-304",
      email: "officer.western@dvla.gov.gh",
      phone: "+233 50 123 4567",
      passwordHash: defaultPasswordHash,
      role: "TECHNICAL_OFFICER",
      region: "Western",
      stationLocation: "Takoradi Regional Office",
    },
    {
      id: "usr-comp-01",
      fullName: "Kofi Ampaw Asante-Fosu",
      staffId: "DVLA-CNE-012",
      email: "compliance@dvla.gov.gh",
      phone: "+233 24 555 7890",
      passwordHash: defaultPasswordHash,
      role: "COMPLIANCE_OFFICER",
      region: "Greater Accra",
      stationLocation: "Head Office Compliance Unit",
    },
  ];

  for (const user of users) {
    await db.user.upsert({
      where: { email: user.email },
      update: {
        fullName: user.fullName,
        staffId: user.staffId,
        phone: user.phone,
        role: user.role,
        region: user.region,
        stationLocation: user.stationLocation,
      },
      create: user,
    });
    console.log(`User created/updated: ${user.fullName} (${user.email} - ${user.role} - ${user.region})`);
  }

  const configs = [
    {
      configKey: "EMERGENCY_APPLICATION_FEE",
      configValue: "200.00",
      description: "Additional emergency statutory fee for vehicles not meeting roadworthiness cutoff",
    },
    {
      configKey: "EXTENSION_FEE_MONTHLY",
      configValue: "50.00",
      description: "Statutory monthly rate for approved layoff extension requests",
    },
    {
      configKey: "ON_SITE_INSPECTION_FEE",
      configValue: "100.00",
      description: "Field deployment charge for on-site vehicle technical inspections",
    },
    {
      configKey: "STATUTORY_LI_TITLE",
      configValue: "Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28",
      description: "Authoritative gazetted legislative reference for vehicle layoff certificates",
    },
    {
      configKey: "CUTOFF_PRIVATE_MONTHS",
      configValue: "3",
      description: "Minimum required roadworthiness validity months for private vehicles",
    },
    {
      configKey: "CUTOFF_COMMERCIAL_MONTHS",
      configValue: "2",
      description: "Minimum required roadworthiness validity months for commercial vehicles",
    },
  ];

  for (const cfg of configs) {
    await db.systemConfig.upsert({
      where: { configKey: cfg.configKey },
      update: {
        configValue: cfg.configValue,
        description: cfg.description,
      },
      create: cfg,
    });
    console.log(`Config loaded: ${cfg.configKey} = ${cfg.configValue}`);
  }

  // Populate initial application activities for existing applications
  const existingApps = await db.application.findMany({
    take: 10,
    include: { activities: true },
  });

  for (const app of existingApps) {
    if (app.activities.length === 0) {
      await db.applicationActivity.create({
        data: {
          applicationId: app.id,
          category: "APPLICATION",
          action: "APPLICATION_SUBMITTED",
          description: `Vehicle Layoff application formally submitted under L.I. 2519 Regulation 28 for ${app.registrationNumber}.`,
          actorName: app.applicantName,
          actorRole: "Applicant",
          source: "APPLICANT",
          previousValue: "Draft",
          newValue: app.status,
          referenceNumber: app.id,
        },
      });

      if (app.adminApprovalStatus === "Approved") {
        await db.applicationActivity.create({
          data: {
            applicationId: app.id,
            category: "ADMINISTRATIVE",
            action: "ADMIN_APPROVED",
            description: `Application approved by ${app.adminApprovedBy || "DVLA Administrator"}. Invoicing authorized.`,
            actorName: app.adminApprovedBy || "Chief Supt. Osei Tutu",
            actorRole: "DVLA Administrator",
            source: "ADMINISTRATOR",
            previousValue: "Pending",
            newValue: "Approved",
            referenceNumber: app.id,
          },
        });
      }

      if (app.paymentStatus === "Paid") {
        await db.applicationActivity.create({
          data: {
            applicationId: app.id,
            category: "PAYMENT",
            action: "PAYMENT_CONFIRMED",
            description: `Statutory fee payment verified via IPP Pro (Ref: ${app.paymentReference || "IPP-PAID"}). Vehicle road status updated to Off-Road.`,
            actorName: "IPP Pro Payment Gateway",
            actorRole: "Payment Gateway",
            source: "SYSTEM_AUTOMATION",
            previousValue: "Pending",
            newValue: "Paid",
            referenceNumber: app.paymentReference || app.invoiceNumber,
          },
        });
      }
    }
  }

  console.log("Seeding successfully completed!");
  process.exit(0);
}

seedUsersAndConfig().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
