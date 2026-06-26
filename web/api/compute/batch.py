"""eltPulse managed compute — Vercel Python serverless (co-located with Next.js).

Public URL: POST /eltpulse-compute/batch (see web/vercel.json rewrite).
Auth: Authorization: Bearer ${ELTPULSE_INTERNAL_API_SECRET} or ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from pathlib import Path

# Import worker implementation from managed-worker-service/
_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(_ROOT / "managed-worker-service"))

from main import run_managed_batch  # noqa: E402


def _authorized(auth_header: str) -> bool:
    expected = (
        (os.environ.get("ELTPULSE_MANAGED_VERCEL_PYTHON_SECRET") or "").strip()
        or (os.environ.get("ELTPULSE_INTERNAL_API_SECRET") or "").strip()
    )
    if not expected:
        return False
    return auth_header == f"Bearer {expected}"


class handler(BaseHTTPRequestHandler):  # noqa: N801 — Vercel Python entrypoint
    def do_POST(self) -> None:  # noqa: N802
        if not _authorized(self.headers.get("Authorization", "")):
            self.send_response(401)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(b'{"error":"Unauthorized"}')
            return

        length = int(self.headers.get("Content-Length", 0) or 0)
        raw = self.rfile.read(length) if length else b"{}"
        try:
            body = json.loads(raw.decode("utf-8") or "{}")
        except json.JSONDecodeError:
            body = {}

        limit = int(body.get("limit", 5))
        deadline_ms = int(body.get("deadlineMs", body.get("deadline_ms", 900_000)))
        run_id = body.get("runId") or body.get("run_id")
        organization_id = body.get("organizationId") or body.get("organization_id")
        pool = body.get("pool")

        try:
            result = asyncio.run(
                run_managed_batch(
                    limit,
                    deadline_ms,
                    str(run_id).strip() if run_id else None,
                    organization_id=str(organization_id).strip() if organization_id else None,
                    pool=str(pool).strip() if pool else None,
                )
            )
            payload = json.dumps(result).encode("utf-8")
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(payload)
        except Exception as exc:  # noqa: BLE001
            msg = str(exc)[:800]
            payload = json.dumps({"ok": False, "error": msg}).encode("utf-8")
            self.send_response(500)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(payload)

    def do_GET(self) -> None:  # noqa: N802
        if self.path.rstrip("/").endswith("health"):
            self.send_response(200)
            self.send_header("Content-type", "application/json")
            self.end_headers()
            self.wfile.write(
                b'{"ok":true,"service":"eltpulse-managed-compute","runtime":"vercel-python"}'
            )
            return
        self.send_response(405)
        self.end_headers()
