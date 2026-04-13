import type { Node } from "@xyflow/react";
import { isPipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

/** Transform node `data` keys (camelCase) edited in the canvas / inspector. */
export type DbtTransformNodeData = {
  transformTool?: string;
  dbtPackagePath?: string;
  dbtDatasetName?: string;
  dbtRepositoryBranch?: string;
  /** `all` = dlt `run_all()` default; `selection` = pass `--select` to the dbt run step. */
  dbtRunScope?: string;
  dbtSelector?: string;
};

function firstDbtTransformNode(nodes: Node[]): Node | undefined {
  return nodes.find(
    (n) => n.type === "transformNode" && String((n.data as DbtTransformNodeData | undefined)?.transformTool) === "dbt"
  );
}

/**
 * Build `source_configuration.dlt_dbt` from the first dbt transform on the canvas.
 * Returns `undefined` when there is no dbt transform node — caller should leave existing `dlt_dbt` unchanged.
 */
export function deriveDltDbtFromCanvasNodes(nodes: Node[]): Record<string, unknown> | undefined {
  const n = firstDbtTransformNode(nodes);
  if (!n) return undefined;

  const d = (n.data ?? {}) as DbtTransformNodeData;
  const packagePath = String(d.dbtPackagePath ?? "").trim();
  if (!packagePath) {
    return { enabled: false };
  }

  const datasetName = String(d.dbtDatasetName ?? "").trim();
  const branch = String(d.dbtRepositoryBranch ?? "").trim();
  const runScope = String(d.dbtRunScope ?? "all").trim() === "selection" ? "selection" : "all";
  const selector = String(d.dbtSelector ?? "").trim();

  const out: Record<string, unknown> = {
    enabled: true,
    package_path: packagePath,
    run_scope: runScope,
  };
  if (datasetName) out.dataset_name = datasetName;
  if (branch) out.package_repository_branch = branch;
  if (runScope === "selection" && selector) out.selector = selector;

  return out;
}

/**
 * When `canvas` is present on `base`, sync `dlt_dbt` from dbt transform node data.
 * - If the graph has transform nodes but none use dbt, removes `dlt_dbt`.
 * - If there are no transform nodes, leaves `dlt_dbt` unchanged (supports JSON-only config).
 */
export function syncDltDbtWithCanvas(base: Record<string, unknown>): void {
  const raw = base.canvas;
  if (!isPipelineCanvasGraph(raw)) return;
  const nodes = raw.nodes as Node[];
  const transforms = nodes.filter((n) => n.type === "transformNode");
  if (transforms.length === 0) return;

  const hasDbt = transforms.some(
    (n) => String((n.data as DbtTransformNodeData | undefined)?.transformTool) === "dbt"
  );
  if (!hasDbt) {
    delete base.dlt_dbt;
    return;
  }

  const derived = deriveDltDbtFromCanvasNodes(nodes);
  if (derived !== undefined) base.dlt_dbt = derived;
}

/** Hydrate transform node fields from persisted `dlt_dbt` when the node has not been edited yet. */
export function enrichTransformNodesFromDltDbt(nodes: Node[], dltDbt: Record<string, unknown> | null | undefined): Node[] {
  if (!dltDbt || typeof dltDbt !== "object") return nodes;
  const enabled = Boolean(dltDbt.enabled);
  const packagePath = String(dltDbt.package_path ?? "").trim();
  if (!enabled || !packagePath) return nodes;

  const datasetName = String(dltDbt.dataset_name ?? "").trim();
  const branch = String(dltDbt.package_repository_branch ?? "").trim();
  const runScope = dltDbt.run_scope === "selection" ? "selection" : "all";
  const selector = String(dltDbt.selector ?? "").trim();

  return nodes.map((n) => {
    if (n.type !== "transformNode") return n;
    const d = (n.data ?? {}) as DbtTransformNodeData;
    if (String(d.transformTool ?? "") !== "dbt") return n;
    if (String(d.dbtPackagePath ?? "").trim()) return n;

    return {
      ...n,
      data: {
        ...d,
        transformTool: "dbt",
        dbtPackagePath: packagePath,
        ...(datasetName ? { dbtDatasetName: datasetName } : {}),
        ...(branch ? { dbtRepositoryBranch: branch } : {}),
        dbtRunScope: runScope,
        ...(selector ? { dbtSelector: selector } : {}),
      },
    };
  });
}
