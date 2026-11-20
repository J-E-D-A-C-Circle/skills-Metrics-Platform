"use client";

import React, { useState, useEffect } from "react";
import {
  Settings,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  ShieldAlert,
  Calendar,
  FileText,
  Sliders,
  MapPin,
  Building2,
  Plus,
  Trash2
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { GHANA_REGIONS, DEFAULT_DVLA_STATIONS, DVLAStation } from "@/lib/stations-data";

interface ConfigItem {
  id: string;
  configKey: string;
  configValue: string;
  description?: string | null;
  updatedBy?: string | null;
  updatedAt: string;
}

export function SystemConfigManager() {
  const [configs, setConfigs] = useState<ConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // DVLA Stations state
  const [stations, setStations] = useState<DVLAStation[]>(DEFAULT_DVLA_STATIONS);
  const [stnName, setStnName] = useState("");
  const [stnRegion, setStnRegion] = useState("Greater Accra");
  const [stnCode, setStnCode] = useState("");
  const [stnAddress, setStnAddress] = useState("");
  const [stnPhone, setStnPhone] = useState("+233 30 ");
  const [isAddingStation, setIsAddingStation] = useState(false);

  const loadStations = async () => {
    try {
      const res = await fetch("/api/stations");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.stations)) setStations(data.stations);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/config");
      if (res.ok) {
        const data = await res.json();
        setConfigs(data);
        const map: Record<string, string> = {};
        data.forEach((c: ConfigItem) => {
          map[c.configKey] = c.configValue;
        });
        setEditValues(map);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConfigs();
    loadStations();
  }, []);

  const handleCreateStation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stnName.trim()) return;
    setIsAddingStation(true);
    try {
      const res = await fetch("/api/stations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: stnName.trim(),
          region: stnRegion,
          code: stnCode.trim(),
          address: stnAddress.trim(),
          phone: stnPhone.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (Array.isArray(data.stations)) setStations(data.stations);
        setStnName("");
        setStnCode("");
        setStnAddress("");
        setSaveSuccess(`Added DVLA station "${data.station.name}" (${data.station.region})!`);
        setTimeout(() => setSaveSuccess(null), 3500);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingStation(false);
    }
  };

  const handleRemoveStation = async (id: string) => {
    try {
      const res = await fetch(`/api/stations?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.stations)) {
        setStations(data.stations);
        setSaveSuccess(data.message || "DVLA station removed.");
        setTimeout(() => setSaveSuccess(null), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveConfig = async (key: string) => {
    setSavingKey(key);
    setSaveSuccess(null);

    try {
      const val = editValues[key];
      const res = await fetch("/api/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          configKey: key,
          configValue: val,
        }),
      });

      if (res.ok) {
        setSaveSuccess(`Successfully updated ${key}!`);
        loadConfigs();
        setTimeout(() => setSaveSuccess(null), 3000);
      } else {
        alert("Failed to save configuration.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving configuration.");
    } finally {
      setSavingKey(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white dark:bg-[#121212] border border-slate-200 dark:border-zinc-800 rounded-3xl p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-[#006837] inline-block" />
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-zinc-100 tracking-tight">
              System Configuration &amp; Business Rules
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1">
            Configure statutory fees, cutoff thresholds, inspection surcharges, and legislative citations under L.I. 2519.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={loadConfigs} className="rounded-xl text-xs gap-1.5 h-10">
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span>Reload Configs</span>
        </Button>
      </div>

      {saveSuccess && (
        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-800 flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="h-4 w-4 text-[#006837] flex-shrink-0" />
          <span>{saveSuccess}</span>
        </div>
      )}

      {/* DVLA Stations Registry Section */}
      <Card className="p-5 sm:p-6 border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-zinc-800 pb-3">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-[#006837] dark:text-emerald-400" />
              <h3 className="font-extrabold text-sm sm:text-base text-slate-900 dark:text-zinc-100">
                DVLA Regional &amp; District Operational Stations ({stations.length})
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mt-0.5">
              Register new DVLA testing centers and district offices for Technical Officer assignment and citizen office inspections.
            </p>
          </div>
        </div>

        <form onSubmit={handleCreateStation} className="grid grid-cols-1 sm:grid-cols-5 gap-2.5 items-end">
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">Station Name *</label>
            <Input
              required
              placeholder="e.g. DVLA Madina District Office"
              value={stnName}
              onChange={(e) => setStnName(e.target.value)}
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">Region *</label>
            <Select value={stnRegion} onValueChange={setStnRegion}>
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
            <label className="text-[11px] font-bold text-slate-600 dark:text-zinc-400">Address / Landmark</label>
            <Input
              placeholder="e.g. Zongo Junction"
              value={stnAddress}
              onChange={(e) => setStnAddress(e.target.value)}
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <Button
            type="submit"
            disabled={isAddingStation || !stnName.trim()}
            className="h-9 rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>{isAddingStation ? "Adding..." : "Add Station"}</span>
          </Button>
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pt-1">
          {stations.map((s) => (
            <div
              key={s.id}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/70 dark:bg-zinc-900/60 flex items-center justify-between gap-2 text-xs"
            >
              <div className="min-w-0">
                <p className="font-bold text-slate-900 dark:text-zinc-100 truncate">{s.name}</p>
                <p className="text-[10px] text-slate-500 dark:text-zinc-400 truncate">
                  {s.region} &bull; <span className="font-mono">{s.code}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRemoveStation(s.id)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                title={`Remove ${s.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {/* Config Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {configs
          .filter((cfg) => cfg.configKey !== "DVLA_STATIONS_REGISTRY")
          .map((cfg) => {
          const isFee = cfg.configKey.includes("FEE");
          const isCutoff = cfg.configKey.includes("CUTOFF");
          const isSaving = savingKey === cfg.configKey;

          return (
            <Card key={cfg.id} className="p-5 border-slate-200 dark:border-zinc-800 shadow-xs space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    {isFee ? (
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    ) : isCutoff ? (
                      <Calendar className="h-4 w-4 text-amber-600" />
                    ) : (
                      <Sliders className="h-4 w-4 text-blue-600" />
                    )}
                    <h3 className="font-extrabold text-sm text-slate-900 dark:text-zinc-100 font-mono">
                      {cfg.configKey}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-zinc-400 leading-relaxed">
                    {cfg.description || "Operational business configuration"}
                  </p>
                </div>

                <Badge variant="outline" className="font-mono text-[10px] text-slate-400">
                  {cfg.updatedBy || "System Default"}
                </Badge>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <div className="relative flex-1">
                  {isFee && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-slate-400">
                      GH₵
                    </span>
                  )}
                  <Input
                    value={editValues[cfg.configKey] ?? cfg.configValue}
                    onChange={(e) =>
                      setEditValues((prev) => ({
                        ...prev,
                        [cfg.configKey]: e.target.value,
                      }))
                    }
                    className={cn("h-10 text-xs rounded-xl font-bold", isFee && "pl-11")}
                  />
                </div>

                <Button
                  size="sm"
                  disabled={isSaving || editValues[cfg.configKey] === cfg.configValue}
                  onClick={() => handleSaveConfig(cfg.configKey)}
                  className="rounded-xl text-xs font-bold bg-[#006837] hover:bg-[#004d28] text-white h-10 px-4 gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{isSaving ? "Saving..." : "Save"}</span>
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
