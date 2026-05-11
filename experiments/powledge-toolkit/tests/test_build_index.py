"""Tests for etl/build-index.py — aggregation, related computation, edge cases."""

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


bi = _load_module("build_index", _ROOT / "etl" / "build-index.py")


def _write_entry(directory: Path, entry: dict) -> None:
    eid = entry["id"]
    (directory / f"{eid}.index.json").write_text(
        json.dumps(entry), encoding="utf-8"
    )


_ENTRY_A = {
    "id": "aaa",
    "title": "AI Pipeline",
    "summary": "AI stuff.",
    "tags": ["ai", "etl"],
    "source": "https://example.com/a",
    "date": "2026-04-01",
    "knowledge_file": "knowledge/aaa.md",
}
_ENTRY_B = {
    "id": "bbb",
    "title": "ETL Jobs",
    "summary": "ETL scheduling.",
    "tags": ["etl", "scheduling"],
    "source": "https://example.com/b",
    "date": "2026-03-15",
    "knowledge_file": "knowledge/bbb.md",
}
_ENTRY_C = {
    "id": "ccc",
    "title": "Security Policies",
    "summary": "Access control.",
    "tags": ["security"],
    "source": "https://example.com/c",
    "date": "2026-02-20",
    "knowledge_file": "knowledge/ccc.md",
}
_ENTRY_D = {
    "id": "ddd",
    "title": "AI Security",
    "summary": "AI meets security.",
    "tags": ["ai", "security"],
    "source": "https://example.com/d",
    "date": "2026-01-10",
    "knowledge_file": "knowledge/ddd.md",
}


# ---------------------------------------------------------------------------
# load_entries
# ---------------------------------------------------------------------------

class TestLoadEntries(unittest.TestCase):

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = bi.load_entries(Path(tmp))
            self.assertEqual(result, [])

    def test_nonexistent_dir(self):
        result = bi.load_entries(Path("/nonexistent/xyz"))
        self.assertEqual(result, [])

    def test_loads_valid_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            _write_entry(d, _ENTRY_A)
            _write_entry(d, _ENTRY_B)
            result = bi.load_entries(d)
            self.assertEqual(len(result), 2)

    def test_skips_malformed_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            _write_entry(d, _ENTRY_A)
            (d / "bad.index.json").write_text("!!!bad", encoding="utf-8")
            result = bi.load_entries(d)
            self.assertEqual(len(result), 1)

    def test_ignores_all_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            _write_entry(d, _ENTRY_A)
            (d / "all.json").write_text(json.dumps({"entries": []}), encoding="utf-8")
            result = bi.load_entries(d)
            self.assertEqual(len(result), 1)


# ---------------------------------------------------------------------------
# sort_by_date
# ---------------------------------------------------------------------------

class TestSortByDate(unittest.TestCase):

    def test_sorted_descending(self):
        entries = [_ENTRY_C, _ENTRY_A, _ENTRY_B]
        result = bi.sort_by_date(entries)
        dates = [e["date"] for e in result]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_missing_date_sorts_last(self):
        no_date = {"id": "zzz", "title": "No date", "tags": []}
        result = bi.sort_by_date([_ENTRY_A, no_date, _ENTRY_B])
        self.assertEqual(result[-1]["id"], "zzz")

    def test_single_entry(self):
        result = bi.sort_by_date([_ENTRY_A])
        self.assertEqual(result[0]["id"], "aaa")


# ---------------------------------------------------------------------------
# compute_related
# ---------------------------------------------------------------------------

