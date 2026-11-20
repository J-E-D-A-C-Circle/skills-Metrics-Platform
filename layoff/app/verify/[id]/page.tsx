"use client";

import React, { use } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck, User, Calendar, Car, Palette, CheckCircle2, ArrowLeft } from "lucide-react";
import { INITIAL_APPLICATIONS, formatLayoffReferenceId } from "@/lib/mock-data";

export default function VerifyCertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const decodedId = decodeURIComponent(id || "");

  // Match against demo applications if available, or fall back to URL query parameters
  const matchedApp = INITIAL_APPLICATIONS.find(
    (a) =>
      a.id.toLowerCase() === decodedId.toLowerCase() ||
      formatLayoffReferenceId(a.registrationNumber, a.submittedAt).toLowerCase() ===
        decodedId.toLowerCase() ||
      a.registrationNumber.toLowerCase() === decodedId.toLowerCase()
  );

  const ownerName =
    searchParams.get("owner") ||
    matchedApp?.ownerName ||
    matchedApp?.applicantName ||
    "Verified Vehicle Owner";

  const startPeriod =
    searchParams.get("start") ||
    matchedApp?.layoffStartDate ||
    matchedApp?.proposedStartDate ||
    "2026-09-01";

  const endPeriod =
    searchParams.get("end") ||
    matchedApp?.layoffExpiryDate ||
    "2027-03-01";

  const vehicleMake =
    searchParams.get("make") ||
    (matchedApp ? `${matchedApp.make} ${matchedApp.model}`.trim() : "Verified Motor Vehicle");

  const vehicleColor =
    searchParams.get("color") ||
    matchedApp?.colour ||
    "Standard";

  const vehicleReg =
    searchParams.get("reg") ||
    matchedApp?.registrationNumber ||
    decodedId.replace(/^LAY-\d{4}-/i, "");

  return (
    <div className="min-h-screen bg-[#f4f7f5] dark:bg-[#090d0b] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-lg rounded-3xl border-2 border-[#006837] bg-white dark:bg-[#111613] shadow-2xl overflow-hidden">
        {/* Top Official DVLA Verification Header */}
        <div className="bg-gradient-to-r from-[#006837] via-[#00552d] to-[#003d20] p-6 text-white text-center space-y-2 border-b-2 border-[#D4AF37]">
          <div className="mx-auto h-14 w-14 rounded-2xl bg-white p-1.5 shadow-md flex items-center justify-center">
            <div className="relative h-full w-full">
              <Image src="/oop.png" alt="DVLA Logo" fill className="object-contain" priority />
            </div>
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-[#D4AF37] font-black">
            REPUBLIC OF GHANA &bull; DVLA QR AUTHENTICATION
          </p>
          <h1 className="text-lg sm:text-xl font-black tracking-tight">
            Vehicle Lay-Off Certificate Verification
          </h1>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-200 text-xs font-bold">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
            <span>Authentic Statutory Layoff Record ({decodedId})</span>
          </div>
        </div>

        {/* 4 Core QR Verification Particulars */}
        <div className="p-6 space-y-4">
          {/* 1. Vehicle Owner Name */}
          <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-[#006837] dark:text-emerald-400 flex items-center justify-center shrink-0">
              <User className="h-5 w-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                1. Vehicle Owner (Applicant)
              </span>
              <p className="text-base font-black text-slate-900 dark:text-zinc-100 mt-0.5">
                {ownerName}
              </p>
            </div>
          </div>

          {/* 2. Layoff Start & End Period */}
          <div className="p-4 rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-start gap-3.5">
            <div className="h-10 w-10 rounded-xl bg-[#006837] text-white flex items-center justify-center shrink-0">
              <Calendar className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#006837] dark:text-emerald-400 block">
                2. Authorized Layoff Start &amp; End Period
              </span>
              <div className="grid grid-cols-2 gap-3 mt-1.5">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-500 block">
                    Start Date
                  </span>
                  <span className="font-mono text-sm font-black text-slate-900 dark:text-zinc-100">
                    {startPeriod}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-rose-500 block">
                    End / Expiry Date
                  </span>
                  <span className="font-mono text-sm font-black text-rose-600 dark:text-rose-400">
                    {endPeriod}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 3. Vehicle Make & 4. Vehicle Color */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Car className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  3. Vehicle Make
                </span>
                <p className="text-sm font-black text-slate-900 dark:text-zinc-100 mt-0.5">
                  {vehicleMake}
                </p>
                {vehicleReg && (
                  <span className="inline-block mt-1 px-2 py-0.5 rounded bg-slate-200/80 dark:bg-zinc-800 font-mono text-[10px] font-bold text-slate-700 dark:text-zinc-300">
                    Reg: {vehicleReg}
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-start gap-3">
              <div className="h-9 w-9 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-400 flex items-center justify-center shrink-0">
                <Palette className="h-4 w-4" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  4. Vehicle Color
                </span>
                <p className="text-sm font-black text-slate-900 dark:text-zinc-100 mt-0.5">
                  {vehicleColor}
                </p>
              </div>
            </div>
          </div>

          {/* Footer Attestation */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1.5 font-medium">
              <ShieldCheck className="h-4 w-4 text-[#006837]" />
              Verified against DVLA National Layoff Registry
            </span>
            <Link
              href="/"
              className="inline-flex items-center gap-1 font-bold text-[#006837] dark:text-emerald-400 hover:underline"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Portal
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

