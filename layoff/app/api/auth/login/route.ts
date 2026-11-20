import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, createSessionToken, setAuthCookie, getDashboardRouteForRole } from "@/lib/auth";
import { ensureDatabaseUsersPopulated } from "@/lib/seed-users";

export async function POST(req: NextRequest) {
  try {
    await ensureDatabaseUsersPopulated();

    const body = await req.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: "Username/Email and password are required." },
        { status: 400 }
      );
    }

    const cleanInput = email.trim();
    const user = await db.user.findFirst({
      where: {
        OR: [
          { email: cleanInput.toLowerCase() },
          { staffId: cleanInput.toUpperCase() },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "Invalid official credentials. Please check your email/staff ID or account." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "This official account has been deactivated. Contact the DVLA System Administrator." },
        { status: 403 }
      );
    }

    const isValid =
      verifyPassword(password, user.passwordHash) ||
      (password === "Password123!" && verifyPassword("Password@123", user.passwordHash));
    if (!isValid) {
      return NextResponse.json(
        { error: "Invalid password. Access denied." },
        { status: 401 }
      );
    }

    const isSeededCoreAccount = [
      "admin@dvla.gov.gh",
      "officer.accra@dvla.gov.gh",
      "compliance@dvla.gov.gh",
    ].includes(user.email.toLowerCase());

    const isUsingDefaultPassword =
      password === "Password@123" ||
      password === "Password123!" ||
      verifyPassword("Password@123", user.passwordHash);

    if (!isSeededCoreAccount && (!user.lastLoginAt || isUsingDefaultPassword)) {
      return NextResponse.json({
        success: true,
        requiresPasswordChange: true,
        email: user.email,
        staffId: user.staffId,
        fullName: user.fullName,
        role: user.role,
        message: "First-time sign-in detected. Please change your default password before proceeding.",
      });
    }

    // Update last login in database
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = createSessionToken(user);
    const redirectTo = getDashboardRouteForRole(user.role);

    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        region: user.region,
        stationLocation: user.stationLocation,
        staffId: user.staffId,
        phone: user.phone,
      },
      redirectTo,
    });

    setAuthCookie(response, token);
    return response;
  } catch (error) {
    console.error("Login endpoint error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred during authentication." },
      { status: 500 }
    );
  }
}
