# powledge-toolkit

AI-powered personal knowledge base. Raw source material is ingested from external systems (Confluence, web clips, file drops, manual entries), cleaned into structured knowledge files, indexed, and made queryable via a local web UI or CLI.

## Architecture

```
powledge.config.json        ← global config
config.py                   ← config loader
ingest/
  confluence.py             ← Confluence REST API v2 → raw/
etl/
  process.py                ← clean raw files → knowledge/ + index/
  build-index.py            ← aggregate index/*.index.json → index/all.json
  refresh-summary.py        ← regenerate stale summaries via Claude
search/
  list-index.py             ← list/filter index entries (agent entry point)
  query.py                  ← question → Claude answer using knowledge context
server.py                   ← local web UI server (default port 7700)
raw/                        ← ingested files: <id>.md + <id>.meta.json
knowledge/                  ← clean knowledge files with YAML frontmatter
index/                      ← lightweight descriptors + aggregated all.json
```

## Setup

**Requirements:** Python 3.9+, no third-party packages.

```bash
# Create raw/, knowledge/, index/ directories
task init
# or: python -c "from config import load_config, ensure_dirs; ensure_dirs(load_config())"

# Set API key for Claude-powered ETL and query features
export ANTHROPIC_API_KEY=sk-ant-...
```

For Confluence ingestion, also set:

```bash
export CONFLUENCE_BASE_URL=https://yourco.atlassian.net/wiki
export CONFLUENCE_EMAIL=you@example.com
export CONFLUENCE_API_TOKEN=<token>
```

## Web UI

```bash
task ui               # http://127.0.0.1:7700
task ui -- 8080       # custom port
python server.py      # directly
```

The UI provides: knowledge library, full-text search, tag filtering, inline editing, manual entry creation, URL clipping, ETL controls, and a system validation dashboard.

## Core Workflows

### Ingest from Confluence

```bash
task confluence                        # all configured spaces/pages → ETL → rebuild index
task confluence:page -- 111 222        # specific page IDs
task confluence:space -- ENG HR        # specific space keys
task confluence:dry                    # preview, no files written
```

Configure spaces/pages in `powledge.config.json` under `confluence.space_keys` / `confluence.page_ids`.

### Ingest a URL (via web UI)

Use the "Add from URL" button in the web UI. The page is fetched, converted to Markdown, and dropped into `raw/`.

### Run ETL

Converts raw files to structured knowledge files with frontmatter and builds the index.

```bash
task etl:process:pending      # process only new raw files
task etl:process -- --all     # reprocess everything
task index:build              # rebuild aggregated index only
```

### Query the Knowledge Base

```bash
task search:query -- "What is our deployment process?"

# List/filter index entries
task search:index                              # all entries
task search:index -- --search "kubernetes"     # keyword filter
task search:index -- --tags ai,etl            # tag filter (AND)
task search:index -- --fields id,title,tags   # field projection
```

## Configuration

`powledge.config.json` controls all behaviour:

```json
{
  "dirs": { "raw": "raw", "knowledge": "knowledge", "index": "index" },
  "etl": { "include_source_metadata": true, "overwrite_existing": false },
  "claude": { "model": "claude-sonnet-4-6", "use_for_etl": true, "use_for_query": true, "context_chunks_limit": 10 },
  "confluence": { "base_url": null, "email": null, "space_keys": [], "page_ids": [] },
  "ui": { "backup_on_update": true, "max_backups_per_entry": 10, "require_title": true }
}
```

## Testing

```bash
task test
python -m pytest tests/ -v
```

## Inspect the Store

```bash
task ls:raw
task ls:knowledge
task ls:index
task status
```
