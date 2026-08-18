"""build-index.py — aggregate all index/*.index.json into index/all.json.

Computes a `related` field for each entry: IDs that share at least one tag,
sorted by number of shared tags descending, capped at 5.

Entries in all.json are sorted by date descending.
"""

import json
import sys
from datetime import datetime, timezone
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


def sort_by_date(entries: list) -> list:
    return sorted(entries, key=lambda e: e.get("date", ""), reverse=True)


def compute_related(entries: list) -> list:
    id_tags: dict = {}
    for entry in entries:
        eid = entry.get("id")
        if eid:
            id_tags[eid] = {t.lower() for t in entry.get("tags", [])}

    result = []
    for entry in entries:
        eid = entry.get("id")
        my_tags = id_tags.get(eid, set())
        if my_tags:
            scored = [
                (len(my_tags & other_tags), other_id)
                for other_id, other_tags in id_tags.items()
                if other_id != eid and (my_tags & other_tags)
            ]
            scored.sort(key=lambda x: (-x[0], x[1]))
            related = [oid for _, oid in scored[:5]]
        else:
            related = []
        result.append({**entry, "related": related})
    return result


def main():
    config = load_config()
    idx_dir = index_dir(config)
    entries = load_entries(idx_dir)
    entries = sort_by_date(entries)
    entries = compute_related(entries)

    generated_at = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    all_index = {
        "generated_at": generated_at,
        "count": len(entries),
        "entries": entries,
    }

    idx_dir.mkdir(parents=True, exist_ok=True)
    out_path = idx_dir / "all.json"
    out_path.write_text(json.dumps(all_index, indent=2, ensure_ascii=False), encoding="utf-8")

    with_related = sum(1 for e in entries if e.get("related"))
    print(f"Built {out_path} — {len(entries)} entries, {with_related} with related links")


if __name__ == "__main__":
    main()
