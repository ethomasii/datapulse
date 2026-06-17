import Link from "next/link";
import { Activity } from "lucide-react";

const repo = "https://github.com/eltpulsehq/eltpulse";

const columns = [
  {
    title: "Product",
    links: [
      { href: "/features", label: "Features" },
      { href: "/connectors", label: "Connectors" },
      { href: "/scenarios", label: "Scenarios" },
      { href: "/dbt", label: "dbt" },
      { href: "/quick-start", label: "Quick start" },
      { href: "/pricing", label: "Pricing" },
      { href: "/compare", label: "Compare" },
      { href: "/roadmap", label: "Roadmap" },
      { href: "/changelog", label: "Changelog" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Documentation" },
      { href: "/docs/connectors", label: "Connectors" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/pipelines", label: "Pipelines" },
      { href: "/docs/gateway", label: "Gateway" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "mailto:hello@eltpulse.dev", label: "Contact" },
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: repo, label: "GitHub", external: true as const },
    ],
  },
];

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 font-semibold text-slate-900 dark:text-white">
              <Activity className="h-5 w-5 text-sky-600" aria-hidden />
              eltPulse
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              The control plane for ELT pipelines — as easy as Fivetran, as flexible as dlt. You own the code.
            </p>
          </div>
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {col.title}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((link) => (
                  <li key={link.href}>
                    {"external" in link && link.external ? (
                      <a
                        href={link.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
                      >
                        {link.label}
                      </a>
                    ) : (
                      <Link
                        href={link.href}
                        className="text-sm text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
                      >
                        {link.label}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-8 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} eltPulse. All rights reserved.</p>
          <p>
            Sibling product:{" "}
            <a
              href="https://servicepulse.dev"
              className="font-medium text-sky-600 hover:underline dark:text-sky-400"
              target="_blank"
              rel="noreferrer"
            >
              ServicePulse
            </a>{" "}
            — vendor status intelligence
          </p>
        </div>
      </div>
    </footer>
  );
}
