"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowRight, CircleHelp, Loader2, Package, Pencil, Plus, Shield, Trash2, X } from "lucide-react";
import { assetDetailHref } from "@/lib/elt/asset-path";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";
import { CatalogAssetPicker } from "@/components/catalog/catalog-asset-picker";
import { FieldLabel, PageHelpBox } from "@/components/ui/field-help";
import { CATALOG_FIELD_HELP } from "@/lib/catalog/field-help-copy";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";

type Product = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  ownerName?: string | null;
  domain?: string | null;
  consumerTags: string[];
  featured: boolean;
  items: { assetKey: string }[];
  contract?: { id: string; slug: string; name: string; status: string } | null;
  contractId?: string | null;
};

type ContractOption = { id: string; slug: string; name: string };

const emptyForm = {
  slug: "",
  name: "",
  description: "",
  ownerName: "",
  domain: "",
  consumerTags: "",
  contractId: "",
  featured: false,
  assetKeys: [] as string[],
};

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

export function CatalogProductsClient() {
  const { permissions } = useWorkspacePermissions();
  const canEdit = permissions?.canEditCatalog ?? false;
  const [products, setProducts] = useState<Product[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSlug, setEditingSlug] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, contractRes] = await Promise.all([
        fetch("/api/elt/catalog/collections"),
        fetch("/api/elt/catalog/contracts"),
      ]);
      if (prodRes.ok) {
        const body = (await prodRes.json()) as { products?: Product[]; collections?: Product[] };
        setProducts(body.products ?? body.collections ?? []);
      }
      if (contractRes.ok) {
        const body = (await contractRes.json()) as { contracts: ContractOption[] };
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

  const openEdit = (p: Product) => {
    setEditingSlug(p.slug);
    setForm({
      slug: p.slug,
      name: p.name,
      description: p.description ?? "",
      ownerName: p.ownerName ?? "",
      domain: p.domain ?? "",
      consumerTags: (p.consumerTags ?? []).join(", "),
      contractId: p.contract?.id ?? p.contractId ?? "",
      featured: p.featured,
      assetKeys: p.items.map((i) => i.assetKey),
    });
    setError(null);
    setEditorOpen(true);
  };

  const save = async () => {
    const slug = form.slug.trim() || slugify(form.name);
    if (!slug || !form.name.trim()) {
      setError("Name and URL identifier are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/catalog/collections", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name: form.name.trim(),
          description: form.description.trim() || null,
          ownerName: form.ownerName.trim() || null,
          domain: form.domain.trim() || null,
          consumerTags: form.consumerTags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          contractId: form.contractId.trim() || null,
          featured: form.featured,
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
    if (!confirm(`Delete data product "${slug}"?`)) return;
    const res = await fetch(`/api/elt/catalog/collections?slug=${encodeURIComponent(slug)}`, {
      method: "DELETE",
    });
    if (res.ok) await load();
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Package className="h-6 w-6" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide">Data products</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Curated data products</h1>
          <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
            Data products are governed bundles of catalog assets with owners, domains, intended consumers, and an optional{" "}
            <Link href="/catalog/contracts" className="text-sky-600 hover:underline dark:text-sky-400">
              data contract
            </Link>{" "}
            defining schema and freshness SLAs. Think of a product as a curated “menu item” for data consumers — not a
            single table, but a named package of related assets.
          </p>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" aria-hidden />
            New product
          </button>
        ) : null}
      </div>

      <CatalogAccessBanner />

      <PageHelpBox title="Quick guide: data products">
        <ul className="list-inside list-disc space-y-1.5">
          <li>
            <strong className="font-medium text-slate-700 dark:text-slate-200">Name</strong> — what consumers see in
            the Library.
          </li>
          <li>
            <strong className="font-medium text-slate-700 dark:text-slate-200">URL identifier</strong> — a short
            machine-friendly ID (slug) like <code className="rounded bg-slate-200/80 px-1 font-mono text-xs dark:bg-slate-800">monthly-revenue</code>
            ; auto-generated from the name.
          </li>
          <li>
            <strong className="font-medium text-slate-700 dark:text-slate-200">Assets</strong> — the tables or models
            included in the bundle.
          </li>
          <li>
            <strong className="font-medium text-slate-700 dark:text-slate-200">Data contract</strong> (optional) —
            schema and freshness guarantees for everything in the product.
          </li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          Click the <CircleHelp className="inline h-3 w-3 align-text-bottom" aria-hidden /> icon next to any field in
          the editor for more detail.
        </p>
      </PageHelpBox>

      {editorOpen ? (
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900 dark:bg-sky-950/20">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-white">
              {editingSlug ? "Edit data product" : "New data product"}
            </h2>
            <button type="button" onClick={() => setEditorOpen(false)} className="text-slate-500 hover:text-slate-800">
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <FieldLabel label="Name" help={CATALOG_FIELD_HELP.productName} />
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
              <FieldLabel label="URL identifier" help={CATALOG_FIELD_HELP.productSlug} />
              <input
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                disabled={Boolean(editingSlug)}
                placeholder="e.g. monthly-revenue"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              />
              {!editingSlug && form.slug ? (
                <p className="mt-1 text-xs text-slate-500">Auto-generated from name — you can edit before saving.</p>
              ) : null}
            </label>
            <label className="block text-sm sm:col-span-2">
              <FieldLabel label="Description" help={CATALOG_FIELD_HELP.productDescription} />
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <FieldLabel label="Owner" help={CATALOG_FIELD_HELP.productOwner} />
              <input
                value={form.ownerName}
                onChange={(e) => setForm((f) => ({ ...f, ownerName: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <FieldLabel label="Domain" help={CATALOG_FIELD_HELP.productDomain} />
              <input
                value={form.domain}
                onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                placeholder="e.g. finance, marketing"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm sm:col-span-2">
              <FieldLabel label="Consumer tags" help={CATALOG_FIELD_HELP.productConsumerTags} />
              <input
                value={form.consumerTags}
                onChange={(e) => setForm((f) => ({ ...f, consumerTags: e.target.value }))}
                placeholder="analytics, ml, finance"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <FieldLabel label="Data contract" help={CATALOG_FIELD_HELP.productContract} />
              <select
                value={form.contractId}
                onChange={(e) => setForm((f) => ({ ...f, contractId: e.target.value }))}
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              >
                <option value="">None</option>
                {contracts.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2 self-end text-sm">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => setForm((f) => ({ ...f, featured: e.target.checked }))}
              />
              <FieldLabel label="Featured on Library hub" help={CATALOG_FIELD_HELP.productFeatured} />
            </label>
            <div className="sm:col-span-2">
              <FieldLabel label="Assets in this product" help={CATALOG_FIELD_HELP.productAssets} />
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
              {saving ? "Saving…" : "Save product"}
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
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No data products yet.
          {canEdit ? " Click “New product” to create your first curated bundle." : " Ask a catalog editor to create one."}
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {products.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold text-slate-900 dark:text-white">{p.name}</h2>
                <div className="flex items-center gap-1">
                  {p.featured ? (
                    <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                      Featured
                    </span>
                  ) : null}
                  {canEdit ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openEdit(p)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-sky-600 dark:hover:bg-slate-800"
                        aria-label="Edit product"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => void remove(p.slug)}
                        className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 dark:hover:bg-slate-800"
                        aria-label="Delete product"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              {p.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{p.description}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {p.domain ? `${p.domain} · ` : ""}
                {p.ownerName ? `Owner: ${p.ownerName} · ` : ""}
                {p.items.length} assets
              </p>
              {p.contract ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-sky-600 dark:text-sky-400">
                  <Shield className="h-3 w-3" aria-hidden /> Contract: {p.contract.name} ({p.contract.status})
                </p>
              ) : null}
              {p.consumerTags?.length ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(p.consumerTags as string[]).map((t) => (
                    <span key={t} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] dark:bg-slate-800">
                      {t}
                    </span>
                  ))}
                </div>
              ) : null}
              <ul className="mt-3 space-y-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                {p.items.slice(0, 5).map((item) => (
                  <li key={item.assetKey}>
                    <Link href={assetDetailHref(item.assetKey)} className="text-sm text-sky-600 hover:underline dark:text-sky-400">
                      {item.assetKey.split(":").pop() ?? item.assetKey}
                      <ArrowRight className="ml-1 inline h-3 w-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
