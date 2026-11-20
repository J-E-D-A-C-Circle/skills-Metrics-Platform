import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { INITIAL_INVOICES } from "@/lib/mock-data";

export async function GET() {
  try {
    const invoices = await db.invoice.findMany({
      orderBy: { createdAt: "desc" },
    });

    const merged = [...invoices];
    for (const demoInv of INITIAL_INVOICES) {
      const idx = merged.findIndex(
        (i: any) => i.invoiceNumber === demoInv.invoiceNumber || i.applicationId === demoInv.applicationId
      );
      if (idx >= 0) {
        merged[idx] = { ...merged[idx], paymentStatus: "Paid", invoiceNumber: demoInv.invoiceNumber };
      } else {
        merged.unshift(demoInv as any);
      }
    }

    return NextResponse.json(merged);
  } catch (error) {
    console.error("Failed to fetch invoices, using fallback demo invoices:", error);
    return NextResponse.json(INITIAL_INVOICES);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      invoiceNumber,
      applicationId,
      registrationNumber,
      chassisNumber,
      applicantName,
      amount,
      invoiceDate,
      layoffStartDate,
      layoffExpiryDate,
      paymentStatus = "Pending Payment",
      extensionStatus = "Eligible",
    } = body;

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        applicationId,
        registrationNumber,
        chassisNumber,
        applicantName,
        amount: Number(amount),
        invoiceDate,
        layoffStartDate,
        layoffExpiryDate,
        paymentStatus,
        extensionStatus,
      },
    });

    return NextResponse.json(invoice, { status: 201 });
  } catch (error) {
    console.error("Failed to create invoice:", error);
    return NextResponse.json({ error: "Failed to create invoice" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { invoiceNumber, paymentStatus, extensionStatus, layoffExpiryDate } = body;

    if (!invoiceNumber) {
      return NextResponse.json({ error: "invoiceNumber is required" }, { status: 400 });
    }

    const updated = await db.invoice.update({
      where: { invoiceNumber },
      data: {
        ...(paymentStatus && { paymentStatus }),
        ...(extensionStatus && { extensionStatus }),
        ...(layoffExpiryDate && { layoffExpiryDate }),
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to update invoice:", error);
    return NextResponse.json({ error: "Failed to update invoice" }, { status: 500 });
  }
}
