"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { connectorDisplayName } from "@/lib/marketing/connector-display-names";

const POPULAR = [
  { slug: "stripe_analytics", label: "Stripe" },
  { slug: "github", label: "GitHub" },
  { slug: "snowflake", label: "Snowflake" },
  { slug: "postgres", label: "Postgres" },
  { slug: "hubspot", label: "HubSpot" },
] as const;

const TABS = [
  { href: "/assets", label: "Assets", match: (p: string) => p === "/assets" },
  { href: "/connectors", label: "All connectors", match: (p: string) => p === "/connectors" || p.startsWith("/connectors/") },
  { href: "/scenarios", label: "Scenarios", match: (p: string) => p === "/scenarios" },
  { href: "/dbt", label: "dbt", match: (p: string) => p === "/dbt" || p.startsWith("/dbt/") },
] as const;

export function CatalogNav() {
  const pathname = usePathname() ?? "";

  return (
    <div className="border-b border-slate-200 bg-white/95 dark:border-slate-800 dark:bg-slate-950/95">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <nav className="flex gap-1" aria-label="Connector catalog">
            {TABS.map((tab) => {
              const active = tab.match(pathname);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={clsx(
                    "rounded-lg px-3 py-1.5 text-sm font-medium transition",
                    active
                      ? "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                  )}
                >
                  {tab.label}
                </Link>
              );
            })}
          </nav>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-slate-500 dark:text-slate-400">Popular:</span>
            {POPULAR.map(({ slug, label }) => (
              <Link
                key={slug}
                href={`/connectors/${slug}`}
                className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 font-medium text-slate-700 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-700"
              >
                {connectorDisplayName(slug, label)}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
