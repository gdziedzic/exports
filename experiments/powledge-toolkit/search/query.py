#!/usr/bin/env python3
"""query.py — answer a question from the knowledge base using Claude.

Usage:
  python search/query.py "What is the ETL pipeline?"
  python search/query.py --tags etl "How are jobs scheduled?"
  python search/query.py --top 5 "Summarize security policies"
  python search/query.py --ids aaa,bbb "What do these pages cover?"

Requires ANTHROPIC_API_KEY.
"""

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import index_dir, load_config


# ---------------------------------------------------------------------------
# Index loading (self-contained — mirrors list-index.py)
# ---------------------------------------------------------------------------

def load_entries(idx_dir: Path) -> list:
    entries = []
    if not idx_dir.exists():
        return entries
    for f in sorted(idx_dir.glob("*.index.json")):
        try:
            entries.append(json.loads(f.read_text(encoding="utf-8")))
        except (json.JSONDecodeError, OSError):
            pass
    return entries


# ---------------------------------------------------------------------------
# Scoring
# ---------------------------------------------------------------------------

def score_entries(entries: list, query: str) -> list:
    """Return entries sorted by keyword relevance to query (descending)."""
    words = set(re.sub(r"[^\w\s]", "", query.lower()).split())
    if not words:
        return list(entries)

    scored = []
    for entry in entries:
        title_words = set(re.sub(r"[^\w\s]", "", entry.get("title", "").lower()).split())
        summary_words = set(re.sub(r"[^\w\s]", "", entry.get("summary", "").lower()).split())
        tag_words = {t.lower() for t in entry.get("tags", [])}

        score = (
            len(words & title_words) * 3
            + len(words & summary_words) * 2
            + len(words & tag_words) * 2
        )
        scored.append((score, entry))

    scored.sort(key=lambda x: -x[0])
    return [e for _, e in scored]


# ---------------------------------------------------------------------------
# Content loading
# ---------------------------------------------------------------------------

def load_knowledge_content(knowledge_file: str, root: Path) -> str:
    """Read a knowledge file, resolving relative paths against the toolkit root."""
    path = Path(knowledge_file)
    if not path.is_absolute():
        path = root / path
    try:
        return path.read_text(encoding="utf-8")
    except OSError:
        return ""


# ---------------------------------------------------------------------------
# Prompt building
# ---------------------------------------------------------------------------

def build_prompt(question: str, contexts: list[tuple[str, str, str]]) -> str:
    """Build the Claude prompt. contexts = [(id, title, content), ...]"""
    doc_blocks = []
    for doc_id, title, content in contexts:
        truncated = content[:6000] + ("..." if len(content) > 6000 else "")
        doc_blocks.append(f"--- [{title} | ID: {doc_id}] ---\n{truncated}")

    docs_text = "\n\n".join(doc_blocks)
    return (
        "You are a knowledge assistant. Answer the question below based solely on "
        "the provided context documents. If the answer is not in the documents, say "
        "so explicitly.\n\n"
        f"Context:\n\n{docs_text}\n\n"
        f"Question: {question}"
    )


# ---------------------------------------------------------------------------
# Claude call
# ---------------------------------------------------------------------------

def call_claude(prompt: str, model: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    payload = json.dumps({
        "model": model,
        "max_tokens": 2048,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()

    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages",
        data=payload,
        headers={
            "Content-Type": "application/json",
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
        return data["content"][0]["text"].strip()
    except urllib.error.HTTPError as e:
        body = e.read().decode(errors="replace")
        raise RuntimeError(f"Claude API {e.code}: {body}") from e


# ---------------------------------------------------------------------------
# Query
# ---------------------------------------------------------------------------

def query(question: str, entries: list, config: dict, root: Path) -> str:
    """Find relevant knowledge files and answer the question with Claude."""
    if not entries:
        return "The knowledge base is empty."

    claude_cfg = config.get("claude", {})
    model = claude_cfg.get("model", "claude-sonnet-4-6")
    limit = claude_cfg.get("context_chunks_limit", 10)

    ranked = score_entries(entries, question)
    top = ranked[:limit]

    contexts = []
    for entry in top:
        kf = entry.get("knowledge_file", "")
        content = load_knowledge_content(kf, root) if kf else ""
        contexts.append((entry.get("id", ""), entry.get("title", ""), content))

    return call_claude(build_prompt(question, contexts), model)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Query the knowledge base with Claude")
    parser.add_argument("question", help="Question to answer")
    parser.add_argument("--tags", help="Restrict to entries with these tags (comma-separated, AND)")
    parser.add_argument("--top", type=int, default=None,
                        help="Override context_chunks_limit from config")
    parser.add_argument("--ids", help="Restrict to specific entry IDs (comma-separated)")
    args = parser.parse_args()

    if not os.environ.get("ANTHROPIC_API_KEY"):
        sys.exit("Error: ANTHROPIC_API_KEY not set")

    config = load_config()
    root = Path(__file__).parent.parent
    entries = load_entries(index_dir(config))

    if not entries:
        sys.exit("Knowledge base is empty. Run 'task etl:process -- --all' first.")

    if args.ids:
        wanted = {i.strip() for i in args.ids.split(",")}
        entries = [e for e in entries if e.get("id") in wanted]

    if args.tags:
        tags = [t.strip().lower() for t in args.tags.split(",") if t.strip()]
        entries = [
            e for e in entries
            if all(t in [x.lower() for x in e.get("tags", [])] for t in tags)
        ]

    if args.top is not None:
        config = {**config, "claude": {**config.get("claude", {}), "context_chunks_limit": args.top}}

    print(query(args.question, entries, config, root))


if __name__ == "__main__":
    main()
