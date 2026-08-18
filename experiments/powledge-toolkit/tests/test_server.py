"""High-level / end-to-end tests for server.py — Powledge UI API layer.

Tests make real HTTP requests to a live HTTPServer running in a background
thread, with an isolated temporary directory standing in for the data store.
Subprocess calls (ETL, query) are replaced with a controlled mock so the
suite runs offline without the rest of the toolkit installed.
"""

import importlib.util
import json
import shutil
import subprocess
import sys
import tempfile
import threading
import time
import unittest
import unittest.mock as mock
import urllib.error
import urllib.request
from http.server import HTTPServer
from pathlib import Path

_ROOT = Path(__file__).parent.parent

# Load server module once to avoid repeated exec overhead.
_spec = importlib.util.spec_from_file_location("powledge_server", _ROOT / "server.py")
_server = importlib.util.module_from_spec(_spec)
sys.modules["powledge_server"] = _server
_spec.loader.exec_module(_server)


# ── shared fixtures ───────────────────────────────────────────────────────────

_ENTRY_A = {
    "id": "entry-alpha",
    "title": "Alpha Pipeline",
    "summary": "Describes the Alpha data pipeline.",
    "tags": ["alpha", "etl"],
    "source": "https://example.com/a",
    "date": "2026-04-01",
    "knowledge_file": "knowledge/entry-alpha.md",
}
_ENTRY_B = {
    "id": "entry-beta",
    "title": "Beta Architecture",
    "summary": "How Beta jobs are structured.",
    "tags": ["beta", "etl"],
    "source": "https://example.com/b",
    "date": "2026-03-15",
    "knowledge_file": "knowledge/entry-beta.md",
}
_ENTRY_C = {
    "id": "entry-gamma",
    "title": "Gamma Security Policies",
    "summary": "Access control and secrets.",
    "tags": ["security"],
    "source": "https://example.com/c",
    "date": "2026-02-20",
    "knowledge_file": "knowledge/entry-gamma.md",
}

_SAMPLE_FM = """\
---
id: {eid}
title: "{title}"
source: manual
date: 2026-01-15
tags: {tags_json}
type: manual
---

{body}"""

_OK_PROC = subprocess.CompletedProcess([], 0, "Processed 3 files.\n", "")
_FAIL_PROC = subprocess.CompletedProcess([], 1, "", "Error: something went wrong\n")


# ── base test case ─────────────────────────────────────────────────────────────

class ServerTestCase(unittest.TestCase):
    """Spin up a real HTTPServer on an ephemeral port with an isolated temp dir."""

    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
        for d in ("raw", "knowledge", "index"):
            (self.td / d).mkdir()
        (self.td / "knowledge" / "archived").mkdir()
        (self.td / "ui").mkdir()
        shutil.copy(_ROOT / "ui" / "index.html", self.td / "ui" / "index.html")

        self.cfg = {
            "dirs": {"raw": "raw", "knowledge": "knowledge", "index": "index"},
            "ingest": {},
            "etl": {"overwrite_existing": False},
            "claude": {"model": "claude-sonnet-4-6", "context_chunks_limit": 10},
        }
        (self.td / "powledge.config.json").write_text(json.dumps(self.cfg), encoding="utf-8")

        self._orig_root = _server.ROOT
        _server.ROOT = self.td

        self._lc = mock.patch.object(_server, "load_config", side_effect=lambda *a, **k: self.cfg)
        self._gd = mock.patch.object(
            _server, "get_dir",
            side_effect=lambda cfg, key: self.td / cfg["dirs"][key],
        )
        self._lc.start()
        self._gd.start()

        # Prevent real subprocess calls; individual tests override this when needed.
        self._run_patch = mock.patch.object(_server, "run", return_value=_OK_PROC)
        self._run_patch.start()

        self._httpd = HTTPServer(("127.0.0.1", 0), _server.Handler)
        self.port = self._httpd.server_address[1]
        self._thread = threading.Thread(target=self._httpd.serve_forever)
        self._thread.daemon = True
        self._thread.start()

    def tearDown(self):
        self._httpd.shutdown()
        self._thread.join(timeout=3)
        self._run_patch.stop()
        self._lc.stop()
        self._gd.stop()
        _server.ROOT = self._orig_root
        shutil.rmtree(self.td, ignore_errors=True)

    # ── HTTP helpers ──────────────────────────────────────────────────────────

    def _req(self, method, path, body=None, *, raw_path=False):
        url = (f"http://127.0.0.1:{self.port}{path}"
               if raw_path else
               f"http://127.0.0.1:{self.port}/api/{path}")
        data = json.dumps(body).encode() if body is not None else None
        headers = {"Content-Type": "application/json"} if data else {}
        req = urllib.request.Request(url, data=data, method=method, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                raw = r.read()
                try:
                    return r.status, json.loads(raw)
                except ValueError:
                    return r.status, raw.decode("utf-8", errors="replace")
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read())
            except ValueError:
                return e.code, {}

    def get(self, path, **kw):
        return self._req("GET", path, **kw)

    def post(self, path, body=None):
        return self._req("POST", path, body)

    def put(self, path, body=None):
        return self._req("PUT", path, body)

    def delete(self, path):
        return self._req("DELETE", path)

    # ── fixture helpers ───────────────────────────────────────────────────────

    def _km(self, eid, title="Test", tags=None, body="Hello.", archived=False):
        """Write a knowledge markdown file, return its full text."""
        tags = tags or []
        content = _SAMPLE_FM.format(
            eid=eid, title=title, tags_json=json.dumps(tags), body=body,
        )
        base = self.td / "knowledge" / ("archived" if archived else "")
        (base / f"{eid}.md").write_text(content, encoding="utf-8")
        return content

    def _idx(self, entry):
        """Write a single .index.json file."""
        (self.td / "index" / f"{entry['id']}.index.json").write_text(
            json.dumps(entry), encoding="utf-8"
        )

    def _all(self, entries):
        """Write the aggregated all.json index file."""
        data = {"count": len(entries), "generated_at": "2026-01-01T00:00:00Z", "entries": entries}
        (self.td / "index" / "all.json").write_text(json.dumps(data), encoding="utf-8")
        return data

    def _raw(self, stem, meta=None):
        """Write a raw .md file and optional sidecar."""
        content = _SAMPLE_FM.format(eid=stem, title=stem, tags_json="[]", body="Raw content.")
        (self.td / "raw" / f"{stem}.md").write_text(content, encoding="utf-8")
        if meta is not None:
            (self.td / "raw" / f"{stem}.meta.json").write_text(json.dumps(meta), encoding="utf-8")
        return content

    def _mock_run(self, proc=_OK_PROC):
        return mock.patch.object(_server, "run", return_value=proc)


