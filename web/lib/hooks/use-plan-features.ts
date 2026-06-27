"use client";

import { useEffect, useState } from "react";
import type { PlanTier } from "@prisma/client";

type PlanFeaturesPayload = {
  tier: PlanTier;
  features: {
    aiAssistant?: boolean;
    webhookTriggers?: boolean;
    runsApi?: boolean;
    orgInvites?: boolean;
    orgGateways?: boolean;
    gitArtifactExport?: boolean;
    columnLineage?: boolean;
  };
};

export function usePlanFeatures() {
  const [data, setData] = useState<PlanFeaturesPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/billing/usage", { credentials: "same-origin" });
        if (!res.ok) return;
        const json = (await res.json()) as PlanFeaturesPayload;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { ...data, loading, tier: data?.tier ?? ("free" as PlanTier), features: data?.features ?? {} };
}
