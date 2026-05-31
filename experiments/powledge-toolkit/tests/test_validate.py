"""Tests for run_validations() and GET /api/validate.

Uses an isolated temp directory for all file-system operations so no real
toolkit state is touched.  HTTP-level tests reuse the ServerTestCase
infrastructure from test_server.py.
"""

import importlib.util
import json
import os
import shutil
import sys
import tempfile
import threading
import unittest
import unittest.mock as mock
import urllib.error
import urllib.request
from http.server import HTTPServer
from pathlib import Path

_ROOT = Path(__file__).parent.parent

_spec = importlib.util.spec_from_file_location("powledge_server", _ROOT / "server.py")
_server = importlib.util.module_from_spec(_spec)
sys.modules["powledge_server"] = _server
_spec.loader.exec_module(_server)


# ── helpers ────────────────────────────────────────────────────────────────────

_VALID_CFG = {
    "dirs": {"raw": "raw", "knowledge": "knowledge", "index": "index"},
    "claude": {
        "model": "claude-sonnet-4-6",
        "use_for_etl": False,
        "use_for_query": False,
        "context_chunks_limit": 10,
    },
    "ui": {
        "backup_on_update": True,
        "max_backups_per_entry": 10,
        "max_content_bytes": 1_048_576,
        "require_title": True,
        "default_tags": [],
    },
    "confluence": {},
}

_PLACEHOLDER_SCRIPT = "# placeholder\n"
_SYNTAX_BROKEN_SCRIPT = "def f(\n  # unclosed paren — deliberate syntax error\n"

_SCRIPT_RELS = [
    "etl/process.py", "etl/build-index.py", "etl/refresh-summary.py",
    "search/query.py", "search/list-index.py", "ingest/confluence.py",
    "config.py", "server.py",
]


class ValidateBase(unittest.TestCase):
    """Isolated temp-dir fixture for run_validations() unit tests."""

    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
        (self.td / "powledge.config.json").write_text(json.dumps(_VALID_CFG), encoding="utf-8")
        for d in ("raw", "knowledge", "index"):
            (self.td / d).mkdir()
        for d in ("etl", "search", "ingest"):
            (self.td / d).mkdir(exist_ok=True)
        for rel in _SCRIPT_RELS:
            (self.td / rel).write_text(_PLACEHOLDER_SCRIPT, encoding="utf-8")

    def tearDown(self):
        shutil.rmtree(self.td, ignore_errors=True)

    def _run(self):
        checks, elapsed_ms = _server.run_validations(self.td)
        return {c["id"]: c for c in checks}, elapsed_ms

    def _write_cfg(self, cfg):
        (self.td / "powledge.config.json").write_text(json.dumps(cfg), encoding="utf-8")


# ── system checks ──────────────────────────────────────────────────────────────

class TestSystemChecks(ValidateBase):

    def test_python_version_ok_on_current_interpreter(self):
        by_id, _ = self._run()
        c = by_id["sys_python"]
        self.assertEqual(c["status"], "ok")
        self.assertIn(str(sys.version_info.major), c["message"])

    def test_python_version_message_includes_minor(self):
        by_id, _ = self._run()
        msg = by_id["sys_python"]["message"]
        self.assertIn(f"{sys.version_info.major}.{sys.version_info.minor}", msg)

    def test_disk_space_check_present(self):
        by_id, _ = self._run()
        self.assertIn("sys_disk", by_id)
        self.assertIn("MB free", by_id["sys_disk"]["message"])

    def test_disk_space_status_is_valid(self):
        by_id, _ = self._run()
        self.assertIn(by_id["sys_disk"]["status"], ("ok", "warn", "error"))

    def test_elapsed_ms_is_non_negative_int(self):
        _, elapsed_ms = self._run()
        self.assertIsInstance(elapsed_ms, int)
        self.assertGreaterEqual(elapsed_ms, 0)


# ── config checks ──────────────────────────────────────────────────────────────

