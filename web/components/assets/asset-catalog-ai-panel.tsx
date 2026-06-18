"use client";

import { useCallback, useState } from "react";
import { Loader2, MessageCircle, Sparkles } from "lucide-react";

type ChatMessage = { role: "user" | "assistant"; content: string };

export function AssetCatalogAiPanel({
  assetKey,
  canEditCatalog,
  onDescriptionGenerated,
  variant = "asset",
}: {
  assetKey?: string;
  canEditCatalog: boolean;
  onDescriptionGenerated?: (description: string) => void;
  variant?: "asset" | "catalog";
}) {
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const generateDocs = useCallback(async () => {
    if (!assetKey) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/elt/catalog/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_description",
          assetKey,
          save: canEditCatalog,
        }),
      });
      const body = (await res.json()) as { description?: string; error?: string; saved?: boolean };
      if (!res.ok) throw new Error(body.error ?? "Generation failed");
      if (body.description) {
        setPreview(body.description);
        onDescriptionGenerated?.(body.description);
      }
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }, [assetKey, canEditCatalog, onDescriptionGenerated]);

  const ask = useCallback(async () => {
    const q = question.trim();
    if (!q) return;
    setAsking(true);
    setAskError(null);
    const userMsg: ChatMessage = { role: "user", content: q };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setQuestion("");
    try {
      const res = await fetch("/api/elt/catalog/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "ask",
          assetKey: assetKey || undefined,
          question: q,
          messages: messages.slice(-8),
          includeDataSample: true,
        }),
      });
      const body = (await res.json()) as { answer?: string; error?: string };
      if (!res.ok) throw new Error(body.error ?? "Question failed");
      if (body.answer) {
        setMessages([...nextMessages, { role: "assistant", content: body.answer }]);
      }
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Question failed");
      setMessages(messages);
    } finally {
      setAsking(false);
    }
  }, [assetKey, messages, question]);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" aria-hidden />
        <div className="min-w-0 flex-1 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
              {variant === "catalog" ? "Ask about your catalog" : "AI catalog assistant"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {variant === "catalog"
                ? "Ask questions across pipelines, assets, and dbt models in your workspace."
                : "Generate documentation or ask about metadata and live data samples (when warehouse is connected)."}
            </p>
          </div>

          {assetKey ? (
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => void generateDocs()}
                disabled={generating}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Generate documentation
              </button>
              {!canEditCatalog && (
                <p className="text-xs text-slate-500">Preview only — catalog editors can save to the asset.</p>
              )}
              {generateError ? <p className="text-xs text-red-600 dark:text-red-400">{generateError}</p> : null}
              {preview ? (
                <div className="rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2 text-sm text-slate-800 dark:border-violet-900 dark:bg-violet-950/30 dark:text-slate-200">
                  {preview}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3 border-t border-slate-100 pt-4 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <MessageCircle className="h-3.5 w-3.5" aria-hidden />
              Ask a question
            </div>
            {messages.length > 0 ? (
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {messages.map((m, i) => (
                  <li
                    key={`${m.role}-${i}`}
                    className={
                      m.role === "user"
                        ? "rounded-lg bg-sky-50 px-3 py-2 text-slate-800 dark:bg-sky-950/40 dark:text-slate-200"
                        : "rounded-lg bg-slate-50 px-3 py-2 text-slate-700 dark:bg-slate-800/60 dark:text-slate-300"
                    }
                  >
                    {m.content}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-2">
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void ask();
                  }
                }}
                placeholder={
                  assetKey
                    ? "What columns does this table have? Who owns this data?"
                    : "Which pipelines load Stripe data?"
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
              />
              <button
                type="button"
                onClick={() => void ask()}
                disabled={asking || !question.trim()}
                className="shrink-0 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:border-sky-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
              >
                {asking ? <Loader2 className="h-4 w-4 animate-spin" /> : "Ask"}
              </button>
            </div>
            {askError ? <p className="text-xs text-red-600 dark:text-red-400">{askError}</p> : null}
          </div>
        </div>
      </div>
    </section>
  );
}
