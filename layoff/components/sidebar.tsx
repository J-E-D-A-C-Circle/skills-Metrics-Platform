"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  CreditCard,
  MessageSquare,
  LifeBuoy,
  Settings,
  History,
  Wrench,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MapPin,
  Shield,
  Menu,
  X,
  Building2,
  CalendarCheck,
  Scale,
  Search
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  id: string;
  label: string;
  icon: React.ElementType;
  badge?: number | string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "emerald";
}

interface SidebarProps {
  role: "admin" | "technical-officer" | "compliance";
  activeSection: string;
  onSelectSection: (sectionId: string) => void;
  currentUser?: {
    fullName: string;
    email: string;
    role: string;
    region?: string;
    stationLocation?: string;
    staffId?: string | null;
  } | null;
  badgeCounts?: Record<string, number | string>;
}

export function Sidebar({
  role,
  activeSection,
  onSelectSection,
  currentUser,
  badgeCounts = {},
}: SidebarProps) {
  const router = useRouter();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch {
      window.location.href = "/login";
    }
  };

  const adminNavItems: NavItem[] = [
    { id: "dashboard", label: "Executive Dashboard", icon: LayoutDashboard },
    {
      id: "records",
      label: "Records Hub",
      icon: Scale,
    },
    {
      id: "applications",
      label: "Applications Registry",
      icon: FileText,
      badge: badgeCounts.applications,
    },
    {
      id: "users",
      label: "User Management",
      icon: Users,
      badge: badgeCounts.users,
    },
    {
      id: "invoices",
      label: "Invoices & Revenue",
      icon: CreditCard,
      badge: badgeCounts.invoices,
    },
    {
      id: "bulk-sms",
      label: "Bulk SMS Campaigns",
      icon: MessageSquare,
      badge: badgeCounts.campaigns,
    },
    {
      id: "helpline",
      label: "Helpline & Enquiries",
      icon: LifeBuoy,
      badge: badgeCounts.helpline,
      badgeVariant: "warning",
    },
    {
      id: "config",
      label: "System Configuration",
      icon: Settings,
    },
    {
      id: "audit",
      label: "System Audit Trail",
      icon: History,
      badge: badgeCounts.audit,
    },
  ];

  const technicalOfficerNavItems: NavItem[] = [
    { id: "workspace", label: "Inspection Overview", icon: LayoutDashboard },
    {
      id: "vehicle-lookup",
      label: "Vehicle Status Lookup",
      icon: Search,
    },
    {
      id: "open-cases",
      label: "Available Regional Cases",
      icon: Wrench,
      badge: badgeCounts.openCases,
      badgeVariant: "emerald",
    },
    {
      id: "my-inspections",
      label: "My Active Inspections",
      icon: Clock,
      badge: badgeCounts.myInspections,
      badgeVariant: "warning",
    },
    {
      id: "completed",
      label: "Completed Inspections",
      icon: CheckCircle2,
      badge: badgeCounts.completed,
    },
    {
      id: "follow-ups",
      label: "Follow-Up Inspections",
      icon: CalendarCheck,
      badge: badgeCounts.followUps,
      badgeVariant: "danger",
    },
  ];

  const complianceNavItems: NavItem[] = [
    { id: "overview", label: "Regional Overview", icon: LayoutDashboard },
    {
      id: "officers",
      label: "Officer Appraisal & Activity",
      icon: Users,
      badge: badgeCounts.officers,
      badgeVariant: "emerald",
    },
    {
      id: "records",
      label: "Regional Records (View-Only)",
      icon: FileText,
      badge: badgeCounts.records,
    },
  ];

  const navItems =
    role === "admin"
      ? adminNavItems
      : role === "compliance"
      ? complianceNavItems
      : technicalOfficerNavItems;

  const NavContent = () => (
    <div className="flex flex-col h-full justify-between select-none">
      {/* Brand & Top Header */}
      <div>
        <div className="flex items-center justify-between p-4 border-b border-emerald-900/40 dark:border-zinc-800">
          <Link
            href={
              role === "admin"
                ? "/admin"
                : role === "compliance"
                ? "/compliance"
                : "/technical-officer"
            }
            className="flex items-center gap-3 overflow-hidden"
          >
            <div className="relative h-9 w-9 flex-shrink-0">
              <Image src="/oop.png" alt="DVLA Logo" fill className="object-contain" priority />
            </div>
            {!isCollapsed && (
              <div className="leading-tight truncate">
                <span className="block text-sm font-extrabold text-white tracking-tight">DVLA Ghana</span>
                <span className="block text-[10px] text-emerald-300 font-semibold uppercase tracking-wider">
                  {role === "admin"
                    ? "Administrative Console"
                    : role === "compliance"
                    ? "Compliance Oversight"
                    : "Inspection Platform"}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop Collapse Toggle */}
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="hidden lg:flex items-center justify-center h-7 w-7 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 transition-colors border border-emerald-700/40"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>

        {/* User Region & Station Pill (Technical Officers & Compliance Managers) */}
        {!isCollapsed && currentUser && (role === "technical-officer" || role === "compliance") && (
          <div className="mx-3 mt-3 p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-800/60 text-emerald-200 text-xs flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div className="truncate leading-tight">
              <p className="font-bold text-white text-[11px] truncate">{currentUser.stationLocation || "DVLA Regional Station"}</p>
              <p className="text-[10px] text-emerald-300 truncate">{currentUser.region || "Assigned Region"} Jurisdiction</p>
            </div>
          </div>
        )}

        {/* Navigation List */}
        <nav className="p-3 space-y-1 mt-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            const badgeValue = item.badge ?? badgeCounts[item.id];

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectSection(item.id);
                  setIsMobileOpen(false);
                }}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all relative group text-left",
                  isActive
                    ? "bg-white text-[#004d28] shadow-md font-extrabold"
                    : "text-emerald-100/90 hover:bg-emerald-900/50 hover:text-white"
                )}
                title={isCollapsed ? item.label : undefined}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 flex-shrink-0 transition-transform group-hover:scale-110",
                    isActive ? "text-[#006837]" : "text-emerald-300"
                  )}
                />

                {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}

                {!isCollapsed && badgeValue !== undefined && badgeValue !== 0 && (
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[10px] font-black",
                      isActive
                        ? "bg-emerald-100 text-[#006837]"
                        : item.badgeVariant === "emerald"
                        ? "bg-emerald-500 text-white"
                        : item.badgeVariant === "warning"
                        ? "bg-amber-400 text-amber-950"
                        : item.badgeVariant === "danger"
                        ? "bg-rose-500 text-white"
                        : "bg-emerald-800 text-emerald-100"
                    )}
                  >
                    {badgeValue}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* User Profile & Logout Bottom Bar */}
      <div className="p-3 border-t border-emerald-900/50 dark:border-zinc-800 bg-[#003b1e]/60 dark:bg-zinc-900/80">
        <div className={cn("flex items-center gap-3", isCollapsed ? "justify-center" : "justify-between")}>
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="h-9 w-9 rounded-full bg-emerald-700/80 border border-emerald-500/60 flex items-center justify-center text-white font-bold text-xs flex-shrink-0 shadow-inner">
              {currentUser?.fullName
                ? currentUser.fullName
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "DV"}
            </div>

            {!isCollapsed && (
              <div className="leading-tight truncate">
                <p className="text-xs font-bold text-white truncate">{currentUser?.fullName || "DVLA Official"}</p>
                <p className="text-[10px] text-emerald-300 truncate capitalize font-medium">
                  {currentUser?.role === "COMPLIANCE_OFFICER"
                    ? "Compliance Manager"
                    : currentUser?.role?.replace("_", " ").toLowerCase() || "Authorized Staff"}
                </p>
              </div>
            )}
          </div>

          {!isCollapsed && (
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="p-2 rounded-lg bg-emerald-950/80 hover:bg-rose-900/60 text-emerald-200 hover:text-rose-200 transition-colors border border-emerald-800/40"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Header with Hamburger */}
      <div className="lg:hidden sticky top-0 z-40 bg-[#004d28] border-b border-emerald-900/50 px-4 py-3 flex items-center justify-between text-white">
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7">
            <Image src="/oop.png" alt="DVLA Logo" fill className="object-contain" />
          </div>
          <span className="font-bold text-xs">
            {role === "admin"
              ? "DVLA Administrative Console"
              : role === "compliance"
              ? "DVLA Compliance Manager Portal"
              : "DVLA Technical Officer Portal"}
          </span>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-1.5 rounded-lg bg-emerald-900/80 text-emerald-100 hover:text-white"
        >
          {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile Drawer Backdrop */}
      {isMobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside
        className={cn(
          "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-[#004d28] text-white shadow-2xl transition-transform duration-300 ease-in-out transform",
          isMobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <NavContent />
      </aside>

      {/* Desktop Persistent Sidebar */}
      <aside
        className={cn(
          "hidden lg:flex flex-col flex-shrink-0 bg-[#004d28] dark:bg-[#002f18] text-white border-r border-emerald-900/60 dark:border-zinc-800 transition-all duration-300 z-30 sticky top-0 h-screen",
          isCollapsed ? "w-20" : "w-64"
        )}
      >
        <NavContent />
      </aside>
    </>
  );
}
