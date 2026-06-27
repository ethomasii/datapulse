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
  /** React Flow handle id — required for multi-output router branches. */
  handleId?: string;
  className?: string;
};

/** Right-edge source port — in designer mode the handle becomes a compact + menu. */
export function NodeRightPort({ node, accent, allowAdd = true, handleId, className }: Props) {
  const actions = useCanvasGraphActions();
  const showAdd = Boolean(actions?.isDesigner && allowAdd);

  if (showAdd) {
    return (
      <NodeAddStepMenu
        node={{ ...node, sourceHandle: handleId ?? node.sourceHandle }}
        asHandle
        handleId={handleId}
        className={className}
      />
    );
  }

  return (
    <Handle
      type="source"
      position={Position.Right}
      id={handleId}
      className={handleClass(accent)}
      title={handleId ? `Output: ${handleId}` : undefined}
    />
  );
}
