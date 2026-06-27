import {
  ArrowRightLeft,
  Bot,
  Database,
  Filter,
  LayoutGrid,
  Plus,
  Save,
  Send,
  Target,
  Wand2,
} from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PULSE_AI_SHORT } from "@/lib/brand/pulse-ai";

const INPUT_ROWS = [
  { deal_id: "D-1042", dealstage: "closedwon", amount: "12000" },
  { deal_id: "D-1043", dealstage: "qualified", amount: "8400" },
  { deal_id: "D-1044", dealstage: "closedwon", amount: "22000" },
];

const OUTPUT_ROWS = [
  { deal_id: "D-1042", dealstage: "closedwon", amount: "12000" },
  { deal_id: "D-1044", dealstage: "closedwon", amount: "22000" },
];

function PreviewTable({
  title,
  table,
  rows,
  columns,
}: {
  title: string;
  table: string;
  rows: Record<string, string>[];
  columns: string[];
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col border-r border-slate-200 last:border-r-0 dark:border-slate-800">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-2.5 py-1 dark:border-slate-800">
        <p className="text-[8px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        <p className="truncate font-mono text-[8px] text-slate-400">{table}</p>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden p-1.5">
        <table className="w-full text-left text-[8px]">
          <thead>
            <tr className="bg-slate-100 dark:bg-slate-900">
              {columns.map((c) => (
                <th key={c} className="px-1.5 py-0.5 font-semibold text-slate-600 dark:text-slate-300">
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                {columns.map((c) => (
                  <td key={c} className="max-w-[4rem] truncate px-1.5 py-0.5 text-slate-700 dark:text-slate-300">
                    {row[c]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Full designer mockup — graph, Pulse AI bar, input/output previews (matches /builder?view=canvas). */
export function CanvasPreview({ className = "" }: { className?: string }) {
  return (
    <MarketingFrame title="eltpulse.dev — hubspot_sync · Canvas" className={className}>
      {/* Canvas workspace header */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="min-w-0">
          <p className="text-[8px] font-semibold uppercase tracking-wide text-sky-600">Canvas</p>
          <p className="truncate text-[11px] font-semibold text-slate-900 dark:text-white">hubspot_sync</p>
        </div>
        <div className="inline-flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
          {["Designer", "Ingest", "Transform DAG"].map((tab, i) => (
            <span
              key={tab}
              className={`rounded px-2 py-0.5 text-[9px] font-medium ${
                i === 0 ? "bg-sky-600 text-white" : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {tab}
            </span>
          ))}
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-sky-600 bg-sky-600 px-2 py-0.5 text-[9px] font-semibold text-white">
          <Save className="h-3 w-3" aria-hidden />
          Save to pipeline
        </span>
      </div>

      <div className="flex min-h-[420px]">
        {/* Operators sidebar */}
        <div className="hidden w-[72px] shrink-0 border-r border-slate-200 bg-slate-50/80 p-2 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <p className="text-[7px] font-semibold uppercase tracking-wide text-slate-400">Asset operators</p>
          <ul className="mt-2 space-y-1.5">
            {[
              { label: "Dedupe", color: "border-amber-300 bg-amber-50 text-amber-900" },
              { label: "Filter", color: "border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-400" },
              { label: "Join", color: "border-amber-200 bg-white text-slate-600" },
              { label: "Aggregate", color: "border-amber-200 bg-white text-slate-600" },
            ].map(({ label, color }) => (
              <li
                key={label}
                className={`rounded border px-1 py-1 text-center text-[7px] font-medium dark:bg-slate-900 ${color}`}
              >
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Main column: toolbar + graph + Pulse + previews */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Graph toolbar */}
          <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/90 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950/80">
            <span className="text-[8px] font-semibold uppercase tracking-wide text-slate-400">Add</span>
            <span className="inline-flex items-center gap-0.5 rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[8px] font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40">
              <Plus className="h-2.5 w-2.5" /> Source
            </span>
            <span className="inline-flex items-center gap-0.5 rounded border border-sky-300 bg-sky-50 px-1.5 py-0.5 text-[8px] font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/40">
              <Plus className="h-2.5 w-2.5" /> Destination
            </span>
            <span className="inline-flex items-center gap-0.5 rounded border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[8px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40">
              <ArrowRightLeft className="h-2.5 w-2.5" /> Transform
            </span>
            <span className="ml-auto inline-flex items-center gap-0.5 rounded border border-slate-200 px-1.5 py-0.5 text-[8px] text-slate-600 dark:border-slate-700">
              <LayoutGrid className="h-2.5 w-2.5" /> Auto layout
            </span>
          </div>

          {/* React Flow canvas */}
          <div className="relative min-h-[200px] flex-1 overflow-hidden bg-slate-50 bg-[length:16px_16px] bg-[radial-gradient(circle,_rgb(148_163_184/0.35)_1px,_transparent_1px)] dark:bg-slate-950 dark:bg-[radial-gradient(circle,_rgb(71_85_105/0.45)_1px,_transparent_1px)]">
            {/* Zoom controls (top-left, designer mode) */}
            <div className="absolute left-2 top-2 z-10 flex flex-col overflow-hidden rounded border border-slate-200 bg-white text-[8px] font-bold text-slate-500 shadow-sm dark:border-slate-700 dark:bg-slate-900">
              <span className="border-b border-slate-100 px-1.5 py-0.5 dark:border-slate-800">+</span>
              <span className="border-b border-slate-100 px-1.5 py-0.5 dark:border-slate-800">−</span>
              <span className="px-1 py-0.5 text-[7px]">⛶</span>
            </div>

            {/* Minimap (top-right) */}
            <div className="absolute right-2 top-2 z-10 h-12 w-[4.5rem] rounded border border-slate-200 bg-white/95 p-0.5 shadow-sm dark:border-slate-700 dark:bg-slate-900/95">
              <div className="relative h-full w-full rounded bg-slate-100 dark:bg-slate-800">
                <div className="absolute left-0.5 top-2 h-1.5 w-2 rounded-sm bg-emerald-400" />
                <div className="absolute left-[38%] top-1.5 h-2 w-2.5 rounded-sm bg-amber-400" />
                <div className="absolute left-[58%] top-2 h-1.5 w-2 rounded-sm bg-amber-300" />
                <div className="absolute left-[72%] top-1.5 h-2 w-2.5 rounded-sm bg-violet-400" />
                <div className="absolute right-0.5 top-2 h-1.5 w-2 rounded-sm bg-sky-400" />
                <div className="absolute inset-1 rounded border border-sky-400/60 bg-sky-400/10" />
              </div>
            </div>

            {/* Edges */}
            <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
              <defs>
                <marker id="canvas-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="rgb(56 189 248)" />
                </marker>
              </defs>
              {[
                "M 72 88 L 118 88",
                "M 178 88 L 224 88",
                "M 284 88 L 330 88",
                "M 386 88 L 432 88",
              ].map((d) => (
                <path
                  key={d}
                  d={d}
                  fill="none"
                  stroke="rgb(56 189 248)"
                  strokeWidth="1.5"
                  strokeDasharray="5 3"
                  markerEnd="url(#canvas-arrow)"
                />
              ))}
            </svg>

            {/* Extract */}
            <div className="absolute left-2 top-[52px] w-[68px] rounded-lg border-2 border-emerald-400 bg-white p-1.5 shadow dark:border-emerald-600 dark:bg-slate-900">
              <div className="flex items-center gap-1">
                <Database className="h-3 w-3 text-emerald-600" aria-hidden />
                <span className="text-[8px] font-bold text-slate-900 dark:text-white">Extract</span>
              </div>
              <div className="mt-1 flex items-center gap-0.5 rounded border border-emerald-100 bg-emerald-50/80 px-1 py-0.5 dark:border-emerald-900 dark:bg-emerald-950/40">
                <ConnectorIcon slug="hubspot" name="HubSpot" size={12} />
                <span className="text-[7px] font-medium">HubSpot</span>
              </div>
            </div>

            {/* Dedupe */}
            <div className="absolute left-[118px] top-[46px] w-[60px] rounded-lg border-2 border-amber-300 bg-white p-1.5 shadow dark:border-amber-700 dark:bg-slate-900">
              <div className="flex items-center gap-0.5">
                <Wand2 className="h-3 w-3 text-amber-600" aria-hidden />
                <span className="text-[7px] font-bold">dedupe</span>
              </div>
              <p className="mt-0.5 text-[6px] leading-tight text-slate-500">deal_id</p>
            </div>

            {/* Filter — selected */}
            <div className="absolute left-[224px] top-[44px] w-[60px] rounded-lg border-2 border-amber-400 bg-white p-1.5 shadow ring-2 ring-amber-400/40 dark:border-amber-500 dark:bg-slate-900">
              <div className="flex items-center gap-0.5">
                <Filter className="h-3 w-3 text-amber-600" aria-hidden />
                <span className="text-[7px] font-bold">filter</span>
              </div>
              <p className="mt-0.5 text-[6px] leading-tight text-slate-500">closedwon</p>
            </div>

            {/* dbt */}
            <div className="absolute left-[330px] top-[46px] w-[56px] rounded-lg border-2 border-violet-400 bg-white p-1.5 shadow dark:border-violet-600 dark:bg-slate-900">
              <div className="flex items-center gap-0.5">
                <ArrowRightLeft className="h-3 w-3 text-violet-600" aria-hidden />
                <span className="text-[7px] font-bold">dbt</span>
              </div>
              <p className="mt-0.5 text-[6px] leading-tight text-slate-500">stg_deals</p>
            </div>

            {/* Load */}
            <div className="absolute left-[432px] top-[52px] w-[68px] rounded-lg border-2 border-sky-400 bg-white p-1.5 shadow dark:border-sky-600 dark:bg-slate-900">
              <div className="flex items-center gap-1">
                <Target className="h-3 w-3 text-sky-600" aria-hidden />
                <span className="text-[8px] font-bold text-slate-900 dark:text-white">Load</span>
              </div>
              <div className="mt-1 flex items-center gap-0.5 rounded border border-sky-100 bg-sky-50/80 px-1 py-0.5 dark:border-sky-900 dark:bg-sky-950/40">
                <ConnectorIcon slug="snowflake" name="Snowflake" size={12} />
                <span className="text-[7px] font-medium">Snowflake</span>
              </div>
            </div>
          </div>

          {/* Pulse AI bar */}
          <div className="flex shrink-0 items-end gap-2 border-t border-slate-200 bg-white px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <Bot className="mb-1 h-3.5 w-3.5 shrink-0 text-teal-600" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] text-slate-500">
                Ask {PULSE_AI_SHORT} after{" "}
                <span className="font-medium text-amber-700 dark:text-amber-300">filter</span>
                …
              </p>
            </div>
            <span className="mb-0.5 flex h-6 w-6 items-center justify-center rounded-md bg-teal-600 text-white">
              <Send className="h-3 w-3" aria-hidden />
            </span>
          </div>

          {/* Input / output preview strip */}
          <div className="flex h-[88px] shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
            <PreviewTable
              title="Input data preview"
              table="raw.deals"
              columns={["deal_id", "dealstage", "amount"]}
              rows={INPUT_ROWS}
            />
            <PreviewTable
              title="Output data preview"
              table="stg.deals_filtered"
              columns={["deal_id", "dealstage", "amount"]}
              rows={OUTPUT_ROWS}
            />
          </div>
        </div>
      </div>
    </MarketingFrame>
  );
}

