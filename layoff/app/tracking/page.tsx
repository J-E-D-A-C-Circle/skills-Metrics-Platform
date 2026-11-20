"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Search, CheckCircle2, Clock, ShieldCheck, MapPin, Phone,
  FileText, ArrowRight, Printer, AlertTriangle, ExternalLink,
  Building2, Car, Download, Check
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function TrackingPage() {
  const [refInput, setRefInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [trackingData, setTrackingData] = useState<any | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!refInput.trim()) {
      setSearchError("Please enter your Application Reference Number or Vehicle Registration.");
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    setTrackingData(null);

    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(refInput.trim().toUpperCase())}`);
      if (res.ok) {
        const app = await res.json();
        // Optional phone validation to prevent arbitrary enumeration
        if (phoneInput.trim()) {
          const normInputPhone = phoneInput.replace(/\D/g, "");
          const normAppPhone = (app.applicantPhone || "").replace(/\D/g, "");
          if (normInputPhone.length >= 6 && !normAppPhone.includes(normInputPhone.slice(-6))) {
            setSearchError("The phone number provided does not match the contact number registered with this application.");
            setIsSearching(false);
            return;
          }
        }

        // Sanitize data for public display (No internal officer remarks, no staff IDs)
        setTrackingData({
          id: app.id,
          registrationNumber: app.registrationNumber,
          make: app.make,
          model: app.model,
          yearOfMake: app.yearOfMake,
          vehicleType: app.vehicleType,
          vehicleUsageClassification: app.vehicleUsageClassification || "Private",
          status: app.status,
          applicationStatus: app.applicationStatus || "Submitted",
          adminApprovalStatus: app.adminApprovalStatus || "Pending",
          inspectionStatus: app.inspectionStatus || "Pending",
          inspectionMethod: app.inspectionMethod || "OFFICE",
          paymentStatus: app.paymentStatus || "Pending",
          invoiceNumber: app.invoiceNumber,
          vehicleRoadStatus: app.vehicleRoadStatus || "On Road",
          layoffStartDate: app.layoffStartDate,
          layoffExpiryDate: app.layoffExpiryDate,
          storageFacilityName: app.storageFacilityName,
          storageRegion: app.storageRegion,
          submittedAt: app.submittedAt,
        });
      } else {
        setSearchError(`No vehicle layoff record found matching "${refInput}". Please verify your reference number and retry.`);
      }
    } catch (err) {
      console.error(err);
      setSearchError("Network error while querying DVLA registry. Please check your connection.");
    } finally {
      setIsSearching(false);
    }
  };

  // Compute 5-stage progress milestone
  const getMilestones = (app: any) => {
    const isSubmitted = true;
    const isApproved = app.adminApprovalStatus === "Approved";
    const isInspected = app.inspectionStatus === "Completed";
    const isPaid = app.paymentStatus === "Paid";
    const isActive = app.vehicleRoadStatus === "Off Road" || ["Active Layoff", "Active", "Extended"].includes(app.status);

    return [
      {
        id: "step1",
        label: "Application Received",
        sub: app.submittedAt || "Received",
        done: isSubmitted,
        current: !isApproved,
      },
      {
        id: "step2",
        label: "DVLA Administrative Review",
        sub: isApproved ? "Approved by Authority" : "Under Review",
        done: isApproved,
        current: isApproved && !isInspected,
      },
      {
        id: "step3",
        label: "Physical Vehicle Inspection",
        sub: isInspected ? "Inspection Finalized" : app.inspectionMethod === "ON_SITE" ? "On-Site Scheduled" : "Office Testing Queue",
        done: isInspected,
        current: isInspected && !isPaid,
      },
      {
        id: "step4",
        label: "Statutory Fee & Invoicing",
        sub: isPaid ? "Payment Verified" : app.invoiceNumber ? `Invoice ${app.invoiceNumber} Generated` : "Awaiting Invoice",
        done: isPaid,
        current: isPaid && !isActive,
      },
      {
        id: "step5",
        label: "Statutory Layoff Certificate",
        sub: isActive ? `Active until ${app.layoffExpiryDate}` : "Pending Activation",
        done: isActive,
        current: isActive,
      },
    ];
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9fa] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans">
      <Navbar />

      <main className="flex-1 container mx-auto max-w-5xl px-3 sm:px-8 py-8 sm:py-12 space-y-8">
        {/* Header */}
        <div className="text-center space-y-2 max-w-2xl mx-auto">
          <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold border-emerald-600/30 text-[#006837] dark:text-emerald-400">
            Citizen Public Services Portal
          </Badge>
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
            Track Your Vehicle Layoff Application
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium">
            Enter your official Application Reference Number (`LAY-2026-xxxx`) or Vehicle Registration to check real-time statutory progress under L.I. 2519 Regulation 28.
          </p>
        </div>

        {/* Search Card */}
        <Card className="border-slate-200 dark:border-zinc-800 shadow-md max-w-2xl mx-auto bg-white dark:bg-[#121212] rounded-3xl overflow-hidden">
          <CardContent className="p-5 sm:p-7 space-y-4">
            <form onSubmit={handleSearch} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Application Reference or Vehicle Registration <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    className="pl-10 h-12 text-sm rounded-xl font-bold uppercase tracking-wider"
                    placeholder="e.g. LAY-2026-8810 or GT-4920-22"
                    value={refInput}
                    onChange={e => setRefInput(e.target.value.toUpperCase())}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
                  Registered Phone Number <span className="text-slate-400 font-normal">(Optional security verification)</span>
                </label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <Input
                    className="pl-10 h-12 text-sm rounded-xl"
                    placeholder="e.g. 024 411 2233"
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                  />
                </div>
              </div>

              {searchError && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={isSearching}
                className="w-full h-12 rounded-xl text-sm font-bold bg-[#006837] hover:bg-[#00552d] text-white shadow-md shadow-emerald-950/20"
              >
                {isSearching ? "Searching DVLA Registry..." : "Track Application Progress"}
              </Button>
            </form>

            <div className="pt-2 text-center text-xs text-slate-400">
              Need assistance? Call DVLA Customer Helpline: <strong>030 274 6760</strong>
            </div>
          </CardContent>
        </Card>

        {/* Tracking Result View */}
        {trackingData && (
          <div className="space-y-6 max-w-3xl mx-auto animate-fade-in">
            {/* Top Status Banner */}
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm bg-white dark:bg-[#121212] rounded-3xl overflow-hidden">
              <div className="p-5 sm:p-7 border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r from-emerald-50/40 to-white dark:from-emerald-950/20 dark:to-[#121212]">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-bold text-slate-400">{trackingData.id}</span>
                    <Badge variant={trackingData.vehicleRoadStatus === "Off Road" ? "success" : "info"} className="text-xs">
                      {trackingData.status || trackingData.applicationStatus}
                    </Badge>
                  </div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 mt-1">
                    {trackingData.registrationNumber} &bull; {trackingData.make} {trackingData.model}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Classification: {trackingData.vehicleUsageClassification} &bull; Storage: {trackingData.storageRegion || "Regional"}
                  </p>
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Road Status</span>
                  <span className={cn(
                    "text-sm font-black uppercase px-3 py-1 rounded-full inline-block mt-0.5",
                    trackingData.vehicleRoadStatus === "Off Road"
                      ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                      : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                  )}>
                    {trackingData.vehicleRoadStatus}
                  </span>
                </div>
              </div>

              {/* 5-Step Milestone Progress */}
              <div className="p-5 sm:p-7 space-y-6">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  Statutory Application Progress Lifecycle
                </h3>

                <div className="space-y-4">
                  {getMilestones(trackingData).map((m, idx) => (
                    <div key={m.id} className="flex items-start gap-4">
                      <div className="flex flex-col items-center">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-all",
                          m.done
                            ? "bg-[#006837] text-white"
                            : m.current
                            ? "bg-amber-500 text-white ring-4 ring-amber-500/20"
                            : "bg-slate-200 dark:bg-zinc-800 text-slate-400"
                        )}>
                          {m.done ? <Check className="h-4 w-4" /> : idx + 1}
                        </div>
                        {idx < 4 && (
                          <div className={cn(
                            "w-0.5 h-8 my-1",
                            m.done ? "bg-[#006837]" : "bg-slate-200 dark:bg-zinc-800"
                          )} />
                        )}
                      </div>

                      <div className="pt-1">
                        <p className={cn(
                          "text-sm font-bold",
                          m.done ? "text-slate-900 dark:text-zinc-100" : m.current ? "text-amber-600 dark:text-amber-400" : "text-slate-400"
                        )}>
                          {m.label}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">{m.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Layoff Validity Box */}
              {trackingData.layoffExpiryDate && (
                <div className="p-5 sm:p-7 bg-slate-50 dark:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                  <div>
                    <span className="text-slate-500">Statutory Start:</span>
                    <p className="font-bold text-slate-900 dark:text-zinc-100">{trackingData.layoffStartDate || "Upon Payment"}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Layoff Expiry Date:</span>
                    <p className="font-black text-rose-600 dark:text-rose-400">{trackingData.layoffExpiryDate}</p>
                  </div>
                  <div>
                    <span className="text-slate-500">Invoice Reference:</span>
                    <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{trackingData.invoiceNumber || "Pending"}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
