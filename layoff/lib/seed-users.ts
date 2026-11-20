import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

export const OFFICIAL_DB_USERS = [
  {
    id: "USR-ADMIN-001",
    fullName: "Chief Supt. Osei Tutu",
    email: "admin@dvla.gov.gh",
    phone: "+233 30 277 6543",
    role: "ADMINISTRATOR" as const,
    region: "National Jurisdiction",
    stationLocation: "National Command",
    staffId: "DVLA-ADM-001",
    isActive: true,
    lastLoginAt: new Date("2026-11-01T08:00:00Z"),
  },
  {
    id: "TO-409",
    fullName: "Ing. Samuel Annan",
    email: "officer.accra@dvla.gov.gh",
    phone: "+233 24 987 6543",
    role: "TECHNICAL_OFFICER" as const,
    region: "Greater Accra",
    stationLocation: "37 Military Hospital Road Head Office",
    staffId: "TO-409",
    isActive: true,
    lastLoginAt: new Date("2026-11-01T08:30:00Z"),
  },
  {
    id: "TO-204",
    fullName: "Ing. Beatrice Arthur",
    email: "b.arthur@dvla.gov.gh",
    phone: "+233 20 551 0928",
    role: "TECHNICAL_OFFICER" as const,
    region: "Greater Accra",
    stationLocation: "Tema Regional DVLA Station",
    staffId: "TO-204",
    isActive: true,
    lastLoginAt: new Date("2026-11-01T09:00:00Z"),
  },
  {
    id: "TO-304",
    fullName: "Insp. Emmanuel Darko",
    email: "e.darko@dvla.gov.gh",
    phone: "+233 24 991 0021",
    role: "TECHNICAL_OFFICER" as const,
    region: "Greater Accra",
    stationLocation: "Weija DVLA Operational Office",
    staffId: "TO-304",
    isActive: true,
    lastLoginAt: new Date("2026-11-01T09:15:00Z"),
  },
  {
    id: "CM-301",
    fullName: "Hajia Mariama Alhassan",
    email: "compliance@dvla.gov.gh",
    phone: "+233 20 812 3344",
    role: "COMPLIANCE_OFFICER" as const,
    region: "Greater Accra",
    stationLocation: "37 Military Hospital Road Head Office",
    staffId: "CM-301",
    isActive: true,
    lastLoginAt: new Date("2026-11-01T09:30:00Z"),
  },
];

let seededInProcess = false;

/**
 * Ensures the core official staff accounts are populated in the MySQL User table
 * and removes obsolete multi-station demo accounts if present.
 */
export async function ensureDatabaseUsersPopulated(): Promise<void> {
  if (seededInProcess) return;
  try {
    const defaultPasswordHash = hashPassword("Password@123");

    // Remove legacy demo accounts from other stations if they exist
    await db.user.deleteMany({
      where: {
        email: {
          in: ["officer.kumasi@dvla.gov.gh", "officer.western@dvla.gov.gh"],
        },
      },
    });

    for (const u of OFFICIAL_DB_USERS) {
      const existing = await db.user.findUnique({
        where: { email: u.email },
      });

      if (!existing) {
        await db.user.create({
          data: {
            id: u.id,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone,
            passwordHash: defaultPasswordHash,
            role: u.role,
            region: u.region,
            stationLocation: u.stationLocation,
            staffId: u.staffId,
            isActive: u.isActive,
            lastLoginAt: u.lastLoginAt,
          },
        });
      } else if (existing.phone !== u.phone) {
        await db.user.update({
          where: { email: u.email },
          data: { phone: u.phone },
        });
      }
    }

    seededInProcess = true;
  } catch (err) {
    console.error("Failed to populate database users:", err);
  }
}

