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
      "border border-blue-600 bg-blue-600 text-white shadow-sm hover:bg-blue-700 hover:border-blue-700",
    outline:
      "border border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50",
    ghost:
      "border border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-800"
  };

  const sizeClasses: Record<ButtonSize, string> = {
    sm: "px-3 py-1.5 text-xs",
    md: "px-4 py-2 text-sm",
    lg: "px-5 py-2.5 text-sm"
  };

  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-200 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    />
  );
}
