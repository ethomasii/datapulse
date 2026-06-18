"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Shield, Trash2, X } from "lucide-react";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";
import { CatalogAssetPicker } from "@/components/catalog/catalog-asset-picker";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";

type SchemaColumn = {
  name: string;
  type: string;
  required: boolean;
  description: string;
};

type Contract = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  ownerName?: string | null;
  ownerEmail?: string | null;
  freshnessSlaHours?: number | null;
  schemaSpec?: SchemaColumn[];
  assets: { assetKey: string }[];
};

const emptyColumn = (): SchemaColumn => ({ name: "", type: "", required: false, description: "" });

const emptyForm = {
  slug: "",
  name: "",
  description: "",
  ownerName: "",
  ownerEmail: "",
  status: "draft" as "draft" | "active" | "deprecated",
  freshnessSlaHours: "",
  schemaSpec: [emptyColumn()] as SchemaColumn[],
  assetKeys: [] as string[],
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function CatalogContractsClient() {
  const { permissions } = useWorkspacePermissions();
  const canEdit = permissions?.canEditCatalog ?? false;
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/elt/catalog/contracts");
      if (res.ok) {
        const body = (await res.json()) as { contracts: Contract[] };
        setContracts(body.contracts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setEditingSlug(null);
    setForm(emptyForm);
    setError(null);
    setEditorOpen(true);
  };

  const openEdit = (c: Contract) => {
    setEditingSlug(c.slug);
    const spec = (c.schemaSpec ?? []) as SchemaColumn[];
    setForm({
      slug: c.slug,
      name: c.name,
      description: c.description ?? "",
      ownerName: c.ownerName ?? "",
      ownerEmail: c.ownerEmail ?? "",
      status: (c.status as "draft" | "active" | "deprecated") ?? "draft",
      freshnessSlaHours: c.freshnessSlaHours ? String(c.freshnessSlaHours) : "",
      schemaSpec: spec.length ? spec : [emptyColumn()],
      assetKeys: c.assets.map((a) => a.assetKey),
    });
    setError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    const slug = form.slug.trim() || slugify(form.name);
    if (!slug || !form.name.trim()) {
      setError("Name and slug are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const schemaSpec = form.schemaSpec
        .filter((c) => c.name.trim())
        .map((c) => ({
          name: c.name.trim(),
          ...(c.type.trim() ? { type: c.type.trim() } : {}),
          ...(c.required ? { required: true } : {}),
          ...(c.description.trim() ? { description: c.description.trim() } : {}),
        }));

      const res = await fetch("/api/elt/catalog/contracts", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: form.name.trim(),
          description: form.description.trim() || null,
          ownerName: form.ownerName.trim() || null,
          ownerEmail: form.ownerEmail.trim() || null,
          status: form.status,
          freshnessSlaHours: form.freshnessSlaHours.trim() ? Number(form.freshnessSlaHours) : null,
          schemaSpec,
          assetKeys: form.assetKeys,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }
      setEditorOpen(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (slug: string) => {
    if (!confirm(`Delete contract "${slug}"?`)) return;
    const res = await fetch(`/api/elt/catalog/contracts?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  };

  const updateColumn = (index: number, patch: Partial<SchemaColumn>) => {
    setForm((f) => ({
      ...f,
      schemaSpec: f.schemaSpec.map((col, i) => (i === index ? { ...col, ...patch } : col)),
    }));
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Shield className="h-6 w-6" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide">Governance</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Data contracts</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Data contracts document what consumers can expect: required columns, freshness SLAs, and ownership. Assets
            linked to a contract show compliance on their detail page. Products can reference a contract for a full
            bundle guarantee. Violations trigger alerts after pipeline runs.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New contract
          </button>
        ) : null}
      </div>

      <CatalogAccessBanner />

      {editorOpen ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {editingSlug ? "Edit data contract" : "New data contract"}
            </h2>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-slate-500 hover:text-slate-800">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Name</span>
              <input
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value,
                    slug: editingSlug ? f.slug : slugify(e.target.value),
                  }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Slug</span>
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                disabled={Boolean(editingSlug)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <span className="font-medium text-slate-700 dark:text-slate-300">Description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Owner</span>
              <input
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Owner email</span>
              <input
                type="email"
                value={form.ownerEmail}
                onChange={(e) => setForm((f) => ({ ...f, ownerEmail: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Status</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as "draft" | "active" | "deprecated" }))
                }
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="deprecated">Deprecated</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Freshness SLA (hours)</span>
              <input
                type="number"
                min={1}
                value={form.freshnessSlaHours}
                onChange={(e) => setForm((f) => ({ ...f, freshnessSlaHours: e.target.value }))}
                placeholder="e.g. 24"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <div className="sm:col-span-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Schema spec</span>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, schemaSpec: [...f.schemaSpec, emptyColumn()] }))}
                  className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                >
                  + Add column
                </button>
              </div>
              <ul className="mt-2 space-y-2">
                {form.schemaSpec.map((col, i) => (
                  <li key={i} className="grid gap-2 rounded-lg border border-slate-200 p-3 sm:grid-cols-12 dark:border-slate-700">
                    <input
                      placeholder="Column name"
                      value={col.name}
                      onChange={(e) => updateColumn(i, { name: e.target.value })}
                      className="sm:col-span-3 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                    <input
                      placeholder="Type"
                      value={col.type}
                      onChange={(e) => updateColumn(i, { type: e.target.value })}
                      className="sm:col-span-2 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                    <label className="flex items-center gap-1 text-xs sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={col.required}
                        onChange={(e) => updateColumn(i, { required: e.target.checked })}
                      />
                      Required
                    </label>
                    <input
                      placeholder="Description"
                      value={col.description}
                      onChange={(e) => updateColumn(i, { description: e.target.value })}
                      className="sm:col-span-4 rounded border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          schemaSpec: f.schemaSpec.length > 1 ? f.schemaSpec.filter((_, j) => j !== i) : [emptyColumn()],
                        }))
                      }
                      className="text-slate-400 hover:text-red-600 sm:col-span-1"
                      aria-label="Remove column"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="sm:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Linked assets</span>
              <div className="mt-2">
                <CatalogAssetPicker
                  selected={form.assetKeys}
                  onChange={(keys) => setForm((f) => ({ ...f, assetKeys: keys }))}
                />
              </div>
            </div>
          </div>
          {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save contract"}
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contracts…
        </p>
      ) : contracts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No contracts yet.
          {canEdit ? " Click “New contract” to define schema and freshness expectations." : null}
        </p>
      ) : (
        <ul className="space-y-4">
          {contracts.map((c) => (
            <li key={c.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-white">{c.name}</h2>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium capitalize dark:bg-slate-800">
                  {c.status}
                </span>
                {canEdit ? (
                  <>
                    <button
                      type="button"
                      onClick={() => openEdit(c)}
                      className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                      aria-label="Edit contract"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => void remove(c.slug)}
                      className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                      aria-label="Delete contract"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                ) : null}
              </div>
              {c.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{c.description}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {c.ownerName ? `Owner: ${c.ownerName} · ` : ""}
                {c.freshnessSlaHours ? `Freshness SLA: ${c.freshnessSlaHours}h · ` : ""}
                {c.assets.length} linked assets
                {(c.schemaSpec?.length ?? 0) > 0 ? ` · ${c.schemaSpec!.length} schema columns` : ""}
              </p>
              <p className="mt-2 text-xs">
                <Link href="/catalog/products" className="text-sky-600 hover:underline dark:text-sky-400">
                  View data products
                </Link>
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
