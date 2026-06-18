"use client";

import { useCallback, useMemo } from "react";
import {
  Background,
  Controls,
  Handle,
  MiniMap,
  Position,
  ReactFlow,
  type Edge,
  type Node,
  type NodeProps,
  addEdge,
  useEdgesState,
  useNodesState,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Plus, Trash2 } from "lucide-react";
import type { WorkflowDefinition, WorkflowEdge, WorkflowNode } from "@/lib/elt/elt-workflow-runner";

type PipelineOption = { id: string; name: string };

type Props = {
  definition: WorkflowDefinition;
  pipelines: PipelineOption[];
  onChange: (def: WorkflowDefinition) => void;
  readOnly?: boolean;
};

function pipelineLabel(pipelines: PipelineOption[], id?: string) {
  if (!id) return "Select pipeline…";
  return pipelines.find((p) => p.id === id)?.name ?? id.slice(0, 8);
}

function PipelineNode({ data }: NodeProps) {
  return (
    <div className="min-w-[160px] rounded-lg border-2 border-sky-500 bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
      <Handle type="target" position={Position.Top} className="!bg-sky-500" />
      <p className="text-[10px] font-semibold uppercase text-sky-600">Pipeline</p>
      <p className="text-sm font-medium text-slate-900 dark:text-white">{String(data.label ?? "Pipeline")}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-sky-500" />
    </div>
  );
}

function MonitorNode({ data }: NodeProps) {
  return (
    <div className="min-w-[160px] rounded-lg border-2 border-violet-500 bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
      <Handle type="target" position={Position.Top} className="!bg-violet-500" />
      <p className="text-[10px] font-semibold uppercase text-violet-600">Monitor</p>
      <p className="text-sm font-medium text-slate-900 dark:text-white">{String(data.label ?? "Monitor")}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-violet-500" />
    </div>
  );
}

function WebhookNode({ data }: NodeProps) {
  return (
    <div className="min-w-[160px] rounded-lg border-2 border-amber-500 bg-white px-3 py-2 shadow-sm dark:bg-slate-900">
      <Handle type="target" position={Position.Top} className="!bg-amber-500" />
      <p className="text-[10px] font-semibold uppercase text-amber-600">Webhook</p>
      <p className="truncate text-xs text-slate-500">{String(data.webhookUrl ?? "https://…")}</p>
      <Handle type="source" position={Position.Bottom} className="!bg-amber-500" />
    </div>
  );
}

const nodeTypes = {
  workflowPipeline: PipelineNode,
  workflowMonitor: MonitorNode,
  workflowWebhook: WebhookNode,
};

function toFlowNodes(def: WorkflowDefinition, pipelines: PipelineOption[]): Node[] {
  return def.nodes.map((n, i) => {
    const type =
      n.type === "monitor" ? "workflowMonitor" : n.type === "webhook" ? "workflowWebhook" : "workflowPipeline";
    const label =
      n.label ??
      (n.type === "pipeline"
        ? pipelineLabel(pipelines, n.pipelineId)
        : n.type === "monitor"
          ? "Monitor trigger"
          : "Webhook");
    return {
      id: n.id,
      type,
      position: { x: 80 + (i % 3) * 220, y: 40 + Math.floor(i / 3) * 140 },
      data: { ...n, label },
    };
  });
}

function toFlowEdges(def: WorkflowDefinition): Edge[] {
  return def.edges.map((e, i) => ({
    id: `e-${i}`,
    source: e.from,
    target: e.to,
    label: e.on,
    animated: e.on === "success",
  }));
}

function fromFlow(nodes: Node[], edges: Edge[]): WorkflowDefinition {
  const wfNodes: WorkflowNode[] = nodes.map((n) => {
    const d = n.data as Record<string, unknown>;
    const type = (d.type as WorkflowNode["type"]) ?? "pipeline";
    return {
      id: n.id,
      type,
      pipelineId: typeof d.pipelineId === "string" ? d.pipelineId : undefined,
      monitorId: typeof d.monitorId === "string" ? d.monitorId : undefined,
      webhookUrl: typeof d.webhookUrl === "string" ? d.webhookUrl : undefined,
      label: typeof d.label === "string" ? d.label : undefined,
    };
  });
  const wfEdges: WorkflowEdge[] = edges.map((e) => ({
    from: e.source,
    to: e.target,
    on: (String(e.label ?? "success") as WorkflowEdge["on"]) || "success",
  }));
  return { nodes: wfNodes, edges: wfEdges };
}

let idSeq = 0;

export function WorkflowDagEditor({ definition, pipelines, onChange, readOnly = false }: Props) {
  const initialNodes = useMemo(() => toFlowNodes(definition, pipelines), [definition, pipelines]);
  const initialEdges = useMemo(() => toFlowEdges(definition), [definition]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  const sync = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange(fromFlow(nextNodes, nextEdges));
    },
    [onChange]
  );

  const onConnect = useCallback(
    (conn: Connection) => {
      if (readOnly) return;
      setEdges((eds) => {
        const next = addEdge({ ...conn, label: "success", animated: true }, eds);
        sync(nodes, next);
        return next;
      });
    },
    [nodes, readOnly, setEdges, sync]
  );

  const addPipelineNode = () => {
    idSeq += 1;
    const id = `node-${idSeq}`;
    const nextNodes: Node[] = [
      ...nodes,
      {
        id,
        type: "workflowPipeline",
        position: { x: 120, y: 120 + nodes.length * 30 },
        data: { type: "pipeline", label: "New pipeline", pipelineId: pipelines[0]?.id ?? "" },
      },
    ];
    setNodes(nextNodes);
    sync(nextNodes, edges);
  };

  const removeSelected = () => {
    const selected = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (!selected.size) return;
    const nextNodes = nodes.filter((n) => !selected.has(n.id));
    const nextEdges = edges.filter((e) => !selected.has(e.source) && !selected.has(e.target));
    setNodes(nextNodes);
    setEdges(nextEdges);
    sync(nextNodes, nextEdges);
  };

  const selectedNode = nodes.find((n) => n.selected);
  const selectedData = selectedNode?.data as Record<string, unknown> | undefined;

  const patchSelected = (patch: Record<string, unknown>) => {
    if (!selectedNode) return;
    const nextNodes = nodes.map((n) =>
      n.id === selectedNode.id ? { ...n, data: { ...n.data, ...patch } } : n
    );
    setNodes(nextNodes);
    sync(nextNodes, edges);
  };

  return (
    <div className="space-y-3">
      {!readOnly ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={addPipelineNode}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium dark:border-slate-600"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add pipeline node
          </button>
          <button
            type="button"
            onClick={removeSelected}
            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
            Remove selected
          </button>
        </div>
      ) : null}

      <div className="h-[360px] rounded-xl border border-slate-200 dark:border-slate-700">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          nodesDraggable={!readOnly}
          nodesConnectable={!readOnly}
          elementsSelectable={!readOnly}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {selectedNode && !readOnly ? (
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <p className="text-xs font-semibold text-slate-600">Selected: {selectedNode.id}</p>
          {(selectedData?.type === "pipeline" || selectedNode.type === "workflowPipeline") && (
            <label className="mt-2 block text-sm">
              <span className="font-medium">Pipeline</span>
              <select
                value={String(selectedData?.pipelineId ?? "")}
                onChange={(e) =>
                  patchSelected({
                    pipelineId: e.target.value,
                    label: pipelineLabel(pipelines, e.target.value),
                  })
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 dark:border-slate-600 dark:bg-slate-950"
              >
                {pipelines.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      ) : null}
    </div>
  );
}
