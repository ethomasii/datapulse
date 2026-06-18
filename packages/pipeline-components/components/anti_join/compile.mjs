// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/analytics-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var antiJoinComponent = {
  id: "anti_join",
  aliases: ["except_join", "left_anti_join"],
  name: "Anti join",
  category: "transformation",
  description: "Rows in left table not present in right (left anti join).",
  compileTarget: "python",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "on", label: "Join key(s)", type: "string_list", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const left = String(config.left_table ?? "").trim();
    const right = String(config.right_table ?? "").trim();
    const output = String(config.output_table ?? "").trim();
    const on = strList(config.on ?? config.join_keys);
    if (!left || !right || !output || !on.length) {
      return { warnings: ["anti_join: left_table, right_table, on, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const onPy = `[${on.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# \u2500\u2500 anti_join: ${left} \u2212 ${right} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
      `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
      `    _df = _left.merge(_right[${onPy}], on=${onPy}, how='left', indicator=True)`,
      "    _df = _df[_df['_merge'] == 'left_only'].drop(columns=['_merge'])",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[anti_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[anti_join] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../private/var/folders/hr/vjhs9sj942g3fj0z8qyvxxm40000gn/T/eltpulse-compile-owfwbk/anti_join.ts
function compile(config) {
  return antiJoinComponent.compile(config);
}
export {
  compile
};
