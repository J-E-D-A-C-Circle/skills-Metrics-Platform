"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import {
  Search, ShieldCheck, Printer, Download, QrCode, FileText, CheckCircle2,
  AlertTriangle, Clock, Calendar, Building2, User, Car, Hash, Scale,
  ChevronDown, ChevronUp, ExternalLink, ArrowRight, RefreshCw, Lock, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { StatutoryCertificate } from "@/components/statutory-certificate";
import { TablePagination } from "@/components/ui/table-pagination";
import { INITIAL_APPLICATIONS } from "@/lib/mock-data";

const DEMO_CERTIFICATES = INITIAL_APPLICATIONS.filter(
  a => a.id === "LAY-2026-GT492022" || a.id === "LAY-2026-GE489224"
);

interface RecordsDossierViewProps {
  initialQuery?: string;
  isEmbeddedInAdmin?: boolean;
}

export function RecordsDossierView({
  initialQuery = "",
  isEmbeddedInAdmin = false,
}: RecordsDossierViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(Boolean(initialQuery));
  const [dossierData, setDossierData] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Pagination for Case Files
  const [recordPage, setRecordPage] = useState(1);
  const [recordPageSize, setRecordPageSize] = useState(5);

  const paginatedRecords = React.useMemo(() => {
    if (!dossierData?.records) return [];
    const start = (recordPage - 1) * recordPageSize;
    return dossierData.records.slice(start, start + recordPageSize);
  }, [dossierData?.records, recordPage, recordPageSize]);

  // Expanded Case File Dockets
  const [expandedCases, setExpandedCases] = useState<Record<string, boolean>>({});

  // Active Certificate Modal
  const [selectedAppForCert, setSelectedAppForCert] = useState<any | null>(null);
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  const toggleCase = (id: string) => {
    setExpandedCases(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const executeSearch = async (term: string) => {
    const clean = term.trim();
    if (!clean) return;

    setLoading(true);
    setErrorMsg(null);
    setSearched(true);
    setRecordPage(1);

    try {
      const res = await fetch(`/api/records/search?q=${encodeURIComponent(clean)}`);
      const data = await res.json();

      if (res.ok && data.found) {
        setDossierData(data.dossier);
        // Expand the first case by default
        if (data.dossier.records && data.dossier.records.length > 0) {
          setExpandedCases({ [data.dossier.records[0].id]: true });
        }
      } else {
        setDossierData(null);
        setErrorMsg(data.message || `No statutory layoff records found matching "${clean}".`);
      }
    } catch (err) {
      console.error("Search error:", err);
      setErrorMsg("Network or communication error while querying registry dossier.");
      setDossierData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery) {
      executeSearch(initialQuery);
    }
  }, [initialQuery]);

  const handlePrintDossier = () => {
    window.print();
  };

  const openCertificate = (app: any) => {
    setSelectedAppForCert(app);
    setIsCertModalOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* ─── SEARCH CONTROLS (Hidden during print) ─── */}
      <div className="no-print">
        <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-[#121212]">
          <div className="p-4 sm:p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2">
                <Scale className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                <h2 className="text-base sm:text-xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                  Records Hub — Evidential Registry &amp; Dossier Search
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 max-w-3xl">
                Search the national statutory repository by <strong>Applicant Legal Name</strong>, <strong>Contact Phone</strong>, <strong>Reference ID</strong>, <strong>Ghana Card PIN</strong>, or <strong>Vehicle Registration</strong>. Retrieves the complete chronological layoff history, vehicle specifications, and court-admissible evidential records.
              </p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                executeSearch(query);
              }}
              className="flex flex-col sm:flex-row gap-2.5"
            >
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  type="text"
                  placeholder="Enter Name (e.g. Kwame Mensah), Phone (0244123456), Ref (LAY-2026-...), or Reg (GT-4920-22)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-10 h-11 text-xs rounded-xl font-medium"
                />
              </div>
              <Button
                type="submit"
                disabled={loading || !query.trim()}
                className="h-11 px-6 rounded-xl bg-[#006837] hover:bg-[#004d28] text-white font-bold text-xs shadow-md shadow-emerald-900/20 gap-2 shrink-0"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
                <span>Retrieve Evidential Dossier</span>
              </Button>
            </form>

            {/* Quick Sample Hints */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-xs text-slate-500 dark:text-zinc-400">
              <span className="font-bold text-[11px] text-slate-400">Quick Search:</span>
              {[
                { label: "GT-4920-22", hint: "Certificate #1 • Toyota Corolla" },
                { label: "GE-4892-24", hint: "Certificate #2 • Nissan Patrol" },
                { label: "LAY-2026-GT492022", hint: "Kofi Mensah" },
                { label: "LAY-2026-GE489224", hint: "Kwame Osei Darko" },
                { label: "0244123456", hint: "Phone Query" },
              ].map(s => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => {
                    setQuery(s.label);
                    executeSearch(s.label);
                  }}
                  className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 text-[11px] font-mono text-slate-700 dark:text-zinc-300 transition-colors"
                >
                  {s.label} <span className="opacity-50 text-[10px]">({s.hint})</span>
                </button>
              ))}
            </div>

            {/* Direct Demo Certificate Preview Strip */}
            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-[#006837] dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mr-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                Ready Demo Certificates:
              </span>
              {DEMO_CERTIFICATES.map((certApp, idx) => (
                <button
                  key={certApp.id}
                  type="button"
                  onClick={() => {
                    setQuery(certApp.registrationNumber);
                    executeSearch(certApp.registrationNumber);
                    openCertificate(certApp);
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold text-[#006837] dark:text-emerald-300 transition-colors shadow-2xs"
                >
                  <FileText className="h-3.5 w-3.5 shrink-0" />
                  <span>Certificate #{idx + 1}: {certApp.registrationNumber}</span>
                  <span className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
                    ({certApp.make} {certApp.model} • {certApp.vehicleUsageClassification})
                  </span>
                </button>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ─── ERROR STATE ─── */}
      {errorMsg && !loading && (
        <Card className="border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto" />
            <p className="text-sm font-bold text-red-900 dark:text-red-200">{errorMsg}</p>
            <p className="text-xs text-red-700 dark:text-red-400 max-w-md mx-auto">
              Please verify your search query format or check spelling. Queries can include partial applicant names, national ID numbers, or official vehicle plates.
            </p>
          </CardContent>
        </Card>
      )}

      {/* ─── DOSSIER VIEW (COURT-READY EVIDENTIAL BRIEF) ─── */}
      {dossierData && !loading && (
        <div id="court-evidential-docket" className="space-y-6">
          {/* Top Evidential Certification Banner */}
          <Card className="border-2 border-[#006837] dark:border-emerald-700 shadow-md bg-white dark:bg-[#121212] overflow-hidden">
            {/* National Coat of Arms + DVLA Security Strip */}
            <div className="bg-[#004d28] text-white px-4 sm:px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 relative shrink-0">
                  <Image src="/oop.png" alt="DVLA Crest" fill className="object-contain brightness-0 invert" />
                </div>
                <div>
                  <p className="text-[10px] font-mono tracking-widest text-emerald-200 uppercase font-black">
                    REPUBLIC OF GHANA &bull; STATUTORY MOTOR VEHICLE REGISTRY
                  </p>
                  <h3 className="text-sm sm:text-base font-black tracking-tight uppercase">
                    Certified Evidential Layoff Dossier &bull; Registry Extract
                  </h3>
                </div>
              </div>

              <div className="no-print flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handlePrintDossier}
                  className="bg-white hover:bg-slate-100 text-[#006837] font-extrabold text-xs rounded-xl gap-2 shadow-xs"
                >
                  <Printer className="h-4 w-4" />
                  Export Certified Court Evidential Docket (A4)
                </Button>
              </div>
            </div>

            {/* Legal Chain-of-Custody & Metadata Bar */}
            <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-zinc-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs bg-slate-50/60 dark:bg-zinc-900/60">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Dossier Docket No.</span>
                <span className="font-mono font-black text-slate-900 dark:text-zinc-100 text-sm">
                  {dossierData.dossierReference}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Digital Checksum (SHA-256)</span>
                <span className="font-mono font-bold text-[#006837] dark:text-emerald-400 text-[11px] truncate block" title={dossierData.integrityChecksum}>
                  {dossierData.integrityChecksum}
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Statutory Authority</span>
                <span className="font-bold text-slate-800 dark:text-zinc-200 text-[11px]">
                  L.I. 2519 Regulation 28
                </span>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Court Evidentiary Status</span>
                <span className="font-semibold text-emerald-800 dark:text-emerald-400 text-[11px] flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  N.R.C.D. 323 S.51 Certified
                </span>
              </div>
            </div>

            {/* Citizen Legal Profile Card */}
            <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-1 border-b md:border-b-0 md:border-r border-slate-100 dark:border-zinc-800 pb-4 md:pb-0 md:pr-6 space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="h-10 w-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center shrink-0">
                    <User className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Registered Citizen</span>
                    <h4 className="text-base font-black text-slate-900 dark:text-zinc-100 leading-tight">
                      {dossierData.citizen.legalName}
                    </h4>
                  </div>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Ghana Card PIN</span>
                    <span className="font-mono font-bold text-[#006837] dark:text-emerald-400">
                      {dossierData.citizen.idNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Official Contact Phone</span>
                    <span className="font-bold text-slate-800 dark:text-zinc-200">
                      {dossierData.citizen.phone}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Email Address</span>
                    <span className="text-slate-600 dark:text-zinc-400 truncate block">
                      {dossierData.citizen.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Residential Address</span>
                    <span className="text-slate-800 dark:text-zinc-200">
                      {dossierData.citizen.residentialAddress}
                    </span>
                  </div>
                </div>
              </div>

              {/* Lifetime Aggregate Layoff Performance Metrics */}
              <div className="md:col-span-2 space-y-3">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 block">
                  Lifetime Statutory Layoff Record &amp; Compliance Index
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Lifetime Applications</span>
                    <span className="text-xl font-black text-slate-900 dark:text-zinc-100 font-mono">
                      {dossierData.metrics.totalApplications}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Across {dossierData.metrics.uniqueVehiclesCount} vehicle(s)
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-0.5">
                    <span className="text-[10px] text-emerald-800 dark:text-emerald-400 font-bold block uppercase">Active Off-Road</span>
                    <span className="text-xl font-black text-[#006837] dark:text-emerald-400 font-mono">
                      {dossierData.metrics.activeLayoffsCount}
                    </span>
                    <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 block">
                      Grounded vehicles
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Off-Road Time</span>
                    <span className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
                      {dossierData.metrics.totalMonthsLaidOff}
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      Calendar months
                    </span>
                  </div>

                  <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 space-y-0.5">
                    <span className="text-[10px] text-slate-400 font-bold block uppercase">Total Revenue Settled</span>
                    <span className="text-lg font-black text-slate-900 dark:text-zinc-100 font-mono">
                      GH₵ {dossierData.metrics.totalLifetimeFeesPaid.toFixed(2)}
                    </span>
                    <span className="text-[10px] text-emerald-600 block">
                      Paid via IPP Pro
                    </span>
                  </div>
                </div>

                <div className="p-2.5 rounded-xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/40 flex items-center justify-between text-xs text-slate-600 dark:text-zinc-400">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
                    <span>Inspection Compliance Score: <strong>{dossierData.metrics.inspectionComplianceRate}%</strong></span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-400">
                    Registry Extract Generated: {new Date(dossierData.generatedAt).toLocaleDateString()}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ─── INDIVIDUAL VEHICLE LAYOFF CASE FILES ─── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-zinc-100 uppercase tracking-tight flex items-center gap-2">
                <Car className="h-4 w-4 text-[#006837]" />
                <span>Chronological Case Files &bull; {dossierData.records.length} Record(s)</span>
              </h3>
              <span className="text-xs text-slate-400 font-mono">
                L.I. 2519 Docket
              </span>
            </div>

            {paginatedRecords.map((rec: any, index: number) => {
              const isExpanded = expandedCases[rec.id];
              const isApproved = rec.adminApprovalStatus === "Approved";
              const isPaid = rec.paymentStatus === "Paid";
              const isEligible = rec.isEligibleForCertificate;

              return (
                <Card
                  key={rec.id}
                  className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden bg-white dark:bg-[#121212]"
                >
                  {/* Case Card Header Strip */}
                  <div className="p-4 bg-slate-50 dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {/* Vehicle License Plate Display */}
                      <div className="inline-flex items-center rounded-lg border-2 border-slate-900 bg-white px-3 py-1 shadow-xs">
                        <span className="font-mono text-base font-black tracking-wider text-slate-900">
                          {rec.registrationNumber}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs font-bold text-slate-500">
                            {rec.id}
                          </span>
                          <Badge
                            variant={rec.vehicleRoadStatus === "Off Road" ? "success" : "info"}
                            className="text-[10px]"
                          >
                            {rec.vehicleRoadStatus}
                          </Badge>
                          <Badge
                            variant={rec.status === "Active Layoff" ? "success" : rec.status === "Rejected" ? "danger" : "warning"}
                            className="text-[10px]"
                          >
                            {rec.status}
                          </Badge>
                        </div>
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-0.5">
                          {rec.make} {rec.model} &bull; {rec.vehicleType} ({rec.vehicleUsageClassification || "Private"})
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                      {/* Certificate Trigger Button */}
                      <Button
                        size="sm"
                        variant={isEligible ? "default" : "outline"}
                        onClick={() => openCertificate(rec)}
                        className={cn(
                          "h-8 text-xs font-bold rounded-xl gap-1.5",
                          isEligible
                            ? "bg-[#006837] hover:bg-[#004d28] text-white shadow-sm"
                            : "text-slate-500 dark:text-zinc-400 border-dashed"
                        )}
                      >
                        {isEligible ? (
                          <>
                            <FileText className="h-3.5 w-3.5" />
                            <span>National Certificate</span>
                          </>
                        ) : (
                          <>
                            <Lock className="h-3.5 w-3.5 text-amber-500" />
                            <span>Certificate Withheld</span>
                          </>
                        )}
                      </Button>

                      {/* Expand / Collapse Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggleCase(rec.id)}
                        className="h-8 w-8 p-0 rounded-lg"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>

                  {/* Expandable Case Particulars */}
                  {isExpanded && (
                    <div className="p-4 sm:p-6 space-y-5 text-xs">
                      {/* Grid 1: Particulars & Storage Grounding */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">VIN &amp; Engine</span>
                          <p className="font-mono text-slate-800 dark:text-zinc-200 break-all">
                            <strong>Chassis:</strong> {rec.chassisNumber}
                          </p>
                          <p className="font-mono text-slate-800 dark:text-zinc-200">
                            <strong>Engine:</strong> {rec.engineNumber || "Surrendered"}
                          </p>
                          <p className="text-slate-600 dark:text-zinc-400">
                            <strong>Color / Year:</strong> {rec.colour || "—"} / {rec.yearOfMake || "—"}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Storage Compound Grounding</span>
                          <p className="font-bold text-slate-900 dark:text-zinc-100">
                            {rec.storageFacilityName || "Declared Private Facility"}
                          </p>
                          <p className="text-slate-600 dark:text-zinc-400">
                            Region: <strong>{rec.storageRegion || "Greater Accra"}</strong>
                          </p>
                          <p className="text-slate-500 italic mt-1 max-w-xs truncate" title={rec.explanation}>
                            &ldquo;{rec.explanation || rec.reason}&rdquo;
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Layoff Duration &amp; Expiry</span>
                          <p className="font-semibold text-slate-800 dark:text-zinc-200">
                            Duration: <strong>{rec.layoffPeriodMonths} Calendar Months</strong>
                          </p>
                          <p className="text-slate-700 dark:text-zinc-300">
                            Effective: <span className="font-mono font-bold">{rec.layoffStartDate || "Upon Payment"}</span>
                          </p>
                          <p className="text-rose-600 dark:text-rose-400">
                            Statutory Expiry: <span className="font-mono font-black">{rec.layoffExpiryDate || "Pending"}</span>
                          </p>
                        </div>
                      </div>

                      {/* Grid 2: Inspection & Officer Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pb-4 border-b border-slate-100 dark:border-zinc-800">
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Technical Inspection</span>
                          <div className="flex items-center gap-1.5">
                            <Badge
                              variant={rec.inspectionStatus === "Completed" ? "success" : "warning"}
                              className="text-[10px]"
                            >
                              {rec.inspectionStatus}
                            </Badge>
                          </div>
                          <p className="text-slate-600 dark:text-zinc-400 mt-1">
                            Officer: <strong>{rec.assignedOfficerName || "Regional Pool Unassigned"}</strong>
                          </p>
                          <p className="text-slate-500 font-mono">
                            Inspection Date: {rec.inspectionDate || "Pending"}
                          </p>
                        </div>

                        <div className="space-y-1 sm:col-span-2">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Inspection Findings &amp; Outcome</span>
                          <p className="font-bold text-slate-800 dark:text-zinc-200">
                            Outcome: {rec.inspectionOutcome || "Awaiting physical inspection"}
                          </p>
                          {rec.inspectionDefects && (
                            <p className="text-red-600 dark:text-red-400">
                              <strong>Identified Defects:</strong> {rec.inspectionDefects}
                            </p>
                          )}
                          {rec.inspectionFindings && (
                            <p className="text-slate-600 dark:text-zinc-400">
                              <strong>Findings:</strong> {rec.inspectionFindings}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Grid 3: Administrative Approval & Statutory Declaration Record */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">Administrative Sign-Off</span>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={rec.adminApprovalStatus === "Approved" ? "success" : rec.adminApprovalStatus === "Rejected" ? "danger" : "warning"}
                              className="text-[10px]"
                            >
                              {rec.adminApprovalStatus}
                            </Badge>
                            {rec.adminApprovedBy && (
                              <span className="text-slate-600 dark:text-zinc-400">
                                by <strong>{rec.adminApprovedBy}</strong>
                              </span>
                            )}
                          </div>
                          {rec.adminComments && (
                            <p className="text-slate-500 text-[11px] italic">
                              Comments: &ldquo;{rec.adminComments}&rdquo;
                            </p>
                          )}
                        </div>

                        <div className="p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/50 space-y-1.5">
                          <span className="text-[10px] text-slate-400 font-bold block uppercase">L.I. 2519 Statutory Undertaking</span>
                          {rec.declaration ? (
                            <div className="space-y-0.5 text-[11px] text-slate-700 dark:text-zinc-300">
                              <p className="text-emerald-700 dark:text-emerald-400 font-bold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" />
                                Formally Accepted pursuant to L.I. 2519 Reg 28
                              </p>
                              <p>Signatory: <strong>{rec.declaration.applicantName}</strong></p>
                              <p className="font-mono text-[10px] text-slate-400">
                                Accepted At: {new Date(rec.declaration.acceptedAt).toLocaleString()}
                              </p>
                            </div>
                          ) : (
                            <p className="text-slate-400 italic">Pre-2026 legacy record declaration</p>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })}

            {/* Pagination Controls */}
            {dossierData.records && dossierData.records.length > 0 && (
              <div className="no-print bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">
                <TablePagination
                  currentPage={recordPage}
                  totalItems={dossierData.records.length}
                  pageSize={recordPageSize}
                  onPageChange={setRecordPage}
                  onPageSizeChange={setRecordPageSize}
                  pageSizeOptions={[5, 10, 20]}
                  itemLabel="case files"
                />
              </div>
            )}
          </div>

          {/* Court Evidentiary Attestation Signature Block (Visible on Print) */}
          <div className="pt-6 border-t-2 border-slate-300 dark:border-zinc-700 space-y-4">
            <div className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed max-w-3xl">
              <p>
                <strong>OFFICIAL REGISTRY CERTIFICATION:</strong> I hereby certify under the seal of the Driver and Vehicle Licensing Authority (DVLA) that the above records constitute an authentic, complete extract from the National Vehicle Layoff Registry compiled pursuant to <strong>Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28</strong>. Admissible as prima facie evidence under Section 51 of the Evidence Act, 1975 (N.R.C.D. 323).
              </p>
            </div>

            <div className="flex flex-col lg:flex-row items-center justify-between gap-6 pt-4 text-xs">
              <div className="flex flex-col sm:flex-row items-center gap-6">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="h-8 border-b border-slate-400 w-44 mx-auto sm:mx-0 flex items-end pb-0.5">
                    <span className="font-serif italic font-bold text-slate-900 dark:text-zinc-100">Chief Supt. Osei Tutu</span>
                  </div>
                  <span className="text-[10px] text-slate-600 dark:text-zinc-300 font-bold block uppercase">Director, Vehicle Registration</span>
                  <span className="text-[9px] text-slate-400 font-mono">DVLA 37 Operational Head Office</span>
                </div>

                <div className="space-y-1 text-center sm:text-left">
                  <div className="h-8 border-b border-slate-400 w-44 mx-auto sm:mx-0 flex items-end pb-0.5">
                    <span className="font-serif italic font-bold text-slate-900 dark:text-zinc-100">Julius N. Kotey</span>
                  </div>
                  <span className="text-[10px] text-slate-600 dark:text-zinc-300 font-bold block uppercase">Julius Neequaye Kotey</span>
                  <span className="text-[9px] text-slate-400 font-mono">Chief Executive Officer, DVLA</span>
                </div>
              </div>

              <div className="text-center lg:text-right font-mono text-[10px] text-slate-400 space-y-0.5">
                <p>Registry Seal Verification Code: {dossierData.integrityChecksum}</p>
                <p>Date of Certified Extract: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── NATIONAL CERTIFICATE DIALOG MODAL ─── */}
      {selectedAppForCert && (
        <Dialog
          isOpen={isCertModalOpen}
          onClose={() => setIsCertModalOpen(false)}
          title="National Vehicle Lay-Off Certificate (L.I. 2519 Regulation 28)"
          maxWidth="max-w-4xl"
        >
          <StatutoryCertificate
            application={selectedAppForCert}
            onClose={() => setIsCertModalOpen(false)}
            showPrintAction={true}
          />
        </Dialog>
      )}
    </div>
  );
}
