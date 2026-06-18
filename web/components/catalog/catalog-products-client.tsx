"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Loader2, Package, Shield } from "lucide-react";
import { assetDetailHref } from "@/lib/elt/asset-path";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";

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
  contract?: { slug: string; name: string; status: string } | null;
};

export function CatalogProductsClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/elt/catalog/collections");
        if (res.ok) {
          const body = (await res.json()) as { products?: Product[]; collections?: Product[] };
          setProducts(body.products ?? body.collections ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Package className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Data products</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Curated data products</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Data products are governed bundles of catalog assets — like DataHub data products. Each product can have an
          owner, domain, intended consumers, and an optional{" "}
          <Link href="/catalog/contracts" className="text-sky-600 hover:underline dark:text-sky-400">
            data contract
          </Link>{" "}
          defining schema and freshness SLAs.
        </p>
      </div>

      <CatalogAccessBanner />

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading products…
        </p>
      ) : products.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No data products yet. Catalog editors can create them via{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PUT /api/elt/catalog/collections</code>.
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
                {p.featured ? (
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-800 dark:bg-violet-950/50 dark:text-violet-200">
                    Featured
                  </span>
                ) : null}
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
