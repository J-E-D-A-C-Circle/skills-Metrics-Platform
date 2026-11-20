"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Sidebar } from "@/components/sidebar";
import { AdminDashboard } from "@/components/admin-dashboard";
import { ThemeToggle } from "@/components/theme-toggle";
import { Shield, RefreshCw, Bell, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  INITIAL_APPLICATIONS,
  INITIAL_INVOICES,
  INITIAL_AUDIT_LOGS,
  INITIAL_SMS_NOTIFICATIONS,
  LayoffApplication,
  Invoice,
  AuditLog,
  SMSNotification,
} from "@/lib/mock-data";

export default function AdminPage() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [currentUser, setCurrentUser] = useState<any>(null);

  const [applications, setApplications] = useState<LayoffApplication[]>(INITIAL_APPLICATIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [smsNotifications, setSmsNotifications] = useState<SMSNotification[]>(INITIAL_SMS_NOTIFICATIONS);

  // Fetch current authenticated user & read URL section query
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get("section");
      if (sec) setActiveSection(sec);
    }

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

  // Fetch live MySQL data on mount & on refresh
  const loadData = useCallback(async () => {
    try {
      const [appRes, invRes, logRes, smsRes] = await Promise.all([
        fetch("/api/applications").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/invoices").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/audit-logs").then((r) => (r.ok ? r.json() : null)),
        fetch("/api/sms-notifications").then((r) => (r.ok ? r.json() : null)),
      ]);

      if (appRes && Array.isArray(appRes) && appRes.length > 0) setApplications(appRes);
      if (invRes && Array.isArray(invRes) && invRes.length > 0) setInvoices(invRes);
      if (logRes && Array.isArray(logRes) && logRes.length > 0) setAuditLogs(logRes);
      if (smsRes && Array.isArray(smsRes) && smsRes.length > 0) setSmsNotifications(smsRes);
    } catch (err) {
      console.error("Error fetching data from API:", err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const pendingCount = applications.filter((a) => a.adminApprovalStatus === "Pending").length;

  return (
    <div className="min-h-screen flex bg-[#f8f9fa] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 font-sans">
      {/* Unified Enterprise Sidebar */}
      <Sidebar
        role="admin"
        activeSection={activeSection}
        onSelectSection={setActiveSection}
        currentUser={currentUser}
        badgeCounts={{
          applications: applications.length,
          users: 5,
          invoices: invoices.length,
          campaigns: 2,
          helpline: 3,
          audit: auditLogs.length,
        }}
      />

      {/* Main Administrative Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto h-screen">
        {/* Top Header Strip */}
        <header className="sticky top-0 z-20 bg-white/95 dark:bg-[#121212]/95 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 px-4 sm:px-8 py-3 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center text-[#006837] dark:text-emerald-400">
              <Shield className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-zinc-100 capitalize">
                {activeSection === "dashboard" && "Admin Dashboard"}
                {activeSection === "records" && "Records Hub"}
                {activeSection === "applications" && "Vehicle Layoff Applications"}
                {activeSection === "users" && "User Management"}
                {activeSection === "invoices" && "Invoices & Payments"}
                {activeSection === "bulk-sms" && "SMS Broadcast Centre"}
                {activeSection === "helpline" && "Helpline & Support"}
                {activeSection === "config" && "System Configuration"}
                {activeSection === "audit" && "System Audit Trail"}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                DVLA Vehicle Layoff Management Portal
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {pendingCount > 0 && (
              <Badge
                variant="warning"
                className="hidden sm:inline-flex text-[11px] font-bold px-2.5 py-1 cursor-pointer"
                onClick={() => setActiveSection("applications")}
              >
                {pendingCount} Awaiting Review
              </Badge>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="rounded-xl text-xs gap-1.5 h-9"
              title="Sync Database"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sync Data</span>
            </Button>

            <ThemeToggle />
          </div>
        </header>

        {/* Dashboard Workspace */}
        <main className="flex-1 p-4 sm:p-8 flex flex-col max-w-[1720px] w-full mx-auto">
          <AdminDashboard
            applications={applications}
            invoices={invoices}
            auditLogs={auditLogs}
            smsNotifications={smsNotifications}
            onRefreshData={loadData}
            activeSection={activeSection}
            onSelectSection={setActiveSection}
            currentUser={currentUser}
          />
        </main>

        {/* Footer */}
        <footer className="py-4 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] text-center text-xs text-slate-400 dark:text-zinc-500">
          © {new Date().getFullYear()} Driver and Vehicle Licensing Authority (DVLA) — Republic of Ghana &nbsp;·&nbsp;
          Road Traffic Regulations, 2026 (L.I. 2519), Regulation 28
        </footer>
      </div>
    </div>
  );
}
