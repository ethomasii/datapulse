"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, ChevronUp, Loader2, Send } from "lucide-react";
import clsx from "clsx";
import { AiPipelineAssistant } from "@/components/elt/ai-pipeline-assistant";

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
};

/** Lakeflow Genie-style NL bar — inline prompt tied to the selected canvas step. */
export function GenieCanvasBar({ pipelineId, onPipelinePatched, selectedLabel, canvasNode }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [quickReply, setQuickReply] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const placeholder = selectedLabel
    ? `Edit ${selectedLabel}… (e.g. rename race_name with INITCAP, drop nulls on date)`
    : "Describe transforms in plain language…";

  const sendQuick = useCallback(async () => {
    const text = draft.trim();
    if (!text || !pipelineId || sending) return;
    setSending(true);
    setQuickReply(null);
    try {
      const res = await fetch("/api/elt/ai-assistant", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          canvasNodeContext: canvasNode ?? undefined,
          messages: [{ role: "user", content: text }],
        }),
      });
      const data = (await res.json()) as { message?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Genie request failed");
      setQuickReply(data.message ?? "Done.");
      setDraft("");
      onPipelinePatched?.();
    } catch (e) {
      setQuickReply(e instanceof Error ? e.message : "Genie request failed");
    } finally {
      setSending(false);
    }
  }, [canvasNode, draft, onPipelinePatched, pipelineId, sending]);

  useEffect(() => {
    if (!expanded) return;
    textareaRef.current?.focus();
  }, [expanded, selectedLabel]);

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
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
            <p className="mt-1 line-clamp-2 text-[11px] text-slate-600 dark:text-slate-400">{quickReply}</p>
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
            onPipelinePatched={onPipelinePatched}
          />
        </div>
      ) : null}
    </div>
  );
}
