"""Scan vendored verified sources for nested dlt.sources.incremental (one-off audit).

Sources whose @dlt.source factories lack start_date/since/until/since_timestamp/initial_start_date
but expose per-resource incremental cursors belong in web/lib/elt/verified-incremental-env.ts.

Run: python web/managed-worker-service/scripts/scan-incremental-env.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "verified_sources"
PARTITION_KWARGS = {
    "start_date",
    "end_date",
    "since",
    "until",
    "since_timestamp",
    "initial_start_date",
}

# Keep in sync with verified-incremental-env.ts (sources using env bounds, not partitionKwarg).
EXPECTED_ENV_SLUGS = frozenset(
    {"personio", "salesforce", "asana_dlt", "matomo", "facebook_ads"}
)

# Golden / replace-only — nested incremental exists but slice path is custom or N/A.
SCAN_IGNORE_SLUGS = frozenset({"github", "inbox"})


def _read_package_texts(slug_dir: Path) -> str:
    parts: list[str] = []
    for py in sorted(slug_dir.rglob("*.py")):
        parts.append(py.read_text(encoding="utf-8", errors="replace"))
    return "\n".join(parts)


def factory_has_partition_kwargs(text: str) -> bool:
    pattern = re.compile(
        r"@dlt\.source(?:\([^)]*\))?\s*\ndef\s+\w+\s*\((?P<params>.*?)\)\s*->",
        re.S,
    )
    for m in pattern.finditer(text):
        params = m.group("params")
        names = set(re.findall(r"\b(\w+)\s*:", params))
        if names & PARTITION_KWARGS:
            return True
    return False


def find_nested_incrementals(text: str) -> list[tuple[str, str]]:
    """Return (resource_name, cursor_field) pairs."""
    out: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()

    inc_pattern = re.compile(
        r"dlt\.sources\.incremental(?:\[[^\]]*\])?\(\s*['\"]([^'\"]+)['\"]",
        re.S,
    )

    def add(res_name: str, field: str) -> None:
        if field in {"message_uid"}:
            return
        key = (res_name, field)
        if key not in seen:
            seen.add(key)
            out.append(key)

    for m in re.finditer(
        r"@(dlt\.resource|dlt\.transformer)\([^)]*\)\s*\n\s*def\s+(\w+)\s*\(",
        text,
    ):
        kind, fn = m.group(1), m.group(2)
        dec = m.group(0)
        chunk = text[m.end() : m.end() + 900]
        inc = inc_pattern.search(chunk)
        if not inc:
            continue
        name_m = re.search(r"name\s*=\s*['\"]([^'\"]+)['\"]", dec)
        res_name = name_m.group(1) if name_m else fn
        add(res_name, inc.group(1))

    for m in re.finditer(
        r"dlt\.resource\(\s*\w+[^)]*name\s*=\s*['\"]([^'\"]+)['\"][^)]*\)[^(]*\([^)]*"
        r"dlt\.sources\.incremental(?:\[[^\]]*\])?\(\s*['\"]([^'\"]+)['\"]",
        text,
        re.S,
    ):
        add(m.group(1), m.group(2))

    for m in re.finditer(
        r"(\w+)\s*=\s*dlt\.sources\.incremental(?:\[[^\]]*\])?\(\s*['\"]([^'\"]+)['\"]",
        text,
    ):
        kwarg, field = m.group(1), m.group(2)
        ctx = text[max(0, m.start() - 800) : m.start()]
        name_m = re.search(r"name\s*=\s*['\"]([^'\"]+)['\"]", ctx)
        if name_m:
            add(name_m.group(1), field)
        elif kwarg == "last_date" and "get_last_visits" in ctx:
            add("visits", field)

    return out


def scan_slug(slug: str) -> dict:
    slug_dir = ROOT / slug
    if not slug_dir.is_dir():
        return {"slug": slug, "missing": True}
    text = _read_package_texts(slug_dir)
    incrementals = find_nested_incrementals(text)
    has_pk = factory_has_partition_kwargs(text)
    needs_env = bool(incrementals) and not has_pk
    return {
        "slug": slug,
        "incrementals": incrementals,
        "has_factory_partition_kwargs": has_pk,
        "needs_env": needs_env,
    }


def main() -> None:
    slugs = sorted(p.name for p in ROOT.iterdir() if p.is_dir())
    needs_env: list[str] = []
    print("=== NEEDS VERIFIED_INCREMENTAL_ENV ===")
    for slug in slugs:
        if slug in SCAN_IGNORE_SLUGS:
            continue
        info = scan_slug(slug)
        if info.get("missing"):
            continue
        if info["needs_env"]:
            needs_env.append(slug)
            print(f"\n{slug}:")
            for res, field in info["incrementals"]:
                print(f"  resource={res} cursor={field}")

    print("\n=== SUMMARY ===")
    print(f"needs_env slugs: {sorted(needs_env)}")
    print(f"expected in TS:  {sorted(EXPECTED_ENV_SLUGS)}")

    missing = EXPECTED_ENV_SLUGS - set(needs_env)
    extra = set(needs_env) - EXPECTED_ENV_SLUGS - SCAN_IGNORE_SLUGS
    if missing:
        print(f"ERROR: expected but not detected by scan: {sorted(missing)}", file=sys.stderr)
    if extra:
        print(f"ERROR: detected but not in EXPECTED_ENV_SLUGS: {sorted(extra)}", file=sys.stderr)
    if missing or extra:
        sys.exit(1)
    print("scan OK — matches verified-incremental-env.ts")


if __name__ == "__main__":
    main()
