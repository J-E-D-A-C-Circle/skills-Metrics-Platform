import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    const whereClause: any = { applicationId: id };
    if (category && category !== "ALL") {
      whereClause.category = category;
    }

    const activities = await db.applicationActivity.findMany({
      where: whereClause,
      orderBy: { timestamp: "desc" },
    });

    return NextResponse.json(activities);
  } catch (error) {
    console.error("Failed to fetch application activities:", error);
    return NextResponse.json(
      { error: "Failed to fetch activities" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = getSessionUserFromRequest(req);
    const body = await req.json();

    const { category, action, description, previousValue, newValue, referenceNumber, metadata } = body;

    const actorName = session ? session.fullName : body.actorName || "DVLA Staff";
    const actorRole = session ? session.role : body.actorRole || "DVLA Administrator";
    const source = session
      ? session.role === "ADMINISTRATOR"
        ? "ADMINISTRATOR"
        : "TECHNICAL_OFFICER"
      : body.source || "SYSTEM_AUTOMATION";

    const activity = await db.applicationActivity.create({
      data: {
        applicationId: id,
        category: category || "ADMINISTRATIVE",
        action: action || "MANUAL_REMARK_ADDED",
        description,
        actorName,
        actorRole,
        source,
        previousValue: previousValue || null,
        newValue: newValue || null,
        referenceNumber: referenceNumber || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    return NextResponse.json(activity);
  } catch (error) {
    console.error("Failed to append manual application activity:", error);
    return NextResponse.json(
      { error: "Failed to append activity" },
      { status: 500 }
    );
  }
}
