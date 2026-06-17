"use client";

import { useEffect, useState } from "react";
import type { DbtHubPackage } from "@/lib/elt/dbt-hub-packages";

type Props = {
  sourceSlug?: string;
  onSelect: (pkg: DbtHubPackage, suggestedPath: string) => void;
  className?: string;
};

export function DbtPackagePicker({ sourceSlug, onSelect, className = "" }: Props) {
  const [packages, setPackages] = useState<DbtHubPackage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const q = sourceSlug ? `?source=${encodeURIComponent(sourceSlug)}` : "";
        const res = await fetch(`/api/elt/dbt-packages${q}`);
        if (!res.ok) return;
        const data = (await res.json()) as
          | { packages: DbtHubPackage[] }
          | { available: boolean; package?: DbtHubPackage };
        if (cancelled) return;
        if ("packages" in data) setPackages(data.packages);
        else if (data.package) setPackages([data.package]);
        else setPackages([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sourceSlug]);

  if (loading) {
    return <p className={`text-xs text-slate-500 ${className}`}>Loading dlt-hub packages…</p>;
  }

  if (packages.length === 0) {
    return (
      <p className={`text-xs text-slate-500 ${className}`}>
        No hub package for this source — use a custom git URL or local path.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Recommended dlt-hub packages</p>
      <ul className="space-y-2">
        {packages.map((pkg) => (
          <li key={pkg.sourceKey}>
            <button
              type="button"
              onClick={() => onSelect(pkg, `./dbt/${pkg.sourceKey}`)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-sm transition hover:border-sky-300 hover:bg-sky-50/50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-800"
            >
              <span className="font-mono text-xs font-semibold text-sky-700 dark:text-sky-300">{pkg.package}</span>
              <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{pkg.description}</p>
              <p className="mt-1 font-mono text-[10px] text-slate-500">
                Models: {pkg.models.join(", ")}
              </p>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