class TestComputeRelated(unittest.TestCase):

    def test_single_entry_has_no_related(self):
        result = bi.compute_related([_ENTRY_A])
        self.assertEqual(result[0]["related"], [])

    def test_shared_tag_creates_relation(self):
        result = bi.compute_related([_ENTRY_A, _ENTRY_B])
        a = next(e for e in result if e["id"] == "aaa")
        self.assertIn("bbb", a["related"])

    def test_no_shared_tags_no_relation(self):
        result = bi.compute_related([_ENTRY_A, _ENTRY_C])
        # aaa has [ai, etl], ccc has [security] — no overlap
        a = next(e for e in result if e["id"] == "aaa")
        self.assertNotIn("ccc", a["related"])

    def test_related_capped_at_5(self):
        extras = [
            {"id": f"x{i}", "title": f"Item {i}", "tags": ["ai"], "date": "2026-01-01"}
            for i in range(8)
        ]
        entries = [_ENTRY_A] + extras
        result = bi.compute_related(entries)
        a = next(e for e in result if e["id"] == "aaa")
        self.assertLessEqual(len(a["related"]), 5)

    def test_sorted_by_shared_tags_descending(self):
        # aaa shares [ai,etl] with bbb(etl) and ddd(ai) — both share 1 tag
        # but ddd also has security; ccc shares nothing with aaa
        result = bi.compute_related([_ENTRY_A, _ENTRY_B, _ENTRY_C, _ENTRY_D])
        a = next(e for e in result if e["id"] == "aaa")
        self.assertIn("bbb", a["related"])
        self.assertIn("ddd", a["related"])
        self.assertNotIn("ccc", a["related"])

    def test_more_shared_tags_ranks_higher(self):
        high = {"id": "high", "title": "High overlap", "tags": ["ai", "etl"], "date": "2026-01-01"}
        low = {"id": "low", "title": "Low overlap", "tags": ["etl"], "date": "2026-01-01"}
        entries = [_ENTRY_A, high, low]
        result = bi.compute_related(entries)
        a = next(e for e in result if e["id"] == "aaa")
        # "high" shares 2 tags, "low" shares 1 — high must come first
        self.assertEqual(a["related"][0], "high")

    def test_entry_without_id_skipped(self):
        no_id = {"title": "No ID", "tags": ["ai"]}
        result = bi.compute_related([_ENTRY_A, no_id])
        a = next(e for e in result if e["id"] == "aaa")
        self.assertEqual(a["related"], [])

    def test_entry_without_tags_no_relations(self):
        no_tags = {"id": "zzz", "title": "No tags"}
        result = bi.compute_related([_ENTRY_A, no_tags])
        z = next(e for e in result if e["id"] == "zzz")
        self.assertEqual(z["related"], [])

    def test_related_field_added_to_all_entries(self):
        result = bi.compute_related([_ENTRY_A, _ENTRY_B, _ENTRY_C])
        for entry in result:
            self.assertIn("related", entry)


# ---------------------------------------------------------------------------
# main() integration
# ---------------------------------------------------------------------------

class TestBuildIndexMain(unittest.TestCase):

    def _run_main_in_tmp(self, entries):
        """Write entries into a temp dir, patch config, run main(), return all.json."""
        import unittest.mock as mock

        with tempfile.TemporaryDirectory() as tmp:
            idx_dir = Path(tmp)
            for entry in entries:
                _write_entry(idx_dir, entry)

            fake_config = {"dirs": {"raw": "raw", "knowledge": "knowledge", "index": str(idx_dir)}}

            with mock.patch.object(bi, "load_config", return_value=fake_config), \
                 mock.patch.object(bi, "index_dir", return_value=idx_dir):
                bi.main()

            out = json.loads((idx_dir / "all.json").read_text(encoding="utf-8"))
        return out

    def test_creates_all_json(self):
        out = self._run_main_in_tmp([_ENTRY_A, _ENTRY_B])
        self.assertEqual(out["count"], 2)
        self.assertIn("generated_at", out)
        self.assertIn("entries", out)

    def test_entries_sorted_by_date_descending(self):
        out = self._run_main_in_tmp([_ENTRY_C, _ENTRY_A, _ENTRY_B])
        dates = [e["date"] for e in out["entries"]]
        self.assertEqual(dates, sorted(dates, reverse=True))

    def test_related_field_present(self):
        out = self._run_main_in_tmp([_ENTRY_A, _ENTRY_B])
        for e in out["entries"]:
            self.assertIn("related", e)

    def test_empty_index_dir(self):
        out = self._run_main_in_tmp([])
        self.assertEqual(out["count"], 0)
        self.assertEqual(out["entries"], [])

    def test_single_entry_no_related(self):
        out = self._run_main_in_tmp([_ENTRY_A])
        self.assertEqual(out["entries"][0]["related"], [])

    def test_missing_optional_fields_tolerated(self):
        minimal = {"id": "min", "title": "Minimal", "tags": []}
        out = self._run_main_in_tmp([minimal])
        self.assertEqual(out["count"], 1)
        self.assertEqual(out["entries"][0]["related"], [])


if __name__ == "__main__":
    unittest.main()
