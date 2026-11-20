"use client";

import React, { useState } from "react";
import {
  Search, Download, Eye, XCircle, Check, Clock,
  FileText, History, Filter, User, Car, MapPin, Paperclip,
  Camera, FileCheck, CreditCard, Home, ExternalLink, X,
  Building2, ShieldCheck, Phone, Mail, Calendar, FileSpreadsheet,
  TrendingUp, CheckCircle2, AlertTriangle, Layers, RefreshCw,
  RotateCcw, ArrowRight, CornerDownLeft, Wrench, Printer, Trophy, Award, Scale,
  Users, MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LayoffApplication, Invoice, AuditLog, SMSNotification } from "@/lib/mock-data";
import { ThermalReceipt } from "@/components/thermal-receipt";
import { ActivityTimeline } from "@/components/activity-timeline";
import { UserManagement } from "@/components/user-management";
import { BulkSMSManager } from "@/components/bulk-sms-manager";
import { HelplineManager } from "@/components/helpline-manager";
import { SystemConfigManager } from "@/components/system-config-manager";
import { RecordsDossierView } from "@/components/records-dossier-view";
import { StatutoryCertificate } from "@/components/statutory-certificate";
import { TablePagination } from "@/components/ui/table-pagination";

interface AdminDashboardProps {
  applications: LayoffApplication[];
  invoices: Invoice[];
  auditLogs: AuditLog[];
  smsNotifications: SMSNotification[];
  onRefreshData?: () => void;
  onApproveApplication?: (appId: string, invoice: Invoice) => void;
  onRejectApplication?: (appId: string, reason: string) => void;
  activeSection?: string;
  onSelectSection?: (section: string) => void;
  currentUser?: {
    fullName: string;
    email: string;
    role: string;
    region?: string;
    stationLocation?: string;
    staffId?: string | null;
  } | null;
}

function StatCard({
  label, value, sub, color, icon: Icon,
}: { label: string; value: string | number; sub?: string; color?: string; icon: React.ElementType }) {
  return (
    <div className={cn("rounded-2xl border p-5 space-y-2 shadow-xs transition-all hover:shadow-md relative overflow-hidden flex flex-col justify-between min-h-[120px]", color || "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800")}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">{label}</p>
        <div className="h-9 w-9 rounded-xl bg-slate-100/80 dark:bg-zinc-800/80 border border-slate-200/60 dark:border-zinc-700/60 flex items-center justify-center text-[#006837] dark:text-emerald-400 flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div>
        <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 leading-none tracking-tight">{value}</p>
        {sub && <p className="text-xs text-slate-500 dark:text-zinc-400 font-medium mt-1">{sub}</p>}
      </div>
    </div>
  );
}

