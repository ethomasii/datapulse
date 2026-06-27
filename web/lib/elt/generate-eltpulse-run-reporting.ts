/**
 * Python helpers appended to generated pipelines for eltPulse run reporting (dbt artifacts → catalog).
 */

import { escapePyString } from "./escape-py";

/** After dbt run_all, PATCH run_results.json + manifest.json to eltPulse when env is set. */
export function eltpulseDbtArtifactUploadPython(packagePathVar = "package_path"): string {
  const pkg = packagePathVar.startsWith('"') ? packagePathVar : `r"${escapePyString(packagePathVar)}"`;
  return `
    # eltPulse: upload dbt artifacts for catalog enrichment (optional — needs ELTPULSE_RUN_ID)
    try:
        import json as _elt_json
        import os as _elt_os
        import pathlib as _elt_pathlib
        import urllib.request as _elt_urllib

        def _eltpulse_upload_dbt_artifacts(_package_path):
            _run_id = _elt_os.environ.get("ELTPULSE_RUN_ID", "").strip()
            _base = _elt_os.environ.get("ELTPULSE_CONTROL_PLANE_URL", "").strip().rstrip("/")
            _agent = _elt_os.environ.get("ELTPULSE_AGENT_TOKEN", "").strip()
            _internal = _elt_os.environ.get("ELTPULSE_INTERNAL_API_SECRET", "").strip()
            if not _run_id or not _base:
                return
            _target = _elt_pathlib.Path(_package_path) / "target"
            _run_results = _target / "run_results.json"
            _manifest = _target / "manifest.json"
            _body = {}
            if _run_results.is_file():
                _body["dbtRunResults"] = _elt_json.loads(_run_results.read_text(encoding="utf-8"))
            if _manifest.is_file():
                _body["dbtArtifactManifest"] = _elt_json.loads(_manifest.read_text(encoding="utf-8"))
            if not _body:
                return
            if _agent:
                _url = f"{_base}/api/agent/runs/{_run_id}"
                _auth = _agent
            elif _internal:
                _url = f"{_base}/api/internal/managed-runs/{_run_id}"
                _auth = _internal
            else:
                return
            _req = _elt_urllib.Request(
                _url,
                data=_elt_json.dumps(_body).encode("utf-8"),
                headers={"Authorization": f"Bearer {_auth}", "Content-Type": "application/json"},
                method="PATCH",
            )
            with _elt_urllib.urlopen(_req, timeout=60) as _resp:
                _resp.read()

        _eltpulse_upload_dbt_artifacts(${pkg})
    except Exception as _elt_e:
        print(f"[eltpulse] dbt artifact upload skipped: {_elt_e}", flush=True)
`;
}

