import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What we are building for eltPulse — execution, Git, and team features.",
};

type Status = "shipped" | "in-progress" | "planned" | "research";

const STATUS_STYLES: Record<Status, string> = {
  shipped: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200",
  "in-progress": "bg-sky-100 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200",
  planned: "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200",
  research: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
};

const ITEMS: {
  status: Status;
  title: string;
  desc: string;
}[] = [
  {
    status: "shipped",
    title: "Hosted builder & Neon storage",
    desc: "Next.js app, Clerk, Prisma pipelines, generated sync artifacts, workspace YAML.",
  },
  {
    status: "shipped",
    title: "Docs, roadmap, changelog (public)",
    desc: "Product docs with sidebar, public roadmap and release notes pages.",
  },
  {
    status: "shipped",
    title: "Runs & observability",
    desc: "Execution history, live telemetry, logs, dashboard charts, outgoing webhooks on terminal status.",
  },
  {
    status: "shipped",
    title: "Source catalog & AI assistant",
    desc: "111+ connectors from the dlt hub registry, catalog wizard, and AI pipeline scaffolding in the builder.",
  },
  {
    status: "shipped",
    title: "Schedules, monitors & run slices",
    desc: "Cron schedules, file-arrival monitors (S3/SQS/GCS), and partition-aware run slices.",
  },
  {
    status: "shipped",
    title: "Gateway & customer execution plane",
    desc: "Agent tokens, heartbeat, Docker/K8s deploy manifests, and eltPulse-managed execution (default).",
  },
  {
    status: "in-progress",
    title: "Managed Git commits",
    desc: "Push generated files into customer repos under the eltPulse GitHub org via app installation tokens.",
  },
  {
    status: "in-progress",
    title: "Codegen parity",
    desc: "Port more sources and destinations from the original Python pipeline_generator.",
  },
  {
    status: "in-progress",
    title: "Real managed execution",
    desc: "Production-grade eltPulse-managed workers (today: stub/local/GitHub dispatch; scaling to queue workers).",
  },
  {
    status: "planned",
    title: "Team & roles",
    desc: "Invite users, share pipelines, separate billing admin vs editor.",
  },
  {
    status: "planned",
    title: "Billing & checkout",
    desc: "Stripe self-serve upgrades, usage meters, and included row volume per tier.",
  },
  {
    status: "research",
    title: "API & automation",
    desc: "Public or workspace-scoped API keys for CRUD on pipelines and triggering syncs.",
  },
];

function StatusBadge({ status }: { status: Status }) {
  const label =
    status === "shipped"
      ? "Shipped"
      : status === "in-progress"
        ? "In progress"
        : status === "planned"
          ? "Planned"
          : "Research";
  return (
    <span
      className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[status]}`}
    >
      {label}
    </span>
  );
}

export default function RoadmapPage() {
  const shipped = ITEMS.filter((i) => i.status === "shipped");
  const inProgress = ITEMS.filter((i) => i.status === "in-progress");
  const planned = ITEMS.filter((i) => i.status === "planned" || i.status === "research");

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Roadmap</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Priorities for eltPulse. Timelines shift with customer demand; we publish this page so expectations stay
        aligned — the same reason we keep a public roadmap on{" "}
        <a
          href="https://servicepulse.dev/roadmap"
          className="text-sky-600 hover:underline dark:text-sky-400"
          target="_blank"
          rel="noreferrer"
        >
          ServicePulse
        </a>
        .
      </p>

      <section className="mt-12">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Shipped
        </h2>
        <ul className="mt-4 space-y-4">
          {shipped.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-start sm:gap-4"
            >
              <StatusBadge status={item.status} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-sky-700 dark:text-sky-400">
          In progress
        </h2>
        <ul className="mt-4 space-y-4">
          {inProgress.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-start sm:gap-4"
            >
              <StatusBadge status={item.status} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-violet-700 dark:text-violet-400">
          Planned & research
        </h2>
        <ul className="mt-4 space-y-4">
          {planned.map((item) => (
            <li
              key={item.title}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-start sm:gap-4"
            >
              <StatusBadge status={item.status} />
              <div className="min-w-0 flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{item.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-14 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Want something bumped? Read <Link href="/docs">the docs</Link> and reach out through your account channel
          when support is wired — for now, use the contact path you already have with the team shipping eltPulse.
        </p>
      </div>
    </div>
  );
}
