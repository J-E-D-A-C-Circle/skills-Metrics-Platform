"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { ComplianceDashboard } from "@/components/compliance-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { ShieldCheck, RefreshCw, Building2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INITIAL_APPLICATIONS, LayoffApplication } from "@/lib/mock-data";

export default function ComplianceManagerPage() {
  const [activeSection, setActiveSection] = useState("overview");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [applications, setApplications] = useState<LayoffApplication[]>(INITIAL_APPLICATIONS);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.authenticated && data.user) {
            setCurrentUser(data.user);
          }
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      }
    }
    checkAuth();
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [appsRes, usersRes] = await Promise.all([
        fetch("/api/applications"),
        fetch("/api/users"),
      ]);
      if (appsRes.ok) {
        const appsData = await appsRes.json();
        if (Array.isArray(appsData) && appsData.length > 0) {
          setApplications(appsData);
        }
      }
      if (usersRes.ok) {
        const usersData = await usersRes.json();
        if (Array.isArray(usersData)) {
          setUsers(usersData);
        }
      }
    } catch (err) {
      console.error("Failed to load compliance data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const managerRegionNorm = (currentUser?.region || "Greater Accra").trim().toLowerCase();

  const regionalRecordsCount = applications.filter((a) => {
    const appReg = (a.storageRegion || "Greater Accra").trim().toLowerCase();
    return (
      appReg === managerRegionNorm ||
      (managerRegionNorm === "greater accra" &&
        (a.inspectionOfficeLocation?.toLowerCase().includes("accra") ||
          a.inspectionOfficeLocation?.toLowerCase().includes("37") ||
          a.inspectionOfficeLocation?.toLowerCase().includes("tema")))
    );
  }).length;

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans">
      <Sidebar
        role="compliance"
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentUser={currentUser}
        badgeCounts={{
          officers: 3,
          records: regionalRecordsCount,
        }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#006837] dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 capitalize">
                  {activeSection === "overview"
                    ? "Regional Compliance Overview"
                    : activeSection === "officers"
                    ? "Officer Appraisal & Activity"
                    : "Regional Records (Read-Only)"}
                </h1>
                <Badge variant="outline" className="text-[10px] gap-1 hidden sm:inline-flex">
                  <Eye className="h-3 w-3 text-[#006837]" />
                  View-Only
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                DVLA Ghana Regional Compliance Manager Oversight Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser?.stationLocation && (
              <Badge variant="outline" className="hidden md:flex text-xs items-center gap-1.5 py-1 px-3">
                <Building2 className="h-3 w-3 text-emerald-600" />
                <span>{currentUser.stationLocation}</span>
                <span className="text-slate-400">({currentUser.region})</span>
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={isLoading}
              className="h-8 rounded-xl text-xs gap-1.5"
            >
              <RefreshCw className={`h-3 w-3 ${isLoading ? "animate-spin" : ""}`} />
              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 pb-12">
          <ComplianceDashboard
            applications={applications}
            users={users}
            currentUser={currentUser}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            onRefreshData={loadData}
          />
        </main>
      </div>
    </div>
  );
}

