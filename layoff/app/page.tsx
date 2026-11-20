"use client";

import React, { useState } from "react";
import { Navbar } from "@/components/navbar";
import { ApplicationWizard } from "@/components/application-wizard";
import { StatusLookup } from "@/components/status-lookup";
import { SplashScreen } from "@/components/splash-screen";
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

export default function ApplicantPortalPage() {
  const [showSplash, setShowSplash] = useState(true);
  const [activeTab, setActiveTab] = useState<"apply" | "track">("apply");
  const [searchQuery, setSearchQuery] = useState<string>("");

  const [applications, setApplications] = useState<LayoffApplication[]>(INITIAL_APPLICATIONS);
  const [invoices, setInvoices] = useState<Invoice[]>(INITIAL_INVOICES);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(INITIAL_AUDIT_LOGS);
  const [smsNotifications, setSmsNotifications] = useState<SMSNotification[]>(INITIAL_SMS_NOTIFICATIONS);

  const [editingApplication, setEditingApplication] = useState<LayoffApplication | null>(null);

  // Fetch initial data from MySQL database via API
  React.useEffect(() => {
    async function loadData() {
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
    }
    loadData();
  }, []);

  // Submit Handler
  const handleApplicationSuccess = (newApp: LayoffApplication) => {
    setApplications((prev) => {
      const exists = prev.some((a) => a.id === newApp.id);
      if (exists) {
        return prev.map((a) => (a.id === newApp.id ? newApp : a));
      }
      return [newApp, ...prev];
    });

    const newLog: AuditLog = {
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      userRole: "Applicant",
      userName: newApp.applicantName,
      action: editingApplication ? "APPLICATION_RESUBMITTED" : "APPLICATION_SUBMITTED",
      referenceNumber: newApp.id,
      previousStatus: editingApplication ? "Rejected" : "Draft",
      newStatus: "Pending Verification",
      details: `Layoff Application submitted for vehicle ${newApp.registrationNumber} (Chassis VIN: ${newApp.chassisNumber}).`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    const newSms: SMSNotification = {
      id: `SMS-${Math.floor(100 + Math.random() * 900)}`,
      recipientPhone: newApp.applicantPhone,
      message: `Your vehicle layoff application has been successfully submitted. Reference: ${newApp.id}.`,
      event: "Application Submitted",
      sentAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      status: "Delivered",
    };
    setSmsNotifications((prev) => [newSms, ...prev]);

    setEditingApplication(null);
    setSearchQuery(newApp.id);
    setActiveTab("track");
  };

  // Extension Handler
  const handleExtendLayoff = (invoiceNumber: string, addedMonths: number) => {
    let targetPhone = "+233 24 000 0000";

    setInvoices((prev) =>
      prev.map((inv) => {
        if (inv.invoiceNumber === invoiceNumber) {
          const currentExpiry = new Date(inv.layoffExpiryDate);
          currentExpiry.setMonth(currentExpiry.getMonth() + addedMonths);
          return {
            ...inv,
            layoffExpiryDate: currentExpiry.toISOString().split("T")[0],
            extensionStatus: "Extended",
          };
        }
        return inv;
      })
    );

    setApplications((prev) =>
      prev.map((app) => {
        if (app.invoiceNumber === invoiceNumber) {
          targetPhone = app.applicantPhone;
          const currentExpiry = new Date(app.layoffExpiryDate || new Date());
          currentExpiry.setMonth(currentExpiry.getMonth() + addedMonths);
          return {
            ...app,
            status: "Extended",
            layoffExpiryDate: currentExpiry.toISOString().split("T")[0],
            extensionCount: (app.extensionCount || 0) + 1,
          };
        }
        return app;
      })
    );

    const newLog: AuditLog = {
      id: `LOG-${Math.floor(1000 + Math.random() * 9000)}`,
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      userRole: "Applicant",
      userName: "Vehicle Owner (OTP Verified)",
      action: "LAYOFF_EXTENDED",
      referenceNumber: invoiceNumber,
      newStatus: "Extended",
      details: `Layoff extended by ${addedMonths} months following mobile OTP verification.`,
    };
    setAuditLogs((prev) => [newLog, ...prev]);

    const newSms: SMSNotification = {
      id: `SMS-${Math.floor(100 + Math.random() * 900)}`,
      recipientPhone: targetPhone,
      message: `Your vehicle layoff has been extended by ${addedMonths} months.`,
      event: "Extension Confirmed",
      sentAt: new Date().toISOString().replace("T", " ").slice(0, 16),
      status: "Delivered",
    };
    setSmsNotifications((prev) => [newSms, ...prev]);
  };

  const handleEditRejected = (app: LayoffApplication) => {
    setEditingApplication(app);
    setActiveTab("apply");
  };

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div className="min-h-screen flex flex-col bg-[#f8f9fa] dark:bg-[#09090b] text-slate-900 dark:text-zinc-100 transition-colors duration-150">
      <Navbar activeTab={activeTab} setActiveTab={setActiveTab} />

      <main className="flex-1 container mx-auto max-w-6xl px-3 sm:px-8 pt-3 sm:pt-4 pb-10 flex flex-col">
        {activeTab === "apply" ? (
          <ApplicationWizard
            onSuccess={handleApplicationSuccess}
            onCancel={() => setEditingApplication(null)}
            editingApplication={editingApplication}
          />
        ) : (
          <StatusLookup
            applications={applications}
            invoices={invoices}
            onEditRejected={handleEditRejected}
            onExtendLayoff={handleExtendLayoff}
            initialQuery={searchQuery}
          />
        )}
      </main>

      <footer className="mt-auto py-5 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#09090b] transition-colors duration-150 px-4">
        <p className="text-center text-xs text-slate-400 dark:text-zinc-500 leading-relaxed">
          © {new Date().getFullYear()} Driver and Vehicle Licensing Authority (DVLA) — Republic of Ghana
          <span className="hidden sm:inline"> &nbsp;·&nbsp; </span>
          <span className="block sm:inline">Vehicle Layoff Management System</span>
        </p>
      </footer>
      </div>
    </>
  );
}
