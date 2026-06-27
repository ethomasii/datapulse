"use client";

import { routerOutputPortsFromConfig, isRouterComponentId } from "@/lib/elt/router-routes";
import type { CanvasNodeRef } from "@/components/pipeline-canvas/canvas-graph-actions-context";
import { NodeRightPort } from "@/components/pipeline-canvas/node-right-port";

type Accent = "emerald" | "amber" | "sky";

type Props = {
  data: Record<string, unknown>;
  nodeRef: CanvasNodeRef;
  accent: Accent;
  allowAdd: boolean;
};

/** Stacked right-side source handles — one per router branch (+ optional default). */
export function RouterOutputPorts({ data, nodeRef, accent, allowAdd }: Props) {
  const componentId = String(data.componentId ?? "");
  const cfg = (data.config as Record<string, unknown>) ?? {};
  const ports = isRouterComponentId(componentId) ? routerOutputPortsFromConfig(cfg) : [];

  if (!ports.length) {
    return (
      <NodeRightPort
        node={nodeRef}
        accent={accent}
        allowAdd={false}
        handleId="route-0"
      />
    );
  }

  if (ports.length === 1) {
    const port = ports[0];
    return (
      <NodeRightPort
        node={{ ...nodeRef, sourceHandle: port?.id }}
        accent={accent}
        allowAdd={allowAdd && Boolean(port)}
        handleId={port?.id}
      />
    );
  }

  return (
    <>
      {ports.map((port, i) => {
        const topPct = ((i + 1) / (ports.length + 1)) * 100;
        return (
          <div
            key={port.id}
            className="absolute right-0 flex items-center"
            style={{ top: `${topPct}%`, transform: "translateY(-50%)" }}
          >
            <span
              className="pointer-events-none mr-1.5 max-w-[5.5rem] truncate rounded bg-violet-100/90 px-1 py-px text-[8px] font-medium text-violet-900 dark:bg-violet-950/80 dark:text-violet-200"
              title={port.label}
            >
              {port.label}
            </span>
            <NodeRightPort
              node={{ ...nodeRef, sourceHandle: port.id }}
              accent={accent}
              allowAdd={allowAdd}
              handleId={port.id}
              className="!relative !right-0 !translate-y-0"
            />
          </div>
        );
      })}
    </>
  );
}
