"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  Search, CheckCircle2, AlertTriangle, Printer, RotateCcw, XCircle, QrCode,
  ShieldCheck, FileText, Calendar, Building2, User, Car, Download, Check,
  CreditCard, Clock, RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LayoffApplication, Invoice, INITIAL_APPLICATIONS, INITIAL_INVOICES } from "@/lib/mock-data";
import { ThermalReceipt } from "@/components/thermal-receipt";
import { StatutoryCertificate } from "@/components/statutory-certificate";

interface StatusLookupProps {
  applications: LayoffApplication[];
  invoices: Invoice[];
  onEditRejected: (app: LayoffApplication) => void;
  onExtendLayoff?: (invoiceNumber: string, addedMonths: number) => void;
  initialQuery?: string;
}

const STATUS_BADGE: Record<string, "success" | "warning" | "danger" | "info" | "gold" | "extended" | "secondary"> = {
  "Approved": "success",
  "Active Layoff": "success",
  "Active": "success",
  "Expiring Soon": "warning",
  "Rejected": "danger",
  "Pending Verification": "info",
  "Pending Approval": "info",
  "Extended": "extended",
};

const SAMPLE_QUERIES = [
  { label: "LAY-2026-GT492022", hint: "Certificate #1 • GT-4920-22" },
  { label: "LAY-2026-GE489224", hint: "Certificate #2 • GE-4892-24" },
  { label: "LAY-2026-AS331021", hint: "Pending Approval" },
];

const DEMO_CERTIFICATES = INITIAL_APPLICATIONS.filter(
  a => a.id === "LAY-2026-GT492022" || a.id === "LAY-2026-GE489224"
);

