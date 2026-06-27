// web/lib/elt/escape-py.ts
function escapePyString(s) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

// web/lib/elt/native-components/definitions/_config-helpers.ts
function inputTable(config) {
  return String(
    config.table ?? config.upstream_asset_key ?? config.input_table ?? config.source_table ?? ""
  ).trim();
}
function outputTable(config, fallback = "") {
  return String(config.output_table ?? config.asset_name ?? fallback).trim();
}

// web/lib/elt/native-components/definitions/_pandas-helpers.ts
function pandasReadTable(table) {
  return [
    "import pandas as pd",
    "    _dest_client = pipeline._get_destination_clients(pipeline.state)[0]",
    "    _sql = _dest_client.sql_client()",
    `    _df = pd.read_sql('SELECT * FROM ${escapePyString(table)}', _sql._engine)`
  ];
}
function strList(v) {
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  if (typeof v === "string" && v.trim()) {
    return v.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

// web/lib/elt/native-components/python-snippets/fix-message-parser-snippet.ts
var FIX_MESSAGE_PARSER_SNIPPET = `
_FIX_SIDE = {"1": "buy", "2": "sell", "3": "buy_minus", "4": "sell_plus", "5": "sell_short", "6": "sell_short_exempt"}
_FIX_ORD_TYPE = {"1": "market", "2": "limit", "3": "stop", "4": "stop_limit"}
_FIX_TIF = {"0": "day", "1": "gtc", "2": "opg", "3": "ioc", "4": "fok", "5": "gtx", "6": "gtd"}
_FIX_ORD_STATUS = {"0": "new", "1": "partially_filled", "2": "filled", "3": "done_for_day", "4": "canceled", "5": "replaced", "6": "pending_cancel", "7": "stopped", "8": "rejected", "9": "suspended", "A": "pending_new", "B": "calculated", "C": "expired", "D": "accepted_for_bidding", "E": "pending_replace"}
_FIX_EXEC_TYPE = {"0": "new", "1": "partial_fill", "2": "fill", "3": "done_for_day", "4": "canceled", "5": "replace", "6": "pending_cancel", "7": "stopped", "8": "rejected", "9": "suspended", "A": "pending_new", "B": "calculated", "C": "expired", "F": "trade", "G": "trade_correct", "H": "trade_cancel"}
_FIX_MSG_TYPE = {"D": "NewOrderSingle", "F": "OrderCancelRequest", "G": "OrderCancelReplaceRequest", "8": "ExecutionReport", "9": "OrderCancelReject", "3": "Reject", "0": "Heartbeat", "1": "TestRequest", "2": "ResendRequest", "A": "Logon", "5": "Logout", "W": "MarketDataSnapshotFullRefresh"}

def _fix_detect_delimiter(raw):
    if "\\x01" in raw:
        return "\\x01"
    if "|" in raw:
        return "|"
    return "\\x01"

def _fix_parse_message(raw):
    raw = raw.strip().rstrip("\\x01").rstrip("|")
    if not raw:
        return {"_error": "empty message"}
    delim = _fix_detect_delimiter(raw)
    tags_raw = {}
    for kv in raw.split(delim):
        if "=" not in kv:
            continue
        k, v = kv.split("=", 1)
        tags_raw[k.strip()] = v.strip()
    if not tags_raw:
        return {"_error": "no tag=value pairs found", "raw_preview": raw[:80]}
    out = {
        "begin_string": tags_raw.get("8"),
        "msg_type": tags_raw.get("35"),
        "msg_type_name": _FIX_MSG_TYPE.get(tags_raw.get("35", ""), None),
        "sender": tags_raw.get("49"),
        "target": tags_raw.get("56"),
        "msg_seq_num": tags_raw.get("34"),
        "sending_time": tags_raw.get("52"),
        "cl_ord_id": tags_raw.get("11"),
        "order_id": tags_raw.get("37"),
        "exec_id": tags_raw.get("17"),
        "symbol": tags_raw.get("55"),
        "side_code": tags_raw.get("54"),
        "side": _FIX_SIDE.get(tags_raw.get("54", ""), None),
        "ord_type_code": tags_raw.get("40"),
        "ord_type": _FIX_ORD_TYPE.get(tags_raw.get("40", ""), None),
        "time_in_force_code": tags_raw.get("59"),
        "time_in_force": _FIX_TIF.get(tags_raw.get("59", ""), None),
        "ord_status_code": tags_raw.get("39"),
        "ord_status": _FIX_ORD_STATUS.get(tags_raw.get("39", ""), None),
        "exec_type_code": tags_raw.get("150"),
        "exec_type": _FIX_EXEC_TYPE.get(tags_raw.get("150", ""), None),
        "transact_time": tags_raw.get("60"),
    }
    for k_in, k_out in [("38", "order_qty"), ("44", "price"), ("31", "last_px"), ("32", "last_qty"), ("14", "cum_qty"), ("151", "leaves_qty"), ("6", "avg_px")]:
        v = tags_raw.get(k_in)
        try:
            out[k_out] = float(v) if v not in (None, "") else None
        except (ValueError, TypeError):
            out[k_out] = None
    out["tags_raw"] = tags_raw
    return out
`;

// web/lib/elt/native-components/definitions/domain-parsers.ts
function outputParts(output) {
  const outSchema = output.includes(".") ? output.split(".")[0] : "public";
  const outName = output.includes(".") ? output.split(".").pop() : output;
  return { outSchema, outName };
}
var DAGSTER_ONLY = [
  "group_name",
  "partition_type",
  "partition_start",
  "partition_date_column",
  "partition_values",
  "owners",
  "asset_tags",
  "kinds",
  "freshness_max_lag_minutes",
  "freshness_cron",
  "include_preview_metadata",
  "preview_rows",
  "deps",
  "retry_policy_max_retries",
  "retry_policy_delay_seconds",
  "retry_policy_backoff",
  "dynamic_partition_name",
  "partition_dimensions"
];
var fixMessageParserComponent = {
  id: "fix_message_parser",
  name: "FIX message parser",
  category: "transformation",
  description: "Parse FIX trading messages (tag=value) into flat rows with symbol, side, qty, price.",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "message_column", label: "Message column", type: "string", default: "message" },
    { key: "msg_type_filter", label: "MsgType filter", type: "string_list", description: "e.g. D, 8" },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const messageCol = String(config.message_column ?? "message").trim();
    const typeFilter = strList(config.msg_type_filter);
    if (!table || !output) {
      return { warnings: ["fix_message_parser: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const filterPy = typeFilter.length ? `{${typeFilter.map((t) => JSON.stringify(String(t))).join(", ")}}` : "None";
    const python = [
      `# \u2500\u2500 fix_message_parser: ${table} \u2192 ${output} \u2500\u2500`,
      FIX_MESSAGE_PARSER_SNIPPET.trim(),
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _msg_col = ${JSON.stringify(messageCol)}`,
      `    _type_filter = ${filterPy}`,
      "    if _msg_col not in _df.columns:",
      `        raise ValueError(f"message_column {_msg_col!r} not in table columns")`,
      "    _all_rows = []",
      "    for _, _src in _df.iterrows():",
      "        _raw = _src[_msg_col]",
      "        if not isinstance(_raw, str) or not _raw.strip():",
      "            continue",
      "        _row = _fix_parse_message(_raw)",
      "        if _type_filter and _row.get('msg_type') not in _type_filter:",
      "            continue",
      "        for _c in _df.columns:",
      "            if _c != _msg_col and _c not in _row:",
      "                _row[_c] = _src[_c]",
      "        _all_rows.append(_row)",
      "    _df = pd.DataFrame(_all_rows)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[fix_message_parser] wrote {len(_df)} messages to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[fix_message_parser] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/fix_message_parser.ts
function compile(config) {
  return fixMessageParserComponent.compile(config);
}
export {
  compile
};
