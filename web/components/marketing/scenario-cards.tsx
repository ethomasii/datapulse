import Link from "next/link";
import { ArrowRight, Zap } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { quickStartUrl } from "@/lib/elt/quick-start-catalog";
import type { PipelineScenario } from "@/lib/marketing/pipeline-scenarios";
import { SCENARIO_INDUSTRY_LABELS } from "@/lib/marketing/pipeline-scenarios";
import { getMarketingConnector } from "@/lib/marketing/connector-catalog";

export function ScenarioCard({ scenario }: { scenario: PipelineScenario }) {
  const source = getMarketingConnector(scenario.sourceSlug);
  const dest = getMarketingConnector(scenario.destinationSlug);
  const startHref = quickStartUrl({
    source: scenario.sourceSlug,
    destination: scenario.destinationSlug,
    scenario: scenario.id,
  });

  return (
    <article className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          <ConnectorIcon slug={scenario.sourceSlug} name={source?.name ?? scenario.sourceSlug} size={14} />
          {source?.name ?? scenario.sourceSlug}
        </span>
        <span className="text-xs text-slate-400" aria-hidden>
          →
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
          <ConnectorIcon slug={scenario.destinationSlug} name={dest?.name ?? scenario.destinationSlug} size={14} />
          {dest?.name ?? scenario.destinationSlug}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-400">
          {SCENARIO_INDUSTRY_LABELS[scenario.industry]}
        </span>
      </div>
      <h3 className="mt-3 text-lg font-semibold text-slate-900 dark:text-white">{scenario.title}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {scenario.description}
      </p>
      <p className="mt-3 text-xs font-medium text-slate-500 dark:text-slate-400">{scenario.persona}</p>
      <ul className="mt-3 space-y-1">
        {scenario.benefits.map((b) => (
          <li key={b} className="text-xs text-slate-600 dark:text-slate-400">
            · {b}
          </li>
        ))}
      </ul>
      <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
        <Link
          href={startHref}
          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <Zap className="h-4 w-4" aria-hidden />
          Start this scenario
        </Link>
        <Link
          href={`/connectors/${scenario.sourceSlug}`}
          className="text-sm font-medium text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
        >
          {source?.name ?? "Source"}
        </Link>
        <Link
          href={`/connectors/${scenario.destinationSlug}`}
          className="text-sm font-medium text-slate-600 hover:text-sky-600 dark:text-slate-400 dark:hover:text-sky-400"
        >
          {dest?.name ?? "Destination"}
        </Link>
      </div>
    </article>
  );
}

export function ScenarioCardGrid({ scenarios }: { scenarios: PipelineScenario[] }) {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      {scenarios.map((s) => (
        <ScenarioCard key={s.id} scenario={s} />
      ))}
    </div>
  );
}

export function ScenariosCta() {
  return (
    <Link
      href="/scenarios"
      className="inline-flex items-center gap-1.5 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
    >
      Browse all pipeline scenarios
      <ArrowRight className="h-4 w-4" />
    </Link>
  );
}
