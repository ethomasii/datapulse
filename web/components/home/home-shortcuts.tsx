import Link from "next/link";
import { BarChart3, BookOpen, Cable, Layers, PenLine, PlayCircle, Zap } from "lucide-react";

const SHORTCUTS = [
  { href: "/runs", label: "Runs", desc: "Trigger and inspect executions", icon: PlayCircle },
  { href: "/builder", label: "Pipelines", desc: "Form builder and config", icon: Layers },
  { href: "/builder/canvas", label: "Visual canvas", desc: "Diagram editor and Genie", icon: PenLine },
  { href: "/observability", label: "Metrics", desc: "Trends, filters, alert rules", icon: BarChart3 },
  { href: "/connections", label: "Connections", desc: "Sources and warehouses", icon: Cable },
  { href: "/quick-start", label: "Quick start", desc: "Guided first pipeline", icon: Zap },
  { href: "/catalog", label: "Library", desc: "Scenarios, dbt, connectors, recipes", icon: BookOpen },
] as const;

export function HomeShortcuts() {
  return (
    <section>
      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Shortcuts</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SHORTCUTS.map(({ href, label, desc, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex h-full items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:bg-sky-50/30 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-800 dark:hover:bg-sky-950/20"
            >
              <Icon className="mt-0.5 h-4 w-4 shrink-0 text-sky-600 dark:text-sky-400" aria-hidden />
              <span>
                <span className="block text-sm font-medium text-slate-900 dark:text-white">{label}</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{desc}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
