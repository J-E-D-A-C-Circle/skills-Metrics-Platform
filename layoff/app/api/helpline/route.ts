import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";
import { sendSMSNotification } from "@/lib/sms-service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const category = searchParams.get("category");

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (category && category !== "ALL") where.category = category;

    const tickets = await db.helplineTicket.findMany({
      where,
      include: {
        assignedOfficer: {
          select: { id: true, fullName: true, staffId: true, role: true, phone: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(tickets);
  } catch (error) {
    console.error("Failed to fetch helpline tickets:", error);
    return NextResponse.json({ error: "Failed to fetch helpline tickets" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const applicantName = String(body.applicantName || body.name || "").trim();
    const rawPhone = String(body.applicantPhone || body.contact || body.phone_number || "").trim();
    const cleanDigits = rawPhone.replace(/[\s\-()]/g, "").replace(/^\+/, "");
    const applicantEmail = body.applicantEmail ? String(body.applicantEmail).trim() : null;
    const registrationNumber = body.registrationNumber ? String(body.registrationNumber).trim().toUpperCase() : null;
    const applicationReference = body.applicationReference ? String(body.applicationReference).trim().toUpperCase() : null;
    const category = String(body.category || "GENERAL").trim();
    const description = String(body.description || body.message || body.issue_description || "").trim();
    const subject = String(
      body.subject ||
        (description.length > 56 ? `${description.slice(0, 56)}...` : description) ||
        `Support Request from ${applicantName}`
    ).trim();
    const priority = String(body.priority || "Medium").trim();

    if (!applicantName) {
      return NextResponse.json({ error: "Please provide your full name." }, { status: 400 });
    }

    if (!cleanDigits || !/^[0-9]{10,15}$/.test(cleanDigits)) {
      return NextResponse.json(
        { error: "Please provide a valid phone number (10 to 15 digits, e.g. 0241234567)." },
        { status: 400 }
      );
    }

    if (!description) {
      return NextResponse.json({ error: "Please describe your issue in the message box." }, { status: 400 });
    }

    const ticketNumber = `TKT-${new Date().getFullYear()}-${Math.floor(10000 + Math.random() * 90000)}`;

    const ticket = await db.helplineTicket.create({
      data: {
        ticketNumber,
        applicantName,
        applicantPhone: rawPhone,
        applicantEmail,
        registrationNumber,
        applicationReference,
        category,
        subject,
        description,
        priority,
        status: "Open",
      },
    });

    // Notify applicant by SMS with ticket reference
    await sendSMSNotification({
      recipientPhone: rawPhone,
      message: `DVLA HELPLINE: Your enquiry regarding vehicle layoff has been registered with Ticket No: ${ticketNumber}. Our support team will review and respond promptly.`,
      event: "Helpline Ticket Registered" as any,
      applicationId: applicationReference || undefined,
      registrationNumber: registrationNumber || undefined,
    });

    // Record system audit log
    await recordAuditLog({
      applicationReference: applicationReference || ticketNumber,
      vehicleReference: registrationNumber || undefined,
      userName: applicantName,
      userRole: "Applicant",
      action: "HELPLINE_TICKET_SUBMITTED",
      processIdentifier: "HELPLINE_SERVICE",
      newStatus: "Open",
      details: `New enquiry registered: [${ticketNumber}] ${subject} (${category}, Priority: ${priority}).`,
    });

    return NextResponse.json(ticket, { status: 201 });
  } catch (error) {
    console.error("Failed to create helpline ticket:", error);
    return NextResponse.json({ error: "Failed to submit enquiry" }, { status: 500 });
  }
}
