# Mosaic — Agent Guide

Mosaic is a self-hosted data explorer: an automatic table browser + CRUD for SQL Server/SQLite, plus SQL-file-configured multi-source query pages. Commit messages for this project use the `dev/Mosaic: <summary>` area convention. The full original build spec is `node-data-explorer-build-prompt.md`-derived; the approved architecture (including the two deviations from that spec — no Node SEA/.exe, dependency minimalism) lives in the plan history, not in this repo.

## Rules specific to this project

- **No TypeScript, no bundler, no frontend framework, no ORM/query builder/DI framework/template engine.** Plain ESM JS on the backend, plain HTML/CSS/JS in `public/`. If you think you need one of these, stop and check with Greg first — the whole point of Mosaic is staying small.
- **No Node SEA / `.exe` packaging.** Mosaic runs as a normal Node.js app (`node server.js`). Do not reintroduce a bundler or packaging step without explicit approval.
- **Dependency budget is fixed:** `mssql` (SQL Server) and `sax` (XML) are the only production dependencies. Do not add a new dependency (including dev dependencies) without updating the inventory in `README.md` and getting approval first — that includes test/lint/format tooling; `node:test`/`node:assert` are sufficient.
- **Never build SQL by string concatenation.** All values are parameterized; all identifiers (schema/table/column/sort direction) are validated against introspected metadata before being provider-quoted. See `src/providers/*/quoting.js` and `SECURITY.md`.
- **Nothing is ever keyed globally across sources** — connections, metadata caches, and query state are always `Map<sourceId, ...>`. If you're adding a cache or pool, key it by source ID from the start.
- **No arbitrary SQL console, no schema-changing operations, no authentication.** These are explicit non-goals — do not add them even if it seems convenient for testing.
- **Paths resolve relative to the content directory** (`src/config/paths.js`'s `CONTENT_DIR`), never `process.cwd()`. Use `contentPath()`/`resolveWithinRoot()` for anything touching the filesystem based on configuration.

## Entry points

```
node server.js          # or: task start / task dev (auto-restart + dev mode)
node --test tests/      # or: task test
```

## Where things live

| Path | Responsibility |
|---|---|
| `server.js` | Composition root: loads config, builds the router, starts the HTTP server, wires graceful shutdown |
| `src/config/` | `appsettings.json`/`sources.json`/`page.json` loaders, validators, env-var overrides, path safety |
| `src/http/` | Router, body parsing, CSRF, security headers, cookies, central error handling, health endpoints |
| `src/render/` | HTML escaping (`escape.js` — everything goes through this), layout/shell |
| `src/providers/` | Per-provider adapters (SQL Server, SQLite, JSON/JSONL/CSV/XML) — narrow interface, no generic repository layer |
| `src/explorer/` | Automatic DB/file explorer route handlers |
| `src/pages/` | Configured multi-query page engine |
| `src/logging/` | Structured NDJSON logger with key-based secret redaction |
| `public/` | Checked-in, unbundled browser CSS/JS |
| `schemas/` | JSON Schemas for the three config formats + `EXAMPLES.md` commented walkthroughs |
| `data/` | Sample SQLite DB + CSV/JSON/JSONL/XML fixtures used by the default `sources.json` |
| `tests/` | `node:test` suite, mirrors `src/` |

## Testing

`task test` (or `node --test "tests/**/*.test.js"`). Keep `npm test` green after every change. SQL Server integration tests are opt-in and skip themselves when no connection string is provided via env (see `tests/providers/sqlserver/integration.test.js`) — do not make them a hard test-suite dependency.
