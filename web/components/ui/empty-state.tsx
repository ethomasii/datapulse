import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { href: string; label: string };
  secondaryAction?: { href: string; label: string };
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
}: EmptyStateProps) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-6 py-12 text-center dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-sky-100 dark:bg-sky-950/50">
        <Icon className="h-6 w-6 text-sky-600 dark:text-sky-400" aria-hidden />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600 dark:text-slate-400">{description}</p>
      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action ? (
            <Link
              href={action.href}
              className="inline-flex rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
            >
              {action.label}
            </Link>
          ) : null}
          {secondaryAction ? (
            <Link
              href={secondaryAction.href}
              className="inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {secondaryAction.label}
            </Link>
          ) : null}
        </div>
      )}
    </div>
  );
}