# ── helpers (pure-function, no HTTP) ──────────────────────────────────────────

class TestSlugify(unittest.TestCase):

    def test_basic_lowercasing(self):
        self.assertEqual(_server.slugify("Hello World"), "hello-world")

    def test_special_chars_collapsed(self):
        self.assertEqual(_server.slugify("ETL Pipeline #2!"), "etl-pipeline-2")

    def test_consecutive_separators_collapsed(self):
        result = _server.slugify("multiple  --  spaces")
        self.assertNotIn("--", result)

    def test_truncates_to_60_chars(self):
        self.assertEqual(len(_server.slugify("a" * 200)), 60)

    def test_no_leading_trailing_hyphens(self):
        result = _server.slugify("--edges--")
        self.assertFalse(result.startswith("-"))
        self.assertFalse(result.endswith("-"))

    def test_empty_string(self):
        # Should not raise
        result = _server.slugify("")
        self.assertIsInstance(result, str)


class TestParseFrontmatter(unittest.TestCase):

    def test_basic_fields(self):
        fm, body = _server.parse_frontmatter("---\ntitle: Hello\ndate: 2026-01-01\n---\n\nBody.")
        self.assertEqual(fm["title"], "Hello")
        self.assertEqual(fm["date"], "2026-01-01")
        self.assertEqual(body, "Body.")

    def test_quoted_value_strips_quotes(self):
        fm, _ = _server.parse_frontmatter('---\ntitle: "Quoted Title"\n---\n\n')
        self.assertEqual(fm["title"], "Quoted Title")

    def test_json_array_parsed(self):
        fm, _ = _server.parse_frontmatter('---\ntags: ["a", "b", "c"]\n---\n\n')
        self.assertEqual(fm["tags"], ["a", "b", "c"])

    def test_empty_array(self):
        fm, _ = _server.parse_frontmatter("---\ntags: []\n---\n\n")
        self.assertEqual(fm["tags"], [])

    def test_no_frontmatter_returns_intact(self):
        text = "Just plain content, no delimiters."
        fm, body = _server.parse_frontmatter(text)
        self.assertEqual(fm, {})
        self.assertEqual(body, text)

    def test_unclosed_frontmatter_returns_empty_fm(self):
        fm, _ = _server.parse_frontmatter("---\ntitle: Unclosed\nno end delimiter")
        self.assertEqual(fm, {})

    def test_body_excludes_frontmatter(self):
        _, body = _server.parse_frontmatter("---\nid: x\n---\n\nReal body here.")
        self.assertNotIn("id: x", body)
        self.assertIn("Real body here.", body)

    def test_leading_whitespace_stripped_from_body(self):
        _, body = _server.parse_frontmatter("---\nid: x\n---\n\n\nBody.")
        self.assertFalse(body.startswith("\n"))


class TestBuildFrontmatter(unittest.TestCase):

    def test_produces_delimiter_lines(self):
        result = _server.build_frontmatter({"id": "x"})
        self.assertTrue(result.startswith("---"))
        self.assertTrue(result.endswith("---"))

    def test_list_serialized_as_json(self):
        result = _server.build_frontmatter({"tags": ["a", "b"]})
        self.assertIn('["a", "b"]', result)

    def test_special_char_title_quoted(self):
        result = _server.build_frontmatter({"title": 'Title: with "quotes"'})
        self.assertIn('"', result)

    def test_plain_value_unquoted(self):
        result = _server.build_frontmatter({"id": "simple-id"})
        self.assertIn("id: simple-id", result)

    def test_roundtrip(self):
        original = {"id": "rt-test", "title": "Round Trip", "tags": ["x", "y"], "date": "2026-01-01"}
        built = _server.build_frontmatter(original)
        fm, _ = _server.parse_frontmatter(built + "\n\nbody")
        self.assertEqual(fm["id"], "rt-test")
        self.assertEqual(fm["title"], "Round Trip")
        self.assertEqual(fm["tags"], ["x", "y"])


# ── static file serving ────────────────────────────────────────────────────────

class TestStaticServing(ServerTestCase):

    def test_root_returns_html(self):
        status, body = self.get("/", raw_path=True)
        self.assertEqual(status, 200)
        self.assertIn("Powledge", body)

    def test_index_html_alias(self):
        status, body = self.get("/index.html", raw_path=True)
        self.assertEqual(status, 200)
        self.assertIsInstance(body, str)

    def test_unknown_path_returns_404(self):
        status, _ = self.get("/nonexistent/file.txt", raw_path=True)
        self.assertEqual(status, 404)


# ── GET /api/index ─────────────────────────────────────────────────────────────

class TestGetIndex(ServerTestCase):

    def test_empty_returns_empty_entries(self):
        status, data = self.get("index")
        self.assertEqual(status, 200)
        self.assertEqual(data["entries"], [])

    def test_returns_all_json_when_present(self):
        self._all([_ENTRY_A, _ENTRY_B])
        status, data = self.get("index")
        self.assertEqual(status, 200)
        self.assertEqual(data["count"], 2)
        ids = [e["id"] for e in data["entries"]]
        self.assertIn("entry-alpha", ids)
        self.assertIn("entry-beta", ids)

    def test_entry_fields_present(self):
        self._all([_ENTRY_A])
        _, data = self.get("index")
        e = data["entries"][0]
        for field in ("id", "title", "summary", "tags", "date"):
            self.assertIn(field, e)


