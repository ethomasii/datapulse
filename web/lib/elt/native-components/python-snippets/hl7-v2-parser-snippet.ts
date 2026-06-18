/** Ported from dagster-component-templates hl7_v2_parser — inlined into pipeline Python. */
export const HL7_V2_PARSER_SNIPPET = `
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
