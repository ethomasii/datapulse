import type { Metadata } from "next";
import Link from "next/link";
import { ELTPULSE_GITHUB_URL } from "@/lib/marketing/github-repo";

export const metadata: Metadata = {
  title: "Changelog",
  description: "Recent product updates and improvements to eltPulse.",
};

const ENTRIES = [
  {
    date: "June 2026",
    title: "Team+ security, compare pages & pricing refresh",
    items: [
      "Air-gap metadata v2 — cloud logs redacted after successful export to your vault",
      "SSO/SAML and air-gap included on Team+ (no per-customer env flags)",
      "ServicePulse-style marketing nav, /compare/vs-* pages, and light-mode pricing hero",
      "Enterprise platform floor ($2,400/mo) and dedicated compute add-on billing",
    ],
  },
  {
    date: "June 2026",
    title: "Catalog hub & asset intelligence (0.9.x)",
    items: [
      "Catalog hub — in-app /catalog with connectors, scenarios, and dbt projects",
      "Assets v4 — per-asset freshness, warehouse verify, and dbt config vs last-run diff",
      "Column lineage UI, Git artifact export, and tier gates aligned to pricing",
    ],
  },
  {
    date: "June 2026",
    title: "dbt, connectors & pipeline builder",
    items: [
      "dbt v2 hub — package browser, scaffold-to-Git API, run phases (sync → load → dbt)",
      "Connector catalog — 120+ sources & destinations with per-connector pages",
      "Pipeline scenarios, managed compute stub, and customer gateway on all tiers",
    ],
  },
  {
    date: "March 2026",
    title: "Foundation — docs, workspace YAML & auth",
    items: [
      "Public docs with sidebar: getting started, pipelines, gateway, security",
      "Clerk auth, Prisma pipelines, builder with GitHub + REST generators",
      "Roadmap and changelog pages; eltPulse workspace YAML in product UI",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="bg-white py-20 dark:bg-slate-950">
      <div className="mx-auto max-w-3xl px-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Changelog</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">
          What we&apos;ve shipped recently. For what&apos;s next, see the{" "}
          <Link href="/roadmap" className="text-blue-600 hover:underline dark:text-blue-400">
            roadmap
          </Link>
          .
        </p>

        <div className="mt-12 space-y-12">
          {ENTRIES.map((entry) => (
            <article key={entry.title} className="border-l-2 border-blue-200 pl-6 dark:border-blue-800">
              <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">{entry.date}</p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">{entry.title}</h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-600 dark:text-slate-400">
                {entry.items.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span className="text-blue-500">•</span>
                    {item}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>

        <p className="mt-14 text-sm text-slate-500 dark:text-slate-500">
          Older history lives in git — see{" "}
          <a
            href={ELTPULSE_GITHUB_URL}
            className="text-blue-600 hover:underline dark:text-blue-400"
            target="_blank"
            rel="noreferrer"
          >
            github.com/eltpulsehq/eltpulse
          </a>
          .
        </p>
      </div>
    </div>
  );
}
