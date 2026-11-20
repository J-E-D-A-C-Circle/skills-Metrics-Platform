"use client";

import React, { useState, useEffect } from "react";
import {
  FileText,
  CreditCard,
  Wrench,
  CalendarCheck,
  Phone,
  ShieldCheck,
  Clock,
  User,
  Bot,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Plus,
  Send,
  Search,
  RefreshCw,
  ExternalLink,
  MessageSquare
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface ActivityItem {
  id: string;
  applicationId: string;
  category: "APPLICATION" | "PAYMENT" | "INSPECTION" | "EXTENSION" | "COMMUNICATION" | "ADMINISTRATIVE" | string;
  action: string;
  description: string;
  actorName: string;
  actorRole: string;
  source: "APPLICANT" | "ADMINISTRATOR" | "TECHNICAL_OFFICER" | "SYSTEM_AUTOMATION" | string;
  previousValue?: string | null;
  newValue?: string | null;
  referenceNumber?: string | null;
  metadata?: string | null;
  timestamp: string;
}

interface ActivityTimelineProps {
  applicationId: string;
  registrationNumber?: string;
  currentUserRole?: string;
  currentUserName?: string;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: React.ElementType; color: string; bg: string; border: string }
> = {
  APPLICATION: {
    label: "Application Lifecycle",
    icon: FileText,
    color: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    border: "border-blue-200 dark:border-blue-800/60",
  },
  PAYMENT: {
    label: "Invoicing & Revenue",
    icon: CreditCard,
    color: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-950/40",
    border: "border-emerald-200 dark:border-emerald-800/60",
  },
  INSPECTION: {
    label: "Technical Inspection",
    icon: Wrench,
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-950/40",
    border: "border-amber-200 dark:border-amber-800/60",
  },
  EXTENSION: {
    label: "Layoff Extension",
    icon: CalendarCheck,
    color: "text-purple-600 dark:text-purple-400",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    border: "border-purple-200 dark:border-purple-800/60",
  },
  COMMUNICATION: {
    label: "SMS & Notifications",
    icon: Phone,
    color: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    border: "border-cyan-200 dark:border-cyan-800/60",
  },
  ADMINISTRATIVE: {
    label: "Administrative Action",
    icon: ShieldCheck,
    color: "text-[#006837] dark:text-emerald-400",
    bg: "bg-emerald-50/70 dark:bg-emerald-950/30",
    border: "border-emerald-200 dark:border-emerald-800/60",
  },
};

export function ActivityTimeline({
  applicationId,
  registrationNumber,
  currentUserRole = "DVLA Administrator",
  currentUserName = "Chief Supt. Osei Tutu",
}: ActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("ALL");
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  // Manual note form
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newRemark, setNewRemark] = useState("");
  const [remarkCategory, setRemarkCategory] = useState("ADMINISTRATIVE");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  const loadActivities = async () => {
    setLoading(true);
    try {
      const url = `/api/applications/${applicationId}/activities${
        categoryFilter !== "ALL" ? `?category=${categoryFilter}` : ""
      }`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setActivities(data);
      }
    } catch (err) {
      console.error("Failed to load application activity log:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (applicationId) {
      loadActivities();
    }
  }, [applicationId, categoryFilter]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddRemark = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRemark.trim()) return;
    setIsSubmittingNote(true);

    try {
      const res = await fetch(`/api/applications/${applicationId}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: remarkCategory,
          action: "ADMINISTRATIVE_REMARK_ADDED",
          description: newRemark.trim(),
          actorName: currentUserName,
          actorRole: currentUserRole,
          referenceNumber: registrationNumber || applicationId,
        }),
      });

      if (res.ok) {
        setNewRemark("");
        setIsAddingNote(false);
        loadActivities();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingNote(false);
    }
  };

  const filtered = activities.filter((act) => {
    if (sourceFilter !== "ALL" && act.source !== sourceFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchDesc = act.description.toLowerCase().includes(q);
      const matchActor = act.actorName.toLowerCase().includes(q);
      const matchAction = act.action.toLowerCase().includes(q);
      return matchDesc || matchActor || matchAction;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Top Filter and Actions Toolbar */}
      <div className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-2xl p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40 h-8 text-xs rounded-xl bg-white dark:bg-zinc-800">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="APPLICATION">Application</SelectItem>
              <SelectItem value="PAYMENT">Invoicing &amp; Payment</SelectItem>
              <SelectItem value="INSPECTION">Inspection</SelectItem>
              <SelectItem value="EXTENSION">Extension</SelectItem>
              <SelectItem value="COMMUNICATION">SMS &amp; Notice</SelectItem>
              <SelectItem value="ADMINISTRATIVE">Administrative</SelectItem>
            </SelectContent>
          </Select>

          {/* Source Filter */}
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="w-36 h-8 text-xs rounded-xl bg-white dark:bg-zinc-800">
              <SelectValue placeholder="All Sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Sources</SelectItem>
              <SelectItem value="ADMINISTRATOR">Administrator</SelectItem>
              <SelectItem value="TECHNICAL_OFFICER">Technical Officer</SelectItem>
              <SelectItem value="APPLICANT">Applicant</SelectItem>
              <SelectItem value="SYSTEM_AUTOMATION">Automated System</SelectItem>
            </SelectContent>
          </Select>

          {/* Search box */}
          <div className="relative flex-1 min-w-[140px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search logs..."
              className="h-8 pl-8 text-xs rounded-xl bg-white dark:bg-zinc-800"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Button
            size="sm"
            variant="outline"
            onClick={loadActivities}
            className="h-8 rounded-xl text-xs gap-1"
            title="Refresh Timeline"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            size="sm"
            onClick={() => setIsAddingNote(!isAddingNote)}
            className="h-8 rounded-xl text-xs bg-[#006837] hover:bg-[#004d28] text-white gap-1"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Remark</span>
          </Button>
        </div>
      </div>

      {/* Manual Remark Submission Box */}
      {isAddingNote && (
        <form
          onSubmit={handleAddRemark}
          className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-2xl p-4 space-y-3 animate-fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#006837] dark:text-emerald-400 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Add Official Administrative Remark to Application History
            </span>
            <Select value={remarkCategory} onValueChange={setRemarkCategory}>
              <SelectTrigger className="w-36 h-7 text-xs rounded-lg bg-white dark:bg-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ADMINISTRATIVE">Administrative</SelectItem>
                <SelectItem value="INSPECTION">Inspection Note</SelectItem>
                <SelectItem value="PAYMENT">Billing Note</SelectItem>
                <SelectItem value="EXTENSION">Extension Note</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <textarea
            required
            rows={3}
            placeholder="Type administrative finding, verification note, or statutory remark here..."
            value={newRemark}
            onChange={(e) => setNewRemark(e.target.value)}
            className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
          />

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsAddingNote(false)}
              className="h-8 rounded-xl text-xs"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmittingNote}
              size="sm"
              className="h-8 rounded-xl text-xs bg-[#006837] hover:bg-[#004d28] text-white gap-1.5"
            >
              <Send className="h-3 w-3" />
              <span>{isSubmittingNote ? "Recording..." : "Record in Activity Log"}</span>
            </Button>
          </div>
        </form>
      )}

      {/* Timeline Events List */}
      <div className="relative pl-6 sm:pl-8 space-y-4 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200 dark:before:bg-zinc-800">
        {loading && activities.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 animate-pulse">
            Loading comprehensive activity timeline...
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400 dark:text-zinc-500 bg-slate-50 dark:bg-zinc-900/40 rounded-2xl border border-slate-100 dark:border-zinc-800">
            No activity records matched the active filter criteria.
          </div>
        ) : (
          filtered.map((item) => {
            const config = CATEGORY_CONFIG[item.category] || CATEGORY_CONFIG.ADMINISTRATIVE;
            const Icon = config.icon;
            const isExpanded = expandedIds.has(item.id);
            const isSystem = item.source === "SYSTEM_AUTOMATION";

            const formattedTime = new Date(item.timestamp).toLocaleString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div key={item.id} className="relative group">
                {/* Node Dot / Icon */}
                <div
                  className={cn(
                    "absolute -left-6 sm:-left-8 top-1 h-6 w-6 sm:h-8 sm:w-8 rounded-full border flex items-center justify-center shadow-xs transition-transform group-hover:scale-110",
                    config.bg,
                    config.border,
                    config.color
                  )}
                >
                  <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                </div>

                {/* Timeline Card */}
                <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-4 shadow-xs transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-zinc-700">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800/60 pb-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-extrabold text-xs text-slate-900 dark:text-zinc-100">
                        {item.action.replace(/_/g, " ")}
                      </span>
                      <Badge variant="outline" className={cn("text-[10px] font-bold px-2 py-0.5", config.color)}>
                        {config.label}
                      </Badge>
                      {item.referenceNumber && (
                        <span className="font-mono text-[10px] text-slate-400 dark:text-zinc-500 bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-md">
                          Ref: {item.referenceNumber}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                      <Clock className="h-3 w-3 text-slate-400" />
                      <span>{formattedTime}</span>
                    </div>
                  </div>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-slate-800 dark:text-zinc-200 mt-2 font-medium leading-relaxed">
                    {item.description}
                  </p>

                  {/* Previous vs New State Diff if present */}
                  {(item.previousValue || item.newValue) && (
                    <div className="mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 text-[11px] flex items-center gap-2">
                      <span className="text-slate-400">State Transition:</span>
                      <span className="line-through text-slate-500 font-semibold">{item.previousValue || "Initial"}</span>
                      <span className="text-slate-400 font-bold">→</span>
                      <span className="text-emerald-600 dark:text-emerald-400 font-black">{item.newValue}</span>
                    </div>
                  )}

                  {/* Footer Actor & Expand Toggle */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-zinc-800/60 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 dark:text-zinc-400">
                      {isSystem ? (
                        <Bot className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400" />
                      ) : (
                        <User className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      )}
                      <span className="font-bold text-slate-800 dark:text-zinc-200">{item.actorName}</span>
                      <span>({item.actorRole})</span>
                    </div>

                    {item.metadata && (
                      <button
                        onClick={() => toggleExpand(item.id)}
                        className="text-[11px] text-[#006837] dark:text-emerald-400 font-bold hover:underline flex items-center gap-0.5"
                      >
                        <span>{isExpanded ? "Hide Metadata" : "View Details"}</span>
                        {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </button>
                    )}
                  </div>

                  {/* Expanded Metadata */}
                  {isExpanded && item.metadata && (
                    <div className="mt-2.5 p-3 rounded-xl bg-slate-900 text-emerald-300 font-mono text-[10px] overflow-x-auto">
                      <pre>{JSON.stringify(JSON.parse(item.metadata), null, 2)}</pre>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