/** Optional background psutil sampling → PATCH run telemetry (customer Python agents). */
export function eltpulseAgentSystemMetricsPython(): string {
  return `
    # eltPulse: optional CPU/RAM telemetry (pip install psutil; ELTPULSE_SYSTEM_METRICS=1)
    import threading as _elt_thr
    _elt_metrics_stop = _elt_thr.Event()

    def _eltpulse_system_metrics_loop():
        try:
            import os as _elt_os
            import time as _elt_time
            import json as _elt_json
            import urllib.request as _elt_urllib
            try:
                import psutil as _elt_psutil
            except ImportError:
                return
            if _elt_os.environ.get("ELTPULSE_SYSTEM_METRICS", "").strip().lower() in ("0", "false", "no"):
                return
            _run_id = _elt_os.environ.get("ELTPULSE_RUN_ID", "").strip()
            _base = _elt_os.environ.get("ELTPULSE_CONTROL_PLANE_URL", "").strip().rstrip("/")
            _agent = _elt_os.environ.get("ELTPULSE_AGENT_TOKEN", "").strip()
            _internal = _elt_os.environ.get("ELTPULSE_INTERNAL_API_SECRET", "").strip()
            if not _run_id or not _base:
                return
            if _agent:
                _url = f"{_base}/api/agent/runs/{_run_id}"
                _auth = _agent
            elif _internal:
                _url = f"{_base}/api/internal/managed-runs/{_run_id}"
                _auth = _internal
            else:
                return
            _proc = _elt_psutil.Process()
            _interval = max(5.0, float(_elt_os.environ.get("ELTPULSE_SYSTEM_METRICS_INTERVAL_MS", "20000") or 20000) / 1000.0)
            while not _elt_metrics_stop.wait(_interval):
                _mem = round(_proc.memory_info().rss / (1024 * 1024), 1)
                _cpu = round(_proc.cpu_percent(interval=0.1), 1)
                _body = {
                    "status": "running",
                    "telemetrySummary": {"system": {"memoryMb": _mem, "cpuPercent": _cpu}},
                    "appendTelemetrySample": {"system": {"memoryMb": _mem, "cpuPercent": _cpu}},
                }
                _req = _elt_urllib.Request(
                    _url,
                    data=_elt_json.dumps(_body).encode("utf-8"),
                    headers={"Authorization": f"Bearer {_auth}", "Content-Type": "application/json"},
                    method="PATCH",
                )
                try:
                    with _elt_urllib.urlopen(_req, timeout=30) as _resp:
                        _resp.read()
                except Exception:
                    pass
        except Exception:
            pass

    _elt_thr.Thread(target=_eltpulse_system_metrics_loop, daemon=True).start()
`;
}

