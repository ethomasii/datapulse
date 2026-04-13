import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Compare",
  description:
    "How eltPulse relates to Fivetran, Airbyte, Hevo, and other ELT approaches — managed SaaS, open source, and git-native control planes.",
};

type Row = {
  dimension: string;
  eltpulse: string;
  fivetran: string;
  airbyte: string;
  hevo: string;
  others: string;
};

const rows: Row[] = [
  {
    dimension: "What it optimizes for",
    eltpulse:
      "Definitions as code, Git review, control plane for pipeline codegen and policy — you choose where jobs run.",
    fivetran:
      "Broad managed connectors and reliability; you operate inside their product and billing model.",
    airbyte:
      "Large connector catalog; strong self-hosted and Airbyte Cloud options; community and extensibility.",
    hevo:
      "Managed pipelines and activation (e.g. reverse ETL); approachable for teams wanting less infra.",
    others:
      "Varies: e.g. Matillion (transform in the warehouse), Meltano / Singer (pipelines as projects), Stitch (Singer, Talend ecosystem), Portable and niche ELT tools — each with a different center of gravity.",
  },
  {
    dimension: "Where pipeline logic lives",
    eltpulse: "Repo-friendly artifacts + UI; built to diff, PR, and export like application code.",
    fivetran: "Primarily in-product configuration; Git integrations exist but the core model is managed SaaS.",
    airbyte: "Connector configs and syncs in Airbyte; OSS lets you fork and extend.",
    hevo: "In-product pipelines and dashboards; less emphasis on Git-as-source-of-truth.",
    others: "Often UI-first or Singer/YAML projects; depends on vendor and self-host vs cloud.",
  },
  {
    dimension: "Execution & data plane",
    eltpulse:
      "Designed for BYO runners or future managed agents; infra cost with transparent markup is the direction of travel.",
    fivetran: "Runs on Fivetran’s infrastructure; you pay for usage and plan tier.",
    airbyte: "Self-hosted (your compute) or Airbyte Cloud (managed).",
    hevo: "Hevo-hosted execution for managed product tiers.",
    others: "Ranges from fully managed to self-hosted open core; check each vendor’s deployment model.",
  },
  {
    dimension: "Pricing posture (high level)",
    eltpulse:
      "Usage-oriented (rows, network, compute) with explicit margin on hosted compute — see Pricing & Billing.",
    fivetran: "Consumption (e.g. MAR) and plan-based; enterprise contracts common.",
    airbyte: "Cloud credits / usage; OSS is free, ops cost is yours.",
    hevo: "Event- or connector-based tiers; varies by product line.",
    others: "Seat, row, credit, or warehouse-time models are all common — compare list prices and egress carefully.",
  },
  {
    dimension: "Open source",
    eltpulse: "Open-source core plus SaaS shell; built on battle-tested open-source sync engines.",
    fivetran: "Proprietary managed service.",
    airbyte: "OSS core + commercial cloud.",
    hevo: "Proprietary managed service.",
    others: "Meltano OSS; Matillion commercial; many Singer taps are open — the product wrapper varies.",
  },
];

export default function ComparePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Marketing</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        eltPulse and other ELT vendors
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
        Buyers compare dozens of tools:{" "}
        <span className="font-medium text-slate-800 dark:text-slate-200">Fivetran</span>,{" "}
        <span className="font-medium text-slate-800 dark:text-slate-200">Airbyte</span>,{" "}
        <span className="font-medium text-slate-800 dark:text-slate-200">Hevo</span>, Matillion, Meltano, Stitch,
        Portable, and others. None of them are “wrong” — they optimize for different constraints. This page situates{" "}
        <span className="font-medium text-slate-800 dark:text-slate-200">eltPulse</span> honestly: a{" "}
        <strong className="font-medium">git-native control plane</strong> for designing, running, and observing data
        pipelines — with transparent usage economics and the ability to run workloads on your own agents.
      </p>
      <p className="mt-4 text-sm text-slate-500 dark:text-slate-500">
        Product names are trademarks of their respective owners. Summaries are for orientation only — verify features and
        pricing with each vendor before you buy.
      </p>

      <div className="mt-12 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900/80">
              <th className="sticky left-0 z-10 w-40 bg-slate-50 px-4 py-3 font-semibold text-slate-900 dark:bg-slate-900 dark:text-white">
                Dimension
              </th>
              <th className="px-4 py-3 font-semibold text-sky-800 dark:text-sky-200">eltPulse</th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Fivetran</th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Airbyte</th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Hevo</th>
              <th className="px-4 py-3 font-semibold text-slate-900 dark:text-white">Other ELT / ETL</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.dimension} className="border-b border-slate-100 dark:border-slate-800">
                <th
                  scope="row"
                  className="sticky left-0 bg-white px-4 py-3 align-top text-xs font-semibold uppercase tracking-wide text-slate-500 dark:bg-slate-950 dark:text-slate-400"
                >
                  {row.dimension}
                </th>
                <td className="bg-sky-50/50 px-4 py-3 align-top text-slate-700 dark:bg-sky-950/20 dark:text-slate-300">
                  {row.eltpulse}
                </td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{row.fivetran}</td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{row.airbyte}</td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{row.hevo}</td>
                <td className="px-4 py-3 align-top text-slate-600 dark:text-slate-400">{row.others}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-12 space-y-4 text-slate-600 dark:text-slate-400">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">When eltPulse is a strong fit</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>You want pipeline definitions to live next to application code: PRs, environments, ownership.</li>
          <li>You want a product layer for connector catalog, smart hints, and pipeline exports — without building it yourself.</li>
          <li>You care about transparent pass-through pricing for any hosted execution we add later.</li>
        </ul>
        <h2 className="pt-4 text-lg font-semibold text-slate-900 dark:text-white">When to look elsewhere</h2>
        <ul className="list-inside list-disc space-y-2">
          <li>You need the widest managed connector catalog on day one — mature SaaS catalogs still lead on breadth.</li>
          <li>You want a fully turnkey reverse-ETL or CDP; that is not eltPulse’s core focus today.</li>
          <li>You have no appetite for Git or code artifacts; a UI-only managed tool may feel simpler.</li>
        </ul>
      </section>

      <div className="mt-12 flex flex-wrap gap-4">
        <Link
          href="/pricing"
          className="inline-flex rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          View pricing
        </Link>
        <Link
          href="/docs"
          className="inline-flex rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Read the docs
        </Link>
      </div>
    </div>
  );
}
