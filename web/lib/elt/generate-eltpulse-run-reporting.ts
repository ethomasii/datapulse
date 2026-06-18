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
            _loads = getattr(_info, "loads_ids", None) or []
            _metrics = getattr(_info, "metrics", None)
            if _metrics is not None:
                for _k, _v in (getattr(_metrics, "__dict__", {}) or {}).items():
                    if "row" in str(_k).lower() and isinstance(_v, (int, float)) and _v >= 0:
                        _total_rows = max(_total_rows, int(_v))
            _job = getattr(_info, "load_packages", None)
            if _job:
                for _pkg in _job:
                    for _table, _tbl_info in (getattr(_pkg, "jobs", None) or {}).items():
                        _rows = getattr(_tbl_info, "row_counts", None)
                        if isinstance(_rows, dict):
                            _r = sum(int(v) for v in _rows.values() if isinstance(v, (int, float)))
                        else:
                            _r = int(getattr(_tbl_info, "rows_count", 0) or 0)
                        if _r > 0:
                            print(f"[eltpulse] resource:{_table} rows:{_r}", flush=True)
                            _total_rows = max(_total_rows, _r)
            if _total_rows > 0:
                print(f"[eltpulse] resource:_total rows:{_total_rows}", flush=True)
            print("[eltpulse] phase:done", flush=True)
        _eltpulse_report_load_info(${varName})
    except Exception as _elt_e:
        print(f"[eltpulse] load_info report skipped: {_elt_e}", flush=True)
`;
}
