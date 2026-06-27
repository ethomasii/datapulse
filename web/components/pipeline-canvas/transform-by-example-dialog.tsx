"use client";

import { useCallback, useEffect, useState } from "react";
import { ImagePlus, Loader2, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import type { ComponentListItem } from "@/components/elt/component-palette";
import { readClientFetchJson } from "@/lib/elt/fetch-json-body";
import type { CanvasNodeRef } from "@/components/pipeline-canvas/canvas-graph-actions-context";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";
import { resolveOutputTablesFromNode } from "@/lib/elt/canvas-wire-input";
import type { Edge, Node } from "@xyflow/react";

type Props = {
  open: boolean;
  pipelineId: string;
  node: CanvasNodeRef | null;
  getCanvasSnapshot?: () => { nodes: Node[]; edges: Edge[] } | null;
  wireInputContext?: {
    rawLandingTables?: string[];
    landingDataset?: string;
    pipelineName?: string;
  };
  onClose: () => void;
  onApply: (upstreamNodeId: string, component: ComponentListItem, config: Record<string, unknown>) => void;
};

type Inferred = {
  component_id: string;
  label: string;
  config: Record<string, unknown>;
  explanation: string;
};

function parsePastedTable(text: string): Record<string, unknown>[] {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const splitRow = (line: string) =>
    line.includes("\t")
      ? line.split("\t")
      : line.split("|").map((c) => c.trim()).filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""));

  let start = 0;
  if (/^[\|\-\s]+$/.test(lines[1] ?? "")) start = 2;

  const headers = splitRow(lines[start]!).map((h) => h.replace(/^\||\|$/g, "").trim());
  const rows: Record<string, unknown>[] = [];
  for (const line of lines.slice(start + 1)) {
    if (/^[\|\-\s]+$/.test(line)) continue;
    const cells = splitRow(line).map((c) => c.replace(/^\||\|$/g, "").trim());
    const row: Record<string, unknown> = {};
    headers.forEach((h, i) => {
      if (h) row[h] = cells[i] ?? "";
    });
    if (Object.keys(row).length) rows.push(row);
  }
  return rows;
}

