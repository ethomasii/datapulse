"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Loader2, Shield } from "lucide-react";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";

type Contract = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  status: string;
  ownerName?: string | null;
  freshnessSlaHours?: number | null;
  assets: { assetKey: string }[];
};

export function CatalogContractsClient() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/elt/catalog/contracts");
        if (res.ok) {
          const body = (await res.json()) as { contracts: Contract[] };
          setContracts(body.contracts ?? []);
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
          <Shield className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Governance</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Data contracts</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Data contracts document what consumers can expect: required columns, freshness SLAs, and ownership. Assets
          linked to a contract show compliance on their detail page. Products can reference a contract for a full
          bundle guarantee.
        </p>
      </div>

      <CatalogAccessBanner />

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contracts…
        </p>
      ) : contracts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500 dark:border-slate-700">
          No contracts yet. Create via{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">PUT /api/elt/catalog/contracts</code> or link
          assets from the API.
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
              </div>
              {c.description ? <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{c.description}</p> : null}
              <p className="mt-2 text-xs text-slate-500">
                {c.ownerName ? `Owner: ${c.ownerName} · ` : ""}
                {c.freshnessSlaHours ? `Freshness SLA: ${c.freshnessSlaHours}h · ` : ""}
                {c.assets.length} linked assets
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
