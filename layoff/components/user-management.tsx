"use client";

import React, { useState, useEffect } from "react";
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Shield,
  Wrench,
  CheckCircle2,
  XCircle,
  KeyRound,
  Edit,
  Phone,
  Mail,
  MapPin,
  Building2,
  RefreshCw,
  AlertCircle,
  Eye,
  EyeOff,
  Trash2,
  X,
  Plus
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { TablePagination } from "@/components/ui/table-pagination";
import { cn } from "@/lib/utils";
import {
  GHANA_REGIONS,
  DEFAULT_DVLA_STATIONS,
  DVLAStation,
  groupStationsByRegion,
} from "@/lib/stations-data";

export { GHANA_REGIONS };
export const REGIONAL_STATIONS: Record<string, string[]> = groupStationsByRegion(DEFAULT_DVLA_STATIONS);

export interface UserItem {
  id: string;
  fullName: string;
  staffId?: string | null;
  email: string;
  phone: string;
  role: "ADMINISTRATOR" | "TECHNICAL_OFFICER" | "COMPLIANCE_OFFICER" | string;
  region: string;
  stationLocation: string;
  isActive: boolean;
  lastLoginAt?: string | null;
  createdAt: string;
}

export function UserManagement() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [regionFilter, setRegionFilter] = useState("ALL");

  // Table Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, roleFilter, regionFilter]);

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createRole, setCreateRole] = useState("TECHNICAL_OFFICER");
  const [fullName, setFullName] = useState("");
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+233 ");
  const [region, setRegion] = useState("Greater Accra");
  const [stationLocation, setStationLocation] = useState("DVLA 37 Head Office");
  const [initialPassword, setInitialPassword] = useState("Password@123");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit / Password Reset Modal
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editRegion, setEditRegion] = useState("");
  const [editStation, setEditStation] = useState("");
  const [editRole, setEditRole] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [userToDelete, setUserToDelete] = useState<UserItem | null>(null);
  const [userToast, setUserToast] = useState<{ type: "success" | "error"; title: string; message: string } | null>(null);

  // DVLA Stations Management State
  const [stations, setStations] = useState<DVLAStation[]>(DEFAULT_DVLA_STATIONS);
  const [stationsByRegion, setStationsByRegion] = useState<Record<string, string[]>>(
    groupStationsByRegion(DEFAULT_DVLA_STATIONS)
  );
  const [isStationModalOpen, setIsStationModalOpen] = useState(false);
  const [newStationName, setNewStationName] = useState("");
  const [newStationRegion, setNewStationRegion] = useState("Greater Accra");
  const [newStationCode, setNewStationCode] = useState("");
  const [newStationAddress, setNewStationAddress] = useState("");
  const [newStationPhone, setNewStationPhone] = useState("+233 30 ");
  const [stationFilterRegion, setStationFilterRegion] = useState("ALL");
  const [isAddingStation, setIsAddingStation] = useState(false);
  const [deletingStationId, setDeletingStationId] = useState<string | null>(null);
  const [stationFormError, setStationFormError] = useState<string | null>(null);

  const loadStations = async () => {
    try {
      const res = await fetch("/api/stations");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stations)) setStations(data.stations);
        if (data.byRegion) setStationsByRegion(data.byRegion);
      }
    } catch (err) {
      console.error("Failed to fetch DVLA stations:", err);
    }
  };

  useEffect(() => {
    if (!userToast) return;
    const t = setTimeout(() => setUserToast(null), 4500);
    return () => clearTimeout(t);
  }, [userToast]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
    loadStations();
  }, []);

  const handleAddStation = async (e: React.FormEvent) => {
    e.preventDefault();
    setStationFormError(null);
    if (!newStationName.trim() || !newStationRegion.trim()) {
      setStationFormError("Please enter a station name and select its region.");
      return;
    }

    setIsAddingStation(true);
    try {
      const res = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newStationName.trim(),
          region: newStationRegion,
          code: newStationCode.trim(),
          address: newStationAddress.trim(),
          phone: newStationPhone.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setStationFormError(data.error || "Failed to add DVLA station.");
        setIsAddingStation(false);
        return;
      }

      if (Array.isArray(data.stations)) setStations(data.stations);
      if (data.byRegion) setStationsByRegion(data.byRegion);

      // Also pre-select the newly created station if creating/editing an officer in that region
      if (region === newStationRegion) {
        setStationLocation(data.station.name);
      }
      if (editRegion === newStationRegion) {
        setEditStation(data.station.name);
      }

      setNewStationName("");
      setNewStationCode("");
      setNewStationAddress("");
      setNewStationPhone("+233 30 ");

      setUserToast({
        type: "success",
        title: "DVLA Station Registered",
        message: `${data.station.name} (${data.station.code}) has been added to ${data.station.region} Region.`,
      });
    } catch (err) {
      console.error(err);
      setStationFormError("Network error while adding station.");
    } finally {
      setIsAddingStation(false);
    }
  };

  const handleDeleteStation = async (stn: DVLAStation) => {
    setDeletingStationId(stn.id);
    try {
      const res = await fetch(`/api/stations?id=${encodeURIComponent(stn.id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.stations)) setStations(data.stations);
        if (data.byRegion) setStationsByRegion(data.byRegion);
        setUserToast({
          type: "success",
          title: "Station Removed",
          message: `${stn.name} has been removed from ${stn.region}.`,
        });
      } else {
        setUserToast({
          type: "error",
          title: "Removal Failed",
          message: data.error || "Failed to remove station.",
        });
      }
    } catch (err) {
      console.error(err);
      setUserToast({
        type: "error",
        title: "Network Error",
        message: "Error removing DVLA station.",
      });
    } finally {
      setDeletingStationId(null);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          staffId,
          email,
          phone,
          role: createRole,
          region,
          stationLocation,
          password: initialPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setFormError(data.error || "Failed to create user account.");
        setIsSubmitting(false);
        return;
      }

      setIsCreateOpen(false);
      // Reset form
      setFullName("");
      setStaffId("");
      setEmail("");
      setPhone("+233 ");
      setUserToast({
        type: "success",
        title: createRole === "ADMINISTRATOR" ? "Admin Account Created" : "Staff Account Created",
        message: `${fullName} (${createRole.replace("_", " ")}) has been registered.`,
      });
      loadUsers();
    } catch (err) {
      console.error(err);
      setFormError("Connection error while creating user.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (user: UserItem) => {
    setSelectedUser(user);
    setEditPhone(user.phone);
    setEditRegion(user.region);
    setEditStation(user.stationLocation);
    setEditRole(user.role);
    setNewPassword("");
    setIsEditOpen(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setIsUpdating(true);

    try {
      const payload: any = {
        phone: editPhone,
        region: editRegion,
        stationLocation: editStation,
        role: editRole,
      };
      if (newPassword.trim()) {
        payload.password = newPassword.trim();
      }

      const res = await fetch(`/api/users/${selectedUser.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsEditOpen(false);
        setSelectedUser(null);
        loadUsers();
      } else {
        alert("Failed to update user.");
      }
    } catch (err) {
      console.error(err);
      alert("Error updating user.");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleToggleActive = async (user: UserItem) => {
    const confirmMsg = user.isActive
      ? `Are you sure you want to suspend access for ${user.fullName}?`
      : `Reactivate access for ${user.fullName}?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !user.isActive }),
      });

      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteUser = (user: UserItem) => {
    setUserToDelete(user);
  };

  const handleConfirmDeleteUser = async () => {
    if (!userToDelete) return;
    const user = userToDelete;

    setDeletingId(user.id);
    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (res.ok) {
        if (selectedUser?.id === user.id) {
          setIsEditOpen(false);
          setSelectedUser(null);
        }
        setUserToDelete(null);
        setUserToast({
          type: "success",
          title: "Account Deleted",
          message: data.message || `Technical Officer account for ${user.fullName} has been deleted.`,
        });
        loadUsers();
      } else {
        setUserToast({
          type: "error",
          title: "Deletion Failed",
          message: data.error || "Failed to delete account.",
        });
      }
    } catch (err) {
      console.error(err);
      setUserToast({
        type: "error",
        title: "Network Error",
        message: "Error deleting user account.",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    const matchSearch =
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.staffId && u.staffId.toLowerCase().includes(q)) ||
      u.stationLocation.toLowerCase().includes(q);

    const matchRole = roleFilter === "ALL" || u.role === roleFilter;
    const matchRegion = regionFilter === "ALL" || u.region === regionFilter;

    return matchSearch && matchRole && matchRegion;
  });

  const paginatedUsers = React.useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, page, pageSize]);

  return (
    <div className="space-y-6">
      {/* Header and Toolbar */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#006837] inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
              User Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Configure regional jurisdiction, operational stations, contact phone numbers, and security credentials.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button variant="outline" size="sm" onClick={loadUsers} className="rounded-xl text-xs gap-1.5 h-10">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span>Refresh</span>
          </Button>

          <Button
            variant="outline"
            onClick={() => {
              setStationFormError(null);
              setIsStationModalOpen(true);
            }}
            className="rounded-xl text-xs font-bold border-slate-300 dark:border-zinc-700 text-slate-800 dark:text-zinc-200 hover:bg-slate-100 dark:hover:bg-zinc-800 gap-2 h-10 px-4"
          >
            <Building2 className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
            <span>Add DVLA Station ({stations.length})</span>
          </Button>

          <Button
            onClick={() => {
              setCreateRole("TECHNICAL_OFFICER");
              setFormError(null);
              setIsCreateOpen(true);
            }}
            className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white shadow-md shadow-emerald-950/20 gap-2 h-10 px-4"
          >
            <UserPlus className="h-4 w-4" />
            <span>Create Account</span>
          </Button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search name, staff ID, email, station..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="h-10 pl-10 text-xs rounded-xl"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-44 h-10 text-xs rounded-xl">
              <SelectValue placeholder="All Roles" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Staff Roles</SelectItem>
              <SelectItem value="TECHNICAL_OFFICER">Technical Officers</SelectItem>
              <SelectItem value="ADMINISTRATOR">Administrators</SelectItem>
              <SelectItem value="COMPLIANCE_OFFICER">Compliance Managers</SelectItem>
            </SelectContent>
          </Select>

          {/* Region Filter */}
          <Select value={regionFilter} onValueChange={setRegionFilter}>
            <SelectTrigger className="w-40 h-10 text-xs rounded-xl">
              <SelectValue placeholder="All Regions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All 16 Regions</SelectItem>
              {GHANA_REGIONS.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Users Table */}
      <Card className="overflow-hidden border-slate-200 dark:border-zinc-800 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-zinc-900 border-b border-slate-200 dark:border-zinc-800 text-[11px] font-extrabold uppercase text-slate-500 dark:text-zinc-400 tracking-wider">
              <tr>
                <th className="px-5 py-3.5">Staff Name &amp; ID</th>
                <th className="px-5 py-3.5">Role</th>
                <th className="px-5 py-3.5">Jurisdiction / Station</th>
                <th className="px-5 py-3.5">Contact Phone &amp; Email</th>
                <th className="px-5 py-3.5">Account Status</th>
                <th className="px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 animate-pulse">
                    Loading official staff accounts...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-12 text-center text-slate-400 font-medium">
                    No staff accounts match your current search filters.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => {
                  const isTO = u.role === "TECHNICAL_OFFICER";
                  const isAdmin = u.role === "ADMINISTRATOR";

                  return (
                    <tr
                      key={u.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-zinc-800/40 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 shadow-inner",
                              isAdmin
                                ? "bg-emerald-100 dark:bg-emerald-950 text-[#006837] dark:text-emerald-400 border border-emerald-300 dark:border-emerald-800"
                                : "bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-400 border border-amber-300 dark:border-amber-800"
                            )}
                          >
                            {isAdmin ? <Shield className="h-4 w-4" /> : <Wrench className="h-4 w-4" />}
                          </div>
                          <div>
                            <p className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">
                              {u.fullName}
                            </p>
                            <p className="font-mono text-[11px] text-slate-400 dark:text-zinc-500">
                              {u.staffId || "STAFF-UNASSIGNED"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <Badge
                          variant={isAdmin ? "success" : isTO ? "warning" : "info"}
                          className="font-bold text-[10px]"
                        >
                          {u.role === "COMPLIANCE_OFFICER"
                            ? "COMPLIANCE MANAGER"
                            : u.role.replace("_", " ")}
                        </Badge>
                      </td>

                      <td className="px-5 py-4">
                        {isAdmin ? (
                          <div className="space-y-0.5">
                            <p className="font-bold text-[#006837] dark:text-emerald-400 flex items-center gap-1.5">
                              <Shield className="h-3 w-3" />
                              National Jurisdiction
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                              System-Wide Executive Access
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-0.5">
                            <p className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                              <MapPin className="h-3 w-3 text-[#006837] dark:text-emerald-400" />
                              {u.region}
                            </p>
                            <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                              <Building2 className="h-3 w-3 text-slate-400" />
                              {u.stationLocation}
                            </p>
                          </div>
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 dark:text-zinc-200 flex items-center gap-1.5">
                            <Phone className="h-3 w-3 text-emerald-600" />
                            {u.phone}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-zinc-400 flex items-center gap-1.5">
                            <Mail className="h-3 w-3 text-slate-400" />
                            {u.email}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <button
                          onClick={() => handleToggleActive(u)}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-colors",
                            u.isActive
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                          )}
                          title="Click to toggle account access"
                        >
                          {u.isActive ? (
                            <>
                              <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                              <span>Active</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="h-3 w-3 text-rose-600" />
                              <span>Suspended</span>
                            </>
                          )}
                        </button>
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(u)}
                            className="h-8 rounded-xl text-xs gap-1 font-semibold"
                          >
                            <Edit className="h-3 w-3" />
                            <span>Configure</span>
                          </Button>
                          {isTO && (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={deletingId === u.id}
                              onClick={() => handleDeleteUser(u)}
                              className="h-8 rounded-xl text-xs gap-1 font-semibold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800/70 dark:text-rose-400 dark:hover:bg-rose-950/40"
                              title="Delete Technical Officer Account"
                            >
                              {deletingId === u.id ? (
                                <RefreshCw className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                              <span>Delete</span>
                            </Button>
                          )}
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
          totalItems={filteredUsers.length}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          itemLabel="staff accounts"
        />
      </Card>

      {/* CREATE STAFF MODAL */}
      <Dialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Create Authorized Staff Account"
        description="Select the account role (Technical Officer, Administrator, or Compliance Manager), assign jurisdiction, and provision credentials."
        maxWidth="max-w-xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-4 pt-2">
          {formError && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Staff Full Name</label>
              <Input
                required
                placeholder={createRole === "ADMINISTRATOR" ? "e.g. Dir. Nana Ama Mensah" : "e.g. Ing. Kwame Asare"}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Staff ID Number</label>
              <Input
                placeholder={createRole === "ADMINISTRATOR" ? "e.g. DVLA-ADM-004" : "e.g. DVLA-TO-512"}
                value={staffId}
                onChange={(e) => setStaffId(e.target.value)}
                className="h-9 text-xs rounded-xl font-mono uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Official Email</label>
              <Input
                type="email"
                required
                placeholder="e.g. k.asare@dvla.gov.gh"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                Official Phone Number {createRole === "TECHNICAL_OFFICER" && <span className="text-emerald-600">* (For Inspection SMS)</span>}
              </label>
              <Input
                required
                placeholder="+233 24 000 0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className={cn("grid grid-cols-1 gap-3.5", createRole === "ADMINISTRATOR" ? "sm:grid-cols-1" : "sm:grid-cols-3")}>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Account Role</label>
              <Select value={createRole} onValueChange={setCreateRole}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMINISTRATOR">Administrator (National Oversight)</SelectItem>
                  <SelectItem value="TECHNICAL_OFFICER">Technical Officer (Regional Station)</SelectItem>
                  <SelectItem value="COMPLIANCE_OFFICER">Compliance Manager (Regional Oversight)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {createRole !== "ADMINISTRATOR" && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Assigned Region</label>
                  <Select
                    value={region}
                    onValueChange={(val) => {
                      setRegion(val);
                      const regionStns = stationsByRegion[val] || [];
                      if (regionStns.length > 0) {
                        setStationLocation(regionStns[0]);
                      } else {
                        setStationLocation(`DVLA ${val} Regional Office`);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GHANA_REGIONS.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Operational Station</label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewStationRegion(region);
                        setStationFormError(null);
                        setIsStationModalOpen(true);
                      }}
                      className="text-[10px] font-bold text-[#006837] dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" />
                      <span>Add Station</span>
                    </button>
                  </div>
                  {(stationsByRegion[region] || []).length > 0 ? (
                    <Select value={stationLocation} onValueChange={setStationLocation}>
                      <SelectTrigger className="h-9 text-xs rounded-xl">
                        <SelectValue placeholder="Select DVLA Station" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from(new Set([...(stationsByRegion[region] || []), ...(stationLocation ? [stationLocation] : [])])).map((stn) => (
                          <SelectItem key={stn} value={stn}>
                            {stn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={stationLocation}
                      onChange={(e) => setStationLocation(e.target.value)}
                      placeholder="Station name"
                      className="h-9 text-xs rounded-xl"
                    />
                  )}
                </div>
              </>
            )}
          </div>

          <div className="p-3.5 rounded-2xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-start gap-3">
            <KeyRound className="h-4 w-4 text-[#006837] dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 dark:text-zinc-100">Default First-Time Password:</span>
                <span className="font-mono font-black px-2 py-0.5 rounded bg-white dark:bg-zinc-900 border border-emerald-200 dark:border-emerald-800 text-[#006837] dark:text-emerald-400">
                  Password@123
                </span>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-zinc-400">
                All new accounts use this default password. Upon signing in for the first time, the user will be prompted to set a personal password before proceeding.
              </p>
            </div>
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
              {isSubmitting ? "Registering..." : "Create Account"}
            </Button>
          </div>
        </form>
      </Dialog>

      {/* EDIT STAFF MODAL */}
      <Dialog
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`Configure Account: ${selectedUser?.fullName}`}
        description="Modify assigned regional jurisdiction, operational station, official phone number, or reset password."
        maxWidth="max-w-lg"
      >
        <form onSubmit={handleUpdateUser} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Official Phone Number</label>
              <Input
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                className="h-9 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Assigned Role</label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TECHNICAL_OFFICER">Technical Officer</SelectItem>
                  <SelectItem value="ADMINISTRATOR">Administrator</SelectItem>
                  <SelectItem value="COMPLIANCE_OFFICER">Compliance Manager</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {editRole !== "ADMINISTRATOR" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Assigned Region</label>
                <Select
                  value={editRegion}
                  onValueChange={(val) => {
                    setEditRegion(val);
                    const regionStns = stationsByRegion[val] || [];
                    if (regionStns.length > 0) {
                      setEditStation(regionStns[0]);
                    } else {
                      setEditStation(`DVLA ${val} Regional Office`);
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-xs rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">Operational Station</label>
                  <button
                    type="button"
                    onClick={() => {
                      setNewStationRegion(editRegion || "Greater Accra");
                      setStationFormError(null);
                      setIsStationModalOpen(true);
                    }}
                    className="text-[10px] font-bold text-[#006837] dark:text-emerald-400 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Station</span>
                  </button>
                </div>
                {(stationsByRegion[editRegion] || []).length > 0 ? (
                  <Select value={editStation} onValueChange={setEditStation}>
                    <SelectTrigger className="h-9 text-xs rounded-xl">
                      <SelectValue placeholder="Select DVLA Station" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from(new Set([...(stationsByRegion[editRegion] || []), ...(editStation ? [editStation] : [])])).map((stn) => (
                        <SelectItem key={stn} value={stn}>
                          {stn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={editStation}
                    onChange={(e) => setEditStation(e.target.value)}
                    className="h-9 text-xs rounded-xl"
                  />
                )}
              </div>
            </div>
          )}

          <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-zinc-800">
            <label className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
              <KeyRound className="h-3.5 w-3.5 text-amber-600" />
              <span>Reset Password (Optional)</span>
            </label>
            <Input
              type="text"
              placeholder="Leave blank to keep existing password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="h-9 text-xs rounded-xl font-mono"
            />
          </div>

          <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between gap-2.5">
            <div>
              {selectedUser?.role === "TECHNICAL_OFFICER" && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={deletingId === selectedUser.id || isUpdating}
                  onClick={() => selectedUser && handleDeleteUser(selectedUser)}
                  className="rounded-xl text-xs h-9 gap-1.5 font-bold text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  {deletingId === selectedUser.id ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="h-3.5 w-3.5" />
                  )}
                  <span>Delete Account</span>
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditOpen(false)}
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
                {isUpdating ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </Dialog>

      {/* DELETE TECHNICAL OFFICER CONFIRMATION MODAL */}
      {userToDelete && (
        <Dialog
          isOpen={Boolean(userToDelete)}
          onClose={() => {
            if (!deletingId) setUserToDelete(null);
          }}
          title={`Delete Technical Officer Account`}
          description="This action permanently removes the officer's login access and releases any uncompleted inspection cases back to the regional pool."
          maxWidth="max-w-md"
        >
          <div className="space-y-4 pt-1 text-slate-800 dark:text-zinc-200">
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/40 dark:bg-rose-950/20 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Officer Name:</span>
                <span className="font-extrabold text-sm text-slate-900 dark:text-zinc-100">{userToDelete.fullName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Staff ID:</span>
                <span className="font-mono font-bold">{userToDelete.staffId || "STAFF-UNASSIGNED"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Station / Region:</span>
                <span className="font-semibold">{userToDelete.stationLocation} ({userToDelete.region})</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Email:</span>
                <span className="font-mono text-[11px]">{userToDelete.email}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-end gap-2.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={Boolean(deletingId)}
                onClick={() => setUserToDelete(null)}
                className="rounded-xl text-xs h-9"
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={Boolean(deletingId)}
                onClick={handleConfirmDeleteUser}
                className="rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white h-9 px-4 gap-1.5"
              >
                {deletingId ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Confirm &amp; Delete Account</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {/* ADD & MANAGE DVLA STATIONS MODAL */}
      <Dialog
        isOpen={isStationModalOpen}
        onClose={() => setIsStationModalOpen(false)}
        title="Register & Manage DVLA Operational Stations"
        description="Add new regional or district DVLA testing centers and inspection stations across Ghana's 16 administrative regions."
        maxWidth="max-w-2xl"
      >
        <div className="space-y-5 pt-2">
          {/* Add New Station Form */}
          <form
            onSubmit={handleAddStation}
            className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 space-y-3.5"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-zinc-800 pb-2.5">
              <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                <Building2 className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
                <span>Add New DVLA Operational Station</span>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono">
                {stations.length} Active Stations
              </Badge>
            </div>

            {stationFormError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 font-bold flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{stationFormError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Station Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. DVLA Madina District Office"
                  value={newStationName}
                  onChange={(e) => setNewStationName(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Administrative Region <span className="text-rose-500">*</span>
                </label>
                <Select value={newStationRegion} onValueChange={setNewStationRegion}>
                  <SelectTrigger className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GHANA_REGIONS.map((r) => (
                      <SelectItem key={r} value={r}>
                        {r}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Station Code <span className="text-[10px] font-normal text-slate-400">(Auto if blank)</span>
                </label>
                <Input
                  placeholder="e.g. DVLA-GAR-05"
                  value={newStationCode}
                  onChange={(e) => setNewStationCode(e.target.value.toUpperCase())}
                  className="h-9 text-xs rounded-xl font-mono uppercase bg-white dark:bg-zinc-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Physical Address / Area
                </label>
                <Input
                  placeholder="e.g. Zongo Junction, Madina"
                  value={newStationAddress}
                  onChange={(e) => setNewStationAddress(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                  Station Contact Phone
                </label>
                <Input
                  placeholder="+233 30 274 6760"
                  value={newStationPhone}
                  onChange={(e) => setNewStationPhone(e.target.value)}
                  className="h-9 text-xs rounded-xl bg-white dark:bg-zinc-950"
                />
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <Button
                type="submit"
                size="sm"
                disabled={isAddingStation || !newStationName.trim()}
                className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white h-9 px-5 gap-1.5"
              >
                {isAddingStation ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Registering Station...</span>
                  </>
                ) : (
                  <>
                    <Plus className="h-3.5 w-3.5" />
                    <span>Add DVLA Station</span>
                  </>
                )}
              </Button>
            </div>
          </form>

          {/* Registered Stations Directory */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-300 uppercase tracking-wider">
                Registered DVLA Stations Directory
              </span>
              <Select value={stationFilterRegion} onValueChange={setStationFilterRegion}>
                <SelectTrigger className="w-full sm:w-48 h-8 text-xs rounded-xl">
                  <SelectValue placeholder="Filter by Region" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All Regions ({stations.length})</SelectItem>
                  {GHANA_REGIONS.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r} ({(stationsByRegion[r] || []).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="max-h-64 overflow-y-auto rounded-2xl border border-slate-200 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800 bg-white dark:bg-zinc-950">
              {stations
                .filter((s) => stationFilterRegion === "ALL" || s.region === stationFilterRegion)
                .map((stn) => (
                  <div
                    key={stn.id}
                    className="p-3 flex items-center justify-between gap-3 hover:bg-slate-50/70 dark:hover:bg-zinc-900/50 transition-colors text-xs"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-extrabold text-slate-900 dark:text-zinc-100">
                          {stn.name}
                        </span>
                        <span className="font-mono text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/60 text-[#006837] dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                          {stn.code}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {stn.region}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">
                        {stn.address || `${stn.region} Region`} {stn.phone ? `• ${stn.phone}` : ""}
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={deletingStationId === stn.id}
                      onClick={() => handleDeleteStation(stn)}
                      className="h-8 w-8 p-0 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg shrink-0"
                      title={`Remove ${stn.name}`}
                    >
                      {deletingStationId === stn.id ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                ))}
            </div>
          </div>

          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsStationModalOpen(false)}
              className="rounded-xl text-xs h-9 px-5"
            >
              Done
            </Button>
          </div>
        </div>
      </Dialog>

      {/* FLOATING TOAST NOTIFICATION */}
      {userToast && (
        <div className="fixed bottom-6 right-6 z-50 max-w-md w-full sm:w-auto animate-fade-in">
          <div
            className={cn(
              "p-4 rounded-2xl border shadow-2xl flex items-start gap-3 backdrop-blur-md",
              userToast.type === "success"
                ? "bg-emerald-950/95 text-white border-emerald-500/50"
                : "bg-rose-950/95 text-white border-rose-500/50"
            )}
          >
            <div
              className={cn(
                "h-8 w-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5",
                userToast.type === "success" ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300"
              )}
            >
              {userToast.type === "success" ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0 pr-2">
              <p className="text-xs font-extrabold tracking-tight">{userToast.title}</p>
              <p className="text-xs text-slate-200 mt-0.5 leading-relaxed">{userToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setUserToast(null)}
              className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Close notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
