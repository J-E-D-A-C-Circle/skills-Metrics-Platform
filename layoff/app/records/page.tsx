import React, { Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShieldCheck, Scale, ArrowLeft, FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { RecordsDossierView } from "@/components/records-dossier-view";

interface RecordsPageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function RecordsPage({ searchParams }: RecordsPageProps) {
  const { q } = await searchParams;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 flex flex-col justify-between font-sans selection:bg-emerald-600 selection:text-white">
      {/* Top Banner */}
      <div className="no-print bg-[#004d28] dark:bg-[#00361c] px-4 py-2 border-b border-[#003b1e]">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-[11px] text-emerald-200">
          <span className="font-semibold tracking-wide">
            REPUBLIC OF GHANA &bull; DRIVER AND VEHICLE LICENSING AUTHORITY
          </span>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-white transition-colors underline underline-offset-2">
              Citizen Application Portal
            </Link>
            <Link href="/tracking" className="hover:text-white transition-colors underline underline-offset-2">
              Status Tracking
            </Link>
            <Link href="/login" className="hover:text-white transition-colors underline underline-offset-2">
              Official Portal &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 space-y-8">
        {/* Navigation Breadcrumb */}
        <div className="no-print flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-[#006837] dark:hover:text-emerald-400 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Main Portal</span>
          </Link>

          <Badge variant="outline" className="text-xs uppercase font-mono tracking-wider border-emerald-600/30 text-[#006837] dark:text-emerald-400">
            L.I. 2519 Regulation 28 Evidential Registry
          </Badge>
        </div>

        {/* Page Hero Header */}
        <div className="no-print space-y-2 border-b border-slate-200 dark:border-zinc-800 pb-6">
          <div className="flex items-center gap-2 text-[#006837] dark:text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Scale className="h-4 w-4" />
            <span>Official Registry Records &amp; Court Evidential Extract Hub</span>
          </div>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Citizen Layoff History &amp; Evidential Dossier
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-zinc-400 max-w-3xl leading-relaxed">
            Search and generate a complete, court-admissible evidential docket of all statutory vehicle layoff applications, technical inspection results, and certificate validity history registered to an individual.
          </p>
        </div>

        {/* Dossier Search & Content */}
        <Suspense fallback={<div className="py-20 text-center text-xs text-slate-400">Loading Layoff Registry Dossier...</div>}>
          <RecordsDossierView initialQuery={q || ""} />
        </Suspense>
      </main>

      {/* Footer */}
      <footer className="no-print border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] py-6 px-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-zinc-400 text-center sm:text-left">
          <p>
            &copy; {new Date().getFullYear()} Driver and Vehicle Licensing Authority (DVLA), Ghana. Certified Statutory Records Hub under L.I. 2519.
          </p>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Evidence Act, 1975 (N.R.C.D. 323) Section 51</span>
            <span>&bull;</span>
            <span>Regulation 28</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
