import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import { ensureDatabaseUsersPopulated } from "@/lib/seed-users";

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUserFromRequest(req);
    if (
      !session ||
      (session.role !== "ADMINISTRATOR" && session.role !== "COMPLIANCE_OFFICER")
    ) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    await ensureDatabaseUsersPopulated();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const region = searchParams.get("region");

    const where: any = {};
    if (role && role !== "ALL") where.role = role;
    if (region && region !== "ALL") where.region = region;

    const users = await db.user.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        staffId: true,
        email: true,
        phone: true,
        role: true,
        region: true,
        stationLocation: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return NextResponse.json({ error: "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || session.role !== "ADMINISTRATOR") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const body = await req.json();
    const {
      fullName,
      staffId,
      email,
      phone,
      role = "TECHNICAL_OFFICER",
      region = "Greater Accra",
      stationLocation = "DVLA 37 Head Office",
      password = "Password@123",
    } = body;

    if (!fullName || !email || !phone) {
      return NextResponse.json(
        { error: "Full Name, Email, and Official Phone Number are required." },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanStaffId = staffId ? staffId.trim() : null;

    // Check existing email
    const existing = await db.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { error: `An account with email ${cleanEmail} already exists.` },
        { status: 409 }
      );
    }

    if (cleanStaffId) {
      const existingStaff = await db.user.findUnique({
        where: { staffId: cleanStaffId },
      });
      if (existingStaff) {
        return NextResponse.json(
          { error: `An account with Staff ID ${cleanStaffId} already exists.` },
          { status: 409 }
        );
      }
    }

    const passwordHash = hashPassword("Password@123");
    const resolvedRegion = role === "ADMINISTRATOR" ? "National Jurisdiction" : region;
    const resolvedStation = role === "ADMINISTRATOR" ? "National Command" : stationLocation.trim();

    const newUser = await db.user.create({
      data: {
        fullName: fullName.trim(),
        staffId: cleanStaffId,
        email: cleanEmail,
        phone: phone.trim(),
        passwordHash,
        role,
        region: resolvedRegion,
        stationLocation: resolvedStation,
        isActive: true,
        lastLoginAt: null,
      },
      select: {
        id: true,
        fullName: true,
        staffId: true,
        email: true,
        phone: true,
        role: true,
        region: true,
        stationLocation: true,
        isActive: true,
        createdAt: true,
      },
    });

    // Record audit log
    await recordAuditLog({
      applicationReference: newUser.id,
      userName: session.fullName,
      userRole: "DVLA Administrator",
      action: "USER_ACCOUNT_CREATED",
      processIdentifier: "USER_MANAGEMENT",
      newStatus: "Active",
      details: `Administrator ${session.fullName} created ${role} account for ${newUser.fullName} (Region: ${region}, Station: ${stationLocation}, Phone: ${phone}).`,
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (error) {
    console.error("Failed to create user:", error);
    return NextResponse.json({ error: "Failed to create user account" }, { status: 500 });
  }
}
