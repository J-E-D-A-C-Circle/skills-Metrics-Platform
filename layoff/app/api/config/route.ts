import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";
import { recordAuditLog } from "@/lib/audit-service";

export async function GET() {
  try {
    const configs = await db.systemConfig.findMany({
      orderBy: { configKey: "asc" },
    });
    return NextResponse.json(configs);
  } catch (error) {
    console.error("Failed to fetch system configs:", error);
    return NextResponse.json({ error: "Failed to fetch configurations" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = getSessionUserFromRequest(req);
    if (!session || session.role !== "ADMINISTRATOR") {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
    }

    const body = await req.json();
    const { configKey, configValue, description } = body;

    if (!configKey || configValue === undefined) {
      return NextResponse.json(
        { error: "Configuration key and value are required." },
        { status: 400 }
      );
    }

    const existing = await db.systemConfig.findUnique({
      where: { configKey },
    });

    const updated = await db.systemConfig.upsert({
      where: { configKey },
      update: {
        configValue: String(configValue),
        description: description || undefined,
        updatedBy: session.fullName,
      },
      create: {
        configKey,
        configValue: String(configValue),
        description: description || null,
        updatedBy: session.fullName,
      },
    });

    await recordAuditLog({
      applicationReference: configKey,
      userName: session.fullName,
      userRole: "DVLA Administrator",
      action: "SYSTEM_CONFIG_UPDATED",
      processIdentifier: "SYSTEM_SETTINGS",
      previousStatus: existing ? existing.configValue : null,
      newStatus: String(configValue),
      details: `Administrator ${session.fullName} updated system setting ${configKey} to '${configValue}'.`,
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update config:", error);
    return NextResponse.json({ error: "Failed to save configuration" }, { status: 500 });
  }
}
