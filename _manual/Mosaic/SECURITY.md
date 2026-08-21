# Security

## There is no authentication

**Mosaic has no login, no users, no sessions, and no authorization model.**
Anyone who can reach the HTTP port can browse, edit, and delete data in every
configured writable source, and run every configured page action. This is a
deliberate scope decision, not a gap to be filled later.

Mosaic is meant to be deployed behind a trusted boundary:

- Bind to `127.0.0.1` (the default) and access it only from the same
  machine, or
- Put it behind a VPN, or
- Put it behind a reverse proxy that terminates authentication (e.g. an
  authenticating proxy, or a proxy requiring a client certificate) before
  traffic ever reaches Mosaic.

If `appsettings.json`'s `host` is set to anything other than
`127.0.0.1`/`localhost`/`::1`, Mosaic prints a loud warning to the console at
startup as a deliberate speed bump — it does not refuse to start, since a
trusted-network deployment behind a firewall is a legitimate use case, but
the operator should have consciously chosen it.

## Threat model summary

**In scope / defended against:**

- SQL injection — every value is parameterized; every identifier
  (schema/table/column/sort direction) is validated against introspected
  metadata (not user input) before being provider-quoted.
- Cross-site request forgery — every state-changing request (insert, edit,
  delete, page write action) requires a CSRF token, validated via
  `crypto.timingSafeEqual`, plus Origin/Referer-vs-Host validation.
- Reflected/stored XSS via server-rendered HTML — all output goes through a
  single tagged-template escaper (`src/render/escape.js`); there is no
  string concatenation into HTML anywhere else in the codebase.
- Open redirects — every redirect target is validated as a local,
  application-relative path.
- Path traversal / arbitrary file read via file sources — file source paths
  are canonicalized and checked to remain under the configured content root;
  `..`, absolute paths, and UNC paths are rejected at config-validation time.
- Resource exhaustion from a single request — request bodies, file reads,
  and exports are all bounded (`maxRequestBodyBytes`, `fileLimits.*`,
  `exportLimits.*`), enforced during streaming (not just via a
  `Content-Length` check that a chunked or lying client could bypass).
- Secret leakage via logs — the structured logger redacts connection
  strings, tokens, and known-sensitive keys by default; row contents and SQL
  parameter values are never logged.
- Cross-source leakage — connections, metadata caches, and any per-source
  state are always keyed by source ID (`Map<sourceId, ...>`); nothing is
  ever cached or connected globally.

**Explicitly out of scope (by design, not oversight):**

- Authentication/authorization of any kind (see above).
- An arbitrary SQL console — there is no route that accepts raw SQL text
  from a request. Only pre-configured, file-based queries (`page.json` +
  `.sql`) and the structured browse/CRUD routes ever reach a database.
- Schema-changing operations (`CREATE`/`ALTER`/`DROP`) — Mosaic only ever
  issues `SELECT`/`INSERT`/`UPDATE`/`DELETE`, and only against tables/views
  discovered via metadata introspection.
- Rate limiting / brute-force protection — there's nothing to brute-force
  (no auth), but this also means Mosaic does not protect a backing database
  from being hammered by a client that can already reach it; that's the
  network boundary's job.
- Full request cancellation on client disconnect for SQL Server — a
  `sqlCommandTimeoutMs` backstop exists, but an in-flight query is not
  actively cancelled when the client goes away. See ARCHITECTURE.md's
  Timeouts and cancellation section.

## Security headers

Every response sets: `Content-Security-Policy` (`default-src 'self'`, no
inline scripts or styles), `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer`, `X-Frame-Options: DENY`, and a restrictive
`Permissions-Policy`. Mutation responses and record-detail pages also set
`Cache-Control: no-store` so a shared/back-button cache can't resurface
stale or sensitive data.

## Reporting a concern

This is a self-hosted internal tool with a single operator/maintainer
(see `AGENTS.md`) — there is no separate disclosure process. If you find a
gap between what this document claims and what the code actually does,
that's a bug: file it the same way as any other issue in this repo.
