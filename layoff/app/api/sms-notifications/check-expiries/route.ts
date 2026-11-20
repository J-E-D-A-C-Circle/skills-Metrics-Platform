import { NextResponse } from "next/server";
import { processExpiryReminders } from "@/lib/sms-service";

export async function POST() {
  try {
    const results = await processExpiryReminders();
    return NextResponse.json({
      success: true,
      processedCount: results.length,
      results,
    });
  } catch (error) {
    console.error("Expiry reminder check error:", error);
    return NextResponse.json({ error: "Failed to process expiry reminders" }, { status: 500 });
  }
}

export async function GET() {
  return POST();
}
