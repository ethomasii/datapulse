"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Bot, ExternalLink, Layers, Loader2, Plug, Plus, RefreshCw, Trash2, Sparkles } from "lucide-react";
import { AppPage, AppPageHeader } from "@/components/layout/app-page";
import { CredentialFieldHelp } from "@/components/elt/credential-field-help";
import { RelatedLinks } from "@/components/ui/related-links";
import {
  KNOWN_MCP_CATEGORY_LABELS,
  KNOWN_MCP_SERVER_TEMPLATES,
  templateToCreatePayload,
  type KnownMcpServerCategory,
  type KnownMcpServerTemplate,
} from "@/lib/elt/mcp-server/known-catalog";
import type { McpServerPublic, McpTransport } from "@/lib/elt/mcp-server/types";

type FormState = {
  name: string;
  description: string;
  transport: McpTransport;
  url: string;
  command: string;
};

const emptyForm: FormState = {
  name: "",
  description: "",
  transport: "http",
  url: "",
  command: "",
};

async function apiFetch(path: string, init?: RequestInit) {
  return fetch(path, { ...init, credentials: "same-origin" });
}

function formFromTemplate(template: KnownMcpServerTemplate): FormState {
  const cmd = template.config.command?.join(" ") ?? "";
  return {
    name: template.name,
    description: template.description,
    transport: template.transport,
    url: template.config.url ?? "",
    command: cmd,
  };
}

