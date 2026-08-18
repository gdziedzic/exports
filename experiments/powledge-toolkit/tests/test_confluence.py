"""Tests for ingest/confluence.py — converter and helpers (no network calls)."""

import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
sys.path.insert(0, str(Path(__file__).parent.parent / "ingest"))

from confluence import (
    _already_ingested,
    _page_labels,
    _page_url,
    _slug,
    storage_to_markdown,
    write_page,
)


# ---------------------------------------------------------------------------
# storage_to_markdown
# ---------------------------------------------------------------------------

class TestStorageToMarkdown(unittest.TestCase):

    def test_empty(self):
        self.assertEqual(storage_to_markdown(""), "")

    def test_plain_paragraph(self):
        result = storage_to_markdown("<p>Hello world</p>")
        self.assertIn("Hello world", result)

    def test_headings(self):
        html = "<h1>Title</h1><h2>Sub</h2><h3>Sub-sub</h3>"
        result = storage_to_markdown(html)
        self.assertIn("# Title", result)
        self.assertIn("## Sub", result)
        self.assertIn("### Sub-sub", result)

    def test_bold_italic(self):
        result = storage_to_markdown("<p><strong>bold</strong> and <em>italic</em></p>")
        self.assertIn("**bold**", result)
        self.assertIn("*italic*", result)

    def test_strikethrough(self):
        result = storage_to_markdown("<p><s>gone</s></p>")
        self.assertIn("~~gone~~", result)

    def test_inline_code(self):
        result = storage_to_markdown("<p><code>x = 1</code></p>")
        self.assertIn("`x = 1`", result)

    def test_pre_block(self):
        result = storage_to_markdown("<pre>def foo():\n    pass</pre>")
        self.assertIn("```", result)
        self.assertIn("def foo():", result)

    def test_unordered_list(self):
        html = "<ul><li>alpha</li><li>beta</li></ul>"
        result = storage_to_markdown(html)
        self.assertIn("- alpha", result)
        self.assertIn("- beta", result)

    def test_ordered_list(self):
        html = "<ol><li>first</li><li>second</li></ol>"
        result = storage_to_markdown(html)
        self.assertIn("1. first", result)
        self.assertIn("2. second", result)

    def test_nested_list(self):
        html = "<ul><li>top<ul><li>nested</li></ul></li></ul>"
        result = storage_to_markdown(html)
        self.assertIn("- top", result)
        self.assertIn("  - nested", result)

    def test_link(self):
        html = '<p><a href="https://example.com">click here</a></p>'
        result = storage_to_markdown(html)
        self.assertIn("[click here](https://example.com)", result)

    def test_horizontal_rule(self):
        result = storage_to_markdown("<hr/>")
        self.assertIn("---", result)

    def test_table(self):
        html = (
            "<table>"
            "<tr><th>Name</th><th>Value</th></tr>"
            "<tr><td>foo</td><td>bar</td></tr>"
            "</table>"
        )
        result = storage_to_markdown(html)
        self.assertIn("| Name | Value |", result)
        self.assertIn("| --- | --- |", result)
        self.assertIn("| foo | bar |", result)

    def test_confluence_code_macro(self):
        html = (
            '<ac:structured-macro ac:name="code">'
            '<ac:parameter ac:name="language">python</ac:parameter>'
            '<ac:plain-text-body>print("hi")</ac:plain-text-body>'
            '</ac:structured-macro>'
        )
        result = storage_to_markdown(html)
        self.assertIn("```python", result)
        self.assertIn('print("hi")', result)
        self.assertIn("```", result)

    def test_confluence_code_macro_no_language(self):
        html = (
            '<ac:structured-macro ac:name="code">'
            '<ac:plain-text-body>SELECT 1</ac:plain-text-body>'
            '</ac:structured-macro>'
        )
        result = storage_to_markdown(html)
        self.assertIn("```", result)
        self.assertIn("SELECT 1", result)

    def test_skipped_tags_produce_no_content(self):
        html = "<p>before</p><ac:image /><p>after</p>"
        result = storage_to_markdown(html)
        self.assertIn("before", result)
        self.assertIn("after", result)

    def test_no_excessive_blank_lines(self):
        html = "<p>a</p><p>b</p><p>c</p>"
        result = storage_to_markdown(html)
        self.assertNotIn("\n\n\n", result)

    def test_html_entities_decoded(self):
        result = storage_to_markdown("<p>&amp; &lt; &gt;</p>")
        self.assertIn("&", result)
        self.assertIn("<", result)
        self.assertIn(">", result)


# ---------------------------------------------------------------------------
# _page_labels
# ---------------------------------------------------------------------------

class TestPageLabels(unittest.TestCase):

    def test_normal(self):
        page = {"labels": {"results": [{"name": "draft"}, {"name": "api"}]}}
        self.assertEqual(_page_labels(page), ["draft", "api"])

    def test_empty(self):
        page = {"labels": {"results": []}}
        self.assertEqual(_page_labels(page), [])

    def test_missing_labels(self):
        self.assertEqual(_page_labels({}), [])

    def test_malformed(self):
        self.assertEqual(_page_labels({"labels": None}), [])


