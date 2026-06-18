"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldAlert } from "lucide-react";
import type { ContractCompliance } from "@/lib/elt/data-contract";

type ContractSummary = {
  id: string;
  slug: string;
  name: string;
  status: string;
  freshnessSlaHours: number | null;
  ownerName: string | null;
};

export function AssetContractPanel({ assetKey }: { assetKey: string }) {
  const [loading, setLoading] = useState(true);
  const [contract, setContract] = useState<ContractSummary | null>(null);
  const [compliance, setCompliance] = useState<ContractCompliance | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/elt/catalog/contracts?assetKey=${encodeURIComponent(assetKey)}`);
        if (res.ok) {
          const data = (await res.json()) as { contract?: ContractSummary; compliance?: ContractCompliance };
          setContract(data.contract ?? null);
          setCompliance(data.compliance ?? null);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [assetKey]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Checking data contract…
      </p>
    );
  }

  if (!contract) return null;

  const ok = compliance?.ok ?? false;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        {ok ? (
          <ShieldCheck className="mt-0.5 h-4 w-4 text-emerald-600" aria-hidden />
        ) : (
          <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-600" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Data contract</h2>
          <p className="mt-0.5 font-medium text-slate-800 dark:text-slate-200">{contract.name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Status: {contract.status}
            {contract.ownerName ? ` · Owner: ${contract.ownerName}` : ""}
            {contract.freshnessSlaHours ? ` · SLA: ${contract.freshnessSlaHours}h freshness` : ""}
          </p>
          {compliance ? (
            <div className="mt-3">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                  ok
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                    : "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                }`}
              >
                {ok ? "Contract compliant" : "Contract issues"}
              </span>
              {compliance.issues.length ? (
                <ul className="mt-2 list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
                  {compliance.issues.map((issue) => (
                    <li key={issue}>{issue}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
