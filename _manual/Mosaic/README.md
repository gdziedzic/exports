# Mosaic

One workspace for all your data sources. Mosaic is a self-hosted, server-rendered
data explorer:

- An **automatic table browser + CRUD** for every table/view in a connected SQL
  Server or SQLite database — browse, filter, sort, paginate, insert, edit,
  delete, export — with zero per-table configuration. Select rows to bulk
  delete them, generate `INSERT` statements from them, or run a custom
  per-table SQL action against them (e.g. "increment this counter") — custom
  actions are defined from the browser and persist across restarts. A
  "Show SQL" panel exposes the exact query Mosaic sent to the database.
- **Read-only explorers** for JSON, JSONL, CSV, and XML files.
- **Configured pages** (`page.json` + `.sql` files) that combine independent
  query "blocks" from one or more sources onto a single dashboard-style page,
  with optional parameterized write actions. Table blocks get sort, filter,
  and pagination automatically — the same as the automatic table browser —
  without the page author writing any of it.

It runs as a plain Node.js process. There is no bundler, no build step, no
frontend framework, and — deliberately — **no authentication** (see
[SECURITY.md](SECURITY.md) before exposing it beyond `localhost`).

See [ARCHITECTURE.md](ARCHITECTURE.md) for how it's put together and
[AGENTS.md](AGENTS.md) for the rules an agent (or a human) should follow when
changing this codebase.

## Requirements

- Node.js **24.x** or newer (`node:sqlite` requires a recent Node; no
  `--experimental-sqlite` flag is needed on 24.x, though it still logs an
  `ExperimentalWarning` at startup).
- SQL Server connectivity, if you use it, needs no local client tools — the
  `mssql` package is a pure-JS TDS client.

## Quick start

```
npm ci
node scripts/seed-reference-db.js    # creates data/reference.db (sample data)
node scripts/seed-warehouse-db.js    # creates data/warehouse.db (sample data)
node server.js
```

Then open `http://127.0.0.1:4930/`. The committed `sources.json` and
`pages/operations-overview/` are working samples backed by those two SQLite
databases — browse tables, try a filter/sort/export, and open the "Operations
overview" page to see a multi-source dashboard with a write action.

