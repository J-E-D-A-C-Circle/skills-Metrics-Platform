"use client";

import React, {
  createContext, useContext, useState, useRef, useEffect, useId,
} from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Context ─── */
interface SelectCtx {
  value: string;
  onValueChange: (v: string) => void;
  open: boolean;
  setOpen: (o: boolean) => void;
  selectedLabel: string;
  setSelectedLabel: (l: string) => void;
  searchable?: boolean;
  search: string;
  setSearch: (s: string) => void;
  triggerId: string;
}

const Ctx = createContext<SelectCtx | null>(null);
function useCtx() {
  const c = useContext(Ctx);
  if (!c) throw new Error("Select subcomponents must be used inside <Select>");
  return c;
}

/* ─── Root ─── */
export function Select({
  value = "",
  onValueChange,
  children,
  searchable,
}: {
  value?: string;
  onValueChange?: (v: string) => void;
  children: React.ReactNode;
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState("");
  const [search, setSearch] = useState("");
  const triggerId = useId();
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") { setOpen(false); setSearch(""); }
    }
    if (open) document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <Ctx.Provider value={{
      value, onValueChange: onValueChange || (() => { }),
      open, setOpen, selectedLabel, setSelectedLabel,
      searchable, search, setSearch, triggerId,
    }}>
      <div ref={rootRef} className="relative">
        {children}
      </div>
    </Ctx.Provider>
  );
}

/* ─── Trigger ─── */
export function SelectTrigger({
  children,
  className,
  placeholder,
}: {
  children?: React.ReactNode;
  className?: string;
  placeholder?: string;
}) {
  const { open, setOpen, selectedLabel, triggerId } = useCtx();
  return (
    <button
      id={triggerId}
      type="button"
      onClick={() => setOpen(!open)}
      aria-expanded={open}
      aria-haspopup="listbox"
      className={cn(
        "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900",
        "px-3.5 py-2.5 text-sm text-left text-slate-900 dark:text-zinc-100",
        "hover:border-slate-300 dark:hover:border-zinc-700 focus:outline-none focus:border-[#006837] dark:focus:border-emerald-500 focus:ring-3 focus:ring-[#006837]/12 dark:focus:ring-emerald-500/20",
        "transition-[border-color,box-shadow,background-color] duration-150",
        !selectedLabel && "text-slate-400 dark:text-zinc-500",
        className
      )}
    >
      <span className="flex-1 truncate text-slate-900 dark:text-zinc-100">
        {children ?? (selectedLabel || placeholder || "Select…")}
      </span>
      <ChevronDown
        className={cn(
          "ml-2 h-4 w-4 flex-shrink-0 text-slate-400 dark:text-zinc-500 transition-transform duration-200",
          open && "rotate-180"
        )}
      />
    </button>
  );
}

/* ─── Value display inside trigger ─── */
export function SelectValue({ placeholder = "Select…" }: { placeholder?: string }) {
  const { selectedLabel } = useCtx();
  return (
    <span className={cn("truncate", !selectedLabel && "text-slate-400 dark:text-zinc-500")}>
      {selectedLabel || placeholder}
    </span>
  );
}

/* ─── Content (dropdown panel) ─── */
export function SelectContent({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { open, searchable, search, setSearch } = useCtx();
  const panelRef = useRef<HTMLDivElement>(null);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="listbox"
      className={cn(
        "absolute left-0 right-0 z-50 mt-1.5 overflow-hidden",
        "rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl shadow-slate-900/12 dark:shadow-black/60",
        "animate-in fade-in-0 zoom-in-95 duration-150",
        className
      )}
      style={{ maxHeight: 280 }}
    >
      {/* Optional search */}
      {searchable && (
        <div className="flex items-center gap-2 border-b border-slate-100 dark:border-zinc-800 px-3 py-2.5">
          <Search className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 dark:text-zinc-500" />
          <input
            autoFocus
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="flex-1 text-sm outline-none bg-transparent text-slate-900 dark:text-zinc-100 placeholder:text-slate-400 dark:placeholder:text-zinc-500"
          />
        </div>
      )}

      {/* Items list */}
      <div className="overflow-y-auto" style={{ maxHeight: searchable ? 220 : 260 }}>
        <div className="py-1.5 px-1.5 space-y-0.5">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ─── Individual item ─── */
export function SelectItem({
  value,
  children,
  className,
}: {
  value: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { value: selected, onValueChange, setOpen, setSelectedLabel, search } = useCtx();
  const isSelected = selected === value;
  const label = typeof children === "string" ? children : value;

  // Filter by search
  if (search && !label.toLowerCase().includes(search.toLowerCase())) return null;

  return (
    <div
      role="option"
      aria-selected={isSelected}
      onClick={() => {
        onValueChange(value);
        setSelectedLabel(label);
        setOpen(false);
      }}
      className={cn(
        "flex items-center justify-between gap-2 cursor-pointer select-none",
        "rounded-lg px-3 py-2 text-sm transition-colors",
        isSelected
          ? "bg-[#006837]/10 dark:bg-emerald-500/15 text-[#006837] dark:text-emerald-400 font-semibold"
          : "text-slate-700 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white",
        className
      )}
    >
      <span className="flex-1">{children}</span>
      {isSelected && <Check className="h-3.5 w-3.5 flex-shrink-0 text-[#006837] dark:text-emerald-400" />}
    </div>
  );
}

/* ─── Group label ─── */
export function SelectGroup({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-zinc-500">{label}</p>
      )}
      {children}
    </div>
  );
}

/* ─── Separator ─── */
export function SelectSeparator() {
  return <hr className="my-1.5 border-slate-100 dark:border-zinc-800" />;
}

/* ─── Convenience: pre-wired sync with SelectLabel display ─── */
/**
 * Use this hook to sync external string state with the Select's internal
 * label display. Pass the current value and the label map.
 */
export function useSelectLabel(value: string, labelMap: Record<string, string>): string {
  return labelMap[value] ?? value;
}

