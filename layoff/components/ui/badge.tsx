import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?:
    | "default"
    | "secondary"
    | "outline"
    | "success"
    | "warning"
    | "danger"
    | "info"
    | "gold"
    | "extended";
  dot?: boolean;
}

const variantStyles: Record<string, string> = {
  default:
    "bg-emerald-700 dark:bg-emerald-600 text-white border-transparent",
  secondary:
    "bg-slate-100 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 border-slate-200 dark:border-zinc-700",
  outline:
    "bg-transparent text-slate-700 dark:text-zinc-300 border-slate-300 dark:border-zinc-700",
  success:
    "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60",
  warning:
    "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800/60",
  danger:
    "bg-red-50 dark:bg-red-950/60 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800/60",
  info:
    "bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60",
  gold:
    "bg-yellow-50 dark:bg-amber-900/40 text-yellow-900 dark:text-amber-200 border-yellow-300 dark:border-amber-700 font-semibold",
  extended:
    "bg-purple-50 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border-purple-200 dark:border-purple-800/60",
};

const dotStyles: Record<string, string> = {
  default: "bg-emerald-300",
  secondary: "bg-slate-400 dark:bg-zinc-400",
  outline: "bg-slate-400 dark:bg-zinc-400",
  success: "bg-emerald-500 dark:bg-emerald-400",
  warning: "bg-amber-500 dark:bg-amber-400",
  danger: "bg-red-500 dark:bg-red-400",
  info: "bg-teal-500 dark:bg-teal-400",
  gold: "bg-yellow-500 dark:bg-amber-400",
  extended: "bg-purple-500 dark:bg-purple-400",
};

function Badge({ className, variant = "secondary", dot = false, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium leading-none transition-colors",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {dot && (
        <span
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full flex-shrink-0",
            dotStyles[variant]
          )}
        />
      )}
      {children}
    </span>
  );
}

export { Badge };

