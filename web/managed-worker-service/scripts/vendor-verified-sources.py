#!/usr/bin/env python3
"""Vendor dlt verified sources into verified_sources/ for fast managed-worker cold starts.

Usage (from repo root):
  python web/managed-worker-service/scripts/vendor-verified-sources.py
  python web/managed-worker-service/scripts/vendor-verified-sources.py stripe_analytics hubspot
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

DEFAULT_SOURCES = ("github", "stripe_analytics")

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / "verified_sources"
REQ_FILE = ROOT / "verified-sources-requirements.txt"


def _vendor_one(slug: str, *, force: bool) -> None:
    dest = OUT_DIR / slug
    if dest.is_dir() and not force:
        print(f"skip {slug} (already vendored at {dest})")
        return

    with tempfile.TemporaryDirectory(prefix=f"eltpulse-vendor-{slug}-") as tmp:
        tdir = Path(tmp)
        proc = subprocess.run(
            [sys.executable, "-m", "dlt", "init", slug, "duckdb"],
            cwd=tdir,
            capture_output=True,
            text=True,
        )
        if proc.returncode != 0:
            detail = (proc.stderr or proc.stdout or "").strip()
            raise SystemExit(f"dlt init {slug} failed:\n{detail}")

        src = tdir / slug
        if not src.is_dir():
            raise SystemExit(f"dlt init {slug} did not create {slug}/ package")

        if dest.is_dir():
            shutil.rmtree(dest)
        OUT_DIR.mkdir(parents=True, exist_ok=True)
        shutil.copytree(src, dest)
        print(f"vendored {slug} -> {dest}")

        req = tdir / "requirements.txt"
        if req.is_file():
            _merge_requirements(req.read_text(encoding="utf-8"))


def _merge_requirements(text: str) -> None:
    existing = REQ_FILE.read_text(encoding="utf-8").splitlines() if REQ_FILE.is_file() else []
    seen = {line.strip() for line in existing if line.strip() and not line.strip().startswith("#")}
    added: list[str] = []
    for line in text.splitlines():
        s = line.strip()
        if not s or s.startswith("#"):
            continue
        # dlt[duckdb] is covered by worker pyproject dlt[motherduck]
        if s.startswith("dlt["):
            continue
        if s not in seen:
            seen.add(s)
            added.append(s)
    if not added and REQ_FILE.is_file():
        return
    merged = sorted(seen)
    header = [
        "# Extra pip deps for vendored dlt verified sources (managed worker / GHA).",
        "# Regenerate: python web/managed-worker-service/scripts/vendor-verified-sources.py",
        "",
    ]
    REQ_FILE.write_text("\n".join(header + merged) + "\n", encoding="utf-8")
    print(f"updated {REQ_FILE.name} (+{len(added)} new)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "sources",
        nargs="*",
        default=list(DEFAULT_SOURCES),
        help=f"dlt init slugs (default: {', '.join(DEFAULT_SOURCES)})",
    )
    parser.add_argument("--force", action="store_true", help="Re-download even if vendored")
    args = parser.parse_args()
    for slug in args.sources:
        _vendor_one(slug, force=args.force)
    print("done")


if __name__ == "__main__":
    main()
