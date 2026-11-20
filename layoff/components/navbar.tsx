"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { PlusCircle, Search, LifeBuoy, Shield, Menu, X, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import { SupportModal } from "@/components/support-modal";

interface NavbarProps {
  activeTab?: "apply" | "track";
  setActiveTab?: (tab: "apply" | "track") => void;
  showStaffLink?: boolean;
}

export function Navbar({
  activeTab = "apply",
  setActiveTab,
  showStaffLink = true,
}: NavbarProps) {
  const [isSupportOpen, setIsSupportOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-white dark:bg-[#09090b]/95 dark:backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shadow-xs transition-colors duration-150">
        {/* Government identity strip */}
        <div className="bg-[#004d28] dark:bg-[#00361c] px-3 py-1">
          <p className="text-[10px] sm:text-[11px] font-medium text-emerald-200 text-center tracking-wide line-clamp-1 sm:line-clamp-none">
            REPUBLIC OF GHANA — DRIVER AND VEHICLE LICENSING AUTHORITY (L.I. 2519 REGULATION 28)
          </p>
        </div>

        {/* Main nav bar */}
        <div className="flex items-center justify-between h-14 px-3 sm:px-6 lg:px-8 max-w-[1720px] mx-auto gap-2">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2 flex-shrink-0 group py-1">
            <div className="relative h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0">
              <Image
                src="/oop.png"
                alt="DVLA Ghana Logo"
                fill
                className="object-contain"
                priority
              />
            </div>
            <div className="leading-tight">
              <span className="block text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 tracking-tight">DVLA Ghana</span>
              <span className="block text-[9px] sm:text-[10px] text-[#006837] dark:text-emerald-400 font-semibold">Vehicle Layoff Portal</span>
            </div>
          </Link>

          {/* Center tabs — citizen applicant portal (desktop / tablet) */}
          <div className="hidden sm:flex items-center gap-0.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 p-0.5">
            <button
              onClick={() => setActiveTab?.("apply")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === "apply"
                  ? "bg-white dark:bg-zinc-800 text-[#006837] dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-zinc-700 font-bold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              <PlusCircle className={cn("h-3.5 w-3.5 flex-shrink-0", activeTab === "apply" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
              <span>Submit Layoff Application</span>
            </button>
            <button
              onClick={() => setActiveTab?.("track")}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                activeTab === "track"
                  ? "bg-white dark:bg-zinc-800 text-[#006837] dark:text-emerald-400 shadow-xs border border-slate-200 dark:border-zinc-700 font-bold"
                  : "text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200"
              )}
            >
              <Search className={cn("h-3.5 w-3.5 flex-shrink-0", activeTab === "track" ? "text-[#006837] dark:text-emerald-400" : "text-slate-400")} />
              <span>Track Application / Extension</span>
            </button>
          </div>

          {/* Right Navigation Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Quick Segmented Mobile Tab Toggle for Citizen */}
            <div className="flex sm:hidden items-center rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-100 dark:bg-zinc-900 p-0.5">
              <button
                onClick={() => setActiveTab?.("apply")}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-bold transition-all",
                  activeTab === "apply"
                    ? "bg-white dark:bg-zinc-800 text-[#006837] dark:text-emerald-400 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400"
                )}
              >
                Apply
              </button>
              <button
                onClick={() => setActiveTab?.("track")}
                className={cn(
                  "px-2 py-1 rounded-md text-[11px] font-bold transition-all",
                  activeTab === "track"
                    ? "bg-white dark:bg-zinc-800 text-[#006837] dark:text-emerald-400 shadow-xs"
                    : "text-slate-500 dark:text-zinc-400"
                )}
              >
                Track
              </button>
            </div>

            {/* Helpline / Support */}
            <button
              onClick={() => setIsSupportOpen(true)}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 dark:text-zinc-300 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-zinc-800 border border-slate-200 dark:border-zinc-800 transition-all shadow-2xs"
            >
              <LifeBuoy className="h-3.5 w-3.5 text-[#006837] dark:text-emerald-400" />
              <span>Helpline</span>
            </button>

            <ThemeToggle />

            {/* Mobile Menu Button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="sm:hidden flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300"
              aria-label="Toggle menu"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Mobile menu dropdown */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3">
            <button
              onClick={() => {
                setActiveTab?.("apply");
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left hover:bg-slate-100 dark:hover:bg-zinc-900"
            >
              <PlusCircle className="h-4 w-4 text-[#006837]" />
              <span>Submit Layoff Application</span>
            </button>
            <button
              onClick={() => {
                setActiveTab?.("track");
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left hover:bg-slate-100 dark:hover:bg-zinc-900"
            >
              <Search className="h-4 w-4 text-[#006837]" />
              <span>Track Application / Extension</span>
            </button>
            <button
              onClick={() => {
                setIsSupportOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="w-full flex items-center gap-2 p-2 rounded-lg text-xs font-bold text-left hover:bg-slate-100 dark:hover:bg-zinc-900"
            >
              <LifeBuoy className="h-4 w-4 text-[#006837]" />
              <span>Helpline &amp; Support</span>
            </button>
          </div>
        )}
      </header>

      {/* Support / Helpline Modal */}
      <SupportModal isOpen={isSupportOpen} onClose={() => setIsSupportOpen(false)} />
    </>
  );
}
