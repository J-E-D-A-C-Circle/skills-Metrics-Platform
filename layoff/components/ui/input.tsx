import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-lg border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-slate-900 dark:text-zinc-100",
          "placeholder:text-slate-400 dark:placeholder:text-zinc-500",
          "hover:border-slate-300 dark:hover:border-zinc-700",
          "focus:outline-none focus:border-[#006837] dark:focus:border-emerald-500 focus:ring-2 focus:ring-[#006837]/10 dark:focus:ring-emerald-500/20",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-50 dark:disabled:bg-zinc-900/50",
          "file:border-0 file:bg-transparent file:text-sm file:font-medium",
          "transition-[border-color,box-shadow,background-color]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };

