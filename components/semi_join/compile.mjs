// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_config-helpers.ts
function outputTable(config, fallback = "") {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/definitions/more-transforms.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var semiJoinComponent = {
  id: "semi_join",
  aliases: ["exists_join"],
  name: "Semi join",
  category: "transformation",
  description: "Rows in left that have a match in right (left columns only).",
  compileTarget: "python",
  fields: [
    { key: "left_table", label: "Left table", type: "string", required: true },
    { key: "right_table", label: "Right table", type: "string", required: true },
    { key: "on", label: "Join key(s)", type: "string_list", required: true },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const left = String(config.left_table ?? config.left_asset_key ?? "").trim();
    const right = String(config.right_table ?? config.right_asset_key ?? "").trim();
    const output = outputTable(config);
    const on = strList(config.on ?? config.join_keys);
    if (!left || !right || !output || !on.length) {
      return { warnings: ["semi_join: left_table, right_table, on, output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const onPy = `[${on.map((c) => JSON.stringify(c)).join(", ")}]`;
    const python = [
      `# \u2500\u2500 semi_join: ${left} \u2229 ${right} \u2500\u2500`,
      "import pandas as pd",
      "try:",
      "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
      "    _sql = _dest_client.sql_client()",
      `    _left = pd.read_sql('SELECT * FROM ${escapePyString(left)}', _sql._engine)`,
      `    _right = pd.read_sql('SELECT * FROM ${escapePyString(right)}', _sql._engine)`,
      `    _df = _left.merge(_right[${onPy}].drop_duplicates(), on=${onPy}, how='inner')`,
      `    _df = _df[_left.columns]`,
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[semi_join] wrote {len(_df)} rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[semi_join] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/semi_join.ts
function compile(config) {
  return semiJoinComponent.compile(config);
}
export {
  compile
};
