"use client";

import { useCallback, useEffect, useState } from "react";
import { Layers, Loader2 } from "lucide-react";

type Deployment = {
  id: string;
  slug: string;
  label: string;
  isDefault: boolean;
};

type Props = {
  value: string;
  onChange: (slug: string) => void;
  className?: string;
};

export function DeploymentSelector({ value, onChange, className }: Props) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/elt/deployments", { credentials: "same-origin" });
      if (res.ok) {
        const data = (await res.json()) as { deployments?: Deployment[] };
        setDeployments(data.deployments ?? []);
        if (!value && data.deployments?.length) {
          const def = data.deployments.find((d) => d.isDefault) ?? data.deployments[0];
          if (def) onChange(def.slug);
        }
      }
    } finally {
      setLoading(false);
    }
  }, [onChange, value]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <span className={`inline-flex items-center gap-1 text-xs text-slate-500 ${className ?? ""}`}>
        <Loader2 className="h-3 w-3 animate-spin" /> Deployment…
      </span>
    );
  }

  if (!deployments.length) return null;

  return (
    <label className={`inline-flex items-center gap-1.5 text-xs ${className ?? ""}`}>
      <Layers className="h-3.5 w-3.5 text-slate-500" aria-hidden />
      <span className="text-slate-500">Deployment</span>
      <select
        value={value || deployments.find((d) => d.isDefault)?.slug || deployments[0]?.slug}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 bg-white px-2 py-0.5 text-xs font-medium text-slate-800 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
      >
        {deployments.map((d) => (
          <option key={d.id} value={d.slug}>
            {d.label}
          </option>
        ))}
      </select>
    </label>
  );
}
