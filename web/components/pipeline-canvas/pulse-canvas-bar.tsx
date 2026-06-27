"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import type { Edge, Node } from "@xyflow/react";
import { Bot, ChevronUp, Loader2, Lock, Send } from "lucide-react";
import clsx from "clsx";
import { AiPipelineAssistant } from "@/components/elt/ai-pipeline-assistant";
import type { PatchPipelinePayload } from "@/app/api/elt/ai-assistant/route";
import { PULSE_AI_NAME, PULSE_AI_SHORT } from "@/lib/brand/pulse-ai";
import { usePlanFeatures } from "@/lib/hooks/use-plan-features";
import { PulseAiFeatureTeaser } from "@/components/billing/pulse-ai-feature-teaser";
import { PlanGatePill } from "@/components/account/plan-gate-pill";

export type CanvasPulseNodeContext = {
  nodeId: string;
  componentId?: string;
  label?: string;
  config?: Record<string, unknown>;
};

export type PulseCanvasBarHandle = {
  openAssistant: (opts: { node: CanvasPulseNodeContext; draft?: string; expand?: boolean }) => void;
};

type Props = {
  pipelineId?: string;
  onPipelinePatched?: () => void;
  selectedLabel?: string;
  canvasNode?: CanvasPulseNodeContext | null;
  getCanvasSnapshot?: () => { nodes: Node[]; edges: Edge[] } | null;
  onPatchNode?: (nodeId: string, patch: Record<string, unknown>) => void;
  onReplaceGraph?: (nodes: Node[], edges: Edge[]) => void;
  deploymentSelector?: ReactNode;
};

/** Inline NL prompt bar on the canvas — tied to the selected step. */
export const PulseCanvasBar = forwardRef<PulseCanvasBarHandle, Props>(function PulseCanvasBar(
  {
    pipelineId,
    onPipelinePatched,
    selectedLabel,
    canvasNode,
    getCanvasSnapshot,
    onPatchNode,
    onReplaceGraph,
    deploymentSelector,
  },
  ref
) {
  const { features, loading: planLoading } = usePlanFeatures();
  const aiAllowed = features.aiAssistant ?? false;
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
  const [assistantNodeOverride, setAssistantNodeOverride] = useState<CanvasPulseNodeContext | null>(null);

  const effectiveCanvasNode = assistantNodeOverride ?? canvasNode ?? null;
  const effectiveLabel = effectiveCanvasNode?.label ?? selectedLabel;

  useImperativeHandle(ref, () => ({
    openAssistant: ({ node, draft, expand = true }) => {
      setAssistantNodeOverride(node);
      if (draft) setDraft(draft);
      if (expand) setExpanded(true);
      setQuickReply(null);
      setPendingPatch(null);
      queueMicrotask(() => textareaRef.current?.focus());
    },
  }));

  useEffect(() => {
    if (!canvasNode?.nodeId) return;
    setAssistantNodeOverride(null);
  }, [canvasNode?.nodeId]);

  const placeholder = effectiveLabel
    ? `Ask ${PULSE_AI_SHORT} to add or edit after ${effectiveLabel}…`
    : `Ask ${PULSE_AI_SHORT} to add a step… (e.g. filter, dedupe, aggregate by day)`;

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
    if (!text || !pipelineId || sending || !aiAllowed) return;
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
          canvasNodeContext: effectiveCanvasNode ?? undefined,
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
      if (!res.ok) throw new Error(data.error ?? `${PULSE_AI_NAME} request failed`);

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
        if (data.patchPayload.canvas && onReplaceGraph) {
          onReplaceGraph(
            data.patchPayload.canvas.nodes as Node[],
            data.patchPayload.canvas.edges as Edge[]
          );
        }
        setPendingPatch({ pipelineId: data.patchPipelineId, patch: data.patchPayload });
        setQuickReply(
          (data.message ?? `${PULSE_AI_NAME} prepared canvas changes.`) +
            " Review and apply — nothing is saved until you confirm."
        );
        setDraft("");
        return;
      }

      setQuickReply(data.message ?? "Done.");
      setDraft("");
    } catch (e) {
      setQuickReply(e instanceof Error ? e.message : `${PULSE_AI_NAME} request failed`);
    } finally {
      setSending(false);
    }
  }, [aiAllowed, effectiveCanvasNode, draft, getCanvasSnapshot, onPatchNode, onReplaceGraph, pipelineId, sending]);

  useEffect(() => {
    if (!expanded) return;
    textareaRef.current?.focus();
  }, [expanded, effectiveLabel]);

  return (
    <div className="relative z-30 shrink-0 isolate border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-end gap-2 px-3 py-2">
        {deploymentSelector ? <div className="mb-2 shrink-0">{deploymentSelector}</div> : null}
        <Bot className={clsx("mb-2 h-4 w-4 shrink-0", aiAllowed ? "text-teal-600" : "text-slate-400")} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-medium text-slate-600 dark:text-slate-400">{PULSE_AI_NAME}</span>
            {!aiAllowed && !planLoading ? <PlanGatePill minTier="team" /> : null}
          </div>
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
            placeholder={
              aiAllowed
                ? placeholder
                : `Upgrade to Team to ask ${PULSE_AI_SHORT} — e.g. filter active rows, dedupe by id…`
            }
            disabled={!aiAllowed && !planLoading}
            className={clsx(
              "w-full resize-none bg-transparent text-sm placeholder-slate-400 outline-none dark:text-slate-100",
              aiAllowed ? "text-slate-800" : "cursor-not-allowed text-slate-500"
            )}
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
          disabled={!draft.trim() || sending || !pipelineId || (!aiAllowed && !planLoading)}
          className="mb-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40"
          aria-label={aiAllowed ? `Send to ${PULSE_AI_NAME}` : `${PULSE_AI_NAME} requires Team plan`}
        >
          {!aiAllowed && !planLoading ? (
            <Lock className="h-4 w-4" />
          ) : sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </button>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mb-0.5 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
          aria-expanded={expanded}
          aria-label={expanded ? `Collapse ${PULSE_AI_NAME} chat` : `Expand ${PULSE_AI_NAME} chat`}
        >
          <ChevronUp className={clsx("h-4 w-4 transition", expanded ? "rotate-180" : "")} aria-hidden />
        </button>
      </div>
      {!aiAllowed && !planLoading && !expanded ? (
        <p className="px-3 pb-2 text-[11px] text-slate-500 dark:text-slate-400">
          Describe pipeline changes in plain English —{" "}
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            see what {PULSE_AI_SHORT} can do
          </button>
        </p>
      ) : null}
      {expanded ? (
        <div className="border-t border-slate-200 px-3 pb-3 pt-2 dark:border-slate-800">
          {!aiAllowed && !planLoading ? (
            <PulseAiFeatureTeaser variant="compact" />
          ) : (
            <AiPipelineAssistant
              inline
              canvasMode
              pipelineId={pipelineId}
              canvasNodeContext={effectiveCanvasNode ?? undefined}
              getCanvasSnapshot={getCanvasSnapshot}
              onPatchNode={onPatchNode}
              onReplaceGraph={onReplaceGraph}
              onPipelinePatched={onPipelinePatched}
            />
          )}
        </div>
      ) : null}
    </div>
  );
});