export default function McpServersPage() {
  const [servers, setServers] = useState<McpServerPublic[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [secretValues, setSecretValues] = useState<Record<string, string>>({});
  const [catalogFilter, setCatalogFilter] = useState<KnownMcpServerCategory | "all">("all");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedTemplate = useMemo(
    () => KNOWN_MCP_SERVER_TEMPLATES.find((t) => t.id === selectedTemplateId) ?? null,
    [selectedTemplateId]
  );

  const catalogByCategory = useMemo(() => {
    const items =
      catalogFilter === "all"
        ? KNOWN_MCP_SERVER_TEMPLATES
        : KNOWN_MCP_SERVER_TEMPLATES.filter((t) => t.category === catalogFilter);
    const groups = new Map<KnownMcpServerCategory, KnownMcpServerTemplate[]>();
    for (const t of items) {
      const list = groups.get(t.category) ?? [];
      list.push(t);
      groups.set(t.category, list);
    }
    return groups;
  }, [catalogFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/api/elt/mcp-servers");
      const data = (await res.json()) as { servers?: McpServerPublic[]; _migrationPending?: boolean };
      if (data._migrationPending) {
        setError("Run database migration for McpServer table (prisma migrate deploy).");
        setServers([]);
        return;
      }
      if (!res.ok) throw new Error("Failed to load MCP servers");
      setServers(data.servers ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function applyTemplate(template: KnownMcpServerTemplate) {
    setSelectedTemplateId(template.id);
    setForm(formFromTemplate(template));
    setSecretValues({});
    setError(null);
    document.getElementById("mcp-add-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  async function createServer(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      let body: Record<string, unknown>;

      if (selectedTemplate) {
        body = templateToCreatePayload(selectedTemplate, secretValues);
        body.name = form.name.trim() || body.name;
        body.description = form.description.trim() || body.description;
        if (selectedTemplate.transport === "stdio") {
          body.config = {
            ...selectedTemplate.config,
            command: form.command.split(/\s+/).filter(Boolean),
          };
        } else {
          body.config = { ...selectedTemplate.config, url: form.url.trim() };
        }
      } else {
        const config =
          form.transport === "stdio"
            ? { command: form.command.split(/\s+/).filter(Boolean) }
            : { url: form.url.trim() };
        body = {
          name: form.name.trim(),
          description: form.description.trim() || null,
          transport: form.transport,
          config,
        };
      }

      const res = await apiFetch("/api/elt/mcp-servers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        throw new Error(data.error ?? "Create failed");
      }
      setForm(emptyForm);
      setSelectedTemplateId(null);
      setSecretValues({});
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function refreshTools(id: string) {
    setBusy(true);
    try {
      const res = await apiFetch(`/api/elt/mcp-servers/${id}`, { method: "POST" });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Discovery failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this MCP server?")) return;
    await apiFetch(`/api/elt/mcp-servers/${id}`, { method: "DELETE" });
    await load();
  }

  return (
    <AppPage>
      <AppPageHeader
        title="MCP servers"
        description="Register Model Context Protocol servers for Genie and pipeline components (mcp_tool_call, litellm_agent, …)."
      />

      <RelatedLinks
        links={[
          { href: "/connections", icon: Plug, label: "Connections", desc: "Warehouse and source credentials" },
          { href: "/builder", icon: Layers, label: "Pipeline builder", desc: "Add MCP/AI native components on canvas" },
        ]}
      />

      {error ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </p>
      ) : null}

      <section className="mb-8">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <Sparkles className="h-4 w-4 text-violet-500" aria-hidden />
              Known integrations
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Curated MCP servers — Stripe, GitHub, Postgres, and more. Pick one to pre-fill registration.
            </p>
          </div>
          <label className="text-xs text-slate-500">
            Filter
            <select
              value={catalogFilter}
              onChange={(e) => setCatalogFilter(e.target.value as KnownMcpServerCategory | "all")}
              className="ml-2 rounded border border-slate-200 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="all">All</option>
              {(Object.keys(KNOWN_MCP_CATEGORY_LABELS) as KnownMcpServerCategory[]).map((c) => (
                <option key={c} value={c}>
                  {KNOWN_MCP_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-4">
          {Array.from(catalogByCategory.entries()).map(([category, templates]) => (
            <div key={category}>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                {KNOWN_MCP_CATEGORY_LABELS[category]}
              </p>
              <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {templates.map((t) => (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className={`flex h-full w-full flex-col rounded-lg border p-3 text-left transition-colors ${
                        selectedTemplateId === t.id
                          ? "border-violet-400 bg-violet-50 dark:border-violet-600 dark:bg-violet-950/30"
                          : "border-slate-200 bg-white hover:border-violet-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-violet-700"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">{t.name}</span>
                        <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[9px] uppercase text-slate-500 dark:bg-slate-800">
                          {t.transport}
                        </span>
                      </span>
                      <span className="mt-0.5 text-[10px] text-slate-400">{t.vendor}</span>
                      <span className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{t.description}</span>
                      <span className="mt-2 inline-flex items-center gap-1 text-[10px] text-violet-600 dark:text-violet-300">
                        Use template
                        <ExternalLink className="h-3 w-3 opacity-60" aria-hidden />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <form
        id="mcp-add-form"
        onSubmit={createServer}
        className="mb-8 rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
      >
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
          <Plus className="h-4 w-4" aria-hidden />
          {selectedTemplate ? `Add ${selectedTemplate.name}` : "Add MCP server"}
        </h2>

        {selectedTemplate ? (
          <p className="mb-3 text-xs text-slate-500">
            From catalog:{" "}
            <a
              href={selectedTemplate.docsUrl}
              target="_blank"
              rel="noreferrer"
              className="text-violet-600 hover:underline dark:text-violet-300"
            >
              {selectedTemplate.vendor} docs
            </a>
            {selectedTemplate.runtimeNote ? ` · ${selectedTemplate.runtimeNote}` : null}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs">
            <span className="text-slate-500">Name</span>
            <input
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              placeholder="stripe-prod"
            />
          </label>
          <label className="block text-xs">
            <span className="text-slate-500">Transport</span>
            <select
              value={form.transport}
              onChange={(e) => setForm((f) => ({ ...f, transport: e.target.value as McpTransport }))}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
              disabled={Boolean(selectedTemplate)}
            >
              <option value="http">HTTP</option>
              <option value="sse">SSE</option>
              <option value="stdio">stdio (worker/gateway only)</option>
            </select>
          </label>
          {form.transport === "stdio" ? (
            <label className="block text-xs sm:col-span-2">
              <span className="text-slate-500">Command</span>
              <input
                required
                value={form.command}
                onChange={(e) => setForm((f) => ({ ...f, command: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="npx -y @modelcontextprotocol/server-filesystem /data"
              />
            </label>
          ) : (
            <label className="block text-xs sm:col-span-2">
              <span className="text-slate-500">URL</span>
              <input
                required
                value={form.url}
                onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder="https://mcp.stripe.com"
              />
            </label>
          )}
          <label className="block text-xs sm:col-span-2">
            <span className="text-slate-500">Description (optional)</span>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </label>

          {selectedTemplate?.envVars?.map((ev) => (
            <label key={ev.name} className="block text-xs sm:col-span-2">
              <span className="text-slate-500">
                {ev.label}
                {ev.required ? " *" : ""}
              </span>
              <input
                type={ev.secret === false ? "text" : "password"}
                autoComplete="off"
                required={ev.required}
                value={secretValues[ev.name] ?? ""}
                onChange={(e) => setSecretValues((s) => ({ ...s, [ev.name]: e.target.value }))}
                className="mt-1 w-full rounded border border-slate-200 px-2 py-1.5 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
                placeholder={ev.bearerPrefix ? "sk_test_… (Bearer added automatically)" : ev.name}
              />
              <CredentialFieldHelp help={ev.description} helpUrl={ev.helpUrl} />
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-violet-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Save server
          </button>
          {selectedTemplate ? (
            <button
              type="button"
              onClick={() => {
                setSelectedTemplateId(null);
                setForm(emptyForm);
                setSecretValues({});
              }}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
            >
              Clear template
            </button>
          ) : null}
        </div>
      </form>

      {loading ? (
        <div className="flex justify-center py-12 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
        </div>
      ) : servers.length === 0 ? (
        <p className="text-sm text-slate-500">
          No MCP servers yet. Pick a known integration above or register a custom server, then use{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">mcp_server_id</code> in{" "}
          <Link href="/builder" className="text-violet-600 hover:underline dark:text-violet-300">
            pipeline components
          </Link>{" "}
          or ask Genie to wire an agent family flow (
          <a
            href="https://dagster-component-ui.vercel.app/examples/agent_family"
            className="text-violet-600 hover:underline dark:text-violet-300"
            target="_blank"
            rel="noreferrer"
          >
            agent family demo
          </a>
          ).
        </p>
      ) : (
        <ul className="space-y-3">
          {servers.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-medium text-slate-900 dark:text-white">
                    <Bot className="h-4 w-4 text-violet-500" aria-hidden />
                    {s.name}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                      {s.transport}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-slate-500">{s.id}</p>
                  {s.description ? <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{s.description}</p> : null}
                  <p className="mt-1 text-xs text-slate-500">
                    {s.toolsCache?.length ?? 0} cached tools
                    {s.toolsCachedAt ? ` · refreshed ${new Date(s.toolsCachedAt).toLocaleString()}` : ""}
                  </p>
                  {s.toolsCache?.length ? (
                    <p className="mt-1 line-clamp-2 text-[11px] text-slate-400">
                      {s.toolsCache.map((t) => t.name).join(", ")}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => void refreshTools(s.id)}
                    disabled={busy}
                    className="rounded p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                    title="Discover tools"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={() => void remove(s.id)}
                    className="rounded p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppPage>
  );
}
