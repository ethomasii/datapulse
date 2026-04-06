import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Roadmap",
  description: "What we are building for DataPulse — execution, Git, and team features.",
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
    status: "in-progress",
    title: "Managed Git commits",
    desc: "Push generated files into customer repos under the DataPulse GitHub org via app installation tokens.",
  },
  {
    status: "in-progress",
    title: "Codegen parity",
    desc: "Port more sources and destinations from the original Python pipeline_generator.",
  },
  {
    status: "planned",
    title: "Runs & observability",
    desc: "Execution history, logs, success/failure per run — similar in spirit to run lists in other control planes.",
  },
  {
    status: "planned",
    title: "Team & roles",
    desc: "Invite users, share pipelines, separate billing admin vs editor.",
  },
  {
    status: "research",
    title: "API & automation",
    desc: "Public or workspace-scoped API for CRUD on pipelines and triggering syncs.",
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
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Roadmap</h1>
      <p className="mt-4 text-lg text-slate-600 dark:text-slate-300">
        Priorities for DataPulse. Timelines shift with customer demand; we publish this page so expectations stay
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

      <ul className="mt-12 space-y-4">
        {ITEMS.map((item) => (
          <li
            key={item.title}
            className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 sm:flex-row sm:items-start sm:gap-4"
          >
            <StatusBadge status={item.status} />
            <div className="min-w-0 flex-1">
              <h2 className="font-semibold text-slate-900 dark:text-white">{item.title}</h2>
              <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{item.desc}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="mt-14 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          Want something bumped? Read <Link href="/docs">the docs</Link> and reach out through your account channel
          when support is wired — for now, use the contact path you already have with the team shipping DataPulse.
        </p>
      </div>
    </div>
  );
}
