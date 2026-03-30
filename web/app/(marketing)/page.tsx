import Link from "next/link";
import {
  ArrowRight,
  GitBranch,
  Layers,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";

const features = [
  {
    icon: Layers,
    title: "dlt + Sling in one flow",
    description:
      "Scaffold REST and database pipelines with smart defaults. Same mental model whether you ship Python or YAML.",
  },
  {
    icon: GitBranch,
    title: "Git-native",
    description:
      "Commit, push, and review pipeline changes like application code. Built for teams that already live in GitHub.",
  },
  {
    icon: Workflow,
    title: "Dagster-ready",
    description:
      "Every pipeline ships with metadata your orchestrator can discover — schedules, owners, tags, and asset kinds.",
  },
  {
    icon: Zap,
    title: "Fast iteration",
    description:
      "CLI for automation, web UI for exploration. Test credentials before you merge.",
  },
];

export default function HomePage() {
  return (
    <div>
      <section className="border-b border-slate-200 bg-gradient-to-b from-white to-slate-50 px-4 py-20 dark:border-slate-800 dark:from-slate-950 dark:to-slate-900 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
            <Sparkles className="h-3.5 w-3.5" aria-hidden />
            Now shipping as DataPulse
          </p>
          <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            ELT pipelines without the friction
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
            DataPulse is the control plane for designing and managing ingestion built on{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">dlt</span>,{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">Sling</span>, and{" "}
            <span className="font-medium text-slate-800 dark:text-slate-200">Dagster</span>.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Start free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="https://github.com/ethomasii/datapulse"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
            >
              View on GitHub
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
          Built for data engineers who ship
        </h2>
        <ul className="mt-12 grid gap-8 sm:grid-cols-2">
          {features.map(({ icon: Icon, title, description }) => (
            <li
              key={title}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <Icon className="h-8 w-8 text-sky-600" aria-hidden />
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-slate-600 dark:text-slate-300">{description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
