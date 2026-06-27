"use client";

import { Handle, Position } from "@xyflow/react";
import type { CanvasNodeRef } from "./canvas-graph-actions-context";
import { useCanvasGraphActions } from "./canvas-graph-actions-context";
import { NodeAddStepMenu } from "./node-add-step-menu";

type Accent = "emerald" | "amber" | "sky";

function handleClass(kind: Accent) {
  const map = {
    emerald: "!border-emerald-500 !bg-emerald-500",
    amber: "!border-amber-500 !bg-amber-500",
    sky: "!border-sky-500 !bg-sky-500",
  };
  return `!h-3 !w-3 !border-2 ${map[kind]}`;
}

type Props = {
  node: CanvasNodeRef;
  accent: Accent;
  /** When false, show the default dot (e.g. terminal validate nodes). */
  allowAdd?: boolean;
};

/**
 * Right-edge source port — in designer mode the colored handle becomes a + menu
 * anchored exactly where React Flow connects edges (right: 0, top: 50%, translate 50%).
 */
export function NodeRightPort({ node, accent, allowAdd = true }: Props) {
  const actions = useCanvasGraphActions();
  const showAdd = Boolean(actions?.isDesigner && allowAdd);

  if (showAdd) {
    return (
      <>
        <Handle
          type="source"
          position={Position.Right}
          id="source"
          className="!pointer-events-none !h-6 !w-6 !border-0 !bg-transparent !opacity-0"
        />
        <NodeAddStepMenu
          node={node}
          className="pointer-events-auto absolute right-0 top-1/2 z-20 -translate-y-1/2 translate-x-1/2"
        />
      </>
    );
  }

  return <Handle type="source" position={Position.Right} className={handleClass(accent)} />;
}
