"""
Export embedded_elt_builder.web.credentials_config to JSON for the Next.js UI.

Run from repo root:
  python scripts/export-credentials-catalog.py

Catalog is generated from this repo’s embedded_elt_builder package.
"""

from __future__ import annotations

import importlib.util
import json
import pathlib


def main() -> None:
    root = pathlib.Path(__file__).resolve().parents[1]
    mod_path = root / "embedded_elt_builder" / "web" / "credentials_config.py"
    spec = importlib.util.spec_from_file_location("credentials_config", mod_path)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)

    out = {
        "sourceCredentials": mod.SOURCE_CREDENTIALS,
        "destinationCredentials": mod.DESTINATION_CREDENTIALS,
        "sourceConfigurations": mod.SOURCE_CONFIGURATIONS,
    }
    dest = root / "web" / "lib" / "elt" / "credentials-catalog.json"
    dest.write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {dest}")


if __name__ == "__main__":
    main()
