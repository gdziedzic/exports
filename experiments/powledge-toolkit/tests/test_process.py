"""Tests for etl/process.py — ETL pipeline: parse, summarize, write."""

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


proc = _load_module("process", _ROOT / "etl" / "process.py")

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_SAMPLE_MD = """\
---
id: confluence-123-test-page
title: "Test Page"
source: "https://example.com/spaces/ENG/pages/123"
date: 2026-05-09
tags: ["api", "v2"]
type: confluence-page
---

# Test Page

First paragraph of content explaining the topic.

Second paragraph with more details.
"""

_CONFIG = {
    "etl": {"overwrite_existing": False},
    "claude": {"use_for_etl": False, "model": "claude-sonnet-4-6"},
}


def _write_raw(directory: Path, filename: str, content: str) -> Path:
    """Write a raw .md file and its .meta.json sidecar."""
    raw_file = directory / filename
    raw_file.write_text(content, encoding="utf-8")
    stem = filename.rsplit(".", 1)[0]
    (directory / f"{stem}.meta.json").write_text(
        json.dumps({"type": "confluence-page"}), encoding="utf-8"
    )
    return raw_file


# ---------------------------------------------------------------------------
# parse_frontmatter
# ---------------------------------------------------------------------------

class TestParseFrontmatter(unittest.TestCase):

    def test_parses_id(self):
        meta, _ = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertEqual(meta["id"], "confluence-123-test-page")

    def test_parses_quoted_title(self):
        meta, _ = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertEqual(meta["title"], "Test Page")

    def test_parses_json_tags(self):
        meta, _ = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertEqual(meta["tags"], ["api", "v2"])

    def test_parses_date(self):
        meta, _ = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertEqual(meta["date"], "2026-05-09")

    def test_parses_type(self):
        meta, _ = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertEqual(meta["type"], "confluence-page")

    def test_body_starts_after_delimiter(self):
        _, body = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertTrue(body.startswith("# Test Page"))

    def test_no_frontmatter_returns_empty_meta(self):
        text = "# Just content\n\nNo frontmatter here."
        meta, body = proc.parse_frontmatter(text)
        self.assertEqual(meta, {})
        self.assertEqual(body, text)

    def test_empty_string(self):
        meta, body = proc.parse_frontmatter("")
        self.assertEqual(meta, {})
        self.assertEqual(body, "")

    def test_unclosed_frontmatter(self):
        text = "---\nid: foo\ntitle: bar\n"
        meta, _ = proc.parse_frontmatter(text)
        self.assertEqual(meta, {})

    def test_empty_tags_list(self):
        text = "---\nid: x\ntags: []\n---\n\nBody"
        meta, _ = proc.parse_frontmatter(text)
        self.assertEqual(meta["tags"], [])

    def test_source_with_url(self):
        text = '---\nsource: "https://x.com/path?q=1"\n---\n\nBody'
        meta, _ = proc.parse_frontmatter(text)
        self.assertEqual(meta["source"], "https://x.com/path?q=1")

    def test_body_does_not_include_frontmatter(self):
        _, body = proc.parse_frontmatter(_SAMPLE_MD)
        self.assertNotIn("confluence-123-test-page", body)


# ---------------------------------------------------------------------------
# generate_summary_local
# ---------------------------------------------------------------------------

class TestGenerateSummaryLocal(unittest.TestCase):

    def test_extracts_first_paragraph(self):
        content = "# Heading\n\nFirst paragraph text here.\n\nSecond paragraph."
        summary = proc.generate_summary_local(content)
        self.assertIn("First paragraph text here", summary)
        self.assertNotIn("Second paragraph", summary)

    def test_skips_heading_only(self):
        content = "# Title Only\n\n## Sub\n\nReal content here."
        summary = proc.generate_summary_local(content)
        self.assertIn("Real content here", summary)

    def test_strips_bold(self):
        content = "**bold text** is here.\n\nmore."
        summary = proc.generate_summary_local(content)
        self.assertNotIn("**", summary)
        self.assertIn("bold text", summary)

    def test_strips_inline_code(self):
        content = "Use `my_function()` to do things."
        summary = proc.generate_summary_local(content)
        self.assertNotIn("`", summary)

    def test_strips_links(self):
        content = "See [the docs](https://example.com) for details."
        summary = proc.generate_summary_local(content)
        self.assertIn("the docs", summary)
        self.assertNotIn("https://", summary)

    def test_truncates_long_content(self):
        content = "word " * 200  # > 300 chars
        summary = proc.generate_summary_local(content)
        self.assertLessEqual(len(summary), 303)
        self.assertTrue(summary.endswith("..."))

    def test_empty_content(self):
        self.assertEqual(proc.generate_summary_local(""), "")

    def test_heading_only_returns_empty(self):
        self.assertEqual(proc.generate_summary_local("# Just a heading"), "")

    def test_skips_table_rows(self):
        content = "| col1 | col2 |\n| --- | --- |\n\nActual paragraph here."
        summary = proc.generate_summary_local(content)
        self.assertIn("Actual paragraph here", summary)

    def test_skips_hr_lines(self):
        content = "---\n\nReal paragraph."
        summary = proc.generate_summary_local(content)
        self.assertIn("Real paragraph", summary)


# ---------------------------------------------------------------------------
# process_file
# ---------------------------------------------------------------------------

