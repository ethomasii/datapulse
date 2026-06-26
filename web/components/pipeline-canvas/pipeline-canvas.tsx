"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
  type ReactNode,
} from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type IsValidConnection,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useTheme } from "next-themes";
import { Download, LayoutGrid, Loader2, Plus, RotateCcw, Save, Trash2, Unlink, Upload } from "lucide-react";
import { AddTransformMenu } from "./add-transform-menu";
import type { ComponentListItem } from "@/components/elt/component-palette";
import { CanvasBindingsProvider, type CanvasBindingsContextValue } from "./canvas-bindings-context";
import { validatePipelineCanvasGraph } from "@/lib/elt/validate-pipeline-canvas-graph";
import { isValidPipelineCanvasEdge } from "@/lib/elt/canvas-component-sync";
import { enrichCanvasComponentNodes } from "@/lib/elt/component-canvas-io";
import { findCanvasAppendTarget } from "@/lib/elt/canvas-node-placement";
import { autoLayoutPipelineCanvas } from "@/lib/elt/canvas-auto-layout";
import { findNearestEdge, insertNodeOnEdge } from "@/lib/elt/canvas-edge-insert";
import { wireInputFromUpstreamEdge } from "@/lib/elt/canvas-wire-input";
import { dashedAnimatedEdgeStyle, resolveCanvasEdges } from "./canvas-edge-defaults";
import { pipelineNodeTypes } from "./custom-nodes";

const STORAGE_KEY = "eltpulse-pipeline-canvas-v1";

/** Default graph: extract → load. Add a transform node from the toolbar when you need in-warehouse modeling. */
const demoNodes: Node[] = [
  {
    id: "n1",
    type: "sourceNode",
    position: { x: 40, y: 120 },
    data: { hint: "Prod API: billing + subscriptions" },
  },
  {
    id: "n2",
    type: "destNode",
    position: { x: 360, y: 120 },
    data: { hint: "Warehouse staging — analytics project" },
  },
];

const demoEdges: Edge[] = [
  { id: "e1", source: "n1", target: "n2", animated: true, style: { ...dashedAnimatedEdgeStyle } },
];

let idCounter = 100;

function loadSaved(): { nodes: Node[]; edges: Edge[] } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { nodes: Node[]; edges: Edge[] };
    if (!Array.isArray(parsed.nodes) || !parsed.nodes.length) return null;
    const edges = resolveCanvasEdges(parsed.nodes, parsed.edges);
    return { nodes: parsed.nodes, edges };
  } catch {
    return null;
  }
}

/** What the right-hand inspector should show — driven by the selected diagram node. */
export type CanvasInspectorFocus =
  | { kind: "none" }
  | { kind: "source"; nodeId: string }
  | { kind: "destination"; nodeId: string }
  | { kind: "transform"; nodeId: string; data: Record<string, unknown> }
  | { kind: "component"; nodeId: string; data: Record<string, unknown> };

export type PipelineCanvasControl = {
  patchNodeData: (nodeId: string, patch: Record<string, unknown>) => void;
  addComponentNode: (
    component: {
      id: string;
      name: string;
      category: string;
      compileTarget: string;
      compileBadge?: string;
      compileHint: string;
      canvasPorts: { left: boolean; right: boolean };
      icon?: string;
    },
    position?: { x: number; y: number }
  ) => void;
  addSourceNode: () => void;
  addDestinationNode: () => void;
  replaceGraph: (nodes: Node[], edges: Edge[]) => void;
  /** Current in-memory graph (may differ from last saved server state). */
  getGraph: () => { nodes: Node[]; edges: Edge[] };
};

import { ELTPULSE_COMPONENT_DRAG_MIME } from "@/lib/elt/canvas-drag";