# ── GET /api/status ────────────────────────────────────────────────────────────

class TestGetStatus(ServerTestCase):

    def test_empty_dirs_all_zero(self):
        status, data = self.get("status")
        self.assertEqual(status, 200)
        self.assertEqual(data["knowledge"], 0)
        self.assertEqual(data["raw"], 0)
        self.assertEqual(data["archived"], 0)
        self.assertEqual(data["index"], 0)

    def test_counts_knowledge_files(self):
        self._km("k1")
        self._km("k2")
        _, data = self.get("status")
        self.assertEqual(data["knowledge"], 2)

    def test_counts_archived_separately(self):
        self._km("live1")
        self._km("arch1", archived=True)
        _, data = self.get("status")
        self.assertEqual(data["knowledge"], 1)
        self.assertEqual(data["archived"], 1)

    def test_counts_raw_files(self):
        self._raw("raw-one")
        self._raw("raw-two")
        _, data = self.get("status")
        self.assertEqual(data["raw"], 2)

    def test_counts_index_entries(self):
        self._idx(_ENTRY_A)
        self._idx(_ENTRY_B)
        _, data = self.get("status")
        self.assertEqual(data["index"], 2)


# ── GET /api/config ────────────────────────────────────────────────────────────

class TestGetConfig(ServerTestCase):

    def test_returns_config_json(self):
        status, data = self.get("config")
        self.assertEqual(status, 200)
        self.assertIn("dirs", data)
        self.assertIn("claude", data)

    def test_config_dirs_structure(self):
        _, data = self.get("config")
        dirs = data["dirs"]
        self.assertEqual(dirs["knowledge"], "knowledge")
        self.assertEqual(dirs["raw"], "raw")
        self.assertEqual(dirs["index"], "index")


# ── GET /api/tags ──────────────────────────────────────────────────────────────

class TestGetTags(ServerTestCase):

    def test_empty_index_returns_empty(self):
        self._all([])
        status, data = self.get("tags")
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_no_all_json_returns_empty(self):
        status, data = self.get("tags")
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_returns_tags_with_counts(self):
        self._all([_ENTRY_A, _ENTRY_B, _ENTRY_C])
        _, data = self.get("tags")
        # data is [[tag, count], ...]
        tag_map = dict(data)
        self.assertIn("etl", tag_map)
        self.assertEqual(tag_map["etl"], 2)
        self.assertIn("security", tag_map)
        self.assertEqual(tag_map["security"], 1)

    def test_sorted_by_count_descending(self):
        self._all([_ENTRY_A, _ENTRY_B, _ENTRY_C])
        _, data = self.get("tags")
        counts = [c for _, c in data]
        self.assertEqual(counts, sorted(counts, reverse=True))


# ── GET /api/search ────────────────────────────────────────────────────────────

class TestGetSearch(ServerTestCase):

    def setUp(self):
        super().setUp()
        self._all([_ENTRY_A, _ENTRY_B, _ENTRY_C])

    def test_no_params_returns_all(self):
        status, data = self.get("search")
        self.assertEqual(status, 200)
        self.assertEqual(len(data), 3)

    def test_q_filters_by_title_substring(self):
        _, data = self.get("search?q=Alpha")
        ids = [e["id"] for e in data]
        self.assertIn("entry-alpha", ids)
        self.assertNotIn("entry-beta", ids)

    def test_q_filters_by_summary(self):
        _, data = self.get("search?q=access+control")
        ids = [e["id"] for e in data]
        self.assertIn("entry-gamma", ids)

    def test_q_case_insensitive(self):
        _, data = self.get("search?q=ALPHA")
        self.assertTrue(any(e["id"] == "entry-alpha" for e in data))

    def test_tags_filter_single(self):
        _, data = self.get("search?tags=security")
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], "entry-gamma")

    def test_tags_filter_and_logic(self):
        # Both alpha and beta have 'etl'; only alpha has 'alpha'
        _, data = self.get("search?tags=alpha,etl")
        self.assertEqual(len(data), 1)
        self.assertEqual(data[0]["id"], "entry-alpha")

    def test_no_match_returns_empty(self):
        _, data = self.get("search?q=nonexistent-xyz-term")
        self.assertEqual(data, [])

    def test_combined_q_and_tags(self):
        _, data = self.get("search?q=pipeline&tags=etl")
        ids = [e["id"] for e in data]
        self.assertIn("entry-alpha", ids)
        self.assertNotIn("entry-gamma", ids)


# ── GET /api/knowledge/:id ─────────────────────────────────────────────────────

class TestGetKnowledge(ServerTestCase):

    def test_returns_content_and_frontmatter(self):
        self._km("ktest", title="Knowledge Test", tags=["a", "b"])
        status, data = self.get("knowledge/ktest")
        self.assertEqual(status, 200)
        self.assertEqual(data["id"], "ktest")
        self.assertIn("content", data)
        self.assertIn("frontmatter", data)
        self.assertIn("body", data)

    def test_frontmatter_title_parsed(self):
        self._km("kfm", title="Parsed Title")
        _, data = self.get("knowledge/kfm")
        self.assertEqual(data["frontmatter"]["title"], "Parsed Title")

    def test_archived_false_for_live(self):
        self._km("klive")
        _, data = self.get("knowledge/klive")
        self.assertFalse(data["archived"])

    def test_archived_true_for_archived_entry(self):
        self._km("karch", archived=True)
        status, data = self.get("knowledge/karch")
        self.assertEqual(status, 200)
        self.assertTrue(data["archived"])

    def test_not_found_returns_404(self):
        status, data = self.get("knowledge/nonexistent-id")
        self.assertEqual(status, 404)
        self.assertIn("error", data)

    def test_url_encoded_id(self):
        self._km("hyphen-and-id")
        status, _ = self.get("knowledge/hyphen-and-id")
        self.assertEqual(status, 200)


# ── GET /api/raw ───────────────────────────────────────────────────────────────

