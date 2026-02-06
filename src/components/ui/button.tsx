import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

type ButtonVariant = "solid" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
};

export function Button({
  className,
  variant = "solid",
  size = "md",
  ...props
}: ButtonProps) {
  const variantClasses: Record<ButtonVariant, string> = {
    solid:
      "border border-blue-500/80 bg-gradient-to-b from-blue-500 to-blue-600 text-white shadow-[0_12px_26px_rgba(37,99,235,0.35)] hover:-translate-y-0.5 hover:from-blue-400 hover:to-blue-500 hover:shadow-[0_18px_32px_rgba(37,99,235,0.32)]",
    outline:
      "border border-slate-300/75 bg-white/[0.85] text-slate-700 shadow-[0_10px_22px_rgba(15,23,42,0.08)] hover:-translate-y-0.5 hover:border-blue-200 hover:bg-white hover:text-blue-700",
    ghost:
      "border border-transparent bg-transparent text-slate-600 hover:-translate-y-0.5 hover:bg-white/75 hover:text-blue-700"
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200/90 disabled:cursor-not-allowed disabled:translate-y-0 disabled:opacity-50 disabled:shadow-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
