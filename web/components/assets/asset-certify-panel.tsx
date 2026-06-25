"use client";

import { useState } from "react";
import Link from "next/link";
import { BadgeCheck, Loader2 } from "lucide-react";

type Props = {
  assetKey: string;
  pipelineId: string;
  kind: string;
  displayName: string;
  certifiedAt: string | null;
  canEdit: boolean;
  onCertified: () => void;
};

export function AssetCertifyPanel({
  assetKey,
  pipelineId,
  kind,
  displayName,
  certifiedAt,
  canEdit,
  onCertified,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastContractSlug, setLastContractSlug] = useState<string | null>(null);

  const certify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/catalog/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assetKey,
          kind,
          pipelineId,
          displayName,
          certified: true,
          createContractFromSchema: true,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Certification failed");
      }
      const body = (await res.json()) as { contract?: { slug: string } | null };
      setLastContractSlug(body.contract?.slug ?? null);
      onCertified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Certification failed");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!confirm("Remove certification from this asset? The linked data contract is not deleted.")) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/catalog/entries", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assetKey, certified: false }),
      });
      if (!res.ok) throw new Error("Failed to revoke certification");
      onCertified();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to revoke");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-start gap-2">
        <BadgeCheck
          className={`mt-0.5 h-4 w-4 ${certifiedAt ? "text-emerald-600" : "text-slate-400"}`}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Certification</h2>
          {certifiedAt ? (
            <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
              Certified {new Date(certifiedAt).toLocaleDateString()}
            </p>
          ) : (
            <p className="mt-1 text-sm text-slate-500">
              Mark this asset as certified for consumers. Schema columns are promoted to an active data contract
              automatically.
            </p>
          )}
          {lastContractSlug ? (
            <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
              Data contract{" "}
              <Link href="/catalog/contracts" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                {lastContractSlug}
              </Link>{" "}
              created or updated from this asset&apos;s schema.
            </p>
          ) : null}
          {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          {canEdit ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {!certifiedAt ? (
                <button
                  type="button"
                  onClick={() => void certify()}
                  disabled={busy}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgeCheck className="h-4 w-4" />}
                  Certify asset
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void revoke()}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                >
                  Revoke certification
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