function DetailRow({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex justify-between items-start gap-4 py-2.5 border-b border-slate-100 dark:border-zinc-800 last:border-0">
      <span className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 flex-shrink-0">{label}</span>
      <span className={cn("text-xs sm:text-sm font-bold text-slate-900 dark:text-zinc-100 text-right", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export function StatusLookup({
  applications, invoices, onEditRejected, onExtendLayoff, initialQuery = "",
}: StatusLookupProps) {
  const [query, setQuery] = useState(initialQuery);
  const [searched, setSearched] = useState(Boolean(initialQuery));
  const [foundApp, setFoundApp] = useState<LayoffApplication | null>(null);
  const [foundInvoice, setFoundInvoice] = useState<Invoice | null>(null);

  // Structured Extension Request State
  const [isExtensionModalOpen, setIsExtensionModalOpen] = useState(false);
  const [extendMonths, setExtendMonths] = useState(3);
  const [extensionReason, setExtensionReason] = useState("");
  const [isSubmittingExtension, setIsSubmittingExtension] = useState(false);
  const [extensionError, setExtensionError] = useState("");
  const [extensionSuccessMsg, setExtensionSuccessMsg] = useState("");
  const [activeExtensionRequest, setActiveExtensionRequest] = useState<any>(null);
  const [isPayingExtension, setIsPayingExtension] = useState(false);

  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);

  // Fetch active extension requests for found application
  const fetchExtensionStatus = async (appId: string) => {
    try {
      const res = await fetch(`/api/extensions?applicationId=${encodeURIComponent(appId)}`);
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setActiveExtensionRequest(data[0]);
        } else {
          setActiveExtensionRequest(null);
        }
      }
    } catch (err) {
      console.error("Failed to fetch extension status:", err);
    }
  };

  const doSearch = (q: string) => {
    const clean = q.trim().toUpperCase();
    if (!clean) return;
    setSearched(true);
    setExtensionSuccessMsg("");
    setExtensionError("");

    const combinedApps = [...DEMO_CERTIFICATES, ...applications.filter(a => !DEMO_CERTIFICATES.some(d => d.id === a.id))];
    const combinedInvoices = [...INITIAL_INVOICES, ...invoices.filter(i => !INITIAL_INVOICES.some(d => d.invoiceNumber === i.invoiceNumber))];

    const matchedApp = combinedApps.find(
      a => a.id.toUpperCase() === clean ||
        a.registrationNumber.toUpperCase() === clean ||
        a.chassisNumber.toUpperCase() === clean ||
        (a.invoiceNumber && a.invoiceNumber.toUpperCase() === clean)
    );
    const matchedInvoice = combinedInvoices.find(
      i => i.invoiceNumber.toUpperCase() === clean ||
        i.registrationNumber.toUpperCase() === clean ||
        i.chassisNumber.toUpperCase() === clean ||
        i.applicationId.toUpperCase() === clean
    );
    setFoundApp(matchedApp || null);
    setFoundInvoice(matchedInvoice || null);

    if (matchedApp) {
      fetchExtensionStatus(matchedApp.id);
    } else {
      setActiveExtensionRequest(null);
    }
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    doSearch(query);
  };

  useEffect(() => {
    if (initialQuery) doSearch(initialQuery);
  }, [initialQuery]);

  // Compute calculated values for extension
  const currentExpiryStr = foundApp?.layoffExpiryDate || foundInvoice?.layoffExpiryDate || new Date().toISOString().split("T")[0];
  const calculatedFee = extendMonths * 75.0; // GH₵ 75 per month

  const calculateProposedExpiry = (expiryStr: string, months: number): string => {
    try {
      const d = new Date(`${expiryStr}T00:00:00Z`);
      const targetMonth = d.getUTCMonth() + months;
      const targetYear = d.getUTCFullYear() + Math.floor(targetMonth / 12);
      const normalizedMonth = targetMonth % 12;
      const daysInTarget = new Date(Date.UTC(targetYear, normalizedMonth + 1, 0)).getUTCDate();
      const targetDay = Math.min(d.getUTCDate(), daysInTarget);
      return new Date(Date.UTC(targetYear, normalizedMonth, targetDay)).toISOString().split("T")[0];
    } catch {
      return expiryStr;
    }
  };

  const proposedNewExpiry = calculateProposedExpiry(currentExpiryStr, extendMonths);

  // Submit structured extension request
  const handleSubmitExtensionRequest = async () => {
    if (!foundApp) return;
    if (!extensionReason.trim()) {
      setExtensionError("Please provide a detailed statutory reason for the extension request.");
      return;
    }

    setIsSubmittingExtension(true);
    setExtensionError("");
    try {
      const res = await fetch("/api/extensions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: foundApp.id,
          requestedPeriodMonths: extendMonths,
          reason: extensionReason.trim(),
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setExtensionSuccessMsg(
          `Statutory extension request for ${extendMonths} months submitted successfully. Ref: ${data.extensionRequest.id}. Awaiting administrative review.`
        );
        setIsExtensionModalOpen(false);
        setExtensionReason("");
        fetchExtensionStatus(foundApp.id);
      } else {
        setExtensionError(data.details || data.error || "Failed to submit extension request.");
      }
    } catch (err) {
      console.error(err);
      setExtensionError("Network error while submitting extension request.");
    } finally {
      setIsSubmittingExtension(false);
    }
  };

  // Pay approved extension fee via IPP Pro
  const handlePayApprovedExtension = async (extensionId: string) => {
    setIsPayingExtension(true);
    try {
      const res = await fetch(`/api/extensions/${extensionId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentReference: `PAY-IPP-EXT-${Date.now().toString().slice(-6)}`,
          paymentMethod: "IPP_PRO_MOBILE_MONEY",
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setExtensionSuccessMsg(
          `Payment of GH₵ ${activeExtensionRequest.feeAmount} confirmed! Vehicle layoff extended until ${data.application.layoffExpiryDate}.`
        );
        if (foundApp) {
          fetchExtensionStatus(foundApp.id);
          doSearch(query);
        }
      } else {
        alert(data.error || "Failed to process extension payment.");
      }
    } catch (err) {
      console.error(err);
      alert("Error confirming extension payment.");
    } finally {
      setIsPayingExtension(false);
    }
  };

  return (
    <div className="w-full space-y-7 animate-fade-in">
      {/* Header */}
      <div className="space-y-1.5 bg-white dark:bg-[#121212] p-6 rounded-2xl border border-slate-200 dark:border-zinc-800 shadow-xs transition-colors">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">
          Track Application &amp; Statutory Certificate Lookup
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 font-medium">
          Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28: Search by Invoice Number, Application Reference, Vehicle Registration, or Chassis VIN.
        </p>
      </div>

      {/* Search card */}
      <Card className="border-slate-200 dark:border-zinc-800 shadow-xs">
        <CardContent className="p-4 sm:p-6 space-y-4">
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-zinc-500 pointer-events-none" />
              <Input
                placeholder="e.g. LAY-2026-GT492022, GT-4920-22, INV-DVLA-88109..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="pl-10 h-12 text-xs sm:text-sm rounded-xl"
              />
            </div>
            <Button type="submit" size="lg" className="h-12 px-6 sm:px-8 text-xs sm:text-sm font-bold shadow-md shadow-emerald-900/20 w-full sm:w-auto">
              Lookup Record
            </Button>
          </form>

          {/* Quick fill chips */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 pt-1">
            <span className="text-[11px] sm:text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider mr-1">Demo Quick Tests:</span>
            {SAMPLE_QUERIES.map(s => (
              <button
                key={s.label}
                type="button"
                onClick={() => { setQuery(s.label); setTimeout(() => doSearch(s.label), 50); }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 hover:bg-slate-100 dark:hover:bg-zinc-800 text-[11px] sm:text-xs font-mono text-slate-800 dark:text-zinc-200 transition-colors font-semibold shadow-xs"
              >
                {s.label}
                <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-sans">({s.hint})</span>
              </button>
            ))}
          </div>

          {/* Direct Demo Certificate Preview Strip */}
          <div className="pt-2 border-t border-slate-100 dark:border-zinc-800/80 flex flex-wrap items-center gap-2">
            <span className="text-[11px] sm:text-xs text-[#006837] dark:text-emerald-400 font-bold uppercase tracking-wider flex items-center gap-1.5 mr-1">
              <ShieldCheck className="h-3.5 w-3.5" />
              Ready Demo Certificates:
            </span>
            {DEMO_CERTIFICATES.map((certApp, idx) => (
              <button
                key={certApp.id}
                type="button"
                onClick={() => {
                  setQuery(certApp.registrationNumber);
                  doSearch(certApp.registrationNumber);
                  setIsCertificateModalOpen(true);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-xs font-bold text-[#006837] dark:text-emerald-300 transition-colors shadow-2xs"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span>Certificate #{idx + 1}: {certApp.registrationNumber}</span>
                <span className="text-[10px] font-medium text-emerald-700/80 dark:text-emerald-400/80">
                  ({certApp.make} {certApp.model})
                </span>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Success banner */}
      {extensionSuccessMsg && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/50 text-xs sm:text-sm font-bold text-emerald-900 dark:text-emerald-300 shadow-xs">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          {extensionSuccessMsg}
        </div>
      )}

      {/* Active Extension Status Banner (If request exists) */}
      {activeExtensionRequest && (
        <div className={cn(
          "p-4 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs",
          activeExtensionRequest.status === "Approved" && activeExtensionRequest.paymentStatus === "Pending"
            ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200"
            : activeExtensionRequest.paymentStatus === "Paid"
            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-700 text-emerald-900 dark:text-emerald-200"
            : "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 text-blue-900 dark:text-blue-200"
        )}>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <strong className="text-sm">
                Statutory Layoff Extension: {activeExtensionRequest.status}
              </strong>
              <Badge variant={activeExtensionRequest.paymentStatus === "Paid" ? "success" : "warning"} className="text-[10px]">
                {activeExtensionRequest.paymentStatus === "Paid" ? "Active / Paid" : "Awaiting Fee Payment"}
              </Badge>
            </div>
            <p>
              Requested: +{activeExtensionRequest.requestedPeriodMonths} Months until <strong>{activeExtensionRequest.proposedNewExpiryDate}</strong> &bull; Fee: GH₵ {activeExtensionRequest.feeAmount.toFixed(2)}
            </p>
            {activeExtensionRequest.reviewNotes && (
              <p className="text-[11px] opacity-80">Officer Notes: {activeExtensionRequest.reviewNotes}</p>
            )}
          </div>

          {activeExtensionRequest.status === "Approved" && activeExtensionRequest.paymentStatus === "Pending" && (
            <Button
              size="sm"
              disabled={isPayingExtension}
              onClick={() => handlePayApprovedExtension(activeExtensionRequest.id)}
              className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-2 shrink-0 shadow-xs"
            >
              <CreditCard className="h-3.5 w-3.5" />
              {isPayingExtension ? "Processing Payment..." : `Pay Fee GH₵ ${activeExtensionRequest.feeAmount.toFixed(2)} (IPP Pro)`}
            </Button>
          )}
        </div>
      )}

      {/* Results */}
      {searched && (
        <div className="space-y-6">
          {foundApp || foundInvoice ? (
            <>
              {/* Application record */}
              {foundApp && (
                <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-slate-50 to-white dark:from-zinc-900 dark:to-[#121212]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-mono font-extrabold text-slate-900 dark:text-zinc-100 bg-white dark:bg-zinc-800 px-2.5 py-1 rounded-md border border-slate-200 dark:border-zinc-700">
                          {foundApp.id}
                        </span>
                        <Badge variant={STATUS_BADGE[foundApp.status] ?? "secondary"} dot className="px-3 py-1">
                          {foundApp.status}
                        </Badge>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">
                        Statutory Vehicle Layoff Application Record (L.I. 2519 Regulation 28)
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsCertificateModalOpen(true)}
                        className="gap-2 border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 text-[#006837] dark:text-emerald-400 hover:bg-emerald-100/60 font-bold w-full sm:w-auto h-10 sm:h-9 justify-center"
                      >
                        <ShieldCheck className="h-4 w-4" />
                        <span>Statutory Certificate</span>
                      </Button>

                      {foundApp.status === "Rejected" && (
                        <Button variant="accent" size="sm" onClick={() => onEditRejected(foundApp)} className="gap-2 font-bold w-full sm:w-auto h-10 sm:h-9 justify-center">
                          <RotateCcw className="h-4 w-4" />
                          Edit &amp; Resubmit
                        </Button>
                      )}
                    </div>
                  </div>

                  <CardContent className="p-4 sm:p-6 space-y-4 sm:space-y-5">
                    {/* Rejection alert */}
                    {foundApp.status === "Rejected" && foundApp.rejectionReason && (
                      <div className="flex gap-3.5 p-4 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50/90 dark:bg-red-950/40 shadow-xs">
                        <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                          <p className="text-xs font-bold uppercase tracking-wider text-red-900 dark:text-red-300">DVLA Official Rejection Feedback</p>
                          <p className="text-xs sm:text-sm text-red-800 dark:text-red-200 font-medium leading-relaxed">&ldquo;{foundApp.rejectionReason}&rdquo;</p>
                        </div>
                      </div>
                    )}

                    <div className="grid sm:grid-cols-2 gap-5">
                      <div className="rounded-xl bg-slate-50/80 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 p-5 space-y-1">
                        <p className="text-[11px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Vehicle Particulars</p>
                        <DetailRow label="Registration" value={<span className="text-[#006837] dark:text-emerald-400 font-extrabold text-base">{foundApp.registrationNumber}</span>} mono />
                        <DetailRow label="Chassis VIN" value={foundApp.chassisNumber} mono />
                        {foundApp.engineNumber && <DetailRow label="Engine Number" value={foundApp.engineNumber} mono />}
                        <DetailRow label="Make & Model" value={`${foundApp.make} ${foundApp.model} ${foundApp.yearOfMake ? `(${foundApp.yearOfMake})` : ''}`.trim()} />
                        <DetailRow label="Classification" value={foundApp.vehicleUsageClassification || "Private"} />
                        <DetailRow label="Road Status" value={
                          <span className={cn(
                            "px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1",
                            foundApp.vehicleRoadStatus === "Off Road"
                              ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                              : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", foundApp.vehicleRoadStatus === "Off Road" ? "bg-amber-500" : "bg-emerald-500")} />
                            {foundApp.vehicleRoadStatus || "On Road"}
                          </span>
                        } />
                      </div>

                      <div className="rounded-xl bg-slate-50/80 dark:bg-zinc-900/70 border border-slate-200/80 dark:border-zinc-800 p-5 space-y-1">
                        <p className="text-[11px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-3">Owner &amp; Statutory Info</p>
                        <DetailRow label="Owner Name" value={foundApp.ownerName || foundApp.applicantName} />
                        {foundApp.applicantType === "REPRESENTATIVE" && (
                          <DetailRow label="Representative" value={<span className="text-amber-800 dark:text-amber-400 font-bold">{foundApp.representativeName || foundApp.applicantName} (Rep)</span>} />
                        )}
                        <DetailRow label="Ghana Card ID" value={foundApp.ownerIdNumber || foundApp.idNumber} mono />
                        <DetailRow label="Payment Status" value={
                          <Badge variant={foundApp.paymentStatus === "Paid" ? "success" : "warning"} dot className="text-xs">
                            {foundApp.paymentStatus || "Pending"}
                          </Badge>
                        } />
                        <DetailRow label="Inspection Method" value={foundApp.inspectionMethod === "ON_SITE" ? "On-Site Premises Visit" : "Office Testing Center"} />
                        <DetailRow label="Invoice No." value={foundApp.invoiceNumber || "Pending Generation"} mono />
                        <DetailRow label="Storage Location" value={foundApp.storageFacilityName || "Registered Location"} />
                        <DetailRow label="Date Submitted" value={foundApp.submittedAt || "—"} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Invoice card */}
              {foundInvoice && (
                <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 px-4 py-4 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-amber-50/50 to-white dark:from-amber-950/20 dark:to-[#121212]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xs font-mono font-extrabold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 px-3 py-1 rounded-lg">
                          {foundInvoice.invoiceNumber}
                        </span>
                        <Badge variant="gold" className="px-3 py-1 text-xs">DVLA Statutory Invoice</Badge>
                      </div>
                      <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100">Active Vehicle Layoff Invoice &amp; Fee Status</p>
                    </div>
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                      <Button variant="outline" size="sm" onClick={() => setIsInvoiceModalOpen(true)} className="gap-2 font-bold w-full sm:w-auto h-10 sm:h-9 justify-center">
                        <Printer className="h-4 w-4" />
                        Thermal POS Receipt
                      </Button>
                      <Button
                        variant="accent"
                        size="sm"
                        onClick={() => {
                          setExtensionError("");
                          setIsExtensionModalOpen(true);
                        }}
                        className="gap-2 font-bold shadow-md shadow-emerald-900/20 w-full sm:w-auto h-10 sm:h-9 justify-center"
                      >
                        <RotateCcw className="h-4 w-4" />
                        Apply for Layoff Extension
                      </Button>
                    </div>
                  </div>

                  <CardContent className="p-4 sm:p-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-4">
                      {[
                        { label: "Processing Fee", value: `GH₵ ${foundInvoice.amount.toFixed(2)}`, color: "text-[#006837] dark:text-emerald-400" },
                        { label: "Start Date", value: foundInvoice.layoffStartDate, color: "" },
                        { label: "Expiry Date", value: foundInvoice.layoffExpiryDate, color: "text-amber-800 dark:text-amber-400" },
                        { label: "Extension Status", value: foundInvoice.extensionStatus, color: "text-emerald-800 dark:text-emerald-400" },
                      ].map(item => (
                        <div key={item.label} className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/80 dark:bg-zinc-900/70 p-3.5 sm:p-4 space-y-1">
                          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">{item.label}</p>
                          <p className={cn("text-sm sm:text-lg font-black tracking-tight", item.color || "text-slate-900 dark:text-zinc-100")}>{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-slate-200 dark:border-zinc-800">
              <CardContent className="py-10 sm:py-14 text-center space-y-3 px-4">
                <AlertTriangle className="h-9 w-9 sm:h-10 sm:w-10 text-amber-500 mx-auto" />
                <p className="text-base font-bold text-slate-900 dark:text-zinc-100">No Record Found</p>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 max-w-md mx-auto">
                  No layoff application or invoice matched &ldquo;<span className="font-mono font-bold text-slate-800 dark:text-zinc-200">{query}</span>&rdquo;. Please check your reference number and try again.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── STRUCTURED EXTENSION REQUEST MODAL ─── */}
      <Dialog
        isOpen={isExtensionModalOpen}
        onClose={() => setIsExtensionModalOpen(false)}
        title="Statutory Layoff Extension Application"
        description="L.I. 2519 Regulation 28: Apply for an authorized extension of your vehicle's statutory off-road layoff period."
        maxWidth="max-w-lg"
      >
        <div className="space-y-4 p-1 text-slate-800 dark:text-zinc-200">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 text-xs space-y-1">
            <p><strong>Vehicle Registration:</strong> {foundApp?.registrationNumber || foundInvoice?.registrationNumber}</p>
            <p><strong>Current Statutory Expiry:</strong> {currentExpiryStr}</p>
            <p><strong>Proposed New Expiry:</strong> <span className="font-bold text-[#006837] dark:text-emerald-400">{proposedNewExpiry}</span></p>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Extension Period Requested
            </label>
            <Select value={String(extendMonths)} onValueChange={v => setExtendMonths(Number(v))}>
              <SelectTrigger className="h-11 rounded-xl">
                <SelectValue placeholder="Select duration" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">1 Month (GH₵ 75.00)</SelectItem>
                <SelectItem value="2">2 Months (GH₵ 150.00)</SelectItem>
                <SelectItem value="3">3 Months (GH₵ 225.00 - Standard)</SelectItem>
                <SelectItem value="6">6 Months (GH₵ 450.00 - Recommended)</SelectItem>
                <SelectItem value="12">12 Months (GH₵ 900.00 - Maximum)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider mb-2">
              Statutory Reason &amp; Explanation for Extension <span className="text-red-500">*</span>
            </label>
            <textarea
              className="w-full h-24 p-3 text-xs rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-[#006837] outline-none"
              placeholder="State why extension is required (e.g. Awaiting specialized engine overhaul components, continued mechanical immobilisation, protracted travel abroad)..."
              value={extensionReason}
              onChange={e => setExtensionReason(e.target.value)}
            />
          </div>

          {extensionError && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-300 text-xs font-semibold">
              {extensionError}
            </div>
          )}

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs flex justify-between items-center">
            <span className="font-semibold text-emerald-900 dark:text-emerald-200">Extension Statutory Fee:</span>
            <span className="font-mono font-black text-sm text-[#006837] dark:text-emerald-400">GH₵ {calculatedFee.toFixed(2)}</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExtensionModalOpen(false)}
              disabled={isSubmittingExtension}
              className="w-full sm:w-auto h-10 sm:h-9 justify-center"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isSubmittingExtension}
              onClick={handleSubmitExtensionRequest}
              className="px-6 font-bold w-full sm:w-auto h-10 sm:h-9 justify-center bg-[#006837] hover:bg-[#00552d] text-white"
            >
              {isSubmittingExtension ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  Submitting Request...
                </>
              ) : (
                "Submit Extension Request"
              )}
            </Button>
          </div>
        </div>
      </Dialog>

      {/* Official Thermal Receipt / Invoice Modal */}
      {foundInvoice && (
        <Dialog isOpen={isInvoiceModalOpen} onClose={() => setIsInvoiceModalOpen(false)} title="DVLA Official Invoice Receipt" maxWidth="max-w-xl">
          <ThermalReceipt
            invoice={foundInvoice}
            application={foundApp}
            onClose={() => setIsInvoiceModalOpen(false)}
          />
        </Dialog>
      )}

      {/* Official Off-Road Statutory Certificate Modal */}
      {foundApp && (
        <Dialog
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          title="National Vehicle Lay-Off Certificate (L.I. 2519 Regulation 28)"
          maxWidth="max-w-4xl"
        >
          <StatutoryCertificate
            application={foundApp}
            onClose={() => setIsCertificateModalOpen(false)}
            showPrintAction={true}
          />
        </Dialog>
      )}
    </div>
  );
}
