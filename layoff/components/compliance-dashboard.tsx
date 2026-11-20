"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Users,
  FileText,
  CheckCircle2,
  Clock,
  Search,
  MapPin,
  Building2,
  Award,
  TrendingUp,
  Car,
  Calendar,
  Eye,
  FileCheck,
  RefreshCw,
  ArrowRight,
  Lock,
  X,
  Star,
  UserCheck,
  Camera,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LayoffApplication } from "@/lib/mock-data";
import { StatutoryCertificate } from "@/components/statutory-certificate";

interface ComplianceDashboardProps {
  applications: LayoffApplication[];
  users?: any[];
  currentUser?: {
    id: string;
    fullName: string;
    email: string;
    role: string;
    region?: string;
    stationLocation?: string;
    staffId?: string | null;
    phone?: string;
  } | null;
  activeSection?: string;
  onSelectSection?: (sectionId: string) => void;
  onRefreshData?: () => void;
}

interface OfficerAppraisalMetric {
  officerId: string;
  fullName: string;
  email: string;
  phone: string;
  stationLocation: string;
  region: string;
  totalAssigned: number;
  solvedCount: number;
  inProgressCount: number;
  reportsUploaded: number;
  completionRate: number;
  appraisalScore: number;
  appraisalTier: "Outstanding (Tier 1)" | "Exceeds Expectations" | "Satisfactory";
  cases: LayoffApplication[];
}