class TestConfigChecks(ValidateBase):

    def test_valid_config_passes(self):
        by_id, _ = self._run()
        self.assertEqual(by_id["config_exists"]["status"], "ok")
        self.assertEqual(by_id["config_dirs"]["status"], "ok")
        self.assertEqual(by_id["config_types"]["status"], "ok")

    def test_missing_config_file(self):
        (self.td / "powledge.config.json").unlink()
        by_id, _ = self._run()
        c = by_id["config_exists"]
        self.assertEqual(c["status"], "error")
        self.assertIn("not found", c["message"].lower())

    def test_corrupt_json_config(self):
        (self.td / "powledge.config.json").write_text("{bad json!!!", encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["config_exists"]
        self.assertEqual(c["status"], "error")
        self.assertIn("Invalid JSON", c["message"])

    def test_missing_dirs_key(self):
        cfg = {**_VALID_CFG, "dirs": {"raw": "raw"}}  # missing knowledge + index
        self._write_cfg(cfg)
        by_id, _ = self._run()
        c = by_id["config_dirs"]
        self.assertEqual(c["status"], "error")
        self.assertIn("knowledge", c["message"])
        self.assertIn("index", c["message"])

    def test_bad_chunks_limit_type(self):
        cfg = {**_VALID_CFG, "claude": {**_VALID_CFG["claude"], "context_chunks_limit": "ten"}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        c = by_id["config_types"]
        self.assertEqual(c["status"], "error")
        self.assertIn("context_chunks_limit", c["message"])

    def test_chunks_limit_zero_is_error(self):
        cfg = {**_VALID_CFG, "claude": {**_VALID_CFG["claude"], "context_chunks_limit": 0}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["config_types"]["status"], "error")

    def test_bad_ui_bool(self):
        cfg = {**_VALID_CFG, "ui": {**_VALID_CFG["ui"], "backup_on_update": "yes"}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        c = by_id["config_types"]
        self.assertEqual(c["status"], "error")
        self.assertIn("backup_on_update", c["message"])

    def test_bad_require_title_bool(self):
        cfg = {**_VALID_CFG, "ui": {**_VALID_CFG["ui"], "require_title": 1}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["config_types"]["status"], "error")

    def test_max_content_bytes_too_small(self):
        cfg = {**_VALID_CFG, "ui": {**_VALID_CFG["ui"], "max_content_bytes": 100}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["config_types"]["status"], "error")

    def test_default_tags_not_list(self):
        cfg = {**_VALID_CFG, "ui": {**_VALID_CFG["ui"], "default_tags": "tag1,tag2"}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["config_types"]["status"], "error")

    def test_default_tags_non_string_items(self):
        cfg = {**_VALID_CFG, "ui": {**_VALID_CFG["ui"], "default_tags": [1, 2]}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["config_types"]["status"], "error")

    def test_multiple_type_errors_all_reported(self):
        cfg = {
            **_VALID_CFG,
            "claude": {**_VALID_CFG["claude"], "context_chunks_limit": "bad"},
            "ui": {**_VALID_CFG["ui"], "backup_on_update": "yes"},
        }
        self._write_cfg(cfg)
        by_id, _ = self._run()
        msg = by_id["config_types"]["message"]
        self.assertIn("context_chunks_limit", msg)
        self.assertIn("backup_on_update", msg)


# ── environment checks ─────────────────────────────────────────────────────────

class TestEnvironmentChecks(ValidateBase):

    def _run_without_key(self):
        env = {k: v for k, v in os.environ.items() if k != "ANTHROPIC_API_KEY"}
        with mock.patch.dict(os.environ, env, clear=True):
            return self._run()

    def test_api_key_set(self):
        with mock.patch.dict(os.environ, {"ANTHROPIC_API_KEY": "sk-test-key"}):
            by_id, _ = self._run()
        self.assertEqual(by_id["env_api_key"]["status"], "ok")

    def test_api_key_missing_warn_when_claude_disabled(self):
        # use_for_etl/query both False in _VALID_CFG
        by_id, _ = self._run_without_key()
        self.assertEqual(by_id["env_api_key"]["status"], "warn")

    def test_api_key_missing_error_when_etl_enabled(self):
        cfg = {**_VALID_CFG, "claude": {**_VALID_CFG["claude"], "use_for_etl": True}}
        self._write_cfg(cfg)
        by_id, _ = self._run_without_key()
        self.assertEqual(by_id["env_api_key"]["status"], "error")

    def test_api_key_missing_error_when_query_enabled(self):
        cfg = {**_VALID_CFG, "claude": {**_VALID_CFG["claude"], "use_for_query": True}}
        self._write_cfg(cfg)
        by_id, _ = self._run_without_key()
        self.assertEqual(by_id["env_api_key"]["status"], "error")


# ── directory checks ───────────────────────────────────────────────────────────

class TestDirectoryChecks(ValidateBase):

    def test_existing_writable_dirs_ok(self):
        by_id, _ = self._run()
        for key in ("raw", "knowledge", "index"):
            c = by_id[f"dir_{key}"]
            self.assertEqual(c["status"], "ok", f"dir_{key}: {c['message']}")
            self.assertIn("writable", c["message"])

    def test_missing_dir_is_warn(self):
        shutil.rmtree(self.td / "raw")
        by_id, _ = self._run()
        self.assertEqual(by_id["dir_raw"]["status"], "warn")
        self.assertIn("created", by_id["dir_raw"]["message"])

    def test_all_dirs_missing_all_warn(self):
        for d in ("raw", "knowledge", "index"):
            shutil.rmtree(self.td / d)
        by_id, _ = self._run()
        for key in ("raw", "knowledge", "index"):
            self.assertEqual(by_id[f"dir_{key}"]["status"], "warn")


# ── script checks (existence + syntax) ────────────────────────────────────────

class TestScriptChecks(ValidateBase):

    def test_all_scripts_present_and_valid(self):
        by_id, _ = self._run()
        for rel in _SCRIPT_RELS:
            id_ = "script_" + rel.replace("/", "_").replace("-", "_").replace(".py", "")
            # find by partial id match since IDs are derived differently
        # just check all script_* checks are ok
        script_checks = {k: v for k, v in by_id.items() if k.startswith("script_")}
        self.assertTrue(len(script_checks) > 0)
        for id_, c in script_checks.items():
            self.assertEqual(c["status"], "ok", f"{id_}: {c['message']}")

    def test_missing_script_is_error(self):
        (self.td / "etl" / "process.py").unlink()
        by_id, _ = self._run()
        c = by_id["script_etl_process"]
        self.assertEqual(c["status"], "error")
        self.assertIn("missing", c["message"].lower())

    def test_syntax_error_detected(self):
        (self.td / "etl" / "process.py").write_text(_SYNTAX_BROKEN_SCRIPT, encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["script_etl_process"]
        self.assertEqual(c["status"], "error")
        self.assertIn("Syntax error", c["message"])
        self.assertIn("line", c["message"])

    def test_syntax_error_includes_line_number(self):
        (self.td / "search" / "query.py").write_text("x = (1 +\n", encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["script_search_query"]
        self.assertEqual(c["status"], "error")
        # line number must be a digit in the message
        import re
        self.assertTrue(re.search(r'\d+', c["message"]), c["message"])

    def test_multiple_broken_scripts_all_flagged(self):
        (self.td / "etl" / "process.py").write_text(_SYNTAX_BROKEN_SCRIPT, encoding="utf-8")
        (self.td / "search" / "query.py").write_text(_SYNTAX_BROKEN_SCRIPT, encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["script_etl_process"]["status"], "error")
        self.assertEqual(by_id["script_search_query"]["status"], "error")

    def test_valid_multiline_script_passes(self):
        content = (
            "import json\n"
            "from pathlib import Path\n\n"
            "def main():\n"
            "    data = {}\n"
            "    return json.dumps(data)\n\n"
            "if __name__ == '__main__':\n"
            "    main()\n"
        )
        (self.td / "config.py").write_text(content, encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["script_config"]["status"], "ok")


# ── data health checks ─────────────────────────────────────────────────────────

class TestDataHealthChecks(ValidateBase):

    def test_no_all_json_is_warn(self):
        by_id, _ = self._run()
        self.assertEqual(by_id["data_index_all"]["status"], "warn")
        self.assertIn("Rebuild Index", by_id["data_index_all"]["message"])

    def test_valid_all_json_ok(self):
        data = {"entries": [{"id": "e1"}, {"id": "e2"}], "count": 2}
        (self.td / "index" / "all.json").write_text(json.dumps(data), encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["data_index_all"]
        self.assertEqual(c["status"], "ok")
        self.assertIn("2 entries", c["message"])

    def test_singular_entry_label(self):
        data = {"entries": [{"id": "e1"}], "count": 1}
        (self.td / "index" / "all.json").write_text(json.dumps(data), encoding="utf-8")
        by_id, _ = self._run()
        self.assertIn("1 entry", by_id["data_index_all"]["message"])

    def test_corrupt_all_json_is_error(self):
        (self.td / "index" / "all.json").write_text("{bad", encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["data_index_all"]["status"], "error")

    def test_pending_etl_detected(self):
        (self.td / "raw" / "new-page.md").write_text("content", encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["data_pending_etl"]
        self.assertEqual(c["status"], "warn")
        self.assertIn("1 raw", c["message"])

    def test_multiple_pending_counted(self):
        for i in range(3):
            (self.td / "raw" / f"page-{i}.md").write_text("content", encoding="utf-8")
        by_id, _ = self._run()
        self.assertIn("3 raw", by_id["data_pending_etl"]["message"])

    def test_processed_file_clears_pending(self):
        (self.td / "raw" / "done.md").write_text("raw", encoding="utf-8")
        (self.td / "knowledge" / "done.md").write_text("processed", encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["data_pending_etl"]["status"], "ok")

    def test_orphaned_index_detected(self):
        (self.td / "index" / "ghost.index.json").write_text(json.dumps({"id": "ghost"}), encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["data_orphaned_indexes"]
        self.assertEqual(c["status"], "warn")
        self.assertIn("ghost", c["message"])

    def test_no_orphaned_index_when_synced(self):
        (self.td / "index" / "e1.index.json").write_text(json.dumps({"id": "e1"}), encoding="utf-8")
        (self.td / "knowledge" / "e1.md").write_text("content", encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["data_orphaned_indexes"]["status"], "ok")

    def test_missing_index_for_knowledge_detected(self):
        (self.td / "knowledge" / "unindexed.md").write_text("content", encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["data_missing_indexes"]
        self.assertEqual(c["status"], "warn")
        self.assertIn("unindexed", c["message"])

    def test_no_missing_index_when_synced(self):
        (self.td / "index" / "k1.index.json").write_text(json.dumps({"id": "k1"}), encoding="utf-8")
        (self.td / "knowledge" / "k1.md").write_text("content", encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["data_missing_indexes"]["status"], "ok")

    def test_preview_truncates_long_orphan_list(self):
        for i in range(5):
            (self.td / "index" / f"ghost-{i}.index.json").write_text("{}", encoding="utf-8")
        by_id, _ = self._run()
        self.assertIn("…", by_id["data_orphaned_indexes"]["message"])

    def test_stale_summaries_detected(self):
        idx = {"id": "e1", "title": "T", "summary_stale": True}
        (self.td / "index" / "e1.index.json").write_text(json.dumps(idx), encoding="utf-8")
        data = {"entries": [{"id": "e1"}], "count": 1}
        (self.td / "index" / "all.json").write_text(json.dumps(data), encoding="utf-8")
        by_id, _ = self._run()
        c = by_id["data_stale_summaries"]
        self.assertEqual(c["status"], "warn")
        self.assertIn("1 entries", c["message"])

    def test_no_stale_summaries_ok(self):
        idx = {"id": "e1", "title": "T", "summary_stale": False}
        (self.td / "index" / "e1.index.json").write_text(json.dumps(idx), encoding="utf-8")
        data = {"entries": [{"id": "e1"}], "count": 1}
        (self.td / "index" / "all.json").write_text(json.dumps(data), encoding="utf-8")
        by_id, _ = self._run()
        self.assertEqual(by_id["data_stale_summaries"]["status"], "ok")


# ── confluence checks ──────────────────────────────────────────────────────────

class TestConfluenceChecks(ValidateBase):

    def test_not_configured_all_warn(self):
        by_id, _ = self._run()
        self.assertEqual(by_id["confluence_url"]["status"], "warn")
        self.assertEqual(by_id["confluence_creds"]["status"], "warn")
        self.assertEqual(by_id["confluence_scope"]["status"], "warn")

    def test_fully_configured_all_ok(self):
        cfg = {**_VALID_CFG, "confluence": {
            "base_url": "https://myorg.atlassian.net",
            "email": "dev@myorg.com",
            "space_keys": ["ENG"],
        }}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["confluence_url"]["status"], "ok")
        self.assertEqual(by_id["confluence_creds"]["status"], "ok")
        self.assertEqual(by_id["confluence_scope"]["status"], "ok")

    def test_scope_via_page_ids(self):
        cfg = {**_VALID_CFG, "confluence": {
            "base_url": "https://org.atlassian.net",
            "email": "x@y.com",
            "page_ids": ["123", "456"],
        }}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertEqual(by_id["confluence_scope"]["status"], "ok")
        self.assertIn("pages", by_id["confluence_scope"]["message"])

    def test_url_shown_in_message(self):
        cfg = {**_VALID_CFG, "confluence": {"base_url": "https://acme.atlassian.net"}}
        self._write_cfg(cfg)
        by_id, _ = self._run()
        self.assertIn("acme.atlassian.net", by_id["confluence_url"]["message"])


# ── check structure invariants ─────────────────────────────────────────────────

class TestCheckStructure(ValidateBase):

    def test_all_checks_have_required_fields(self):
        checks, _ = _server.run_validations(self.td)
        for c in checks:
            for field in ("id", "label", "script", "status", "message"):
                self.assertIn(field, c, f"Check {c.get('id', '?')} missing field '{field}'")

    def test_all_statuses_are_valid(self):
        checks, _ = _server.run_validations(self.td)
        for c in checks:
            self.assertIn(c["status"], ("ok", "warn", "error"), f"Invalid status in {c['id']}")

    def test_ids_are_unique(self):
        checks, _ = _server.run_validations(self.td)
        ids = [c["id"] for c in checks]
        self.assertEqual(len(ids), len(set(ids)), "Duplicate check IDs found")

    def test_at_least_20_checks_produced(self):
        checks, _ = _server.run_validations(self.td)
        self.assertGreaterEqual(len(checks), 20)


# ── HTTP endpoint ──────────────────────────────────────────────────────────────

_OK_PROC = __import__("subprocess").CompletedProcess([], 0, "", "")


class ServerTestBase(unittest.TestCase):
    """Minimal HTTP server fixture (subset of test_server.ServerTestCase)."""

    def setUp(self):
        self.td = Path(tempfile.mkdtemp())
        for d in ("raw", "knowledge", "index"):
            (self.td / d).mkdir()
        (self.td / "knowledge" / "archived").mkdir()
        (self.td / "ui").mkdir()
        shutil.copy(_ROOT / "ui" / "index.html", self.td / "ui" / "index.html")
        (self.td / "powledge.config.json").write_text(json.dumps(_VALID_CFG), encoding="utf-8")
        for sub in ("etl", "search", "ingest"):
            (self.td / sub).mkdir(exist_ok=True)
        for rel in _SCRIPT_RELS:
            (self.td / rel).write_text(_PLACEHOLDER_SCRIPT, encoding="utf-8")

        self._orig_root = _server.ROOT
        _server.ROOT = self.td
        self._lc = mock.patch.object(_server, "load_config", side_effect=lambda *a, **k: _VALID_CFG)
        self._gd = mock.patch.object(
            _server, "get_dir",
            side_effect=lambda cfg, key: self.td / cfg["dirs"][key],
        )
        self._lc.start(); self._gd.start()
        self._run_patch = mock.patch.object(_server, "run", return_value=_OK_PROC)
        self._run_patch.start()

        self._httpd = HTTPServer(("127.0.0.1", 0), _server.Handler)
        self.port = self._httpd.server_address[1]
        t = threading.Thread(target=self._httpd.serve_forever)
        t.daemon = True; t.start()
        self._thread = t

    def tearDown(self):
        self._httpd.shutdown()
        self._thread.join(timeout=3)
        self._run_patch.stop(); self._lc.stop(); self._gd.stop()
        _server.ROOT = self._orig_root
        shutil.rmtree(self.td, ignore_errors=True)

    def _get(self, path):
        url = f"http://127.0.0.1:{self.port}/api/{path}"
        req = urllib.request.Request(url)
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read()) if e.read else {}

    def _post(self, path, body=None):
        url = f"http://127.0.0.1:{self.port}/api/{path}"
        data = json.dumps(body or {}).encode()
        req = urllib.request.Request(url, data=data, method="POST",
                                      headers={"Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=5) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            try:
                return e.code, json.loads(e.read())
            except Exception:
                return e.code, {}


class TestValidateEndpoint(ServerTestBase):

    def test_returns_200(self):
        status, _ = self._get("validate")
        self.assertEqual(status, 200)

    def test_response_has_required_top_level_fields(self):
        _, data = self._get("validate")
        for field in ("checks", "ok", "warn", "error", "elapsed_ms"):
            self.assertIn(field, data)

    def test_counts_match_checks_list(self):
        _, data = self._get("validate")
        checks = data["checks"]
        self.assertEqual(data["ok"],    sum(1 for c in checks if c["status"] == "ok"))
        self.assertEqual(data["warn"],  sum(1 for c in checks if c["status"] == "warn"))
        self.assertEqual(data["error"], sum(1 for c in checks if c["status"] == "error"))

    def test_total_checks_at_least_20(self):
        _, data = self._get("validate")
        self.assertGreaterEqual(len(data["checks"]), 20)

    def test_each_check_has_required_fields(self):
        _, data = self._get("validate")
        for c in data["checks"]:
            for field in ("id", "label", "script", "status", "message"):
                self.assertIn(field, c, f"check {c.get('id')} missing {field}")

    def test_all_status_values_valid(self):
        _, data = self._get("validate")
        for c in data["checks"]:
            self.assertIn(c["status"], ("ok", "warn", "error"))

    def test_elapsed_ms_is_non_negative_int(self):
        _, data = self._get("validate")
        self.assertIsInstance(data["elapsed_ms"], int)
        self.assertGreaterEqual(data["elapsed_ms"], 0)

    def test_post_not_allowed(self):
        status, _ = self._post("validate", {})
        self.assertEqual(status, 404)

    def test_works_when_config_missing(self):
        cfg_path = self.td / "powledge.config.json"
        cfg_path.unlink()
        try:
            status, data = self._get("validate")
            self.assertEqual(status, 200)
            config_check = next(c for c in data["checks"] if c["id"] == "config_exists")
            self.assertEqual(config_check["status"], "error")
        finally:
            cfg_path.write_text(json.dumps(_VALID_CFG), encoding="utf-8")

    def test_works_when_config_corrupt(self):
        cfg_path = self.td / "powledge.config.json"
        original = cfg_path.read_text("utf-8")
        cfg_path.write_text("{bad json!!", encoding="utf-8")
        try:
            status, data = self._get("validate")
            self.assertEqual(status, 200)
            config_check = next(c for c in data["checks"] if c["id"] == "config_exists")
            self.assertEqual(config_check["status"], "error")
            self.assertIn("Invalid JSON", config_check["message"])
        finally:
            cfg_path.write_text(original, encoding="utf-8")

    def test_ids_are_unique_in_response(self):
        _, data = self._get("validate")
        ids = [c["id"] for c in data["checks"]]
        self.assertEqual(len(ids), len(set(ids)))

    def test_other_routes_return_503_not_crash_when_config_broken(self):
        """All non-validate routes must return a JSON 503 (not drop the connection)
        when config loading raises."""
        boom = FileNotFoundError("powledge.config.json not found")
        with mock.patch.object(_server, "load_config", side_effect=boom):
            for path in ("status", "index", "tags"):
                status, data = self._get(path)
                self.assertEqual(status, 503,
                    f"GET {path} must return 503 when config raises, got {status}")
                self.assertIn("error", data,
                    f"GET {path} must return JSON body with 'error' key")
                self.assertIn("Config error", data["error"],
                    f"GET {path} error must mention 'Config error'")


if __name__ == "__main__":
    unittest.main(verbosity=2)
