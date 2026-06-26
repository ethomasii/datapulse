/**
 * Canvas port rules from dagster-component-templates schema-spec.json.
 * Maps component category → left/right connection ports for the visual pipeline canvas.
 */

import type { Node } from "@xyflow/react";
import { getComponentById } from "@/lib/elt/component-registry";
import schemaSpec from "@/lib/elt/data/component-schema-spec.json";

export type ComponentCanvasPorts = {
  left: boolean;
  right: boolean;
  note?: string;
};

export type ComponentCategory =
  | "transformation"
  | "source"
  | "sink"
  | "ingestion"
  | "analytics"
  | "ai"
  | "infrastructure"
  | "dbt"
  | "sensor"
  | "external"
  | "observation"
  | "check"
  | "integration"
  | "resource";

const byCategory = (schemaSpec as { connectors?: { byCategory?: Record<string, ComponentCanvasPorts> } })
  .connectors?.byCategory ?? {};

/** Normalized category slug from manifest (may use singular/plural variants). */
export function normalizeComponentCategory(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "transformations" || s === "transform") return "transformation";
  if (s === "sources") return "source";
  if (s === "sinks") return "sink";
  if (s === "checks") return "check";
  if (s === "sensors") return "sensor";
  if (s === "observations") return "observation";
  return s;
}

export function canvasPortsForCategory(category: string): ComponentCanvasPorts {
  const key = normalizeComponentCategory(category);
  const ports = byCategory[key];
  if (ports) return ports;
  return { left: false, right: false, note: "Unknown category" };
}

/** Whether an edge from category A → category B is valid on the component canvas. */
export function isValidComponentEdge(sourceCategory: string, targetCategory: string): boolean {
  const src = canvasPortsForCategory(sourceCategory);
  const tgt = canvasPortsForCategory(targetCategory);
  return src.right && tgt.left;
}

export function isTerminalComponentCategory(category: string): boolean {
  const ports = canvasPortsForCategory(category);
  return ports.left && !ports.right;
}

/** Terminal validators (e.g. DQ checks) — assert on upstream data, no output port. */
export function isTerminalComponentData(data: Record<string, unknown>): boolean {
  const ports = data.canvasPorts as { left?: boolean; right?: boolean } | undefined;
  if (ports && ports.left && ports.right === false) return true;
  const category = String(data.category ?? "");
  if (category && isTerminalComponentCategory(category)) return true;
  const compileTarget = String(data.compileTarget ?? "");
  return compileTarget === "quality";
}

export function isTerminalComponentNode(node: Pick<Node, "type" | "data">): boolean {
  if (node.type !== "componentNode") return false;
  return isTerminalComponentData((node.data ?? {}) as Record<string, unknown>);
}

/** Fill missing canvasPorts/category from the component catalog (legacy saved graphs). */
export function enrichCanvasComponentNodeData(data: Record<string, unknown>): Record<string, unknown> {
  const componentId = String(data.componentId ?? "").trim();
  const catalog = componentId ? getComponentById(componentId) : null;
  const category = String(data.category ?? catalog?.category ?? "transformation");
  const ports = canvasPortsForCategory(category);
  const next = { ...data, category };
  if (!data.canvasPorts) {
    next.canvasPorts = { left: ports.left, right: ports.right };
  }
  return next;
}

export function enrichCanvasComponentNodes(nodes: Node[]): Node[] {
  return nodes.map((n) =>
    n.type === "componentNode"
      ? { ...n, data: enrichCanvasComponentNodeData((n.data ?? {}) as Record<string, unknown>) }
      : n
  );
}
