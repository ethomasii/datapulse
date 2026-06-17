"use client";

import { useMemo, useState } from "react";
import {
  PIPELINE_SCENARIOS,
  SCENARIO_INDUSTRIES,
  type PipelineScenario,
  type ScenarioIndustry,
} from "@/lib/marketing/pipeline-scenarios";
import { ScenarioCard } from "@/components/marketing/scenario-cards";

export function ScenarioBrowser({ scenarios = PIPELINE_SCENARIOS }: { scenarios?: PipelineScenario[] }) {
  const [industry, setIndustry] = useState<ScenarioIndustry | "">("");

  const filtered = useMemo(() => {
    if (!industry) return scenarios;
    return scenarios.filter((s) => s.industry === industry);
  }, [industry, scenarios]);

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setIndustry("")}
          className={`rounded-full px-3 py-1 text-xs font-medium transition ${
            !industry
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          All industries
        </button>
        {SCENARIO_INDUSTRIES.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setIndustry(id === industry ? "" : id)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              industry === id
                ? "bg-sky-600 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        {filtered.length} scenario{filtered.length === 1 ? "" : "s"}
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        {filtered.map((s) => (
          <ScenarioCard key={s.id} scenario={s} />
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No scenarios in this industry yet.</p>
      ) : null}
    </div>
  );
}
