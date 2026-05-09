# powledge-toolkit — Plan

## Architecture

```
powledge.config.json          ← global config
ingest/                       ← ingestion scripts (one per source)
raw/                          ← dropped/ingested files as-is (configurable)
knowledge/                    ← clean markdown knowledge files (configurable)
index/                        ← index files, one per knowledge file (configurable)
etl/                          ← ETL pipeline scripts
search/                       ← retrieval/query tools
```

---

## `powledge.config.json`

```json
{
  "dirs": {
    "raw":       "raw",
    "knowledge": "knowledge",
    "index":     "index"
  },
  "ingest": {
    "preferred_format": "markdown",
    "fallback_formats": ["html", "txt", "pdf"],
    "auto_etl_on_ingest": false,
    "dedup_by": "source_url"
  },
  "etl": {
    "chunk_strategy": "by_heading",
    "max_chunk_chars": 4000,
    "include_source_metadata": true,
    "overwrite_existing": false
  },
  "knowledge": {
    "frontmatter_fields": ["id", "title", "source", "date", "tags", "type"],
    "index_fields": ["id", "title", "summary", "tags", "source", "date", "chunk_count"]
  },
  "claude": {
    "model": "claude-sonnet-4-6",
    "use_for_etl": true,
    "use_for_query": true,
    "context_chunks_limit": 10
  },
  "sources": {
    "obsidian_vault": null,
    "watch_dirs": []
  }
}
```

---

## Layer 1 — Ingest (`ingest/`)

One script per source, each drops a file into `raw/` with a sidecar `.meta.json`:

| Script | Source |
|---|---|
| `ingest/obsidian.py` | Obsidian vault (adapt ObsidianCrawler) |
| `ingest/web-clip.py` | URL → raw HTML/markdown |
| `ingest/file-drop.py` | Manual file registration (PDF, TXT, etc.) |
| `ingest/chat-export.py` | Claude/ChatGPT JSON exports |
| `ingest/watch.py` | Folder watcher — auto-register new drops |

Each writes:
```
raw/
  abc123.md          ← raw content, preferred markdown
  abc123.meta.json   ← source, date, type, original filename/url
```

---

## Layer 2 — ETL (`etl/`)

Single pipeline script: `etl/process.py [file|--all|--pending]`

**Steps per file:**
1. Read raw file + `.meta.json`
2. Clean/normalize to markdown (strip nav, boilerplate, fix encoding)
3. Optionally call Claude to summarize into structured knowledge file
4. Write `knowledge/<id>.md` with frontmatter
5. Write `index/<id>.index.json` — lightweight descriptor

**`knowledge/<id>.md` structure:**
```markdown
---
id: abc123
title: "..."
source: "https://..."
date: 2026-05-09
tags: [ai, knowledge-management]
type: web-clip
---

# Title

Clean knowledge content...
```

**`index/<id>.index.json` structure:**
```json
{
  "id": "abc123",
  "title": "...",
  "summary": "2-3 sentence description of what this file contains",
  "tags": ["ai"],
  "source": "...",
  "date": "2026-05-09",
  "chunk_count": 4,
  "knowledge_file": "knowledge/abc123.md"
}
```

---

## Layer 3 — Search & Query (`search/`)

- `search/search.py <query>` — grep/BM25 over knowledge files, returns matching file list
- `search/query.py <question>` — loads relevant files → calls Claude with them as context → answer
- `search/list-index.py` — dump all index entries (for agent use: "what do you know about X?")

---

## Phase 1 Scope

1. `powledge.config.json` schema + loader util
2. `ingest/file-drop.py` + `ingest/web-clip.py` (two most general)
3. `etl/process.py` — clean to markdown + write knowledge + index files
4. `search/search.py` — keyword search over knowledge files

Everything else (watch, Obsidian, query with Claude, chat export) is Phase 2.

---

## Decisions

- **ETL execution:** Run manually by the user via agent (GitHub Copilot / Claude) — no CLI flags or automation needed for now.
- **Index:** One `index/<id>.index.json` per knowledge file. No master index for now — aggregate later if needed.
- **Chunking:** No splitting. 1:1 raw → knowledge file, keep it simple.