With [Task](https://taskfile.dev) installed, the same steps are:

```
task install
task seed
task start        # or: task dev   (auto-restart + development mode)
```

Run the test suite with `task test` or `node --test "tests/**/*.test.js"`.

## Configuring your own sources

Mosaic reads three JSON files from its content directory (the project root):

| File | Purpose | Schema |
|---|---|---|
| `appsettings.json` | Server/runtime settings (host, port, limits, timeouts, logging) | `schemas/appsettings.schema.json` |
| `sources.json` | The databases/files Mosaic connects to | `schemas/sources.schema.json` |
| `pages/*/page.json` | Configured multi-source dashboard pages | `schemas/page.schema.json` |

`schemas/EXAMPLES.md` walks through each field with commentary (JSON itself
has no comment syntax). `sources.example.json` shows a fuller multi-database
config (several SQL Server sources plus SQLite and a CSV feed) — copy the
sources you need into `sources.json` and set the referenced environment
variables.

All three files are validated at startup. An invalid `appsettings.json` or
`sources.json` prevents the app from starting (fail fast, with a clear list of
issues). An invalid individual page is isolated — it's marked unavailable with
a diagnostic on `/pages`, but the rest of the app keeps working.

**Never put a live connection string directly in `sources.json` if the file
might be committed.** Use `connectionStringEnvironmentVariable` instead of
`connectionString` and set the variable outside the repo (shell env, a
Windows service's environment block, etc.).

There is a fourth file, `table-actions.json`, that works differently: it's
not hand-authored — it's written by Mosaic itself when you add a custom
table action from the browse page (see "Custom table actions" below) — so
there's no schema doc for it, just structural validation on load.

### `appsettings.json` reference

All keys are optional; shown values are the defaults. Every key can also be
set via an `MOSAIC_*` environment variable, which takes precedence over the
file (see the table below).

```json
{
  "host": "127.0.0.1",
  "port": 4930,
  "publicBaseUrl": null,
  "trustedProxy": { "enabled": false, "trustedHeaders": ["x-forwarded-for", "x-forwarded-proto", "x-forwarded-host"] },
  "logging": { "level": "info", "directory": "logs" },
  "developmentMode": false,
  "pageSize": { "default": 50, "max": 500 },
  "maxConcurrentQueriesPerRequest": 4,
  "sqlCommandTimeoutMs": 15000,
  "fileLimits": { "maxFileSizeBytes": 52428800, "maxRecordCount": 200000 },
  "maxRequestBodyBytes": 1048576,
  "exportLimits": { "maxRows": 100000, "maxBytes": 104857600 },
  "metadataCacheTtlMs": 300000,
  "showQueryDurationInProduction": false
}
```

| Env var | Overrides |
|---|---|
| `MOSAIC_HOST` | `host` |
| `MOSAIC_PORT` | `port` |
| `MOSAIC_PUBLIC_BASE_URL` | `publicBaseUrl` |
| `MOSAIC_TRUSTED_PROXY_ENABLED` | `trustedProxy.enabled` |
| `MOSAIC_LOG_LEVEL` | `logging.level` |
| `MOSAIC_LOG_DIRECTORY` | `logging.directory` |
| `MOSAIC_DEV_MODE` | `developmentMode` |
| `MOSAIC_PAGE_SIZE_DEFAULT` / `MOSAIC_PAGE_SIZE_MAX` | `pageSize.default` / `.max` |
| `MOSAIC_MAX_CONCURRENT_QUERIES_PER_REQUEST` | `maxConcurrentQueriesPerRequest` |
| `MOSAIC_SQL_COMMAND_TIMEOUT_MS` | `sqlCommandTimeoutMs` (the default per-query timeout for every SQL Server source that doesn't set its own `commandTimeoutMs`) |
| `MOSAIC_FILE_MAX_SIZE_BYTES` / `MOSAIC_FILE_MAX_RECORD_COUNT` | `fileLimits.*` |
| `MOSAIC_MAX_REQUEST_BODY_BYTES` | `maxRequestBodyBytes` |
| `MOSAIC_EXPORT_MAX_ROWS` / `MOSAIC_EXPORT_MAX_BYTES` | `exportLimits.*` |
| `MOSAIC_METADATA_CACHE_TTL_MS` | `metadataCacheTtlMs` |
| `MOSAIC_SHOW_QUERY_DURATION` | `showQueryDurationInProduction` |

Binding `host` to anything other than `127.0.0.1`/`localhost`/`::1` prints a
loud startup warning — Mosaic has no authentication of its own (see
[SECURITY.md](SECURITY.md)).

## Dependency inventory

Production dependencies are deliberately minimal and each one is load-bearing:

| Package | Why | Only installed when |
|---|---|---|
| `mssql` | SQL Server connectivity (wraps `tedious`, a pure-JS TDS client — no native SQL Server client tools needed) | Always present in `node_modules` after `npm ci`, but never opens a connection unless a `sqlserver` source is configured in `sources.json` — nothing about installing or running Mosaic requires a SQL Server *engine* on this machine |
| `sax` | Streaming, non-validating XML parsing for the XML file source | Same as above, for `xml` sources |

CSV parsing is hand-rolled (RFC 4180 state machine, `src/providers/files/csv.js`)
rather than a dependency. SQLite uses the built-in `node:sqlite` — no
dependency at all. There are **no dev dependencies**: `node:test`/
`node:assert` cover testing, and there is no bundler or packaging step.

Adding a new dependency (production or dev) requires updating this table and
sign-off first — see `AGENTS.md`.

## Windows deployment

See [ARCHITECTURE.md](ARCHITECTURE.md#windows-deployment-model) for how Mosaic
runs unattended on Windows (Task Scheduler, not a Win32 service — and why),
and `scripts/` for the install/uninstall/smoke-test helpers.

## Table browse extras

A **search box** above every browse table ORs a `LIKE` across all of that
table's text-logical-type columns, so finding "the row with this in it"
doesn't require opening the per-column filter panel first. It composes with
filters (AND'd together) and with sort/pagination/export — the search term is
just another part of the shareable browse URL (`?q=...`).

On any browsable table/view with a real key (primary key, or SQLite's
`rowid` fallback), selecting rows with the checkboxes unlocks:

- **Generate INSERT** — renders one `INSERT INTO ... VALUES (...);`
  statement per selected row, using only the columns currently visible in
  the browse table. Read-only, works even on a read-only source.
- **Delete selected** — bulk delete, gated on the table/source actually
  being writable.
- **Custom actions** — click "Add custom action" (writable tables only) to
  define a button that runs your own SQL once per selected row, with that
  row's own columns available as `@columnName` parameters — e.g.
  `UPDATE products SET stock = stock + 1 WHERE id = @id`. Actions are saved
  to `table-actions.json` immediately and are still there after a restart.

A **"Show SQL"** panel above the table shows the exact `SELECT` (and its
bound parameter values) Mosaic just sent to the database for the current
filters/sort/page. See [ARCHITECTURE.md](ARCHITECTURE.md#table-browse-extras)
for how these are implemented.

## Exports

CSV/JSON exports (table browser, file browser, and configured-page blocks)
stream row-by-row with backpressure rather than buffering the whole file in
memory, and are bounded by `exportLimits.maxRows` (rows fetched) and
`exportLimits.maxBytes` (bytes written — if exceeded mid-stream, the
connection is aborted rather than silently emitting a truncated file that
looks complete).

## Testing

`node:test` + `node:assert/strict` under `tests/`, mirroring `src/`. SQL
Server-specific behavior (identifier quoting, parameter binding, metadata
shaping) is unit-tested against fake pool/request objects so the suite runs
with no SQL Server installed; a small number of true integration tests exist
and skip themselves automatically unless a live connection string is provided
via env (see `tests/providers/sqlserver/integration.test.js`).
