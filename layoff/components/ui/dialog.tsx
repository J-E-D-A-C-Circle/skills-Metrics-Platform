"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = "max-w-lg",
}: DialogProps) {
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto">
      {/* Full screen backdrop spanning entire viewport */}
      <div
        className="fixed inset-0 bg-black/70 dark:bg-black/85 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Panel */}
      <div
        className={cn(
          "relative w-full bg-white dark:bg-[#121212] rounded-2xl shadow-2xl dark:shadow-black border border-slate-200 dark:border-zinc-800 text-slate-900 dark:text-zinc-100 z-10 my-auto max-h-[94vh] sm:max-h-[90vh] flex flex-col overflow-hidden animate-fade-in transition-colors duration-150",
          maxWidth
        )}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-6 sm:py-5 border-b border-slate-100 dark:border-zinc-800 flex-shrink-0 bg-slate-50/50 dark:bg-zinc-900/60">
            <div className="space-y-0.5 min-w-0 pr-1">
              {title && (
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-zinc-100 leading-snug break-words">{title}</h3>
              )}
              {description && (
                <p className="text-[11px] sm:text-xs text-slate-500 dark:text-zinc-400 font-medium leading-relaxed">{description}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 -mr-1 -mt-1 rounded-xl p-2 text-slate-400 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-100 hover:bg-slate-200/60 dark:hover:bg-zinc-800 transition-colors touch-manipulation"
              aria-label="Close dialog"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Body (Scrollable) */}
        <div className="p-3.5 sm:p-6 overflow-y-auto flex-1">{children}</div>
      </div>
    </div>,
    document.body
  );
}

