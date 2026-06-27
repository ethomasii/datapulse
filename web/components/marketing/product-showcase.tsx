"use client";

import { useState } from "react";
import { Bot, Layers, LineChart } from "lucide-react";
import { CanvasPreview } from "@/components/marketing/canvas-preview";
import { PulseAiPreview } from "@/components/marketing/pulse-ai-preview";
import { RunsPreview } from "@/components/marketing/runs-preview";

const VIEWS = [
  {
    id: "canvas",
    label: "Visual canvas",
    icon: Layers,
    caption: "Drag-and-drop ELT designer — sources, transforms, and any warehouse on one graph.",
  },
  {
    id: "pulse-ai",
    label: "Pulse AI",
    icon: Bot,
    caption: "Describe changes in plain English. Pulse AI patches the canvas and generated pipeline code.",
  },
  {
    id: "runs",
    label: "Runs & slices",
    icon: LineChart,
    caption: "Live telemetry, partition backfills, and observability — Fivetran-grade ops without lock-in.",
  },
] as const;

type ViewId = (typeof VIEWS)[number]["id"];

export function ProductShowcase() {
  const [active, setActive] = useState<ViewId>("canvas");
  const current = VIEWS.find((v) => v.id === active)!;

  return (
    <div className="w-full">
      <div
        className="flex flex-wrap justify-center gap-2 sm:justify-start lg:justify-center"
        role="tablist"
        aria-label="Product preview"
      >
        {VIEWS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active === id}
            onClick={() => setActive(id)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
              active === id
                ? "bg-sky-600 text-white shadow-md shadow-sky-600/25"
                : "border border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-sky-800"
            }`}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>

      <p className="mt-4 text-center text-sm text-slate-600 dark:text-slate-400 lg:text-center">{current.caption}</p>

      <div className="mt-6" role="tabpanel">
        {active === "canvas" ? <CanvasPreview /> : null}
        {active === "pulse-ai" ? <PulseAiPreview /> : null}
        {active === "runs" ? <RunsPreview /> : null}
      </div>
    </div>
  );
}
