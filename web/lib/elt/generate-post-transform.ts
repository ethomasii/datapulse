import type { PipelineRequest } from "./types";
import { escapePyString } from "./escape-py";

/**
 * Optional post-load Python or SQL transform script.
 * Stored in `source_configuration.post_transform: { type: "python"|"sql", code: string }`.
 *
 * Python: appended verbatim after pipeline.run(). Has access to `pipeline`, `info`, `partition_key`.
 * SQL:    each non-empty statement is executed against the destination connection.
 */
export function postTransformBeforeReturn(request: PipelineRequest): string {
  const raw = request.sourceConfiguration?.post_transform;
  if (!raw || typeof raw !== "object") return "";
  const pt = raw as Record<string, unknown>;
  const type = String(pt.type ?? "").trim();
  const code = String(pt.code ?? "").trim();
  if (!code) return "";

  if (type === "python") {
    return generatePythonTransform(code);
  }
  if (type === "sql") {
    return generateSqlTransform(request, code);
  }
  return "";
}

function generatePythonTransform(code: string): string {
  // Indent each line by 4 spaces to sit inside the run() function
  const indented = code
    .split("\n")
    .map((line) => `    ${line}`)
    .join("\n");

  return `
    # ── Post-load Python transform ───────────────────────────────────────────
${indented}
    # ─────────────────────────────────────────────────────────────────────────
`;
}

function generateSqlTransform(request: PipelineRequest, code: string): string {
  // Split on semicolons, skip blanks
  const statements = code
    .split(";")
    .map((s) => s.trim())
    .filter(Boolean);

  if (statements.length === 0) return "";

  const destination = request.destinationInstance
    ? `${request.destinationType}__${request.destinationInstance}`
    : request.destinationType;

  const stmtLines = statements
    .map((s) => `        "${escapePyString(s)}",`)
    .join("\n");

  return `
    # ── Post-load SQL transform ──────────────────────────────────────────────
    try:
        import sqlalchemy
        _pt_engine = pipeline._get_destination_clients(pipeline.state)[0].sql_client()._engine
        _pt_stmts = [
${stmtLines}
        ]
        with _pt_engine.begin() as _pt_conn:
            for _pt_stmt in _pt_stmts:
                _pt_conn.execute(sqlalchemy.text(_pt_stmt))
    except Exception as _pt_err:
        print(f"[post-transform SQL] warning: {{_pt_err}}")
    # destination hint: ${escapePyString(destination)}
    # ─────────────────────────────────────────────────────────────────────────
`;
}
