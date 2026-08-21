# Architecture

## Overview

Mosaic is a single Node.js process serving server-rendered HTML over raw
`node:http`. There is no framework, ORM, query builder, or template engine —
just a small declarative router, a tagged-template HTML escaper, and narrow
per-provider data adapters behind one common interface.

```
request -> router -> route handler (src/explorer/*, src/pages/*)
                         |
                         v
                 provider adapter (src/providers/{sqlserver,sqlite,files}/*)
                         |
                         v
                 SQL Server pool / SQLite handle / parsed file records
```

Everything renders server-side; the small amount of browser JS in `public/`
is progressive enhancement only — every core flow (browse, filter, sort,
paginate, CRUD, configured pages, exports) works with JS disabled.

## Data access: the adapter seam

`src/explorer/sqlSourceContext.js` exposes `getSqlAdapter(source, settings)`,
which returns one of two structurally-identical objects (SQL Server or
SQLite) implementing the same async methods: `listTablesAndViews`,
`getTableMetadata`, `queryRows`, `getRowByKey`, `insertRow`, `updateRow`,
`deleteRow`, `runSelectQuery`, `runWriteQuery`. Every route handler in
`src/explorer/` and the configured-page engine in `src/pages/` is written
against this interface and never branches on provider — SQLite (synchronous
under the hood, wrapped in `async` for a uniform call shape) and SQL Server
(genuinely async, connection-pooled) are interchangeable from the caller's
point of view. File sources (`src/providers/files/*`, JSON/JSONL/CSV/XML) are
read-only and have a separate, simpler adapter in
`src/explorer/fileSourceContext.js` since they have no CRUD/schema concept.

Connections and caches are always keyed `Map<sourceId, ...>` — nothing is
ever global — so two sources, even ones pointing at the same physical
server, can never leak state into each other.

## Configured pages

A page is a directory: `page.json` plus one `.sql` file per block (and per
write action). Each block runs as an independent parameterized query against
exactly one source; blocks on the same page can target different sources
entirely (`pages/operations-overview/` in this repo demonstrates two
independent SQLite databases on one page — the same code path applies
unchanged to a real SQLite + SQL Server combination).

- **Parameter binding.** `src/config/pages.js`'s `referencedParamNames()`
  regex-scans each block's SQL for `@Identifier` tokens at load time (to
  catch a page referencing an undeclared parameter before it ever serves a
  request) and again at execution time in `src/pages/blockExecutor.js`, which
  binds *only* the parameters a given block's SQL actually references. This
  isn't just tidiness: `node:sqlite`'s `DatabaseSync` throws `"Unknown named
  parameter"` if a bound params object contains a key the SQL text doesn't
  reference, so under-binding is a hard requirement, not a style choice.
- **Concurrency.** `src/pages/concurrencyLimiter.js` bounds how many blocks
  on one page render concurrently (`maxConcurrentQueriesPerRequest`), so a
  page with many blocks across many sources can't fan out unbounded
  concurrent work per request. Blocks execute independently — one block's
  query error renders an error panel in just that block, not a failed page.
- **Pagination without a COUNT query.** A table block fetches
  `pageSize + 1` rows and trims the extra one to decide whether a "Next"
  link should render, avoiding a second round-trip per page load.
