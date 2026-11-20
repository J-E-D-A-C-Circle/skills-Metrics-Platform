"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { TechnicalOfficerDashboard } from "@/components/technical-officer-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Wrench, RefreshCw, MapPin, Building2, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INITIAL_APPLICATIONS, LayoffApplication } from "@/lib/mock-data";

export default function TechnicalOfficerPage() {
  const [activeSection, setActiveSection] = useState("workspace");
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [applications, setApplications] = useState<LayoffApplication[]>(INITIAL_APPLICATIONS);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch current authenticated technical officer session
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
      const res = await fetch("/api/applications");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setApplications(data);
        }
      }
    } catch (err) {
      console.error("Failed to load applications:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleInspectionSubmitted = (updatedApp: LayoffApplication) => {
    setApplications(prev =>
      prev.map(a => (a.id === updatedApp.id ? updatedApp : a))
    );
  };

  const officerRegionNorm = (currentUser?.region || "Greater Accra").trim().toLowerCase();

  // Regional pool count: approved, unclaimed, officer's region
  const openCasesCount = applications.filter(a => {
    const appRegionNorm = (a.storageRegion || "greater accra").trim().toLowerCase();
    const isMyRegion = appRegionNorm === officerRegionNorm || !a.storageRegion;
    const isApproved = a.adminApprovalStatus === "Approved";
    const isUnclaimed = !a.assignedOfficerId || a.inspectionStatus === "Pending Assignment";
    return isMyRegion && isApproved && isUnclaimed;
  }).length;

  const myInspectionsCount = applications.filter(a => {
    const isAssignedToMe =
      (currentUser && a.assignedOfficerId === currentUser.id) ||
      (currentUser && a.assignedOfficerName === currentUser.fullName) ||
      a.assignedOfficerName?.includes("Samuel Annan") ||
      (a.assignedOfficerId && !currentUser);

    return isAssignedToMe && (a.inspectionStatus === "In Progress" || a.inspectionStatus === "Assigned");
  }).length;

  const completedCount = applications.filter(a => {
    const isAssignedToMe =
      (currentUser && a.assignedOfficerId === currentUser.id) ||
      (currentUser && a.assignedOfficerName === currentUser.fullName) ||
      a.assignedOfficerName?.includes("Samuel Annan") ||
      (a.assignedOfficerId && !currentUser);

    return isAssignedToMe && a.inspectionStatus === "Completed";
  }).length;

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans">
      {/* Enterprise DVLA Sidebar */}
      <Sidebar
        role="technical-officer"
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentUser={currentUser}
        badgeCounts={{
          openCases: openCasesCount,
          myInspections: myInspectionsCount,
          completed: completedCount,
          followUps: 2,
        }}
      />

      {/* Main Technical Officer Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* Top Header Strip */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-700 dark:text-amber-400">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 capitalize">
                {activeSection.replace("-", " ")}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                DVLA Ghana Physical Vehicle Layoff Inspection Console
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

        {/* Dynamic Content */}
        <main className="flex-1 pb-12">
          <TechnicalOfficerDashboard
            applications={applications}
            currentUser={currentUser}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            onRefreshData={loadData}
            onInspectionSubmitted={handleInspectionSubmitted}
          />
        </main>
      </div>
    </div>
  );
}
