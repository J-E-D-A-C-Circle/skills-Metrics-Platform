"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  MessageSquare,
  Send,
  Users,
  Search,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  History,
  MapPin,
  Sparkles,
  Phone,
  Eye,
  Copy,
  UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { GHANA_REGIONS } from "@/components/user-management";
import { cn } from "@/lib/utils";

interface CampaignItem {
  id: string;
  title: string;
  message: string;
  targetFilter?: string | null;
  totalRecipients: number;
  deliveredCount: number;
  failedCount: number;
  status: string;
  createdAt: string;
  createdBy: {
    fullName: string;
    staffId?: string | null;
    role: string;
  };
}

interface RecipientPreviewItem {
  key: string;
  name: string;
  phone: string;
  registrationNumber: string;
  reference: string;
  expiryDate: string;
  region: string;
  subtitle: string;
}

const QUICK_SMS_TEMPLATES = [
  {
    id: "expiry-warning",
    label: "Layoff Expiry Warning",
    audience: "APPLICANTS" as const,
    status: "EXPIRING_SOON",
    title: "Layoff Expiry Warning",
    message:
      "Dear [NAME], the layoff period for vehicle [REGISTRATION] (Ref: [REFERENCE]) expires on [EXPIRY_DATE]. Kindly apply for an extension or schedule a return-to-road inspection.",
  },
  {
    id: "payment-reminder",
    label: "Pending Invoice / Payment Reminder",
    audience: "APPLICANTS" as const,
    status: "APPROVED",
    title: "Pending Invoice / Payment Reminder",
    message:
      "Dear [NAME], your layoff invoice for vehicle [REGISTRATION] (Ref: [REFERENCE]) is ready for payment. Kindly complete payment via IPP Pro to activate your Off-Road status.",
  },
  {
    id: "inspection-readiness",
    label: "Physical Inspection Readiness Notice",
    audience: "APPLICANTS" as const,
    status: "INSPECTION_PENDING",
    title: "Physical Inspection Readiness Notice",
    message:
      "Dear [NAME], please ensure vehicle [REGISTRATION] (Ref: [REFERENCE]) is accessible at your declared storage location for physical DVLA inspection.",
  },
  {
    id: "officer-pending-reminder",
    label: "Technical Officer Pending Inspection Reminder",
    audience: "TECHNICAL_OFFICERS" as const,
    status: "ALL",
    title: "Technical Officer Pending Inspection Reminder",
    message:
      "Officer [NAME], kindly complete your pending vehicle inspection cases within the 4-day period else they will be released back into the pool.",
  },
];

const DYNAMIC_TAGS = [
  { tag: "[NAME]", desc: "Recipient Name" },
  { tag: "[REGISTRATION]", desc: "Vehicle Reg / Staff ID" },
  { tag: "[REFERENCE]", desc: "Layoff Reference (LAY-YEAR-CAR)" },
  { tag: "[EXPIRY_DATE]", desc: "Layoff Expiry Date" },
];

