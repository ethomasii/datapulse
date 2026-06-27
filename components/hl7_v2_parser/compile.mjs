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

// web/lib/elt/native-components/python-snippets/hl7-v2-parser-snippet.ts
var HL7_V2_PARSER_SNIPPET = `
def _hl7_at(fields, idx):
    return fields[idx] if idx < len(fields) else None

def _hl7_parse_msh(seg_fields):
    return {
        "segment": "MSH",
        "sending_app": _hl7_at(seg_fields, 3),
        "sending_facility": _hl7_at(seg_fields, 4),
        "receiving_app": _hl7_at(seg_fields, 5),
        "receiving_facility": _hl7_at(seg_fields, 6),
        "message_datetime": _hl7_at(seg_fields, 7),
        "message_type": _hl7_at(seg_fields, 9) or "",
        "msg_control_id": _hl7_at(seg_fields, 10),
        "processing_id": _hl7_at(seg_fields, 11),
        "version_id": _hl7_at(seg_fields, 12),
    }

def _hl7_parse_pid(seg_fields, comp_sep):
    name = (_hl7_at(seg_fields, 5) or "").split(comp_sep)
    addr = (_hl7_at(seg_fields, 11) or "").split(comp_sep)
    patient_id_field = _hl7_at(seg_fields, 3) or ""
    patient_id = patient_id_field.split("~")[0].split(comp_sep)[0]
    return {
        "segment": "PID",
        "patient_id": patient_id or None,
        "last_name": name[0] if len(name) > 0 and name[0] else None,
        "first_name": name[1] if len(name) > 1 and name[1] else None,
        "middle": name[2] if len(name) > 2 and name[2] else None,
        "birth_date": _hl7_at(seg_fields, 7),
        "sex": _hl7_at(seg_fields, 8),
        "address_line1": addr[0] if len(addr) > 0 and addr[0] else None,
        "city": addr[2] if len(addr) > 2 and addr[2] else None,
        "state": addr[3] if len(addr) > 3 and addr[3] else None,
        "postal_code": addr[4] if len(addr) > 4 and addr[4] else None,
    }

def _hl7_parse_obx(seg_fields, comp_sep):
    ident = (_hl7_at(seg_fields, 3) or "").split(comp_sep)
    return {
        "segment": "OBX",
        "value_type": _hl7_at(seg_fields, 2),
        "code": ident[0] if len(ident) > 0 and ident[0] else None,
        "code_name": ident[1] if len(ident) > 1 and ident[1] else None,
        "code_system": ident[2] if len(ident) > 2 and ident[2] else None,
        "value": _hl7_at(seg_fields, 5),
        "units": _hl7_at(seg_fields, 6),
        "reference_range": _hl7_at(seg_fields, 7),
        "abnormal_flags": _hl7_at(seg_fields, 8),
        "result_status": _hl7_at(seg_fields, 11),
        "observation_dt": _hl7_at(seg_fields, 14),
    }

def _hl7_parse_orc(seg_fields, comp_sep):
    op = (_hl7_at(seg_fields, 12) or "").split(comp_sep)
    return {
        "segment": "ORC",
        "order_control_code": _hl7_at(seg_fields, 1),
        "placer_order_num": (_hl7_at(seg_fields, 2) or "").split(comp_sep)[0] or None,
        "filler_order_num": (_hl7_at(seg_fields, 3) or "").split(comp_sep)[0] or None,
        "order_status": _hl7_at(seg_fields, 5),
        "transaction_datetime": _hl7_at(seg_fields, 9),
        "ordering_provider_id": op[0] if len(op) > 0 and op[0] else None,
        "ordering_provider_last": op[1] if len(op) > 1 and op[1] else None,
        "ordering_provider_first": op[2] if len(op) > 2 and op[2] else None,
        "order_effective_dt": _hl7_at(seg_fields, 15),
    }

def _hl7_parse_obr(seg_fields, comp_sep):
    svc = (_hl7_at(seg_fields, 4) or "").split(comp_sep)
    return {
        "segment": "OBR",
        "set_id": _hl7_at(seg_fields, 1),
        "placer_order_num": (_hl7_at(seg_fields, 2) or "").split(comp_sep)[0] or None,
        "filler_order_num": (_hl7_at(seg_fields, 3) or "").split(comp_sep)[0] or None,
        "service_code": svc[0] if len(svc) > 0 and svc[0] else None,
        "service_name": svc[1] if len(svc) > 1 and svc[1] else None,
        "service_code_system": svc[2] if len(svc) > 2 and svc[2] else None,
        "observation_dt": _hl7_at(seg_fields, 7),
        "specimen_received_dt": _hl7_at(seg_fields, 14),
        "results_report_dt": _hl7_at(seg_fields, 22),
        "diagnostic_service": _hl7_at(seg_fields, 24),
        "result_status": _hl7_at(seg_fields, 25),
    }

def _hl7_parse_pv1(seg_fields, comp_sep):
    loc = (_hl7_at(seg_fields, 3) or "").split(comp_sep)
    att = (_hl7_at(seg_fields, 7) or "").split(comp_sep)
    return {
        "segment": "PV1",
        "patient_class": _hl7_at(seg_fields, 2),
        "point_of_care": loc[0] if len(loc) > 0 and loc[0] else None,
        "room": loc[1] if len(loc) > 1 and loc[1] else None,
        "bed": loc[2] if len(loc) > 2 and loc[2] else None,
        "facility": loc[3] if len(loc) > 3 and loc[3] else None,
        "attending_id": att[0] if len(att) > 0 and att[0] else None,
        "attending_last": att[1] if len(att) > 1 and att[1] else None,
        "attending_first": att[2] if len(att) > 2 and att[2] else None,
        "hospital_service": _hl7_at(seg_fields, 10),
        "admit_source": _hl7_at(seg_fields, 14),
        "visit_number": (_hl7_at(seg_fields, 19) or "").split(comp_sep)[0] or None,
        "admit_dt": _hl7_at(seg_fields, 44),
        "discharge_dt": _hl7_at(seg_fields, 45),
    }

def _hl7_parse_evn(seg_fields, comp_sep):
    op = (_hl7_at(seg_fields, 5) or "").split(comp_sep)
    return {
        "segment": "EVN",
        "event_type_code": _hl7_at(seg_fields, 1),
        "recorded_dt": _hl7_at(seg_fields, 2),
        "event_reason": _hl7_at(seg_fields, 4),
        "operator_id": op[0] if len(op) > 0 and op[0] else None,
        "operator_last": op[1] if len(op) > 1 and op[1] else None,
        "operator_first": op[2] if len(op) > 2 and op[2] else None,
        "event_occurred_dt": _hl7_at(seg_fields, 6),
    }

def _hl7_parse_dg1(seg_fields, comp_sep):
    diag = (_hl7_at(seg_fields, 3) or "").split(comp_sep)
    return {
        "segment": "DG1",
        "set_id": _hl7_at(seg_fields, 1),
        "coding_method": _hl7_at(seg_fields, 2),
        "diagnosis_code": diag[0] if len(diag) > 0 and diag[0] else None,
        "diagnosis_name": diag[1] if len(diag) > 1 and diag[1] else None,
        "diagnosis_codeset": diag[2] if len(diag) > 2 and diag[2] else None,
        "diagnosis_dt": _hl7_at(seg_fields, 5),
        "diagnosis_type": _hl7_at(seg_fields, 6),
    }

def _hl7_parse_al1(seg_fields, comp_sep):
    allg = (_hl7_at(seg_fields, 3) or "").split(comp_sep)
    return {
        "segment": "AL1",
        "set_id": _hl7_at(seg_fields, 1),
        "allergen_type": _hl7_at(seg_fields, 2),
        "allergen_code": allg[0] if len(allg) > 0 and allg[0] else None,
        "allergen_name": allg[1] if len(allg) > 1 and allg[1] else None,
        "allergen_codeset": allg[2] if len(allg) > 2 and allg[2] else None,
        "severity": _hl7_at(seg_fields, 4),
        "reaction": _hl7_at(seg_fields, 5),
        "onset_dt": _hl7_at(seg_fields, 6),
    }

_HL7_SEGMENT_PARSERS = {
    "MSH": lambda fields, comp: _hl7_parse_msh(fields),
    "PID": _hl7_parse_pid,
    "OBX": _hl7_parse_obx,
    "ORC": _hl7_parse_orc,
    "OBR": _hl7_parse_obr,
    "PV1": _hl7_parse_pv1,
    "EVN": _hl7_parse_evn,
    "DG1": _hl7_parse_dg1,
    "AL1": _hl7_parse_al1,
}

def _hl7_parse_message(raw, keep_segments):
    raw = raw.replace("\\r\\n", "\\r").replace("\\n", "\\r").strip()
    if not raw.startswith("MSH"):
        return [{"_error": "message must start with MSH segment", "raw_preview": raw[:80]}]
    field_sep = raw[3:4] or "|"
    encoding = raw[4:8] if len(raw) >= 8 else "^~\\\\&"
    comp_sep = encoding[0] if encoding else "^"
    rows = []
    msh_context = {}
    for seg_line in raw.split("\\r"):
        if not seg_line:
            continue
        seg_id = seg_line[:3]
        fields = seg_line.split(field_sep)
        if seg_id == "MSH":
            fields = ["MSH", encoding] + seg_line.split(field_sep)[1:]
        if seg_id not in keep_segments:
            continue
        parser = _HL7_SEGMENT_PARSERS.get(seg_id)
        if parser is None:
            continue
        try:
            row = parser(fields, comp_sep)
        except Exception as e:
            row = {"segment": seg_id, "_error": str(e)}
        if seg_id == "MSH":
            msh_context = {
                "msg_control_id": row.get("msg_control_id"),
                "message_type": row.get("message_type"),
                "sending_app": row.get("sending_app"),
                "version_id": row.get("version_id"),
            }
        else:
            for k, v in msh_context.items():
                row.setdefault(k, v)
        rows.append(row)
    return rows
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
var hl7V2ParserComponent = {
  id: "hl7_v2_parser",
  name: "HL7 v2 parser",
  category: "transformation",
  description: "Parse pipe-delimited HL7 v2 messages (MSH, PID, OBX, ORC, OBR, PV1, EVN, DG1, AL1).",
  compileTarget: "python",
  dagsterOnlyFields: DAGSTER_ONLY,
  fields: [
    { key: "table", label: "Table", type: "string", required: true },
    { key: "message_column", label: "Message column", type: "string", default: "message" },
    {
      key: "keep_segments",
      label: "Keep segments",
      type: "string_list",
      description: "MSH, PID, OBX, ORC, OBR, PV1, EVN, DG1, AL1",
      default: ["MSH", "PID", "OBX"]
    },
    { key: "output_table", label: "Output table", type: "string", required: true }
  ],
  compile(config) {
    const table = inputTable(config);
    const output = outputTable(config);
    const messageCol = String(config.message_column ?? "message").trim();
    const keepSegments = strList(config.keep_segments).length ? strList(config.keep_segments) : ["MSH", "PID", "OBX"];
    if (!table || !output) {
      return { warnings: ["hl7_v2_parser: table and output_table required"], python: [] };
    }
    const { outSchema, outName } = outputParts(output);
    const keepPy = `[${keepSegments.map((s) => JSON.stringify(s)).join(", ")}]`;
    const python = [
      `# \u2500\u2500 hl7_v2_parser: ${table} \u2192 ${output} \u2500\u2500`,
      HL7_V2_PARSER_SNIPPET.trim(),
      "try:",
      ...pandasReadTable(table).map((l) => l.startsWith("import") ? l : `    ${l}`),
      `    _msg_col = ${JSON.stringify(messageCol)}`,
      "    if _msg_col not in _df.columns:",
      `        raise ValueError(f"message_column {_msg_col!r} not in table columns")`,
      `    _keep = ${keepPy}`,
      "    _all_rows = []",
      "    for _, _src in _df.iterrows():",
      "        _raw = _src[_msg_col]",
      "        if not isinstance(_raw, str) or not _raw.strip():",
      "            continue",
      "        for _row in _hl7_parse_message(_raw, _keep):",
      "            for _c in _df.columns:",
      "                if _c != _msg_col and _c not in _row:",
      "                    _row[_c] = _src[_c]",
      "            _all_rows.append(_row)",
      "    _df = pd.DataFrame(_all_rows)",
      `    _df.to_sql("${escapePyString(outName)}", _sql._engine, schema="${escapePyString(outSchema)}", if_exists="replace", index=False)`,
      `    print(f"[hl7_v2_parser] wrote {len(_df)} segment rows to ${escapePyString(output)}")`,
      "except Exception as _e:",
      '    print(f"[hl7_v2_parser] failed: {_e}")',
      "    raise"
    ];
    return { python };
  }
};

// ../../../../../tmp/eltpulse-compile-EyK14Q/hl7_v2_parser.ts
function compile(config) {
  return hl7V2ParserComponent.compile(config);
}
export {
  compile
};
