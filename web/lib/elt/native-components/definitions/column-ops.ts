import type { NativeComponentDefinition } from "../types";
import { pandasReadTable, pandasWriteTable } from "./_pandas-helpers";

export const renameColumnsComponent: NativeComponentDefinition = {
  id: "rename_columns",
  aliases: ["dynamic_rename"],
  name: "Rename columns",
  category: "transformation",
  description: "Rename columns on a loaded table (pandas).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "mapping",
      label: "Column mapping",
      description: "JSON object old_name → new_name, e.g. {\"id\":\"order_id\"}",
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let mapping: Record<string, string> = {};
    const raw = config.mapping ?? config.column_mapping ?? config.rename_map;
    if (typeof raw === "string") {
      try {
        mapping = JSON.parse(raw) as Record<string, string>;
      } catch {
        return { warnings: ["rename_columns: mapping must be valid JSON object"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      mapping = Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)])
      );
    }
    if (!table || !Object.keys(mapping).length) {
      return { warnings: ["rename_columns: table and mapping required"], python: [] };
    }
    const mapPy = JSON.stringify(mapping);
    const python = [
      `# ── rename_columns: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.rename(columns=${mapPy})`,
      ...pandasWriteTable(output, "rename_columns"),
      "except Exception as _ren_err:",
      '    print(f"[rename_columns] failed: {_ren_err}")',
      "    raise",
    ];
    return { python };
  },
};

export const castColumnsComponent: NativeComponentDefinition = {
  id: "cast_columns",
  aliases: ["make_columns"],
  name: "Cast columns",
  category: "transformation",
  description: "Cast column dtypes after load (pandas astype).",
  compileTarget: "python",
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    {
      key: "dtypes",
      label: "Dtype mapping",
      description: "JSON object column → dtype, e.g. {\"amount\":\"float64\",\"created_at\":\"datetime64[ns]\"}",
      type: "text",
      required: true,
    },
    { key: "output_table", label: "Output table", type: "string" },
  ],
  compile(config) {
    const table = String(config.table ?? "").trim();
    const output = String(config.output_table ?? table).trim();
    let dtypes: Record<string, string> = {};
    const raw = config.dtypes ?? config.column_types ?? config.cast;
    if (typeof raw === "string") {
      try {
        dtypes = JSON.parse(raw) as Record<string, string>;
      } catch {
        return { warnings: ["cast_columns: dtypes must be valid JSON object"], python: [] };
      }
    } else if (raw && typeof raw === "object") {
      dtypes = Object.fromEntries(
        Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)])
      );
    }
    if (!table || !Object.keys(dtypes).length) {
      return { warnings: ["cast_columns: table and dtypes required"], python: [] };
    }
    const dtypesPy = JSON.stringify(dtypes);
    const python = [
      `# ── cast_columns: ${table} ──`,
      "try:",
      ...pandasReadTable(table).map((l) => (l.startsWith("import") ? l : `    ${l}`)),
      `    _df = _df.astype(${dtypesPy})`,
      ...pandasWriteTable(output, "cast_columns"),
      "except Exception as _cast_err:",
      '    print(f"[cast_columns] failed: {_cast_err}")',
      "    raise",
    ];
    return { python };
  },
};
