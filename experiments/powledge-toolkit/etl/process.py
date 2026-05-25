#!/usr/bin/env python3
"""process.py — ETL: raw/ → knowledge/ + index/*.index.json

Usage:
  python etl/process.py --all              # process all raw/*.md files
  python etl/process.py --pending          # only files not yet in knowledge/
  python etl/process.py raw/abc123.md      # one or more specific files

Reads powledge.config.json for ETL and Claude settings.
Set ANTHROPIC_API_KEY to enable Claude-powered summaries (use_for_etl must also be true).
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
from config import ensure_dirs, index_dir, knowledge_dir, load_config, raw_dir


# ---------------------------------------------------------------------------
# Frontmatter parsing
# ---------------------------------------------------------------------------

def parse_frontmatter(text: str) -> tuple[dict, str]:
    """Parse leading YAML-like frontmatter. Returns (meta_dict, body)."""
    if not text.startswith("---"):
        return {}, text

    end = text.find("\n---", 3)
    if end == -1:
        return {}, text

    fm_text = text[3:end].strip()
    body = text[end + 4:].lstrip("\n")

    meta = {}
    for line in fm_text.splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key = key.strip()
        value = value.strip()

        if value.startswith("[") or value.startswith("{"):
            try:
                meta[key] = json.loads(value)
                continue
            except json.JSONDecodeError:
                pass

        if len(value) >= 2 and value[0] == value[-1] and value[0] in ('"', "'"):
            value = value[1:-1]

        meta[key] = value

    return meta, body


# ---------------------------------------------------------------------------
# Summary generation
# ---------------------------------------------------------------------------

def generate_summary_local(content: str) -> str:
    """Extract and clean the first substantive paragraph as a summary."""
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


def call_claude(prompt: str, model: str) -> str:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY not set")

    payload = json.dumps({
        "model": model,
        "max_tokens": 512,
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


def generate_summary_claude(title: str, content: str, model: str) -> str:
    truncated = content[:8000] + ("..." if len(content) > 8000 else "")
    prompt = (
        "Write a 2-3 sentence summary of the document below. "
        "Be specific about key information, purpose, and main topics. "
        "Output only the summary text.\n\n"
        f"Title: {title}\n\nContent:\n{truncated}"
    )
    return call_claude(prompt, model)


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------

def pending_raw_files(raw: Path, knowledge: Path) -> list[Path]:
    """Return raw/*.md files that have a .meta.json sidecar but no knowledge file yet."""
    result = []
    for raw_file in sorted(raw.glob("*.md")):
        if not raw_file.with_suffix(".meta.json").exists():
            continue
        if not (knowledge / raw_file.name).exists():
            result.append(raw_file)
    return result


def process_file(
    raw_file: Path,
    knowledge: Path,
    idx: Path,
    config: dict,
) -> bool:
    """Process one raw file → knowledge + index entry. Returns True if written."""
    try:
        text = raw_file.read_text(encoding="utf-8")
    except OSError as e:
        print(f"  error reading {raw_file.name}: {e}", file=sys.stderr)
        return False

    meta, content = parse_frontmatter(text)
    if not meta:
        print(f"  no frontmatter in {raw_file.name}, skipping", file=sys.stderr)
        return False

    file_id = meta.get("id") or raw_file.stem
    knowledge_file = knowledge / f"{file_id}.md"

    if knowledge_file.exists() and not config.get("etl", {}).get("overwrite_existing", False):
        return False

    claude_cfg = config.get("claude", {})
    use_claude = claude_cfg.get("use_for_etl", False) and bool(os.environ.get("ANTHROPIC_API_KEY"))
    model = claude_cfg.get("model", "claude-sonnet-4-6")

    if use_claude:
        try:
            summary = generate_summary_claude(meta.get("title", ""), content, model)
        except Exception as e:
            print(f"  Claude failed ({e}), using local summary", file=sys.stderr)
            summary = generate_summary_local(content)
    else:
        summary = generate_summary_local(content)

    knowledge.mkdir(parents=True, exist_ok=True)
    knowledge_file.write_text(text, encoding="utf-8")

    idx.mkdir(parents=True, exist_ok=True)
    index_entry = {
        "id": file_id,
        "title": meta.get("title", ""),
        "summary": summary,
        "tags": meta.get("tags", []),
        "source": meta.get("source", ""),
        "date": meta.get("date", ""),
        "knowledge_file": f"{knowledge.name}/{file_id}.md",
    }
    (idx / f"{file_id}.index.json").write_text(
        json.dumps(index_entry, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )

    return True


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="ETL: raw/ → knowledge/ + index/")
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--all", action="store_true", help="Process all raw/*.md files")
    group.add_argument("--pending", action="store_true",
                       help="Process only files not yet in knowledge/")
    parser.add_argument("files", nargs="*", metavar="FILE",
                        help="Specific raw file path(s) to process")
    args = parser.parse_args()

    config = load_config()
    ensure_dirs(config)
    raw = raw_dir(config)
    knowledge = knowledge_dir(config)
    idx = index_dir(config)

    if args.all:
        files = sorted(raw.glob("*.md"))
    elif args.pending:
        files = pending_raw_files(raw, knowledge)
    elif args.files:
        files = [Path(f) for f in args.files]
    else:
        parser.error("Specify --all, --pending, or one or more FILE paths")

    if not files:
        print("Nothing to process.")
        return

    written = skipped = 0
    for f in files:
        ok = process_file(f, knowledge, idx, config)
        if ok:
            print(f"  + {f.name}")
            written += 1
        else:
            skipped += 1

    print(f"\nDone: {written} written, {skipped} skipped.")


if __name__ == "__main__":
    main()
