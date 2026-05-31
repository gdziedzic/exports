#!/usr/bin/env python3
"""refresh-summary.py — regenerate the summary for a single knowledge entry.

Usage:
  python etl/refresh-summary.py <entry-id>

Reads the live knowledge file, generates a fresh summary (Claude or local),
updates the entry's .index.json (clearing summary_stale), and rebuilds all.json.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from config import index_dir, knowledge_dir, load_config


def parse_frontmatter(text):
    if not text.startswith("---"):
        return {}, text
    end = text.find("\n---", 3)
    if end == -1:
        return {}, text
    body = text[end + 4:].lstrip("\n")
    meta = {}
    for line in text[3:end].strip().splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        v = v.strip()
        if v.startswith("[") or v.startswith("{"):
            try:
                meta[k.strip()] = json.loads(v)
                continue
            except json.JSONDecodeError:
                pass
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
            v = v[1:-1]
        meta[k.strip()] = v
    return meta, body


def generate_summary_local(content):
    for para in re.split(r"\n\n+", content):
        para = para.strip()
        if not para or para.startswith("#") or para.startswith("---") or para.startswith("|"):
            continue
        para = re.sub(r"\*{1,2}([^*]+)\*{1,2}", r"\1", para)
        para = re.sub(r"`([^`]+)`", r"\1", para)
        para = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", para)
        para = re.sub(r"\s+", " ", para).strip()
        if para:
            return para[:300] + ("..." if len(para) > 300 else "")
    return ""


def generate_summary_claude(title, content, model):
    import urllib.error
    import urllib.request

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")
    truncated = content[:8000] + ("..." if len(content) > 8000 else "")
    prompt = (
        "Write a 2-3 sentence summary of the document below. "
        "Be specific about key information, purpose, and main topics. "
        "Output only the summary text.\n\n"
        f"Title: {title}\n\nContent:\n{truncated}"
    )
    payload = json.dumps({
        "model": model, "max_tokens": 512,
        "messages": [{"role": "user", "content": prompt}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=payload,
        headers={"Content-Type": "application/json", "x-api-key": api_key,
                 "anthropic-version": "2023-06-01"},
        method="POST",
    )
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())["content"][0]["text"].strip()


def main():
    if len(sys.argv) != 2:
        sys.exit("Usage: refresh-summary.py <entry-id>")

    entry_id = sys.argv[1]
    config = load_config()
    kd  = knowledge_dir(config)
    idx = index_dir(config)

    kf = None
    for candidate in [kd / f"{entry_id}.md", kd / "archived" / f"{entry_id}.md"]:
        if candidate.exists():
            kf = candidate
            break

    if kf is None:
        sys.exit(f"Entry not found: {entry_id}")

    content = kf.read_text("utf-8")
    meta, body = parse_frontmatter(content)

    claude_cfg = config.get("claude", {})
    use_claude = claude_cfg.get("use_for_etl", False) and bool(os.environ.get("ANTHROPIC_API_KEY"))
    model = claude_cfg.get("model", "claude-sonnet-4-6")

    if use_claude:
        try:
            summary = generate_summary_claude(meta.get("title", ""), body, model)
        except Exception as e:
            print(f"Claude failed ({e}), using local summary", file=sys.stderr)
            summary = generate_summary_local(body)
    else:
        summary = generate_summary_local(body)

    idx_file = idx / f"{entry_id}.index.json"
    if not idx_file.exists():
        sys.exit(f"Index entry not found: {entry_id}")

    idx_data = json.loads(idx_file.read_text("utf-8"))
    idx_data["summary"] = summary
    idx_data.pop("summary_stale", None)
    idx_file.write_text(json.dumps(idx_data, ensure_ascii=False, indent=2), encoding="utf-8")

    subprocess.run(
        [sys.executable, str(Path(__file__).parent / "build-index.py")],
        cwd=str(Path(__file__).parent.parent),
    )
    print(f"Summary refreshed for {entry_id}")


if __name__ == "__main__":
    main()
