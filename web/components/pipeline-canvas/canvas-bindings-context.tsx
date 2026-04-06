"use client";

import { createContext, useContext, type ReactNode } from "react";

export type CanvasBindingsContextValue = {
  /** For links to the full connector form (JSON / guided). */
  pipelineId: string;
  pipelineSourceType: string;
  pipelineDestinationType: string;
  onPickSourceType: (sourceType: string) => void | Promise<void>;
  onPickDestinationType: (destinationType: string) => void | Promise<void>;
  bindingsBusy: boolean;
};

const CanvasBindingsContext = createContext<CanvasBindingsContextValue | null>(null);

export function CanvasBindingsProvider({
  value,
  children,
}: {
  value: CanvasBindingsContextValue | null;
  children: ReactNode;
}) {
  return <CanvasBindingsContext.Provider value={value}>{children}</CanvasBindingsContext.Provider>;
}

export function useCanvasBindings(): CanvasBindingsContextValue | null {
  return useContext(CanvasBindingsContext);
}
