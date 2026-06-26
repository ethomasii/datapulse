/**
 * NL / API-driven canvas graph edits — connect steps, add transforms, wire components.
 */
import type { Edge, Node } from "@xyflow/react";
import { getComponentById } from "@/lib/elt/component-registry";
import { routeComponent } from "@/lib/elt/component-compile-router";
import { canvasPortsForCategory, normalizeComponentCategory } from "@/lib/elt/component-canvas-io";
import {
  extractComponentsFromCanvas,
  filterCanvasEdges,
  isValidPipelineCanvasEdge,
} from "@/lib/elt/canvas-component-sync";
import { getCanvasFromSourceConfig, type PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";
import {
  applyCanvasComponentsToSourceConfig,
  relayoutPipelineCanvas,
} from "@/lib/elt/ai-pipeline-canvas-build";
import {
  findCanvasAppendTarget,
  positionAfterUpstream,
  type CanvasAppendNodeSpec,
} from "@/lib/elt/canvas-node-placement";
import { wireInputFromUpstreamEdge } from "@/lib/elt/canvas-wire-input";

export type CanvasGraphEditAction =
  | {
      op: "connect";
      source: string;
      target: string;
    }
  | {
      op: "disconnect";
      source: string;
      target: string;
    }
  | {
      op: "add_component";
      component_id: string;
      label?: string;
      config?: Record<string, unknown>;
      after?: string;
    }
  | {
      op: "replace_component";
      /** Node id, label, or component id to swap out. */
      node: string;
      component_id: string;
      label?: string;
      config?: Record<string, unknown>;
    }
  | {
      op: "add_transform";
      tool: "dbt" | "python" | "sql" | "other";
      label?: string;
      after?: string;
      package_path?: string;
      selector?: string;
      code?: string;
    }
  | {
      op: "update_node_config";
      /** Node id or label — prefer exact node id from Genie context. */
      node: string;
      config: Record<string, unknown>;
      /** When true (default), shallow-merge into existing config. */
      merge?: boolean;
    };

function nodeLabel(node: Node): string {
  const d = node.data as Record<string, unknown>;
  return String(d.label ?? d.componentId ?? node.type ?? node.id).trim();
}

function findNodeByRef(nodes: Node[], ref: string): Node | null {
  const r = ref.trim().toLowerCase();
  if (!r) return null;
  const aliases: Record<string, string> = {
    source: "sourcenode",
    extract: "sourcenode",
    dest: "destnode",
    destination: "destnode",
    load: "destnode",
    warehouse: "destnode",
  };
  const want = aliases[r] ?? r;
  return (
    nodes.find((n) => n.id.toLowerCase() === want) ||
    nodes.find((n) => nodeLabel(n).toLowerCase() === want) ||
    nodes.find((n) => String((n.data as { componentId?: string })?.componentId ?? "").toLowerCase() === want) ||
    nodes.find((n) => n.type?.toLowerCase() === want) ||
    null
  );
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    animated: true,
    style: { strokeWidth: 2, stroke: "#64748b", strokeDasharray: "6 4" },
  };
}

function addTransformNode(
  nodes: Node[],
  tool: CanvasGraphEditAction & { op: "add_transform" },
  position: { x: number; y: number }
): Node {
  const id = `n-tr-${nodes.length + 1}`;
  return {
    id,
    type: "transformNode",
    position,
    data: {
      label: tool.label ?? `${tool.tool} transform`,
      transformTool: tool.tool,
      dbtPackagePath: tool.package_path ?? "",
      dbtSelector: tool.selector ?? "",
      postTransformCode: tool.code ?? "",
    },
  };
}

