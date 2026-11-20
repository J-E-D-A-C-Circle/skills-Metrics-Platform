import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "accent" | "outline" | "ghost" | "danger" | "link";
  size?: "default" | "sm" | "lg" | "icon" | "xs";
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const base =
      "inline-flex items-center justify-center whitespace-nowrap font-semibold rounded-lg select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#006837] dark:focus-visible:ring-emerald-500 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 active:scale-[0.98] transition-all";

    const variants: Record<string, string> = {
      default:
        "bg-[#006837] dark:bg-emerald-600 text-white hover:bg-[#005a30] dark:hover:bg-emerald-500 shadow-sm border border-[#005a30] dark:border-emerald-500",
      secondary:
        "bg-emerald-50 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 border border-emerald-200 dark:border-emerald-800/60",
      accent:
        "bg-[#facc15] dark:bg-amber-400 text-amber-950 hover:bg-yellow-300 dark:hover:bg-amber-300 border border-yellow-300 dark:border-amber-400 shadow-sm",
      outline:
        "border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700 shadow-xs",
      ghost:
        "text-slate-600 dark:text-zinc-300 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-white",
      danger:
        "bg-red-600 dark:bg-red-600 text-white hover:bg-red-700 border border-red-700 shadow-sm",
      link:
        "text-[#006837] dark:text-emerald-400 underline-offset-4 hover:underline h-auto p-0 shadow-none border-none bg-transparent",
    };

    const sizes: Record<string, string> = {
      xs: "h-7 px-2.5 text-xs rounded-md gap-1",
      sm: "h-8 px-3 text-xs gap-1.5",
      default: "h-9 px-4 text-sm gap-2",
      lg: "h-10 px-5 text-sm gap-2",
      icon: "h-9 w-9 p-0 rounded-lg",
    };

    return (
      <button
        className={cn(base, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button };