export function BulkSMSManager() {
  const [campaigns, setCampaigns] = useState<CampaignItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Campaign History Search & Pagination
  const [historySearch, setHistorySearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // View Campaign Modal
  const [viewingCampaign, setViewingCampaign] = useState<CampaignItem | null>(null);

  // Inline Broadcast Studio State (Always visible on the page!)
  const [audience, setAudience] = useState<"APPLICANTS" | "TECHNICAL_OFFICERS" | "STAFF_ALL" | "CUSTOM">("APPLICANTS");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("expiry-warning");
  const [title, setTitle] = useState("Layoff Expiry Warning");
  const [message, setMessage] = useState(
    "Dear [NAME], the layoff period for vehicle [REGISTRATION] (Ref: [REFERENCE]) expires on [EXPIRY_DATE]. Kindly apply for an extension or schedule a return-to-road inspection."
  );
  const [targetRegion, setTargetRegion] = useState("ALL");
  const [targetStatus, setTargetStatus] = useState("ALL");
  const [customNumbers, setCustomNumbers] = useState("");

  // Ref for inserting dynamic tags at the exact cursor position in the textarea
  const messageTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Interactive Recipient Checklist State
  const [estimating, setEstimating] = useState(false);
  const [matchedRecipients, setMatchedRecipients] = useState<RecipientPreviewItem[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [recipientFilter, setRecipientFilter] = useState("");

  // Quick Test SMS State
  const [testPhone, setTestPhone] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);

  // Dispatch State
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendSuccess, setSendSuccess] = useState<string | null>(null);

  const loadCampaigns = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sms-notifications/bulk");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCampaigns();
  }, []);

  const handleEstimateRecipients = async () => {
    if (audience === "CUSTOM") {
      setMatchedRecipients([]);
      setSelectedKeys([]);
      return;
    }
    setEstimating(true);
    try {
      const url = `/api/sms-notifications/bulk?action=estimate&audience=${audience}&region=${encodeURIComponent(
        targetRegion
      )}&status=${encodeURIComponent(targetStatus)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const list: RecipientPreviewItem[] = data.recipients || [];
        setMatchedRecipients(list);
        setSelectedKeys(list.map((r) => r.key));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setEstimating(false);
    }
  };

  useEffect(() => {
    handleEstimateRecipients();
  }, [audience, targetRegion, targetStatus]);

  // Apply a 1-click template
  const handleSelectTemplate = (tplId: string) => {
    const tpl = QUICK_SMS_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    setSelectedTemplateId(tpl.id);
    setAudience(tpl.audience);
    setTargetStatus(tpl.status);
    setTitle(tpl.title);
    setMessage(tpl.message);
    setSendError(null);
    setTestSuccessMsg(null);
  };

  // Insert dynamic placeholder tag at exact cursor position in message textarea
  const handleInsertTagAtCursor = (tag: string) => {
    const el = messageTextareaRef.current;
    if (!el) {
      setMessage((prev) => `${prev}${prev.endsWith(" ") || prev.length === 0 ? "" : " "}${tag}`);
      return;
    }

    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const before = message.slice(0, start);
    const after = message.slice(end);
    const nextValue = `${before}${tag}${after}`;
    setMessage(nextValue);

    requestAnimationFrame(() => {
      el.focus();
      const newCursorPos = start + tag.length;
      el.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  // Toggle individual recipient checkbox in checklist
  const handleToggleRecipient = (key: string) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const visibleRecipients = useMemo(() => {
    const q = recipientFilter.trim().toLowerCase();
    if (!q) return matchedRecipients;
    return matchedRecipients.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.registrationNumber.toLowerCase().includes(q) ||
        r.reference.toLowerCase().includes(q) ||
        r.subtitle.toLowerCase().includes(q)
    );
  }, [matchedRecipients, recipientFilter]);

  const customNumberList = useMemo(() => {
    return customNumbers
      .split(/[\n,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
  }, [customNumbers]);

  const activeTargetCount =
    audience === "CUSTOM" ? customNumberList.length : selectedKeys.length;

  // Send single Test SMS
  const handleSendTestSms = async () => {
    if (!testPhone.trim()) {
      setSendError("Please enter a phone number in the Test SMS field first.");
      return;
    }
    if (!message.trim()) {
      setSendError("Please enter message content first.");
      return;
    }

    setSendingTest(true);
    setSendError(null);
    setTestSuccessMsg(null);

    try {
      const res = await fetch("/api/sms-notifications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          region: targetRegion,
          testPhone: testPhone.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setTestSuccessMsg(data.message || `Test SMS sent to ${testPhone.trim()}`);
      } else {
        setSendError(data.error || "Failed to send test SMS.");
      }
    } catch (err) {
      console.error(err);
      setSendError("Network error while sending test SMS.");
    } finally {
      setSendingTest(false);
    }
  };

  // Dispatch Full Broadcast
  const handleDispatchCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      setSendError("Please provide both a Campaign Title and Message Content.");
      return;
    }

    if (activeTargetCount === 0) {
      setSendError("Please keep at least one recipient checked (or enter a custom phone number).");
      return;
    }

    if (!confirm(`Send this SMS broadcast to ${activeTargetCount} selected recipient(s)?`)) {
      return;
    }

    setSendError(null);
    setSendSuccess(null);
    setIsSending(true);

    try {
      const res = await fetch("/api/sms-notifications/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          message,
          audience,
          region: targetRegion,
          status: targetStatus,
          selectedKeys: audience !== "CUSTOM" ? selectedKeys : undefined,
          customNumbers: audience === "CUSTOM" ? customNumbers : undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setSendError(data.error || "Failed to dispatch campaign.");
        setIsSending(false);
        return;
      }

      setSendSuccess(`Broadcast "${data.title}" successfully dispatched to ${data.deliveredCount} recipient(s)!`);
      loadCampaigns();
    } catch (err) {
      console.error(err);
      setSendError("Network error occurred during dispatch.");
    } finally {
      setIsSending(false);
    }
  };

  // Sample preview using first checked recipient
  const samplePreviewPerson = useMemo(() => {
    const first = matchedRecipients.find((r) => selectedKeys.includes(r.key)) || matchedRecipients[0];
    return {
      name: first?.name || (audience === "TECHNICAL_OFFICERS" ? "Ing. Samuel Annan" : "Kofi Mensah"),
      reg: first?.registrationNumber || "GT-4920-22",
      ref: first?.reference || "LAY-2026-GT492022",
      exp: first?.expiryDate && first.expiryDate !== "N/A" ? first.expiryDate : "2026-12-31",
    };
  }, [matchedRecipients, selectedKeys, audience]);

  const filteredCampaigns = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return campaigns;
    return campaigns.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q) ||
        (c.createdBy?.fullName || "").toLowerCase().includes(q)
    );
  }, [campaigns, historySearch]);

  const paginatedCampaigns = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCampaigns.slice(start, start + pageSize);
  }, [filteredCampaigns, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#006837] inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
              SMS Broadcast &amp; Notification Centre
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Broadcast to Vehicle Applicants, Technical Officers &amp; Staff, or Single / Custom Phone Numbers with live recipient checkboxes and one-click templates.
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            loadCampaigns();
            handleEstimateRecipients();
          }}
          className="rounded-xl text-xs gap-1.5 h-10 self-start sm:self-auto"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", (loading || estimating) && "animate-spin")} />
          <span>Refresh Recipients &amp; Logs</span>
        </Button>
      </div>

      {/* Feedback Alerts */}
      {sendError && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
            <span>{sendError}</span>
          </div>
          <button onClick={() => setSendError(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {sendSuccess && (
        <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{sendSuccess}</span>
          </div>
          <button onClick={() => setSendSuccess(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {testSuccessMsg && (
        <div className="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-xs font-bold flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-blue-600 shrink-0" />
            <span>{testSuccessMsg}</span>
          </div>
          <button onClick={() => setTestSuccessMsg(null)} className="text-[11px] underline">
            Dismiss
          </button>
        </div>
      )}

      {/* ─── INLINE TWO-COLUMN INTERACTIVE SMS BROADCAST STUDIO ─── */}
      <form onSubmit={handleDispatchCampaign} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN (5 COLS): MULTI-AUDIENCE TARGETING, SMARTER FILTERS & INTERACTIVE RECIPIENT CHECKBOXES */}
        <Card className="lg:col-span-5 border-slate-200 dark:border-zinc-800 shadow-sm p-5 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            {/* 1. Multi-Audience Selector */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                <Users className="h-4 w-4 text-[#006837]" />
                1. Select Target Audience
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAudience("APPLICANTS");
                    setTargetStatus("ALL");
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    audience === "APPLICANTS"
                      ? "bg-[#006837] text-white border-[#006837] shadow-xs"
                      : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                  )}
                >
                  <Users className="h-4 w-4 mb-1" />
                  <p className="text-xs font-extrabold leading-tight">Vehicle Applicants</p>
                  <p className={cn("text-[10px] mt-0.5", audience === "APPLICANTS" ? "text-emerald-100" : "text-slate-400")}>
                    Filter by Region &amp; Status
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAudience("TECHNICAL_OFFICERS");
                    setTargetStatus("ALL");
                  }}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    audience === "TECHNICAL_OFFICERS" || audience === "STAFF_ALL"
                      ? "bg-[#006837] text-white border-[#006837] shadow-xs"
                      : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                  )}
                >
                  <UserCheck className="h-4 w-4 mb-1" />
                  <p className="text-xs font-extrabold leading-tight">Technical Officers &amp; Staff</p>
                  <p
                    className={cn(
                      "text-[10px] mt-0.5",
                      audience === "TECHNICAL_OFFICERS" || audience === "STAFF_ALL" ? "text-emerald-100" : "text-slate-400"
                    )}
                  >
                    By Region or Nationwide
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setAudience("CUSTOM")}
                  className={cn(
                    "p-3 rounded-xl border text-left transition-all cursor-pointer",
                    audience === "CUSTOM"
                      ? "bg-[#006837] text-white border-[#006837] shadow-xs"
                      : "bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300"
                  )}
                >
                  <Phone className="h-4 w-4 mb-1" />
                  <p className="text-xs font-extrabold leading-tight">Single / Custom Numbers</p>
                  <p className={cn("text-[10px] mt-0.5", audience === "CUSTOM" ? "text-emerald-100" : "text-slate-400")}>
                    Type or Paste Directly
                  </p>
                </button>
              </div>
            </div>

            {/* 2. Smarter Operational Filters OR Custom Numbers Box */}
            {audience === "CUSTOM" ? (
              <div className="space-y-2 pt-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Single / Custom Phone Numbers{" "}
                  <span className="text-slate-400 font-normal">(Separate with commas or new lines)</span>
                </label>
                <textarea
                  rows={5}
                  value={customNumbers}
                  onChange={(e) => setCustomNumbers(e.target.value)}
                  placeholder="Type or paste phone numbers here, e.g.&#10;0240767261&#10;0208123344"
                  className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600 font-mono"
                />
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-300 flex items-center justify-between">
                  <span>Custom Recipients Ready:</span>
                  <span>{customNumberList.length} Phone Number(s)</span>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Target Region</label>
                    <Select value={targetRegion} onValueChange={setTargetRegion}>
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ALL">All 16 Regions (Nationwide)</SelectItem>
                        {GHANA_REGIONS.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {audience === "APPLICANTS" ? (
                    <div className="space-y-1.5">
                      <label className="text-xs font-extrabold text-slate-700 dark:text-zinc-300">
                        Smarter Operational Filters
                      </label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { id: "ALL", label: "All Valid Applicants" },
                          { id: "EXPIRING_SOON", label: "Expiring Soon (≤ 30 Days)" },
                          { id: "EXPIRED", label: "Expired / Overdue Layoffs" },
                          { id: "INSPECTION_PENDING", label: "Awaiting Physical Inspection" },
                          { id: "APPROVED", label: "Pending Invoice / Payment" },
                          { id: "ACTIVE", label: "Active Layoffs (Off Road)" },
                        ].map((f) => {
                          const isActive = targetStatus === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => setTargetStatus(f.id)}
                              className={cn(
                                "px-2.5 py-2 rounded-xl border text-[11px] font-bold text-left transition-all cursor-pointer",
                                isActive
                                  ? "bg-[#006837] text-white border-[#006837] shadow-2xs"
                                  : "bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-emerald-400"
                              )}
                            >
                              {f.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Staff Role Group</label>
                      <Select value={audience} onValueChange={(v) => setAudience(v as any)}>
                        <SelectTrigger className="h-9 text-xs rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="TECHNICAL_OFFICERS">Technical Officers Only</SelectItem>
                          <SelectItem value="STAFF_ALL">All Staff (Officers, Compliance &amp; Admins)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>

                {/* 3. Interactive Recipient Preview & Checkboxes (No More Blind Sending) */}
                <div className="rounded-2xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 p-3.5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-extrabold text-slate-900 dark:text-zinc-100">
                        Interactive Recipient Preview ({selectedKeys.length} of {matchedRecipients.length} Checked)
                      </p>
                      <p className="text-[10px] text-slate-500">
                        Uncheck any person below to exclude them from this broadcast.
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setSelectedKeys(matchedRecipients.map((r) => r.key))}
                        className="text-[#006837] dark:text-emerald-400 hover:underline cursor-pointer"
                      >
                        Check All
                      </button>
                      <span className="text-slate-300">|</span>
                      <button
                        type="button"
                        onClick={() => setSelectedKeys([])}
                        className="text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
                      >
                        Uncheck All
                      </button>
                    </div>
                  </div>

                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input
                      value={recipientFilter}
                      onChange={(e) => setRecipientFilter(e.target.value)}
                      placeholder="Filter recipients by name, phone, vehicle reg, or role..."
                      className="h-8 pl-8 text-xs rounded-xl bg-white dark:bg-zinc-950"
                    />
                  </div>

                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {estimating ? (
                      <p className="text-xs text-slate-400 py-6 text-center animate-pulse">
                        Loading matched recipients...
                      </p>
                    ) : visibleRecipients.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">
                        No recipients matched this filter.
                      </p>
                    ) : (
                      visibleRecipients.map((r) => {
                        const isChecked = selectedKeys.includes(r.key);
                        return (
                          <label
                            key={r.key}
                            className={cn(
                              "flex items-center justify-between gap-2 p-2.5 rounded-xl border text-xs cursor-pointer transition-all",
                              isChecked
                                ? "bg-white dark:bg-zinc-900 border-emerald-300 dark:border-emerald-800/80 shadow-2xs"
                                : "bg-slate-100/60 dark:bg-zinc-950/40 border-slate-200/60 dark:border-zinc-800/50 opacity-60"
                            )}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleRecipient(r.key)}
                                className="h-4 w-4 rounded accent-[#006837] cursor-pointer shrink-0"
                              />
                              <div className="truncate">
                                <p className="font-extrabold text-slate-900 dark:text-zinc-100 truncate">{r.name}</p>
                                <p className="text-[10px] text-slate-500 truncate">{r.subtitle}</p>
                              </div>
                            </div>
                            <span className="font-mono text-[11px] font-bold text-[#006837] dark:text-emerald-400 shrink-0">
                              {r.phone}
                            </span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between text-xs">
            <span className="font-bold text-slate-700 dark:text-zinc-300">Active Broadcast Recipients:</span>
            <Badge variant="success" className="text-xs font-extrabold">
              {activeTargetCount} Selected
            </Badge>
          </div>
        </Card>

        {/* RIGHT COLUMN (7 COLS): ONE-CLICK TEMPLATES, DYNAMIC TAG PILLS AT CURSOR, MESSAGE BOX & SEND TEST SMS */}
        <Card className="lg:col-span-7 border-slate-200 dark:border-zinc-800 shadow-sm p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-4">
            {/* 1. One-Click Pre-Built Templates Selector */}
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <label className="text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4 text-[#006837]" />
                  2. One-Click Pre-Built Templates
                </label>

                <Select value={selectedTemplateId} onValueChange={handleSelectTemplate}>
                  <SelectTrigger className="w-full sm:w-72 h-8 text-xs rounded-xl">
                    <SelectValue placeholder="Choose a Quick Template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {QUICK_SMS_TEMPLATES.map((tpl) => (
                      <SelectItem key={tpl.id} value={tpl.id}>
                        {tpl.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {QUICK_SMS_TEMPLATES.map((tpl) => {
                  const isSelected = selectedTemplateId === tpl.id;
                  return (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => handleSelectTemplate(tpl.id)}
                      className={cn(
                        "text-left p-2.5 rounded-xl border text-xs transition-all cursor-pointer flex items-center justify-between gap-2",
                        isSelected
                          ? "bg-emerald-50 dark:bg-emerald-950/50 border-[#006837] text-[#006837] dark:text-emerald-300 font-extrabold"
                          : "bg-slate-50/70 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:border-slate-300 font-semibold"
                      )}
                    >
                      <span className="truncate">{tpl.label}</span>
                      <Badge
                        variant={tpl.audience === "TECHNICAL_OFFICERS" ? "warning" : "info"}
                        className="text-[9px] shrink-0"
                      >
                        {tpl.audience === "TECHNICAL_OFFICERS" ? "Officers" : "Applicants"}
                      </Badge>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Campaign Title */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Campaign Title *</label>
              <Input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Layoff Expiry Warning"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            {/* 3. Clickable Dynamic Tag Pills + Message Box */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  SMS Message Box *{" "}
                  <span className="text-[11px] font-normal text-slate-400">
                    (Click any pill below to insert at cursor)
                  </span>
                </label>
                <span className="text-[10px] font-mono text-slate-400">
                  {message.length} chars • {Math.max(1, Math.ceil(message.length / 160))} SMS segment(s)
                </span>
              </div>

              {/* Clickable Dynamic Tag Pills */}
              <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-xl bg-slate-100/80 dark:bg-zinc-900 border border-slate-200/80 dark:border-zinc-800">
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mr-1">
                  Insert Tag:
                </span>
                {DYNAMIC_TAGS.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    onClick={() => handleInsertTagAtCursor(item.tag)}
                    title={`Insert ${item.desc} at cursor`}
                    className="px-2.5 py-1 rounded-lg bg-white dark:bg-zinc-800 hover:bg-[#006837] hover:text-white border border-slate-200 dark:border-zinc-700 text-[11px] font-mono font-extrabold text-[#006837] dark:text-emerald-400 transition-colors cursor-pointer shadow-2xs"
                  >
                    + {item.tag}
                  </button>
                ))}
              </div>

              <textarea
                ref={messageTextareaRef}
                required
                rows={4}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type your SMS broadcast message here..."
                className="w-full text-xs p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-[#006837] font-sans leading-relaxed"
              />
            </div>

            {/* 4. Live Personalized SMS Preview + "Send Test SMS" Bar */}
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Live Personalized SMS Preview (for {samplePreviewPerson.name})
                </p>
                <p className="text-xs text-slate-800 dark:text-zinc-200 font-mono bg-white dark:bg-zinc-950 p-2.5 rounded-xl border border-slate-200/80 dark:border-zinc-800 leading-relaxed">
                  &quot;
                  {message
                    .replace(/\[NAME\]/g, samplePreviewPerson.name)
                    .replace(/\[REGISTRATION\]/g, samplePreviewPerson.reg)
                    .replace(/\[REFERENCE\]/g, samplePreviewPerson.ref)
                    .replace(/\[EXPIRY_DATE\]/g, samplePreviewPerson.exp)}
                  &quot;
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2.5 border-t border-slate-200/80 dark:border-zinc-800">
                <span className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">
                  Test message on one phone number before broadcasting:
                </span>
                <div className="flex items-center gap-2">
                  <Input
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    placeholder="Enter test phone (e.g. 0240767261)"
                    className="h-8 text-xs rounded-xl w-full sm:w-48 bg-white dark:bg-zinc-950"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={sendingTest}
                    onClick={handleSendTestSms}
                    className="h-8 text-xs font-bold rounded-xl shrink-0 border-emerald-600/40 text-[#006837] dark:text-emerald-400 hover:bg-emerald-50"
                  >
                    {sendingTest ? "Sending..." : "Send Test SMS"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* 5. Submit Broadcast Footer */}
          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <span className="text-xs text-slate-500">
              Broadcasting to <strong className="text-slate-900 dark:text-zinc-100">{activeTargetCount}</strong> checked recipient(s)
            </span>

            <Button
              type="submit"
              disabled={isSending || activeTargetCount === 0}
              className="rounded-xl text-xs font-extrabold bg-[#006837] hover:bg-[#004d28] text-white h-10 px-6 gap-2 shadow-md shadow-emerald-950/20"
            >
              <Send className="h-4 w-4" />
              <span>
                {isSending ? "Dispatching Broadcast..." : `Dispatch Broadcast (${activeTargetCount} Recipients)`}
              </span>
            </Button>
          </div>
        </Card>
      </form>

      {/* ─── DISPATCHED BROADCAST CAMPAIGNS HISTORY TABLE ─── */}
      <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="p-4 bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-zinc-300 flex items-center gap-2">
            <History className="h-4 w-4 text-[#006837]" />
            Dispatched Broadcast Campaigns History ({filteredCampaigns.length})
          </h3>

          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Search past campaigns..."
              className="h-8 pl-9 text-xs rounded-xl bg-white dark:bg-zinc-950"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-white dark:bg-zinc-900/60 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-extrabold uppercase text-slate-500 dark:text-zinc-400">
              <tr>
                <th className="px-5 py-3.5">Campaign Title &amp; Audience</th>
                <th className="px-5 py-3.5">Message Content</th>
                <th className="px-5 py-3.5">Recipients</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Sent By</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {loading && campaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 animate-pulse">
                    Loading bulk SMS campaigns...
                  </td>
                </tr>
              ) : filteredCampaigns.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-medium">
                    No SMS broadcast campaigns found. Use the broadcast studio above to dispatch your first campaign.
                  </td>
                </tr>
              ) : (
                paginatedCampaigns.map((c) => {
                  const filterObj = c.targetFilter ? JSON.parse(c.targetFilter) : {};
                  const audienceLabel =
                    filterObj.audience === "TECHNICAL_OFFICERS"
                      ? "Technical Officers"
                      : filterObj.audience === "STAFF_ALL"
                      ? "All Staff"
                      : filterObj.audience === "CUSTOM"
                      ? "Custom Phone Numbers"
                      : "Applicants";

                  return (
                    <tr key={c.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                      <td className="px-5 py-4">
                        <p className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">{c.title}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500">
                          <Badge variant="outline" className="text-[10px]">
                            {audienceLabel}
                          </Badge>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-emerald-600" />
                            {filterObj.region || "All Regions"}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 max-w-sm">
                        <p className="line-clamp-2 text-slate-700 dark:text-zinc-300 font-medium">{c.message}</p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">
                          {c.totalRecipients} recipient(s)
                        </p>
                        <p className="text-[11px] text-emerald-600 font-semibold">
                          {c.deliveredCount} delivered ({c.failedCount} failed)
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <Badge variant="success" className="font-bold text-[10px]">
                          {c.status}
                        </Badge>
                        <p className="text-[10px] text-slate-400 mt-1">
                          {new Date(c.createdAt).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </td>

                      <td className="px-5 py-4">
                        <p className="font-bold text-slate-800 dark:text-zinc-200">{c.createdBy?.fullName || "DVLA Admin"}</p>
                        <p className="text-[10px] text-slate-400">{c.createdBy?.staffId || "System Admin"}</p>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewingCampaign(c)}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 text-slate-700 dark:text-zinc-200 transition-colors cursor-pointer"
                            title="View Campaign Details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setTitle(`${c.title} (Copy)`);
                              setMessage(c.message);
                              window.scrollTo({ top: 0, behavior: "smooth" });
                            }}
                            className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-[#006837] dark:text-emerald-400 transition-colors cursor-pointer"
                            title="Load into Broadcast Composer"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={page}
          totalItems={filteredCampaigns.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="broadcast campaigns"
        />
      </Card>

      {/* ─── VIEW PAST CAMPAIGN MODAL ─── */}
      {viewingCampaign && (
        <Dialog
          isOpen={Boolean(viewingCampaign)}
          onClose={() => setViewingCampaign(null)}
          title={viewingCampaign.title}
          description={`Dispatched by ${viewingCampaign.createdBy?.fullName || "DVLA Admin"} on ${new Date(
            viewingCampaign.createdAt
          ).toLocaleString("en-GB")}`}
          maxWidth="max-w-lg"
        >
          <div className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800">
              <div>
                <p className="text-slate-500">Total Recipients</p>
                <p className="text-base font-black text-slate-900 dark:text-zinc-100">{viewingCampaign.totalRecipients}</p>
              </div>
              <div>
                <p className="text-slate-500">Delivered</p>
                <p className="text-base font-black text-emerald-600">{viewingCampaign.deliveredCount}</p>
              </div>
              <div>
                <p className="text-slate-500">Failed</p>
                <p className="text-base font-black text-rose-600">{viewingCampaign.failedCount}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="font-extrabold text-slate-700 dark:text-zinc-300">Broadcast Message</p>
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 text-slate-800 dark:text-zinc-200 leading-relaxed whitespace-pre-wrap">
                {viewingCampaign.message}
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setViewingCampaign(null)}
                className="rounded-xl text-xs"
              >
                Close
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const c = viewingCampaign;
                  setViewingCampaign(null);
                  setTitle(`${c.title} (Copy)`);
                  setMessage(c.message);
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white gap-1.5"
              >
                <Copy className="h-3.5 w-3.5" />
                Reuse This Message
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
