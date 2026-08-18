"""Tests for search/list-index.py — filtering, field selection, and edge cases."""

import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path

_ROOT = Path(__file__).parent.parent


def _load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


li = _load_module("list_index", _ROOT / "search" / "list-index.py")


def _write_entry(directory: Path, entry: dict) -> None:
    eid = entry["id"]
    (directory / f"{eid}.index.json").write_text(
        json.dumps(entry), encoding="utf-8"
    )


_ENTRY_A = {
    "id": "aaa",
    "title": "AI Pipeline Overview",
    "summary": "Describes the AI data pipeline used in production.",
    "tags": ["ai", "etl"],
    "source": "https://example.com/a",
    "date": "2026-04-01",
    "knowledge_file": "knowledge/aaa.md",
}
_ENTRY_B = {
    "id": "bbb",
    "title": "ETL Architecture",
    "summary": "How ETL jobs are structured and scheduled.",
    "tags": ["etl"],
    "source": "https://example.com/b",
    "date": "2026-03-15",
    "knowledge_file": "knowledge/bbb.md",
}
_ENTRY_C = {
    "id": "ccc",
    "title": "Security Policies",
    "summary": "Access control and secret management.",
    "tags": ["security"],
    "source": "https://example.com/c",
    "date": "2026-02-20",
    "knowledge_file": "knowledge/ccc.md",
}


# ---------------------------------------------------------------------------
# load_entries
# ---------------------------------------------------------------------------

class TestLoadEntries(unittest.TestCase):

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = li.load_entries(Path(tmp))
            self.assertEqual(result, [])

    def test_nonexistent_dir(self):
        result = li.load_entries(Path("/nonexistent/path/xyz"))
        self.assertEqual(result, [])

    def test_loads_valid_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            _write_entry(d, _ENTRY_A)
            _write_entry(d, _ENTRY_B)
            result = li.load_entries(d)
            self.assertEqual(len(result), 2)

    def test_skips_malformed_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            _write_entry(d, _ENTRY_A)
            (d / "bad.index.json").write_text("not json", encoding="utf-8")
            result = li.load_entries(d)
            self.assertEqual(len(result), 1)

    def test_ignores_non_index_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            _write_entry(d, _ENTRY_A)
            (d / "all.json").write_text(json.dumps({"entries": []}), encoding="utf-8")
            result = li.load_entries(d)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["id"], "aaa")


# ---------------------------------------------------------------------------
# filter_tags
# ---------------------------------------------------------------------------

class TestFilterTags(unittest.TestCase):

    def setUp(self):
        self.entries = [_ENTRY_A, _ENTRY_B, _ENTRY_C]

    def test_single_tag_match(self):
        result = li.filter_tags(self.entries, ["etl"])
        ids = [e["id"] for e in result]
        self.assertIn("aaa", ids)
        self.assertIn("bbb", ids)
        self.assertNotIn("ccc", ids)

    def test_and_logic_both_tags(self):
        result = li.filter_tags(self.entries, ["ai", "etl"])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "aaa")

    def test_no_match(self):
        result = li.filter_tags(self.entries, ["nonexistent"])
        self.assertEqual(result, [])

    def test_empty_tags_list(self):
        result = li.filter_tags(self.entries, [])
        self.assertEqual(len(result), 3)

    def test_case_insensitive(self):
        result = li.filter_tags(self.entries, ["AI"])
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "aaa")

    def test_entry_missing_tags_field(self):
        entry = {"id": "zzz", "title": "No tags"}
        result = li.filter_tags([entry], ["ai"])
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# filter_search
# ---------------------------------------------------------------------------

class TestFilterSearch(unittest.TestCase):

    def setUp(self):
        self.entries = [_ENTRY_A, _ENTRY_B, _ENTRY_C]

    def test_matches_title(self):
        result = li.filter_search(self.entries, "AI Pipeline")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "aaa")

    def test_matches_summary(self):
        result = li.filter_search(self.entries, "secret management")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "ccc")

    def test_case_insensitive(self):
        result = li.filter_search(self.entries, "etl architecture")
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0]["id"], "bbb")

    def test_no_match(self):
        result = li.filter_search(self.entries, "kubernetes")
        self.assertEqual(result, [])

    def test_empty_query_matches_all(self):
        result = li.filter_search(self.entries, "")
        self.assertEqual(len(result), 3)

    def test_missing_title_and_summary(self):
        entry = {"id": "zzz"}
        result = li.filter_search([entry], "anything")
        self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# select_fields
# ---------------------------------------------------------------------------

class TestSelectFields(unittest.TestCase):

    def test_keeps_requested_fields(self):
        result = li.select_fields([_ENTRY_A], ["id", "title"])
        self.assertEqual(result, [{"id": "aaa", "title": "AI Pipeline Overview"}])

    def test_drops_unrequested_fields(self):
        result = li.select_fields([_ENTRY_A], ["id"])
        self.assertNotIn("title", result[0])
        self.assertNotIn("tags", result[0])

    def test_missing_field_omitted(self):
        entry = {"id": "zzz", "title": "Partial"}
        result = li.select_fields([entry], ["id", "title", "summary"])
        self.assertIn("id", result[0])
        self.assertIn("title", result[0])
        self.assertNotIn("summary", result[0])

    def test_all_fields_missing(self):
        entry = {"id": "zzz"}
        result = li.select_fields([entry], ["title", "summary"])
        self.assertEqual(result, [{}])

    def test_multiple_entries(self):
        result = li.select_fields([_ENTRY_A, _ENTRY_B], ["id", "tags"])
        self.assertEqual(len(result), 2)
        self.assertIn("tags", result[0])
        self.assertIn("tags", result[1])


# ---------------------------------------------------------------------------
# Combination: tags + search + fields
# ---------------------------------------------------------------------------

class TestCombinedFilters(unittest.TestCase):

    def test_tags_then_fields(self):
        entries = [_ENTRY_A, _ENTRY_B, _ENTRY_C]
        filtered = li.filter_tags(entries, ["etl"])
        projected = li.select_fields(filtered, ["id", "title"])
        self.assertEqual(len(projected), 2)
        self.assertNotIn("summary", projected[0])

    def test_search_then_fields(self):
        entries = [_ENTRY_A, _ENTRY_B, _ENTRY_C]
        filtered = li.filter_search(entries, "pipeline")
        projected = li.select_fields(filtered, ["id"])
        self.assertEqual(projected, [{"id": "aaa"}])


if __name__ == "__main__":
    unittest.main()
