"use client";

import React, { useState, useEffect } from "react";
import {
  LifeBuoy,
  PlusCircle,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertCircle,
  MessageSquare,
  User,
  Phone,
  Mail,
  Car,
  RefreshCw,
  Send,
  ShieldCheck,
  FileText,
  Trash2,
  Check,
  Eye
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";

export interface HelplineTicketItem {
  id: string;
  ticketNumber: string;
  applicantName: string;
  applicantPhone: string;
  applicantEmail?: string | null;
  registrationNumber?: string | null;
  applicationReference?: string | null;
  category: string;
  subject: string;
  description: string;
  priority: string;
  status: string;
  assignedOfficerId?: string | null;
  assignedOfficer?: {
    id: string;
    fullName: string;
    staffId?: string | null;
    role: string;
    phone: string;
  } | null;
  resolutionNotes?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export function HelplineManager() {
  const [tickets, setTickets] = useState<HelplineTicketItem[]>([]);
  const [officers, setOfficers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState("ALL");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, categoryFilter]);

  // Create Ticket Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [applicantName, setApplicantName] = useState("");
  const [applicantPhone, setApplicantPhone] = useState("+233 ");
  const [applicantEmail, setApplicantEmail] = useState("");
  const [registrationNumber, setRegistrationNumber] = useState("");
  const [applicationReference, setApplicationReference] = useState("");
  const [category, setCategory] = useState("ENQUIRY");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("Medium");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Ticket Detail / Resolution Modal
  const [selectedTicket, setSelectedTicket] = useState<HelplineTicketItem | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [updateStatus, setUpdateStatus] = useState("");
  const [updatePriority, setUpdatePriority] = useState("");
  const [assignedOfficerId, setAssignedOfficerId] = useState("");
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  const loadTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/helpline");
      if (res.ok) {
        const data = await res.json();
        setTickets(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadOfficers = async () => {
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setOfficers(data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTickets();
    loadOfficers();
  }, []);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applicantName.trim() || !applicantPhone.trim() || !subject.trim() || !description.trim()) return;
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/helpline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantName,
          applicantPhone,
          applicantEmail,
          registrationNumber,
          applicationReference,
          category,
          subject,
          description,
          priority,
        }),
      });

      if (res.ok) {
        setIsCreateOpen(false);
        setApplicantName("");
        setApplicantPhone("+233 ");
        setSubject("");
        setDescription("");
        loadTickets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenTicket = (ticket: HelplineTicketItem) => {
    setSelectedTicket(ticket);
    setUpdateStatus(ticket.status);
    setUpdatePriority(ticket.priority);
    setAssignedOfficerId(ticket.assignedOfficerId || "");
    setResolutionNotes(ticket.resolutionNotes || "");
    setIsDetailOpen(true);
  };

  const handleSaveTicketUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTicket) return;
    setIsUpdating(true);

    try {
      const res = await fetch(`/api/helpline/${selectedTicket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: updateStatus,
          priority: updatePriority,
          assignedOfficerId: assignedOfficerId || null,
          resolutionNotes,
        }),
      });

      if (res.ok) {
        setIsDetailOpen(false);
        setSelectedTicket(null);
        loadTickets();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleQuickStatusUpdate = async (ticket: HelplineTicketItem, newStatus: string) => {
    try {
      const res = await fetch(`/api/helpline/${ticket.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          resolutionNotes:
            newStatus === "Resolved" && !ticket.resolutionNotes
              ? "Issue reviewed and resolved by DVLA Support Desk."
              : ticket.resolutionNotes,
        }),
      });
      if (res.ok) {
        loadTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm("Are you sure you want to delete this support ticket?")) return;
    try {
      const res = await fetch(`/api/helpline/${ticketId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        if (selectedTicket?.id === ticketId) {
          setIsDetailOpen(false);
          setSelectedTicket(null);
        }
        loadTickets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // KPI Metrics
  const openCount = tickets.filter((t) => t.status === "Open").length;
  const inProgressCount = tickets.filter((t) => t.status === "In Progress").length;
  const resolvedCount = tickets.filter((t) => t.status === "Resolved" || t.status === "Closed").length;
  const escalatedCount = tickets.filter((t) => t.status === "Escalated").length;

  const filteredTickets = tickets.filter((t) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      t.ticketNumber.toLowerCase().includes(q) ||
      t.applicantName.toLowerCase().includes(q) ||
      t.applicantPhone.toLowerCase().includes(q) ||
      (t.registrationNumber && t.registrationNumber.toLowerCase().includes(q)) ||
      (t.applicationReference && t.applicationReference.toLowerCase().includes(q)) ||
      t.subject.toLowerCase().includes(q);

    const matchStatus = statusFilter === "ALL" || t.status === statusFilter;
    const matchCategory = categoryFilter === "ALL" || t.category === categoryFilter;

    return matchSearch && matchStatus && matchCategory;
  });

  const paginatedTickets = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredTickets.slice(start, start + pageSize);
  }, [filteredTickets, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#006837] inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
              Helpline, Enquiries &amp; Complaints Centre
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Resolve citizen complaints, track officer assignments, monitor SLAs, and dispatch automated SMS resolution notifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadTickets} className="rounded-xl text-xs gap-1.5 h-10">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            onClick={() => setIsCreateOpen(true)}
            className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white shadow-md shadow-emerald-950/20 gap-2 h-10 px-4"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Log Enquiry / Ticket</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-2xl border p-4 bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Open Tickets</p>
          <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{openCount}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">In Progress</p>
          <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{inProgressCount}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Escalated</p>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{escalatedCount}</p>
        </div>
        <div className="rounded-2xl border p-4 bg-white dark:bg-[#121212] border-slate-200 dark:border-zinc-800 space-y-1">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Resolved</p>
          <p className="text-2xl font-black text-[#006837] dark:text-emerald-400">{resolvedCount}</p>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search ticket #, applicant, phone, reg..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-36 h-10 text-xs rounded-xl">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Statuses</SelectItem>
              <SelectItem value="Open">Open</SelectItem>
              <SelectItem value="In Progress">In Progress</SelectItem>
              <SelectItem value="Escalated">Escalated</SelectItem>
              <SelectItem value="Resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>

          {/* Category Filter */}
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-44 h-10 text-xs rounded-xl">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Categories</SelectItem>
              <SelectItem value="ENQUIRY">General Enquiry</SelectItem>
              <SelectItem value="PAYMENT_ISSUE">Payment / IPP Issue</SelectItem>
              <SelectItem value="INSPECTION_DELAY">Inspection Delay</SelectItem>
              <SelectItem value="COMPLAINT">Formal Complaint</SelectItem>
              <SelectItem value="GENERAL">General Support</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tickets Table */}
      <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Ticket # &amp; Category</th>
                <th className="px-5 py-3.5">Applicant &amp; Phone</th>
                <th className="px-5 py-3.5">Subject &amp; Vehicle</th>
                <th className="px-5 py-3.5">Assigned Officer</th>
                <th className="px-5 py-3.5">Status &amp; Priority</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {loading && tickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 animate-pulse">
                    Loading helpline tickets...
                  </td>
                </tr>
              ) : filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-medium">
                    No enquiries or tickets match your active filter.
                  </td>
                </tr>
              ) : (
                paginatedTickets.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors">
                    <td className="px-5 py-4">
                      <p className="font-extrabold text-slate-900 dark:text-zinc-100 font-mono text-sm">
                        {t.ticketNumber}
                      </p>
                      <Badge variant="outline" className="text-[10px] font-bold mt-1">
                        {t.category.replace("_", " ")}
                      </Badge>
                    </td>

                    <td className="px-5 py-4">
                      <p className="font-bold text-slate-800 dark:text-zinc-200">{t.applicantName}</p>
                      <p className="text-[11px] text-emerald-600 flex items-center gap-1 mt-0.5">
                        <Phone className="h-3 w-3" />
                        {t.applicantPhone}
                      </p>
                    </td>

                    <td className="px-5 py-4 max-w-xs">
                      <p className="font-extrabold text-slate-900 dark:text-zinc-100 truncate">{t.subject}</p>
                      <p className="text-xs text-slate-600 dark:text-zinc-400 line-clamp-2 mt-0.5">{t.description}</p>
                      {t.registrationNumber && (
                        <p className="text-[11px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                          <Car className="h-3 w-3 text-slate-400" />
                          {t.registrationNumber}
                        </p>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      {t.assignedOfficer ? (
                        <div>
                          <p className="font-bold text-slate-800 dark:text-zinc-200">{t.assignedOfficer.fullName}</p>
                          <p className="text-[10px] text-slate-400">{t.assignedOfficer.role.replace("_", " ")}</p>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 italic">Unassigned</span>
                      )}
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            t.status === "Resolved"
                              ? "success"
                              : t.status === "In Progress"
                              ? "warning"
                              : t.status === "Escalated"
                              ? "danger"
                              : "default"
                          }
                          className="font-bold text-[10px]"
                        >
                          {t.status}
                        </Badge>
                        <span
                          className={cn(
                            "text-[10px] font-extrabold px-1.5 py-0.5 rounded-md",
                            t.priority === "Urgent"
                              ? "bg-rose-100 text-rose-800"
                              : t.priority === "High"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-slate-100 text-slate-600"
                          )}
                        >
                          {t.priority}
                        </span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleOpenTicket(t)}
                          className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-zinc-200 font-bold transition-colors cursor-pointer"
                          title="View & Manage Ticket"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        {t.status !== "Resolved" && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(t, "Resolved")}
                            className="p-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold transition-colors cursor-pointer"
                            title="Mark Resolved"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {t.status === "Open" && (
                          <button
                            type="button"
                            onClick={() => handleQuickStatusUpdate(t, "In Progress")}
                            className="p-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-800 font-bold transition-colors cursor-pointer"
                            title="Mark In Progress"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleDeleteTicket(t.id)}
                          className="p-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold transition-colors cursor-pointer"
                          title="Delete Ticket"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          currentPage={page}
          totalItems={filteredTickets.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="tickets"
        />
      </Card>

      {/* CREATE TICKET MODAL */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register Citizen Enquiry or Complaint"
        description="Captures applicant phone, vehicle registration, and issues an immediate SMS tracking confirmation."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateTicket} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Applicant Full Name</label>
              <Input
                required
                value={applicantName}
                onChange={(e) => setApplicantName(e.target.value)}
                placeholder="e.g. Ama Mensah"
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Contact Phone Number</label>
              <Input
                required
                value={applicantPhone}
                onChange={(e) => setApplicantPhone(e.target.value)}
                placeholder="+233 24 000 0000"
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Vehicle Registration Number</label>
              <Input
                value={registrationNumber}
                onChange={(e) => setRegistrationNumber(e.target.value)}
                placeholder="e.g. GT-4920-22"
                className="h-9 text-xs rounded-xl font-mono uppercase"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Application Reference (If known)</label>
              <Input
                value={applicationReference}
                onChange={(e) => setApplicationReference(e.target.value)}
                placeholder="e.g. LAY-2026-5322"
                className="h-9 text-xs rounded-xl font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Category</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ENQUIRY">General Layoff Enquiry</SelectItem>
                  <SelectItem value="PAYMENT_ISSUE">Invoice / Payment Issue</SelectItem>
                  <SelectItem value="INSPECTION_DELAY">Technical Inspection Delay</SelectItem>
                  <SelectItem value="COMPLAINT">Service Complaint</SelectItem>
                  <SelectItem value="GENERAL">General Support</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Priority Level</label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low Priority</SelectItem>
                  <SelectItem value="Medium">Medium Priority</SelectItem>
                  <SelectItem value="High">High Priority</SelectItem>
                  <SelectItem value="Urgent">Urgent / Time-Sensitive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Subject</label>
            <Input
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Brief summary of enquiry..."
              className="h-9 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Detailed Description</label>
            <textarea
              required
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Provide exact details of the enquiry, inspection request, or complaint..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              size="sm"
              className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white h-9 px-5"
            >
              {isSubmitting ? "Registering..." : "Submit Ticket"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* MANAGE TICKET DETAIL MODAL */}
      <Dialog
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={`Ticket: ${selectedTicket?.ticketNumber}`}
        description={`Applicant: ${selectedTicket?.applicantName} (${selectedTicket?.applicantPhone})`}
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleSaveTicketUpdate} className="space-y-4 pt-2">
          {/* Issue Summary */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-1">
            <p className="font-extrabold text-xs text-slate-900 dark:text-zinc-100">{selectedTicket?.subject}</p>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">{selectedTicket?.description}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Ticket Status</label>
              <Select value={updateStatus} onValueChange={setUpdateStatus}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Open">Open</SelectItem>
                  <SelectItem value="In Progress">In Progress</SelectItem>
                  <SelectItem value="Escalated">Escalated</SelectItem>
                  <SelectItem value="Resolved">Resolved</SelectItem>
                  <SelectItem value="Closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Priority</label>
              <Select value={updatePriority} onValueChange={setUpdatePriority}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Low">Low</SelectItem>
                  <SelectItem value="Medium">Medium</SelectItem>
                  <SelectItem value="High">High</SelectItem>
                  <SelectItem value="Urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Assign Officer</label>
              <Select value={assignedOfficerId} onValueChange={setAssignedOfficerId}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue placeholder="Select Officer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Unassigned</SelectItem>
                  {officers.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.fullName} ({o.role.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
              Resolution Notes <span className="text-slate-400">(Sent via SMS when marked Resolved)</span>
            </label>
            <textarea
              rows={3}
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              placeholder="Action taken or response to applicant..."
              className="w-full text-xs p-3 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-1 focus:ring-emerald-600"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsDetailOpen(false)}
              className="rounded-xl text-xs h-9"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isUpdating}
              size="sm"
              className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white h-9 px-5"
            >
              {isUpdating ? "Saving..." : "Update Ticket"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
