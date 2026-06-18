import { z } from "zod";
import type { WorkspaceAssetKind } from "@/lib/elt/pipeline-assets";
import type { MedallionLayer } from "@/lib/elt/declarative-pipeline-spec";

export const MEDALLION_LAYER_LABELS: Record<MedallionLayer, string> = {
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
};

export const MEDALLION_LAYER_COLORS: Record<MedallionLayer, string> = {
  bronze: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/30 dark:text-amber-200 dark:border-amber-900/50",
  silver: "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700",
  gold: "bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-950/30 dark:text-yellow-200 dark:border-yellow-900/50",
};

/** Infer medallion layer for a workspace asset from kind + persisted pipeline hints. */
export function inferMedallionLayer(
  kind: WorkspaceAssetKind,
  hints: { landing: MedallionLayer; transform: MedallionLayer }
): MedallionLayer | undefined {
  if (kind === "raw" || kind === "object") return hints.landing;
  if (kind === "transform" || kind === "post_transform") return hints.transform;
  return undefined;
}
