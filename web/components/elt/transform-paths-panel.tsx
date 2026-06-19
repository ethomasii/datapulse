"use client";

import Link from "next/link";
import { Database, GitBranch, Table2, Workflow } from "lucide-react";
import clsx from "clsx";

type Props = {
  compact?: boolean;
  className?: string;
};

const PATHS = [
  {
    id: "warehouse",
    title: "Warehouse SQL",
    icon: Database,
    color: "sky",
    description:
      "Canvas components compile to CREATE TABLE AS … after load. Fast, visual, no git repo — not dbt models.",
    href: "/catalog/components#components",
  },
  {
    id: "dbt",
    title: "dbt project",
    icon: GitBranch,
    color: "indigo",
    description: "Versioned SQL in git — refs, tests, docs, incremental models. Link a project on the canvas transform node.",
    href: "/catalog/dbt",
  },
  {
    id: "dataframe",
    title: "Dataframe",
    icon: Workflow,
    color: "orange",
    description: "In-memory pandas on the worker when SQL is not enough. Set execution=dataframe on a component.",
    href: "/catalog/components#components",
  },
] as const;

export function TransformPathsPanel({ compact = false, className }: Props) {
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
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">After ingest</p>
          <h2 className={clsx("font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-base")}>
            Three transform paths
          </h2>
        </div>
        {!compact ? (
          <Link
            href="/catalog/transform-hub"
            className="shrink-0 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            dbt packages →
          </Link>
        ) : null}
      </div>
      <div className={clsx("mt-3 grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-3")}>
        {PATHS.map((p) => (
          <Link
            key={p.id}
            href={p.href}
            className={clsx(
              "rounded-lg border p-3 transition hover:border-sky-300 dark:hover:border-sky-700",
              p.color === "sky" && "border-sky-100 bg-sky-50/50 dark:border-sky-900/50 dark:bg-sky-950/20",
              p.color === "indigo" && "border-indigo-100 bg-indigo-50/50 dark:border-indigo-900/50 dark:bg-indigo-950/20",
              p.color === "orange" && "border-orange-100 bg-orange-50/50 dark:border-orange-900/50 dark:bg-orange-950/20"
            )}
          >
            <p.icon className="h-4 w-4 text-slate-600 dark:text-slate-300" aria-hidden />
            <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{p.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-400">{p.description}</p>
          </Link>
        ))}
      </div>
      {!compact ? (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-slate-500">
          <Table2 className="h-3.5 w-3.5" aria-hidden />
          Warehouse SQL looks like dbt models but runs inline — promote to a dbt project when the logic stabilizes.
        </p>
      ) : null}
    </section>
  );
}
