"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageSquare, Send, Trash2 } from "lucide-react";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";

type Comment = {
  id: string;
  body: string;
  authorName: string | null;
  authorEmail: string | null;
  createdAt: string;
  replies?: Comment[];
};

export function AssetConversationPanel({ assetKey, assetLabel }: { assetKey: string; assetLabel?: string }) {
  const { permissions } = useWorkspacePermissions();
  const canWrite = permissions?.canEditCatalog ?? true;
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const [posting, setPosting] = useState(false);
  const [slackEnabled, setSlackEnabled] = useState(false);
  const [slackTwoWay, setSlackTwoWay] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/elt/catalog/conversations?assetKey=${encodeURIComponent(assetKey)}`);
      if (res.ok) {
        const data = (await res.json()) as { comments: Comment[]; slackEnabled?: boolean; slackTwoWay?: boolean };
        setComments(data.comments ?? []);
        setSlackEnabled(Boolean(data.slackEnabled));
        setSlackTwoWay(Boolean(data.slackTwoWay));
      }
    } finally {
      setLoading(false);
    }
  }, [assetKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const post = async () => {
    const text = body.trim();
    if (!text) return;
    setPosting(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/catalog/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetKey, body: text }),
      });
      if (!res.ok) throw new Error("Failed to post");
      setBody("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to post");
    } finally {
      setPosting(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/elt/catalog/conversations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    if (res.ok) await load();
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Discussion</h2>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Ask questions, leave notes for consumers, or flag data quality issues on{" "}
        {assetLabel ?? "this asset"}.
        {slackEnabled
          ? slackTwoWay
            ? " New threads post to Slack and replies sync both ways."
            : " New threads also post to Slack."
          : null}
      </p>

      {loading ? (
        <p className="mt-4 flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </p>
      ) : (
        <ul className="mt-4 max-h-64 space-y-3 overflow-y-auto">
          {comments.length === 0 ? (
            <li className="text-sm text-slate-500">No discussion yet — start the conversation.</li>
          ) : (
            comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {c.authorName ?? "User"}
                    <span className="ml-2 font-normal text-slate-400">
                      {new Date(c.createdAt).toLocaleString()}
                    </span>
                  </p>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => void remove(c.id)}
                      className="text-slate-400 hover:text-red-600"
                      aria-label="Delete comment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-slate-800 dark:text-slate-200">{c.body}</p>
              </li>
            ))
          )}
        </ul>
      )}

      <div className="mt-4 flex gap-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Who owns this metric? Is id still the primary key?"
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          onClick={() => void post()}
          disabled={posting || !body.trim()}
          className="inline-flex h-fit items-center gap-1 rounded-lg bg-sky-600 px-3 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Post
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </section>
  );
}
