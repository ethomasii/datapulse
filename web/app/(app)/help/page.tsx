import Link from "next/link";
import {
  BookOpen,
  CircleHelp,
  Layers,
  Mail,
  Play,
  Rocket,
  Waypoints,
  Zap,
} from "lucide-react";
import { RelatedLinks } from "@/components/ui/related-links";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";

const FAQ = [
  {
    q: "How do I run my first pipeline?",
    a: "Use Quick start from the sidebar — pick a destination, source, and hit Create & run. Managed execution works without gateway setup.",
    href: "/quick-start",
  },
  {
    q: "Do I need Docker or a gateway?",
    a: "No. eltPulse-managed execution is the default. Deploy a customer gateway only when you need pipelines in your VPC.",
    href: "/gateway",
  },
  {
    q: "How is this different from Fivetran?",
    a: "You own the generated pipeline code and can export to Git. eltPulse is the control plane; execution can be ours or yours.",
    href: "/compare",
  },
  {
    q: "Where can I see everything we're ingesting?",
    a: "Open Assets in the Data catalog section — a config-derived map of sources, landing tables, and transform outputs across your pipelines.",
    href: "/assets",
  },
  {
    q: "How do run slices and backfills work?",
    a: "Configure partition columns on Run slices — slice values pass into generated dlt/Sling code as partition_key. See the docs for tier-1 connector coverage.",
    href: "/docs/run-slices",
  },
  {
    q: "Where are connectors documented?",
    a: "Public docs cover canvas, Pulse AI, run slices, orchestration, and security. The connector catalog lists 111+ sources with trust tiers.",
    href: "/docs",
  },
];

export default function HelpPage() {
  return (
    <AppPage width="narrow">
      <AppPageHeader
        eyebrow="Help center"
        title="Help"
        description="Answers, runbooks, and links to get unstuck fast."
      />
      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Start here</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            { href: "/quick-start", icon: Zap, title: "Quick start", desc: "First pipeline in 3 steps" },
            { href: "/assets", icon: Layers, title: "Workspace assets", desc: "Data map from pipeline config" },
            { href: "/docs/getting-started", icon: Rocket, title: "Getting started", desc: "Full setup guide" },
            { href: "/docs/pipelines", icon: Layers, title: "Pipelines & canvas", desc: "Visual designer, codegen, Pulse AI" },
            { href: "/docs/run-slices", icon: Zap, title: "Run slices", desc: "Backfills and incremental windows" },
            { href: "/docs/runs", icon: Play, title: "Runs", desc: "Telemetry and webhooks" },
          ].map(({ href, icon: Icon, title, desc }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/60"
              >
                <Icon className="mt-0.5 h-5 w-5 shrink-0 text-sky-600" aria-hidden />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-white">{title}</p>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{desc}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500">
          <CircleHelp className="h-4 w-4" /> FAQ
        </h2>
        <ul className="mt-4 space-y-3">
          {FAQ.map(({ q, a, href }) => (
            <li
              key={q}
              className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
            >
              <p className="font-semibold text-slate-900 dark:text-white">{q}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{a}</p>
              <Link href={href} className="mt-2 inline-block text-xs font-medium text-sky-600 hover:underline">
                Learn more →
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-start gap-3">
          <Mail className="mt-0.5 h-5 w-5 text-slate-500" aria-hidden />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Contact support</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Email{" "}
              <a href="mailto:hello@eltpulse.dev" className="font-medium text-sky-600 hover:underline">
                hello@eltpulse.dev
              </a>{" "}
              — Pro and Team plans include priority support.
            </p>
          </div>
        </div>
      </section>

      <div className="mt-10">
        <RelatedLinks
          links={[
            { href: "/roadmap", icon: BookOpen, label: "Roadmap", desc: "What we're building next" },
            { href: "/orchestration", icon: Waypoints, label: "Orchestration", desc: "Schedules and monitors" },
          ]}
        />
      </div>
    </AppPage>
  );
}
