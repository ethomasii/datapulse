"use client";

import Link from "next/link";
import { Database, GitBranch, Workflow } from "lucide-react";
import clsx from "clsx";

type Props = {
  compact?: boolean;
  variant?: "default" | "catalog";
  className?: string;
};

const PATHS = [
  {
    id: "dbt",
    title: "dbt project",
    badge: "Recommended",
    icon: GitBranch,
    color: "indigo",
    description: "Best for production — versioned SQL, tests, docs, and incremental models in git.",
    href: "/catalog/dbt",
    muted: false,
  },
  {
    id: "warehouse",
    title: "Warehouse SQL",
    badge: "Canvas",
    icon: Database,
    color: "sky",
    description: "Fast visual path — recipes and CTAS on the canvas. Promote to dbt when logic stabilizes.",
    href: "/catalog/components#recipes",
    muted: false,
  },
  {
    id: "dataframe",
    title: "Dataframe",
    badge: "Legacy",
    icon: Workflow,
    color: "slate",
    description: "Worker pandas — only when SQL cannot express the transform (execution=dataframe).",
    href: "/catalog/components#components",
    muted: true,
  },
] as const;

export function TransformPathsPanel({ compact = false, variant = "default", className }: Props) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900",
        compact ? "p-3" : "p-5",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">How transforms run</p>
          <h2 className={clsx("font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-base")}>
            Pick your path
          </h2>
        </div>
        <Link
          href="/catalog/dbt"
          className="shrink-0 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
        >
          dbt projects →
        </Link>
      </div>
      <div className={clsx("mt-3 grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
        {PATHS.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            className={clsx(
              "rounded-lg border p-3 transition",
              p.muted
                ? "border-slate-200 bg-slate-50/50 opacity-90 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/50"
                : "hover:border-sky-300 dark:hover:border-sky-700",
              !p.muted && p.color === "sky" && "border-sky-100 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20",
              !p.muted &&
                p.color === "indigo" &&
                "border-indigo-200 bg-indigo-50/60 ring-1 ring-indigo-200/80 dark:border-indigo-800 dark:bg-indigo-950/30 dark:ring-indigo-900/50"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <p.icon className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
              <span
                className={clsx(
                  "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                  p.badge === "Recommended" &&
                    "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
                  p.badge === "Canvas" && "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
                  p.badge === "Legacy" && "bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-400"
                )}
              >
                {p.badge}
              </span>
            </div>
            <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{p.description}</p>
          </Link>
        ))}
      </div>
      {!compact && variant === "catalog" ? (
        <p className="mt-3 text-xs text-slate-500">
          Use <strong className="font-medium text-slate-700 dark:text-slate-300">recipes</strong> above to prototype on
          the canvas — then link a <strong className="font-medium text-slate-700 dark:text-slate-300">dbt project</strong>{" "}
          for production.
        </p>
      ) : null}
    </section>
  );
}