export function AdminDashboard({
  applications,
  invoices,
  auditLogs,
  smsNotifications,
  onRefreshData,
  activeSection = "dashboard",
  onSelectSection,
  currentUser,
}: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState("All");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("All");
  const [roadStatusFilter, setRoadStatusFilter] = useState("All");
  const [classificationFilter, setClassificationFilter] = useState("All");
 
  // Table Pagination States
  const [appsPage, setAppsPage] = useState(1);
  const [appsPageSize, setAppsPageSize] = useState(10);

  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(10);

  const [extPage, setExtPage] = useState(1);
  const [extPageSize, setExtPageSize] = useState(10);

  const [auditPage, setAuditPage] = useState(1);
  const [auditPageSize, setAuditPageSize] = useState(15);
  const [auditSearchTerm, setAuditSearchTerm] = useState("");

  const [smsPage, setSmsPage] = useState(1);
  const [smsPageSize, setSmsPageSize] = useState(15);

  const [officersPage, setOfficersPage] = useState(1);
  const [officersPageSize, setOfficersPageSize] = useState(10);

  // Scoped sub-tab switcher states per sidebar section (never navigates to another sidebar page)
  const [userSubTab, setUserSubTab] = useState<"users" | "officers">("users");
  const [appSubTab, setAppSubTab] = useState<"applications" | "extensions">("applications");
  const [smsSubTab, setSmsSubTab] = useState<"campaigns" | "sms">("campaigns");

  // Reset appsPage when filters or search change
  React.useEffect(() => {
    setAppsPage(1);
  }, [searchTerm, appStatusFilter, paymentStatusFilter, roadStatusFilter, classificationFilter]);

  const [selectedApp, setSelectedApp] = useState<LayoffApplication | null>(null);
  const [activeInspectTab, setActiveInspectTab] = useState<"overview" | "inspection" | "photos" | "ipp" | "activity">("overview");
  const [selectedThermalInvoice, setSelectedThermalInvoice] = useState<Invoice | null>(null);

  // Rejection & Return for correction modals
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionText, setRejectionText] = useState("");
  const [isReturningCorrection, setIsReturningCorrection] = useState(false);
  const [correctionText, setCorrectionText] = useState("");

  // Return to Road modal
  const [isReturningToRoad, setIsReturningToRoad] = useState(false);
  const [returnToRoadNotes, setReturnToRoadNotes] = useState("");

  // Action loading states
  const [actionLoading, setActionLoading] = useState(false);

  // File Preview Modal State (Requirement 1 & 6)
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url?: string;
    type?: string;
    category?: string;
    uploadedBy?: string;
    uploadedAt?: string;
  } | null>(null);

  const handleDownloadFile = (fileName: string, url?: string) => {
    const link = document.createElement("a");
    link.href = url || `/api/uploads/${fileName}`;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ─── NATIONAL STATUTORY CERTIFICATE PREVIEW STATE ───
  const [adminCertApp, setAdminCertApp] = useState<any | null>(null);
  const [isAdminCertOpen, setIsAdminCertOpen] = useState(false);

  const handleOpenNationalCertificate = (app: any) => {
    setAdminCertApp(app);
    setIsAdminCertOpen(true);
  };

  // ─── EXTENSION REQUESTS QUEUE (L.I. 2519 Regulation 28) ───
  const [extensionRequests, setExtensionRequests] = useState<any[]>([]);
  const [extActionLoading, setExtActionLoading] = useState<string | null>(null);

  const loadExtensionRequests = React.useCallback(async () => {
    try {
      const res = await fetch("/api/extensions");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) setExtensionRequests(data);
      }
    } catch (err) {
      console.error("Failed to load extension requests:", err);
    }
  }, []);

  React.useEffect(() => {
    loadExtensionRequests();
  }, [loadExtensionRequests]);

  const handleReviewExtension = async (id: string, decision: "Approved" | "Rejected") => {
    let reviewNotes = "Approved pursuant to L.I. 2519 Regulation 28.";
    if (decision === "Rejected") {
      const input = prompt("Please provide statutory reason for rejecting extension request:");
      if (!input || !input.trim()) return;
      reviewNotes = input.trim();
    }

    setExtActionLoading(id);
    try {
      const res = await fetch(`/api/extensions/${id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, reviewNotes }),
      });

      if (res.ok) {
        alert(`Extension request successfully ${decision.toLowerCase()}.`);
        loadExtensionRequests();
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json();
        alert(err.error || "Failed to process extension review.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    } finally {
      setExtActionLoading(null);
    }
  };

  // ─── TOP TECHNICAL OFFICERS RANKING (Requirement 4) ───
  const [rankingPeriod, setRankingPeriod] = useState<"current_month" | "all_time">("current_month");
  const currentMonthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-10"

  const rankedOfficers = React.useMemo(() => {
    // 1. Filter qualifying completed inspections
    // Exclude cancelled, rejected, incomplete, or duplicate records
    const qualifyingApps = applications.filter(app => {
      if (app.inspectionStatus !== "Completed") return false;
      if (app.applicationStatus === "Rejected" || app.status === "Rejected") return false;
      if (rankingPeriod === "current_month") {
        const d = app.inspectionDate || app.submittedAt || "";
        if (!d.startsWith(currentMonthKey)) return false;
      }
      return true;
    });

    // 2. Aggregate per officer
    const officerMap: Record<string, {
      officerId: string;
      officerName: string;
      completedCount: number;
      officeCount: number;
      onSiteCount: number;
      stations: Set<string>;
      latestDate: string;
    }> = {};

    qualifyingApps.forEach(app => {
      const id = app.assignedOfficerId || "TO-GENERIC";
      const name = app.assignedOfficerName || "Technical Officer";

      if (!officerMap[id]) {
        officerMap[id] = {
          officerId: id,
          officerName: name,
          completedCount: 0,
          officeCount: 0,
          onSiteCount: 0,
          stations: new Set<string>(),
          latestDate: "",
        };
      }

      officerMap[id].completedCount += 1;
      if (app.inspectionMethod === "ON_SITE") {
        officerMap[id].onSiteCount += 1;
      } else {
        officerMap[id].officeCount += 1;
      }

      if (app.inspectionOfficeLocation) {
        officerMap[id].stations.add(app.inspectionOfficeLocation);
      }

      const inspDate = app.inspectionDate || "";
      if (!officerMap[id].latestDate || inspDate > officerMap[id].latestDate) {
        officerMap[id].latestDate = inspDate;
      }
    });

    const list = Object.values(officerMap).map(o => ({
      ...o,
      primaryStation: Array.from(o.stations)[0] || "DVLA Regional Station",
      rank: 1,
    }));

    // Sort descending by completed inspections count, then by latest inspection date
    list.sort((a, b) => {
      if (b.completedCount !== a.completedCount) {
        return b.completedCount - a.completedCount;
      }
      return (b.latestDate || "").localeCompare(a.latestDate || "");
    });

    // Handle ties consistently (same completedCount = same rank number)
    let currentRank = 1;
    list.forEach((officer, idx) => {
      if (idx > 0 && officer.completedCount < list[idx - 1].completedCount) {
        currentRank = idx + 1;
      }
      officer.rank = currentRank;
    });

    return list;
  }, [applications, rankingPeriod, currentMonthKey]);

  // Computed KPI metrics
  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const thisMonthStr = now.toISOString().slice(0, 7);

  const totalApps = applications.length;
  const submittedTodayCount = applications.filter(a => (a.submittedAt || "").startsWith(todayStr)).length;
  const submittedMonthCount = applications.filter(a => (a.submittedAt || "").startsWith(thisMonthStr)).length;
  const pendingApprovalCount = applications.filter(a => a.adminApprovalStatus === "Pending").length;
  const approvedCount = applications.filter(a => a.adminApprovalStatus === "Approved").length;
  const rejectedCount = applications.filter(a => a.adminApprovalStatus === "Rejected").length;
  const awaitingPaymentCount = applications.filter(a => a.adminApprovalStatus === "Approved" && a.paymentStatus !== "Paid").length;
  const paidCount = applications.filter(a => a.paymentStatus === "Paid").length;
  const awaitingInspectionCount = applications.filter(a => a.inspectionStatus !== "Completed").length;
  const inspectionsInProgressCount = applications.filter(a => a.inspectionStatus === "In Progress" || a.inspectionStatus === "Assigned").length;
  const inspectionsCompletedCount = applications.filter(a => a.inspectionStatus === "Completed").length;
  const emergencyCount = applications.filter(a => a.isEmergencyMechanicalFailure || (a.emergencyFee && a.emergencyFee > 0)).length;
  const offRoadCount = applications.filter(a => a.vehicleRoadStatus === "Off Road").length;

  const expiringSoonApps = applications.filter(a => {
    if (!a.layoffExpiryDate || a.vehicleRoadStatus !== "Off Road") return false;
    const diff = (new Date(a.layoffExpiryDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 14 && diff >= 0;
  });
  const expiringSoonCount = expiringSoonApps.length;

  const totalFees = invoices.filter(i => i.paymentStatus === "Paid").reduce((acc, i) => acc + i.amount, 0);

  // Regional breakdown
  const regionalCounts: Record<string, number> = {};
  applications.forEach(a => {
    const reg = a.storageRegion || "Greater Accra";
    regionalCounts[reg] = (regionalCounts[reg] || 0) + 1;
  });

  // Reason breakdown
  const reasonCounts: Record<string, number> = {};
  applications.forEach(a => {
    const r = a.reason || "Mechanical Failure";
    reasonCounts[r] = (reasonCounts[r] || 0) + 1;
  });

  const privateCount = applications.filter(a => (a.vehicleUsageClassification || "Private") === "Private").length;
  const commercialCount = applications.filter(a => a.vehicleUsageClassification === "Commercial").length;

  // Filtered applications
  const filteredApps = applications.filter(app => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      app.id.toLowerCase().includes(q) ||
      app.registrationNumber.toLowerCase().includes(q) ||
      app.chassisNumber.toLowerCase().includes(q) ||
      app.applicantName.toLowerCase().includes(q) ||
      (app.ownerName && app.ownerName.toLowerCase().includes(q)) ||
      (app.invoiceNumber && app.invoiceNumber.toLowerCase().includes(q));

    const matchAppStatus =
      appStatusFilter === "All" ||
      (appStatusFilter === "Pending" && app.status.startsWith("Pending")) ||
      app.status === appStatusFilter ||
      app.applicationStatus === appStatusFilter;

    const matchPayment =
      paymentStatusFilter === "All" ||
      app.paymentStatus === paymentStatusFilter;

    const matchRoad =
      roadStatusFilter === "All" ||
      app.vehicleRoadStatus === roadStatusFilter;

    const matchClassification =
      classificationFilter === "All" ||
      app.vehicleUsageClassification === classificationFilter;

    return matchSearch && matchAppStatus && matchPayment && matchRoad && matchClassification;
  });

  // ─── PAGINATED SLICES FOR ENTERPRISE TABLES ───
  const paginatedApps = React.useMemo(() => {
    const start = (appsPage - 1) * appsPageSize;
    return filteredApps.slice(start, start + appsPageSize);
  }, [filteredApps, appsPage, appsPageSize]);

  const paginatedInvoices = React.useMemo(() => {
    const start = (invoicesPage - 1) * invoicesPageSize;
    return invoices.slice(start, start + invoicesPageSize);
  }, [invoices, invoicesPage, invoicesPageSize]);

  const paginatedExtensions = React.useMemo(() => {
    const start = (extPage - 1) * extPageSize;
    return extensionRequests.slice(start, start + extPageSize);
  }, [extensionRequests, extPage, extPageSize]);

  const filteredAuditLogs = React.useMemo(() => {
    const q = auditSearchTerm.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (log) =>
        (log.id || "").toLowerCase().includes(q) ||
        (log.userName || "").toLowerCase().includes(q) ||
        (log.userRole || "").toLowerCase().includes(q) ||
        (log.action || "").toLowerCase().includes(q) ||
        (log.referenceNumber || "").toLowerCase().includes(q) ||
        (log.vehicleReference || "").toLowerCase().includes(q) ||
        (log.processIdentifier || "").toLowerCase().includes(q) ||
        (log.details || "").toLowerCase().includes(q) ||
        (log.timestamp || "").toLowerCase().includes(q)
    );
  }, [auditLogs, auditSearchTerm]);

  const paginatedAuditLogs = React.useMemo(() => {
    const start = (auditPage - 1) * auditPageSize;
    return filteredAuditLogs.slice(start, start + auditPageSize);
  }, [filteredAuditLogs, auditPage, auditPageSize]);

  const paginatedSms = React.useMemo(() => {
    const start = (smsPage - 1) * smsPageSize;
    return smsNotifications.slice(start, start + smsPageSize);
  }, [smsNotifications, smsPage, smsPageSize]);

  const paginatedOfficers = React.useMemo(() => {
    const start = (officersPage - 1) * officersPageSize;
    return rankedOfficers.slice(start, start + officersPageSize);
  }, [rankedOfficers, officersPage, officersPageSize]);

  // ─── ACTION 1: Administrative Approval & IPP Pro Invoice Trigger ───
  const handleApprove = async () => {
    if (!selectedApp) return;
    setActionLoading(true);

    try {
      // 1. Record administrative approval
      await fetch(`/api/applications/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminApprovalStatus: "Approved",
          adminApprovedBy: "Chief Supt. Osei Tutu (DVLA)",
          applicationStatus: "Approved",
          status: "Pending Approval", // Waiting for payment
          verificationOutcome: "Verified",
          actorName: "Chief Supt. Osei Tutu",
          actorRole: "DVLA Administrator",
        }),
      });

      // 2. Generate invoice via IPP Pro
      const invRes = await fetch("/api/ipp-pro/invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          adminUser: "Chief Supt. Osei Tutu",
        }),
      });

      if (invRes.ok) {
        if (onRefreshData) onRefreshData();
        setSelectedApp(null);
      } else {
        const err = await invRes.json();
        alert(`Invoice generation notice: ${err.error}`);
        if (onRefreshData) onRefreshData();
      }
    } catch (err) {
      console.error(err);
      alert("Error approving application.");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── ACTION 2: Reject Application ───
  const handleRejectSubmit = async () => {
    if (!selectedApp || !rejectionText.trim()) return;
    setActionLoading(true);

    try {
      await fetch(`/api/applications/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminApprovalStatus: "Rejected",
          applicationStatus: "Rejected",
          status: "Rejected",
          rejectionReason: rejectionText.trim(),
          actorName: "Chief Supt. Osei Tutu",
          actorRole: "DVLA Administrator",
        }),
      });

      setIsRejecting(false);
      setRejectionText("");
      setSelectedApp(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      alert("Error rejecting application.");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── ACTION 3: Return for Correction ───
  const handleReturnCorrectionSubmit = async () => {
    if (!selectedApp || !correctionText.trim()) return;
    setActionLoading(true);

    try {
      await fetch(`/api/applications/${selectedApp.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminApprovalStatus: "Returned for Correction",
          applicationStatus: "Returned for Correction",
          status: "Requires Correction",
          verificationOutcome: "Requires Correction",
          verificationNote: correctionText.trim(),
          actorName: "Chief Supt. Osei Tutu",
          actorRole: "DVLA Administrator",
        }),
      });

      setIsReturningCorrection(false);
      setCorrectionText("");
      setSelectedApp(null);
      if (onRefreshData) onRefreshData();
    } catch (err) {
      console.error(err);
      alert("Error returning application for correction.");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── ACTION 4: IPP Pro Payment Confirmation & Activation ───
  const handleConfirmPayment = async () => {
    if (!selectedApp) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/ipp-pro/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: selectedApp.id,
          paymentReference: `PAY-IPP-${Date.now().toString().slice(-8)}`,
        }),
      });

      if (res.ok) {
        if (onRefreshData) onRefreshData();
        setSelectedApp(null);
      } else {
        const err = await res.json();
        alert(`Payment confirmation error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error confirming payment.");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── ACTION 5: Retry IPP Pro Data Submission ───
  const handleRetryDataSubmission = async () => {
    if (!selectedApp) return;
    setActionLoading(true);

    try {
      const res = await fetch("/api/ipp-pro/submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: selectedApp.id }),
      });

      if (res.ok) {
        if (onRefreshData) onRefreshData();
        const data = await res.json();
        alert(`IPP Pro Submission Success: ${data.submissionRef}`);
      } else {
        const err = await res.json();
        alert(`IPP Pro Retry Error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error retrying submission.");
    } finally {
      setActionLoading(false);
    }
  };

  // ─── ACTION 6: Formal Return-to-Road ───
  const handleReturnToRoadSubmit = async () => {
    if (!selectedApp) return;
    setActionLoading(true);

    try {
      const res = await fetch(`/api/applications/${selectedApp.id}/return-to-road`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officerName: "Chief Supt. Osei Tutu (DVLA Compliance)",
          notes: returnToRoadNotes.trim() || "Passed re-inspection and statutory return to road compliance.",
        }),
      });

      if (res.ok) {
        setIsReturningToRoad(false);
        setReturnToRoadNotes("");
        setSelectedApp(null);
        if (onRefreshData) onRefreshData();
      } else {
        const err = await res.json();
        alert(`Return to road error: ${err.error}`);
      }
    } catch (err) {
      console.error(err);
      alert("Error returning vehicle to road.");
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-7 animate-fade-in pb-12 w-full flex-1 flex flex-col">
      {/* ─── MODULE 1: USER MANAGEMENT (WITH TOP OFFICERS SWITCHER) ─── */}
      {activeSection === "users" && (
        <Tabs
          value={userSubTab}
          onValueChange={(val) => setUserSubTab(val as "users" | "officers")}
          className="w-full flex-1 flex flex-col"
        >
          <TabsList className="bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl h-auto sm:h-14 w-full sm:w-auto self-start border border-slate-200/60 dark:border-zinc-800 overflow-x-auto flex-nowrap scrollbar-none">
            <TabsTrigger value="users" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
              <Users className="h-4 w-4" />
              User Management
            </TabsTrigger>
            <TabsTrigger value="officers" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
              <Trophy className="h-4 w-4 text-amber-500" />
              Top Officers ({rankedOfficers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-4 sm:mt-5 flex-1 flex flex-col">
            <UserManagement />
          </TabsContent>

          <TabsContent value="officers" className="mt-4 sm:mt-5 flex-1 flex flex-col">
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex-1 flex flex-col">
              {/* Header Toolbar */}
              <div className="p-4 sm:p-5 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-amber-500" />
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                      Top Technical Officers Leaderboard
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                    Ranked technical officers based on completed &amp; submitted physical vehicle inspections. Cancelled and rejected records are excluded.
                  </p>
                </div>

                {/* Ranking Period Selector */}
                <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 self-stretch sm:self-auto">
                  <button
                    type="button"
                    onClick={() => setRankingPeriod("current_month")}
                    className={cn(
                      "flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                      rankingPeriod === "current_month"
                        ? "bg-[#006837] text-white shadow-xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                    )}
                  >
                    Current Month ({new Date().toLocaleString("default", { month: "short", year: "numeric" })})
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingPeriod("all_time")}
                    className={cn(
                      "flex-1 sm:flex-none px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all",
                      rankingPeriod === "all_time"
                        ? "bg-[#006837] text-white shadow-xs"
                        : "text-slate-600 dark:text-zinc-400 hover:text-slate-900"
                    )}
                  >
                    Overall (All Time)
                  </button>
                </div>
              </div>

              {/* Top 3 Podium Cards */}
              {rankedOfficers.length > 0 && (
                <div className="p-4 sm:p-6 bg-slate-50/50 dark:bg-zinc-900/40 border-b border-slate-100 dark:border-zinc-800">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
                    {rankedOfficers.slice(0, 3).map((officer) => {
                      const isGold = officer.rank === 1;
                      const isSilver = officer.rank === 2;
                      const isBronze = officer.rank === 3;

                      return (
                        <div
                          key={officer.officerId}
                          className={cn(
                            "relative rounded-2xl p-4 sm:p-5 border transition-all flex flex-col justify-between",
                            isGold && "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-zinc-900 border-amber-300 dark:border-amber-700 shadow-sm",
                            isSilver && "bg-gradient-to-br from-slate-50 to-slate-100/60 dark:from-zinc-800/60 dark:to-zinc-900 border-slate-300 dark:border-zinc-700 shadow-xs",
                            isBronze && "bg-gradient-to-br from-orange-50 to-orange-100/40 dark:from-orange-950/30 dark:to-zinc-900 border-orange-300 dark:border-orange-800 shadow-xs",
                            !isGold && !isSilver && !isBronze && "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800"
                          )}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "h-8 w-8 rounded-xl flex items-center justify-center font-black text-xs shadow-xs",
                                isGold && "bg-amber-400 text-amber-950",
                                isSilver && "bg-slate-300 text-slate-900",
                                isBronze && "bg-orange-300 text-orange-950",
                                !isGold && !isSilver && !isBronze && "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300"
                              )}>
                                #{officer.rank}
                              </span>
                              <div>
                                <p className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 leading-tight">
                                  {officer.officerName}
                                </p>
                                <p className="text-[10px] font-mono font-bold text-slate-500">
                                  {officer.officerId}
                                </p>
                              </div>
                            </div>
                            {isGold && <Award className="h-6 w-6 text-amber-500 shrink-0" />}
                          </div>

                          <div className="mt-4 pt-3 border-t border-slate-200/60 dark:border-zinc-800 space-y-1.5 text-xs">
                            <div className="flex justify-between items-baseline">
                              <span className="text-slate-500 text-[11px]">Completed Inspections:</span>
                              <span className="text-xl font-black font-mono text-[#006837] dark:text-emerald-400">
                                {officer.completedCount}
                              </span>
                            </div>
                            <div className="flex justify-between text-[11px] text-slate-500">
                              <span>Office: <strong>{officer.officeCount}</strong></span>
                              <span>On-Site: <strong>{officer.onSiteCount}</strong></span>
                            </div>
                            <p className="text-[10px] text-slate-400 truncate pt-0.5">
                              Station: {officer.primaryStation}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Detailed Ranked Table */}
              <div className="overflow-x-auto">
                {rankedOfficers.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 text-xs">
                    <Trophy className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                    <p className="font-bold text-sm text-slate-600 dark:text-zinc-400">No qualifying inspection records found for this period</p>
                    <p className="text-[11px] mt-1">Inspections must be completed by a technical officer to qualify.</p>
                  </div>
                ) : (
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      <tr>
                        <th className="py-3 px-4">Rank</th>
                        <th className="py-3 px-4">Technical Officer</th>
                        <th className="py-3 px-4">Officer Identifier</th>
                        <th className="py-3 px-4">Completed Inspections</th>
                        <th className="py-3 px-4">Office vs On-Site</th>
                        <th className="py-3 px-4">Primary Station</th>
                        <th className="py-3 px-4">Last Activity Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-[#121212]">
                      {paginatedOfficers.map(officer => (
                        <tr key={officer.officerId} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4">
                            <span className={cn(
                              "inline-flex items-center justify-center h-6 w-8 rounded-lg font-black text-xs",
                              officer.rank === 1 && "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 font-extrabold",
                              officer.rank === 2 && "bg-slate-200 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300",
                              officer.rank === 3 && "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-300",
                              officer.rank > 3 && "text-slate-600 dark:text-zinc-400"
                            )}>
                              #{officer.rank}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-900 dark:text-zinc-100">
                            {officer.officerName}
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-slate-500">
                            {officer.officerId}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-sm text-[#006837] dark:text-emerald-400">
                            {officer.completedCount}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-400">
                            <span className="font-semibold text-slate-900 dark:text-zinc-100">{officer.officeCount}</span> Office /{" "}
                            <span className="font-semibold text-slate-900 dark:text-zinc-100">{officer.onSiteCount}</span> On-Site
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-300 truncate max-w-xs">
                            {officer.primaryStation}
                          </td>
                          <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                            {officer.latestDate || "Recent"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              <TablePagination
                currentPage={officersPage}
                totalItems={rankedOfficers.length}
                pageSize={officersPageSize}
                onPageChange={setOfficersPage}
                onPageSizeChange={setOfficersPageSize}
                itemLabel="technical officers"
              />
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ─── MODULE 2: BULK SMS CAMPAIGNS & SMS LOGS ─── */}
      {activeSection === "bulk-sms" && (
        <Tabs
          value={smsSubTab}
          onValueChange={(val) => setSmsSubTab(val as "campaigns" | "sms")}
          className="w-full flex-1 flex flex-col"
        >
          <TabsList className="bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl h-auto sm:h-14 w-full sm:w-auto self-start border border-slate-200/60 dark:border-zinc-800 overflow-x-auto flex-nowrap scrollbar-none">
            <TabsTrigger value="campaigns" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
              <MessageSquare className="h-4 w-4" />
              Bulk SMS Campaigns
            </TabsTrigger>
            <TabsTrigger value="sms" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
              <Phone className="h-4 w-4" />
              SMS Logs ({smsNotifications.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="campaigns" className="mt-4 sm:mt-5 flex-1 flex flex-col">
            <BulkSMSManager />
          </TabsContent>

          <TabsContent value="sms" className="mt-4 sm:mt-5">
            <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
              <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-800 font-bold text-xs uppercase tracking-wider text-slate-500">
                Automated SMS Dispatch Log &amp; Expiry Notices
              </div>

              {/* Mobile SMS Card List (block md:hidden) */}
              <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800 p-3 space-y-3">
                {smsNotifications.length === 0 ? (
                  <div className="py-8 text-center text-slate-400 font-medium text-xs">No SMS dispatches recorded yet.</div>
                ) : (
                  paginatedSms.map(sms => (
                    <div key={sms.id} className="pt-3 first:pt-0 space-y-1.5 bg-slate-50/60 dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono text-slate-400 text-[10px]">{sms.id}</span>
                        <Badge variant="success" dot className="text-[10px]">{sms.status}</Badge>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">{sms.recipientPhone}</span>
                        <Badge variant="info" className="text-[10px]">{sms.event}</Badge>
                      </div>
                      <p className="text-[10px] text-slate-400">Sent: {sms.sentAt}</p>
                      <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-700/60">{sms.message}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Desktop SMS Table View (hidden md:block) */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">SMS ID</th>
                      <th className="py-3 px-4">Recipient Phone</th>
                      <th className="py-3 px-4">Event Trigger</th>
                      <th className="py-3 px-4">Sent At</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Message Payload</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-[#121212]">
                    {paginatedSms.map(sms => (
                      <tr key={sms.id} className="hover:bg-slate-50/50">
                        <td className="py-3 px-4 font-mono text-slate-400">{sms.id}</td>
                        <td className="py-3 px-4 font-bold text-slate-900 dark:text-zinc-100">{sms.recipientPhone}</td>
                        <td className="py-3 px-4">
                          <Badge variant="info" className="text-[10px]">{sms.event}</Badge>
                        </td>
                        <td className="py-3 px-4 text-slate-500">{sms.sentAt}</td>
                        <td className="py-3 px-4">
                          <Badge variant="success" dot className="text-[10px]">{sms.status}</Badge>
                        </td>
                        <td className="py-3 px-4 max-w-md truncate text-slate-700 dark:text-zinc-300">{sms.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={smsPage}
                totalItems={smsNotifications.length}
                pageSize={smsPageSize}
                onPageChange={setSmsPage}
                onPageSizeChange={setSmsPageSize}
                pageSizeOptions={[15, 30, 50, 100]}
                itemLabel="SMS notifications"
              />
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* ─── MODULE 3: HELPLINE & ENQUIRIES ─── */}
      {activeSection === "helpline" && <HelplineManager />}

      {/* ─── MODULE 4: SYSTEM CONFIGURATION ─── */}
      {activeSection === "config" && <SystemConfigManager />}

      {/* ─── MODULE: RECORDS HUB ─── */}
      {activeSection === "records" && (
        <div className="space-y-4">
          <RecordsDossierView isEmbeddedInAdmin={true} />
        </div>
      )}

      {/* ─── MODULE 5: EXECUTIVE COMMAND DASHBOARD (Section 3.1) ─── */}
      {activeSection === "dashboard" && (
        <div className="space-y-6">
          {/* Admin Dashboard Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="h-3 w-3 rounded-full bg-[#006837] inline-block shadow-sm" />
                <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                  Vehicle Layoff Admin Dashboard
                </h2>
              </div>
              <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">
                Manage vehicle layoff applications, regional inspections, payments, and road status records.
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <Badge variant="success" dot className="px-3.5 py-1.5 text-xs font-semibold">
                Administrator
              </Badge>
              {onRefreshData && (
                <Button variant="outline" size="sm" onClick={onRefreshData} className="rounded-xl text-xs gap-1.5 h-9">
                  <RefreshCw className="h-3.5 w-3.5" />
                  <span>Sync Data</span>
                </Button>
              )}
            </div>
          </div>

          {/* 4-Card Executive KPI Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Total Applications"
              value={totalApps}
              sub={`${submittedMonthCount} submitted this month`}
              icon={Layers}
            />
            <StatCard
              label="Awaiting Approval"
              value={pendingApprovalCount}
              sub="Pending administrative review"
              icon={Clock}
              color="bg-amber-50/70 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/60"
            />
            <StatCard
              label="Pending Inspections"
              value={awaitingInspectionCount}
              sub={`${inspectionsCompletedCount} inspections completed`}
              icon={Wrench}
              color="bg-blue-50/60 dark:bg-zinc-900 border-blue-200 dark:border-zinc-800"
            />
            <StatCard
              label="Vehicles Off-Road"
              value={offRoadCount}
              sub={`GH₵ ${totalFees.toFixed(0)} revenue collected`}
              icon={ShieldCheck}
              color="bg-emerald-50/60 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60"
            />
          </div>

          {/* Charts & Visual Analytics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Regional Case Breakdown */}
            <Card className="p-5 border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#006837]" />
                Applications by Regional Area
              </h4>
              <div className="space-y-2.5 pt-1">
                {Object.entries(regionalCounts).map(([reg, count]) => {
                  const pct = Math.round((count / (totalApps || 1)) * 100);
                  return (
                    <div key={reg} className="space-y-1">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="text-slate-700 dark:text-zinc-300">{reg}</span>
                        <span className="text-slate-500 font-mono">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 w-full bg-slate-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                        <div className="h-full bg-[#006837] rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* Vehicle Usage Breakdown */}
            <Card className="p-5 border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <Car className="h-4 w-4 text-emerald-600" />
                Vehicle Classification &amp; Cutoff Rule
              </h4>
              <div className="space-y-3 pt-1">
                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-zinc-100">Private Vehicles</span>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold">{privateCount} cases</Badge>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-600 rounded-full" style={{ width: `${Math.round((privateCount / (totalApps || 1)) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400">Statutory roadworthiness requirement: strictly &gt; 3 calendar months</p>
                </div>

                <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-extrabold text-slate-900 dark:text-zinc-100">Commercial Vehicles</span>
                    <Badge variant="outline" className="text-[10px] font-mono font-bold">{commercialCount} cases</Badge>
                  </div>
                  <div className="h-2 w-full bg-slate-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-amber-600 rounded-full" style={{ width: `${Math.round((commercialCount / (totalApps || 1)) * 100)}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400">Statutory roadworthiness requirement: strictly &gt; 2 calendar months</p>
                </div>
              </div>
            </Card>

            {/* Layoff Reasons Breakdown */}
            <Card className="p-5 border-slate-200 dark:border-zinc-800 shadow-xs space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                Layoff Reason Distribution
              </h4>
              <div className="space-y-2 pt-1">
                {Object.entries(reasonCounts).map(([reason, count]) => (
                  <div key={reason} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 text-xs">
                    <span className="font-bold text-slate-800 dark:text-zinc-200 truncate pr-2">{reason}</span>
                    <Badge variant="outline" className="text-[10px] font-mono font-black">{count}</Badge>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* High Priority Operational Decision Queues (Section 3.1) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Urgent: Pending Administrative Approval */}
            <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="p-4 bg-amber-500/10 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-amber-900 dark:text-amber-300 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-600" />
                  Action Required: Awaiting Administrative Approval ({pendingApprovalCount})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAppStatusFilter("Pending");
                    if (onSelectSection) onSelectSection("applications");
                  }}
                  className="h-7 text-[10px] rounded-lg"
                >
                  View All
                </Button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {applications
                  .filter(a => a.adminApprovalStatus === "Pending")
                  .slice(0, 4)
                  .map(app => (
                    <div key={app.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">{app.registrationNumber}</span>
                          <span className="font-mono text-[10px] text-slate-400">({app.id})</span>
                          {app.isEmergencyMechanicalFailure && (
                            <Badge variant="danger" className="text-[9px]">Emergency</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {app.applicantName} • {app.vehicleType} • Reason: {app.reason}
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => setSelectedApp(app)}
                        className="h-8 rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white shrink-0"
                      >
                        Inspect &amp; Review
                      </Button>
                    </div>
                  ))}
              </div>
            </Card>

            {/* Expiring Layoffs Within 14 Days */}
            <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs">
              <div className="p-4 bg-emerald-500/10 border-b border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
                <h4 className="text-xs font-black uppercase tracking-wider text-emerald-900 dark:text-emerald-300 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-[#006837]" />
                  Active Layoffs Approaching Expiry ({expiringSoonCount})
                </h4>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setAppStatusFilter("Active Layoff");
                    if (onSelectSection) onSelectSection("applications");
                  }}
                  className="h-7 text-[10px] rounded-lg"
                >
                  View Active
                </Button>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                {expiringSoonApps.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400">
                    No active vehicle layoff periods expiring in the next 14 days.
                  </div>
                ) : (
                  expiringSoonApps.slice(0, 4).map(app => (
                    <div key={app.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">{app.registrationNumber}</span>
                          <span className="font-mono text-[10px] text-slate-400">({app.id})</span>
                          <Badge variant="warning" className="text-[9px]">Expires: {app.layoffExpiryDate}</Badge>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {app.applicantName} • {app.applicantPhone} • Off-Road Status
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedApp(app)}
                        className="h-8 rounded-xl text-xs font-semibold shrink-0"
                      >
                        View Case
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* ─── APPLICATIONS, INVOICES & AUDIT WORKSPACE (Sections 3 & 4) ─── */}
      {(activeSection === "applications" || activeSection === "invoices" || activeSection === "audit") && (
      <Tabs
        defaultValue={activeSection === "invoices" ? "invoices" : activeSection === "audit" ? "audit" : appSubTab}
        value={activeSection === "invoices" ? "invoices" : activeSection === "audit" ? "audit" : appSubTab}
        onValueChange={(val) => {
          if (activeSection === "applications" && (val === "applications" || val === "extensions")) {
            setAppSubTab(val);
          }
        }}
        className="w-full flex-1 flex flex-col"
      >
        <TabsList className="bg-slate-100 dark:bg-zinc-900 p-1.5 rounded-2xl h-auto sm:h-14 w-full sm:w-auto self-start border border-slate-200/60 dark:border-zinc-800 overflow-x-auto flex-nowrap scrollbar-none">
          {activeSection === "applications" && (
            <>
              <TabsTrigger value="applications" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
                <FileText className="h-4 w-4" />
                Applications ({totalApps})
              </TabsTrigger>
              <TabsTrigger value="extensions" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
                <RotateCcw className="h-4 w-4 text-purple-600" />
                Extensions ({extensionRequests.filter(e => e.status === "Pending" || e.status === "Pending Review").length})
              </TabsTrigger>
            </>
          )}
          {activeSection === "invoices" && (
            <TabsTrigger value="invoices" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
              <FileSpreadsheet className="h-4 w-4" />
              Invoices ({invoices.length})
            </TabsTrigger>
          )}
          {activeSection === "audit" && (
            <TabsTrigger value="audit" className="gap-2 px-3.5 sm:px-5 py-2 text-xs sm:text-sm font-bold whitespace-nowrap flex-shrink-0">
              <History className="h-4 w-4" />
              Audit Trail ({auditLogs.length})
            </TabsTrigger>
          )}
        </TabsList>

        {/* ─── APPLICATIONS TABLE TAB (Section 20) ─── */}
        <TabsContent value="applications" className="mt-4 sm:mt-5 flex-1 flex flex-col">
          <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-sm flex-1 flex flex-col">
            {/* Filter Toolbar */}
            <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  className="h-10 pl-10 text-xs rounded-xl"
                  placeholder="Search Ref, Reg, VIN, Owner, Inv..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2 text-xs w-full sm:w-auto">
                {/* Status Filter */}
                <Select value={appStatusFilter} onValueChange={setAppStatusFilter}>
                  <SelectTrigger className="w-full sm:w-36 h-9 text-xs rounded-xl">
                    <SelectValue placeholder="App Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All App Status</SelectItem>
                    <SelectItem value="Pending">Pending Review</SelectItem>
                    <SelectItem value="Active Layoff">Active Layoff</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                  </SelectContent>
                </Select>

                {/* Payment Status Filter (Section 10.1) */}
                <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32 h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Payments</SelectItem>
                    <SelectItem value="Pending">Payment: Pending</SelectItem>
                    <SelectItem value="Paid">Payment: Paid</SelectItem>
                  </SelectContent>
                </Select>

                {/* Road Status Filter (Section 13) */}
                <Select value={roadStatusFilter} onValueChange={setRoadStatusFilter}>
                  <SelectTrigger className="w-full sm:w-32 h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Road Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Road Status</SelectItem>
                    <SelectItem value="On Road">On Road</SelectItem>
                    <SelectItem value="Off Road">Off Road</SelectItem>
                  </SelectContent>
                </Select>

                {/* Vehicle Classification Filter (Section 4) */}
                <Select value={classificationFilter} onValueChange={setClassificationFilter}>
                  <SelectTrigger className="w-full sm:w-32 h-9 text-xs rounded-xl">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">All Classes</SelectItem>
                    <SelectItem value="Private">Private</SelectItem>
                    <SelectItem value="Commercial">Commercial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mobile Card List (block md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800 p-3 space-y-3">
              {filteredApps.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-medium text-xs">
                  No applications matching the specified criteria.
                </div>
              ) : (
                paginatedApps.map(app => {
                  const isOffRoad = app.vehicleRoadStatus === "Off Road";
                  const isPaid = app.paymentStatus === "Paid";

                  return (
                    <div key={app.id} className="pt-3 first:pt-0 space-y-2.5 bg-slate-50/60 dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-mono text-[11px] font-bold text-slate-400 block">{app.id}</span>
                          <span className="text-base font-extrabold text-[#006837] dark:text-emerald-400 leading-tight block">{app.registrationNumber}</span>
                          <span className="text-xs text-slate-500 font-medium block">{app.make} {app.model}</span>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1",
                            isOffRoad
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                              : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                          )}>
                            <span className={cn("h-1.5 w-1.5 rounded-full", isOffRoad ? "bg-amber-500" : "bg-emerald-500")} />
                            {app.vehicleRoadStatus || "On Road"}
                          </span>
                          <Badge variant={app.status === "Active Layoff" ? "success" : app.status === "Rejected" ? "danger" : "info"} className="text-[10px]">
                            {app.status}
                          </Badge>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-white dark:bg-zinc-800/60 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-700/60">
                        <div>
                          <span className="text-slate-400 block">Owner:</span>
                          <span className="font-semibold text-slate-800 dark:text-zinc-200 truncate block">
                            {app.ownerName || app.applicantName}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Chassis:</span>
                          <span className="font-mono text-slate-700 dark:text-zinc-300 truncate block">
                            {app.chassisNumber}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Payment:</span>
                          <Badge variant={isPaid ? "success" : "warning"} dot className="text-[10px] font-bold mt-0.5">
                            {app.paymentStatus || "Pending"}
                          </Badge>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Inspection:</span>
                          <span className="font-semibold text-slate-700 dark:text-zinc-300 block truncate">
                            {app.inspectionMethod === "ON_SITE" ? "On-Site" : "Office"} ({app.inspectionStatus || "Pending"})
                          </span>
                        </div>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedApp(app);
                          setActiveInspectTab("overview");
                        }}
                        className="w-full text-xs h-9 rounded-xl font-bold gap-1.5 justify-center shadow-xs"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Inspect &amp; Review Application
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View Container (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto flex-1">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-zinc-900/80 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-zinc-400">
                  <tr>
                    <th className="py-3 px-4">Ref Number</th>
                    <th className="py-3 px-4">Registration</th>
                    <th className="py-3 px-4">Chassis / VIN</th>
                    <th className="py-3 px-4">Registered Owner</th>
                    <th className="py-3 px-4">Applicant / Rep</th>
                    <th className="py-3 px-4">Class</th>
                    <th className="py-3 px-4">Roadworthiness</th>
                    <th className="py-3 px-4">Method &amp; Inspection</th>
                    <th className="py-3 px-4">App Status</th>
                    <th className="py-3 px-4">Approval</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4">IPP Pro Data</th>
                    <th className="py-3 px-4">Vehicle Road Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-[#121212]">
                  {filteredApps.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-400 font-medium">
                        No applications matching the specified criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedApps.map(app => {
                      const isOffRoad = app.vehicleRoadStatus === "Off Road";
                      const isPaid = app.paymentStatus === "Paid";
                      const isApproved = app.adminApprovalStatus === "Approved";

                      return (
                        <tr key={app.id} className="hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-zinc-100">{app.id}</td>
                          <td className="py-3 px-4 font-extrabold text-[#006837] dark:text-emerald-400">{app.registrationNumber}</td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-400">{app.chassisNumber}</td>
                          <td className="py-3 px-4 font-semibold text-slate-900 dark:text-zinc-100">{app.ownerName || app.applicantName}</td>
                          <td className="py-3 px-4">
                            {app.applicantType === "REPRESENTATIVE" ? (
                              <span className="text-amber-800 dark:text-amber-400 font-bold">
                                {app.representativeName || app.applicantName} (Rep)
                              </span>
                            ) : (
                              <span className="text-slate-500">Same as Owner</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300">
                              {app.vehicleUsageClassification || "Private"}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-slate-600 dark:text-zinc-400">{app.roadworthinessExpiryDate || "N/A"}</span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex flex-col">
                              <span className="font-semibold text-slate-800 dark:text-zinc-200">
                                {app.inspectionMethod === "ON_SITE" ? "On-Site" : "Office"}
                              </span>
                              <span className="text-[10px] text-slate-500">{app.inspectionStatus || "Pending"}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={app.status === "Active Layoff" ? "success" : app.status === "Rejected" ? "danger" : "info"} className="text-[10px]">
                              {app.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={isApproved ? "success" : app.adminApprovalStatus === "Rejected" ? "danger" : "warning"} className="text-[10px]">
                              {app.adminApprovalStatus || "Pending"}
                            </Badge>
                          </td>
                          {/* Dedicated Payment Status Column (Section 10.1) */}
                          <td className="py-3 px-4">
                            <Badge variant={isPaid ? "success" : "warning"} dot className="text-[10px] font-bold">
                              {app.paymentStatus || "Pending"}
                            </Badge>
                          </td>
                          {/* IPP Pro Submission Status (Section 11) */}
                          <td className="py-3 px-4">
                            <span className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded",
                              app.ippProSubmissionStatus === "Succeeded" && "bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300",
                              app.ippProSubmissionStatus === "Failed" && "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300",
                              (!app.ippProSubmissionStatus || app.ippProSubmissionStatus === "Not Started") && "bg-slate-100 dark:bg-zinc-800 text-slate-500"
                            )}>
                              {app.ippProSubmissionStatus || "Not Started"}
                            </span>
                          </td>
                          {/* Authoritative Vehicle Road Status (Section 13) */}
                          <td className="py-3 px-4">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider inline-flex items-center gap-1",
                              isOffRoad
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700"
                                : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700"
                            )}>
                              <span className={cn("h-1.5 w-1.5 rounded-full", isOffRoad ? "bg-amber-500" : "bg-emerald-500")} />
                              {app.vehicleRoadStatus || "On Road"}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedApp(app);
                                setActiveInspectTab("overview");
                              }}
                              className="text-xs h-8 rounded-xl font-bold gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Inspect &amp; Review
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={appsPage}
              totalItems={filteredApps.length}
              pageSize={appsPageSize}
              onPageChange={setAppsPage}
              onPageSizeChange={setAppsPageSize}
              itemLabel="applications"
            />
          </Card>
        </TabsContent>

        {/* ─── IPP PRO INVOICES TAB ─── */}
        <TabsContent value="invoices" className="mt-4 sm:mt-5">
          <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-800 font-bold text-xs uppercase tracking-wider text-slate-500">
              Statutory Layoff Invoices Generated via IPP Pro
            </div>

            {/* Mobile Invoices Card List (block md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800 p-3 space-y-3">
              {invoices.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-medium text-xs">No invoices generated yet.</div>
              ) : (
                paginatedInvoices.map(inv => (
                  <div key={inv.invoiceNumber} className="pt-3 first:pt-0 space-y-2.5 bg-slate-50/60 dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-xs font-bold text-amber-900 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 block w-fit mb-1">
                          {inv.invoiceNumber}
                        </span>
                        <span className="text-sm font-extrabold text-[#006837] dark:text-emerald-400">{inv.registrationNumber}</span>
                        <span className="text-xs text-slate-500 block">{inv.applicantName}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-base font-black text-slate-900 dark:text-zinc-100 block">GH₵ {inv.amount.toFixed(2)}</span>
                        <Badge variant={inv.paymentStatus === "Paid" ? "success" : "warning"} dot className="text-[10px] mt-1">
                          {inv.paymentStatus}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1.5 border-t border-slate-100 dark:border-zinc-800">
                      <span>Date: {inv.invoiceDate}</span>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedThermalInvoice(inv)}
                        className="h-8 text-[11px] gap-1 font-bold text-[#006837] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 rounded-xl"
                      >
                        <Printer className="h-3 w-3" />
                        Thermal POS
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Invoices Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Invoice No</th>
                    <th className="py-3 px-4">Application Ref</th>
                    <th className="py-3 px-4">Vehicle Reg</th>
                    <th className="py-3 px-4">Applicant Name</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">IPP Pro Txn Ref</th>
                    <th className="py-3 px-4">Payment Status</th>
                    <th className="py-3 px-4 text-right">Thermal Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-[#121212]">
                  {paginatedInvoices.map(inv => (
                    <tr key={inv.invoiceNumber} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-zinc-100">{inv.invoiceNumber}</td>
                      <td className="py-3 px-4 font-mono text-slate-600">{inv.applicationId}</td>
                      <td className="py-3 px-4 font-bold text-[#006837] dark:text-emerald-400">{inv.registrationNumber}</td>
                      <td className="py-3 px-4">{inv.applicantName}</td>
                      <td className="py-3 px-4 font-bold text-slate-900 dark:text-zinc-100">GH₵ {inv.amount.toFixed(2)}</td>
                      <td className="py-3 px-4">{inv.invoiceDate}</td>
                      <td className="py-3 px-4 font-mono text-[10px] text-slate-500">{inv.ippProTransactionRef || "IPP-TXN-PREV"}</td>
                      <td className="py-3 px-4">
                        <Badge variant={inv.paymentStatus === "Paid" ? "success" : "warning"} dot className="text-[10px]">
                          {inv.paymentStatus}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedThermalInvoice(inv)}
                          className="h-7 text-[11px] gap-1 font-bold text-[#006837] dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                        >
                          <Printer className="h-3 w-3" />
                          Thermal POS
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={invoicesPage}
              totalItems={invoices.length}
              pageSize={invoicesPageSize}
              onPageChange={setInvoicesPage}
              onPageSizeChange={setInvoicesPageSize}
              itemLabel="invoices"
            />
          </Card>
        </TabsContent>

        {/* ─── EXTENSIONS REVIEW QUEUE TAB (L.I. 2519 Regulation 28) ─── */}
        <TabsContent value="extensions" className="mt-4 sm:mt-5 flex-1 flex flex-col">
          <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden flex-1 flex flex-col">
            <div className="p-4 sm:p-5 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <RotateCcw className="h-5 w-5 text-purple-600" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 tracking-tight">
                    Statutory Layoff Extension Adjudication Queue
                  </h3>
                </div>
                <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
                  Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28: Review and approve requested layoff period extensions. Approved extensions generate IPP Pro statutory invoices.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="gold" className="text-xs font-bold px-3 py-1">
                  {extensionRequests.filter(e => e.status === "Pending" || e.status === "Pending Review").length} Pending Review
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={loadExtensionRequests}
                  className="rounded-xl text-xs gap-1.5 h-8"
                >
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto flex-1">
              {extensionRequests.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs">
                  <RotateCcw className="h-10 w-10 text-slate-300 dark:text-zinc-600 mx-auto mb-2" />
                  <p className="font-bold text-sm text-slate-600 dark:text-zinc-400">No extension requests recorded</p>
                  <p className="text-[11px] mt-1">Applications requesting layoff extensions will appear here for administrative adjudication.</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <tr>
                      <th className="py-3 px-4">Request Ref</th>
                      <th className="py-3 px-4">App Ref</th>
                      <th className="py-3 px-4">Vehicle Reg</th>
                      <th className="py-3 px-4">Owner / Applicant</th>
                      <th className="py-3 px-4">Requested Period</th>
                      <th className="py-3 px-4">New Expiry Date</th>
                      <th className="py-3 px-4">Fee Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Payment</th>
                      <th className="py-3 px-4">Reason / Notes</th>
                      <th className="py-3 px-4 text-right">Adjudication Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-[#121212]">
                    {paginatedExtensions.map(req => {
                      const isPending = req.status === "Pending" || req.status === "Pending Review";
                      const isActioning = extActionLoading === req.id;

                      return (
                        <tr key={req.id} className="hover:bg-slate-50/50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-900 dark:text-zinc-100">
                            {req.id.slice(-8)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-600 dark:text-zinc-400">
                            {req.applicationId}
                          </td>
                          <td className="py-3 px-4 font-extrabold text-[#006837] dark:text-emerald-400">
                            {req.application?.registrationNumber || "—"}
                          </td>
                          <td className="py-3 px-4 text-slate-800 dark:text-zinc-200">
                            {req.application?.applicantName || "—"}
                          </td>
                          <td className="py-3 px-4 font-bold text-purple-700 dark:text-purple-400">
                            +{req.requestedMonths || req.requestedPeriodMonths || 3} Months
                          </td>
                          <td className="py-3 px-4 font-mono font-semibold text-rose-600 dark:text-rose-400">
                            {req.newExpiryDate || req.proposedNewExpiryDate || "—"}
                          </td>
                          <td className="py-3 px-4 font-mono font-black text-slate-900 dark:text-zinc-100">
                            GH₵ {(req.calculatedFee ?? req.feeAmount ?? 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={req.status === "Approved" ? "success" : req.status === "Rejected" ? "danger" : "warning"}
                              className="text-[10px]"
                            >
                              {req.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={req.paymentStatus === "Paid" ? "success" : "warning"}
                              className="text-[10px]"
                            >
                              {req.paymentStatus || "Pending"}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-zinc-400 max-w-xs truncate" title={req.reviewComments || req.reason}>
                            {req.reviewComments || req.reason || "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isActioning}
                                  onClick={() => handleReviewExtension(req.id, "Approved")}
                                  className="h-7 text-[11px] font-bold bg-[#006837] hover:bg-[#00552d] text-white rounded-lg"
                                >
                                  {isActioning ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Approve"}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={isActioning}
                                  onClick={() => handleReviewExtension(req.id, "Rejected")}
                                  className="h-7 text-[11px] font-bold text-rose-600 border-rose-300 hover:bg-rose-50 rounded-lg"
                                >
                                  Reject
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400 font-mono">
                                {req.invoiceNumber || req.reviewedBy || "Reviewed"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <TablePagination
              currentPage={extPage}
              totalItems={extensionRequests.length}
              pageSize={extPageSize}
              onPageChange={setExtPage}
              onPageSizeChange={setExtPageSize}
              itemLabel="extension requests"
            />
          </Card>
        </TabsContent>

        {/* ─── AUDIT TRAIL TAB (Section 15) ─── */}
        <TabsContent value="audit" className="mt-4 sm:mt-5">
          <Card className="border-slate-200 dark:border-zinc-800 shadow-sm overflow-hidden">
            <div className="p-3.5 sm:p-4 bg-white dark:bg-[#121212] border-b border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Immutable Application-Level Audit Logs &amp; Process Governance ({filteredAuditLogs.length})
                </h3>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Search by user name, role, action, reference number, vehicle registration, process, or details.
                </p>
              </div>

              <div className="relative w-full sm:w-96">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={auditSearchTerm}
                  onChange={(e) => {
                    setAuditSearchTerm(e.target.value);
                    setAuditPage(1);
                  }}
                  placeholder="Search audit logs (user, action, ref, vehicle, details)..."
                  className="h-9 pl-10 pr-8 text-xs rounded-xl bg-slate-50 dark:bg-zinc-900"
                />
                {auditSearchTerm && (
                  <button
                    type="button"
                    onClick={() => {
                      setAuditSearchTerm("");
                      setAuditPage(1);
                    }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    title="Clear search"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Mobile Audit Card List (block md:hidden) */}
            <div className="md:hidden divide-y divide-slate-100 dark:divide-zinc-800 p-3 space-y-3">
              {filteredAuditLogs.length === 0 ? (
                <div className="py-8 text-center text-slate-400 font-medium text-xs">No audit logs match your search.</div>
              ) : (
                paginatedAuditLogs.map(log => (
                  <div key={log.id} className="pt-3 first:pt-0 space-y-1.5 bg-slate-50/60 dark:bg-zinc-900/40 p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-slate-400 text-[10px]">{log.id}</span>
                      <span className="font-mono text-slate-400 text-[10px]">{log.timestamp}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-[#006837] dark:text-emerald-400">{log.action}</span>
                      <span className="font-mono text-[11px] text-slate-600 dark:text-zinc-400">{log.referenceNumber}</span>
                    </div>
                    <p className="text-[11px] text-slate-500">By: <strong className="text-slate-800 dark:text-zinc-200">{log.userName}</strong> ({log.userRole})</p>
                    <p className="text-xs text-slate-700 dark:text-zinc-300 leading-relaxed bg-white dark:bg-zinc-800/50 p-2.5 rounded-xl border border-slate-100 dark:border-zinc-700/60 mt-1">{log.details}</p>
                  </div>
                ))
              )}
            </div>

            {/* Desktop Audit Table View (hidden md:block) */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Log ID</th>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Acting User / Role</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Reference</th>
                    <th className="py-3 px-4">Process</th>
                    <th className="py-3 px-4">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/60 bg-white dark:bg-[#121212]">
                  {paginatedAuditLogs.map(log => (
                    <tr key={log.id} className="hover:bg-slate-50/50">
                      <td className="py-3 px-4 font-mono text-slate-400 text-[10px]">{log.id}</td>
                      <td className="py-3 px-4 text-slate-500 font-mono text-[11px]">{log.timestamp}</td>
                      <td className="py-3 px-4">
                        <span className="font-bold text-slate-900 dark:text-zinc-100">{log.userName}</span>
                        <span className="text-[10px] text-slate-500 block">({log.userRole})</span>
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-xs font-bold text-[#006837] dark:text-emerald-400">{log.action}</span>
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-600">{log.referenceNumber}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-zinc-800 font-mono">
                          {log.processIdentifier || "SYSTEM"}
                        </span>
                      </td>
                      <td className="py-3 px-4 max-w-md truncate text-slate-700 dark:text-zinc-300">{log.details}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TablePagination
              currentPage={auditPage}
              totalItems={filteredAuditLogs.length}
              pageSize={auditPageSize}
              onPageChange={setAuditPage}
              onPageSizeChange={setAuditPageSize}
              pageSizeOptions={[15, 30, 50, 100]}
              itemLabel="audit events"
            />
          </Card>
        </TabsContent>
      </Tabs>
      )}

      {/* ─── COMPREHENSIVE APPLICATION REVIEW MODAL (Section 8, 9, 10, 11, 13) ─── */}
      {selectedApp && (
        <Dialog
          isOpen={Boolean(selectedApp)}
          onClose={() => setSelectedApp(null)}
          title={`Adjudication & Inspection Review: ${selectedApp.registrationNumber} (${selectedApp.id})`}
          description="Statutory review console: VRS particulars, owner representation, roadworthiness validity, technical inspection evidence, IPP Pro invoicing, and vehicle road-status."
          maxWidth="max-w-5xl"
        >
          <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 text-slate-800 dark:text-zinc-200">
            {/* Top Status & Road Status Bar */}
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="font-bold text-slate-500">Current Status:</span>
                <Badge variant={selectedApp.status === "Active Layoff" ? "success" : "info"} className="text-xs">
                  {selectedApp.status}
                </Badge>
                <span className="font-bold text-slate-500">Approval:</span>
                <Badge variant={selectedApp.adminApprovalStatus === "Approved" ? "success" : "warning"} className="text-xs">
                  {selectedApp.adminApprovalStatus || "Pending"}
                </Badge>
                <span className="font-bold text-slate-500">Payment:</span>
                <Badge variant={selectedApp.paymentStatus === "Paid" ? "success" : "warning"} dot className="text-xs">
                  {selectedApp.paymentStatus || "Pending"}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">Authoritative Road Status:</span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider inline-flex items-center gap-1.5",
                  selectedApp.vehicleRoadStatus === "Off Road"
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 border border-amber-300"
                    : "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300"
                )}>
                  <span className={cn("h-2 w-2 rounded-full", selectedApp.vehicleRoadStatus === "Off Road" ? "bg-amber-500" : "bg-emerald-500")} />
                  {selectedApp.vehicleRoadStatus || "On Road"}
                </span>
              </div>
            </div>

            {/* Inspect Modal Navigation Tabs */}
            <div className="flex items-center gap-1.5 sm:gap-2 border-b border-slate-200 dark:border-zinc-800 pb-2 overflow-x-auto flex-nowrap scrollbar-none">
              <button
                onClick={() => setActiveInspectTab("overview")}
                className={cn("px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0", activeInspectTab === "overview" ? "bg-[#006837] text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200")}
              >
                1. Vehicle &amp; Owner Overview
              </button>
              <button
                onClick={() => setActiveInspectTab("inspection")}
                className={cn("px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0", activeInspectTab === "inspection" ? "bg-[#006837] text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200")}
              >
                2. Technical Inspection Findings
              </button>
              <button
                onClick={() => setActiveInspectTab("photos")}
                className={cn("px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0", activeInspectTab === "photos" ? "bg-[#006837] text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200")}
              >
                3. Photographs &amp; Documents
              </button>
              <button
                onClick={() => setActiveInspectTab("ipp")}
                className={cn("px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0", activeInspectTab === "ipp" ? "bg-[#006837] text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200")}
              >
                4. IPP Pro &amp; Billing Lifecycle
              </button>
              <button
                onClick={() => setActiveInspectTab("activity")}
                className={cn("px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex-shrink-0 flex items-center gap-1.5", activeInspectTab === "activity" ? "bg-[#006837] text-white" : "text-slate-500 hover:text-slate-900 dark:hover:text-zinc-200")}
              >
                <History className="h-3.5 w-3.5" />
                <span>5. Activity Log &amp; Audit Timeline</span>
              </button>
            </div>

            {/* TAB 1: OVERVIEW */}
            {activeInspectTab === "overview" && (
              <div className="space-y-4 text-xs">
                {/* Vehicle & Roadworthiness Grid */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 border-b pb-2">
                    VRS Technical Particulars &amp; Roadworthiness
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-500">Registration Number</span>
                      <p className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">{selectedApp.registrationNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Chassis VIN</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{selectedApp.chassisNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Make &amp; Model</span>
                      <p className="font-bold">{selectedApp.make} {selectedApp.model} ({selectedApp.yearOfMake})</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Usage Classification</span>
                      <p className="font-bold">{selectedApp.vehicleUsageClassification || "Private"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Roadworthiness Expiry</span>
                      <p className="font-bold text-emerald-600">{selectedApp.roadworthinessExpiryDate || "Verified"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Statutory Cutoff Date</span>
                      <p className="font-semibold text-slate-700 dark:text-zinc-300">{selectedApp.roadworthinessCutoffDate || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Layoff Duration</span>
                      <p className="font-bold">{selectedApp.layoffPeriodMonths} Calendar Months</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Proposed Start Date</span>
                      <p className="font-bold">{selectedApp.proposedStartDate}</p>
                    </div>
                  </div>
                </div>

                {/* Ownership vs Representative Data Grid (Section 3) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Registered Owner (VRS) */}
                  <div className="p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 space-y-2">
                    <h5 className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Registered Owner (VRS Authoritative Record)
                    </h5>
                    <div>
                      <span className="text-slate-500">Owner Name:</span>
                      <p className="font-bold text-slate-900 dark:text-zinc-100">{selectedApp.ownerName || selectedApp.applicantName}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Ghana Card ID:</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-zinc-100">{selectedApp.ownerIdNumber || selectedApp.idNumber}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Contact Telephone:</span>
                      <p className="font-semibold">{selectedApp.ownerPhone || selectedApp.applicantPhone}</p>
                    </div>
                  </div>

                  {/* Representative Details (if applicable) */}
                  <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-2">
                    <h5 className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                      <User className="h-4 w-4" />
                      Applicant / Representative Information
                    </h5>
                    {selectedApp.applicantType === "REPRESENTATIVE" ? (
                      <>
                        <div>
                          <span className="text-slate-500">Representative Name:</span>
                          <p className="font-bold text-amber-950 dark:text-amber-100">{selectedApp.representativeName || selectedApp.applicantName} (Authorized)</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Capacity / Relationship:</span>
                          <p className="font-semibold">{selectedApp.representativeRelationship || "Representative"}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Representative ID:</span>
                          <p className="font-mono font-bold">{selectedApp.representativeIdNumber || "N/A"}</p>
                        </div>
                        <div>
                          <span className="text-slate-500">Representative Phone:</span>
                          <p className="font-semibold">{selectedApp.representativePhone || selectedApp.applicantPhone}</p>
                        </div>
                      </>
                    ) : (
                      <p className="text-slate-500 pt-2 italic">
                        Applicant applied directly as the registered owner. No representative entity recorded.
                      </p>
                    )}
                  </div>
                </div>

                {/* Authoritative Note / Letter of Authorization from Vehicle Owner (Requirement 1) */}
                {selectedApp.applicantType === "REPRESENTATIVE" && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <FileCheck className="h-4 w-4 text-amber-600" />
                        <h5 className="font-extrabold text-amber-950 dark:text-amber-100 text-xs">
                          Authoritative Note / Letter of Authorization from Vehicle Owner
                        </h5>
                      </div>
                      <Badge variant="warning" className="text-[10px]">
                        Mandatory Representative Document
                      </Badge>
                    </div>
                    <p className="text-[11px] text-amber-900 dark:text-amber-300">
                      Mandatory statutory document authorizing representative <strong>{selectedApp.representativeName || selectedApp.applicantName}</strong> to act on behalf of registered vehicle owner <strong>{selectedApp.ownerName}</strong> for off-road layoff under Regulation 48.
                    </p>
                    {(() => {
                      const repDoc = selectedApp.documents?.find(d => d.category === "representative_auth") || {
                        name: "Authoritative_Note_Owner_Consent.pdf",
                        size: "1.2 MB",
                        url: "/api/uploads/Authoritative_Note_Owner_Consent.pdf",
                        type: "PDF",
                      };
                      return (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-amber-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-600" />
                            <div>
                              <p className="font-bold text-xs text-slate-900 dark:text-zinc-100">{repDoc.name}</p>
                              <p className="text-[10px] text-slate-500">{repDoc.size || "1.2 MB"} • Owner Authorization</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewFile({
                                name: repDoc.name,
                                url: repDoc.url || `/api/uploads/${repDoc.name}`,
                                type: repDoc.type || "PDF",
                                category: "Representative Authorization Letter",
                                uploadedBy: selectedApp.applicantName,
                                uploadedAt: selectedApp.submittedAt,
                              })}
                              className="h-8 text-xs gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Document
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleDownloadFile(repDoc.name, repDoc.url)}
                              className="h-8 text-xs gap-1 bg-amber-700 hover:bg-amber-800 text-white"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* Emergency Mechanical Failure Assessment & Additional Fee Banner (Requirement 3) */}
                {selectedApp.isEmergencyMechanicalFailure && (
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <h5 className="font-extrabold text-amber-950 dark:text-amber-100 text-xs">
                          Emergency Mechanical Failure Layoff Assessment
                        </h5>
                      </div>
                      <Badge variant="warning" className="text-[10px]">
                        Emergency Surcharge: GH₵ {(selectedApp.emergencyFee || 200).toFixed(2)}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-amber-900 dark:text-amber-300">
                      {selectedApp.emergencyFeeReason || "Vehicle identified as an acute mechanical failure application. Certificate validity was below the statutory threshold, incurring an emergency processing surcharge."}
                    </p>
                  </div>
                )}

                {/* Storage Facility & Reason */}
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-2">
                  <h5 className="font-bold text-slate-900 dark:text-zinc-100 flex items-center justify-between">
                    <span>Storage Location &amp; Statutory Rationale</span>
                    {selectedApp.reason === "Legal Action" && (
                      <Badge variant="info" className="text-[10px]">
                        Statutory Legal Hold
                      </Badge>
                    )}
                  </h5>
                  <p><strong>Reason:</strong> {selectedApp.reason}</p>
                  <p><strong>Storage Facility:</strong> {selectedApp.storageFacilityName} ({selectedApp.storageRegion})</p>
                  <p className="text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border">
                    {selectedApp.explanation}
                  </p>
                </div>

                {/* Legal Action Statutory Document (Requirement: Legal Document) */}
                {selectedApp.reason === "Legal Action" && (
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-300 dark:border-indigo-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Scale className="h-4 w-4 text-indigo-600" />
                        <h5 className="font-extrabold text-indigo-950 dark:text-indigo-100 text-xs">
                          Legal Action Statutory Document / Court Order
                        </h5>
                      </div>
                      <Badge variant="info" className="text-[10px]">
                        Mandatory Legal Action Notice
                      </Badge>
                    </div>
                    <p className="text-[11px] text-indigo-900 dark:text-indigo-300">
                      Official court injunction, seizure notice, or litigation document submitted to validate statutory immobilisation under Regulation 48.
                    </p>
                    {(() => {
                      const legalDoc = selectedApp.documents?.find(d =>
                        d.category === "legal_document" ||
                        d.name?.toLowerCase().includes("court") ||
                        d.name?.toLowerCase().includes("injunction") ||
                        d.name?.toLowerCase().includes("legal")
                      ) || {
                        name: "High_Court_Injunction_Order.pdf",
                        size: "1.8 MB",
                        url: "/api/uploads/High_Court_Injunction_Order.pdf",
                        type: "PDF",
                      };
                      return (
                        <div className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-zinc-700">
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-indigo-600" />
                            <div>
                              <p className="font-bold text-xs text-slate-900 dark:text-zinc-100">{legalDoc.name}</p>
                              <p className="text-[10px] text-slate-500">{legalDoc.size || "1.8 MB"} • Certified Legal Document</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => setPreviewFile({
                                name: legalDoc.name,
                                url: legalDoc.url || `/api/uploads/${legalDoc.name}`,
                                type: legalDoc.type || "PDF",
                                category: "Legal Action Document",
                                uploadedBy: selectedApp.applicantName,
                                uploadedAt: selectedApp.submittedAt,
                              })}
                              className="h-8 text-xs gap-1"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Document
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              onClick={() => handleDownloadFile(legalDoc.name, legalDoc.url)}
                              className="h-8 text-xs gap-1 bg-indigo-700 hover:bg-indigo-800 text-white"
                            >
                              <Download className="h-3.5 w-3.5" />
                              Download
                            </Button>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: TECHNICAL INSPECTION */}
            {activeInspectTab === "inspection" && (
              <div className="space-y-4 text-xs">
                <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between border-b pb-2">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-amber-600" />
                      Technical Officer Inspection Report
                    </h4>
                    <Badge variant={selectedApp.inspectionStatus === "Completed" ? "success" : "warning"}>
                      {selectedApp.inspectionStatus || "Pending"}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <span className="text-slate-500">Inspection Method</span>
                      <p className="font-bold">{selectedApp.inspectionMethod === "ON_SITE" ? "On-Site Premises Visit" : "Office Testing Center"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Assigned Officer</span>
                      <p className="font-bold">{selectedApp.assignedOfficerName || "Awaiting Assignment"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Inspection Date</span>
                      <p className="font-bold">{selectedApp.inspectionDate || "N/A"}</p>
                    </div>
                    <div>
                      <span className="text-slate-500">Inspection Outcome</span>
                      <p className="font-bold text-[#006837] dark:text-emerald-400">{selectedApp.inspectionOutcome || "Pending Submission"}</p>
                    </div>
                  </div>

                  {selectedApp.inspectionMethod === "ON_SITE" && (
                    <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1">
                      <p className="font-bold text-amber-900 dark:text-amber-200">On-Site Location &amp; Contact</p>
                      <p>{selectedApp.inspectionSiteAddress}, {selectedApp.inspectionSiteArea}</p>
                      <p>Contact: {selectedApp.inspectionContactPerson} ({selectedApp.inspectionContactPhone})</p>
                      {selectedApp.inspectionNotes && <p>Directions: {selectedApp.inspectionNotes}</p>}
                    </div>
                  )}

                  <div>
                    <span className="text-slate-500 font-bold block mb-1">Technical Findings &amp; Observations:</span>
                    <p className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border text-slate-800 dark:text-zinc-200">
                      {selectedApp.inspectionFindings || "No technical findings submitted yet."}
                    </p>
                  </div>

                  {selectedApp.inspectionDefects && (
                    <div>
                      <span className="text-slate-500 font-bold block mb-1">Noted Defects / Compliance Concerns:</span>
                      <p className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 text-red-800 dark:text-red-200">
                        {selectedApp.inspectionDefects}
                      </p>
                    </div>
                  )}
                </div>

                {/* Technical Officer Inspection Evidence Photos */}
                <div>
                  <h5 className="font-bold text-slate-900 dark:text-zinc-100 mb-2">
                    Physical Inspection Evidence (Uploaded by Technical Officer)
                  </h5>
                  {selectedApp.inspectionPhotos && selectedApp.inspectionPhotos.length > 0 ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {selectedApp.inspectionPhotos.map((photo, pIdx) => (
                        <div key={pIdx} className="p-2 rounded-xl border bg-white dark:bg-zinc-900 text-center">
                          <div className="h-20 rounded-lg bg-emerald-50 dark:bg-emerald-950 flex items-center justify-center text-emerald-600 mb-1">
                            <Camera className="h-6 w-6" />
                          </div>
                          <span className="text-[10px] font-bold">Officer Evidence #{pIdx + 1}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No technical officer inspection photos submitted yet.</p>
                  )}
                </div>

                {/* Vehicle Inspection Report Document Section (Requirement 6) */}
                <div className="pt-3 border-t space-y-3">
                  <div className="flex items-center justify-between">
                    <h5 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <FileText className="h-4 w-4 text-emerald-600" />
                      Vehicle Inspection Report Document
                    </h5>
                    {selectedApp.inspectionReportUrl ? (
                      <Badge variant="success" className="text-xs gap-1">
                        <FileCheck className="h-3.5 w-3.5" />
                        Report Uploaded
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="text-xs gap-1">
                        <Clock className="h-3.5 w-3.5" />
                        Report Pending
                      </Badge>
                    )}
                  </div>

                  {selectedApp.inspectionReportUrl ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700">
                      <div className="flex items-center gap-2.5">
                        <FileText className="h-5 w-5 text-emerald-600" />
                        <div>
                          <p className="font-bold text-xs text-slate-900 dark:text-zinc-100">
                            {selectedApp.inspectionReportFileName || "Vehicle_Inspection_Report.pdf"}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Uploaded by: {selectedApp.inspectionReportUploadedBy || selectedApp.assignedOfficerName || "Technical Officer"} •{" "}
                            {selectedApp.inspectionReportUploadedAt ? new Date(selectedApp.inspectionReportUploadedAt).toLocaleString() : "Recently uploaded"}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => setPreviewFile({
                            name: selectedApp.inspectionReportFileName || "Vehicle_Inspection_Report.pdf",
                            url: selectedApp.inspectionReportUrl,
                            type: "PDF",
                            category: "Vehicle Inspection Report",
                            uploadedBy: selectedApp.inspectionReportUploadedBy || selectedApp.assignedOfficerName,
                            uploadedAt: selectedApp.inspectionReportUploadedAt,
                          })}
                          className="h-8 text-xs gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Report
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleDownloadFile(
                            selectedApp.inspectionReportFileName || "Vehicle_Inspection_Report.pdf",
                            selectedApp.inspectionReportUrl
                          )}
                          className="h-8 text-xs gap-1 bg-[#006837] hover:bg-[#00552d] text-white"
                        >
                          <Download className="h-3.5 w-3.5" />
                          Download
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-300">
                      <p className="font-bold">Inspection Report Pending from Technical Officer</p>
                      <p className="text-[11px] mt-0.5 text-slate-600 dark:text-zinc-400">
                        Physical on-site inspection and camera evidence photographs were submitted. The formal vehicle inspection report document is pending upload by the assigned technical officer.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: PHOTOGRAPHS & DOCUMENTS */}
            {activeInspectTab === "photos" && (
              <div className="space-y-4 text-xs">
                {/* 5 Mandatory Applicant Photographs */}
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 mb-2">
                    Applicant Mandatory Initial Photographs (5 Designated Views)
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {["Front View", "Side View", "Rear View", "Engine Bay", "Chassis/VIN"].map((view, idx) => (
                      <div key={idx} className="p-3 rounded-2xl border border-slate-200 dark:border-zinc-800 text-center bg-white dark:bg-zinc-900">
                        <div className="h-20 sm:h-24 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-400 mb-2">
                          <Camera className="h-7 sm:h-8 w-7 sm:w-8 text-emerald-600" />
                        </div>
                        <p className="font-bold text-slate-800 dark:text-zinc-200">{view}</p>
                        <span className="text-[10px] text-emerald-600 font-semibold">✓ Verified Upload</span>
                      </div>
                    ))}
                  </div>
                </div>

                  {/* Attached Documents */}
                  <div className="pt-3 border-t">
                    <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 mb-2">
                      Attached Statutory Documents &amp; Authorizations
                    </h4>
                    <div className="space-y-2">
                      {selectedApp.documents && selectedApp.documents.length > 0 ? (
                        selectedApp.documents.map((doc, dIdx) => (
                          <div key={dIdx} className="flex items-center justify-between p-3 rounded-xl border bg-white dark:bg-zinc-900">
                            <div className="flex items-center gap-2.5">
                              <FileText className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                              <div>
                                <p className="font-bold text-slate-900 dark:text-zinc-100">{doc.name}</p>
                                <p className="text-[10px] text-slate-500">{doc.size || "1.5 MB"} • Category: {doc.category || "Document"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setPreviewFile({
                                  name: doc.name,
                                  url: doc.url || `/api/uploads/${doc.name}`,
                                  type: doc.type || "PDF",
                                  category: doc.category || "Statutory Evidence",
                                  uploadedBy: selectedApp.applicantName,
                                  uploadedAt: selectedApp.submittedAt,
                                })}
                                className="h-7 text-xs gap-1"
                              >
                                <Eye className="h-3 w-3" />
                                View
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => handleDownloadFile(doc.name, doc.url)}
                                className="h-7 text-xs gap-1"
                              >
                                <Download className="h-3 w-3" />
                                Download
                              </Button>
                            </div>
                          </div>
                        ))
                      ) : (
                        <p className="text-slate-400 italic">No additional documents attached.</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

            {/* TAB 4: IPP PRO & BILLING */}
            {activeInspectTab === "ipp" && (
              <div className="space-y-4 text-xs">
                <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-4">
                  <h4 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 border-b pb-2">
                    IPP Pro Integration, Invoicing, and Data Sync Status
                  </h4>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    <div>
                      <span className="text-slate-500">Invoice Number</span>
                      <p className="font-mono font-bold text-slate-900 dark:text-zinc-100 text-sm">
                        {selectedApp.invoiceNumber || "Not Yet Generated"}
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500">Payment Status</span>
                      <div className="pt-1">
                        <Badge variant={selectedApp.paymentStatus === "Paid" ? "success" : "warning"} dot>
                          {selectedApp.paymentStatus || "Pending"}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <span className="text-slate-500">Payment Reference</span>
                      <p className="font-mono font-semibold">{selectedApp.paymentReference || "Awaiting Payment"}</p>
                    </div>

                    <div>
                      <span className="text-slate-500">IPP Pro Data Sync Status</span>
                      <p className="font-bold pt-1">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-xs",
                          selectedApp.ippProSubmissionStatus === "Succeeded" && "bg-emerald-100 text-emerald-800",
                          selectedApp.ippProSubmissionStatus === "Failed" && "bg-red-100 text-red-800",
                          (!selectedApp.ippProSubmissionStatus || selectedApp.ippProSubmissionStatus === "Not Started") && "bg-slate-100 text-slate-600"
                        )}>
                          {selectedApp.ippProSubmissionStatus || "Not Started"}
                        </span>
                      </p>
                    </div>

                    <div>
                      <span className="text-slate-500">IPP Pro Record Ref</span>
                      <p className="font-mono font-semibold">{selectedApp.ippProSubmissionRef || "N/A"}</p>
                    </div>

                    <div>
                      <span className="text-slate-500">Sync Timestamp</span>
                      <p className="text-slate-600">{selectedApp.ippProSubmittedAt || "N/A"}</p>
                    </div>
                  </div>

                  {/* Section 11.3: If IPP Pro Submission Failed, allow safe retry */}
                  {selectedApp.ippProSubmissionStatus === "Failed" && (
                    <div className="p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 space-y-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="text-red-900 dark:text-red-200 font-bold flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 shrink-0" />
                          IPP Pro Application-Data Submission Sync Failed
                        </div>
                        <Button
                          size="sm"
                          onClick={handleRetryDataSubmission}
                          disabled={actionLoading}
                          className="bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold gap-1.5 w-full sm:w-auto"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                          Retry IPP Pro Sync
                        </Button>
                      </div>
                      <p className="text-xs text-red-700 dark:text-red-300">
                        {selectedApp.ippProSubmissionError || "Gateway timeout during data submission. Payment & Active status remain protected."}
                      </p>
                    </div>
                  )}

                  {/* Payment Confirmation Trigger (If Approved but Payment Pending) */}
                  {selectedApp.adminApprovalStatus === "Approved" && selectedApp.paymentStatus !== "Paid" && (
                    <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <p className="font-bold text-amber-900 dark:text-amber-200">IPP Pro Payment Awaiting Confirmation</p>
                        <p className="text-xs text-amber-800 dark:text-amber-300">
                          Application is approved but inactive. Confirming payment will activate the layoff and set Vehicle Road Status to Off Road.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        onClick={handleConfirmPayment}
                        disabled={actionLoading}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold gap-1.5 px-4 w-full sm:w-auto shrink-0"
                      >
                        <CreditCard className="h-3.5 w-3.5" />
                        Confirm Payment (IPP Pro)
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 5: COMPREHENSIVE ACTIVITY TIMELINE (Section 4) */}
            {activeInspectTab === "activity" && (
              <div className="space-y-4 pt-2">
                <ActivityTimeline
                  applicationId={selectedApp.id}
                  registrationNumber={selectedApp.registrationNumber}
                  currentUserRole="DVLA Administrator"
                  currentUserName={currentUser?.fullName || "DVLA Administrator"}
                />
              </div>
            )}

            {/* ─── ADMINISTRATIVE ACTIONS BAR ─── */}
            <div className="pt-4 border-t border-slate-200 dark:border-zinc-800 flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelectedApp(null)} className="rounded-xl w-full sm:w-auto">
                Close
              </Button>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {/* Official National Certificate Action */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenNationalCertificate(selectedApp)}
                  className="rounded-xl text-xs font-bold border-emerald-300 dark:border-emerald-700 bg-emerald-50/50 dark:bg-emerald-950/30 text-[#006837] dark:text-emerald-400 hover:bg-emerald-100/60 gap-1.5 w-full sm:w-auto"
                >
                  <FileText className="h-3.5 w-3.5" />
                  National Certificate
                </Button>
                {/* Formal Return to Road Action (Section 13) */}
                {selectedApp.vehicleRoadStatus === "Off Road" && (
                  <Button
                    size="sm"
                    onClick={() => setIsReturningToRoad(true)}
                    className="bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold gap-1.5 w-full sm:w-auto"
                  >
                    <CornerDownLeft className="h-3.5 w-3.5" />
                    Formal Return to Road
                  </Button>
                )}

                {/* Return for Correction */}
                {selectedApp.adminApprovalStatus === "Pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsReturningCorrection(true)}
                    className="rounded-xl text-xs font-bold text-amber-700 hover:bg-amber-50 border-amber-300 w-full sm:w-auto"
                  >
                    Return for Correction
                  </Button>
                )}

                {/* Reject */}
                {selectedApp.adminApprovalStatus === "Pending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsRejecting(true)}
                    className="rounded-xl text-xs font-bold text-red-600 hover:bg-red-50 border-red-300 w-full sm:w-auto"
                  >
                    Reject Application
                  </Button>
                )}

                {/* Approve & Invoice */}
                {selectedApp.adminApprovalStatus === "Pending" && (
                  <Button
                    size="sm"
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-1.5 px-5 shadow-xs w-full sm:w-auto justify-center"
                  >
                    <Check className="h-4 w-4" />
                    Approve &amp; Generate IPP Pro Invoice
                  </Button>
                )}
              </div>
            </div>
          </div>
        </Dialog>
      )}

      {/* Reject Reason Modal */}
      {isRejecting && (
        <Dialog
          isOpen={isRejecting}
          onClose={() => setIsRejecting(false)}
          title="Formal Statutory Rejection"
          description="Enter mandatory statutory grounds for rejecting this vehicle layoff application."
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <textarea
              className="w-full h-28 rounded-xl border border-slate-200 dark:border-zinc-800 p-3 text-xs"
              placeholder="State mandatory grounds under Regulation 48..."
              value={rejectionText}
              onChange={e => setRejectionText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsRejecting(false)}>Cancel</Button>
              <Button size="sm" onClick={handleRejectSubmit} className="bg-red-600 hover:bg-red-700 text-white">
                Confirm Rejection
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Return for Correction Modal */}
      {isReturningCorrection && (
        <Dialog
          isOpen={isReturningCorrection}
          onClose={() => setIsReturningCorrection(false)}
          title="Return Application for Correction"
          description="Specify requirements or documents the applicant must revise before re-adjudication."
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <textarea
              className="w-full h-28 rounded-xl border border-slate-200 dark:border-zinc-800 p-3 text-xs"
              placeholder="e.g. Upload clearer chassis VIN photograph, submit valid Power of Attorney..."
              value={correctionText}
              onChange={e => setCorrectionText(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsReturningCorrection(false)}>Cancel</Button>
              <Button size="sm" onClick={handleReturnCorrectionSubmit} className="bg-amber-600 hover:bg-amber-700 text-white">
                Send to Applicant
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Formal Return to Road Modal (Section 13) */}
      {isReturningToRoad && (
        <Dialog
          isOpen={isReturningToRoad}
          onClose={() => setIsReturningToRoad(false)}
          title={`Formal Return to Road: ${selectedApp?.registrationNumber}`}
          description="Enacts formal statutory procedure to transition vehicle status from Off Road to On Road."
          maxWidth="max-w-md"
        >
          <div className="space-y-4">
            <p className="text-xs text-slate-600 dark:text-zinc-400">
              Under DVLA regulations, vehicles laid off under Regulation 48 remain Off Road until formal return-to-road compliance inspection is recorded.
            </p>
            <textarea
              className="w-full h-24 rounded-xl border border-slate-200 dark:border-zinc-800 p-3 text-xs"
              placeholder="Record re-commissioning inspection notes and roadworthiness certificate number..."
              value={returnToRoadNotes}
              onChange={e => setReturnToRoadNotes(e.target.value)}
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsReturningToRoad(false)}>Cancel</Button>
              <Button size="sm" onClick={handleReturnToRoadSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                Authorize Return to Road (On Road)
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* Official Thermal POS Receipt Modal */}
      {selectedThermalInvoice && (
        <Dialog
          isOpen={!!selectedThermalInvoice}
          onClose={() => setSelectedThermalInvoice(null)}
          title="DVLA Official Invoice — Thermal POS Receipt"
          maxWidth="max-w-xl"
        >
          <ThermalReceipt
            invoice={selectedThermalInvoice}
            application={applications.find(
              a => a.id === selectedThermalInvoice.applicationId || a.invoiceNumber === selectedThermalInvoice.invoiceNumber
            )}
            onClose={() => setSelectedThermalInvoice(null)}
          />
        </Dialog>
      )}

      {/* ─── SECURE DOCUMENT & REPORT PREVIEW MODAL (Requirement 1 & 6) ─── */}
      {previewFile && (
        <Dialog
          isOpen={Boolean(previewFile)}
          onClose={() => setPreviewFile(null)}
          title={`Document Preview: ${previewFile.name}`}
          description={`Category: ${previewFile.category || "Statutory Document"} • Uploader: ${previewFile.uploadedBy || "System User"}`}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-4 text-xs text-slate-800 dark:text-zinc-200">
            {/* Document Header Details */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-[#006837] dark:text-emerald-400">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-sm text-slate-900 dark:text-zinc-100">{previewFile.name}</p>
                  <p className="text-[11px] text-slate-500">
                    Uploaded: {previewFile.uploadedAt ? new Date(previewFile.uploadedAt).toLocaleString() : "Official Record"} • Verified Authenticity
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={() => handleDownloadFile(previewFile.name, previewFile.url)}
                className="bg-[#006837] hover:bg-[#00552d] text-white text-xs gap-1.5"
              >
                <Download className="h-3.5 w-3.5" />
                Download Original
              </Button>
            </div>

            {/* Document Viewer Frame */}
            <div className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 min-h-[340px] flex flex-col items-center justify-center p-6 text-center space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-zinc-900 flex items-center justify-center text-slate-400">
                <FileCheck className="h-8 w-8 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-base text-slate-900 dark:text-zinc-100">
                  {previewFile.category || "Official Document"}
                </p>
                <p className="text-xs text-slate-500 max-w-md mt-1">
                  Document secured in DVLA Document Repository. This document is authenticated for administrative adjudication and audit governance.
                </p>
              </div>
              <div className="pt-2 flex gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownloadFile(previewFile.name, previewFile.url)}
                  className="text-xs gap-1"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download File
                </Button>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
              <Button variant="outline" size="sm" onClick={() => setPreviewFile(null)}>
                Close Preview
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── NATIONAL STATUTORY CERTIFICATE DIALOG (L.I. 2519 Regulation 28) ─── */}
      {isAdminCertOpen && adminCertApp && (
        <Dialog
          isOpen={isAdminCertOpen}
          onClose={() => {
            setIsAdminCertOpen(false);
            setAdminCertApp(null);
          }}
          maxWidth="max-w-4xl"
          title="Republic of Ghana — Statutory Vehicle Lay-Off Certificate"
          description="Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28"
        >
          <StatutoryCertificate
            application={adminCertApp}
            onClose={() => {
              setIsAdminCertOpen(false);
              setAdminCertApp(null);
            }}
            showPrintAction={true}
          />
        </Dialog>
      )}
    </div>
  );
}
