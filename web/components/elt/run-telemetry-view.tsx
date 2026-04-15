"use client";

import type { RunTelemetry, TelemetrySample } from "@/lib/elt/run-telemetry";
import { formatBytes, formatRows, parseRunTelemetry } from "@/lib/elt/run-telemetry";

function pickSeries(samples: TelemetrySample[]): { values: number[]; label: string; formatter: (n: number) => string } {
  const hasRows = samples.some((s) => typeof s.rows === "number");
  if (hasRows) {
    return {
      values: samples.map((s) => (typeof s.rows === "number" ? s.rows : 0)),
      label: "Rows loaded over time",
      formatter: formatRows,
    };
  }
  const hasBytes = samples.some((s) => typeof s.bytes === "number");
  if (hasBytes) {
    return {
      values: samples.map((s) => (typeof s.bytes === "number" ? s.bytes : 0)),
      label: "Bytes loaded over time",
      formatter: formatBytes,
    };
  }
  const hasProgress = samples.some((s) => typeof s.progress === "number");
  if (hasProgress) {
    return {
      values: samples.map((s) => (typeof s.progress === "number" ? s.progress : 0)),
      label: "Progress % over time",
      formatter: (n) => `${Math.round(n)}%`,
    };
  }
  return { values: [], label: "No time-series yet", formatter: String };
}