export function applyCanvasGraphEdits(
  sourceConfiguration: Record<string, unknown>,
  actions: CanvasGraphEditAction[],
  meta: { sourceType: string; destinationType: string; pipelineName?: string; transformOnly?: boolean }
): {
  sourceConfiguration: Record<string, unknown>;
  canvas: PipelineCanvasGraph;
  messages: string[];
  errors: string[];
} {
  const messages: string[] = [];
  const errors: string[] = [];
  const existing = getCanvasFromSourceConfig(sourceConfiguration);
  let nodes = [...((existing?.nodes as Node[]) ?? [])];
  let edges = [...((existing?.edges as Edge[]) ?? [])];

  if (!nodes.length) {
    const applied = applyCanvasComponentsToSourceConfig(sourceConfiguration, {
      sourceType: meta.sourceType,
      destinationType: meta.destinationType,
      components: [],
    });
    nodes = applied.canvas.nodes as Node[];
    edges = applied.canvas.edges as Edge[];
  }

  for (const action of actions) {
    if (action.op === "connect") {
      const src = findNodeByRef(nodes, action.source);
      const tgt = findNodeByRef(nodes, action.target);
      if (!src || !tgt) {
        errors.push(`connect: could not resolve "${action.source}" → "${action.target}"`);
        continue;
      }
      if (!isValidPipelineCanvasEdge(src, tgt)) {
        errors.push(`connect: invalid edge ${nodeLabel(src)} → ${nodeLabel(tgt)}`);
        continue;
      }
      const e = makeEdge(src.id, tgt.id);
      if (!edges.some((x) => x.source === e.source && x.target === e.target)) {
        edges.push(e);
        messages.push(`Connected ${nodeLabel(src)} → ${nodeLabel(tgt)}`);
      }
    } else if (action.op === "disconnect") {
      const src = findNodeByRef(nodes, action.source);
      const tgt = findNodeByRef(nodes, action.target);
      if (!src || !tgt) {
        errors.push(`disconnect: could not resolve nodes`);
        continue;
      }
      const before = edges.length;
      edges = edges.filter((e) => !(e.source === src.id && e.target === tgt.id));
      if (edges.length < before) messages.push(`Disconnected ${nodeLabel(src)} → ${nodeLabel(tgt)}`);
    } else if (action.op === "add_component") {
      const catalog = getComponentById(action.component_id);
      if (!catalog) {
        errors.push(`add_component: unknown ${action.component_id}`);
        continue;
      }
      const route = routeComponent(catalog.id, catalog.category);
      const appendSpec: CanvasAppendNodeSpec = {
        type: "componentNode",
        data: { compileHint: route.hint },
      };
      const placementOpts = { transformOnly: meta.transformOnly, append: appendSpec };
      const afterRef = action.after?.trim();
      const afterNode = afterRef ? findNodeByRef(nodes, afterRef) : null;
      let wireFrom: Node | null = afterNode;
      let position: { x: number; y: number };
      if (afterNode) {
        position = positionAfterUpstream(nodes, afterNode, appendSpec);
      } else {
        const anchor = findCanvasAppendTarget(nodes, edges, placementOpts);
        position = anchor.position;
        wireFrom = anchor.upstreamId ? (nodes.find((n) => n.id === anchor.upstreamId) ?? null) : null;
      }

      const id = `n-comp-${nodes.length + 1}`;
      const node: Node = {
        id,
        type: "componentNode",
        position,
        data: {
          componentId: catalog.id,
          label: action.label ?? catalog.name,
          category: catalog.category,
          compileTarget: route.target,
          compileBadge: route.badge ?? route.target,
          compileHint: route.hint,
          canvasPorts: canvasPortsForCategory(normalizeComponentCategory(catalog.category)),
          config: { ...(action.config ?? {}), template_id: catalog.id },
        },
      };
      nodes.push(node);

      if (afterNode && isValidPipelineCanvasEdge(afterNode, node)) {
        const outgoing = edges.filter((e) => e.source === afterNode.id);
        if (outgoing.length === 1) {
          const nextNode = nodes.find((n) => n.id === outgoing[0]!.target);
          if (nextNode && isValidPipelineCanvasEdge(node, nextNode)) {
            edges = edges.filter(
              (e) => !(e.source === afterNode.id && e.target === nextNode.id)
            );
            edges.push(makeEdge(afterNode.id, node.id), makeEdge(node.id, nextNode.id));
          } else {
            edges.push(makeEdge(afterNode.id, node.id));
          }
        } else {
          edges.push(makeEdge(afterNode.id, node.id));
        }
      } else if (wireFrom && isValidPipelineCanvasEdge(wireFrom, node)) {
        edges.push(makeEdge(wireFrom.id, node.id));
      }
      messages.push(`Added component ${catalog.name}`);
    } else if (action.op === "add_transform") {
      const appendSpec: CanvasAppendNodeSpec = {
        type: "transformNode",
        data: { transformTool: action.tool },
      };
      const placementOpts = { transformOnly: meta.transformOnly, append: appendSpec };
      const afterRef = action.after?.trim();
      const afterNode = afterRef ? findNodeByRef(nodes, afterRef) : null;
      let wireFrom: Node | null = afterNode;
      let position: { x: number; y: number };
      if (afterNode) {
        position = positionAfterUpstream(nodes, afterNode, appendSpec);
      } else {
        const anchor = findCanvasAppendTarget(nodes, edges, placementOpts);
        position = anchor.position;
        wireFrom = anchor.upstreamId ? (nodes.find((n) => n.id === anchor.upstreamId) ?? null) : null;
      }

      const node = addTransformNode(nodes, action, position);
      nodes.push(node);
      if (wireFrom && isValidPipelineCanvasEdge(wireFrom, node)) {
        edges.push(makeEdge(wireFrom.id, node.id));
      }
      messages.push(`Added ${action.tool} transform`);
    } else if (action.op === "replace_component") {
      const target = findNodeByRef(nodes, action.node);
      if (!target || target.type !== "componentNode") {
        errors.push(`replace_component: could not resolve component node "${action.node}"`);
        continue;
      }
      const catalog = getComponentById(action.component_id);
      if (!catalog) {
        errors.push(`replace_component: unknown ${action.component_id}`);
        continue;
      }
      const route = routeComponent(catalog.id, catalog.category);
      const prevLabel = nodeLabel(target);
      const prevConfig = ((target.data as Record<string, unknown>).config ?? {}) as Record<string, unknown>;
      nodes = nodes.map((n) => {
        if (n.id !== target.id) return n;
        return {
          ...n,
          data: {
            componentId: catalog.id,
            label: action.label ?? catalog.name,
            category: catalog.category,
            compileTarget: route.target,
            compileBadge: route.badge ?? route.target,
            compileHint: route.hint,
            canvasPorts: canvasPortsForCategory(normalizeComponentCategory(catalog.category)),
            config: { ...prevConfig, ...(action.config ?? {}), template_id: catalog.id },
          },
        };
      });
      const wired = wireInputFromUpstreamEdge(nodes, edges, target.id);
      if (wired) {
        nodes = nodes.map((n) =>
          n.id === wired.nodeId ? { ...n, data: { ...n.data, config: wired.configPatch } } : n
        );
      }
      messages.push(`Replaced ${prevLabel} with ${catalog.name} (${catalog.id})`);
    } else if (action.op === "update_node_config") {
      const target = findNodeByRef(nodes, action.node);
      if (!target) {
        errors.push(`update_node_config: could not resolve node "${action.node}"`);
        continue;
      }
      const data = target.data as Record<string, unknown>;
      const prev = (data.config as Record<string, unknown> | undefined) ?? {};
      const nextConfig = action.merge === false ? { ...action.config } : { ...prev, ...action.config };
      nodes = nodes.map((n) =>
        n.id === target.id ? { ...n, data: { ...data, config: nextConfig } } : n
      );
      messages.push(`Updated config on ${nodeLabel(target)}`);
    }
  }

  edges = filterCanvasEdges(nodes, edges);
  nodes = relayoutPipelineCanvas(nodes, edges);
  const canvas: PipelineCanvasGraph = { nodes, edges, v: 1 };
  const next: Record<string, unknown> = { ...sourceConfiguration, canvas };
  const extracted = extractComponentsFromCanvas(nodes, edges, { pipelineName: meta.pipelineName });
  if (extracted.components.length) next.elt_components = extracted.components;

  return { sourceConfiguration: next, canvas, messages, errors };
}

export function graphEditActionsFromNlHints(text: string): CanvasGraphEditAction[] {
  const lower = text.toLowerCase();
  const actions: CanvasGraphEditAction[] = [];
  if (lower.includes("dbt") && (lower.includes("add") || lower.includes("after"))) {
    actions.push({ op: "add_transform", tool: "dbt", label: "dbt models", after: "dest" });
  }
  if (lower.includes("connect") && lower.includes("filter") && lower.includes("join")) {
    actions.push({ op: "connect", source: "join", target: "filter" });
  }
  return actions;
}