/** Inline Python helpers: PATCH telemetry while pipeline.run() is in flight. */
export function eltpulseLiveTelemetryHelpersPython(): string {
  return `
# --- eltPulse live run telemetry ---
def _eltpulse_run_patch_auth():
    import os as _ep_os
    _run_id = _ep_os.environ.get("ELTPULSE_RUN_ID", "").strip()
    _base = _ep_os.environ.get("ELTPULSE_CONTROL_PLANE_URL", "").strip().rstrip("/")
    _agent = _ep_os.environ.get("ELTPULSE_AGENT_TOKEN", "").strip()
    _internal = _ep_os.environ.get("ELTPULSE_INTERNAL_API_SECRET", "").strip()
    if not _run_id or not _base:
        return None, None
    if _agent:
        return f"{_base}/api/agent/runs/{_run_id}", _agent
    if _internal:
        return f"{_base}/api/internal/managed-runs/{_run_id}", _internal
    return None, None

def _eltpulse_patch_run(body):
    try:
        import json as _ep_json
        import urllib.request as _ep_urllib
        _url, _auth = _eltpulse_run_patch_auth()
        if not _url:
            return
        body = dict(body)
        body.setdefault("status", "running")
        _req = _ep_urllib.Request(
            _url,
            data=_ep_json.dumps(body).encode("utf-8"),
            headers={"Authorization": f"Bearer {_auth}", "Content-Type": "application/json"},
            method="PATCH",
        )
        with _ep_urllib.urlopen(_req, timeout=15) as _resp:
            _resp.read()
    except Exception:
        pass

def _eltpulse_emit_phase(phase):
    _progress = {"extract": 15, "load": 70, "dbt": 90, "done": 100, "failed": 100}.get(phase, 50)
    print(f"[eltpulse] phase:{phase}", flush=True)
    _eltpulse_patch_run({
        "telemetrySummary": {"currentPhase": phase, "progress": _progress},
        "appendTelemetrySample": {"phase": phase, "progress": _progress},
    })

def _eltpulse_emit_resource(resource, rows, bytes_loaded=None):
    summary = {"currentResource": resource, "rowsLoaded": int(rows)}
    sample = {"resource": resource, "rows": int(rows)}
    if bytes_loaded is not None:
        summary["bytesLoaded"] = int(bytes_loaded)
        sample["bytes"] = int(bytes_loaded)
    msg = f"[eltpulse] resource:{resource} rows:{rows}"
    if bytes_loaded is not None:
        msg += f" bytes:{bytes_loaded}"
    print(msg, flush=True)
    _eltpulse_patch_run({"telemetrySummary": summary, "appendTelemetrySample": sample})

def _eltpulse_parse_log_line(msg):
    import re as _ep_re
    m = _ep_re.search(r"\\[eltpulse\\]\\s+phase:(\\w+)", msg, _ep_re.I)
    if m:
        _eltpulse_emit_phase(m.group(1).lower())
        return
    m = _ep_re.search(r"\\[eltpulse\\]\\s+resource:([^\\s]+)\\s+rows:([\\d,]+)", msg, _ep_re.I)
    if m:
        _eltpulse_emit_resource(m.group(1), int(m.group(2).replace(",", "")))
        return
    m = _ep_re.search(r"rows\\s+processed\\s+so\\s+far:\\s*([\\d,]+)", msg, _ep_re.I)
    if m:
        rows = int(m.group(1).replace(",", ""))
        _eltpulse_emit_resource("_progress", rows)
        return
    m = _ep_re.search(r"^\\s*-\\s*([^:]+):\\s*([\\d,]+)\\s+row\\(s\\)", msg, _ep_re.I)
    if m:
        _eltpulse_emit_resource(m.group(1).strip(), int(m.group(2).replace(",", "")))
        return
    m = _ep_re.search(r"([\\d,]+)\\s*rows\\s+loaded", msg, _ep_re.I)
    if m:
        rows = int(m.group(1).replace(",", ""))
        _eltpulse_patch_run({"telemetrySummary": {"rowsLoaded": rows}, "appendTelemetrySample": {"rows": rows}})

def _eltpulse_run_pipeline(pipeline, source, **kwargs):
    import logging as _ep_logging
    import threading as _ep_threading

    class _EltpulseLogHandler(_ep_logging.Handler):
        def emit(self, record):
            try:
                _eltpulse_parse_log_line(record.getMessage())
            except Exception:
                pass

    _eltpulse_emit_phase("extract")
    _stop = _ep_threading.Event()
    _handler = _EltpulseLogHandler()
    _handler.setLevel(_ep_logging.INFO)
    _loggers = ("dlt", "dlt.pipeline", "dlt.extract", "dlt.normalize", "dlt.load", "dlt.common", "dlt.sources")
    for _name in _loggers:
        _lg = _ep_logging.getLogger(_name)
        _lg.addHandler(_handler)
        if _lg.level > _ep_logging.INFO:
            _lg.setLevel(_ep_logging.INFO)

    def _heartbeat():
        while not _stop.wait(20.0):
            _eltpulse_patch_run({"appendTelemetrySample": {"phase": "load", "progress": 70}})

    _hb = _ep_threading.Thread(target=_heartbeat, daemon=True)
    try:
        _eltpulse_emit_phase("load")
        _hb.start()
        return pipeline.run(source, **kwargs)
    finally:
        _stop.set()
        for _name in _loggers:
            try:
                _ep_logging.getLogger(_name).removeHandler(_handler)
            except Exception:
                pass
# --- end eltPulse live run telemetry ---
`;
}

