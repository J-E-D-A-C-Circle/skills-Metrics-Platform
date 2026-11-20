"use client";

import React, { useRef, useMemo, useState } from "react";
import Image from "next/image";
import {
  ShieldCheck, AlertTriangle, Printer, Download, QrCode, Lock,
  Calendar, CheckCircle2, Building2, User, Car, FileText, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { generateQrMatrix } from "@/lib/qr-code";

export interface StatutoryCertificateProps {
  application: {
    id: string;
    applicantName: string;
    applicantPhone?: string;
    applicantEmail?: string;
    idNumber?: string;
    ownerName?: string;
    ownerIdNumber?: string;
    applicantType?: string;
    
    // Vehicle specs
    registrationNumber: string;
    chassisNumber: string;
    engineNumber?: string;
    make: string;
    model: string;
    yearOfMake?: string;
    vehicleType: string;
    colour?: string;
    vehicleUsageClassification?: string;

    // Layoff particulars
    storageFacilityName?: string;
    storageRegion?: string;
    layoffStartDate?: string;
    layoffExpiryDate?: string;
    layoffPeriodMonths?: number;
    submittedAt?: string;

    // Statuses
    vehicleRoadStatus?: string;
    status?: string;
    applicationStatus?: string;
    adminApprovalStatus?: string;
    adminApprovedBy?: string;
    adminApprovedAt?: string;
    paymentStatus?: string;
    invoiceNumber?: string;
    paymentReference?: string;
    paymentConfirmedAt?: string;

    // Inspection
    inspectionOutcome?: string;
    inspectionDate?: string;
    assignedOfficerName?: string;
  };
  onClose?: () => void;
  showPrintAction?: boolean;
}

export function StatutoryCertificate({
  application,
  onClose,
  showPrintAction = true,
}: StatutoryCertificateProps) {
  const printRef = useRef<HTMLDivElement>(null);

  // Strict Gatekeeping Check: Must be Approved by Admin AND Paid via IPP Pro
  const isApproved = application.adminApprovalStatus === "Approved";
  const isPaid = application.paymentStatus === "Paid";
  const isCertificateValid = isApproved && isPaid;

  const certificateSerial = `DVLA-VLC-2026-${application.id.replace(/\W/g, "").toUpperCase()}`;
  const effectiveStart = application.layoffStartDate || application.submittedAt?.slice(0, 10) || new Date().toISOString().split("T")[0];
  const effectiveExpiry = application.layoffExpiryDate || "Not Specified";
  const ownerDisplayName = application.ownerName || application.applicantName;
  const ownerIdDisplay = application.ownerIdNumber || application.idNumber || "GHA-XXXXXXXXX-X";
  const vehicleColourDisplay = application.colour || "Standard";
  const [showQrPreview, setShowQrPreview] = useState(false);

  const verifyUrl = useMemo(() => {
    const params = new URLSearchParams({
      owner: ownerDisplayName,
      start: effectiveStart,
      end: effectiveExpiry,
      make: `${application.make} ${application.model}`.trim(),
      color: vehicleColourDisplay,
      reg: application.registrationNumber,
    });
    return `/verify/${encodeURIComponent(application.id)}?${params.toString()}`;
  }, [
    application.id,
    ownerDisplayName,
    effectiveStart,
    effectiveExpiry,
    application.make,
    application.model,
    vehicleColourDisplay,
    application.registrationNumber,
  ]);

  // Scannable QR Code Payload: Owner Name, Layoff Start & End Period, Vehicle Make & Color
  const qrPayload = useMemo(() => {
    return [
      `Owner: ${ownerDisplayName}`,
      `Layoff Period: ${effectiveStart} to ${effectiveExpiry}`,
      `Vehicle Make: ${application.make} ${application.model}`.trim(),
      `Vehicle Color: ${vehicleColourDisplay}`,
    ].join("\n");
  }, [ownerDisplayName, effectiveStart, effectiveExpiry, application.make, application.model, vehicleColourDisplay]);

  const qrMatrix = useMemo(() => generateQrMatrix(qrPayload), [qrPayload]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      {/* ─── CASE A: CERTIFICATE WITHHELD / PENDING REQUIREMENTS ─── */}
      {!isCertificateValid ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-300 dark:border-amber-700 bg-amber-50/70 dark:bg-amber-950/30 p-6 sm:p-10 text-center space-y-4 text-slate-800 dark:text-zinc-200">
          <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-100 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-700 flex items-center justify-center">
            <Lock className="h-8 w-8 text-amber-700 dark:text-amber-400" />
          </div>

          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-base sm:text-lg font-black text-amber-900 dark:text-amber-200 uppercase tracking-tight">
              Statutory Layoff Certificate Withheld
            </h3>
            <p className="text-xs sm:text-sm text-amber-800 dark:text-amber-300 leading-relaxed">
              Pursuant to <strong>Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28</strong>, an official Vehicle Lay-Off Certificate is generated and legally effective <strong>only after</strong> formal administrative approval and statutory fee settlement.
            </p>
          </div>

          {/* Checklist */}
          <div className="max-w-md mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 text-left pt-2">
            <div className={cn(
              "p-3 rounded-xl border text-xs space-y-1",
              isApproved
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
                : "bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-800 text-slate-700 dark:text-zinc-300"
            )}>
              <div className="flex items-center gap-1.5 font-bold">
                {isApproved ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <span>1. Administrative Review</span>
              </div>
              <p className="text-[11px] opacity-80">
                Status: <strong>{application.adminApprovalStatus || "Pending Approval"}</strong>
              </p>
            </div>

            <div className={cn(
              "p-3 rounded-xl border text-xs space-y-1",
              isPaid
                ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
                : "bg-white dark:bg-zinc-900 border-amber-200 dark:border-amber-800 text-slate-700 dark:text-zinc-300"
            )}>
              <div className="flex items-center gap-1.5 font-bold">
                {isPaid ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <AlertTriangle className="h-4 w-4 text-amber-600" />}
                <span>2. IPP Pro Fee Settlement</span>
              </div>
              <p className="text-[11px] opacity-80">
                Status: <strong>{application.paymentStatus || "Pending Payment"}</strong>
              </p>
            </div>
          </div>

          {onClose && (
            <div className="pt-2">
              <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl px-6">
                Return
              </Button>
            </div>
          )}
        </div>
      ) : (
        /* ─── CASE B: WORTHY NATIONAL VEHICLE LAY-OFF CERTIFICATE ─── */
        <div className="space-y-4">
          {/* Print Container with Vector Guilloché Aesthetic */}
          <div
            ref={printRef}
            id="printable-national-certificate"
            className="certificate-print-area relative bg-[#FCFDFB] dark:bg-[#0c140f] text-slate-900 dark:text-zinc-100 p-4 sm:p-10 rounded-2xl border-4 sm:border-8 border-[#006837] dark:border-emerald-700 shadow-2xl overflow-hidden font-serif"
            style={{
              backgroundImage: "radial-gradient(#006837 0.75px, transparent 0.75px), radial-gradient(#d4af37 0.75px, #FCFDFB 0.75px)",
              backgroundSize: "30px 30px",
              backgroundPosition: "0 0, 15px 15px",
            }}
          >
            {/* Guilloché Metallic Gold Inner Frame */}
            <div className="border-2 border-[#D4AF37] dark:border-amber-500/80 p-3 sm:p-6 rounded-xl relative">
              {/* Corner Ornaments */}
              <div className="absolute top-1 left-1 w-6 h-6 border-t-2 border-l-2 border-[#D4AF37]" />
              <div className="absolute top-1 right-1 w-6 h-6 border-t-2 border-r-2 border-[#D4AF37]" />
              <div className="absolute bottom-1 left-1 w-6 h-6 border-b-2 border-l-2 border-[#D4AF37]" />
              <div className="absolute bottom-1 right-1 w-6 h-6 border-b-2 border-r-2 border-[#D4AF37]" />

              {/* Watermark Crest in Center Background */}
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.035] pointer-events-none select-none">
                <Image src="/oop.png" alt="DVLA Crest Watermark" width={480} height={480} className="object-contain grayscale" />
              </div>

              {/* Top Security Banner */}
              <div className="text-center pb-2 border-b border-[#006837]/30 dark:border-emerald-600/30 mb-4 sm:mb-6">
                <p className="text-[8px] sm:text-[9px] font-mono tracking-[0.25em] text-[#006837] dark:text-emerald-400 uppercase font-black">
                  DRIVER AND VEHICLE LICENSING AUTHORITY &bull; REPUBLIC OF GHANA &bull; STATUTORY REGISTER ENTRY
                </p>
              </div>

              {/* Header: Ghana National Emblem + DVLA Corporate Crest */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 sm:pb-6 border-b-2 border-[#D4AF37] relative z-10">
                {/* Ghana Coat of Arms Vector */}
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-full border-2 border-[#D4AF37] bg-white p-1 shadow-sm flex items-center justify-center shrink-0">
                    {/* Official Ghana Emblem Vector Heraldry */}
                    <svg viewBox="0 0 100 100" className="h-full w-full" aria-label="Coat of Arms of Ghana">
                      <circle cx="50" cy="50" r="48" fill="#FBF8EB" stroke="#D4AF37" strokeWidth="2" />
                      {/* Shield */}
                      <path d="M30 30 L70 30 L70 65 Q50 85 30 65 Z" fill="#006837" stroke="#D4AF37" strokeWidth="2" />
                      <path d="M32 32 L68 32 L68 63 Q50 80 32 63 Z" fill="#D4AF37" opacity="0.3" />
                      {/* Cross */}
                      <path d="M50 30 L50 78 M30 50 L70 50" stroke="#FEE12B" strokeWidth="4" />
                      {/* Black Star */}
                      <polygon points="50,12 53,22 64,22 55,28 58,38 50,32 42,38 45,28 36,22 47,22" fill="#000000" stroke="#FEE12B" strokeWidth="1" />
                      {/* Eagles on sides */}
                      <path d="M22 36 Q16 48 24 64 Q28 52 26 40 Z" fill="#D4AF37" />
                      <path d="M78 36 Q84 48 76 64 Q72 52 74 40 Z" fill="#D4AF37" />
                      {/* Freedom and Justice banner */}
                      <rect x="20" y="82" width="60" height="9" rx="2" fill="#CE1126" stroke="#D4AF37" strokeWidth="1" />
                      <text x="50" y="88" fontSize="4.5" fontWeight="bold" textAnchor="middle" fill="#FFFFFF" fontFamily="sans-serif">FREEDOM &amp; JUSTICE</text>
                    </svg>
                  </div>

                  <div>
                    <h1 className="text-sm sm:text-xl font-black text-slate-900 dark:text-zinc-100 tracking-wider uppercase font-sans">
                      Republic of Ghana
                    </h1>
                    <h2 className="text-xs sm:text-base font-bold text-[#006837] dark:text-emerald-400 font-sans tracking-tight">
                      Driver and Vehicle Licensing Authority
                    </h2>
                    <p className="text-[10px] text-slate-500 dark:text-zinc-400 font-sans">
                      Vehicle Inspection &amp; Registration Directorate &bull; National Layoff Registry
                    </p>
                  </div>
                </div>

                {/* DVLA Crest + Serial Box */}
                <div className="flex sm:flex-col items-center sm:items-end justify-between w-full sm:w-auto gap-2 text-right">
                  <div className="relative h-12 w-28 sm:h-14 sm:w-32 shrink-0">
                    <Image src="/oop.png" alt="DVLA Logo" fill className="object-contain" priority />
                  </div>
                  <div className="bg-[#004d28] text-white px-3 py-1 rounded-md text-[11px] font-mono font-bold tracking-wider shadow-inner">
                    {certificateSerial}
                  </div>
                </div>
              </div>

              {/* Title Block */}
              <div className="text-center py-4 sm:py-6 space-y-1">
                <p className="text-[10px] sm:text-xs font-mono uppercase tracking-[0.2em] text-[#D4AF37] font-black">
                  OFFICIAL STATUTORY DOCUMENT
                </p>
                <h3 className="text-xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wide font-sans">
                  Vehicle Lay-Off Certificate
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-300 max-w-2xl mx-auto italic">
                  Issued pursuant to Section 46 of the Road Traffic Act and <strong>Regulation 28 of the Road Traffic Regulations, 2026 (L.I. 2519)</strong>.
                </p>
              </div>

              {/* Prominent Vehicle License Plate Styling */}
              <div className="flex justify-center my-2">
                <div className="inline-flex items-center rounded-lg border-2 border-slate-900 bg-white px-4 sm:px-6 py-1.5 shadow-md font-sans">
                  <div className="mr-3 flex flex-col items-center justify-center border-r border-slate-300 pr-2.5">
                    <div className="h-3 w-4 bg-gradient-to-b from-[#CE1126] via-[#FCD116] to-[#006B3F] rounded-xs relative">
                      <div className="absolute inset-0 flex items-center justify-center text-[5px] text-black font-black">&bull;</div>
                    </div>
                    <span className="text-[9px] font-black tracking-tight text-slate-800">GH</span>
                  </div>
                  <span className="font-mono text-xl sm:text-3xl font-black tracking-widest text-slate-900">
                    {application.registrationNumber}
                  </span>
                </div>
              </div>

              {/* Particulars Grid: Vehicle, Holder, Storage, Validity */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-4 text-xs font-sans">
                {/* Column 1: Vehicle & Classification */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5 sm:p-4 space-y-2.5 shadow-xs">
                  <div className="border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#006837] dark:text-emerald-400 block">
                      1. Motor Vehicle Specifications
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Make &amp; Model</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{application.make} {application.model}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Year of Make</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{application.yearOfMake || "—"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Body / Type</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{application.vehicleType}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Color</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100">{application.colour || "Standard"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Chassis (VIN) Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-zinc-100 break-all">{application.chassisNumber}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Engine Number</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-zinc-100">{application.engineNumber || "Surrendered for Verification"}</span>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[10px] text-slate-400 block">Usage Classification</span>
                      <span className="inline-block px-2 py-0.5 rounded font-black text-[10px] bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-zinc-200 uppercase">
                        {application.vehicleUsageClassification || "Private"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Column 2: Legal Holder & Storage Grounding */}
                <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 p-3.5 sm:p-4 space-y-2.5 shadow-xs">
                  <div className="border-b border-slate-100 dark:border-zinc-800 pb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-[#006837] dark:text-emerald-400 block">
                      2. Certificate Holder &amp; Storage Compound
                    </span>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Registered Certificate Holder</span>
                      <span className="font-bold text-slate-900 dark:text-zinc-100 text-sm">{ownerDisplayName}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">National Identity (Ghana Card PIN)</span>
                      <span className="font-mono font-bold text-[#006837] dark:text-emerald-400">{ownerIdDisplay}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Designated Storage Facility</span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-100">{application.storageFacilityName || "Declared Storage Facility"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Storage Region &amp; Administrative Area</span>
                      <span className="font-semibold text-slate-900 dark:text-zinc-100">{application.storageRegion || "Greater Accra"}</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">IPP Pro Statutory Invoice Number</span>
                      <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">{application.invoiceNumber || "SETTLED"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Validity Highlight Strip */}
              <div className="mt-4 rounded-xl border-2 border-[#006837] dark:border-emerald-600 bg-emerald-50/70 dark:bg-emerald-950/40 p-3.5 sm:p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left font-sans">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block">
                    Statutory Off-Road Layoff Period
                  </span>
                  <p className="text-xs text-slate-700 dark:text-zinc-300">
                    Authorized duration: <strong>{application.layoffPeriodMonths || 3} Calendar Months</strong>
                  </p>
                </div>
                <div className="flex items-center gap-6">
                  <div>
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Effective Date</span>
                    <span className="font-mono font-bold text-sm text-slate-900 dark:text-zinc-100">{effectiveStart}</span>
                  </div>
                  <div className="text-xl font-light text-slate-400">&rarr;</div>
                  <div>
                    <span className="text-[9px] font-bold uppercase text-rose-500 block">Statutory Expiry</span>
                    <span className="font-mono font-black text-sm text-rose-700 dark:text-rose-400">{effectiveExpiry}</span>
                  </div>
                </div>
              </div>

              {/* Statutory Prohibition Notice Box (L.I. 2519 Reg 28(3)) */}
              <div className="mt-4 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 p-3 sm:p-3.5 text-center sm:text-left font-sans">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
                  <div className="space-y-0.5 text-[11px] leading-relaxed text-red-950 dark:text-red-200">
                    <p className="font-bold uppercase tracking-wider text-red-800 dark:text-red-300 text-[10px]">
                      Mandatory Undertaking &bull; Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28(3)
                    </p>
                    <p>
                      <strong>PROHIBITION:</strong> The motor vehicle specified herein is statutorily grounded and shall not be operated, driven, or parked on any public road during the validity of this certificate.
                      Any physical road use constitutes an offence under <strong>L.I. 2519 Reg 28(3) and Regulation 243</strong>, punishable by immediate vehicle impoundment and full retroactive road licensing liability.
                    </p>
                  </div>
                </div>
              </div>

              {/* Bottom Attestation: Signatures, Seal, QR Code */}
              <div className="mt-6 pt-4 border-t-2 border-[#D4AF37] flex flex-col sm:flex-row items-center justify-between gap-6 font-sans">
                {/* QR Code & Digital Verification */}
                <div className="flex flex-col items-start gap-2">
                  <div className="flex items-center gap-3">
                    <a
                      href={verifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Hover or click to test QR Code Verification locally"
                      className="group relative p-2 rounded-lg bg-white border-2 border-[#006837]/30 shadow-sm hover:border-[#006837] transition-colors shrink-0 cursor-pointer block"
                    >
                      <svg
                        viewBox={`-4 -4 ${qrMatrix.length + 8} ${qrMatrix.length + 8}`}
                        className="h-24 w-24 sm:h-28 sm:w-28"
                        shapeRendering="crispEdges"
                        aria-label="Scannable DVLA Layoff Certificate QR Code"
                      >
                        <rect
                          x={-4}
                          y={-4}
                          width={qrMatrix.length + 8}
                          height={qrMatrix.length + 8}
                          fill="#FFFFFF"
                        />
                        {qrMatrix.map((row, rIdx) =>
                          row.map((isDark, cIdx) =>
                            isDark ? (
                              <rect
                                key={`${rIdx}-${cIdx}`}
                                x={cIdx}
                                y={rIdx}
                                width={1}
                                height={1}
                                fill="#000000"
                              />
                            ) : null
                          )
                        )}
                      </svg>
                      <span className="no-print opacity-0 group-hover:opacity-100 transition-opacity absolute -bottom-6 left-0 whitespace-nowrap bg-slate-900 text-white text-[9px] font-mono px-2 py-0.5 rounded shadow-md z-20">
                        Open /verify/{application.id} &rarr;
                      </span>
                    </a>
                    <div className="text-left text-[10px] space-y-0.5">
                      <span className="font-black text-[#006837] dark:text-emerald-400 block uppercase tracking-wider">
                        DVLA Security QR Verification
                      </span>
                      <span className="text-slate-600 dark:text-zinc-300 block font-medium">
                        Scan or hover/click QR to verify Owner, Period, Make &amp; Color
                      </span>
                      <span className="font-mono text-[9px] text-slate-400 block">
                        Hash: {application.id.slice(-8)} &bull; L.I. 2519
                      </span>
                      <a
                        href={verifyUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="no-print text-[9px] font-bold text-[#006837] dark:text-emerald-400 underline hover:opacity-80 pt-0.5 block"
                      >
                        Open QR Verification Link (/verify/{application.id}) &rarr;
                      </a>
                    </div>
                  </div>

                  {showQrPreview && (
                    <div className="no-print rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/90 dark:bg-emerald-950/70 p-2.5 text-[10px] font-mono text-slate-800 dark:text-zinc-100 space-y-0.5 shadow-sm">
                      <p className="font-sans font-bold text-[9px] uppercase tracking-wider text-[#006837] dark:text-emerald-400 pb-0.5">
                        Encoded QR Scan Output:
                      </p>
                      <p><strong>Owner:</strong> {ownerDisplayName}</p>
                      <p><strong>Layoff Period:</strong> {effectiveStart} to {effectiveExpiry}</p>
                      <p><strong>Vehicle Make:</strong> {application.make} {application.model}</p>
                      <p><strong>Vehicle Color:</strong> {vehicleColourDisplay}</p>
                    </div>
                  )}
                </div>

                {/* Embossed Gold Foil Seal */}
                <div className="h-20 w-20 rounded-full border-2 border-[#D4AF37] bg-gradient-to-br from-[#FFF8DC] via-[#D4AF37] to-[#8B6508] p-1 shadow-md flex items-center justify-center shrink-0">
                  <div className="h-full w-full rounded-full border border-dashed border-white flex flex-col items-center justify-center text-center p-1">
                    <span className="text-[6px] font-black uppercase tracking-widest text-[#4A3800]">OFFICIAL SEAL</span>
                    <span className="text-[7px] font-black tracking-tight text-white uppercase leading-tight">DVLA GHANA</span>
                    <span className="text-[5px] text-[#4A3800] font-mono">REGISTRY 2026</span>
                  </div>
                </div>

                {/* Signatories */}
                <div className="flex items-center gap-6 text-center text-xs">
                  <div className="space-y-1">
                    <div className="h-8 border-b border-slate-400 dark:border-zinc-600 flex items-end justify-center pb-0.5">
                      <span className="font-serif italic text-sm text-[#004d28] dark:text-emerald-300 font-bold">Osei Tutu</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-700 dark:text-zinc-300 block uppercase">
                      Director, Vehicle Inspection
                    </span>
                    <span className="text-[8px] text-slate-400 block">DVLA 37 Operational Head Office</span>
                  </div>

                  <div className="space-y-1">
                    <div className="h-8 border-b border-slate-400 dark:border-zinc-600 flex items-end justify-center pb-0.5">
                      <span className="font-serif italic text-sm text-[#004d28] dark:text-emerald-300 font-bold">Julius N. Kotey</span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-700 dark:text-zinc-300 block uppercase tracking-tight">
                      Julius Neequaye Kotey
                    </span>
                    <span className="text-[8px] font-semibold text-slate-500 dark:text-zinc-400 block uppercase">
                      Chief Executive Officer
                    </span>
                    <span className="text-[8px] text-slate-400 block">Driver &amp; Vehicle Licensing Authority</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Action Strip (Hidden during window.print) */}
          {showPrintAction && (
            <div className="no-print flex flex-col-reverse sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-200 dark:border-zinc-800">
              <div className="text-xs text-slate-500 dark:text-zinc-400 flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-600" />
                <span>Statutorily approved and verified pursuant to L.I. 2519 Regulation 28.</span>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                {onClose && (
                  <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl flex-1 sm:flex-initial">
                    Close
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={handlePrint}
                  className="bg-[#006837] hover:bg-[#004d28] text-white font-bold rounded-xl gap-2 shadow-md shadow-emerald-900/20 flex-1 sm:flex-initial"
                >
                  <Printer className="h-4 w-4" />
                  Print / Save National Certificate (A4)
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