class TestGetRaw(ServerTestCase):

    def test_empty_returns_list(self):
        status, data = self.get("raw")
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_returns_file_list_with_metadata(self):
        self._raw("raw-one", meta={"title": "Raw One", "type": "confluence-page"})
        _, data = self.get("raw")
        self.assertEqual(len(data), 1)
        f = data[0]
        self.assertEqual(f["stem"], "raw-one")
        self.assertIn("size", f)
        self.assertIn("modified", f)

    def test_sidecar_meta_merged(self):
        self._raw("with-meta", meta={"title": "From Meta", "confluence_id": "999"})
        _, data = self.get("raw")
        f = data[0]
        self.assertEqual(f["title"], "From Meta")
        self.assertEqual(f["confluence_id"], "999")

    def test_individual_raw_file(self):
        self._raw("single-file", meta={"type": "test"})
        status, data = self.get("raw/single-file")
        self.assertEqual(status, 200)
        self.assertEqual(data["stem"], "single-file")
        self.assertIn("content", data)
        self.assertIn("meta", data)
        self.assertEqual(data["meta"]["type"], "test")

    def test_individual_raw_not_found(self):
        status, _ = self.get("raw/missing-stem")
        self.assertEqual(status, 404)


# ── POST /api/knowledge ────────────────────────────────────────────────────────

class TestPostKnowledge(ServerTestCase):

    def test_creates_file_on_disk(self):
        status, data = self.post("knowledge", {"title": "New Entry", "content": "Body text.", "tags": ["test"]})
        self.assertEqual(status, 200)
        self.assertTrue(data["created"])
        eid = data["id"]
        self.assertTrue((self.td / "knowledge" / f"{eid}.md").exists())

    def test_auto_generates_id_from_title(self):
        _, data = self.post("knowledge", {"title": "Auto ID Entry"})
        self.assertIn("auto-id-entry", data["id"])

    def test_uses_provided_id(self):
        _, data = self.post("knowledge", {"title": "Custom", "id": "my-custom-id"})
        self.assertEqual(data["id"], "my-custom-id")
        self.assertTrue((self.td / "knowledge" / "my-custom-id.md").exists())

    def test_frontmatter_written_correctly(self):
        self.post("knowledge", {"title": "FM Test", "tags": ["x", "y"], "type": "note", "id": "fm-test"})
        content = (self.td / "knowledge" / "fm-test.md").read_text(encoding="utf-8")
        fm, _ = _server.parse_frontmatter(content)
        self.assertEqual(fm["title"], "FM Test")
        self.assertEqual(fm["tags"], ["x", "y"])
        self.assertEqual(fm["type"], "note")

    def test_duplicate_id_returns_409(self):
        self.post("knowledge", {"title": "First", "id": "dup-test"})
        status, data = self.post("knowledge", {"title": "Second", "id": "dup-test"})
        self.assertEqual(status, 409)
        self.assertIn("error", data)

    def test_default_type_is_manual(self):
        self.post("knowledge", {"title": "No Type", "id": "no-type-test"})
        content = (self.td / "knowledge" / "no-type-test.md").read_text(encoding="utf-8")
        fm, _ = _server.parse_frontmatter(content)
        self.assertEqual(fm["type"], "manual")

    def test_content_written_as_body(self):
        self.post("knowledge", {"title": "Content Test", "content": "Custom **body**.", "id": "body-test"})
        content = (self.td / "knowledge" / "body-test.md").read_text(encoding="utf-8")
        _, body = _server.parse_frontmatter(content)
        self.assertIn("Custom **body**.", body)


# ── POST /api/knowledge/archive & unarchive ────────────────────────────────────

class TestPostArchiveUnarchive(ServerTestCase):

    def test_archive_moves_file(self):
        self._km("to-archive")
        self.post("knowledge/archive", {"id": "to-archive"})
        self.assertFalse((self.td / "knowledge" / "to-archive.md").exists())
        self.assertTrue((self.td / "knowledge" / "archived" / "to-archive.md").exists())

    def test_archive_removes_index_entry(self):
        self._km("arch-idx")
        self._idx({**_ENTRY_A, "id": "arch-idx"})
        self.post("knowledge/archive", {"id": "arch-idx"})
        self.assertFalse((self.td / "index" / "arch-idx.index.json").exists())

    def test_archive_not_found_returns_404(self):
        status, data = self.post("knowledge/archive", {"id": "ghost"})
        self.assertEqual(status, 404)
        self.assertIn("error", data)

    def test_unarchive_moves_back(self):
        self._km("to-restore", archived=True)
        self.post("knowledge/unarchive", {"id": "to-restore"})
        self.assertTrue((self.td / "knowledge" / "to-restore.md").exists())
        self.assertFalse((self.td / "knowledge" / "archived" / "to-restore.md").exists())

    def test_unarchive_not_found_returns_404(self):
        status, data = self.post("knowledge/unarchive", {"id": "ghost"})
        self.assertEqual(status, 404)
        self.assertIn("error", data)

    def test_archive_then_unarchive_roundtrip(self):
        self._km("roundtrip", title="Original Content", body="Preserved body.")
        self.post("knowledge/archive", {"id": "roundtrip"})
        self.post("knowledge/unarchive", {"id": "roundtrip"})
        content = (self.td / "knowledge" / "roundtrip.md").read_text(encoding="utf-8")
        self.assertIn("Preserved body.", content)


# ── POST /api/etl, /api/index/rebuild, /api/pipeline ──────────────────────────

