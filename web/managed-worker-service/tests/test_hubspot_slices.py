"""Unit tests for HubSpot run-slice helpers (CRM search day windows)."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "verified_sources"))

from hubspot.helpers import _iso_to_hubspot_ms, fetch_data_search  # noqa: E402


class TestHubspotSliceHelpers(unittest.TestCase):
    def test_iso_to_hubspot_ms_day_start(self) -> None:
        ms = _iso_to_hubspot_ms("2024-06-01")
        self.assertTrue(ms.isdigit())
        self.assertEqual(ms, _iso_to_hubspot_ms("2024-06-01T00:00:00Z"))

    def test_fetch_data_search_builds_modified_filters(self) -> None:
        posted: list[dict] = []

        def fake_post(url, headers=None, json=None):
            posted.append(json or {})
            resp = MagicMock()
            resp.json.return_value = {"results": [], "paging": {}}
            resp.raise_for_status = MagicMock()
            return resp

        with patch("hubspot.helpers.requests.post", side_effect=fake_post):
            list(
                fetch_data_search(
                    "contact",
                    "test-token",
                    ["email", "hs_lastmodifieddate"],
                    since="2024-06-01",
                    until="2024-06-02",
                )
            )

        self.assertEqual(len(posted), 1)
        filters = posted[0]["filterGroups"][0]["filters"]
        self.assertEqual(len(filters), 2)
        self.assertEqual(filters[0]["propertyName"], "hs_lastmodifieddate")
        self.assertEqual(filters[0]["operator"], "GTE")
        self.assertEqual(filters[1]["operator"], "LT")


if __name__ == "__main__":
    unittest.main()
