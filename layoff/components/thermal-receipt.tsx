"use client";

import React, { useRef } from "react";
import Image from "next/image";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "@/components/qr-code";
import { Invoice, LayoffApplication } from "@/lib/mock-data";

interface ThermalReceiptProps {
  invoice: Invoice;
  application?: LayoffApplication | null;
  onClose?: () => void;
}

export function ThermalReceipt({ invoice, application, onClose }: ThermalReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  // Derive transaction code (e.g. 6939683 from ippProTransactionRef or hash)
  const transactionCode = React.useMemo(() => {
    if (invoice.ippProTransactionRef) {
      const digits = invoice.ippProTransactionRef.replace(/\D/g, "");
      if (digits.length >= 7) return digits.slice(-7);
      if (digits.length > 0) return digits.padEnd(7, "0");
    }
    // Fallback deterministic 7-digit code based on invoice number
    let hash = 0;
    for (let i = 0; i < invoice.invoiceNumber.length; i++) {
      hash = (hash * 31 + invoice.invoiceNumber.charCodeAt(i)) >>> 0;
    }
    return (1000000 + (hash % 9000000)).toString();
  }, [invoice.invoiceNumber, invoice.ippProTransactionRef]);

  // Derive receipt code
  const receiptCode = React.useMemo(() => {
    const raw = invoice.invoiceNumber.replace(/\D/g, "");
    return `201${raw.padEnd(11, "8").slice(0, 11)}`;
  }, [invoice.invoiceNumber]);

  // Format date & time nicely: e.g. "14 October 2026 04:48 pm"
  const formattedDateTime = React.useMemo(() => {
    try {
      const d = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
      if (isNaN(d.getTime())) return "14 October 2026 04:48 pm";
      const day = d.getDate();
      const month = d.toLocaleDateString("en-GB", { month: "long" });
      const year = d.getFullYear();
      return `${day} ${month} ${year} 04:48 pm`;
    } catch {
      return "14 October 2026 04:48 pm";
    }
  }, [invoice.invoiceDate]);

  // Line items breakdown
  const items = React.useMemo(() => {
    const total = invoice.amount;
    if (total === 150) {
      return [
        { name: "Statutory Off-Road Layoff Fee", qty: 1, amount: 150.00 }
      ];
    } else if (total === 250) {
      return [
        { name: "Statutory Off-Road Layoff Fee", qty: 1, amount: 150.00 },
        { name: "DVLA On-Site Inspection Charge", qty: 1, amount: 100.00 }
      ];
    } else if (total === 350) {
      return [
        { name: "Heavy/Commercial Layoff Fee", qty: 1, amount: 350.00 }
      ];
    } else if (total === 450) {
      return [
        { name: "Heavy/Commercial Layoff Fee", qty: 1, amount: 350.00 },
        { name: "DVLA On-Site Inspection Charge", qty: 1, amount: 100.00 }
      ];
    } else if (total > 150) {
      return [
        { name: "Statutory Vehicle Layoff Fee", qty: 1, amount: 150.00 },
        { name: "Inspection & Admin Charge", qty: 1, amount: total - 150.00 }
      ];
    }
    return [
      { name: "Statutory Layoff Application", qty: 1, amount: total }
    ];
  }, [invoice.amount]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="flex flex-col items-center font-poppins">
      {/* 80mm Standard Thermal Roll Display with Authentic Physical Look */}
      <div className="w-full flex justify-center py-2 overflow-x-auto bg-slate-100/80 dark:bg-zinc-950/70 rounded-xl p-3 sm:p-5">
        <div
          id="thermal-receipt-container"
          ref={receiptRef}
          style={{ width: "350px", maxWidth: "100%" }}
          className="relative bg-white text-neutral-900 font-poppins shadow-xl transition-all duration-200 border border-slate-300 print:border-none print:shadow-none print:m-0 print:p-0"
        >
          {/* Jagged Serrated Tear Edge (Top) */}
          <div className="h-2 w-full overflow-hidden bg-white print:hidden">
            <svg
              className="w-full h-2 text-slate-100/80 dark:text-zinc-950/70"
              viewBox="0 0 350 8"
              preserveAspectRatio="none"
              fill="currentColor"
            >
              <polygon points="
                0,0 10,8 20,0 30,8 40,0 50,8 60,0 70,8 80,0 90,8 100,0 110,8 120,0 130,8 140,0 150,8
                160,0 170,8 180,0 190,8 200,0 210,8 220,0 230,8 240,0 250,8 260,0 270,8 280,0 290,8
                300,0 310,8 320,0 330,8 340,0 350,8
              " />
            </svg>
          </div>

          {/* Receipt Content - Poppins Typography with Natural Weighting */}
          <div className="px-5 sm:px-6 py-4 space-y-3 leading-normal tracking-normal text-neutral-900 font-poppins">
            {/* Header: CUSTOMER COPY */}
            <div className="text-center font-medium tracking-wider text-[11px] sm:text-xs uppercase text-neutral-700 pt-1">
              CUSTOMER COPY
            </div>

            {/* DVLA Logo / Emblem - Full Color */}
            <div className="flex justify-center my-2">
              <div className="relative w-14 h-14 rounded-full overflow-hidden flex items-center justify-center p-0.5 bg-white">
                <Image
                  src="/oop.png"
                  alt="DVLA Ghana Crest"
                  width={52}
                  height={52}
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Title & Organization */}
            <div className="text-center space-y-0.5">
              <h2 className="text-base sm:text-lg font-bold tracking-wide uppercase text-black">
                INVOICE
              </h2>
              <p className="text-xs font-medium tracking-normal text-neutral-700">
                DVLA Ghana
              </p>
            </div>

            {/* Pay using *222# Box */}
            <div className="text-center my-3 py-1 space-y-0.5">
              <p className="text-xs font-normal text-neutral-800">
                Pay using *222# option 5
              </p>
              <p className="text-xs font-normal text-neutral-600">
                Transaction Code
              </p>
              <p className="text-base font-bold tracking-wider text-black">
                {transactionCode}
              </p>
            </div>

            {/* Invoice Meta */}
            <div className="space-y-1 text-left text-xs pt-1">
              <div className="flex justify-between items-baseline">
                <span className="font-normal text-neutral-600">Invoice:</span>
                <span className="font-medium text-black">{invoice.invoiceNumber}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal text-neutral-600">Date:</span>
                <span className="font-normal text-neutral-800">{formattedDateTime}</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal text-neutral-600">Service Class:</span>
                <span className="font-normal text-neutral-800">Premium HQ</span>
              </div>
              <div className="flex justify-between items-baseline">
                <span className="font-normal text-neutral-600">Receipt Code:</span>
                <span className="font-normal text-neutral-800">{receiptCode}</span>
              </div>
            </div>

            {/* Bill From */}
            <div className="pt-2 text-xs text-left leading-relaxed">
              <p className="font-semibold text-black">Bill From:</p>
              <p className="font-normal text-neutral-800">DVLA Ghana</p>
              <p className="font-normal text-neutral-800">DVLA Headquarters</p>
            </div>

            {/* Bill To */}
            <div className="pt-1.5 text-xs text-left leading-relaxed space-y-0.5">
              <p className="font-semibold text-black">Bill To:</p>
              <p className="font-semibold uppercase text-black">{invoice.applicantName || "SAMUEL YIADOM"}</p>
              <p className="font-normal text-neutral-800">
                Licence #: <span className="font-normal text-black">{application?.idNumber || (application as any)?.nationalId || invoice.chassisNumber || "SAM-20031990-87905"}</span>
              </p>
              <p className="font-normal text-neutral-800">
                Reg: <span className="font-normal text-black">{invoice.registrationNumber}</span>
              </p>
              <p className="font-normal text-neutral-800">
                Phone: <span className="font-normal text-black">{application?.applicantPhone || "+233247511367"}</span>
              </p>
            </div>

            {/* Items Table */}
            <div className="pt-2.5">
              <div className="flex justify-between text-[11px] sm:text-xs font-semibold uppercase border-b border-black/30 pb-1 text-neutral-800">
                <span className="w-7/12 text-left">ITEM</span>
                <span className="w-2/12 text-center">QTY</span>
                <span className="w-3/12 text-right">AMOUNT (GH¢)</span>
              </div>

              <div className="py-2 space-y-1.5 text-xs">
                {items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-start">
                    <span className="w-7/12 text-left pr-1 leading-snug font-normal text-neutral-900">
                      {it.name}
                    </span>
                    <span className="w-2/12 text-center font-normal text-neutral-700">{it.qty}</span>
                    <span className="w-3/12 text-right font-medium text-black">
                      {it.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Order Amount */}
              <div className="border-t border-black/30 pt-2 flex justify-between items-center text-xs sm:text-[13px]">
                <span className="font-semibold text-neutral-800">Order Amount (GH¢)</span>
                <span className="font-bold text-black tracking-tight">
                  {invoice.amount.toFixed(2)}
                </span>
              </div>
            </div>

            {/* QR Code Section */}
            <div className="pt-3.5 flex flex-col items-center justify-center space-y-1.5">
              <div className="p-1 bg-white border border-black/30">
                <QRCodeSVG
                  value={`https://dvla.gov.gh/verify-invoice?no=${invoice.invoiceNumber}&code=${transactionCode}`}
                  size={110}
                />
              </div>
              <p className="text-[11px] font-normal tracking-normal text-neutral-700">
                Scan to view invoice
              </p>
            </div>

            {/* Disclaimers & Footer */}
            <div className="pt-3 text-center space-y-1 text-[11px] font-normal text-neutral-600 leading-snug">
              <p>Invoice is valid for two(2) weeks</p>
              <p>
                The amount quoted on this invoice MAY<br />or MAY NOT change.
              </p>
              <p className="font-medium tracking-normal pt-0.5 text-neutral-800">www.dvla.gov.gh</p>
            </div>

            {/* Printed Timestamp */}
            <div className="pt-2.5 pb-1 text-center text-[10px] font-normal text-neutral-500">
              Printed: {formattedDateTime}
            </div>
          </div>

          {/* Jagged Serrated Tear Edge (Bottom) */}
          <div className="h-2 w-full overflow-hidden bg-white print:hidden">
            <svg
              className="w-full h-2 text-slate-100/80 dark:text-zinc-950/70"
              viewBox="0 0 350 8"
              preserveAspectRatio="none"
              fill="currentColor"
            >
              <polygon points="
                0,8 10,0 20,8 30,0 40,8 50,0 60,8 70,0 80,8 90,0 100,8 110,0 120,8 130,0 140,8 150,0
                160,8 170,0 180,8 190,0 200,8 210,0 220,8 230,0 240,8 250,0 260,8 270,0 280,8 290,0
                300,8 310,0 320,8 330,0 340,8 350,0
              " />
            </svg>
          </div>
        </div>
      </div>

      {/* Action Buttons Placed Down / At The Bottom */}
      <div className="w-full flex items-center justify-end gap-3 pt-4 mt-3 border-t border-slate-200 dark:border-zinc-800 print:hidden">
        {onClose && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            className="text-xs h-9 px-4 font-medium rounded-xl"
          >
            Close
          </Button>
        )}

        <Button
          type="button"
          size="sm"
          onClick={handlePrint}
          className="text-xs gap-2 h-9 px-5 font-bold bg-[#006837] hover:bg-[#00552d] text-white shadow-md rounded-xl"
        >
          <Printer className="h-4 w-4" />
          Print Thermal Receipt
        </Button>
      </div>
    </div>
  );
}
