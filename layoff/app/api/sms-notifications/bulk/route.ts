import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { sendSMSNotification } from "@/lib/sms-service";
import { recordAuditLog } from "@/lib/audit-service";
import { ensureDatabaseUsersPopulated } from "@/lib/seed-users";

export interface ResolvedRecipient {
  key: string;
  name: string;
  phone: string;
  registrationNumber: string;
  reference: string;
  expiryDate: string;
  region: string;
  subtitle: string;
}

async function resolveTargetRecipients(params: {
  audience: string;
  region?: string | null;
  status?: string | null;
}): Promise<ResolvedRecipient[]> {
  const { audience = "APPLICANTS", region = "ALL", status = "ALL" } = params;

  if (audience === "TECHNICAL_OFFICERS" || audience === "STAFF_ALL") {
    await ensureDatabaseUsersPopulated();

    const userWhere: any = {
      isActive: true,
    };

    if (audience === "TECHNICAL_OFFICERS") {
      userWhere.role = "TECHNICAL_OFFICER";
    } else {
      userWhere.role = { in: ["TECHNICAL_OFFICER", "COMPLIANCE_OFFICER", "ADMINISTRATOR"] };
    }

    if (region && region !== "ALL") {
      userWhere.region = region;
    }

    const staffList = await db.user.findMany({
      where: userWhere,
      orderBy: { fullName: "asc" },
    });

    return staffList
      .filter((u) => Boolean(u.phone && u.phone.trim()))
      .map((u) => ({
        key: `STAFF-${u.id}`,
        name: u.fullName.replace(/\s*\(.*?\)\s*/g, "").trim(),
        phone: u.phone.trim(),
        registrationNumber: u.staffId || u.id,
        reference: u.staffId || u.id,
        expiryDate: "N/A",
        region: u.region || "Greater Accra",
        subtitle: `${u.role.replace("_", " ")} • ${u.stationLocation || u.region || "DVLA"}`,
      }));
  }

  // Default: APPLICANTS
  const where: any = {
    applicantPhone: { not: "" },
  };

  if (region && region !== "ALL") {
    where.storageRegion = region;
  }

  if (status && status !== "ALL") {
    if (status === "ACTIVE") {
      where.vehicleRoadStatus = "Off Road";
    } else if (status === "PENDING") {
      where.adminApprovalStatus = "Pending";
    } else if (status === "APPROVED") {
      where.adminApprovalStatus = "Approved";
    } else if (status === "INSPECTION_PENDING") {
      where.inspectionStatus = { in: ["Pending Assignment", "In Progress", "Assigned"] };
    } else if (status !== "EXPIRING_SOON" && status !== "EXPIRED") {
      where.applicationStatus = status;
    }
  }

  const matchingApps = await db.application.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const filteredApps = matchingApps.filter((app) => {
    if (status === "EXPIRING_SOON") {
      if (!app.layoffExpiryDate) return false;
      const exp = new Date(`${app.layoffExpiryDate}T00:00:00Z`);
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= 30;
    }
    if (status === "EXPIRED") {
      if (!app.layoffExpiryDate) return false;
      const exp = new Date(`${app.layoffExpiryDate}T00:00:00Z`);
      return exp.getTime() < now.getTime();
    }
    return true;
  });

  return filteredApps.map((a) => ({
    key: `APP-${a.id}`,
    name: a.applicantName,
    phone: a.applicantPhone.trim(),
    registrationNumber: a.registrationNumber,
    reference: a.id,
    expiryDate: a.layoffExpiryDate || "N/A",
    region: a.storageRegion || "Greater Accra",
    subtitle: `${a.registrationNumber} (${a.id}) • ${a.vehicleRoadStatus || a.applicationStatus}`,
  }));
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || session.role !== "ADMINISTRATOR") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");

    // Action 1: Estimate & list recipients matching filter
    if (action === "estimate") {
      const audience = searchParams.get("audience") || "APPLICANTS";
      const region = searchParams.get("region") || "ALL";
      const status = searchParams.get("status") || "ALL";

      const recipients = await resolveTargetRecipients({ audience, region, status });
      const phoneSet = new Set<string>();
      recipients.forEach((r) => {
        if (r.phone) phoneSet.add(r.phone);
      });

      return NextResponse.json({
        totalCount: recipients.length,
        uniquePhoneNumbers: phoneSet.size,
        recipients,
        sampleRecipients: recipients.slice(0, 5),
      });
    }

    // Action 2: Get campaign history
    const campaigns = await db.bulkSMSCampaign.findMany({
      include: {
        createdBy: {
          select: { fullName: true, staffId: true, role: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(campaigns);
  } catch (error) {
    console.error("Failed to fetch bulk SMS data:", error);
    return NextResponse.json({ error: "Failed to load bulk SMS data" }, { status: 500 });
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
      title,
      message,
      audience = "APPLICANTS",
      region = "ALL",
      status = "ALL",
      selectedKeys,
      customNumbers,
      testPhone,
    } = body;

    if (!message || !String(message).trim()) {
      return NextResponse.json({ error: "SMS message content is required." }, { status: 400 });
    }

    // QUICK TEST SMS MODE: Send a single preview SMS without creating a full campaign
    if (testPhone && String(testPhone).trim()) {
      const sampleMessage = String(message)
        .replace(/\[NAME\]/g, "Kofi Mensah")
        .replace(/\[REGISTRATION\]/g, "GT-4920-22")
        .replace(/\[REFERENCE\]/g, "LAY-2026-GT492022")
        .replace(/\[EXPIRY_DATE\]/g, "2026-12-31")
        .replace(/\[REGION\]/g, region !== "ALL" ? region : "Greater Accra");

      const res = await sendSMSNotification({
        recipientPhone: String(testPhone).trim(),
        message: sampleMessage,
        event: "Bulk SMS Broadcast" as any,
      });

      return NextResponse.json({
        success: Boolean(res),
        isTest: true,
        message: `Test SMS sent to ${String(testPhone).trim()}.`,
      });
    }

    if (!title || !String(title).trim()) {
      return NextResponse.json(
        { error: "Campaign title and message are required." },
        { status: 400 }
      );
    }

    // Deduplication check: check if same title campaign sent in past 2 minutes
    const twoMinsAgo = new Date(Date.now() - 2 * 60 * 1000);
    const existingRecent = await db.bulkSMSCampaign.findFirst({
      where: {
        title: title.trim(),
        createdAt: { gte: twoMinsAgo },
      },
    });

    if (existingRecent) {
      return NextResponse.json(
        {
          error:
            "A bulk SMS campaign with this exact title was already dispatched in the last 2 minutes to prevent accidental double-sending.",
        },
        { status: 429 }
      );
    }

    // Resolve recipient list
    let recipients: Array<{
      key: string;
      name: string;
      phone: string;
      registrationNumber: string;
      reference: string;
      expiryDate: string;
      region: string;
    }> = [];

    if (audience === "CUSTOM") {
      const rawNumbers = String(customNumbers || "")
        .split(/[\n,;]+/)
        .map((n) => n.trim())
        .filter(Boolean);

      recipients = rawNumbers.map((phone, idx) => ({
        key: `CUSTOM-${idx}`,
        name: "Valued Recipient",
        phone,
        registrationNumber: "N/A",
        reference: "N/A",
        expiryDate: "N/A",
        region: region !== "ALL" ? region : "National",
      }));
    } else {
      const allMatched = await resolveTargetRecipients({ audience, region, status });
      if (Array.isArray(selectedKeys) && selectedKeys.length > 0) {
        const keySet = new Set(selectedKeys);
        recipients = allMatched.filter((r) => keySet.has(r.key));
      } else {
        recipients = allMatched;
      }
    }

    if (recipients.length === 0) {
      return NextResponse.json(
        { error: "No recipients selected or matched for this broadcast." },
        { status: 400 }
      );
    }

    // Create Campaign record
    const campaign = await db.bulkSMSCampaign.create({
      data: {
        title: title.trim(),
        message: message.trim(),
        createdById: session.userId,
        targetFilter: JSON.stringify({ audience, region, status }),
        totalRecipients: recipients.length,
        deliveredCount: 0,
        failedCount: 0,
        status: "Sending",
      },
    });

    // Dispatch messages
    let delivered = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const personalizedMsg = String(message)
        .replace(/\[NAME\]/g, recipient.name)
        .replace(/\[REGISTRATION\]/g, recipient.registrationNumber)
        .replace(/\[REFERENCE\]/g, recipient.reference)
        .replace(/\[EXPIRY_DATE\]/g, recipient.expiryDate)
        .replace(/\[REGION\]/g, recipient.region);

      const res = await sendSMSNotification({
        recipientPhone: recipient.phone,
        message: personalizedMsg,
        event: "Bulk SMS Broadcast" as any,
        applicationId: recipient.reference.startsWith("LAY-") ? recipient.reference : undefined,
        registrationNumber:
          recipient.registrationNumber !== "N/A" ? recipient.registrationNumber : undefined,
      });

      if (res) {
        delivered++;
      } else {
        failed++;
      }
    }

    const updatedCampaign = await db.bulkSMSCampaign.update({
      where: { id: campaign.id },
      data: {
        deliveredCount: delivered,
        failedCount: failed,
        status: "Completed",
      },
    });

    await recordAuditLog({
      applicationReference: campaign.id,
      userName: session.fullName,
      userRole: "DVLA Administrator",
      action: "BULK_SMS_CAMPAIGN_DISPATCHED",
      processIdentifier: "SMS_BROADCAST",
      newStatus: "Completed",
      details: `Dispatched campaign '${title}' to ${delivered} recipients (${failed} failed). Audience=${audience}, Region=${region}, Status=${status}.`,
    });

    return NextResponse.json(updatedCampaign);
  } catch (error) {
    console.error("Bulk SMS execution error:", error);
    return NextResponse.json({ error: "Failed to dispatch bulk SMS campaign" }, { status: 500 });
  }
}