class TestPostPipeline(ServerTestCase):

    def test_etl_pending_calls_pending_flag(self):
        with self._mock_run() as m:
            status, data = self.post("etl", {"mode": "pending"})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        args = m.call_args[0]
        self.assertIn("--pending", args[1])

    def test_etl_all_calls_all_flag(self):
        with self._mock_run() as m:
            status, data = self.post("etl", {"mode": "all"})
        self.assertEqual(status, 200)
        args = m.call_args[0]
        self.assertIn("--all", args[1])

    def test_etl_default_mode_is_pending(self):
        with self._mock_run() as m:
            self.post("etl", {})
        args = m.call_args[0]
        self.assertIn("--pending", args[1])

    def test_etl_failure_reflected_in_response(self):
        with self._mock_run(_FAIL_PROC):
            _, data = self.post("etl", {"mode": "all"})
        self.assertFalse(data["ok"])
        self.assertIn("Error", data["output"])

    def test_index_rebuild_invokes_script(self):
        with self._mock_run() as m:
            status, data = self.post("index/rebuild", {})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        script = m.call_args[0][0]
        self.assertIn("build-index", str(script))

    def test_index_rebuild_failure_reflected(self):
        with self._mock_run(_FAIL_PROC):
            _, data = self.post("index/rebuild", {})
        self.assertFalse(data["ok"])

    def test_pipeline_calls_both_scripts(self):
        call_log = []
        def fake_run(script, args=(), timeout=120):
            call_log.append(str(script))
            return _OK_PROC

        with mock.patch.object(_server, "run", side_effect=fake_run):
            status, data = self.post("pipeline", {})
        self.assertEqual(status, 200)
        self.assertTrue(data["ok"])
        self.assertEqual(len(call_log), 2)
        scripts = " ".join(call_log)
        self.assertIn("process", scripts)
        self.assertIn("build-index", scripts)

    def test_pipeline_failure_when_first_script_fails(self):
        fail_then_ok = [_FAIL_PROC, _OK_PROC]
        with mock.patch.object(_server, "run", side_effect=fail_then_ok):
            _, data = self.post("pipeline", {})
        self.assertFalse(data["ok"])


# ── POST /api/query ────────────────────────────────────────────────────────────

class TestPostQuery(ServerTestCase):

    def test_returns_answer_from_script(self):
        proc = subprocess.CompletedProcess([], 0, "The answer is 42.", "")
        with mock.patch.object(_server, "run", return_value=proc):
            status, data = self.post("query", {"question": "What is the answer?"})
        self.assertEqual(status, 200)
        self.assertEqual(data["answer"], "The answer is 42.")

    def test_missing_question_returns_400(self):
        status, data = self.post("query", {})
        self.assertEqual(status, 400)
        self.assertIn("error", data)

    def test_empty_question_returns_400(self):
        status, data = self.post("query", {"question": "   "})
        self.assertEqual(status, 400)

    def test_passes_tags_to_script(self):
        proc = subprocess.CompletedProcess([], 0, "Answer.", "")
        with mock.patch.object(_server, "run", return_value=proc) as m:
            self.post("query", {"question": "Q?", "tags": ["alpha", "etl"]})
        args = m.call_args[0][1]
        self.assertIn("--tags", args)
        tag_idx = args.index("--tags")
        self.assertIn("alpha", args[tag_idx + 1])

    def test_script_failure_returns_500(self):
        with self._mock_run(_FAIL_PROC):
            status, data = self.post("query", {"question": "What?"})
        self.assertEqual(status, 500)
        self.assertIn("error", data)

    def test_top_param_passed_to_script(self):
        proc = subprocess.CompletedProcess([], 0, "Top answer.", "")
        with mock.patch.object(_server, "run", return_value=proc) as m:
            self.post("query", {"question": "Q?", "top": 5})
        args = m.call_args[0][1]
        self.assertIn("--top", args)
        top_idx = args.index("--top")
        self.assertEqual(args[top_idx + 1], "5")


# ── PUT /api/config ────────────────────────────────────────────────────────────

