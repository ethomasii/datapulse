/** Ported from dagster-component-templates fix_message_parser. */
export const FIX_MESSAGE_PARSER_SNIPPET = `
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
