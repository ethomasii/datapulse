"""Optional psutil-based CPU/RAM sampling for eltPulse run telemetry."""

from __future__ import annotations

import asyncio
import os
from typing import Any, Callable, Awaitable

PatchFn = Callable[[dict[str, Any]], Awaitable[None]]


def system_metrics_enabled() -> bool:
    raw = (os.environ.get("ELTPULSE_SYSTEM_METRICS") or "").strip().lower()
    if raw in ("0", "false", "no"):
        return False
    return True


def system_metrics_interval_sec() -> float:
    raw = (os.environ.get("ELTPULSE_SYSTEM_METRICS_INTERVAL_MS") or "").strip()
    try:
        ms = int(raw)
        if ms >= 5000:
            return min(ms, 120_000) / 1000.0
    except ValueError:
        pass
    return 20.0


def read_system_metrics(pid: int | None = None) -> dict[str, float] | None:
    """Read CPU % and RSS MB for a process (defaults to current worker)."""
    try:
        import psutil  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        proc = psutil.Process(pid) if pid is not None else psutil.Process()
        mem_mb = round(proc.memory_info().rss / (1024 * 1024), 1)
        cpu = round(proc.cpu_percent(interval=0.1), 1)
        out: dict[str, float] = {"memoryMb": mem_mb}
        if cpu >= 0:
            out["cpuPercent"] = cpu
        return out
    except Exception:
        return None


def telemetry_patch_with_system(system: dict[str, float] | None) -> dict[str, Any]:
    if not system:
        return {}
    return {
        "telemetrySummary": {"system": system},
        "appendTelemetrySample": {"system": system},
    }


async def sample_system_metrics_loop(
    patch: PatchFn,
    stop: asyncio.Event,
    *,
    pid: int | None = None,
) -> None:
    """Background task: PATCH system metrics every N seconds until stop is set."""
    if not system_metrics_enabled():
        return
    interval = system_metrics_interval_sec()
    while not stop.is_set():
        system = read_system_metrics(pid)
        if system:
            try:
                body: dict[str, Any] = {"status": "running", **telemetry_patch_with_system(system)}
                await patch(body)
            except Exception:
                pass
        try:
            await asyncio.wait_for(stop.wait(), timeout=interval)
        except asyncio.TimeoutError:
            continue