class TestPutConfig(ServerTestCase):

    def test_saves_config_to_disk(self):
        new_cfg = {**self.cfg, "claude": {"model": "claude-opus-4-8", "context_chunks_limit": 5}}
        status, data = self.put("config", new_cfg)
        self.assertEqual(status, 200)
        self.assertTrue(data["saved"])
        saved = json.loads((self.td / "powledge.config.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["claude"]["model"], "claude-opus-4-8")

    def test_readable_via_get_after_put(self):
        updated = {**self.cfg, "dirs": {"raw": "raw2", "knowledge": "know2", "index": "idx2"}}
        self.put("config", updated)
        # Bypass the mocked load_config to read directly from disk
        saved = json.loads((self.td / "powledge.config.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["dirs"]["raw"], "raw2")

    def test_put_with_empty_body_overwrites(self):
        status, data = self.put("config", {})
        self.assertEqual(status, 200)
        content = (self.td / "powledge.config.json").read_text(encoding="utf-8")
        self.assertEqual(json.loads(content), {})


# ── PUT /api/knowledge/:id ─────────────────────────────────────────────────────

class TestPutKnowledge(ServerTestCase):

    def test_updates_file_content(self):
        self._km("upd-test", body="Original body.")
        new_content = "---\nid: upd-test\ntitle: \"Updated\"\nsource: manual\ndate: 2026-01-01\ntags: []\ntype: manual\n---\n\nUpdated body."
        status, data = self.put("knowledge/upd-test", {"content": new_content})
        self.assertEqual(status, 200)
        self.assertTrue(data["saved"])
        on_disk = (self.td / "knowledge" / "upd-test.md").read_text(encoding="utf-8")
        self.assertIn("Updated body.", on_disk)

    def test_updates_archived_entry(self):
        self._km("arch-upd", archived=True)
        new_content = "---\nid: arch-upd\ntitle: \"Archived Updated\"\nsource: manual\ndate: 2026-01-01\ntags: []\ntype: manual\n---\n\nNew content."
        status, data = self.put("knowledge/arch-upd", {"content": new_content})
        self.assertEqual(status, 200)
        on_disk = (self.td / "knowledge" / "archived" / "arch-upd.md").read_text(encoding="utf-8")
        self.assertIn("New content.", on_disk)

    def test_not_found_returns_404(self):
        status, data = self.put("knowledge/ghost-entry", {"content": "x"})
        self.assertEqual(status, 404)
        self.assertIn("error", data)


# ── DELETE /api/knowledge/:id ──────────────────────────────────────────────────

class TestDeleteKnowledge(ServerTestCase):

    def test_removes_knowledge_file(self):
        self._km("del-test")
        self.delete("knowledge/del-test")
        self.assertFalse((self.td / "knowledge" / "del-test.md").exists())

    def test_removes_index_entry(self):
        self._km("del-idx")
        self._idx({**_ENTRY_A, "id": "del-idx"})
        self.delete("knowledge/del-idx")
        self.assertFalse((self.td / "index" / "del-idx.index.json").exists())

    def test_response_lists_deleted_items(self):
        self._km("del-resp")
        self._idx({**_ENTRY_A, "id": "del-resp"})
        status, data = self.delete("knowledge/del-resp")
        self.assertEqual(status, 200)
        self.assertIn("knowledge", data["deleted"])
        self.assertIn("index", data["deleted"])

    def test_deletes_archived_entry(self):
        self._km("del-arch", archived=True)
        self.delete("knowledge/del-arch")
        self.assertFalse((self.td / "knowledge" / "archived" / "del-arch.md").exists())

    def test_no_index_entry_still_succeeds(self):
        self._km("del-no-idx")
        status, data = self.delete("knowledge/del-no-idx")
        self.assertEqual(status, 200)
        self.assertIn("knowledge", data["deleted"])
        self.assertNotIn("index", data["deleted"])


# ── DELETE /api/raw/:stem ──────────────────────────────────────────────────────

class TestDeleteRaw(ServerTestCase):

    def test_removes_raw_md_file(self):
        self._raw("raw-del")
        self.delete("raw/raw-del")
        self.assertFalse((self.td / "raw" / "raw-del.md").exists())

    def test_removes_sidecar_meta_json(self):
        self._raw("raw-meta-del", meta={"type": "test"})
        self.delete("raw/raw-meta-del")
        self.assertFalse((self.td / "raw" / "raw-meta-del.meta.json").exists())

    def test_response_lists_deleted_filenames(self):
        self._raw("raw-resp", meta={"x": 1})
        status, data = self.delete("raw/raw-resp")
        self.assertEqual(status, 200)
        names = data["deleted"]
        self.assertTrue(any("raw-resp.md" in n for n in names))
        self.assertTrue(any("raw-resp.meta.json" in n for n in names))

    def test_missing_file_returns_empty_deleted(self):
        status, data = self.delete("raw/no-such-stem")
        self.assertEqual(status, 200)
        self.assertEqual(data["deleted"], [])


# ── unknown endpoints ──────────────────────────────────────────────────────────

class TestUnknownEndpoints(ServerTestCase):

    def test_get_unknown_returns_404(self):
        status, data = self.get("totally/unknown/path")
        self.assertEqual(status, 404)
        self.assertIn("error", data)

    def test_post_unknown_returns_404(self):
        status, data = self.post("unknown-action", {})
        self.assertEqual(status, 404)

    def test_put_unknown_returns_404(self):
        status, data = self.put("unknown-target", {})
        self.assertEqual(status, 404)

    def test_delete_unknown_returns_404(self):
        status, data = self.delete("unknown-resource")
        self.assertEqual(status, 404)


# ── edge cases & integration ───────────────────────────────────────────────────

class TestEdgeCases(ServerTestCase):

    def test_knowledge_file_with_no_frontmatter(self):
        """Files without frontmatter should still be readable."""
        (self.td / "knowledge" / "bare.md").write_text("Just plain markdown.", encoding="utf-8")
        status, data = self.get("knowledge/bare")
        self.assertEqual(status, 200)
        self.assertEqual(data["frontmatter"], {})
        self.assertIn("Just plain markdown.", data["body"])

    def test_search_with_no_all_json_returns_empty(self):
        """search endpoint is robust when index hasn't been built yet."""
        status, data = self.get("search?q=anything")
        self.assertEqual(status, 200)
        self.assertEqual(data, [])

    def test_tags_case_insensitive_in_search(self):
        """Tag filter should match regardless of case."""
        self._all([{**_ENTRY_C, "tags": ["Security"]}])
        _, data = self.get("search?tags=security")
        self.assertEqual(len(data), 1)

    def test_create_then_read_roundtrip(self):
        """Full create → read roundtrip preserves title and body."""
        self.post("knowledge", {"title": "Roundtrip Test", "content": "Important insight.", "id": "rt-e2e"})
        _, data = self.get("knowledge/rt-e2e")
        self.assertEqual(data["frontmatter"]["title"], "Roundtrip Test")
        self.assertIn("Important insight.", data["body"])

    def test_create_archive_delete_lifecycle(self):
        """Full lifecycle: create → archive → unarchive → delete."""
        self.post("knowledge", {"title": "Lifecycle", "id": "lifecycle-e2e"})
        self.assertTrue((self.td / "knowledge" / "lifecycle-e2e.md").exists())

        self.post("knowledge/archive", {"id": "lifecycle-e2e"})
        self.assertFalse((self.td / "knowledge" / "lifecycle-e2e.md").exists())
        self.assertTrue((self.td / "knowledge" / "archived" / "lifecycle-e2e.md").exists())

        self.post("knowledge/unarchive", {"id": "lifecycle-e2e"})
        self.assertTrue((self.td / "knowledge" / "lifecycle-e2e.md").exists())

        self.delete("knowledge/lifecycle-e2e")
        self.assertFalse((self.td / "knowledge" / "lifecycle-e2e.md").exists())

    def test_status_reflects_create_and_archive(self):
        """Status counts update correctly after create and archive operations."""
        _, before = self.get("status")
        self.assertEqual(before["knowledge"], 0)
        self.assertEqual(before["archived"], 0)

        self.post("knowledge", {"title": "Counted", "id": "count-me"})
        _, after_create = self.get("status")
        self.assertEqual(after_create["knowledge"], 1)
        self.assertEqual(after_create["archived"], 0)

        self.post("knowledge/archive", {"id": "count-me"})
        _, after_archive = self.get("status")
        self.assertEqual(after_archive["knowledge"], 0)
        self.assertEqual(after_archive["archived"], 1)

    def test_update_then_read_reflects_changes(self):
        """PUT knowledge then GET should return updated content."""
        self._km("update-e2e", body="Old body.")
        new_content = (
            "---\nid: update-e2e\ntitle: \"Updated\"\n"
            "source: manual\ndate: 2026-01-01\ntags: []\ntype: manual\n---\n\nNew body."
        )
        self.put("knowledge/update-e2e", {"content": new_content})
        _, data = self.get("knowledge/update-e2e")
        self.assertIn("New body.", data["body"])
        self.assertNotIn("Old body.", data["body"])


# ── auto index rebuild on every write ─────────────────────────────────────────

class TestAutoIndexRebuildOnWrite(ServerTestCase):
    """Every write that changes knowledge state must trigger index/all.json rebuild."""

    def _tracking_run(self):
        """Return (call_log list, patch ctx-manager) that records run() invocations."""
        log = []
        def fake(script, args=(), timeout=120):
            log.append(str(script))
            return _OK_PROC
        return log, mock.patch.object(_server, "run", side_effect=fake)

    # ── create ────────────────────────────────────────────────────────────────

    def test_create_triggers_index_rebuild(self):
        log, patch = self._tracking_run()
        with patch:
            status, data = self.post("knowledge", {"title": "Rebuild Me"})
        self.assertEqual(status, 200)
        self.assertTrue(any("build-index" in s for s in log), f"build-index not called; log={log}")

    def test_create_writes_index_json(self):
        _, data = self.post("knowledge", {"title": "Index Test", "tags": ["a", "b"], "id": "idx-create"})
        idx_path = self.td / "index" / "idx-create.index.json"
        self.assertTrue(idx_path.exists(), "server should write .index.json on create")
        entry = json.loads(idx_path.read_text("utf-8"))
        self.assertEqual(entry["id"], "idx-create")
        self.assertEqual(entry["title"], "Index Test")
        self.assertEqual(entry["tags"], ["a", "b"])

    def test_create_index_json_has_no_summary(self):
        """Immediately-created index entries have empty summary; ETL fills it later."""
        _, data = self.post("knowledge", {"title": "No Summary Yet", "id": "ns-test"})
        entry = json.loads((self.td / "index" / "ns-test.index.json").read_text("utf-8"))
        self.assertEqual(entry.get("summary", ""), "")

    def test_rebuild_failure_does_not_break_create(self):
        with mock.patch.object(_server, "run", return_value=_FAIL_PROC):
            status, data = self.post("knowledge", {"title": "Fail Rebuild"})
        self.assertEqual(status, 200)
        self.assertTrue(data["created"])

    # ── update ────────────────────────────────────────────────────────────────

    def test_update_triggers_index_rebuild(self):
        self._km("upd-rb", title="Old Title", tags=["old"])
        log, patch = self._tracking_run()
        new_content = (
            '---\nid: upd-rb\ntitle: "New Title"\nsource: manual\n'
            'date: 2026-01-01\ntags: ["new"]\ntype: manual\n---\n\nUpdated.'
        )
        with patch:
            status, _ = self.put("knowledge/upd-rb", {"content": new_content})
        self.assertEqual(status, 200)
        self.assertTrue(any("build-index" in s for s in log), f"build-index not called; log={log}")

    def test_update_refreshes_index_title_and_tags(self):
        self._km("upd-idx", title="Old", tags=["x"])
        self._idx({**_ENTRY_A, "id": "upd-idx", "title": "Old", "tags": ["x"]})
        new_content = (
            '---\nid: upd-idx\ntitle: "New Title"\nsource: manual\n'
            'date: 2026-01-01\ntags: ["y","z"]\ntype: manual\n---\n\nUpdated.'
        )
        self.put("knowledge/upd-idx", {"content": new_content})
        entry = json.loads((self.td / "index" / "upd-idx.index.json").read_text("utf-8"))
        self.assertEqual(entry["title"], "New Title")
        self.assertEqual(entry["tags"], ["y", "z"])

    def test_rebuild_failure_does_not_break_update(self):
        self._km("upd-fail-rb")
        new_content = (
            '---\nid: upd-fail-rb\ntitle: "X"\nsource: manual\n'
            'date: 2026-01-01\ntags: []\ntype: manual\n---\n\nX.'
        )
        with mock.patch.object(_server, "run", return_value=_FAIL_PROC):
            status, data = self.put("knowledge/upd-fail-rb", {"content": new_content})
        self.assertEqual(status, 200)
        self.assertTrue(data["saved"])

    # ── delete ────────────────────────────────────────────────────────────────

    def test_delete_triggers_index_rebuild(self):
        self._km("del-rb")
        log, patch = self._tracking_run()
        with patch:
            status, _ = self.delete("knowledge/del-rb")
        self.assertEqual(status, 200)
        self.assertTrue(any("build-index" in s for s in log), f"build-index not called; log={log}")

    def test_rebuild_failure_does_not_break_delete(self):
        self._km("del-fail-rb")
        with mock.patch.object(_server, "run", return_value=_FAIL_PROC):
            status, _ = self.delete("knowledge/del-fail-rb")
        self.assertEqual(status, 200)

    # ── archive / unarchive ───────────────────────────────────────────────────

    def test_archive_triggers_index_rebuild(self):
        self._km("arch-rb")
        log, patch = self._tracking_run()
        with patch:
            status, _ = self.post("knowledge/archive", {"id": "arch-rb"})
        self.assertEqual(status, 200)
        self.assertTrue(any("build-index" in s for s in log), f"build-index not called; log={log}")

    def test_unarchive_triggers_index_rebuild(self):
        self._km("unarch-rb", archived=True)
        log, patch = self._tracking_run()
        with patch:
            status, _ = self.post("knowledge/unarchive", {"id": "unarch-rb"})
        self.assertEqual(status, 200)
        self.assertTrue(any("build-index" in s for s in log), f"build-index not called; log={log}")


# ── _extract_snippet (pure-function) ──────────────────────────────────────────

class TestExtractSnippet(unittest.TestCase):

    def setUp(self):
        self.td = Path(tempfile.mkdtemp())

    def tearDown(self):
        shutil.rmtree(self.td, ignore_errors=True)

    def _write(self, name, content):
        p = self.td / name
        p.write_text(content, encoding="utf-8")
        return p

    def test_returns_none_for_missing_file(self):
        result = _server._extract_snippet(self.td, "knowledge/missing.md", "anything")
        self.assertIsNone(result)

    def test_returns_none_when_query_absent(self):
        self._write("k.md", "---\ntitle: T\n---\n\nBody without the term.")
        result = _server._extract_snippet(self.td, "k.md", "xyznotfound")
        self.assertIsNone(result)

    def test_returns_none_for_empty_query(self):
        self._write("k.md", "---\ntitle: T\n---\n\nBody.")
        result = _server._extract_snippet(self.td, "k.md", "")
        self.assertIsNone(result)

    def test_finds_match_in_body(self):
        self._write("k.md", "---\ntitle: T\n---\n\nThe hidden concept lives here.")
        result = _server._extract_snippet(self.td, "k.md", "hidden concept")
        self.assertIsNotNone(result)
        self.assertIn("hidden concept", result)

    def test_case_insensitive_match(self):
        self._write("k.md", "---\ntitle: T\n---\n\nHIDDEN concept here.")
        result = _server._extract_snippet(self.td, "k.md", "hidden concept")
        self.assertIsNotNone(result)

    def test_excludes_frontmatter_from_search(self):
        # query only present in frontmatter — should NOT match
        self._write("k.md", "---\ntitle: secretword\n---\n\nBody without it.")
        result = _server._extract_snippet(self.td, "k.md", "secretword")
        self.assertIsNone(result)

    def test_long_body_adds_ellipsis(self):
        prefix = "x" * 200
        suffix = "y" * 200
        self._write("k.md", f"---\ntitle: T\n---\n\n{prefix} needle {suffix}")
        result = _server._extract_snippet(self.td, "k.md", "needle")
        self.assertIsNotNone(result)
        self.assertIn("…", result)

    def test_match_at_start_no_leading_ellipsis(self):
        self._write("k.md", "---\ntitle: T\n---\n\nneedle is at start of body.")
        result = _server._extract_snippet(self.td, "k.md", "needle")
        self.assertIsNotNone(result)
        self.assertFalse(result.startswith("…"), f"Unexpected leading ellipsis: {result!r}")

    def test_relative_path_resolved_against_root(self):
        kdir = self.td / "knowledge"
        kdir.mkdir()
        (kdir / "e.md").write_text("---\ntitle: T\n---\n\nTarget term here.", encoding="utf-8")
        result = _server._extract_snippet(self.td, "knowledge/e.md", "target term")
        self.assertIsNotNone(result)


# ── full-text body search (HTTP) ───────────────────────────────────────────────

class TestFullTextSearch(ServerTestCase):
    """Verify /api/search matches inside .md file bodies, not just index metadata."""

    def _setup_entry(self, entry, body="Default body."):
        """Write both the index entry and the .md file."""
        self._idx(entry)
        kdir = self.td / "knowledge"
        kdir.mkdir(exist_ok=True)
        content = _SAMPLE_FM.format(
            eid=entry["id"], title=entry["title"],
            tags_json=json.dumps(entry.get("tags", [])), body=body,
        )
        (kdir / f"{entry['id']}.md").write_text(content, encoding="utf-8")

    def setUp(self):
        super().setUp()
        # Build entries where the body has content not reflected in metadata
        self._setup_entry(
            {**_ENTRY_A, "knowledge_file": f"knowledge/{_ENTRY_A['id']}.md"},
            body="This entry discusses the synaptic routing algorithm in detail.",
        )
        self._setup_entry(
            {**_ENTRY_B, "knowledge_file": f"knowledge/{_ENTRY_B['id']}.md"},
            body="Beta jobs use a queue-based dispatcher.",
        )
        self._all([
            {**_ENTRY_A, "knowledge_file": f"knowledge/{_ENTRY_A['id']}.md"},
            {**_ENTRY_B, "knowledge_file": f"knowledge/{_ENTRY_B['id']}.md"},
        ])

    def test_body_only_match_returns_entry(self):
        # "synaptic" is in alpha's body but NOT in title/summary/tags
        _, data = self.get("search?q=synaptic+routing")
        ids = [e["id"] for e in data]
        self.assertIn("entry-alpha", ids)
        self.assertNotIn("entry-beta", ids)

    def test_body_match_includes_snippet_field(self):
        _, data = self.get("search?q=synaptic+routing")
        alpha = next(e for e in data if e["id"] == "entry-alpha")
        self.assertIn("snippet", alpha)
        self.assertIn("synaptic routing", alpha["snippet"])

    def test_metadata_match_without_body_match_has_no_snippet(self):
        # "alpha" is in _ENTRY_A's title/tags but NOT in its body
        _, data = self.get("search?q=alpha")
        alpha = next((e for e in data if e["id"] == "entry-alpha"), None)
        self.assertIsNotNone(alpha)
        self.assertNotIn("snippet", alpha)

    def test_metadata_and_body_match_includes_snippet(self):
        # "queue" is in beta body; "beta" is in title — both match, snippet from body
        _, data = self.get("search?q=queue")
        beta = next((e for e in data if e["id"] == "entry-beta"), None)
        self.assertIsNotNone(beta)
        self.assertIn("snippet", beta)

    def test_no_match_in_metadata_or_body_excluded(self):
        _, data = self.get("search?q=completelymissingterm")
        self.assertEqual(data, [])

    def test_body_search_is_case_insensitive(self):
        _, data = self.get("search?q=SYNAPTIC")
        ids = [e["id"] for e in data]
        self.assertIn("entry-alpha", ids)

    def test_body_match_respects_tag_filter(self):
        # alpha matches body but not the "beta" tag filter
        _, data = self.get("search?q=synaptic+routing&tags=beta")
        self.assertEqual(data, [])

    def test_no_query_returns_all_without_snippets(self):
        _, data = self.get("search")
        self.assertEqual(len(data), 2)
        for e in data:
            self.assertNotIn("snippet", e)


if __name__ == "__main__":
    unittest.main(verbosity=2)
