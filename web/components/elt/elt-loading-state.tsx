import { Loader2 } from "lucide-react";

type Props = {
  /** Shown next to the spinner (same default on Pipelines + Visual canvas list). */
  message?: string;
  className?: string;
  /** `md` for large empty regions (e.g. canvas area). */
  size?: "sm" | "md";
};

export function EltLoadingState({
  message = "Loading pipelines…",
  className = "",
  size = "sm",
}: Props) {
  const iconClass = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 ${className}`}
    >
      <Loader2 className={`${iconClass} shrink-0 animate-spin`} aria-hidden />
      <span>{message}</span>
    </div>
  );
}
