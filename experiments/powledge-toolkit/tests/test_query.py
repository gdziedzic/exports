"""Tests for search/query.py — scoring, prompt building, content loading, query."""

import importlib.util
import json
import sys
import tempfile
import unittest
import unittest.mock as mock
from pathlib import Path

_ROOT = Path(__file__).parent.parent


def _load_module(name, filepath):
    spec = importlib.util.spec_from_file_location(name, filepath)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


qm = _load_module("query", _ROOT / "search" / "query.py")

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

_ENTRY_AI = {
    "id": "aaa",
    "title": "AI Pipeline Overview",
    "summary": "Describes the AI data pipeline used in production.",
    "tags": ["ai", "etl"],
    "source": "https://example.com/a",
    "date": "2026-04-01",
    "knowledge_file": "knowledge/aaa.md",
}
_ENTRY_ETL = {
    "id": "bbb",
    "title": "ETL Architecture",
    "summary": "How ETL jobs are structured and scheduled.",
    "tags": ["etl"],
    "source": "https://example.com/b",
    "date": "2026-03-15",
    "knowledge_file": "knowledge/bbb.md",
}
_ENTRY_SEC = {
    "id": "ccc",
    "title": "Security Policies",
    "summary": "Access control and secret management.",
    "tags": ["security"],
    "source": "https://example.com/c",
    "date": "2026-02-20",
    "knowledge_file": "knowledge/ccc.md",
}

_CONFIG = {
    "claude": {"model": "claude-sonnet-4-6", "context_chunks_limit": 10},
}


# ---------------------------------------------------------------------------
# load_entries
# ---------------------------------------------------------------------------

class TestLoadEntries(unittest.TestCase):

    def test_empty_dir(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = qm.load_entries(Path(tmp))
            self.assertEqual(result, [])

    def test_nonexistent_dir(self):
        result = qm.load_entries(Path("/nonexistent/path/xyz"))
        self.assertEqual(result, [])

    def test_loads_index_files(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "aaa.index.json").write_text(json.dumps(_ENTRY_AI), encoding="utf-8")
            result = qm.load_entries(d)
            self.assertEqual(len(result), 1)
            self.assertEqual(result[0]["id"], "aaa")

    def test_ignores_all_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "aaa.index.json").write_text(json.dumps(_ENTRY_AI), encoding="utf-8")
            (d / "all.json").write_text(json.dumps({"entries": []}), encoding="utf-8")
            result = qm.load_entries(d)
            self.assertEqual(len(result), 1)

    def test_skips_malformed_json(self):
        with tempfile.TemporaryDirectory() as tmp:
            d = Path(tmp)
            (d / "bad.index.json").write_text("not json", encoding="utf-8")
            result = qm.load_entries(d)
            self.assertEqual(result, [])


# ---------------------------------------------------------------------------
# score_entries
# ---------------------------------------------------------------------------

class TestScoreEntries(unittest.TestCase):

    def test_empty_query_returns_all(self):
        entries = [_ENTRY_AI, _ENTRY_ETL, _ENTRY_SEC]
        result = qm.score_entries(entries, "")
        self.assertEqual(len(result), 3)

    def test_title_match_ranks_first(self):
        result = qm.score_entries([_ENTRY_AI, _ENTRY_ETL, _ENTRY_SEC], "AI Pipeline")
        self.assertEqual(result[0]["id"], "aaa")

    def test_tag_match_scores(self):
        result = qm.score_entries([_ENTRY_AI, _ENTRY_ETL, _ENTRY_SEC], "security")
        self.assertEqual(result[0]["id"], "ccc")

    def test_summary_match_scores(self):
        result = qm.score_entries([_ENTRY_AI, _ENTRY_ETL, _ENTRY_SEC], "scheduled")
        self.assertEqual(result[0]["id"], "bbb")

    def test_case_insensitive_matching(self):
        result = qm.score_entries([_ENTRY_AI, _ENTRY_ETL, _ENTRY_SEC], "etl architecture")
        self.assertEqual(result[0]["id"], "bbb")

    def test_no_match_still_returns_all(self):
        result = qm.score_entries([_ENTRY_AI, _ENTRY_ETL], "kubernetes")
        self.assertEqual(len(result), 2)

    def test_does_not_mutate_input(self):
        entries = [_ENTRY_AI, _ENTRY_ETL]
        original_order = [e["id"] for e in entries]
        qm.score_entries(entries, "something")
        self.assertEqual([e["id"] for e in entries], original_order)

    def test_returns_new_list(self):
        entries = [_ENTRY_AI, _ENTRY_ETL]
        result = qm.score_entries(entries, "")
        self.assertIsNot(result, entries)

    def test_missing_fields_handled(self):
        entry = {"id": "zzz"}
        result = qm.score_entries([entry], "anything")
        self.assertEqual(len(result), 1)


# ---------------------------------------------------------------------------
# load_knowledge_content
# ---------------------------------------------------------------------------

