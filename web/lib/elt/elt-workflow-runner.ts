/**
 * Lightweight workflow DAG runner — pipeline chains after success (Lakeflow Jobs lite).
 */

import { db } from "@/lib/db/client";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { createPendingEltRun } from "@/lib/elt/create-pending-elt-run";

export type WorkflowNode = {
  id: string;
  type: "pipeline" | "monitor" | "webhook";
  pipelineId?: string;
  monitorId?: string;
  webhookUrl?: string;
  label?: string;
};

export type WorkflowEdge = {
  from: string;
  to: string;
  on: "success" | "failure" | "always";
};

export type WorkflowDefinition = {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
};

export function parseWorkflowDefinition(raw: unknown): WorkflowDefinition {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { nodes: [], edges: [] };
  }
  const d = raw as Record<string, unknown>;
  const nodes = Array.isArray(d.nodes) ? (d.nodes as WorkflowNode[]) : [];
  const edges = Array.isArray(d.edges) ? (d.edges as WorkflowEdge[]) : [];
  return { nodes, edges };
}

/** Find downstream nodes from a source node id matching event type. */
export function downstreamNodes(
  def: WorkflowDefinition,
  fromNodeId: string,
  event: "success" | "failure"
): WorkflowNode[] {
  const targets = new Set<string>();
  for (const e of def.edges) {
    if (e.from !== fromNodeId) continue;
    if (e.on === "always" || e.on === event) targets.add(e.to);
  }
  return def.nodes.filter((n) => targets.has(n.id));
}

async function enqueuePipeline(userId: string, pipelineId: string, triggeredBy: string): Promise<boolean> {
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId },
    select: {
      id: true,
      name: true,
      enabled: true,
      defaultTargetAgentTokenId: true,
      executionHost: true,
    },
  });
  if (!pipeline?.enabled) return false;

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { executionPlane: true, organizationId: true },
  });
  const { targetAgentTokenId, ingestionExecutor } = await resolveNewRunExecution({
    userId,
    organizationId: actor?.organizationId ?? null,
    executionHost: pipeline.executionHost,
    pipelineDefaultTargetAgentTokenId: pipeline.defaultTargetAgentTokenId,
    bodyOverride: undefined,
    userExecutionPlane: actor?.executionPlane ?? "eltpulse_managed",
  });

  await createPendingEltRun({
    userId,
    pipelineId: pipeline.id,
    environment: "workflow",
    triggeredBy,
    partitionColumn: null,
    partitionValue: null,
    targetAgentTokenId,
    ingestionExecutor,
  });
  return true;
}

async function executeNode(userId: string, node: WorkflowNode, wfName: string): Promise<boolean> {
  if (node.type === "pipeline" && node.pipelineId) {
    return enqueuePipeline(userId, node.pipelineId, `workflow:${wfName}:${node.id}`);
  }
  if (node.type === "webhook" && node.webhookUrl?.startsWith("https://")) {
    try {
      await fetch(node.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": "eltPulse-Workflow/1" },
        body: JSON.stringify({ source: "eltpulse", event: "workflow.step", nodeId: node.id, workflow: wfName }),
        signal: AbortSignal.timeout(10_000),
      });
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** After a pipeline run completes, walk workflow edges and enqueue downstream pipelines. */
export async function triggerWorkflowsForPipelineRun(
  userId: string,
  pipelineId: string,
  outcome: "success" | "failure"
): Promise<{ triggered: string[] }> {
  const workflows = await db.eltWorkflow.findMany({
    where: { userId, enabled: true },
  });
  const triggered: string[] = [];

  for (const wf of workflows) {
    const def = parseWorkflowDefinition(wf.definition);
    const sourceNodes = def.nodes.filter((n) => n.type === "pipeline" && n.pipelineId === pipelineId);
    for (const src of sourceNodes) {
      const next = downstreamNodes(def, src.id, outcome);
      for (const node of next) {
        const ok = await executeNode(userId, node, wf.name);
        if (ok) triggered.push(`${wf.name}:${node.id}`);
      }
    }
  }

  return { triggered };
}

/** After a monitor fires, enqueue paired downstream pipelines in matching workflows. */
export async function triggerWorkflowsForMonitor(
  userId: string,
  monitorId: string,
  pipelineId: string
): Promise<{ triggered: string[] }> {
  const workflows = await db.eltWorkflow.findMany({
    where: { userId, enabled: true },
  });
  const triggered: string[] = [];

  for (const wf of workflows) {
    const def = parseWorkflowDefinition(wf.definition);
    const sourceNodes = def.nodes.filter(
      (n) => n.type === "monitor" && (n.monitorId === monitorId || n.pipelineId === pipelineId)
    );
    for (const src of sourceNodes) {
      const next = downstreamNodes(def, src.id, "success");
      for (const node of next) {
        const ok = await executeNode(userId, node, wf.name);
        if (ok) triggered.push(`${wf.name}:${node.id}`);
      }
    }
  }

  return { triggered };
}
