import { NextRequest, NextResponse } from "next/server";
import { retryIPPProSubmission } from "@/lib/ipp-pro-service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { applicationId } = body;

    if (!applicationId) {
      return NextResponse.json({ error: "applicationId is required." }, { status: 400 });
    }

    const result = await retryIPPProSubmission(applicationId);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 422 });
    }

    return NextResponse.json({
      success: true,
      message: "Application data successfully synchronized to IPP Pro.",
      submissionRef: result.submissionRef,
      submittedAt: result.submittedAt,
    });
  } catch (error) {
    console.error("IPP Pro submission retry error:", error);
    return NextResponse.json({ error: "Failed to submit data to IPP Pro." }, { status: 500 });
  }
}