export type PipelineCanvasProps = {
  /**
   * When set, the graph is tied to a stored pipeline (same `sourceConfiguration.canvas` as the form builder).
   * LocalStorage draft is disabled.
   */
  pipelineId?: string | null;
  /** Loaded from API; when null/undefined while pipelineId is set, demo layout is used until saved. */
  loadedGraph?: { nodes: Node[]; edges: Edge[] } | null;
  /** Bumps when server graph changes (avoids effect loops from unstable `loadedGraph` identity / xyflow setters). */
  graphRevision?: string;
  /** Persist graph to API (pipeline mode). */
  onSave?: (nodes: Node[], edges: Edge[]) => void | Promise<void>;
  saving?: boolean;
  saveError?: string | null;
  /** When true, hide pipeline save (read-only workspace role). */
  saveDisabled?: boolean;
  /** When pipeline is selected: catalog types for source/destination nodes (PATCH updates server). */
  pipelineSourceType?: string | null;
  pipelineDestinationType?: string | null;
  onPickSourceType?: (sourceType: string) => void | Promise<void>;
  onPickDestinationType?: (destinationType: string) => void | Promise<void>;
  bindingsBusy?: boolean;
  bindingsError?: string | null;
  /** Fires when the user selects or clears a node — drive a page-level inspector from the parent. */
  onInspectorFocusChange?: (focus: CanvasInspectorFocus) => void;
  /** Set by the canvas; use `patchNodeData` from the transform inspector (and similar). */
  canvasControlRef?: MutableRefObject<PipelineCanvasControl | null>;
  /** Fires when graph composition changes (for empty-state UI). */
  onGraphStatsChange?: (stats: { componentNodeCount: number; hasIngestBackbone: boolean }) => void;
  /** Overlay when graph has no transform components (e.g. recipe chips). */
  emptyStateOverlay?: ReactNode;
  showEmptyStateOverlay?: boolean;
  /** Lakeflow fullscreen designer — fill parent height, chrome at top, hide help blurb. */
  variant?: "default" | "designer";
  /** Warehouse-native pipeline — no extract source required. */
  transformOnly?: boolean;
};