/** Wrap generated dlt pipeline.py so runs PATCH live telemetry during pipeline.run(). */
export function wrapDltPipelineCodeForLiveTelemetry(code: string): string {
  if (!code.includes("pipeline.run(") || code.includes("_eltpulse_run_pipeline")) {
    return code;
  }
  const wrapped = code.replace(/pipeline\.run\(/g, "_eltpulse_run_pipeline(pipeline, ");
  const defIdx = wrapped.indexOf("\ndef run");
  const insertAt = defIdx >= 0 ? defIdx : wrapped.indexOf("def run");
  if (insertAt < 0) {
    return eltpulseLiveTelemetryHelpersPython() + "\n" + wrapped;
  }
  return (
    wrapped.slice(0, insertAt) +
    "\n" +
    eltpulseLiveTelemetryHelpersPython() +
    wrapped.slice(insertAt)
  );
}

/** After dlt pipeline.run(), emit resource markers + optional telemetry PATCH from load_info. */
export function eltpulseReportLoadInfoPython(infoVar = "info"): string {
  const varName = infoVar.trim() || "info";
  return `
    # eltPulse: report dlt load_info for observability
    try:
        def _eltpulse_report_load_info(_info):
            if _info is None:
                return
            _total_rows = 0
            _total_bytes = 0
            _by_table = {}

            def _add_table(_table, _rows):
                nonlocal _total_rows
                if not _table or not isinstance(_rows, (int, float)) or _rows <= 0:
                    return
                _r = int(_rows)
                _key = str(_table)
                _by_table[_key] = _by_table.get(_key, 0) + _r
                _total_rows += _r

            # Primary: normalize step row counts (dlt pipeline.run → LoadInfo with .pipeline.last_trace)
            _pipeline = getattr(_info, "pipeline", None)
            if _pipeline is not None:
                _trace = getattr(_pipeline, "last_trace", None)
                if _trace is not None:
                    _norm = getattr(_trace, "last_normalize_info", None)
                    if _norm is not None:
                        _counts = getattr(_norm, "row_counts", None) or {}
                        if isinstance(_counts, dict):
                            for _table, _cnt in _counts.items():
                                _add_table(_table, _cnt)

            # Bytes from completed load jobs
            for _pkg in (getattr(_info, "load_packages", None) or []):
                _jobs = getattr(_pkg, "jobs", None)
                if not isinstance(_jobs, dict):
                    continue
                for _job in (_jobs.get("completed_jobs") or []):
                    _fs = int(getattr(_job, "file_size", 0) or 0)
                    if _fs > 0:
                        _total_bytes += _fs

            # Fallback: table_metrics on step metrics (older/alternate dlt shapes)
            _metrics = getattr(_info, "metrics", None)
            if isinstance(_metrics, dict):
                for _mlist in _metrics.values():
                    for _m in (_mlist or []):
                        _table_metrics = None
                        if isinstance(_m, dict):
                            _table_metrics = _m.get("table_metrics")
                        else:
                            _table_metrics = getattr(_m, "table_metrics", None) if hasattr(_m, "table_metrics") else None
                        if not isinstance(_table_metrics, dict):
                            continue
                        for _tname, _tm in _table_metrics.items():
                            _ic = getattr(_tm, "items_count", None)
                            if _ic is None and isinstance(_tm, dict):
                                _ic = _tm.get("items_count")
                            if _ic:
                                _add_table(_tname, _ic)
                                _fs = getattr(_tm, "file_size", None)
                                if _fs is None and isinstance(_tm, dict):
                                    _fs = _tm.get("file_size")
                                if _fs:
                                    _total_bytes += int(_fs)

            for _table, _r in _by_table.items():
                if "_eltpulse_emit_resource" in globals():
                    _eltpulse_emit_resource(_table, _r)
                else:
                    print(f"[eltpulse] resource:{_table} rows:{_r}", flush=True)
            if _total_rows > 0:
                if "_eltpulse_emit_resource" in globals():
                    _eltpulse_emit_resource("_total", _total_rows, _total_bytes if _total_bytes > 0 else None)
                elif _total_bytes > 0:
                    print(f"[eltpulse] resource:_total rows:{_total_rows} bytes:{_total_bytes}", flush=True)
                else:
                    print(f"[eltpulse] resource:_total rows:{_total_rows}", flush=True)
            elif _total_bytes > 0:
                if "_eltpulse_emit_resource" in globals():
                    _eltpulse_emit_resource("_total", 0, _total_bytes)
                else:
                    print(f"[eltpulse] resource:_total rows:0 bytes:{_total_bytes}", flush=True)
            if "_eltpulse_emit_phase" in globals():
                _eltpulse_emit_phase("done")
            else:
                print("[eltpulse] phase:done", flush=True)
        _eltpulse_report_load_info(${varName})
    except Exception as _elt_e:
        print(f"[eltpulse] load_info report skipped: {_elt_e}", flush=True)
`;
}
