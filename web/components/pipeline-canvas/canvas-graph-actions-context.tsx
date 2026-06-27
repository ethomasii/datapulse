"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { ComponentListItem } from "@/components/elt/component-palette";

export type CanvasNodeRef = {
  nodeId: string;
  nodeType: string;
  label: string;
  componentId?: string;
  config?: Record<string, unknown>;
  /** Router branch handle when adding/connecting from a specific output port. */
  sourceHandle?: string;
};

export type CanvasGraphActionsValue = {
  isDesigner: boolean;
  pipelineId?: string;
  addComponentAfterNode: (
    upstreamNodeId: string,
    component: ComponentListItem,
    config?: Record<string, unknown>,
    options?: { sourceHandle?: string }
  ) => void;
  openTransformByExample: (node: CanvasNodeRef) => void;
  openExtendWithAssistant: (node: CanvasNodeRef, draft?: string) => void;
};

const CanvasGraphActionsContext = createContext<CanvasGraphActionsValue | null>(null);

export function CanvasGraphActionsProvider({
  value,
  children,
}: {
  value: CanvasGraphActionsValue | null;
  children: ReactNode;
}) {
  return (
    <CanvasGraphActionsContext.Provider value={value}>{children}</CanvasGraphActionsContext.Provider>
  );
}

export function useCanvasGraphActions(): CanvasGraphActionsValue | null {
  return useContext(CanvasGraphActionsContext);
}