export function ComplianceDashboard({
  applications,
  users = [],
  currentUser,
  activeSection = "overview",
  onSelectSection,
  onRefreshData,
}: ComplianceDashboardProps) {
  const managerName = currentUser?.fullName || "Hajia Mariama Alhassan (CM-301)";
  const managerRegion = currentUser?.region || "Greater Accra";
  const managerStation = currentUser?.stationLocation || "37 Military Hospital Road Head Office";
  const managerRegionNorm = managerRegion.trim().toLowerCase();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedOfficerFilter, setSelectedOfficerFilter] = useState<string>("ALL");
  const [inspectRecordModal, setInspectRecordModal] = useState<LayoffApplication | null>(null);
  const [certificateModalApp, setCertificateModalApp] = useState<LayoffApplication | null>(null);

  // 1. Scope applications strictly to the Compliance Manager's region
  // (Include flagship demo records so Greater Accra manager always has rich regional data)
  const regionalApplications = useMemo(() => {
    return applications.filter((app) => {
      const appRegion = (app.storageRegion || "Greater Accra").trim().toLowerCase();
      if (appRegion === managerRegionNorm) return true;
      // Also include cases inspected at a station in manager's region (e.g. 37 Head Office in Greater Accra)
      if (
        managerRegionNorm === "greater accra" &&
        (app.inspectionOfficeLocation?.toLowerCase().includes("accra") ||
          app.inspectionOfficeLocation?.toLowerCase().includes("37") ||
          app.inspectionOfficeLocation?.toLowerCase().includes("tema"))
      ) {
        return true;
      }
      return false;
    });
  }, [applications, managerRegionNorm]);

  // 2. Regional Case Metrics
  const solvedCases = useMemo(
    () => regionalApplications.filter((a) => a.inspectionStatus === "Completed"),
    [regionalApplications]
  );

  const inProgressCases = useMemo(
    () =>
      regionalApplications.filter(
        (a) => a.inspectionStatus === "In Progress" || a.inspectionStatus === "Assigned"
      ),
    [regionalApplications]
  );

  const unclaimedCases = useMemo(
    () =>
      regionalApplications.filter(
        (a) => !a.assignedOfficerId || a.inspectionStatus === "Pending Assignment"
      ),
    [regionalApplications]
  );

  const offRoadVehiclesCount = useMemo(
    () =>
      regionalApplications.filter(
        (a) =>
          a.vehicleRoadStatus === "Off Road" ||
          a.status === "Active Layoff" ||
          (a.adminApprovalStatus === "Approved" && a.paymentStatus === "Paid")
      ).length,
    [regionalApplications]
  );

  // 3. Build Technical Officer Activity & Appraisal Metrics for this Region from DB users
  const officerMetrics: OfficerAppraisalMetric[] = useMemo(() => {
    const map = new Map<string, OfficerAppraisalMetric>();

    // Populate with Technical Officers from the database for this region
    for (const u of users) {
      if (
        u.role === "TECHNICAL_OFFICER" &&
        (u.region || "").trim().toLowerCase() === managerRegionNorm
      ) {
        const key = u.staffId || u.id;
        if (!map.has(key)) {
          map.set(key, {
            officerId: key,
            fullName: u.fullName,
            email: u.email,
            phone: u.phone || "—",
            stationLocation: u.stationLocation || `DVLA ${managerRegion} Station`,
            region: u.region || managerRegion,
            totalAssigned: 0,
            solvedCount: 0,
            inProgressCount: 0,
            reportsUploaded: 0,
            completionRate: 0,
            appraisalScore: 0,
            appraisalTier: "Satisfactory",
            cases: [],
          });
        }
      }
    }

    // Aggregate cases from regionalApplications
    for (const app of regionalApplications) {
      if (!app.assignedOfficerId && !app.assignedOfficerName) continue;
      const key = app.assignedOfficerId || app.assignedOfficerName || "UNASSIGNED";

      let entry = map.get(key);
      if (!entry) {
        // Try matching by name
        for (const existing of map.values()) {
          if (
            app.assignedOfficerName &&
            existing.fullName.toLowerCase().includes(app.assignedOfficerName.toLowerCase())
          ) {
            entry = existing;
            break;
          }
        }
      }

      if (!entry) {
        entry = {
          officerId: key,
          fullName: app.assignedOfficerName || `Officer ${key}`,
          email: `${key.toLowerCase().replace(/[^a-z0-9]/g, "")}@dvla.gov.gh`,
          phone: "+233 24 000 0000",
          stationLocation: app.inspectionOfficeLocation || managerStation,
          region: managerRegion,
          totalAssigned: 0,
          solvedCount: 0,
          inProgressCount: 0,
          reportsUploaded: 0,
          completionRate: 0,
          appraisalScore: 0,
          appraisalTier: "Satisfactory",
          cases: [],
        };
        map.set(key, entry);
      }

      entry.totalAssigned += 1;
      entry.cases.push(app);
      if (app.inspectionStatus === "Completed") {
        entry.solvedCount += 1;
      } else {
        entry.inProgressCount += 1;
      }
      if (app.inspectionReportUrl || app.inspectionFindings) {
        entry.reportsUploaded += 1;
      }
    }

    // Compute Appraisal Score & Rank
    const list = Array.from(map.values()).map((item) => {
      const completionRate =
        item.totalAssigned > 0 ? Math.round((item.solvedCount / item.totalAssigned) * 100) : 0;
      const docRate =
        item.solvedCount > 0 ? Math.min(100, Math.round((item.reportsUploaded / item.solvedCount) * 100)) : 0;
      // Weighted appraisal score out of 100
      const volumeBonus = Math.min(30, item.solvedCount * 15);
      const appraisalScore =
        item.totalAssigned === 0
          ? 70
          : Math.min(99, Math.round(completionRate * 0.5 + docRate * 0.2 + volumeBonus));

      let appraisalTier: OfficerAppraisalMetric["appraisalTier"] = "Satisfactory";
      if (appraisalScore >= 90 || item.solvedCount >= 2) {
        appraisalTier = "Outstanding (Tier 1)";
      } else if (appraisalScore >= 80 || item.solvedCount >= 1) {
        appraisalTier = "Exceeds Expectations";
      }

      return {
        ...item,
        completionRate,
        appraisalScore,
        appraisalTier,
      };
    });

    // Sort descending by solvedCount then appraisalScore
    return list.sort((a, b) => b.solvedCount - a.solvedCount || b.appraisalScore - a.appraisalScore);
  }, [regionalApplications, users, managerRegion, managerRegionNorm, managerStation]);

  // Filtered records for Regional Records tab
  const filteredRecords = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return regionalApplications.filter((app) => {
      const cleanQ = q.replace(/[\s-]/g, "");
      const cleanId = (app.id || "").toLowerCase().replace(/[\s-]/g, "");
      const cleanReg = (app.registrationNumber || "").toLowerCase().replace(/[\s-]/g, "");

      const matchesQuery =
        !q ||
        app.id.toLowerCase().includes(q) ||
        app.registrationNumber.toLowerCase().includes(q) ||
        cleanId.includes(cleanQ) ||
        cleanReg.includes(cleanQ) ||
        (app.applicantName && app.applicantName.toLowerCase().includes(q)) ||
        (app.ownerName && app.ownerName.toLowerCase().includes(q)) ||
        (app.assignedOfficerName && app.assignedOfficerName.toLowerCase().includes(q));

      const isOffRoad =
        app.vehicleRoadStatus === "Off Road" ||
        app.status === "Active Layoff" ||
        (app.adminApprovalStatus === "Approved" && app.paymentStatus === "Paid");

      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "SOLVED" && app.inspectionStatus === "Completed") ||
        (statusFilter === "PENDING" && app.inspectionStatus !== "Completed") ||
        (statusFilter === "OFF_ROAD" && isOffRoad) ||
        (statusFilter === "ON_ROAD" && !isOffRoad);

      const matchesOfficer =
        selectedOfficerFilter === "ALL" ||
        app.assignedOfficerId === selectedOfficerFilter ||
        app.assignedOfficerName === selectedOfficerFilter;

      return matchesQuery && matchesStatus && matchesOfficer;
    });
  }, [regionalApplications, searchQuery, statusFilter, selectedOfficerFilter]);

  return (
    <div className="space-y-6 w-full max-w-[1720px] mx-auto px-3 sm:px-8 py-4 sm:py-6 animate-fade-in">
      {/* ─── REGIONAL OVERSIGHT HEADER BANNER (READ-ONLY NOTICE) ─── */}
      <div className="bg-gradient-to-r from-[#004d28] via-[#006837] to-[#003b1e] text-white rounded-2xl p-5 sm:p-6 shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="h-3 w-3 rounded-full bg-emerald-400 animate-pulse inline-block" />
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
              Compliance Manager Regional Oversight Console
            </h1>
            <Badge className="bg-amber-400/20 text-amber-200 border border-amber-300/40 text-[10px] font-black uppercase gap-1">
              <Eye className="h-3 w-3" />
              Read-Only Supervisory Access
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-emerald-100/90 font-medium">
            Monitor Technical Officer activities, solved inspection cases, regional vehicle records, and officer appraisal rankings in <strong>{managerRegion}</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Badge className="bg-emerald-800/80 text-white border border-emerald-400/30 px-3 py-1 text-xs font-semibold gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-emerald-300" />
            Region: {managerRegion}
          </Badge>
          <Badge className="bg-emerald-950/70 text-emerald-200 border border-emerald-500/30 px-3 py-1 text-xs font-semibold gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-emerald-400" />
            {managerStation}
          </Badge>
          <Badge className="bg-white/10 text-white border border-white/20 px-3 py-1 text-xs font-semibold">
            {managerName}
          </Badge>
        </div>
      </div>

      {/* ─── 4 REGIONAL KPI SUMMARY TILES ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <button
          type="button"
          onClick={() => onSelectSection && onSelectSection("records")}
          className={cn(
            "rounded-2xl border p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md cursor-pointer",
            activeSection === "overview"
              ? "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800"
              : "bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Total Regional Cases
            </span>
            <div className="h-8 w-8 rounded-xl bg-slate-100 dark:bg-zinc-800 flex items-center justify-center text-slate-700 dark:text-zinc-300">
              <FileText className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {regionalApplications.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {offRoadVehiclesCount} Off-Road &bull; {regionalApplications.length - offRoadVehiclesCount} On-Road
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("SOLVED");
            if (onSelectSection) onSelectSection("records");
          }}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md hover:border-emerald-400 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Cases Solved / Inspected
            </span>
            <div className="h-8 w-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-[#006837] dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {solvedCases.length}
          </p>
          <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1 font-semibold">
            {regionalApplications.length > 0
              ? `${Math.round((solvedCases.length / regionalApplications.length) * 100)}% Regional Resolution Rate`
              : "100% Resolution Rate"}
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            setStatusFilter("PENDING");
            if (onSelectSection) onSelectSection("records");
          }}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md hover:border-amber-400 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              Pending / Active Queue
            </span>
            <div className="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {inProgressCases.length + unclaimedCases.length}
          </p>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            {inProgressCases.length} Claimed &bull; {unclaimedCases.length} Unclaimed
          </p>
        </button>

        <button
          type="button"
          onClick={() => onSelectSection && onSelectSection("officers")}
          className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] p-4 sm:p-5 text-left transition-all shadow-xs hover:shadow-md hover:border-blue-400 cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-blue-700 dark:text-blue-400">
              Top Officers &amp; Appraisal
            </span>
            <div className="h-8 w-8 rounded-xl bg-blue-100 dark:bg-blue-950/60 flex items-center justify-center text-blue-700 dark:text-blue-400">
              <Award className="h-4 w-4" />
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-zinc-100 mt-2">
            {officerMetrics.length}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 font-semibold flex items-center gap-1">
            <span>Top: {officerMetrics[0]?.fullName || "N/A"}</span>
            <ArrowRight className="h-3 w-3" />
          </p>
        </button>
      </div>

      {/* ─── TAB 1: REGIONAL OVERVIEW ─── */}
      {activeSection === "overview" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performing Technical Officers in Region (For Appraisal) */}
            <Card className="border-slate-200 dark:border-zinc-800 shadow-xs">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <Award className="h-5 w-5 text-amber-500" />
                      Top Regional Officers — Appraisal Leaderboard
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Ranked by cases solved, inspection quality, and report completion in {managerRegion}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectSection && onSelectSection("officers")}
                    className="text-xs font-bold text-[#006837] dark:text-emerald-400"
                  >
                    Full Appraisal View &rarr;
                  </Button>
                </div>

                <div className="space-y-3">
                  {officerMetrics.map((off, idx) => (
                    <div
                      key={off.officerId}
                      className="p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center font-black text-xs shrink-0",
                            idx === 0
                              ? "bg-amber-400 text-amber-950 shadow-xs"
                              : idx === 1
                              ? "bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-100"
                              : "bg-amber-900/20 text-amber-800 dark:text-amber-300"
                          )}
                        >
                          #{idx + 1}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 truncate">
                              {off.fullName}
                            </p>
                            <span className="font-mono text-[10px] text-slate-400">
                              ({off.officerId})
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 truncate">{off.stationLocation}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0 text-right">
                        <div>
                          <p className="text-xs font-black text-[#006837] dark:text-emerald-400">
                            {off.solvedCount} Solved / {off.totalAssigned} Cases
                          </p>
                          <p className="text-[10px] text-slate-500">
                            Appraisal Score: <strong>{off.appraisalScore}%</strong>
                          </p>
                        </div>
                        <Badge
                          variant={
                            off.appraisalTier === "Outstanding (Tier 1)"
                              ? "success"
                              : off.appraisalTier === "Exceeds Expectations"
                              ? "info"
                              : "secondary"
                          }
                          className="text-[10px] font-bold hidden sm:inline-flex"
                        >
                          {off.appraisalTier}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Recent Regional Case Activity (Read-Only) */}
            <Card className="border-slate-200 dark:border-zinc-800 shadow-xs">
              <CardContent className="p-5 sm:p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                      Recent Regional Cases ({managerRegion})
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Latest vehicle layoff inspections and road status updates in your region
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectSection && onSelectSection("records")}
                    className="text-xs font-bold text-[#006837] dark:text-emerald-400"
                  >
                    All Regional Records &rarr;
                  </Button>
                </div>

                <div className="space-y-3">
                  {regionalApplications.slice(0, 4).map((app) => {
                    const isOffRoad =
                      app.vehicleRoadStatus === "Off Road" ||
                      app.status === "Active Layoff" ||
                      (app.adminApprovalStatus === "Approved" && app.paymentStatus === "Paid");

                    return (
                      <div
                        key={app.id}
                        className="p-3.5 rounded-2xl border border-slate-100 dark:border-zinc-800 bg-slate-50/60 dark:bg-zinc-900/50 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-[#006837] dark:text-emerald-400">
                              {app.id}
                            </span>
                            <span className="font-bold text-sm text-slate-900 dark:text-zinc-100">
                              {app.registrationNumber}
                            </span>
                            <Badge
                              variant={isOffRoad ? "success" : "warning"}
                              className="text-[10px]"
                            >
                              {isOffRoad ? "Off Road" : "On Road"}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-500 truncate mt-0.5">
                            {app.make} {app.model} &bull; Officer:{" "}
                            <strong>{app.assignedOfficerName || "Unassigned"}</strong>
                          </p>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectRecordModal(app)}
                          className="rounded-xl text-xs font-bold gap-1.5 shrink-0"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ─── TAB 2: TECHNICAL OFFICERS ACTIVITY & APPRAISAL ─── */}
      {activeSection === "officers" && (
        <div className="space-y-6">
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                <Award className="h-5 w-5 text-amber-500" />
                Technical Officers Performance &amp; Appraisal Registry — {managerRegion}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Read-only supervisory evaluation of Technical Officers in <strong>{managerRegion}</strong> based on total cases assigned, cases solved, report uploads, and completion rate for staff appraisal.
              </p>
            </div>
            <Badge variant="outline" className="text-xs py-1 px-3 font-bold self-start sm:self-auto">
              {officerMetrics.length} Regional Technical Officers
            </Badge>
          </div>

          {/* Appraisal Leaderboard Table */}
          <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-extrabold uppercase text-slate-500 tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5">Rank</th>
                    <th className="px-5 py-3.5">Technical Officer</th>
                    <th className="px-5 py-3.5">Assigned Station</th>
                    <th className="px-5 py-3.5 text-center">Total Cases</th>
                    <th className="px-5 py-3.5 text-center">Cases Solved</th>
                    <th className="px-5 py-3.5 text-center">Active Queue</th>
                    <th className="px-5 py-3.5 text-center">Completion Rate</th>
                    <th className="px-5 py-3.5 text-center">Appraisal Score</th>
                    <th className="px-5 py-3.5">Appraisal Standing</th>
                    <th className="px-5 py-3.5 text-right">Records</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-800">
                  {officerMetrics.map((off, idx) => (
                    <tr
                      key={off.officerId}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "inline-flex h-7 w-7 rounded-lg items-center justify-center font-black text-xs",
                            idx === 0
                              ? "bg-amber-400 text-amber-950"
                              : idx === 1
                              ? "bg-slate-200 dark:bg-zinc-700 text-slate-800 dark:text-zinc-100"
                              : "bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400"
                          )}
                        >
                          #{idx + 1}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">
                          {off.fullName}
                        </p>
                        <p className="font-mono text-[11px] text-slate-400">
                          {off.officerId} &bull; {off.phone}
                        </p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-800 dark:text-zinc-200">
                          {off.stationLocation}
                        </p>
                        <p className="text-[11px] text-slate-400">{off.region}</p>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-sm">
                        {off.totalAssigned}
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-[#006837] dark:text-emerald-400 font-black">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {off.solvedCount}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-center font-bold text-amber-600">
                        {off.inProgressCount}
                      </td>
                      <td className="px-5 py-4 text-center font-bold">
                        {off.completionRate}%
                      </td>
                      <td className="px-5 py-4 text-center">
                        <span className="font-mono font-black text-sm text-slate-900 dark:text-zinc-100">
                          {off.appraisalScore} / 100
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <Badge
                          variant={
                            off.appraisalTier === "Outstanding (Tier 1)"
                              ? "success"
                              : off.appraisalTier === "Exceeds Expectations"
                              ? "info"
                              : "secondary"
                          }
                          className="font-bold text-[10px] gap-1"
                        >
                          <Star className="h-3 w-3" />
                          {off.appraisalTier}
                        </Badge>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedOfficerFilter(off.officerId);
                            if (onSelectSection) onSelectSection("records");
                          }}
                          className="h-8 rounded-xl text-xs font-bold gap-1"
                        >
                          <Eye className="h-3 w-3" />
                          View Cases ({off.totalAssigned})
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ─── TAB 3: REGIONAL RECORDS & VEHICLE LOOKUP (VIEW-ONLY) ─── */}
      {activeSection === "records" && (
        <div className="space-y-6">
          {/* Search & Filter Controls */}
          <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-zinc-100 flex items-center gap-2">
                  <Search className="h-5 w-5 text-[#006837] dark:text-emerald-400" />
                  {managerRegion} Regional Vehicle &amp; Inspection Records (Read-Only)
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Search by <strong>Layoff Reference Number</strong> (e.g. <span className="font-mono">LAY-2026-GT492022</span>), <strong>Vehicle Number</strong> (e.g. <span className="font-mono">GT-4920-22</span>), Owner Name, or Technical Officer.
                </p>
              </div>

              {(searchQuery || statusFilter !== "ALL" || selectedOfficerFilter !== "ALL") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("ALL");
                    setSelectedOfficerFilter("ALL");
                  }}
                  className="rounded-xl text-xs gap-1.5 self-start sm:self-auto"
                >
                  <X className="h-3.5 w-3.5" />
                  Reset Filters
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="relative sm:col-span-1">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search LAY-2026-GT492022, GT-4920-22..."
                  className="h-10 pl-10 text-xs rounded-xl"
                />
              </div>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Filter by Case / Road Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Regional Records ({regionalApplications.length})</SelectItem>
                  <SelectItem value="SOLVED">Solved / Completed Inspections ({solvedCases.length})</SelectItem>
                  <SelectItem value="PENDING">Pending / Active Inspections ({inProgressCases.length + unclaimedCases.length})</SelectItem>
                  <SelectItem value="OFF_ROAD">Off Road (Active Layoff)</SelectItem>
                  <SelectItem value="ON_ROAD">On Road</SelectItem>
                </SelectContent>
              </Select>

              <Select value={selectedOfficerFilter} onValueChange={setSelectedOfficerFilter}>
                <SelectTrigger className="h-10 text-xs rounded-xl">
                  <SelectValue placeholder="Filter by Technical Officer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Regional Technical Officers</SelectItem>
                  {officerMetrics.map((off) => (
                    <SelectItem key={off.officerId} value={off.officerId}>
                      {off.fullName} ({off.solvedCount} Solved)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Records Grid */}
          {filteredRecords.length === 0 ? (
            <div className="py-16 text-center rounded-2xl border border-dashed border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#121212] space-y-2">
              <Car className="h-10 w-10 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700 dark:text-zinc-300">
                No Regional Records Match Your Filter
              </p>
              <p className="text-xs text-slate-500">
                Try clearing your search or selecting &ldquo;All Regional Records&rdquo;.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredRecords.map((app) => {
                const isOffRoad =
                  app.vehicleRoadStatus === "Off Road" ||
                  app.status === "Active Layoff" ||
                  (app.adminApprovalStatus === "Approved" && app.paymentStatus === "Paid");
                const isSolved = app.inspectionStatus === "Completed";
                const canViewCert = app.adminApprovalStatus === "Approved" && app.paymentStatus === "Paid";

                return (
                  <Card
                    key={app.id}
                    className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-xs hover:shadow-md transition-all"
                  >
                    <div
                      className={cn(
                        "px-5 py-3 flex items-center justify-between border-b text-xs",
                        isOffRoad
                          ? "bg-emerald-950 text-white border-emerald-800"
                          : "bg-slate-100 dark:bg-zinc-900 text-slate-800 dark:text-zinc-200 border-slate-200 dark:border-zinc-800"
                      )}
                    >
                      <div className="flex items-center gap-2 font-bold">
                        <span
                          className={cn(
                            "h-2.5 w-2.5 rounded-full",
                            isOffRoad ? "bg-emerald-400" : "bg-amber-500"
                          )}
                        />
                        <span>Road Status: {isOffRoad ? "OFF ROAD" : "ON ROAD"}</span>
                      </div>
                      <Badge variant={isSolved ? "success" : "warning"} className="text-[10px]">
                        {isSolved ? "Case Solved (Inspected)" : app.inspectionStatus || "Pending Inspection"}
                      </Badge>
                    </div>

                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <span className="font-mono text-xs font-black text-[#006837] dark:text-emerald-400 block">
                            {app.id}
                          </span>
                          <h3 className="text-lg font-black text-slate-900 dark:text-zinc-100">
                            {app.registrationNumber}
                          </h3>
                          <p className="text-xs text-slate-500">
                            {app.make} {app.model} &bull; {app.colour || "Standard"}
                          </p>
                        </div>

                        <div className="text-right text-xs">
                          <span className="text-[10px] text-slate-400 uppercase font-bold block">
                            Assigned Officer
                          </span>
                          <span className="font-bold text-slate-900 dark:text-zinc-100">
                            {app.assignedOfficerName || "Unassigned"}
                          </span>
                          {app.inspectionDate && (
                            <span className="text-[10px] text-slate-500 block">
                              Inspected: {app.inspectionDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Owner / Applicant</span>
                          <span className="font-bold text-slate-900 dark:text-zinc-100 truncate block">
                            {app.ownerName || app.applicantName}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Layoff Start</span>
                          <span className="font-mono font-bold text-slate-800 dark:text-zinc-200">
                            {app.layoffStartDate || app.proposedStartDate || "—"}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] text-rose-500 font-bold block">Layoff Expiry</span>
                          <span className="font-mono font-black text-rose-600 dark:text-rose-400">
                            {app.layoffExpiryDate || "Pending"}
                          </span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setInspectRecordModal(app)}
                          className="rounded-xl text-xs font-bold gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Case &amp; Officer Findings
                        </Button>

                        {canViewCert && (
                          <Button
                            size="sm"
                            onClick={() => setCertificateModalApp(app)}
                            className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-1.5"
                          >
                            <FileCheck className="h-3.5 w-3.5" />
                            View Certificate &amp; QR
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── READ-ONLY CASE & OFFICER INSPECTION DOSSIER MODAL ─── */}
      {inspectRecordModal && (
        <Dialog
          isOpen={Boolean(inspectRecordModal)}
          onClose={() => setInspectRecordModal(null)}
          title={`Regional Case Dossier (Read-Only): ${inspectRecordModal.id}`}
          description={`Supervisory review for vehicle ${inspectRecordModal.registrationNumber} in ${managerRegion}.`}
          maxWidth="max-w-2xl"
        >
          <div className="space-y-4 text-xs text-slate-800 dark:text-zinc-200">
            <div className="p-3.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-center gap-2 text-amber-900 dark:text-amber-200 font-semibold">
              <Eye className="h-4 w-4 text-amber-600 shrink-0" />
              <span>Compliance Manager Read-Only Mode — Records cannot be altered from this view.</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div>
                <span className="text-[10px] text-slate-400 block">Layoff Reference</span>
                <span className="font-mono font-black text-[#006837] dark:text-emerald-400">
                  {inspectRecordModal.id}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Vehicle Reg No.</span>
                <span className="font-mono font-black text-slate-900 dark:text-zinc-100">
                  {inspectRecordModal.registrationNumber}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Make, Model &amp; Color</span>
                <span className="font-bold">
                  {inspectRecordModal.make} {inspectRecordModal.model} ({inspectRecordModal.colour || "Standard"})
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Vehicle Owner</span>
                <span className="font-bold">{inspectRecordModal.ownerName || inspectRecordModal.applicantName}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Layoff Start &rarr; Expiry</span>
                <span className="font-mono font-bold">
                  {inspectRecordModal.layoffStartDate || inspectRecordModal.proposedStartDate} &rarr;{" "}
                  {inspectRecordModal.layoffExpiryDate || "Pending"}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Storage Location</span>
                <span className="font-semibold">
                  {inspectRecordModal.storageFacilityName || inspectRecordModal.storageRegion}
                </span>
              </div>
            </div>

            {/* Technical Officer Inspection Report Section */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-zinc-800 space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-black text-slate-900 dark:text-zinc-100 uppercase tracking-wider text-[11px]">
                  Technical Officer Inspection Report
                </h4>
                <Badge
                  variant={inspectRecordModal.inspectionStatus === "Completed" ? "success" : "warning"}
                  className="text-[10px]"
                >
                  {inspectRecordModal.inspectionStatus || "Pending Assignment"}
                </Badge>
              </div>
              <p>
                <strong>Assigned Officer:</strong> {inspectRecordModal.assignedOfficerName || "Unassigned"}{" "}
                {inspectRecordModal.assignedOfficerId ? `(${inspectRecordModal.assignedOfficerId})` : ""}
              </p>
              <p>
                <strong>Inspection Date:</strong> {inspectRecordModal.inspectionDate || "Pending"}
              </p>
              <p>
                <strong>Outcome:</strong> {inspectRecordModal.inspectionOutcome || "Pending Inspection"}
              </p>
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                  Officer Findings &amp; Observations:
                </span>
                <p className="leading-relaxed">
                  {inspectRecordModal.inspectionFindings || "No physical inspection findings submitted yet."}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2">
              {inspectRecordModal.adminApprovalStatus === "Approved" &&
                inspectRecordModal.paymentStatus === "Paid" && (
                  <Button
                    size="sm"
                    onClick={() => {
                      const target = inspectRecordModal;
                      setInspectRecordModal(null);
                      setCertificateModalApp(target);
                    }}
                    className="bg-[#006837] hover:bg-[#00552d] text-white rounded-xl text-xs font-bold gap-1.5"
                  >
                    <FileCheck className="h-3.5 w-3.5" />
                    View Layoff Certificate &amp; QR
                  </Button>
                )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setInspectRecordModal(null)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ─── STATUTORY CERTIFICATE MODAL ─── */}
      {certificateModalApp && (
        <Dialog
          isOpen={Boolean(certificateModalApp)}
          onClose={() => setCertificateModalApp(null)}
          title={`National Vehicle Lay-Off Certificate: ${certificateModalApp.registrationNumber}`}
          description={`Official statutory certificate and verification QR code for ${certificateModalApp.id}.`}
          maxWidth="max-w-4xl"
        >
          <div className="max-h-[82vh] overflow-y-auto pr-1">
            <StatutoryCertificate
              application={certificateModalApp}
              onClose={() => setCertificateModalApp(null)}
            />
          </div>
        </Dialog>
      )}
    </div>
  );
}

