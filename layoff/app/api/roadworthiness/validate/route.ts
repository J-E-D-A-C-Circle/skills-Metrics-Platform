import { NextRequest, NextResponse } from "next/server";
import { validateRoadworthinessEligibility } from "@/lib/roadworthiness";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { expiryDate, applicationDate, classification } = body;

    if (!expiryDate || !applicationDate || !classification) {
      return NextResponse.json(
        { isValid: false, reason: "expiryDate, applicationDate, and classification are required fields." },
        { status: 400 }
      );
    }

    if (classification !== "Private" && classification !== "Commercial") {
      return NextResponse.json(
        { isValid: false, reason: "classification must be either 'Private' or 'Commercial'." },
        { status: 400 }
      );
    }

    const result = validateRoadworthinessEligibility(expiryDate, applicationDate, classification);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Roadworthiness validation error:", error);
    return NextResponse.json(
      { isValid: false, reason: "Internal server error during roadworthiness validation." },
      { status: 500 }
    );
  }
}