class TestProcessFile(unittest.TestCase):

    def _dirs(self, tmp):
        raw = Path(tmp) / "raw"
        knowledge = Path(tmp) / "knowledge"
        idx = Path(tmp) / "index"
        raw.mkdir()
        return raw, knowledge, idx

    def test_creates_knowledge_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            result = proc.process_file(raw_file, knowledge, idx, _CONFIG)

            self.assertTrue(result)
            self.assertTrue((knowledge / "confluence-123-test-page.md").exists())

    def test_creates_index_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)

            self.assertTrue((idx / "confluence-123-test-page.index.json").exists())

    def test_index_has_required_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)

            entry = json.loads((idx / "confluence-123-test-page.index.json").read_text(encoding="utf-8"))
            self.assertEqual(entry["id"], "confluence-123-test-page")
            self.assertEqual(entry["title"], "Test Page")
            self.assertEqual(entry["tags"], ["api", "v2"])
            self.assertIn("summary", entry)
            self.assertIn("knowledge_file", entry)
            self.assertIn("source", entry)
            self.assertIn("date", entry)

    def test_knowledge_file_path_in_index(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)

            entry = json.loads((idx / "confluence-123-test-page.index.json").read_text(encoding="utf-8"))
            self.assertIn("confluence-123-test-page.md", entry["knowledge_file"])

    def test_knowledge_file_contains_original_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)

            content = (knowledge / "confluence-123-test-page.md").read_text(encoding="utf-8")
            self.assertIn("Test Page", content)
            self.assertIn("First paragraph of content", content)

    def test_summary_generated_from_content(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)

            entry = json.loads((idx / "confluence-123-test-page.index.json").read_text(encoding="utf-8"))
            self.assertGreater(len(entry["summary"]), 0)
            self.assertIn("First paragraph", entry["summary"])

    def test_skips_existing_when_overwrite_false(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)
            kf = knowledge / "confluence-123-test-page.md"
            kf.write_text("modified", encoding="utf-8")

            result = proc.process_file(raw_file, knowledge, idx, _CONFIG)

            self.assertFalse(result)
            self.assertEqual(kf.read_text(encoding="utf-8"), "modified")

    def test_overwrites_when_overwrite_true(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)
            kf = knowledge / "confluence-123-test-page.md"
            kf.write_text("modified", encoding="utf-8")

            config_overwrite = {**_CONFIG, "etl": {"overwrite_existing": True}}
            result = proc.process_file(raw_file, knowledge, idx, config_overwrite)

            self.assertTrue(result)
            self.assertNotEqual(kf.read_text(encoding="utf-8"), "modified")

    def test_no_frontmatter_returns_false(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            raw_file = _write_raw(raw, "no-fm.md", "# Just content\n\nNo frontmatter.")

            result = proc.process_file(raw_file, knowledge, idx, _CONFIG)

            self.assertFalse(result)
            self.assertFalse(list(knowledge.glob("*.md")) if knowledge.exists() else [])

    def test_creates_dirs_if_missing(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            idx = Path(tmp) / "index"
            raw.mkdir()
            raw_file = _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            proc.process_file(raw_file, knowledge, idx, _CONFIG)

            self.assertTrue(knowledge.exists())
            self.assertTrue(idx.exists())

    def test_missing_file_returns_false(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw, knowledge, idx = self._dirs(tmp)
            result = proc.process_file(raw / "nonexistent.md", knowledge, idx, _CONFIG)
            self.assertFalse(result)


# ---------------------------------------------------------------------------
# pending_raw_files
# ---------------------------------------------------------------------------

class TestPendingRawFiles(unittest.TestCase):

    def test_returns_files_without_knowledge(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            raw.mkdir()
            knowledge.mkdir()
            _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            result = proc.pending_raw_files(raw, knowledge)

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].name, "confluence-123-test-page.md")

    def test_excludes_already_processed(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            raw.mkdir()
            knowledge.mkdir()
            _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)
            (knowledge / "confluence-123-test-page.md").write_text("done", encoding="utf-8")

            result = proc.pending_raw_files(raw, knowledge)

            self.assertEqual(result, [])

    def test_excludes_files_without_meta_sidecar(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            raw.mkdir()
            knowledge.mkdir()
            (raw / "orphan.md").write_text(_SAMPLE_MD, encoding="utf-8")

            result = proc.pending_raw_files(raw, knowledge)

            self.assertEqual(result, [])

    def test_empty_raw_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            raw.mkdir()
            knowledge.mkdir()

            result = proc.pending_raw_files(raw, knowledge)

            self.assertEqual(result, [])

    def test_nonexistent_knowledge_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            raw.mkdir()
            _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)

            result = proc.pending_raw_files(raw, knowledge)

            self.assertEqual(len(result), 1)

    def test_multiple_files_partial_processed(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp) / "raw"
            knowledge = Path(tmp) / "knowledge"
            raw.mkdir()
            knowledge.mkdir()

            md2 = """\
---
id: confluence-456-page-two
title: "Page Two"
source: "https://example.com/456"
date: 2026-05-10
tags: []
type: confluence-page
---

# Page Two

Content.
"""
            _write_raw(raw, "confluence-123-test-page.md", _SAMPLE_MD)
            _write_raw(raw, "confluence-456-page-two.md", md2)
            (knowledge / "confluence-123-test-page.md").write_text("done", encoding="utf-8")

            result = proc.pending_raw_files(raw, knowledge)

            self.assertEqual(len(result), 1)
            self.assertEqual(result[0].name, "confluence-456-page-two.md")


if __name__ == "__main__":
    unittest.main()