- **Engine-owned sort/filter/pagination for table blocks.** A `"table"`
  block's `.sql` file is just `SELECT ... FROM ... [WHERE ...]` — no
  `ORDER BY`/`LIMIT`/`OFFSET`/`TOP`, enforced at config-load time
  (`src/config/pages.js`'s `checkTableBlockSqlShape`). `src/pages/blockExecutor.js`'s
  `executeTableBlock` wraps that query as `SELECT * FROM (<author sql>) AS
  block_result` and appends a validated, dynamic `WHERE`/`ORDER BY`/pagination
  built from the request's `b_<blockId>_sort`/`f_op_<col>`/`f_val_<col>`
  params (`src/pages/blockBrowseParams.js`) — the same "validate the
  identifier against known metadata, then quote it" discipline as the
  automatic browser, just with the metadata sourced differently (see below).
  This is implemented per-provider in `src/providers/{sqlite,sqlserver}/rawQuery.js`'s
  `runTableBlockQuery`, not as generic cross-provider SQL string building.
  `"scalar"`/`"single-record"` blocks are unaffected by any of this — they
  still execute exactly as authored, `@Offset`/`@PageSize` included.
- **Column introspection for arbitrary block SQL.** Validating a sort/filter
  identifier requires knowing a table block's result columns, but the SQL
  is arbitrary — there's no pre-existing schema to check against like the
  automatic browser has. `src/pages/blockExecutor.js`'s
  `describeTableBlockColumns` introspects once per block (TTL-cached, same
  `metadataCacheTtlMs`/`createTtlCache` pattern as table metadata) via each
  provider's `describeColumns`. This is a genuine, deliberate asymmetry
  between providers (same spirit as the timeout asymmetry below): SQL Server
  gets real per-column type metadata for free from a `SELECT TOP (0) * FROM
  (...)` probe (compiles the query without fetching rows), so its logical
  type comes from `classifySqlServerType`. `node:sqlite`'s prepared-statement
  `.columns()` reliably gives column *names* without executing, but its
  `type` is frequently null for joined/aliased/expression columns, so the
  logical type is instead inferred from one sampled row's actual JS value
  (`inferValueLogicalType` in `src/providers/logicalTypes.js` — the same
  three-bucket inference the block renderer already used for cell display).
- **Write actions.** A block can declare `writeActions`: a confirm-gated,
  CSRF-protected POST that runs one parameterized write statement against
  the block's own source, then redirects back to the page (which re-renders
  every block — a full reload is a safe superset of "refresh the blocks this
  action says depend on it"). See `src/explorer/pageActions.js`.

## Table browse extras

The automatic table browser (`src/explorer/tableBrowse.js`, `src/render/tableBrowse.js`)
has a global search box plus three capabilities layered on top of browse/filter/sort/CRUD,
the latter all built on the same row-selection checkbox form:

- **Search.** `src/explorer/browseParams.js`'s `parseBrowseParams` reads a `q` query param
  and, if it's non-blank, resolves it against `columns` (via the same `classifyType` each
  provider already exposes) to a `{ term, columns }` search state restricted to
  text-logical-type columns — the same identifier-validation-before-quoting discipline as a
  per-column filter, just applied to a fixed column list instead of one chosen column. Each
  provider's `queryRows` (`src/providers/{sqlite,sqlserver}/crud.js`) ANDs an OR'd,
  parameterized `LIKE ... ESCAPE` fragment (one clause per searchable column, via
  `buildSearchFragment`) onto the existing filter `WHERE` clause, so search and per-column
  filters compose rather than being separate modes. `null` when the table has no text column
  to search, so the box only renders when it would do something. The term round-trips through
  `browseStateToParams` like every other piece of browse state, so it survives sort/page/export
  links without being re-typed.
- **Show SQL.** `queryRows` (both `src/providers/sqlite/crud.js` and
  `src/providers/sqlserver/crud.js`) now returns the actual `executedSql`
  text and its bound parameter values alongside the rows, and the browse
  page renders them in a collapsible panel. Parameters are shown as a
  separate `name = value` list rather than interpolated into the SQL text —
  interpolating real values into displayed SQL text risks implying an
  execution/escaping semantic that isn't what actually ran.
- **Generate INSERT.** `src/explorer/generateInsert.js` re-fetches the
  selected rows by key and renders one `INSERT INTO ... VALUES (...);`
  statement per row (`src/explorer/insertStatement.js`), restricted to
  whichever columns are currently visible in the browse table. This never
  touches the database — it's available even when the source/table is
  read-only, since only a real row key (to re-identify the selected rows) is
  required, not write permission. Literal formatting is provider-aware
  (`0x...` binary literals for SQL Server vs `X'...'` for SQLite) but is a
  display/export convenience, not something Mosaic itself ever executes.
- **Custom table actions.** A per-table, user-authored SQL action (e.g.
  "increment this row's counter") that runs once per selected row, with
  every column of that row available as a same-named `@column` bind
  parameter (reusing `src/pages/blockExecutor.js`'s `executeWriteAction` and
  `src/config/pages.js`'s `referencedParamNames`). Unlike `sources.json` and
  `pages/`, which are hand-authored and read once at startup, actions are
  created through the browser (`src/explorer/tableActions.js`) and persisted
  immediately to `table-actions.json` (`src/config/tableActions.js`) so they
  survive a restart — the one config store in this codebase that the app
  itself writes to, not just reads.

## Security boundaries

See [SECURITY.md](SECURITY.md) for the full threat model. In brief: every SQL
value is parameterized; every identifier (schema/table/column/sort direction)
is validated against introspected metadata before being provider-quoted —
nothing from a request is ever trusted as raw SQL or an identifier fragment.
CSRF uses a stateless double-submit cookie compared with
`crypto.timingSafeEqual`, plus same-origin verification on every
state-changing request. That verification prefers the browser-set
`Sec-Fetch-Site` Fetch Metadata header (`same-origin`/`none` accepted,
anything else rejected) when present, falling back to Origin (then Referer)
host matching only for older clients that don't send it — Origin/Referer can
legitimately come back missing or opaque (`null`) for a same-origin request
for reasons outside the app's control (privacy extensions, redirect
bounces), where `Sec-Fetch-Site` can't. See `src/http/csrf.js`. There is no
authentication layer; Mosaic is designed to sit behind a trusted boundary
(localhost, VPN, or an authenticating reverse proxy).

