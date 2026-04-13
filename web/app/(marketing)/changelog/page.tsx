import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Changelog",
  description: "eltPulse release notes.",
};

type Entry = {
  version: string;
  date: string;
  highlights: string[];
};

const ENTRIES: Entry[] = [
  {
    version: "0.3.0",
    date: "2026-03-30",
    highlights: [
      "Collapsible app sidebar (persisted) and light / dark / system theme toggle in app + marketing headers.",
      "Documentation section with sidebar: overview, getting started, pipelines, integrations, repositories, security.",
      "Roadmap and changelog pages expanded with structured content.",
      "Prisma `workspaceYaml` maps to DB column `workspace_yaml` (renamed from earlier `dagsterYaml`).",
    ],
  },
  {
    version: "0.2.0",
    date: "2026-03",
    highlights: [
      "Public docs, roadmap, changelog routes; Help section in sidebar (ServicePulse-style).",
      "Managed vs BYO GitHub documented; optional OAuth behind env flag.",
      "eltPulse workspace YAML replaces older Dagster-style artifact names in the product UI.",
    ],
  },
  {
    version: "0.1.0",
    date: "2026-03",
    highlights: [
      "Initial Next.js app: Clerk, Prisma EltPipeline, builder with GitHub + REST generators, dashboard and account.",
    ],
  },
];

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Changelog</h1>
      <p className="mt-4 text-slate-600 dark:text-slate-300">
        Release notes for the eltPulse web app. Version numbers are logical product milestones until we publish npm
        packages or a formal API semver.
      </p>

      <ol className="mt-12 space-y-12 border-l-2 border-slate-200 pl-8 dark:border-slate-700">
        {ENTRIES.map((entry) => (
          <li key={entry.version} className="relative">
            <span className="absolute -left-[calc(0.5rem+2px)] top-1.5 h-3 w-3 rounded-full border-2 border-white bg-sky-500 dark:border-slate-950" />
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">{entry.version}</h2>
              <time className="text-sm text-slate-500 dark:text-slate-400" dateTime={entry.date}>
                {entry.date}
              </time>
            </div>
            <ul className="mt-4 list-inside list-disc space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {entry.highlights.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
          </li>
        ))}
      </ol>

      <p className="mt-14 text-sm text-slate-500 dark:text-slate-500">
        Older history lives in git — see{" "}
        <a
          href="https://github.com/eltpulsehq/eltpulse"
          className="text-sky-600 hover:underline dark:text-sky-400"
          target="_blank"
          rel="noreferrer"
        >
          github.com/eltpulsehq/eltpulse
        </a>
        . Product updates are summarized here and on the{" "}
        <Link href="/roadmap" className="text-sky-600 hover:underline dark:text-sky-400">
          roadmap
        </Link>
        .
      </p>
    </div>
  );
}