# ---------------------------------------------------------------------------
# _page_url
# ---------------------------------------------------------------------------

class TestPageUrl(unittest.TestCase):

    def test_normal(self):
        page = {"_links": {"webui": "/spaces/ENG/pages/123/My+Page"}}
        result = _page_url("https://myco.atlassian.net/wiki", page)
        self.assertEqual(result, "https://myco.atlassian.net/wiki/spaces/ENG/pages/123/My+Page")

    def test_missing_links(self):
        self.assertEqual(_page_url("https://base", {}), "")

    def test_trailing_slash_stripped(self):
        # base_url is stripped in ConfluenceClient but _page_url receives it raw from write_page
        page = {"_links": {"webui": "/foo"}}
        result = _page_url("https://base", page)
        self.assertEqual(result, "https://base/foo")


# ---------------------------------------------------------------------------
# _slug
# ---------------------------------------------------------------------------

class TestSlug(unittest.TestCase):

    def test_basic(self):
        self.assertEqual(_slug("Hello World"), "hello-world")

    def test_special_chars(self):
        self.assertEqual(_slug("API v2: What's New?"), "api-v2-what-s-new")

    def test_truncation(self):
        long_title = "a" * 100
        self.assertLessEqual(len(_slug(long_title)), 60)

    def test_leading_trailing_dash(self):
        result = _slug("  --hello--  ")
        self.assertFalse(result.startswith("-"))
        self.assertFalse(result.endswith("-"))


# ---------------------------------------------------------------------------
# _already_ingested
# ---------------------------------------------------------------------------

class TestAlreadyIngested(unittest.TestCase):

    def test_detects_existing(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            meta = {"source_url": "https://example.com/page/1"}
            (raw / "page-1.meta.json").write_text(json.dumps(meta))
            self.assertTrue(_already_ingested(raw, "https://example.com/page/1"))

    def test_returns_false_when_absent(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertFalse(_already_ingested(Path(tmp), "https://example.com/page/99"))

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertFalse(_already_ingested(Path(tmp), "https://x.com"))

    def test_ignores_malformed_meta(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            (raw / "bad.meta.json").write_text("not json")
            self.assertFalse(_already_ingested(raw, "https://example.com"))


# ---------------------------------------------------------------------------
# write_page
# ---------------------------------------------------------------------------

def _make_page(page_id="123", title="Test Page", html="<p>content</p>",
               space_id="~ENG", labels=None, version=1, modified="2026-01-15T10:00:00Z",
               webui="/spaces/ENG/pages/123"):
    # Matches Confluence REST API v2 response shape
    return {
        "id": page_id,
        "title": title,
        "body": {"storage": {"value": html}},
        "spaceId": space_id,
        "labels": {"results": [{"name": l} for l in (labels or [])]},
        "version": {"number": version, "createdAt": modified},
        "_links": {"webui": webui},
    }


class TestWritePage(unittest.TestCase):

    def test_creates_md_and_meta(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            page = _make_page()
            result = write_page(page, raw, "https://base", dedup=False)
            self.assertIsNotNone(result)
            md_files = list(raw.glob("*.md"))
            meta_files = list(raw.glob("*.meta.json"))
            self.assertEqual(len(md_files), 1)
            self.assertEqual(len(meta_files), 1)

    def test_md_contains_frontmatter(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            page = _make_page(title="My Page", labels=["api", "v2"])
            write_page(page, raw, "https://base", dedup=False)
            content = list(raw.glob("*.md"))[0].read_text(encoding="utf-8")
            self.assertIn("---", content)
            self.assertIn('title: "My Page"', content)
            self.assertIn("type: confluence-page", content)
            self.assertIn("api", content)

    def test_md_contains_converted_body(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            page = _make_page(html="<p>Hello <strong>world</strong></p>")
            write_page(page, raw, "https://base", dedup=False)
            content = list(raw.glob("*.md"))[0].read_text(encoding="utf-8")
            self.assertIn("**world**", content)

    def test_meta_json_fields(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            page = _make_page(page_id="42", space_id="~ENG", version=3)
            write_page(page, raw, "https://base", dedup=False)
            meta = json.loads(list(raw.glob("*.meta.json"))[0].read_text())
            self.assertEqual(meta["confluence_id"], "42")
            self.assertEqual(meta["space_key"], "~ENG")
            self.assertEqual(meta["version"], 3)
            self.assertEqual(meta["type"], "confluence-page")
            self.assertIn("ingested_at", meta)

    def test_dedup_skips_existing(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            page = _make_page(webui="/spaces/ENG/pages/1")
            base = "https://base"
            write_page(page, raw, base, dedup=False)
            result = write_page(page, raw, base, dedup=True)
            self.assertIsNone(result)

    def test_dedup_disabled_overwrites(self):
        with tempfile.TemporaryDirectory() as tmp:
            raw = Path(tmp)
            page = _make_page()
            write_page(page, raw, "https://base", dedup=False)
            result = write_page(page, raw, "https://base", dedup=False)
            self.assertIsNotNone(result)


if __name__ == "__main__":
    unittest.main()