export function TransformByExampleDialog({
  open,
  pipelineId,
  node,
  getCanvasSnapshot,
  wireInputContext,
  onClose,
  onApply,
}: Props) {
  const [mode, setMode] = useState<"table" | "screenshot">("table");
  const [outputPaste, setOutputPaste] = useState("");
  const [outputDescription, setOutputDescription] = useState("");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageMediaType, setImageMediaType] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loadingInput, setLoadingInput] = useState(false);
  const [inferring, setInferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inferred, setInferred] = useState<Inferred | null>(null);
  const [inputTable, setInputTable] = useState<string | null>(null);
  const [inputColumns, setInputColumns] = useState<string[]>([]);
  const [inputRows, setInputRows] = useState<Record<string, unknown>[]>([]);

  useEffect(() => {
    if (!open) {
      setOutputPaste("");
      setOutputDescription("");
      setImagePreview(null);
      setImageBase64(null);
      setImageMediaType(null);
      setInferred(null);
      setError(null);
      setMode("table");
      return;
    }

    if (!node) return;

    const snapshot = getCanvasSnapshot?.();
    let table: string | null = null;
    if (snapshot) {
      const n = snapshot.nodes.find((x) => x.id === node.nodeId);
      if (n?.type === "componentNode") {
        table = previewTableFromConfig((n.data as { config?: Record<string, unknown> })?.config ?? {});
      }
      if (!table) {
        const outs = resolveOutputTablesFromNode(snapshot.nodes, snapshot.edges, node.nodeId, wireInputContext);
        table = outs[0] ?? null;
      }
    }
    if (!table && node.config) {
      table = previewTableFromConfig(node.config);
    }
    setInputTable(table);

    if (!table || !pipelineId) return;

    let cancelled = false;
    setLoadingInput(true);
    void fetch(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}/preview`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ table, config: node.config ?? {}, limit: 10, includeProfiles: false }),
    })
      .then(async (res) => {
        const data = await readClientFetchJson<{
          columns?: string[];
          rows?: Record<string, unknown>[];
          error?: string;
        }>(res);
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Could not load input preview");
        setInputColumns(data.columns ?? []);
        setInputRows(data.rows ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Preview failed");
      })
      .finally(() => {
        if (!cancelled) setLoadingInput(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, node, pipelineId, getCanvasSnapshot, wireInputContext]);

  const onPasteImage = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const match = result.match(/^data:([^;]+);base64,(.+)$/);
      if (!match) return;
      setImageMediaType(match[1]!);
      setImageBase64(match[2]!);
      setImagePreview(result);
      setMode("screenshot");
    };
    reader.readAsDataURL(file);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            e.preventDefault();
            onPasteImage(file);
          }
          break;
        }
      }
    }
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [open, onPasteImage]);

  async function runInfer() {
    if (!node || !inputTable) return;
    setInferring(true);
    setError(null);
    setInferred(null);
    try {
      const outputExampleRows =
        mode === "table" && outputPaste.trim() ? parsePastedTable(outputPaste) : undefined;
      const res = await fetch(
        `/api/elt/pipelines/${encodeURIComponent(pipelineId)}/transform-by-example`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            inputTable,
            inputColumns,
            inputSampleRows: inputRows,
            outputExampleRows,
            outputDescription: outputDescription.trim() || undefined,
            imageBase64: mode === "screenshot" ? imageBase64 ?? undefined : undefined,
            imageMediaType:
              mode === "screenshot" && imageMediaType
                ? (imageMediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp")
                : undefined,
          }),
        }
      );
      const data = await readClientFetchJson<{ inferred?: Inferred; error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Inference failed");
      if (!data.inferred) throw new Error("No transform inferred");
      setInferred(data.inferred);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Inference failed");
    } finally {
      setInferring(false);
    }
  }

  function applyInferred() {
    if (!node || !inferred) return;
    const component: ComponentListItem = {
      id: inferred.component_id,
      name: inferred.label,
      category: "transformation",
      description: inferred.explanation,
      compileTarget: "warehouse",
      compileHint: inferred.explanation,
      canvasPorts: { left: true, right: true },
      isNative: true,
      isExecutable: true,
    };
    onApply(node.nodeId, component, inferred.config);
    onClose();
  }

  if (!open || !node) return null;

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tbe-title"
    >
      <div className="flex max-h-[min(92dvh,820px)] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-950">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div>
            <h2 id="tbe-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-violet-600" aria-hidden />
              Transform by example
            </h2>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-400">
              After <span className="font-medium">{node.label}</span>
              {inputTable ? (
                <>
                  {" "}
                  · input <span className="font-mono text-[10px]">{inputTable}</span>
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Before (sample)</p>
            {loadingInput ? (
              <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading preview…
              </p>
            ) : inputRows.length ? (
              <div className="mt-1 max-h-32 overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left text-[10px]">
                  <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                    <tr>
                      {inputColumns.map((c) => (
                        <th key={c} className="px-2 py-1 font-semibold">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inputRows.slice(0, 5).map((row, i) => (
                      <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                        {inputColumns.map((c) => (
                          <td key={c} className="max-w-[8rem] truncate px-2 py-1">
                            {String(row[c] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                No input rows loaded — link a destination and run sync, or wire an upstream table.
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("table")}
              className={clsx(
                "rounded-lg px-2.5 py-1 text-xs font-medium",
                mode === "table"
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100"
                  : "border border-slate-200 text-slate-600 dark:border-slate-700"
              )}
            >
              Paste target rows
            </button>
            <button
              type="button"
              onClick={() => setMode("screenshot")}
              className={clsx(
                "rounded-lg px-2.5 py-1 text-xs font-medium",
                mode === "screenshot"
                  ? "bg-violet-100 text-violet-900 dark:bg-violet-950/50 dark:text-violet-100"
                  : "border border-slate-200 text-slate-600 dark:border-slate-700"
              )}
            >
              Screenshot
            </button>
          </div>

          {mode === "table" ? (
            <>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Target example (TSV or markdown table)</span>
                <textarea
                  value={outputPaste}
                  onChange={(e) => setOutputPaste(e.target.value)}
                  rows={5}
                  placeholder={"order_id\tstatus\tamount\n1001\tshipped\t42.00"}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-slate-50 px-2 py-1.5 font-mono text-[11px] dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
              <label className="block text-xs">
                <span className="font-medium text-slate-700 dark:text-slate-300">Or describe the target</span>
                <input
                  value={outputDescription}
                  onChange={(e) => setOutputDescription(e.target.value)}
                  placeholder="e.g. keep active rows, sum amount by day"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900"
                />
              </label>
            </>
          ) : (
            <div className="rounded-lg border border-dashed border-slate-300 p-4 dark:border-slate-600">
              <label className="flex cursor-pointer flex-col items-center gap-2 text-center">
                <ImagePlus className="h-8 w-8 text-slate-400" aria-hidden />
                <span className="text-xs text-slate-600 dark:text-slate-400">
                  Paste a screenshot (Ctrl+V) or upload an image of the desired output
                </span>
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onPasteImage(f);
                  }}
                />
                <span className="rounded-lg bg-violet-600 px-3 py-1 text-xs font-medium text-white">
                  Choose image
                </span>
              </label>
              {imagePreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={imagePreview} alt="Target example" className="mx-auto mt-3 max-h-40 rounded border" />
              ) : null}
            </div>
          )}

          {inferred ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
              <p className="font-semibold">{inferred.label}</p>
              <p className="mt-1">{inferred.explanation}</p>
              <p className="mt-1 font-mono text-[10px] opacity-80">{inferred.component_id}</p>
            </div>
          ) : null}

          {error ? <p className="text-xs text-red-600 dark:text-red-400">{error}</p> : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs dark:border-slate-600"
          >
            Cancel
          </button>
          {!inferred ? (
            <button
              type="button"
              disabled={inferring || !inputTable}
              onClick={() => void runInfer()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
            >
              {inferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Infer transform
            </button>
          ) : (
            <button
              type="button"
              onClick={applyInferred}
              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
            >
              Add step to canvas
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
