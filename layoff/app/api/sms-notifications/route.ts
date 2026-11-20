import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const notifications = await db.sMSNotification.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(notifications);
  } catch (error) {
    console.error("Failed to fetch SMS notifications:", error);
    return NextResponse.json({ error: "Failed to fetch SMS notifications" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, recipientPhone, message, event, sentAt, status } = body;

    const notification = await db.sMSNotification.create({
      data: {
        id: id || `SMS-${Math.floor(100 + Math.random() * 900)}`,
        recipientPhone,
        message,
        event,
        sentAt: sentAt || new Date().toISOString().replace("T", " ").slice(0, 16),
        status: status || "Delivered",
      },
    });

    return NextResponse.json(notification, { status: 201 });
  } catch (error) {
    console.error("Failed to create SMS notification:", error);
    return NextResponse.json({ error: "Failed to create SMS notification" }, { status: 500 });
  }
}
