import type { TextareaHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-xl border border-white/60 bg-white/80 px-3 py-2 text-sm text-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.08)] backdrop-blur transition focus-visible:outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100 placeholder:text-slate-400",
        className
      )}
      {...props}
    />
  );
}
