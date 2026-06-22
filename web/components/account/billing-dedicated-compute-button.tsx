"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { BillingInterval } from "@/lib/billing/plan-pricing";

export function BillingDedicatedComputeButton({
  label,
  className = "",
  interval = "monthly",
}: {
  label: string;
  className?: string;
  interval?: BillingInterval;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/dedicated-compute/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Checkout unavailable");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void checkout()}
        disabled={loading}
        className={className}
      >
        {loading ? <Loader2 className="inline h-4 w-4 animate-spin" /> : label}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
