import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "w-full rounded-xl border border-slate-200/80 bg-white/80 px-3.5 py-2.5 text-sm text-slate-900 shadow-[0_12px_28px_rgba(15,23,42,0.08)] backdrop-blur-sm transition duration-200 placeholder:text-slate-400 focus-visible:border-blue-300 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-100 disabled:cursor-not-allowed disabled:opacity-70",
        className
      )}
      {...props}
    />
  );
}
