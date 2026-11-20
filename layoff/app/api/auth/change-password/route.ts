import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";

const DEFAULT_STAFF_PASSWORD = "Password@123";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, currentPassword, newPassword } = body;

    if (!email || !currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Account identifier, current password, and new password are required." },
        { status: 400 }
      );
    }

    const trimmedNew = String(newPassword).trim();
    if (trimmedNew.length < 6) {
      return NextResponse.json(
        { error: "New password must be at least 6 characters long." },
        { status: 400 }
      );
    }

    if (trimmedNew === DEFAULT_STAFF_PASSWORD || trimmedNew === "Password123!") {
      return NextResponse.json(
        { error: "Your new password cannot be the system default password." },
        { status: 400 }
      );
    }

    const cleanInput = String(email).trim();
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
        { error: "Account not found." },
        { status: 404 }
      );
    }

    const isValid =
      verifyPassword(currentPassword, user.passwordHash) ||
      (currentPassword === "Password123!" && verifyPassword(DEFAULT_STAFF_PASSWORD, user.passwordHash));

    if (!isValid) {
      return NextResponse.json(
        { error: "Current default password verification failed." },
        { status: 401 }
      );
    }

    const newPasswordHash = hashPassword(trimmedNew);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        lastLoginAt: new Date(),
      },
    });

    await recordAuditLog({
      applicationReference: user.staffId || user.id,
      userName: user.fullName,
      userRole: user.role === "ADMINISTRATOR" ? "DVLA Administrator" : "Technical Officer",
      action: "FIRST_LOGIN_PASSWORD_CHANGED",
      processIdentifier: "AUTH_SECURITY",
      previousStatus: "Default Password",
      newStatus: "Personal Password Set",
      details: `${user.fullName} (${user.email}) changed their default password on first-time sign-in.`,
    });

    return NextResponse.json({
      success: true,
      email: user.email,
      staffId: user.staffId,
      message: "Password updated successfully. Please sign in with your username/email and new password.",
    });
  } catch (error) {
    console.error("Failed to change password on first login:", error);
    return NextResponse.json(
      { error: "An error occurred while updating your password." },
      { status: 500 }
    );
  }
}