## Exports

CSV/JSON exports (`src/explorer/export.js`) stream row-by-row rather than
buffering an entire file in memory: each row is written with `res.write()`
and, if the socket's internal buffer is full, the export awaits the `drain`
event before continuing (backpressure) rather than piling rows up in a
JS-side buffer. The row count is bounded by `exportLimits.maxRows` (fetched
once, up front, via the same `LIMIT`-based query every browse view uses); the
byte count is bounded by `exportLimits.maxBytes`, enforced while writing — if
exceeded mid-stream, the connection is aborted outright rather than silently
producing a truncated-but-well-formed-looking CSV/JSON file. A client
disconnecting mid-export is handled the same way: the write loop stops and
the connection is torn down, it doesn't hang or throw an unhandled rejection.

## Timeouts and cancellation

`mssql`/`tedious` requests carry a timeout: `sqlCommandTimeoutMs` in
`appsettings.json` is the default for every SQL Server source, overridable
per-source via `commandTimeoutMs` in `sources.json`
(`src/providers/sqlserver/connections.js`). `node:sqlite`'s `DatabaseSync` is
synchronous and has no native per-statement timeout or cancellation API — this
is a real, intentional asymmetry rather than something faked to look
symmetric. SQLite query cost is instead bounded structurally: every browse/
export/block query goes through an explicit `LIMIT`/`OFFSET`, so there's no
"unbounded scan" shape to cancel in the first place. `mssql`'s
`request.cancel()` exists but isn't wired to client disconnect in this
version — a disconnect during a genuinely long-running SQL Server query will
still let that query run to completion server-side; the timeout is the
backstop.

## Windows deployment model

Mosaic ships as a plain Node.js app — `npm ci --omit=dev && node server.js` —
not a bundled `.exe`. For "starts on boot, restarts on crash" on Windows
without a third-party service wrapper (NSSM, etc.), the honest native option
is **Task Scheduler** (`schtasks.exe`) with an "At startup" trigger and
restart-on-failure, running as a designated user — not `sc.exe create`
pointing at `node.exe`, which does *not* give real Win32 Service Control
Manager semantics (a bare console process doesn't implement the SCM handler
API `sc.exe`-managed services are expected to). This is a deliberate
tradeoff, not an oversight: a scheduled task is genuinely native and requires
no extra install, but it is a scheduled task, not a literal SCM service (it
won't show up in `services.msc`, won't respond to `net stop`, etc.). See
`scripts/` for the install/uninstall helpers and `RELEASE_CHECKLIST.md` for
the full deployment walkthrough.

## Project layout

| Path | Responsibility |
|---|---|
| `server.js` | Composition root: loads config, builds the router, starts the HTTP server, wires graceful shutdown |
| `src/config/` | `appsettings.json`/`sources.json`/`page.json` loaders, validators, env-var overrides, path safety |
| `src/http/` | Router, body parsing, CSRF, security headers, cookies, central error handling, health endpoints |
| `src/render/` | HTML escaping (`escape.js` — everything goes through this), layout/shell, table/form/page renderers |
| `src/providers/` | Per-provider adapters (SQL Server, SQLite, JSON/JSONL/CSV/XML) |
| `src/explorer/` | Automatic DB/file explorer route handlers, exports |
| `src/pages/` | Configured multi-query page engine: param resolution, block execution, concurrency limiter |
| `src/logging/` | Structured NDJSON logger with key-based secret redaction |
| `public/` | Checked-in, unbundled browser CSS/JS (progressive enhancement only) |
| `schemas/` | JSON Schemas for the three config formats + `EXAMPLES.md` |
| `data/` | Sample SQLite DBs + CSV/JSON/JSONL/XML fixtures used by the default `sources.json` |
| `tests/` | `node:test` suite, mirrors `src/` |
