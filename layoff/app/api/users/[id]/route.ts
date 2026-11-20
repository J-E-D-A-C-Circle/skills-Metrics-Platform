import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || session.role !== "ADMINISTRATOR") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const updateData: any = {};
    if (body.fullName !== undefined) updateData.fullName = body.fullName.trim();
    if (body.staffId !== undefined) updateData.staffId = body.staffId ? body.staffId.trim() : null;
    if (body.phone !== undefined) updateData.phone = body.phone.trim();
    if (body.role !== undefined) updateData.role = body.role;
    if (body.region !== undefined) updateData.region = body.region;
    if (body.stationLocation !== undefined) updateData.stationLocation = body.stationLocation.trim();
    if (body.isActive !== undefined) updateData.isActive = Boolean(body.isActive);
    if (body.password) {
      updateData.passwordHash = hashPassword(body.password);
      if (body.password === "Password@123") {
        updateData.lastLoginAt = null;
      }
    }

    const updated = await db.user.update({
      where: { id },
      data: updateData,
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
        updatedAt: true,
      },
    });

    await recordAuditLog({
      applicationReference: id,
      userName: session.fullName,
      userRole: "DVLA Administrator",
      action: "USER_ACCOUNT_UPDATED",
      processIdentifier: "USER_MANAGEMENT",
      previousStatus: existing.role,
      newStatus: updated.role,
      details: `Administrator ${session.fullName} updated account details for ${updated.fullName} (Region: ${updated.region}, Station: ${updated.stationLocation}, Status: ${updated.isActive ? "Active" : "Inactive"}).`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || session.role !== "ADMINISTRATOR") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { id } = await params;

    if (id === session.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own active administrator account." },
        { status: 400 }
      );
    }

    const existing = await db.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "User account not found" }, { status: 404 });
    }

    await db.$transaction(async (tx) => {
      // Release any non-completed inspection cases claimed by this officer back to the regional pool
      await tx.application.updateMany({
        where: {
          assignedOfficerId: id,
          inspectionStatus: { not: "Completed" },
        },
        data: {
          assignedOfficerId: null,
          assignedOfficerName: null,
          claimedAt: null,
          inspectionStatus: "Pending Assignment",
        },
      });

      // Detach or remove dependent records referencing this user
      await tx.inspectionRecord.deleteMany({
        where: { officerId: id },
      });

      await tx.helplineTicket.updateMany({
        where: { assignedOfficerId: id },
        data: { assignedOfficerId: null },
      });

      await tx.bulkSMSCampaign.deleteMany({
        where: { createdById: id },
      });

      await tx.user.delete({
        where: { id },
      });
    });

    await recordAuditLog({
      applicationReference: id,
      userName: session.fullName,
      userRole: "DVLA Administrator",
      action: "USER_ACCOUNT_DELETED",
      processIdentifier: "USER_MANAGEMENT",
      previousStatus: existing.role,
      newStatus: "DELETED",
      details: `Administrator ${session.fullName} permanently deleted ${existing.role.replace("_", " ")} account for ${existing.fullName} (${existing.email}, Region: ${existing.region}, Station: ${existing.stationLocation}). Any active unclaimed inspections were returned to the regional pool.`,
    });

    return NextResponse.json({
      success: true,
      message: `Account for ${existing.fullName} has been permanently deleted.`,
    });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return NextResponse.json({ error: "Failed to delete user account" }, { status: 500 });
  }
}
