import {
  ArrowRightLeft,
  Database,
  LayoutGrid,
  Plus,
  Target,
} from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

/** CSS mockup of the visual ELT canvas — source → transform → warehouse. */
export function CanvasPreview({ className = "" }: { className?: string }) {
  return (
    <MarketingFrame title="eltpulse.dev — Pipeline canvas" className={className}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 bg-slate-50/90 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/80">
        <span className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">Add</span>
        <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[9px] font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100">
          <Plus className="h-3 w-3" /> Source
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-sky-300 bg-sky-50 px-2 py-0.5 text-[9px] font-medium text-sky-900 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <Plus className="h-3 w-3" /> Destination
        </span>
        <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-0.5 text-[9px] font-medium text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <ArrowRightLeft className="h-3 w-3" /> Transform
        </span>
        <span className="ml-auto inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-0.5 text-[9px] text-slate-600 dark:border-slate-700 dark:text-slate-400">
          <LayoutGrid className="h-3 w-3" /> Auto layout
        </span>
      </div>

      {/* Canvas area */}
      <div
        className="relative min-h-[300px] overflow-hidden bg-[length:20px_20px] bg-[radial-gradient(circle,_rgb(148_163_184/0.35)_1px,_transparent_1px)] dark:bg-[radial-gradient(circle,_rgb(71_85_105/0.5)_1px,_transparent_1px)]"
      >
        {/* Edges (SVG) */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
          <defs>
            <marker id="arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill="rgb(56 189 248)" />
            </marker>
          </defs>
          <path
            d="M 118 150 L 200 150"
            fill="none"
            stroke="rgb(56 189 248)"
            strokeWidth="2"
            strokeDasharray="6 4"
            markerEnd="url(#arrow)"
          />
          <path
            d="M 318 150 L 400 150"
            fill="none"
            stroke="rgb(56 189 248)"
            strokeWidth="2"
            strokeDasharray="6 4"
            markerEnd="url(#arrow)"
          />
        </svg>

        {/* Source node */}
        <div className="absolute left-4 top-[118px] w-[100px] rounded-xl border-2 border-emerald-400 bg-white p-2 shadow-md dark:border-emerald-600 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white">Extract</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 rounded border border-emerald-100 bg-emerald-50/80 px-1.5 py-1 dark:border-emerald-900 dark:bg-emerald-950/40">
            <ConnectorIcon slug="hubspot" name="HubSpot" size={14} />
            <span className="text-[9px] font-medium text-slate-700 dark:text-slate-200">HubSpot</span>
          </div>
          <p className="mt-1 text-[8px] leading-tight text-slate-500">contacts, deals · slice by day</p>
        </div>

        {/* Transform node */}
        <div className="absolute left-[200px] top-[108px] w-[118px] rounded-xl border-2 border-amber-400 bg-white p-2 shadow-md ring-2 ring-amber-400/30 dark:border-amber-600 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600" aria-hidden />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white">Transform</span>
          </div>
          <div className="mt-1.5 rounded border border-amber-100 bg-amber-50/80 px-1.5 py-1 dark:border-amber-900 dark:bg-amber-950/40">
            <span className="text-[9px] font-medium text-amber-900 dark:text-amber-100">dbt · stg_deals</span>
          </div>
          <p className="mt-1 text-[8px] leading-tight text-slate-500">dedupe, type cast, rename</p>
        </div>

        {/* Destination node */}
        <div className="absolute left-[400px] top-[118px] w-[100px] rounded-xl border-2 border-sky-400 bg-white p-2 shadow-md dark:border-sky-600 dark:bg-slate-900">
          <div className="flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-sky-600" aria-hidden />
            <span className="text-[10px] font-bold text-slate-900 dark:text-white">Load</span>
          </div>
          <div className="mt-1.5 flex items-center gap-1 rounded border border-sky-100 bg-sky-50/80 px-1.5 py-1 dark:border-sky-900 dark:bg-sky-950/40">
            <ConnectorIcon slug="snowflake" name="Snowflake" size={14} />
            <span className="text-[9px] font-medium text-slate-700 dark:text-slate-200">Snowflake</span>
          </div>
          <p className="mt-1 text-[8px] leading-tight text-slate-500">analytics.raw_hubspot</p>
        </div>

        {/* Mini map */}
        <div className="absolute bottom-3 right-3 h-14 w-20 rounded border border-slate-200 bg-white/90 p-1 dark:border-slate-700 dark:bg-slate-900/90">
          <div className="relative h-full w-full rounded bg-slate-100 dark:bg-slate-800">
            <div className="absolute left-1 top-2 h-2 w-3 rounded-sm bg-emerald-400" />
            <div className="absolute left-6 top-1.5 h-2.5 w-4 rounded-sm bg-amber-400" />
            <div className="absolute right-1 top-2 h-2 w-3 rounded-sm bg-sky-400" />
          </div>
        </div>

        {/* Zoom controls hint */}
        <div className="absolute bottom-3 left-3 flex flex-col gap-0.5 rounded border border-slate-200 bg-white/90 text-[8px] font-bold text-slate-500 dark:border-slate-700 dark:bg-slate-900/90">
          <span className="border-b border-slate-100 px-1.5 py-0.5 dark:border-slate-800">+</span>
          <span className="px-1.5 py-0.5">−</span>
        </div>
      </div>
    </MarketingFrame>
  );
}