function FlowCanvas({
  pipelineId,
  loadedGraph,
  graphRevision = "",
  onSave,
  saving,
  saveError,
  saveDisabled = false,
  pipelineSourceType,
  pipelineDestinationType,
  onPickSourceType,
  onPickDestinationType,
  bindingsBusy = false,
  bindingsError = null,
  onInspectorFocusChange,
  canvasControlRef,
  onGraphStatsChange,
  emptyStateOverlay,
  showEmptyStateOverlay = false,
  variant = "default",
  transformOnly = false,
}: PipelineCanvasProps) {
  const isDesigner = variant === "designer";
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const useLocalDraft = !pipelineId;

  const saved = useMemo(() => (typeof window !== "undefined" && useLocalDraft ? loadSaved() : null), [useLocalDraft]);

  const scratchInitial = useMemo(() => {
    if (saved?.nodes?.length && saved?.edges) {
      return { nodes: saved.nodes, edges: saved.edges };
    }
    return { nodes: demoNodes, edges: demoEdges };
  }, [saved]);

  const [nodes, setNodes, onNodesChange] = useNodesState(
    pipelineId ? demoNodes : scratchInitial.nodes
  );
  const [edges, setEdges, onEdgesChange] = useEdgesState(
    resolveCanvasEdges(
      pipelineId ? demoNodes : scratchInitial.nodes,
      pipelineId ? demoEdges : scratchInitial.edges
    )
  );
  const rfRef = useRef<ReactFlowInstance | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFlowNodes, setSelectedFlowNodes] = useState<Node[]>([]);
  const [selectedFlowEdges, setSelectedFlowEdges] = useState<Edge[]>([]);
  const [localValidationError, setLocalValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!pipelineId) return;
    const hasGraph = loadedGraph && Array.isArray(loadedGraph.nodes);
    const nextNodes = enrichCanvasComponentNodes(hasGraph ? loadedGraph.nodes : demoNodes);
    const nextEdges = hasGraph
      ? resolveCanvasEdges(nextNodes, loadedGraph.edges)
      : resolveCanvasEdges(demoNodes, demoEdges);
    setNodes(nextNodes);
    setEdges(nextEdges);
    const t = setTimeout(() => rfRef.current?.fitView({ padding: 0.2 }), 80);
    return () => clearTimeout(t);
    // graphRevision drives re-sync; omit loadedGraph/setters from deps to prevent load/fit loops with @xyflow/react.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadedGraph read from latest render when graphRevision changes
  }, [pipelineId, graphRevision]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || !useLocalDraft) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nodes, edges }));
  }, [nodes, edges, mounted, useLocalDraft]);

  useEffect(() => {
    setLocalValidationError(null);
  }, [nodes, edges, pipelineSourceType, pipelineDestinationType, pipelineId]);

  useEffect(() => {
    const componentNodeCount = nodes.filter((n) => n.type === "componentNode").length;
    const sourceCount = nodes.filter((n) => n.type === "sourceNode").length;
    const destCount = nodes.filter((n) => n.type === "destNode").length;
    const hasIngestBackbone = transformOnly ? destCount > 0 : sourceCount > 0 && destCount > 0;
    onGraphStatsChange?.({ componentNodeCount, hasIngestBackbone });
  }, [nodes, onGraphStatsChange, transformOnly]);

  const isValidConnection: IsValidConnection = useCallback(
    (edge) => {
      const { source, target } = edge;
      if (!source || !target) return false;
      const sourceNode = nodes.find((n) => n.id === source);
      const targetNode = nodes.find((n) => n.id === target);
      if (!sourceNode?.type || !targetNode?.type) return false;
      return isValidPipelineCanvasEdge(sourceNode, targetNode);
    },
    [nodes]
  );

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes(ELTPULSE_COMPONENT_DRAG_MIME)) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }
  }, []);

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) => {
        const nextEdges = addEdge(
          {
            ...params,
            animated: true,
            style: { ...dashedAnimatedEdgeStyle },
          },
          eds
        );
        if (params.target) {
          setNodes((nds) => {
            const wired = wireInputFromUpstreamEdge(nds, nextEdges, params.target!);
            if (!wired) return nds;
            return nds.map((n) =>
              n.id === wired.nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      config: wired.configPatch,
                    },
                  }
                : n
            );
          });
        }
        return nextEdges;
      });
    },
    [setEdges, setNodes]
  );

  const removeSelectedNodes = useCallback(() => {
    if (selectedFlowNodes.length === 0) return;
    const ids = new Set(selectedFlowNodes.map((n) => n.id));
    setNodes((nds) => nds.filter((n) => !ids.has(n.id)));
    setEdges((eds) => eds.filter((e) => !ids.has(e.source) && !ids.has(e.target)));
    setSelectedFlowNodes([]);
    setSelectedFlowEdges([]);
    onInspectorFocusChange?.({ kind: "none" });
  }, [selectedFlowNodes, setNodes, setEdges, onInspectorFocusChange]);

  const removeSelectedEdges = useCallback(() => {
    if (selectedFlowEdges.length === 0) return;
    const ids = new Set(selectedFlowEdges.map((e) => e.id));
    setEdges((eds) => eds.filter((e) => !ids.has(e.id)));
    setSelectedFlowEdges([]);
  }, [selectedFlowEdges, setEdges]);

  const fit = useCallback(() => {
    requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.22, duration: 220 }));
  }, []);

  const fitAfterGraphChange = useCallback(() => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => rfRef.current?.fitView({ padding: 0.22, duration: 220 }));
    });
  }, []);

  const autoLayout = useCallback(() => {
    setNodes((nds) => autoLayoutPipelineCanvas(nds, edges));
    fitAfterGraphChange();
  }, [edges, setNodes, fitAfterGraphChange]);

  const addNode = useCallback(
    (
      type: "sourceNode" | "transformNode" | "destNode" | "componentNode",
      data?: Record<string, unknown>,
      position?: { x: number; y: number }
    ) => {
      idCounter += 1;
      const id = `n-${idCounter}`;
      const labels: Record<string, Record<string, unknown>> = {
        sourceNode: { hint: "" },
        transformNode: {
          label: "New transform",
          hint: "dbt / SQL on loaded data",
          transformTool: "other",
        },
        destNode: { hint: "" },
        componentNode: { label: "Component", hint: "", ...data },
      };
      setNodes((nds) => [
        ...nds,
        {
          id,
          type,
          position: position ?? { x: 120 + nds.length * 24, y: 80 + nds.length * 18 },
          data: labels[type],
        },
      ]);
    },
    [setNodes]
  );

  const addComponentNode = useCallback(
    (
      component: {
        id: string;
        name: string;
        category: string;
        compileTarget: string;
        compileBadge?: string;
        compileHint: string;
        canvasPorts: { left: boolean; right: boolean };
        icon?: string;
      },
      position?: { x: number; y: number }
    ) => {
      idCounter += 1;
      const id = `n-${idCounter}`;
      const anchor = position
        ? { position, upstreamId: null as string | null }
        : findCanvasAppendTarget(nodes, edges, {
            transformOnly,
            append: {
              type: "componentNode",
              data: {
                compileHint: component.compileHint,
                category: component.category,
                compileTarget: component.compileTarget,
                canvasPorts: component.canvasPorts,
              },
            },
          });

      let newNode: Node = {
        id,
        type: "componentNode",
        position: anchor.position,
        data: {
          componentId: component.id,
          label: component.name,
          category: component.category,
          compileTarget: component.compileTarget,
          compileBadge: component.compileBadge ?? component.compileTarget,
          compileHint: component.compileHint,
          canvasPorts: component.canvasPorts,
          icon: component.icon,
          config: {},
        },
      };

      let nextEdges = edges;
      const upstream = anchor.upstreamId ? nodes.find((n) => n.id === anchor.upstreamId) : null;
      if (upstream && isValidPipelineCanvasEdge(upstream, newNode)) {
        nextEdges = addEdge(
          {
            id: `e-${upstream.id}-${id}`,
            source: upstream.id,
            target: id,
            animated: true,
            style: { ...dashedAnimatedEdgeStyle },
          },
          edges
        );
        const wired = wireInputFromUpstreamEdge([...nodes, newNode], nextEdges, id);
        if (wired) {
          newNode = {
            ...newNode,
            data: { ...newNode.data, config: wired.configPatch },
          };
        }
      }

      setNodes((nds) => [...nds, newNode]);
      if (nextEdges !== edges) setEdges(nextEdges);
      if (!position) fitAfterGraphChange();
    },
    [nodes, edges, transformOnly, setNodes, setEdges, fitAfterGraphChange]
  );

  const addCodeTransformNode = useCallback(
    (tool: "dbt" | "sql" | "python") => {
      const presets: Record<typeof tool, { label: string; hint: string }> = {
        dbt: { label: "dbt transform", hint: "Link a dbt project — models run after load" },
        sql: { label: "Warehouse SQL", hint: "CTAS / views against the destination after load" },
        python: { label: "Python transform", hint: "Legacy dataframe on the worker" },
      };
      const preset = presets[tool];
      idCounter += 1;
      const id = `n-${idCounter}`;
      const anchor = findCanvasAppendTarget(nodes, edges, {
        transformOnly,
        append: { type: "transformNode", data: { transformTool: tool } },
      });
      const newNode: Node = {
        id,
        type: "transformNode",
        position: anchor.position,
        data: {
          label: preset.label,
          hint: preset.hint,
          transformTool: tool,
        },
      };
      let nextEdges = edges;
      const upstream = anchor.upstreamId ? nodes.find((n) => n.id === anchor.upstreamId) : null;
      if (upstream && isValidPipelineCanvasEdge(upstream, newNode)) {
        nextEdges = addEdge(
          {
            id: `e-${upstream.id}-${id}`,
            source: upstream.id,
            target: id,
            animated: true,
            style: { ...dashedAnimatedEdgeStyle },
          },
          edges
        );
      }
      setNodes((nds) => [...nds, newNode]);
      if (nextEdges !== edges) setEdges(nextEdges);
      fitAfterGraphChange();
    },
    [nodes, edges, transformOnly, setNodes, setEdges, fitAfterGraphChange]
  );

  const addNativeTransformNode = useCallback(
    (component: ComponentListItem) => {
      addComponentNode(component);
    },
    [addComponentNode]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      const raw = e.dataTransfer.getData(ELTPULSE_COMPONENT_DRAG_MIME);
      if (!raw || !rfRef.current) return;
      e.preventDefault();
      try {
        const component = JSON.parse(raw) as Parameters<PipelineCanvasControl["addComponentNode"]>[0];
        const position = rfRef.current.screenToFlowPosition({ x: e.clientX, y: e.clientY });
        idCounter += 1;
        const id = `n-${idCounter}`;
        const newNode: Node = {
          id,
          type: "componentNode",
          position,
          data: {
            componentId: component.id,
            label: component.name,
            category: component.category,
            compileTarget: component.compileTarget,
            compileBadge: component.compileBadge ?? component.compileTarget,
            compileHint: component.compileHint,
            canvasPorts: component.canvasPorts,
            icon: component.icon,
            config: {},
          },
        };

        const edge = findNearestEdge(nodes, edges, position);
        if (edge) {
          const src = nodes.find((n) => n.id === edge.source);
          const tgt = nodes.find((n) => n.id === edge.target);
          if (
            src &&
            tgt &&
            isValidPipelineCanvasEdge(src, newNode) &&
            isValidPipelineCanvasEdge(newNode, tgt)
          ) {
            const result = insertNodeOnEdge(nodes, edges, edge, newNode);
            const wired = wireInputFromUpstreamEdge(result.nodes, result.edges, newNode.id);
            const finalNodes = wired
              ? result.nodes.map((n) =>
                  n.id === wired.nodeId
                    ? { ...n, data: { ...n.data, config: wired.configPatch } }
                    : n
                )
              : result.nodes;
            setNodes(finalNodes);
            setEdges(resolveCanvasEdges(finalNodes, result.edges));
            return;
          }
        }

        setNodes((nds) => [...nds, newNode]);
      } catch {
        /* ignore malformed drag payload */
      }
    },
    [nodes, edges, setNodes, setEdges]
  );

  const resetGraph = useCallback(() => {
    setNodes(demoNodes);
    setEdges(resolveCanvasEdges(demoNodes, demoEdges));
    setTimeout(fit, 60);
  }, [setNodes, setEdges, fit]);

  const persistValidationOptions = useMemo(
    () => ({
      requireConnectorTypes: Boolean(pipelineId),
      pipelineSourceType,
      pipelineDestinationType,
      transformOnly,
    }),
    [pipelineId, pipelineSourceType, pipelineDestinationType, transformOnly]
  );

  const exportJson = useCallback(() => {
    const { ok, errors } = validatePipelineCanvasGraph(nodes, edges, persistValidationOptions);
    if (!ok) {
      setLocalValidationError(errors.join(" "));
      return;
    }
    const blob = new Blob([JSON.stringify({ nodes, edges, exportedAt: new Date().toISOString() }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "eltpulse-pipeline-diagram.json";
    a.click();
    URL.revokeObjectURL(a.href);
  }, [nodes, edges, persistValidationOptions]);

  const onImportFile = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const parsed = JSON.parse(String(reader.result)) as { nodes: Node[]; edges: Edge[] };
          if (Array.isArray(parsed.nodes)) {
            setNodes(parsed.nodes);
            setEdges(resolveCanvasEdges(parsed.nodes, parsed.edges));
            setTimeout(fit, 60);
          }
        } catch {
          /* ignore */
        }
      };
      reader.readAsText(file);
      e.target.value = "";
    },
    [setNodes, setEdges, fit]
  );

  const handleSave = useCallback(() => {
    if (!onSave) return;
    const { ok, errors } = validatePipelineCanvasGraph(nodes, edges, persistValidationOptions);
    if (!ok) {
      setLocalValidationError(errors.join(" "));
      return;
    }
    void onSave(nodes, edges);
  }, [onSave, nodes, edges, persistValidationOptions]);

  const selectedNodeIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedNodeIdRef.current = selectedFlowNodes[0]?.id ?? null;
  }, [selectedFlowNodes]);

  const emitInspectorFocus = useCallback(
    (node: Node) => {
      if (!onInspectorFocusChange) return;
      if (node.type === "sourceNode") {
        onInspectorFocusChange({ kind: "source", nodeId: node.id });
        return;
      }
      if (node.type === "destNode") {
        onInspectorFocusChange({ kind: "destination", nodeId: node.id });
        return;
      }
      if (node.type === "transformNode") {
        onInspectorFocusChange({
          kind: "transform",
          nodeId: node.id,
          data: { ...(node.data as Record<string, unknown>) },
        });
        return;
      }
      if (node.type === "componentNode") {
        onInspectorFocusChange({
          kind: "component",
          nodeId: node.id,
          data: { ...(node.data as Record<string, unknown>) },
        });
      }
    },
    [onInspectorFocusChange]
  );

  useEffect(() => {
    if (!canvasControlRef) return;
    canvasControlRef.current = {
      patchNodeData: (nodeId: string, patch: Record<string, unknown>) => {
        setNodes((nds) => {
          const next = nds.map((n) =>
            n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n
          );
          if (selectedNodeIdRef.current === nodeId) {
            const updated = next.find((n) => n.id === nodeId);
            if (updated) queueMicrotask(() => emitInspectorFocus(updated));
          }
          return next;
        });
      },
      addComponentNode,
      addSourceNode: () => addNode("sourceNode"),
      addDestinationNode: () => addNode("destNode"),
      replaceGraph: (nextNodes: Node[], nextEdges: Edge[]) => {
        setNodes(nextNodes);
        setEdges(resolveCanvasEdges(nextNodes, nextEdges));
        setLocalValidationError(null);
        setTimeout(fit, 60);
      },
      getGraph: () => ({ nodes, edges }),
    };
    return () => {
      canvasControlRef.current = null;
    };
  }, [canvasControlRef, setNodes, setEdges, addComponentNode, addNode, fit, emitInspectorFocus, nodes, edges]);

  const onSelectionChange = useCallback(
    ({ nodes: selectedNodes, edges: selectedEdges }: { nodes: Node[]; edges: Edge[] }) => {
      setSelectedFlowNodes(selectedNodes);
      setSelectedFlowEdges(selectedEdges);
      if (!onInspectorFocusChange) return;
      const n = selectedNodes[0];
      if (!n?.type) {
        onInspectorFocusChange({ kind: "none" });
        return;
      }
      emitInspectorFocus(n);
    },
    [emitInspectorFocus, onInspectorFocusChange]
  );

  const colorMode = resolvedTheme === "dark" ? "dark" : "light";

  const bindingsContext = useMemo<CanvasBindingsContextValue | null>(() => {
    if (!pipelineId || !onPickSourceType || !onPickDestinationType) return null;
    return {
      pipelineId: pipelineId,
      pipelineSourceType: pipelineSourceType ?? "",
      pipelineDestinationType: pipelineDestinationType ?? "",
      onPickSourceType,
      onPickDestinationType,
      bindingsBusy,
    };
  }, [
    pipelineId,
    pipelineSourceType,
    pipelineDestinationType,
    onPickSourceType,
    onPickDestinationType,
    bindingsBusy,
  ]);

  if (!mounted) {
    return (
      <div
        className={
          isDesigner
            ? "h-full min-h-0 animate-pulse bg-slate-100 dark:bg-slate-800"
            : "h-full min-h-[420px] animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
        }
      />
    );
  }

  return (
    <CanvasBindingsProvider value={bindingsContext}>
    <div className={isDesigner ? "flex h-full min-h-0 flex-col" : "flex h-full min-h-[420px] flex-col"}>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2 dark:border-slate-700 dark:bg-slate-900/80">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Add</span>
        {!transformOnly ? (
        <button
          type="button"
          onClick={() => addNode("sourceNode")}
          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-900/40"
        >
          <Plus className="h-3.5 w-3.5" />
          Source
        </button>
        ) : null}
        <button
          type="button"
          onClick={() => addNode("destNode")}
          className="inline-flex items-center gap-1 rounded-lg border border-sky-300 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/40"
        >
          <Plus className="h-3.5 w-3.5" />
          {transformOnly ? "Warehouse" : "Destination"}
        </button>
        <AddTransformMenu onAddNative={addNativeTransformNode} onAddCode={addCodeTransformNode} />
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <button
          type="button"
          onClick={autoLayout}
          disabled={nodes.length === 0}
          title="Re-space nodes left-to-right with aligned connectors. Click Save to pipeline to persist positions."
          className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1 text-xs font-medium text-sky-900 hover:bg-sky-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100 dark:hover:bg-sky-900/40"
        >
          <LayoutGrid className="h-3.5 w-3.5" />
          Auto layout
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">Selection</span>
        <button
          type="button"
          onClick={removeSelectedEdges}
          disabled={selectedFlowEdges.length === 0}
          title={
            selectedFlowEdges.length === 0
              ? "Click a wire between nodes, then disconnect"
              : "Remove selected wire(s) between nodes"
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Unlink className="h-3.5 w-3.5" />
          Disconnect
        </button>
        <button
          type="button"
          onClick={removeSelectedNodes}
          disabled={selectedFlowNodes.length === 0}
          title={
            selectedFlowNodes.length === 0
              ? "Select one or more nodes on the diagram"
              : "Remove selected nodes from the diagram"
          }
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Remove nodes
        </button>
        <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
        {!pipelineId ? (
          <button
            type="button"
            onClick={resetGraph}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            title="Restore the default source → destination layout (scratch canvas only)"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset graph
          </button>
        ) : null}
        <button
          type="button"
          onClick={exportJson}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Download className="h-3.5 w-3.5" />
          Export JSON
        </button>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Upload className="h-3.5 w-3.5" />
          Import
        </button>
        {pipelineId && onSave && !saveDisabled ? (
          <>
            <div className="mx-1 h-4 w-px bg-slate-200 dark:bg-slate-700" aria-hidden />
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1 rounded-lg border border-sky-600 bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save to pipeline
            </button>
          </>
        ) : null}
        <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={onImportFile} />
      </div>
      {!isDesigner ? (
        <p className="border-b border-slate-200 bg-slate-50/70 px-3 py-2 text-[11px] leading-snug text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-400">
          <span className="font-medium text-slate-700 dark:text-slate-300">Runnable pipeline</span> — This editor is the
          pipeline: extract → load (add a <strong className="font-medium text-slate-700 dark:text-slate-300">transform</strong>{" "}
          node if you model in the warehouse). Stored with your connection in{" "}
          <code className="rounded bg-slate-200/80 px-1 text-[10px] dark:bg-slate-800">source_configuration</code>{" "}
          (including{" "}
          <code className="rounded bg-slate-200/80 px-1 text-[10px] dark:bg-slate-800">canvas</code> for the graph).
          Select a node to edit its settings in the side panel; the same fields exist in the{" "}
          {pipelineId ? (
            <a
              href={`/builder?pipeline=${encodeURIComponent(pipelineId)}`}
              className="font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              form builder
            </a>
          ) : (
            "form builder"
          )}
          .{" "}
          {pipelineId && onSave ? (
            <>
              <strong className="font-medium text-slate-700 dark:text-slate-300">Save to pipeline</strong> and{" "}
              <strong className="font-medium text-slate-700 dark:text-slate-300">Export JSON</strong> run a quick
              validation (connected graph, connector types when a pipeline is open, transform approach). Wiring: extract →
              load → optional transform chain. After a transform, only another transform may follow. Remove nodes with the
              toolbar, or Backspace / Delete.
            </>
          ) : (
            <>
              Scratch canvas: export or rely on local draft until you attach a pipeline. Export checks the same rules as
              save (graph connectivity and transform setup). Wiring: extract → load → optional transforms. Remove nodes
              with the toolbar, or Backspace / Delete.
            </>
          )}
        </p>
      ) : null}
      {bindingsError ? (
        <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {bindingsError}
        </p>
      ) : null}
      {localValidationError ? (
        <p
          role="alert"
          className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {localValidationError}
        </p>
      ) : null}
      {saveError ? (
        <p className="border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-200">
          {saveError}
        </p>
      ) : null}
      <div className="relative min-h-0 flex-1" onDragOver={onDragOver} onDrop={onDrop}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          isValidConnection={isValidConnection}
          deleteKeyCode={["Backspace", "Delete"]}
          onSelectionChange={onSelectionChange}
          onEdgesDelete={() => setSelectedFlowEdges([])}
          onInit={(inst) => {
            rfRef.current = inst;
          }}
          nodeTypes={pipelineNodeTypes}
          defaultEdgeOptions={{
            animated: true,
            deletable: true,
            focusable: true,
            selectable: true,
            interactionWidth: 20,
            style: { ...dashedAnimatedEdgeStyle },
          }}
          fitView
          colorMode={colorMode}
          proOptions={{ hideAttribution: true }}
          className="bg-slate-50 dark:bg-slate-950"
        >
          <Background gap={20} size={1} />
          <Controls position={isDesigner ? "top-left" : "bottom-left"} />
          <MiniMap
            position={isDesigner ? "top-right" : "bottom-right"}
            className="!bg-white/90 dark:!bg-slate-900/90"
            maskColor="rgba(0,0,0,0.12)"
            nodeStrokeWidth={2}
            pannable={!isDesigner}
            zoomable={!isDesigner}
          />
        </ReactFlow>
        {showEmptyStateOverlay && emptyStateOverlay ? (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
            <div className="pointer-events-auto w-full max-w-lg">{emptyStateOverlay}</div>
          </div>
        ) : null}
      </div>
    </div>
    </CanvasBindingsProvider>
  );
}

export function PipelineCanvas({ variant = "default", transformOnly = false, ...props }: PipelineCanvasProps) {
  const isDesigner = variant === "designer";
  return (
    <ReactFlowProvider>
      <div
        className={
          isDesigner
            ? "h-full min-h-0 w-full overflow-hidden border-0"
            : "h-[max(28rem,min(calc(100dvh-9rem),56rem))] w-full min-h-[28rem] overflow-hidden rounded-xl border border-slate-200 shadow-inner dark:border-slate-700"
        }
      >
        <FlowCanvas variant={variant} transformOnly={transformOnly} {...props} />
      </div>
    </ReactFlowProvider>
  );
}
