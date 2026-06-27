"""
eltPulse managed worker — Python batch executor (FastAPI HTTP + CLI).

**Production (eltPulse-owned compute):**

Deploy this directory as a **separate Vercel/Fly project**. Point the control plane at
`POST /batch` via `ELTPULSE_MANAGED_DELEGATE_URL` + `ELTPULSE_MANAGED_DELEGATE_SECRET`.

See `README.md` in this folder.

**Local / CI:**

- CLI: `python main.py`
- Dev: `ELTPULSE_MANAGED_EXECUTOR=local` on the control plane

Uses `ELTPULSE_INTERNAL_API_SECRET` to call control plane internal APIs.
Wall clock cap: **900_000 ms (15 minutes)** per invocation by default.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any

import httpx
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel, Field

app = FastAPI(title="eltPulse managed worker", version="0.1.0")

# Hard cap aligned with Vercel Python maxDuration (seconds → ms).
_MAX_WALL_MS = 900_000
_LOG_CHUNK = 3400
_PHASE_MARKER = re.compile(r"\[eltpulse\]\s+phase:(\w+)", re.IGNORECASE)
_RESOURCE_MARKER = re.compile(
    r"\[eltpulse\]\s+resource:([^\s]+)\s+rows:(\d+)(?:\s+bytes:(\d+))?", re.IGNORECASE
)
_ROWS_LOADED = re.compile(r"\b([\d,]+)\s*rows\s+loaded\b", re.IGNORECASE)
_ROWS_SO_FAR = re.compile(r"rows\s+processed\s+so\s+far:\s*([\d,]+)", re.IGNORECASE)
_BYTES_LOADED = re.compile(r"\b([\d,]+)\s*bytes\s+loaded\b", re.IGNORECASE)
_PHASE_PROGRESS = {"extract": 15, "load": 70, "dbt": 90, "done": 100, "failed": 100}

_VERIFIED_SOURCES_ROOT = Path(__file__).resolve().parent / "verified_sources"
_LEGACY_GITHUB_IMPORT = "from dlt.sources.github import github_reactions"
_GITHUB_IMPORT = "from github import github_reactions"
_VERIFIED_IMPORT_RE = re.compile(r"^from\s+([a-z][a-z0-9_]*)\s+import\s+", re.MULTILINE)
# Stdlib / dlt imports that are not dlt verified-source packages.
_BUILTIN_IMPORT_MODULES = frozenset(
    {"os", "sys", "json", "re", "typing", "datetime", "pathlib", "base64", "dlt", "decimal", "collections"}
)
_VENDORED_VERIFIED_SOURCES: dict[str, Path] = {
    "github": _VERIFIED_SOURCES_ROOT / "github",
}


def _vendored_verified_sources() -> dict[str, Path]:
    """All packages under verified_sources/ with __init__.py (pre-vendored for fast starts)."""
    out = dict(_VENDORED_VERIFIED_SOURCES)
    root = _VERIFIED_SOURCES_ROOT
    if not root.is_dir():
        return out
    for child in root.iterdir():
        if child.is_dir() and (child / "__init__.py").is_file():
            out.setdefault(child.name, child)
    return out


def _verified_import_modules(code: str) -> list[str]:
    """Detect top-level verified-source packages imported by generated pipeline code."""
    modules: set[str] = set()
    if "dlt.sources.github" in code:
        modules.add("github")
    for match in _VERIFIED_IMPORT_RE.finditer(code):
        name = match.group(1)
        if name in _BUILTIN_IMPORT_MODULES or name.startswith("dlt"):
            continue
        modules.add(name)
    return sorted(modules)


def _inject_dlt_secret_aliases(env: dict[str, str]) -> dict[str, str]:
    """Map connection env vars to dlt SOURCES__* secrets expected by verified packages."""
    out = dict(env)
    gh = out.get("GITHUB_TOKEN") or out.get("github_token")
    if gh:
        out.setdefault("GITHUB_TOKEN", gh)
        out.setdefault("SOURCES__GITHUB__ACCESS_TOKEN", gh)
    stripe = out.get("STRIPE_SECRET_KEY") or out.get("STRIPE_API_KEY")
    if stripe:
        out.setdefault("STRIPE_SECRET_KEY", stripe)
        out.setdefault("SOURCES__STRIPE_ANALYTICS__STRIPE_SECRET_KEY", stripe)
    hs = out.get("HUBSPOT_API_KEY") or out.get("HUBSPOT_ACCESS_TOKEN")
    if hs:
        out.setdefault("HUBSPOT_API_KEY", hs)
        out.setdefault("SOURCES__HUBSPOT__API_KEY", hs)
    pd = out.get("PIPEDRIVE_API_KEY") or out.get("PIPEDRIVE_API_TOKEN")
    if pd:
        out.setdefault("PIPEDRIVE_API_KEY", pd)
        out.setdefault("SOURCES__PIPEDRIVE__PIPEDRIVE_API_KEY", pd)
    jira_domain = out.get("JIRA_DOMAIN") or out.get("JIRA_SUBDOMAIN")
    jira_email = out.get("JIRA_EMAIL")
    jira_token = out.get("JIRA_API_TOKEN")
    if jira_domain:
        out.setdefault("JIRA_DOMAIN", jira_domain)
        subdomain = jira_domain.strip().lower().removeprefix("https://").removeprefix("http://")
        if subdomain.endswith(".atlassian.net"):
            subdomain = subdomain[: -len(".atlassian.net")]
        subdomain = subdomain.split("/")[0].strip()
        if subdomain:
            out.setdefault("JIRA_SUBDOMAIN", subdomain)
            out.setdefault("SOURCES__JIRA__SUBDOMAIN", subdomain)
    if jira_email:
        out.setdefault("SOURCES__JIRA__EMAIL", jira_email)
    if jira_token:
        out.setdefault("SOURCES__JIRA__API_TOKEN", jira_token)
    zd_sub = out.get("ZENDESK_SUBDOMAIN")
    zd_email = out.get("ZENDESK_EMAIL")
    zd_token = out.get("ZENDESK_TOKEN") or out.get("ZENDESK_API_TOKEN")
    if zd_sub:
        out.setdefault("SOURCES__ZENDESK__SUBDOMAIN", zd_sub)
    if zd_email:
        out.setdefault("SOURCES__ZENDESK__EMAIL", zd_email)
    if zd_token:
        out.setdefault("SOURCES__ZENDESK__TOKEN", zd_token)
    slack = out.get("SLACK_BOT_TOKEN") or out.get("SLACK_ACCESS_TOKEN")
    if slack:
        out.setdefault("SLACK_BOT_TOKEN", slack)
        out.setdefault("SOURCES__SLACK__ACCESS_TOKEN", slack)
    asana = out.get("ASANA_ACCESS_TOKEN") or out.get("ASANA_DLT_ACCESS_TOKEN")
    if asana:
        out.setdefault("ASANA_ACCESS_TOKEN", asana)
        out.setdefault("SOURCES__ASANA_DLT__ACCESS_TOKEN", asana)
    fd_key = out.get("FRESHDESK_API_KEY")
    fd_domain = out.get("FRESHDESK_DOMAIN")
    if fd_key:
        out.setdefault("SOURCES__FRESHDESK__API_SECRET_KEY", fd_key)
    if fd_domain:
        out.setdefault("SOURCES__FRESHDESK__DOMAIN", fd_domain)
    workable = out.get("WORKABLE_ACCESS_TOKEN") or out.get("WORKABLE_API_TOKEN")
    workable_sub = out.get("WORKABLE_ACCOUNT_SUBDOMAIN") or out.get("WORKABLE_SUBDOMAIN")
    if workable:
        out.setdefault("SOURCES__WORKABLE__ACCESS_TOKEN", workable)
    if workable_sub:
        out.setdefault("WORKABLE_SUBDOMAIN", workable_sub)
        out.setdefault("SOURCES__WORKABLE__SUBDOMAIN", workable_sub)
    matomo_token = out.get("MATOMO_TOKEN_AUTH")
    matomo_url = out.get("MATOMO_URL")
    if matomo_token:
        out.setdefault("SOURCES__MATOMO__TOKEN_AUTH", matomo_token)
    if matomo_url:
        out.setdefault("SOURCES__MATOMO__URL", matomo_url)
    notion = out.get("NOTION_TOKEN") or out.get("NOTION_API_KEY")
    if notion:
        out.setdefault("NOTION_TOKEN", notion)
        out.setdefault("NOTION_API_KEY", notion)
        out.setdefault("SOURCES__NOTION__API_KEY", notion)
    airtable = out.get("AIRTABLE_API_KEY") or out.get("AIRTABLE_ACCESS_TOKEN")
    if airtable:
        out.setdefault("AIRTABLE_API_KEY", airtable)
        out.setdefault("AIRTABLE_ACCESS_TOKEN", airtable)
        out.setdefault("SOURCES__AIRTABLE__ACCESS_TOKEN", airtable)
    intercom = out.get("INTERCOM_ACCESS_TOKEN")
    if intercom:
        out.setdefault("SOURCES__INTERCOM__ACCESS_TOKEN", intercom)
    mixpanel = out.get("MIXPANEL_API_SECRET") or out.get("MIXPANEL_SECRET")
    if mixpanel:
        out.setdefault("MIXPANEL_API_SECRET", mixpanel)
        out.setdefault("SOURCES__MIXPANEL__API_SECRET", mixpanel)
    segment = out.get("SEGMENT_ACCESS_TOKEN") or out.get("SEGMENT_API_TOKEN")
    if segment:
        out.setdefault("SEGMENT_ACCESS_TOKEN", segment)
        out.setdefault("SOURCES__SEGMENT__ACCESS_TOKEN", segment)
    personio_id = out.get("PERSONIO_CLIENT_ID")
    personio_secret = out.get("PERSONIO_CLIENT_SECRET")
    if personio_id:
        out.setdefault("SOURCES__PERSONIO__CLIENT_ID", personio_id)
    if personio_secret:
        out.setdefault("SOURCES__PERSONIO__CLIENT_SECRET", personio_secret)
    strapi_token = out.get("STRAPI_API_TOKEN") or out.get("STRAPI_API_SECRET_KEY")
    strapi_domain = out.get("STRAPI_DOMAIN") or out.get("STRAPI_BASE_URL")
    if strapi_token:
        out.setdefault("STRAPI_API_SECRET_KEY", strapi_token)
        out.setdefault("SOURCES__STRAPI__API_SECRET_KEY", strapi_token)
    if strapi_domain:
        out.setdefault("STRAPI_DOMAIN", strapi_domain)
        out.setdefault("SOURCES__STRAPI__DOMAIN", strapi_domain)
    return out


def _patch_legacy_github_pipeline(code: str) -> str:
    """Upgrade saved pipelines that only read GITHUB_TOKEN once without validation."""
    if "from github import github_reactions" not in code or "Missing GitHub token" in code:
        return code
    pattern = r'github_token = os\.environ\.get\("[^"]+"\)'
    if not re.search(pattern, code):
        return code
    replacement = '''github_token = (
        os.environ.get("GITHUB_TOKEN")
        or os.environ.get("SOURCES__GITHUB__ACCESS_TOKEN")
    )
    if not github_token:
        raise RuntimeError(
            "Missing GitHub token. Link a GitHub source connection with GITHUB_TOKEN in the builder."
        )'''
    return re.sub(pattern, replacement, code, count=1)


def _prepare_dlt_pipeline_code(code: str) -> tuple[str, list[str]]:
    """Rewrite legacy imports and return verified-source modules to stage."""
    if _LEGACY_GITHUB_IMPORT in code:
        code = code.replace(_LEGACY_GITHUB_IMPORT, _GITHUB_IMPORT)
    code = _patch_legacy_github_pipeline(code)
    return code, _verified_import_modules(code)


def _stage_verified_source(tdir: Path, module: str) -> None:
    dest = tdir / module
    if dest.is_dir():
        return
    vendored = _vendored_verified_sources().get(module)
    if vendored and vendored.is_dir():
        shutil.copytree(vendored, dest)
        return
    proc = subprocess.run(
        [sys.executable, "-m", "dlt", "init", module, "duckdb"],
        cwd=tdir,
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"dlt init {module} failed: {detail[-2000:]}")
    if not dest.is_dir():
        raise RuntimeError(f"dlt init {module} did not create {module}/ package")


def _install_verified_source_requirements(tdir: Path) -> None:
    req = tdir / "requirements.txt"
    if not req.is_file():
        return
    proc = subprocess.run(
        [sys.executable, "-m", "pip", "install", "-r", str(req), "-q"],
        capture_output=True,
        text=True,
    )
    if proc.returncode != 0:
        detail = (proc.stderr or proc.stdout or "").strip()
        raise RuntimeError(f"pip install verified source requirements failed: {detail[-2000:]}")


def _control_plane_base() -> str:
    """Origin of the Next.js control plane (HTTPS, no trailing slash)."""
    cp = (os.environ.get("ELTPULSE_CONTROL_PLANE_URL") or "").strip().rstrip("/")
    if cp:
        return cp
    explicit = (os.environ.get("ELTPULSE_CRON_APP_URL") or "").strip().rstrip("/")
    if explicit:
        return explicit
    vercel = (os.environ.get("VERCEL_URL") or "").strip()
    if vercel:
        return f"https://{vercel}".rstrip("/")
    npu = (os.environ.get("NEXT_PUBLIC_APP_URL") or "").strip().rstrip("/")
    if npu:
        return npu
    raise RuntimeError(
        "Set ELTPULSE_CONTROL_PLANE_URL (preferred in CI), or ELTPULSE_CRON_APP_URL / "
        "VERCEL_URL / NEXT_PUBLIC_APP_URL for internal API calls."
    )


def _tool_run_label(tool: str) -> str:
    t = str(tool).lower()
    if t == "sling":
        return "database replication"
    if t == "dbt":
        return "dbt transform"
    return "connector sync"


def _sanitize(text: str, max_len: int) -> str:
    t = text.replace("\x00", "")
    if len(t) <= max_len:
        return t
    return t[: max_len - 20] + "\n…(truncated)"


def _require_trigger(request: Request) -> None:
    expected = (os.environ.get("ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET") or "").strip()
    auth = request.headers.get("authorization") or ""
    if not expected or auth != f"Bearer {expected}":
        raise HTTPException(status_code=401, detail="Unauthorized")


class BatchBody(BaseModel):
    limit: int = Field(default=5, ge=1, le=20)
    deadline_ms: int = Field(default=_MAX_WALL_MS, alias="deadlineMs", ge=5_000, le=_MAX_WALL_MS)
    run_id: str | None = Field(default=None, alias="runId")
    organization_id: str | None = Field(default=None, alias="organizationId")
    pool: str | None = None

    model_config = {"populate_by_name": True}


async def _patch(client: httpx.AsyncClient, base: str, internal: str, run_id: str, body: dict[str, Any]) -> None:
    r = await client.patch(
        f"{base}/api/internal/managed-runs/{run_id}",
        headers={"Authorization": f"Bearer {internal}", "Content-Type": "application/json"},
        json=body,
        timeout=120.0,
    )
    if not r.is_success:
        raise RuntimeError(f"PATCH managed {run_id} {r.status_code}: {r.text[:800]}")


async def _get_json(client: httpx.AsyncClient, base: str, internal: str, path: str) -> Any:
    r = await client.get(
        f"{base}{path}",
        headers={"Authorization": f"Bearer {internal}", "Accept": "application/json"},
        timeout=60.0,
    )
    if not r.is_success:
        raise RuntimeError(f"GET {path} {r.status_code}: {r.text[:500]}")
    return r.json()


async def _fetch_pending_ids(
    client: httpx.AsyncClient,
    base: str,
    internal: str,
    limit: int,
    *,
    organization_id: str | None = None,
    pool: str | None = None,
) -> list[str]:
    params = [f"limit={limit}"]
    if organization_id:
        params.append(f"organizationId={organization_id}")
    elif pool == "shared":
        params.append("pool=shared")
    path = f"/api/internal/managed-runs?{'&'.join(params)}"
    data = await _get_json(client, base, internal, path)
    runs = data.get("runs") or []
    if not isinstance(runs, list):
        return []
    return [str(r["id"]) for r in runs if isinstance(r, dict) and r.get("id")]


def _merge_env(
    base: dict[str, str],
    a: dict[str, str] | None,
    b: dict[str, str] | None,
) -> dict[str, str]:
    out = dict(base)
    for m in (a, b):
        if not m:
            continue
        for k, v in m.items():
            if v:
                out[str(k)] = str(v)
    return out


async def _append_log(
    client: httpx.AsyncClient,
    base: str,
    internal: str,
    run_id: str,
    stream: str,
    line: str,
) -> None:
    msg = _sanitize(f"[{stream}] {line}", 4000)
    level = "warn" if stream == "stderr" else "info"
    body: dict[str, Any] = {"status": "running", "appendLog": {"level": level, "message": msg}}

    phase_match = _PHASE_MARKER.search(line)
    if phase_match:
        phase = phase_match.group(1).lower()
        progress = _PHASE_PROGRESS.get(phase, 50)
        body["telemetrySummary"] = {"currentPhase": phase, "progress": progress}
        body["appendTelemetrySample"] = {"phase": phase, "progress": progress}
    else:
        resource_match = _RESOURCE_MARKER.search(line)
        if resource_match:
            resource = resource_match.group(1)
            rows = int(resource_match.group(2).replace(",", ""))
            bytes_val = int(resource_match.group(3).replace(",", "")) if resource_match.group(3) else None
            summary: dict[str, Any] = {"currentResource": resource, "rowsLoaded": rows}
            sample: dict[str, Any] = {"resource": resource, "rows": rows}
            if bytes_val is not None:
                summary["bytesLoaded"] = bytes_val
                sample["bytes"] = bytes_val
            body["telemetrySummary"] = summary
            body["appendTelemetrySample"] = sample
        else:
            rows_loaded = _ROWS_LOADED.search(line)
            if rows_loaded:
                rows = int(rows_loaded.group(1).replace(",", ""))
                body["telemetrySummary"] = {"rowsLoaded": rows}
                body["appendTelemetrySample"] = {"rows": rows}
            else:
                rows_so_far = _ROWS_SO_FAR.search(line)
                if rows_so_far:
                    rows = int(rows_so_far.group(1).replace(",", ""))
                    body["telemetrySummary"] = {"rowsLoaded": rows}
                    body["appendTelemetrySample"] = {"rows": rows}
                else:
                    bytes_loaded = _BYTES_LOADED.search(line)
                    if bytes_loaded:
                        nbytes = int(bytes_loaded.group(1).replace(",", ""))
                        body["telemetrySummary"] = {"bytesLoaded": nbytes}
                        body["appendTelemetrySample"] = {"bytes": nbytes}

    await _patch(client, base, internal, run_id, body)


async def _pump_stream(
    stream: asyncio.StreamReader,
    label: str,
    client: httpx.AsyncClient,
    base: str,
    internal: str,
    run_id: str,
) -> None:
    buf = ""

    async def flush_lines(force: bool) -> None:
        nonlocal buf
        if not buf:
            return
        if not force and len(buf) < _LOG_CHUNK:
            return
        chunk = buf[:_LOG_CHUNK]
        buf = buf[len(chunk) :]
        lines = chunk.splitlines()
        if lines and chunk[-1:] not in "\n\r":
            tail = lines.pop()
        else:
            tail = ""
        for line in lines:
            if line.strip():
                await _append_log(client, base, internal, run_id, label, line)
        buf = tail + buf

    while True:
        line_b = await stream.readline()
        if not line_b:
            break
        buf += line_b.decode("utf-8", errors="replace")
        await flush_lines(False)
    await flush_lines(True)
    if buf.strip():
        await _append_log(client, base, internal, run_id, label, buf.strip())


from agent_system_metrics import sample_system_metrics_loop
from dbt_executor import execute_standalone_dbt


async def _execute_one_run(
    client: httpx.AsyncClient,
    base: str,
    internal: str,
    run_id: str,
    run_timeout_ms: int,
) -> str:
    """Returns 'ran' or 'skipped'."""
    claim = await client.patch(
        f"{base}/api/internal/managed-runs/{run_id}",
        headers={"Authorization": f"Bearer {internal}", "Content-Type": "application/json"},
        json={"status": "running"},
        timeout=60.0,
    )
    if claim.status_code == 409:
        return "skipped"
    if not claim.is_success:
        raise RuntimeError(f"claim {run_id} {claim.status_code}: {claim.text[:800]}")

    ctx = await _get_json(
        client,
        base,
        internal,
        f"/api/internal/managed-runs/{run_id}/executor-context",
    )
    run = ctx.get("run") or {}
    pipeline = ctx.get("pipeline") or {}
    connections = ctx.get("connections") or {}
    dbt_project = ctx.get("dbtProject")
    tool_raw = str(pipeline.get("tool") or "").lower()
    tool = "dbt" if tool_raw == "dbt" else ("sling" if tool_raw == "sling" else "dlt")

    if tool == "dbt":
        dst = connections.get("destination") or {}
        secrets_d = dst.get("secrets") if isinstance(dst, dict) else None
        child_env = _merge_env(
            {k: str(v) for k, v in os.environ.items() if v is not None and isinstance(v, str)},
            secrets_d if isinstance(secrets_d, dict) else None,
            None,
        )
        child_env["ELTPULSE_RUN_ID"] = run_id
        child_env["ELTPULSE_CONTROL_PLANE_URL"] = base
        if internal:
            child_env["ELTPULSE_INTERNAL_API_SECRET"] = internal

        async def _dbt_patch(body: dict[str, Any]) -> None:
            await _patch(client, base, internal, run_id, body)

        async def _pump_out(line: str) -> None:
            await _append_log(client, base, internal, run_id, "stdout", line)

        async def _pump_err(line: str) -> None:
            await _append_log(client, base, internal, run_id, "stderr", line)

        pname = str(pipeline.get("name") or run_id)
        await _patch(
            client,
            base,
            internal,
            run_id,
            {
                "status": "running",
                "appendLog": {
                    "level": "info",
                    "message": _sanitize(
                        f"eltpulse-managed: starting standalone dbt for project {pname!r}",
                        4000,
                    ),
                },
            },
        )
        try:
            exit_code = await asyncio.wait_for(
                execute_standalone_dbt(
                    pipeline=pipeline,
                    dbt_project=dbt_project if isinstance(dbt_project, dict) else None,
                    destination=dst if isinstance(dst, dict) else None,
                    triggered_by=str(run.get("triggeredBy") or ""),
                    child_env=child_env,
                    patch=_dbt_patch,
                    pump_stdout=_pump_out,
                    pump_stderr=_pump_err,
                ),
                timeout=max(1.0, run_timeout_ms / 1000.0),
            )
        except asyncio.TimeoutError:
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "failed",
                    "errorSummary": _sanitize("dbt subprocess timed out.", 8000),
                    "telemetrySummary": {"currentPhase": "failed", "progress": 100},
                },
            )
            return "ran"
        except Exception as e:  # noqa: BLE001
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "failed",
                    "errorSummary": _sanitize(str(e), 8000),
                    "telemetrySummary": {"currentPhase": "failed", "progress": 100},
                },
            )
            return "ran"

        if exit_code == 0:
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "succeeded",
                    "appendLog": {
                        "level": "info",
                        "message": _sanitize("eltpulse-managed: dbt completed (exit 0).", 4000),
                    },
                    "telemetrySummary": {"currentPhase": "done", "progress": 100},
                },
            )
        else:
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "failed",
                    "errorSummary": _sanitize(f"dbt exited with code {exit_code}", 8000),
                    "telemetrySummary": {"currentPhase": "failed", "progress": 100},
                },
            )
        return "ran"

    if tool == "sling" and not shutil.which(os.environ.get("ELTPULSE_MANAGED_SLING_BIN", "sling")):
        await _patch(
            client,
            base,
            internal,
            run_id,
            {
                "status": "failed",
                "errorSummary": _sanitize(
                    "Database replication is not available on this managed worker. "
                    "Use connector sync pipelines, or run database replication on a VM / second deployment (executor #2).",
                    8000,
                ),
                "appendLog": {
                    "level": "error",
                    "message": _sanitize("managed-worker: database replication runner not found.", 4000),
                },
                "telemetrySummary": {"currentPhase": "failed", "progress": 100},
            },
        )
        return "ran"

    tmp = tempfile.mkdtemp(prefix="eltpulse-managed-")
    try:
        code = str(pipeline.get("pipelineCode") or "")
        if tool == "dlt" and not code.strip():
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "failed",
                    "errorSummary": _sanitize(
                        "Pipeline has no generated code. Re-save the pipeline in the builder.",
                        8000,
                    ),
                    "telemetrySummary": {"currentPhase": "failed", "progress": 100},
                },
            )
            return "ran"

        tdir = Path(tmp)
        if tool == "sling":
            (tdir / "replication.yaml").write_text(code, encoding="utf-8")
        else:
            code, verified_modules = _prepare_dlt_pipeline_code(code)
            for module in verified_modules:
                _stage_verified_source(tdir, module)
            if verified_modules:
                _install_verified_source_requirements(tdir)
            (tdir / "pipeline.py").write_text(code, encoding="utf-8")
        cy = pipeline.get("configYaml")
        if isinstance(cy, str) and cy.strip():
            (tdir / "config.yaml").write_text(cy, encoding="utf-8")
        wy = pipeline.get("workspaceYaml")
        if isinstance(wy, str) and wy.strip():
            (tdir / "workspace.yaml").write_text(wy, encoding="utf-8")

        pname = str(pipeline.get("name") or run_id)
        await _patch(
            client,
            base,
            internal,
            run_id,
            {
                "status": "running",
                "appendLog": {
                    "level": "info",
                    "message": _sanitize(
                        f"eltpulse-managed (vercel-python): starting {_tool_run_label(tool)} in {tmp} (pipeline {pname!r})",
                        4000,
                    ),
                },
            },
        )

        src = connections.get("source") or {}
        dst = connections.get("destination") or {}
        secrets_s = src.get("secrets") if isinstance(src, dict) else None
        secrets_d = dst.get("secrets") if isinstance(dst, dict) else None
        child_env = _inject_dlt_secret_aliases(
            _merge_env(
            {k: str(v) for k, v in os.environ.items() if v is not None and isinstance(v, str)},
            secrets_s if isinstance(secrets_s, dict) else None,
            secrets_d if isinstance(secrets_d, dict) else None,
            )
        )
        child_env["ELTPULSE_RUN_ID"] = run_id
        child_env["ELTPULSE_CONTROL_PLANE_URL"] = base
        if internal:
            child_env["ELTPULSE_INTERNAL_API_SECRET"] = internal

        if tool == "sling":
            sling_bin = os.environ.get("ELTPULSE_MANAGED_SLING_BIN", "sling").strip() or "sling"
            cmd = [sling_bin, "run", "-r", "replication.yaml"]
        else:
            pv = run.get("partitionValue")
            pv_s = str(pv).strip() if pv else ""
            cmd = [sys.executable, "pipeline.py"]
            if pv_s:
                cmd.append(pv_s)

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=tmp,
            env=child_env,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )

        async def kill_after_delay() -> None:
            await asyncio.sleep(max(1.0, run_timeout_ms / 1000.0))
            if proc.returncode is None:
                proc.kill()

        killer = asyncio.create_task(kill_after_delay())
        metrics_stop = asyncio.Event()

        async def _metrics_patch(body: dict[str, Any]) -> None:
            await _patch(client, base, internal, run_id, body)

        metrics_task = asyncio.create_task(
            sample_system_metrics_loop(_metrics_patch, metrics_stop, pid=proc.pid)
        )
        assert proc.stdout and proc.stderr
        try:
            await asyncio.wait_for(
                asyncio.gather(
                    _pump_stream(proc.stdout, "stdout", client, base, internal, run_id),
                    _pump_stream(proc.stderr, "stderr", client, base, internal, run_id),
                    proc.wait(),
                ),
                timeout=max(1.0, run_timeout_ms / 1000.0) + 30.0,
            )
        except asyncio.TimeoutError:
            metrics_stop.set()
            metrics_task.cancel()
            if proc.returncode is None:
                proc.kill()
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "failed",
                    "errorSummary": _sanitize("Pipeline subprocess timed out.", 8000),
                    "telemetrySummary": {"currentPhase": "failed", "progress": 100},
                },
            )
            return "ran"
        finally:
            metrics_stop.set()
            metrics_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await metrics_task
            killer.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await killer

        code_out = proc.returncode if proc.returncode is not None else 1
        if code_out == 0:
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "succeeded",
                    "appendLog": {
                        "level": "info",
                        "message": _sanitize(
                            "eltpulse-managed (vercel-python): pipeline completed (exit 0).",
                            4000,
                        ),
                    },
                    "telemetrySummary": {"currentPhase": "done", "progress": 100},
                },
            )
        else:
            await _patch(
                client,
                base,
                internal,
                run_id,
                {
                    "status": "failed",
                    "errorSummary": _sanitize(f"Process exited with code {code_out}", 8000),
                    "appendLog": {
                        "level": "error",
                        "message": _sanitize(
                            f"eltpulse-managed (vercel-python): pipeline exited with code {code_out}",
                            4000,
                        ),
                    },
                    "telemetrySummary": {"currentPhase": "failed", "progress": 100},
                },
            )
        return "ran"
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


@app.get("/health")
async def health() -> dict[str, Any]:
    return {"ok": True, "service": "eltpulse-managed-worker", "python": sys.version}


async def run_managed_batch(
    limit: int,
    deadline_ms: int,
    run_id: str | None = None,
    *,
    organization_id: str | None = None,
    pool: str | None = None,
) -> dict[str, Any]:
    """Core batch loop (CLI, GitHub Actions, or HTTP after auth)."""
    internal = (os.environ.get("ELTPULSE_INTERNAL_API_SECRET") or "").strip()
    if not internal:
        raise RuntimeError("ELTPULSE_INTERNAL_API_SECRET is not set")

    base = _control_plane_base()
    wall_deadline = time.monotonic() + min(deadline_ms, _MAX_WALL_MS) / 1000.0
    raw_to = (os.environ.get("ELTPULSE_MANAGED_RUN_TIMEOUT_MS") or "").strip()
    try:
        per_run_timeout = int(raw_to) if raw_to else _MAX_WALL_MS
    except ValueError:
        per_run_timeout = _MAX_WALL_MS
    per_run_timeout = max(60_000, min(per_run_timeout, _MAX_WALL_MS))

    processed = 0
    errors: list[str] = []

    specific = (run_id or os.environ.get("ELTPULSE_MANAGED_RUN_ID") or "").strip()

    async with httpx.AsyncClient() as client:
        if specific:
            ids = [specific]
        else:
            ids = await _fetch_pending_ids(
                client, base, internal, limit, organization_id=organization_id, pool=pool
            )
        for run_id in ids:
            if time.monotonic() >= wall_deadline:
                break
            try:
                outcome = await _execute_one_run(
                    client, base, internal, run_id, per_run_timeout
                )
                if outcome == "ran":
                    processed += 1
            except Exception as e:  # noqa: BLE001
                msg = str(e)
                errors.append(f"{run_id}: {msg}")
                try:
                    await _patch(
                        client,
                        base,
                        internal,
                        run_id,
                        {
                            "status": "failed",
                            "errorSummary": _sanitize(msg, 8000),
                        },
                    )
                except Exception:
                    pass

    return {"ok": True, "processed": processed, "errors": errors, "baseUrl": base}


@app.post("/batch")
async def batch(request: Request, body: BatchBody | None = None) -> dict[str, Any]:
    _require_trigger(request)
    b = body or BatchBody()
    try:
        return await run_managed_batch(
            b.limit,
            b.deadline_ms,
            b.run_id,
            organization_id=b.organization_id,
            pool=b.pool,
        )
    except RuntimeError as e:
        raise HTTPException(status_code=500, detail=str(e)) from e


if __name__ == "__main__":
    lim = int(os.environ.get("ELTPULSE_MANAGED_LIMIT", "5"))
    dlm = int(os.environ.get("ELTPULSE_MANAGED_DEADLINE_MS", str(_MAX_WALL_MS)))
    out = asyncio.run(run_managed_batch(lim, dlm))
    print(json.dumps(out, indent=2))
