"""list-index.py — read all index/*.index.json files and print as JSON.

Usage:
  python search/list-index.py
  python search/list-index.py --tags ai,etl
  python search/list-index.py --search "query text"
  python search/list-index.py --fields id,title,summary
  python search/list-index.py --format lines
"""

import argparse
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from config import index_dir, load_config


def load_entries(idx_dir: Path) -> list:
    entries = []
    if not idx_dir.exists():
        return entries
    for f in sorted(idx_dir.glob("*.index.json")):
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            entries.append(data)
        except (json.JSONDecodeError, OSError):
            pass
    return entries


def filter_tags(entries: list, tags: list) -> list:
    tags_lower = [t.lower() for t in tags]
    result = []
    for entry in entries:
        entry_tags = [t.lower() for t in entry.get("tags", [])]
        if all(t in entry_tags for t in tags_lower):
            result.append(entry)
    return result


def filter_search(entries: list, query: str) -> list:
    q = query.lower()
    return [
        e for e in entries
        if q in (e.get("title", "") + " " + e.get("summary", "")).lower()
    ]


def select_fields(entries: list, fields: list) -> list:
    return [{f: e[f] for f in fields if f in e} for e in entries]


def main():
    parser = argparse.ArgumentParser(description="List knowledge base index entries")
    parser.add_argument("--tags", help="Tags to filter by, comma or space separated (AND logic)")
    parser.add_argument("--search", help="Keyword filter on title and summary")
    parser.add_argument("--fields", help="Comma-separated fields to include")
    parser.add_argument(
        "--format",
        choices=["json", "lines"],
        default="json",
        help="Output format: json array (default) or newline-delimited objects",
    )
    args = parser.parse_args()

    config = load_config()
    entries = load_entries(index_dir(config))

    if args.tags:
        tags = [t.strip() for t in args.tags.replace(",", " ").split() if t.strip()]
        if tags:
            entries = filter_tags(entries, tags)

    if args.search:
        entries = filter_search(entries, args.search)

    if args.fields:
        fields = [f.strip() for f in args.fields.split(",") if f.strip()]
        entries = select_fields(entries, fields)

    if args.format == "lines":
        for entry in entries:
            print(json.dumps(entry, ensure_ascii=False))
    else:
        print(json.dumps(entries, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
