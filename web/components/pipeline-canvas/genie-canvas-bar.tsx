"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Bot, ChevronUp, Loader2, Send } from "lucide-react";
import clsx from "clsx";
import { AiPipelineAssistant } from "@/components/elt/ai-pipeline-assistant";
import type { PatchPipelinePayload } from "@/app/api/elt/ai-assistant/route";

export type CanvasGenieNodeContext = {
  nodeId: string;
  componentId?: string;
  label?: string;
  config?: Record<string, unknown>;
};

type Props = {
  pipelineId?: string;
  onPipelinePatched?: () => void;
  selectedLabel?: string;
  canvasNode?: CanvasGenieNodeContext | null;
  getCanvasSnapshot?: () => { nodes: Node[]; edges: Edge[] } | null;
  onPatchNode?: (nodeId: string, patch: Record<string, unknown>) => void;
  onReplaceGraph?: (nodes: Node[], edges: Edge[]) => void;
};

/** Lakeflow Genie-style NL bar — inline prompt tied to the selected canvas step. */
export function GenieCanvasBar({
  pipelineId,
  onPipelinePatched,
  selectedLabel,
  canvasNode,
  getCanvasSnapshot,
  onPatchNode,
  onReplaceGraph,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReply, setQuickReply] = useState<string | null>(null);
  const [pendingPatch, setPendingPatch] = useState<{
    pipelineId: string;
    patch: PatchPipelinePayload;
  } | null>(null);
  const [applyingPatch, setApplyingPatch] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = selectedLabel
    ? `Add or edit after ${selectedLabel}… (e.g. add dedupe step, filter active rows)`
    : "Add a step… (e.g. add filter, dedupe on id, aggregate by day)";

  const applyCanvasPatch = useCallback(
    async (id: string, patch: PatchPipelinePayload) => {
      setApplyingPatch(true);
      try {
        const res = await fetch(`/api/elt/pipelines/${id}`, {
          method: "PATCH",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const data = (await res.json()) as { error?: string; errors?: string[] };
        if (!res.ok) {
          const detail =
            Array.isArray(data.errors) && data.errors.length
              ? data.errors.join(" ")
              : data.error ?? "Apply failed";
          throw new Error(detail);
        }
        setPendingPatch(null);
        onPipelinePatched?.();
      } finally {
        setApplyingPatch(false);
      }
    },
    [onPipelinePatched]
  );

  const sendQuick = useCallback(async () => {
    const text = draft.trim();
    if (!text || !pipelineId || sending) return;
    setSending(true);
    setQuickReply(null);
    setPendingPatch(null);
    try {
      const snapshot = getCanvasSnapshot?.();
      const res = await fetch("/api/elt/ai-assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          canvasNodeContext: canvasNode ?? undefined,
          canvasSnapshot: snapshot
            ? { nodes: snapshot.nodes, edges: snapshot.edges, v: 1 }
            : undefined,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        patchPayload?: PatchPipelinePayload;
        patchPipelineId?: string;
        patchMode?: "canvas_local" | "pipeline";
        nodePatch?: { nodeId: string; config: Record<string, unknown> };
      };
      if (!res.ok) throw new Error(data.error ?? "Genie request failed");

      if (data.nodePatch && onPatchNode) {
        onPatchNode(data.nodePatch.nodeId, { config: data.nodePatch.config });
        setQuickReply(
          (data.message ?? "Updated step config.") + " Save to pipeline when you're ready."
        );
        setDraft("");
        return;
      }

      if (data.patchPayload && data.patchMode === "canvas_local" && onReplaceGraph) {
        onReplaceGraph(
          data.patchPayload.canvas.nodes as Node[],
          data.patchPayload.canvas.edges as Edge[]
        );
        setQuickReply(
          (data.message ?? "Added step to the canvas.") + " Save to pipeline when you're ready."
        );
        setDraft("");
        return;
      }

      if (data.patchPayload && data.patchPipelineId) {
        setPendingPatch({ pipelineId: data.patchPipelineId, patch: data.patchPayload });
        setQuickReply(
          (data.message ?? "Genie prepared canvas changes.") +
            " Review and apply — nothing is saved until you confirm."
        );
        setDraft("");
        return;
      }

      setQuickReply(data.message ?? "Done.");
      setDraft("");
    } catch (e) {
      setQuickReply(e instanceof Error ? e.message : "Genie request failed");
    } finally {
      setSending(false);
    }
  }, [canvasNode, draft, getCanvasSnapshot, onPatchNode, onReplaceGraph, pipelineId, sending]);

  useEffect(() => {
    if (!expanded) return;
    textareaRef.current?.focus();
  }, [expanded, selectedLabel]);

  return (
    <div className="relative z-30 shrink-0 isolate border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-end gap-2 px-3 py-2">
        <Bot className="mb-2 h-4 w-4 shrink-0 text-teal-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void sendQuick();
              }
            }}
            rows={1}
            placeholder={placeholder}
            className="w-full resize-none bg-transparent text-sm text-slate-800 placeholder-slate-400 outline-none dark:text-slate-100"
          />
          {quickReply ? (
            <p className="mt-1 line-clamp-3 text-[11px] text-slate-600 dark:text-slate-400">{quickReply}</p>
          ) : null}
          {pendingPatch ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={applyingPatch}
                onClick={() => void applyCanvasPatch(pendingPatch.pipelineId, pendingPatch.patch)}
                className="rounded-lg bg-teal-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-teal-500 disabled:opacity-50"
              >
                {applyingPatch ? "Applying…" : "Apply canvas changes"}
              </button>
              <button
                type="button"
                disabled={applyingPatch}
                onClick={() => {
                  setPendingPatch(null);
                  setQuickReply("Discarded pending canvas changes.");
                }}
                className="rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Discard
              </button>
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => void sendQuick()}
          disabled={!draft.trim() || sending || !pipelineId}
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40"
          aria-label="Send to Genie"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mb-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse Genie chat" : "Expand Genie chat"}
        >
          <ChevronUp className={clsx("h-4 w-4 transition", expanded ? "rotate-180" : "")} aria-hidden />
        </button>
      </div>
      {expanded ? (
        <div className="border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-800">
          <AiPipelineAssistant
            inline
            canvasMode
            pipelineId={pipelineId}
            canvasNodeContext={canvasNode ?? undefined}
            getCanvasSnapshot={getCanvasSnapshot}
            onPatchNode={onPatchNode}
            onReplaceGraph={onReplaceGraph}
            onPipelinePatched={onPipelinePatched}
          />
        </div>
      ) : null}
    </div>
  );
}
