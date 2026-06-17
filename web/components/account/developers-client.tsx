"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  lastUsedAt: string | null;
  createdAt: string;
};

export function DevelopersClient() {
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [migrationPending, setMigrationPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/elt/api-keys", { credentials: "same-origin" });
      const data = (await res.json()) as { keys?: ApiKeyRow[]; _migrationPending?: boolean };
      setKeys(data.keys ?? []);
      setMigrationPending(!!data._migrationPending);
    } catch {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createKey() {
    setCreating(true);
    setError(null);
    setNewToken(null);
    try {
      const res = await fetch("/api/elt/api-keys", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "API key" }),
      });
      const data = (await res.json()) as { token?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Failed to create key");
      setNewToken(data.token ?? null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create key");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    await fetch(`/api/elt/api-keys/${id}`, { method: "DELETE", credentials: "same-origin" });
    await load();
  }

  async function copyToken() {
    if (!newToken) return;
    await navigator.clipboard.writeText(newToken);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Use Bearer tokens for automation — same endpoints as the browser session.
        </p>
        <button
          type="button"
          onClick={() => void createKey()}
          disabled={creating || migrationPending}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
        >
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Create key
        </button>
      </div>

      {migrationPending ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          Database migration pending — run <code className="text-xs">npx prisma migrate deploy</code> to enable API keys.
        </p>
      ) : null}

      {newToken ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <p className="text-sm font-medium text-emerald-900 dark:text-emerald-200">
            Copy your new API key — it won&apos;t be shown again.
          </p>
          <code className="mt-2 block break-all rounded bg-white/80 px-3 py-2 text-xs dark:bg-slate-950">
            {newToken}
          </code>
          <button
            type="button"
            onClick={() => void copyToken()}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
          >
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : keys.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
          No API keys yet. Create one to trigger runs from CI or scripts.
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {keys.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div>
                <p className="font-medium text-slate-900 dark:text-white">{k.name}</p>
                <p className="text-xs text-slate-500">
                  {k.keyPrefix}… · {k.scopes.join(", ")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void revoke(k.id)}
                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
              >
                <Trash2 className="h-3.5 w-3.5" /> Revoke
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Example: <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">curl -H &quot;Authorization: Bearer elt_…&quot; https://eltpulse.dev/api/elt/pipelines</code>
      </p>
    </div>
  );
}
