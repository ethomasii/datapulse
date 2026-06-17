"use client";

import { useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

export function BillingPortalButton({ className = "" }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function openPortal() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Portal unavailable");
      }
      window.location.href = data.url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to open portal");
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => void openPortal()}
        disabled={loading}
        className={className}
      >
        {loading ? (
          <Loader2 className="inline h-4 w-4 animate-spin" />
        ) : (
          <>
            <ExternalLink className="mr-1.5 inline h-4 w-4" />
            Manage billing
          </>
        )}
      </button>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
