import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(logs);
  } catch (error) {
    console.error("Failed to fetch audit logs:", error);
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, timestamp, userRole, userName, action, referenceNumber, previousStatus, newStatus, details } = body;

    const log = await db.auditLog.create({
      data: {
        id: id || `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
        timestamp: timestamp || new Date().toISOString().replace("T", " ").slice(0, 19),
        userRole,
        userName,
        action,
        referenceNumber,
        previousStatus,
        newStatus,
        details,
      },
    });

    return NextResponse.json(log, { status: 201 });
  } catch (error) {
    console.error("Failed to create audit log:", error);
    return NextResponse.json({ error: "Failed to create audit log" }, { status: 500 });
  }
}