class TestLoadKnowledgeContent(unittest.TestCase):

    def test_loads_existing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            (knowledge / "aaa.md").write_text("Content here.", encoding="utf-8")

            result = qm.load_knowledge_content("knowledge/aaa.md", root)
            self.assertEqual(result, "Content here.")

    def test_missing_file_returns_empty(self):
        with tempfile.TemporaryDirectory() as tmp:
            result = qm.load_knowledge_content("knowledge/missing.md", Path(tmp))
            self.assertEqual(result, "")

    def test_absolute_path(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = Path(tmp) / "doc.md"
            f.write_text("Absolute content.", encoding="utf-8")
            result = qm.load_knowledge_content(str(f), Path("/ignored/root"))
            self.assertEqual(result, "Absolute content.")

    def test_empty_path_returns_empty(self):
        result = qm.load_knowledge_content("", Path("/some/root"))
        self.assertEqual(result, "")


# ---------------------------------------------------------------------------
# build_prompt
# ---------------------------------------------------------------------------

class TestBuildPrompt(unittest.TestCase):

    def test_contains_question(self):
        prompt = qm.build_prompt("What is ETL?", [("aaa", "AI Pipeline", "Some content.")])
        self.assertIn("What is ETL?", prompt)

    def test_contains_document_title(self):
        prompt = qm.build_prompt("Q?", [("aaa", "AI Pipeline", "Content.")])
        self.assertIn("AI Pipeline", prompt)

    def test_contains_document_content(self):
        prompt = qm.build_prompt("Q?", [("aaa", "Title", "The actual content.")])
        self.assertIn("The actual content.", prompt)

    def test_contains_document_id(self):
        prompt = qm.build_prompt("Q?", [("abc123", "Title", "Content.")])
        self.assertIn("abc123", prompt)

    def test_multiple_documents(self):
        contexts = [("a", "Doc A", "Content A."), ("b", "Doc B", "Content B.")]
        prompt = qm.build_prompt("Q?", contexts)
        self.assertIn("Doc A", prompt)
        self.assertIn("Doc B", prompt)

    def test_long_content_truncated(self):
        long_content = "x " * 5000  # ~10K chars, exceeds 6K limit
        prompt = qm.build_prompt("Q?", [("a", "T", long_content)])
        self.assertIn("...", prompt)

    def test_short_content_not_truncated(self):
        content = "Short content."
        prompt = qm.build_prompt("Q?", [("a", "T", content)])
        self.assertIn(content, prompt)
        self.assertNotIn("...", prompt)

    def test_empty_contexts(self):
        prompt = qm.build_prompt("Q?", [])
        self.assertIn("Q?", prompt)

    def test_question_appears_at_end(self):
        prompt = qm.build_prompt("My question here?", [("a", "T", "Content.")])
        question_pos = prompt.rfind("My question here?")
        self.assertGreater(question_pos, 0)


# ---------------------------------------------------------------------------
# query (mocked Claude)
# ---------------------------------------------------------------------------

class TestQuery(unittest.TestCase):

    def test_returns_claude_response(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            (knowledge / "aaa.md").write_text("AI content here.", encoding="utf-8")

            with mock.patch.object(qm, "call_claude", return_value="Claude answer"):
                result = qm.query("What is AI?", [_ENTRY_AI], _CONFIG, root)

            self.assertEqual(result, "Claude answer")

    def test_empty_knowledge_base_no_api_call(self):
        with mock.patch.object(qm, "call_claude") as patched:
            result = qm.query("Q?", [], _CONFIG, Path("."))
        patched.assert_not_called()
        self.assertIn("empty", result.lower())

    def test_respects_context_limit(self):
        entries = [
            {"id": f"e{i}", "title": f"Doc {i}", "summary": "x", "tags": ["ai"],
             "knowledge_file": f"knowledge/e{i}.md"}
            for i in range(20)
        ]

        captured = []

        def fake_claude(prompt, model):
            captured.append(prompt)
            return "Answer"

        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            for i in range(20):
                (knowledge / f"e{i}.md").write_text("Content.", encoding="utf-8")

            config_limited = {**_CONFIG, "claude": {**_CONFIG["claude"], "context_chunks_limit": 3}}
            with mock.patch.object(qm, "call_claude", side_effect=fake_claude):
                qm.query("Q?", entries, config_limited, root)

        self.assertEqual(len(captured), 1)
        self.assertEqual(captured[0].count("--- ["), 3)

    def test_question_passed_to_claude(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            (knowledge / "aaa.md").write_text("Content.", encoding="utf-8")

            with mock.patch.object(qm, "call_claude", return_value="OK") as patched:
                qm.query("My specific question?", [_ENTRY_AI], _CONFIG, root)

            prompt_arg = patched.call_args[0][0]
            self.assertIn("My specific question?", prompt_arg)

    def test_model_passed_to_claude(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            knowledge = root / "knowledge"
            knowledge.mkdir()
            (knowledge / "aaa.md").write_text("Content.", encoding="utf-8")

            config_custom = {**_CONFIG, "claude": {**_CONFIG["claude"], "model": "claude-opus-4-7"}}
            with mock.patch.object(qm, "call_claude", return_value="OK") as patched:
                qm.query("Q?", [_ENTRY_AI], config_custom, root)

            model_arg = patched.call_args[0][1]
            self.assertEqual(model_arg, "claude-opus-4-7")

    def test_missing_knowledge_file_handled(self):
        entry_no_file = {**_ENTRY_AI, "knowledge_file": "knowledge/nonexistent.md"}

        with tempfile.TemporaryDirectory() as tmp:
            with mock.patch.object(qm, "call_claude", return_value="OK"):
                result = qm.query("Q?", [entry_no_file], _CONFIG, Path(tmp))

        self.assertEqual(result, "OK")


if __name__ == "__main__":
    unittest.main()
