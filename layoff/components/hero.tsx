"use client";

import React, { useState } from "react";
import { Search, ShieldCheck, FileCheck2, Clock, RotateCcw, ArrowRight, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

interface HeroProps {
  onSearch: (query: string) => void;
  onNavigateApply: () => void;
  onNavigateTrack: () => void;
}

export function Hero({ onSearch, onNavigateApply, onNavigateTrack }: HeroProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery.trim());
      onNavigateTrack();
    }
  };

  return (
    <section className="bg-[#00522b] dark:bg-[#002c17] text-white py-12 lg:py-16 px-4 sm:px-6 border-b-4 border-[#facc15] dark:border-yellow-500 transition-colors duration-150">
      <div className="container mx-auto max-w-6xl">
        <div className="grid lg:grid-cols-12 gap-8 items-center">
          
          {/* Left Column */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-[#00381d] dark:bg-[#001e10] border border-emerald-600 dark:border-emerald-700 text-yellow-300 text-xs font-semibold">
              <ShieldCheck className="h-4 w-4 text-[#facc15]" />
              Official Portal of the Driver & Vehicle Licensing Authority
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight leading-tight text-white">
              Vehicle Layoff & Invoicing Portal
            </h1>

            <p className="text-emerald-100 text-sm sm:text-base max-w-2xl leading-relaxed">
              Register off-road vehicle layoffs, track verification progress, inspect official invoices, and verify identity via SMS OTP to request layoff period extensions.
            </p>

            {/* Quick Hero Search Box */}
            <form
              onSubmit={handleSearchSubmit}
              className="p-2 bg-white dark:bg-zinc-900 rounded-xl shadow-md flex flex-col sm:flex-row gap-2 border border-slate-200 dark:border-zinc-800 transition-colors"
            >
              <div className="relative flex-1 flex items-center">
                <Search className="absolute left-3.5 text-slate-400 dark:text-zinc-500 h-5 w-5" />
                <Input
                  type="text"
                  placeholder="Enter Invoice No (e.g. INV-DVLA-88109) or Registration No..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-11 border-0 bg-transparent text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500 text-sm focus-visible:ring-0 focus-visible:ring-offset-0 font-medium"
                />
              </div>
              <Button
                type="submit"
                size="lg"
                className="bg-[#006837] dark:bg-emerald-600 text-white hover:bg-[#004d28] dark:hover:bg-emerald-500 h-11 px-6 rounded-lg font-bold flex items-center justify-center gap-2 shrink-0 border-0"
              >
                <Search className="h-4 w-4 text-[#facc15]" />
                Track Status
              </Button>
            </form>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button
                onClick={onNavigateApply}
                size="lg"
                className="bg-[#facc15] text-amber-950 hover:bg-[#eab308] font-bold h-11 px-6 rounded-lg border border-yellow-400 flex items-center gap-2"
              >
                Submit Layoff Request
                <ArrowRight className="h-4 w-4" />
              </Button>

              <Button
                onClick={onNavigateTrack}
                variant="outline"
                size="lg"
                className="border-emerald-300 dark:border-emerald-700/70 text-white hover:bg-emerald-800/60 dark:hover:bg-emerald-950/60 font-semibold h-11 px-5 rounded-lg flex items-center gap-2 bg-transparent"
              >
                <Clock className="h-4 w-4 text-yellow-300" />
                Request Extension (OTP)
              </Button>
            </div>
          </div>

          {/* Right Column: Clean Civic Summary Card */}
          <div className="lg:col-span-5">
            <Card className="bg-white dark:bg-[#121212] p-6 shadow-md rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 space-y-4">
              <div className="border-b border-slate-200 dark:border-zinc-800 pb-3">
                <h3 className="font-bold text-slate-900 dark:text-zinc-100 text-base flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                  Statutory Verification Requirements
                </h3>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
                  Mandatory vehicle identification & off-road criteria
                </p>
              </div>

              <div className="space-y-3 text-xs font-medium">
                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">Key Vehicle Identifiers</span>
                    <p className="text-slate-600 dark:text-zinc-400 text-[11px] mt-0.5">Registration Number and Chassis VIN are required for all submissions.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <FileCheck2 className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">Documentary Evidence</span>
                    <p className="text-slate-600 dark:text-zinc-400 text-[11px] mt-0.5">Layoff reason, storage location, and supporting photographs must be attached.</p>
                  </div>
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
                  <RotateCcw className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-slate-900 dark:text-zinc-100">SMS OTP Verification</span>
                    <p className="text-slate-600 dark:text-zinc-400 text-[11px] mt-0.5">Identity is verified using registered phone numbers prior to layout extensions.</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>

        </div>
      </div>
    </section>
  );
}

