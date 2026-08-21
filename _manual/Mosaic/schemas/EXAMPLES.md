# Configuration examples

JSON has no comment syntax, so the commented walkthroughs live here instead of in the `.json` files themselves. Formal contracts are in `appsettings.schema.json`, `sources.schema.json`, and `page.schema.json` in this directory.

## appsettings.json

The checked-in `appsettings.json` at the project root already matches these defaults - you only need to override fields you actually want to change (any field can also be omitted; the loader fills in the default). Every field can also be set via a `MOSAIC_*` environment variable - see the table in `README.md`. Environment variables win over the file.

```jsonc
{
  "host": "127.0.0.1",          // bind to loopback only unless you really mean to expose this
  "port": 4930,
  "publicBaseUrl": null,        // e.g. "https://data.example.internal" when behind a reverse proxy
  "trustedProxy": { "enabled": false, "trustedHeaders": ["x-forwarded-for", "x-forwarded-proto", "x-forwarded-host"] },
  "logging": { "level": "info", "directory": "logs" },
  "developmentMode": false,     // never enable in production - relaxes error detail
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

## sources.json

The checked-in `sources.json` works with zero external setup (SQLite + the sample files in `data/`). `sources.example.json` shows what a multi-database setup with SQL Server looks like:

```jsonc
{
  "sources": [
    {
      "id": "sales-primary",                 // globally unique, used in every URL under /sources/:id
      "name": "Sales",                       // display name
      "provider": "sqlserver",
      // Never commit a plaintext connection string with credentials - use the
      // environment-variable form and set it outside of git (see README "Secrets").
      "connectionStringEnvironmentVariable": "MOSAIC_SALES_CONNECTION",
      "allowWrites": true                    // required for insert/edit/delete forms to appear
    },
    {
      "id": "warehouse",
      "name": "Warehouse",
      "provider": "sqlserver",
      "connectionStringEnvironmentVariable": "MOSAIC_WAREHOUSE_CONNECTION",
      "allowWrites": false,                  // browse-only, no CRUD forms rendered
      "allowedSchemas": ["dbo", "inventory"] // omit to allow every non-system schema
    },
    {
      "id": "local-reference",
      "name": "Local reference data",
      "provider": "sqlite",
      // A plaintext connectionString is fine for SQLite - the "secret" is just a
      // local file path, not a credential.
      "connectionString": "Data Source=data/reference.db",
      "allowWrites": true
    },
    {
      "id": "product-feed",
      "name": "Product feed",
      "provider": "csv",
      "path": "data/products.csv",           // must already exist, resolved beneath the content dir
      "encoding": "utf8",
      "delimiter": ","
    }
  ]
}
```

## page.json

Lives at `pages/<page-id>/page.json`, with its `.sql` files in `pages/<page-id>/queries/` (paths in `query` are relative to the page's own directory). See `pages/operations-overview/` for a complete worked multi-source example added in a later milestone.

```jsonc
{
  "id": "operations-overview",
  "title": "Operations overview",
  "description": "Sales and warehouse information",
  "parameters": [
    { "name": "FromDate", "label": "From date", "type": "date", "required": true },
    { "name": "Region", "label": "Region", "type": "text", "required": false }
  ],
  "blocks": [
    {
      "id": "recent-orders",
      "title": "Recent orders",
      "sourceId": "sales-primary",           // each block targets exactly one source
      "query": "queries/recent-orders.sql",  // a plain SELECT ... FROM ... [WHERE ...] - no ORDER BY/LIMIT/OFFSET/TOP
      "presentation": "table",
      "pageSize": 50,
      "allowCsvExport": true,
      "allowJsonExport": true,
      "width": "full"
    },
    {
      "id": "stock-levels",
      "title": "Warehouse stock",
      "sourceId": "warehouse",               // a different source - blocks never join across sources
      "query": "queries/stock-levels.sql",
      "presentation": "table",
      "pageSize": 50,
      "width": "half"
    },
    {
      "id": "exchange-rate",
      "title": "Exchange rate",
      "sourceId": "local-reference",
      "query": "queries/exchange-rate.sql",
      "presentation": "scalar",              // renders the first column of the first row only
      "width": "half"
    }
  ]
}
```

`@Offset` and `@PageSize` are reserved parameter names, automatically supplied per block - do not declare a page- or block-level parameter with either name.

For a `"table"` block, sort, filter, and pagination are supplied automatically by the engine: write only `SELECT ... FROM ... [WHERE ...]` in the `.sql` file - no `ORDER BY`/`LIMIT`/`OFFSET`/`TOP`, and don't reference `@Offset`/`@PageSize` (the config loader rejects a table block's query if it does; see `AGENTS.md`/`ARCHITECTURE.md`'s "Configured pages" section for how the wrapping works). `"scalar"` and `"single-record"` blocks are unaffected - they can still reference `@Offset`/`@PageSize` and write their own `ORDER BY`/`LIMIT` if useful (e.g. a "top 5" scalar query), since pagination as a concept doesn't apply to a single value or row.
