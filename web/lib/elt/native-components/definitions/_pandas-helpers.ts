import { escapePyString } from "@/lib/elt/escape-py";

export function parseTableParts(table: string): { schema: string; name: string } {
  const parts = table.split(".");
  if (parts.length > 1) {
    return { schema: parts[0]!, name: parts.slice(1).join(".") };
  }
  return { schema: "public", name: table };
}

export function pandasReadTable(table: string): string[] {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`,
  ];
}

export function pandasWriteTable(outputTable: string, label: string): string[] {
  const { schema, name } = parseTableParts(outputTable);
  return [
    `    _df.to_sql("${escapePyString(name)}", _sql._engine, schema="${escapePyString(schema)}", if_exists="replace", index=False)`,
    `    print(f"[${label}] wrote {len(_df)} rows to ${escapePyString(outputTable)}")`,
  ];
}

export function strList(v: unknown): string[] {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}
