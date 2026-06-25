export type BuilderCanvasTab = "designer" | "ingest" | "dag";

export function parseBuilderCanvasTab(raw: string | null | undefined): BuilderCanvasTab {
  if (raw === "ingest" || raw === "dag") return raw;
  return "designer";
}

export function builderUrl(options?: {
  pipeline?: string | null;
  view?: "form" | "canvas";
  canvas?: BuilderCanvasTab;
  starter?: string;
  source_table?: string;
  new?: boolean;
}): string {
  const params = new URLSearchParams();
  if (options?.pipeline) params.set("pipeline", options.pipeline);
  if (options?.view === "canvas") params.set("view", "canvas");
  if (options?.canvas && options.canvas !== "designer") params.set("canvas", options.canvas);
  if (options?.starter) params.set("starter", options.starter);
  if (options?.source_table) params.set("source_table", options.source_table);
  if (options?.new) params.set("new", "1");
  const q = params.toString();
  return q ? `/builder?${q}` : "/builder";
}

/** @deprecated Use builderUrl({ view: "canvas", ... }) */
export function legacyCanvasUrl(options?: {
  pipeline?: string;
  starter?: string;
  source_table?: string;
}): string {
  return builderUrl({ ...options, view: "canvas" });
}
