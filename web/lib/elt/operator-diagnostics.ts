/** Step-level diagnostic surfaced in the canvas operator sidebar + preview strip. */
export type OperatorDiagnostic = {
  id: string;
  source: "columns" | "input_preview" | "output_preview";
  severity: "error" | "warning";
  message: string;
  hint?: string;
};

export type OperatorDiagnosticInput = Omit<OperatorDiagnostic, "id">;

const SOURCE_LABELS: Record<OperatorDiagnostic["source"], string> = {
  columns: "Columns",
  input_preview: "Input preview",
  output_preview: "Output preview",
};

export function operatorDiagnosticSourceLabel(source: OperatorDiagnostic["source"]): string {
  return SOURCE_LABELS[source];
}

/** Turn raw API / warehouse messages into operator-friendly diagnostics. */
export function buildOperatorDiagnostic(
  id: string,
  input: OperatorDiagnosticInput
): OperatorDiagnostic {
  const message = input.message.trim();
  const lower = message.toLowerCase();
  let hint = input.hint;

  if (!hint) {
    const alreadyExplainsCatalog =
      lower.includes("set database") ||
      lower.includes("currently \"") ||
      lower.includes("where dlt wrote") ||
      message.length > 120;
    if (
      !alreadyExplainsCatalog &&
      (lower === "not found" || lower.includes("motherduck database"))
    ) {
      hint =
        "Open your MotherDuck destination connection and set Database to where dlt loaded data (often my_db, not eltpulse). Run a sync if the table is new.";
    } else if (lower.includes("destination connection")) {
      hint = "Link a destination connection on this pipeline (Destination node or ingest settings), then save.";
    } else if (lower.includes("wire") || lower.includes("input table")) {
      hint = "Wire the Select Columns step from the Destination node so it reads landed warehouse data.";
    } else if (lower.includes("unauthorized") || lower.includes("pipeline not found")) {
      hint = "Save the pipeline and refresh the page. If this persists, open the pipeline from the builder list.";
    }
  }

  return { id, ...input, message, ...(hint ? { hint } : {}) };
}

export function mergeOperatorDiagnostics(
  prev: OperatorDiagnostic[],
  id: string,
  next: OperatorDiagnostic | null
): OperatorDiagnostic[] {
  const without = prev.filter((d) => d.id !== id);
  if (!next) return without;
  return [...without, next];
}
