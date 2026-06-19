import Link from "next/link";
import { CheckCircle2, HelpCircle, XCircle } from "lucide-react";
import type { AssetFreshnessMeta } from "@/lib/elt/asset-freshness";
import type { MedallionLayer } from "@/lib/elt/declarative-pipeline-spec";
import { MEDALLION_LAYER_COLORS, MEDALLION_LAYER_LABELS } from "@/lib/elt/medallion-layer";
import type { WarehouseAssetStatus, WorkspaceAssetKind } from "@/lib/elt/pipeline-assets";
import { assetDetailHref } from "@/lib/elt/asset-path";

export const KIND_META: Record<WorkspaceAssetKind, { label: string; badge: string }> = {
  source: {
    label: "Source",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  },
  raw: {
    label: "Raw",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  transform: {
    label: "Transform output",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  },
  post_transform: {
    label: "Post-transform",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
  object: {
    label: "Object",
    badge: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-200",
  },
};

const WAREHOUSE_STATUS_META: Record<
  WarehouseAssetStatus,
  { label: string; badge: string; icon: React.ComponentType<{ className?: string }> }
> = {
  verified: {
    label: "In warehouse",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
    icon: CheckCircle2,
  },
  missing: {
    label: "Missing",
    badge: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-200",
    icon: XCircle,
  },
  unknown: {
    label: "Unknown",
    badge: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    icon: HelpCircle,
  },
  not_checked: {
    label: "Not checked",
    badge: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
    icon: HelpCircle,
  },
};

export function MedallionLayerBadge({ layer }: { layer: MedallionLayer }) {
  return (
    <span
      className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${MEDALLION_LAYER_COLORS[layer]}`}
    >
      {MEDALLION_LAYER_LABELS[layer]}
    </span>
  );
}

export function AssetKindBadge({ kind }: { kind: WorkspaceAssetKind }) {
  const meta = KIND_META[kind];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

export function WarehouseStatusBadge({
  status,
  runObserved,
}: {
  status?: WarehouseAssetStatus;
  runObserved?: boolean;
}) {
  if (!status && !runObserved) return null;
  if (runObserved && status !== "missing") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
        title="Observed on last dbt run"
      >
        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
        Last run
      </span>
    );
  }
  if (!status || status === "not_checked") return null;
  const meta = WAREHOUSE_STATUS_META[status];
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${meta.badge}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {meta.label}
    </span>
  );
}

export function AssetFreshnessBadge({ meta }: { meta?: AssetFreshnessMeta }) {
  if (!meta || meta.freshness === "never_run") return null;
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${meta.badgeClass}`} title={meta.detail}>
      {meta.label}
    </span>
  );
}

export function AssetCatalogPreview({
  description,
  tags,
}: {
  description?: string;
  tags?: string[];
}) {
  if (!description && !tags?.length) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">No catalog metadata</span>;
  }
  return (
    <div className="space-y-1">
      {description ? (
        <p className="line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{description}</p>
      ) : null}
      {tags?.length ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AssetNameLink({
  assetKey,
  displayName,
  className = "",
}: {
  assetKey: string;
  displayName: string;
  className?: string;
}) {
  return (
    <Link
      href={assetDetailHref(assetKey)}
      className={`font-medium text-sky-600 hover:underline dark:text-sky-400 ${className}`}
    >
      {displayName}
    </Link>
  );
}