function formatTimeLabel(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

function TelemetryChart({ samples }: { samples: TelemetrySample[] }) {
  const { values, label, formatter } = pickSeries(samples);

  if (values.length < 2) {
    return (
      <div className="flex h-[100px] items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-950/40 dark:text-slate-400">
        Append <code className="mx-1 rounded bg-slate-200 px-1 dark:bg-slate-800">appendTelemetrySample</code> while
        the run is active to chart rows, bytes, or progress over time.
      </div>
    );
  }

  const w = 520;
  const h = 110;
  const padTop = 8;
  const padBottom = 26;
  const padLeft = 52;
  const padRight = 12;
  const plotW = w - padLeft - padRight;
  const plotH = h - padTop - padBottom;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;

  const timestamps = samples.map((s) => (s.at ? new Date(s.at).getTime() : 0));
  const tMin = Math.min(...timestamps);
  const tMax = Math.max(...timestamps);
  const tSpan = tMax - tMin || 1;

  const pts = values
    .map((v, i) => {
      const x = padLeft + ((timestamps[i] - tMin) / tSpan) * plotW;
      const y = padTop + (1 - (v - min) / span) * plotH;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  // Area fill
  const firstX = (padLeft + ((timestamps[0] - tMin) / tSpan) * plotW).toFixed(1);
  const lastX = (padLeft + ((timestamps[values.length - 1] - tMin) / tSpan) * plotW).toFixed(1);
  const baseY = (padTop + plotH).toFixed(1);
  const areaPts = `${firstX},${baseY} ${pts} ${lastX},${baseY}`;

  // Y-axis tick labels (3 ticks: min, mid, max)
  const yTicks = [min, min + span / 2, max];

  // X-axis: show first and last timestamp
  const xLabels: { x: number; label: string }[] = [];
  if (tMin > 0) xLabels.push({ x: padLeft, label: formatTimeLabel(samples[0].at ?? "") });
  if (tMax > 0 && tMax !== tMin) xLabels.push({ x: padLeft + plotW, label: formatTimeLabel(samples[samples.length - 1].at ?? "") });

  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="overflow-visible"
        role="img"
        aria-label={label}
        style={{ maxWidth: w }}
      >
        {/* Grid lines */}
        {yTicks.map((_, i) => {
          const y = padTop + (1 - i / 2) * plotH;
          return (
            <line
              key={i}
              x1={padLeft}
              x2={padLeft + plotW}
              y1={y.toFixed(1)}
              y2={y.toFixed(1)}
              stroke="currentColor"
              strokeWidth="0.5"
              className="text-slate-200 dark:text-slate-700"
              strokeDasharray="3,3"
            />
          );
        })}
        {/* Area fill */}
        <polygon
          points={areaPts}
          className="fill-sky-500/10 dark:fill-sky-400/10"
        />
        {/* Line */}
        <polyline
          fill="none"
          className="stroke-sky-600 dark:stroke-sky-400"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          points={pts}
        />
        {/* Data points */}
        {values.map((v, i) => {
          const x = padLeft + ((timestamps[i] - tMin) / tSpan) * plotW;
          const y = padTop + (1 - (v - min) / span) * plotH;
          return (
            <circle
              key={i}
              cx={x.toFixed(1)}
              cy={y.toFixed(1)}
              r="3"
              className="fill-sky-600 dark:fill-sky-400"
            />
          );
        })}
        {/* Y-axis labels */}
        {yTicks.map((tick, i) => {
          const y = padTop + (1 - i / 2) * plotH;
          return (
            <text
              key={i}
              x={(padLeft - 6).toString()}
              y={y.toFixed(1)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize="9"
              className="fill-slate-400 dark:fill-slate-500"
            >
              {formatter(tick)}
            </text>
          );
        })}
        {/* X-axis labels */}
        {xLabels.map(({ x, label: lbl }, i) => (
          <text
            key={i}
            x={x.toString()}
            y={(h - 6).toString()}
            textAnchor={i === 0 ? "start" : "end"}
            fontSize="9"
            className="fill-slate-400 dark:fill-slate-500"
          >
            {lbl}
          </text>
        ))}
      </svg>
    </div>
  );
}


export function RunTelemetrySummaryCards({ telemetry }: { telemetry: RunTelemetry }) {
  const s = telemetry.summary;
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rows</div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
          {s.rowsLoaded !== undefined ? formatRows(s.rowsLoaded) : "—"}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bytes</div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
          {s.bytesLoaded !== undefined ? formatBytes(s.bytesLoaded) : "—"}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Progress</div>
        <div className="mt-0.5 font-mono text-sm font-semibold text-slate-900 dark:text-white">
          {s.progress !== undefined ? `${Math.round(s.progress)}%` : "—"}
        </div>
      </div>
      <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Updated</div>
        <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">
          {s.updatedAt ? new Date(s.updatedAt).toLocaleString() : "—"}
        </div>
      </div>
      {(s.currentPhase || s.currentResource) && (
        <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300 sm:col-span-4">
          {s.currentPhase ? (
            <div>
              <span className="font-semibold text-slate-600 dark:text-slate-400">Phase: </span>
              {s.currentPhase}
            </div>
          ) : null}
          {s.currentResource ? (
            <div className="mt-1 truncate">
              <span className="font-semibold text-slate-600 dark:text-slate-400">Resource: </span>
              {s.currentResource}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function RunTelemetryView({ telemetryRaw }: { telemetryRaw: unknown }) {
  const telemetry = parseRunTelemetry(telemetryRaw);

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs font-medium uppercase text-slate-500">Telemetry</span>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Live samples via <code className="text-[11px]">PATCH</code> (<code className="text-[11px]">appendTelemetrySample</code> /{" "}
          <code className="text-[11px]">telemetrySummary</code>). Same fields on{" "}
          <code className="text-[11px]">/api/elt/runs/:id</code> and <code className="text-[11px]">/api/agent/runs/:id</code>.
        </p>
      </div>
      <RunTelemetrySummaryCards telemetry={telemetry} />
      <TelemetryChart samples={telemetry.samples} />
      <p className="text-[10px] text-slate-400 dark:text-slate-500">{telemetry.samples.length} sample(s) stored (cap 2 000)</p>
    </div>
  );
}

export function RunTelemetryTableCells({ telemetryRaw }: { telemetryRaw: unknown }) {
  const { summary } = parseRunTelemetry(telemetryRaw);
  return (
    <>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
        {summary.progress !== undefined ? `${Math.round(summary.progress)}%` : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
        {summary.rowsLoaded !== undefined ? formatRows(summary.rowsLoaded) : "—"}
      </td>
      <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-200">
        {summary.bytesLoaded !== undefined ? formatBytes(summary.bytesLoaded) : "—"}
      </td>
    </>
  );
}
