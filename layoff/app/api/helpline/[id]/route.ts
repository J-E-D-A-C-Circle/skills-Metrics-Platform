import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || (session.role !== "ADMINISTRATOR" && session.role !== "TECHNICAL_OFFICER")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { id } = await params;
    const body = await req.json();

    const existing = await db.helplineTicket.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    const { status, assignedOfficerId, resolutionNotes, priority } = body;

    const updateData: any = {};
    if (status !== undefined) updateData.status = status;
    if (priority !== undefined) updateData.priority = priority;
    if (assignedOfficerId !== undefined) updateData.assignedOfficerId = assignedOfficerId || null;
    if (resolutionNotes !== undefined) {
      updateData.resolutionNotes = resolutionNotes;
      if (status === "Resolved" || status === "Closed") {
        updateData.resolvedAt = new Date();
      }
    }

    const updated = await db.helplineTicket.update({
      where: { id },
      data: updateData,
      include: {
        assignedOfficer: {
          select: { id: true, fullName: true, staffId: true, role: true, phone: true },
        },
      },
    });

    // Notify applicant if resolved
    if (status === "Resolved" && existing.status !== "Resolved") {
      await sendSMSNotification({
        recipientPhone: existing.applicantPhone,
        message: `DVLA HELPLINE: Your ticket ${existing.ticketNumber} has been resolved. Note: "${resolutionNotes || "Action completed by DVLA support"}". Thank you for contacting DVLA.`,
        event: "Helpline Ticket Resolved" as any,
        applicationId: existing.applicationReference || undefined,
        registrationNumber: existing.registrationNumber || undefined,
      });
    }

    await recordAuditLog({
      applicationReference: existing.applicationReference || existing.ticketNumber,
      userName: session.fullName,
      userRole: session.role === "ADMINISTRATOR" ? "DVLA Administrator" : "Technical Officer",
      action: "HELPLINE_TICKET_UPDATED",
      processIdentifier: "HELPLINE_SERVICE",
      previousStatus: existing.status,
      newStatus: status || existing.status,
      details: `${session.fullName} updated ticket ${existing.ticketNumber}: Status=${status || existing.status}, AssignedTo=${updated.assignedOfficer?.fullName || "Unassigned"}.`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update helpline ticket:", error);
    return NextResponse.json({ error: "Failed to update ticket" }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || (session.role !== "ADMINISTRATOR" && session.role !== "TECHNICAL_OFFICER")) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { id } = await params;
    const existing = await db.helplineTicket.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
    }

    await db.helplineTicket.delete({ where: { id } });

    await recordAuditLog({
      applicationReference: existing.applicationReference || existing.ticketNumber,
      userName: session.fullName,
      userRole: session.role === "ADMINISTRATOR" ? "DVLA Administrator" : "Technical Officer",
      action: "HELPLINE_TICKET_DELETED",
      processIdentifier: "HELPLINE_SERVICE",
      previousStatus: existing.status,
      newStatus: "Deleted",
      details: `${session.fullName} deleted support ticket ${existing.ticketNumber} from ${existing.applicantName}.`,
    });

    return NextResponse.json({ success: true, message: "Support ticket deleted successfully." });
  } catch (error) {
    console.error("Failed to delete helpline ticket:", error);
    return NextResponse.json({ error: "Failed to delete ticket" }, { status: 500 });
  }
}
