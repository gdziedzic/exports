# DAO — Database Analysis & Ontology

**A tool for extracting SQL Server schema and building a navigable knowledge graph for joins, relationships, and semantic structure.**

DAO acts as: `sp_help` × **automatic ERD** × **join path finder** × **semantic ontology layer**.

## Features (V1)

- **SQL Server metadata extraction** — Tables, columns, primary keys, foreign keys
- **Knowledge graph storage** — SQLite-backed graph with nodes and edges
- **Path finding** — Dijkstra's algorithm to find join paths between tables
- **JOIN generation** — Automatic SQL JOIN skeleton generation
- **CLI interface** — Commands: `scan`, `explain`, `path`, `join`, `tables`, `relationships`, `stats`
- **HTTP API** — Lightweight REST API for programmatic access

## Installation

### Prerequisites

- Python 3.9+
- ODBC driver for SQL Server (for extraction)

### Install ODBC Driver (Windows)

Download from [Microsoft's SQL Server ODBC Driver page](https://docs.microsoft.com/en-us/sql/connect/odbc/download-odbc-driver-for-sql-server).

### Install ODBC Driver (Linux)

```bash
# Ubuntu/Debian
curl https://packages.microsoft.com/keys/microsoft.asc | apt-key add -
curl https://packages.microsoft.com/config/ubuntu/$(lsb_release -rs)/prod.list > /etc/apt/sources.list.d/mssql-release.list
apt-get update
ACCEPT_EULA=Y apt-get install -y msodbcsql17
```

### Install Python Dependencies

```bash
pip install pyodbc
```

## Quick Start

### 1. Scan your database

```bash
# Using connection string
python -m dao scan --connection "Driver={ODBC Driver 17 for SQL Server};Server=.;Database=MyDb;Trusted_Connection=yes;"

# Using individual parameters (Windows auth)
python -m dao scan --server "localhost" --database "MyDb"

# Using SQL auth
python -m dao scan --server "localhost" --database "MyDb" --username "sa" --password "mypassword"
```

### 2. Explore the schema

```bash
# List all tables
python -m dao tables

# Get table details
python -m dao explain Users

# With column details
python -m dao explain Users --columns
```

### 3. Find join paths

```bash
# Find path between two tables
python -m dao path Users Orders

# Output:
# Path from dbo.Users to dbo.Orders:
# --------------------------------------------------
# Path: dbo.Users
#   → dbo.Orders (via FK_Orders_Users)
```

### 4. Generate JOIN SQL

```bash
# Generate JOIN for two tables
python -m dao join Users Orders

# Output:
# -- Join for: dbo.Users, dbo.Orders
# -- Generated join connecting 2 tables via 1 JOIN(s).
#
# SELECT
#     u.*,
#     o.*
# FROM dbo.Users u
# JOIN dbo.Orders o
#     ON o.UserId = u.Id;
```

```bash
# Generate JOIN for multiple tables
python -m dao join Users Orders Products

# Finds the path and generates appropriate JOINs
```

## CLI Reference

### `dao scan`

Extract schema from SQL Server and build the knowledge graph.

```bash
dao scan --connection "..."     # Full ODBC connection string
dao scan --server . --database MyDb  # Individual parameters
dao scan --server . --database MyDb --username sa --password pass  # SQL auth
```

Options:
- `--connection, -c` — ODBC connection string
- `--server, -s` — SQL Server hostname or instance
- `--database, -d` — Database name
- `--driver` — ODBC driver name (default: "ODBC Driver 17 for SQL Server")
- `--username, -u` — SQL Server username
- `--password, -p` — SQL Server password
- `--db` — Output graph database path (default: dao_graph.sqlite)

### `dao explain <table>`

Show table details and relationships.

```bash
dao explain Users
dao explain dbo.Users --columns
```

Options:
- `--columns` — Include column details

Output:
```
Users (dbo.Users)
=================
PK: Id
Rows: 12,345
Size: 50.00 MB
Tags: actor, collection

Relationships:
  References:
    → dbo.Organizations (OrganizationId → Id)
  Referenced by:
    ← dbo.Orders (UserId → Id)
    ← dbo.UserRoles (UserId → Id)
```

### `dao path <from> <to>`

Find the join path between two tables.

```bash
dao path Users Products
dao path Users Products --json
```

Options:
- `--json` — Output in JSON format

### `dao join <table1> <table2> [...]`

Generate JOIN SQL for specified tables.

```bash
dao join Users Orders
dao join Users Orders Products
dao join Users Orders --json
```

Options:
- `--json` — Include JSON output with join details

### `dao tables`

List all tables in the graph.

```bash
dao tables
dao tables --json
```

### `dao relationships`

List all foreign key relationships.

```bash
dao relationships
dao relationships --json
```

### `dao stats`

Show graph statistics.

```bash
dao stats
dao stats --json
```

## HTTP API

Start the HTTP server:

```bash
python -m dao.http.server
python -m dao.http.server --port 8080
python -m dao.http.server --host 0.0.0.0 --port 9000
```

### Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /tables` | List all tables |
| `GET /tables/<name>` | Get table details |
| `GET /columns` | List all columns |
| `GET /relationships` | List all FK relationships |
| `GET /path?from=A&to=B` | Find path between tables |
| `GET /join?tables=A,B,C` | Generate JOIN SQL |
| `GET /stats` | Get graph statistics |
| `GET /health` | Health check |

### Example API Calls

```bash
# List tables
curl http://localhost:9000/tables

# Get table details
curl http://localhost:9000/tables/Users

# Find path
curl "http://localhost:9000/path?from=Users&to=Products"

# Generate join
curl "http://localhost:9000/join?tables=Users,Orders,Products"
```

## Data Model

### Nodes

**Table Node:**
```json
{
  "id": "dbo.Users",
  "type": "table",
  "data": {
    "schema": "dbo",
    "name": "Users",
    "row_count": 12345,
    "size_mb": 50.0,
    "primary_key": ["Id"],
    "tags": ["actor", "collection"]
  }
}
```

**Column Node:**
```json
{
  "id": "dbo.Users.Id",
  "type": "column",
  "data": {
    "table": "dbo.Users",
    "name": "Id",
    "sql_type": "int",
    "is_nullable": false,
    "is_pk": true,
    "is_fk": false
  }
}
```

### Edges

**Foreign Key Edge:**
```json
{
  "id": "fk:FK_Orders_Users",
  "from_id": "dbo.Orders",
  "to_id": "dbo.Users",
  "type": "fk",
  "weight": 1,
  "data": {
    "constraint_name": "FK_Orders_Users",
    "from_columns": ["UserId"],
    "to_columns": ["Id"]
  }
}
```

## File Structure

```
dao/
├── __init__.py          # Package exports
├── __main__.py          # Entry point (python -m dao)
├── config.yaml          # Configuration template
├── README.md            # This file
├── core/
│   ├── __init__.py
│   ├── storage.py       # SQLite graph storage
│   ├── extractor.py     # SQL Server metadata extraction
│   ├── graph_builder.py # Graph construction
│   └── query_engine.py  # Path finding & JOIN generation
├── cli/
│   ├── __init__.py
│   └── main.py          # CLI commands
└── http/
    ├── __init__.py
    └── server.py        # HTTP REST API
```

## How It Works

### 1. Schema Extraction

DAO connects to SQL Server and extracts:
- Tables from `INFORMATION_SCHEMA.TABLES`
- Columns from `INFORMATION_SCHEMA.COLUMNS`
- Primary keys from `INFORMATION_SCHEMA.TABLE_CONSTRAINTS`
- Foreign keys from `sys.foreign_keys` and related tables
- Table sizes and row counts from `sys.partitions` and `sys.allocation_units`

### 2. Graph Construction

The extracted metadata is transformed into a knowledge graph:
- **Table nodes** — One per table with schema, size, PK info
- **Column nodes** — One per column with type, nullable, PK/FK flags
- **FK edges** — Table-level relationships from foreign keys
- **FK column edges** — Column-level relationships for multi-column FKs

### 3. Path Finding

Dijkstra's algorithm finds the shortest path between tables:
- FK edges have weight 1 (strongest)
- Future: inferred edges will have higher weights
- Paths are bidirectional for JOIN generation

### 4. JOIN Generation

Given a path, DAO generates SQL:
- Automatic table aliasing (first letter of table name)
- Deterministic JOIN ordering
- Proper ON conditions from FK column mappings
- Handles composite foreign keys

## Semantic Tags

DAO automatically assigns semantic tags based on table naming:

| Pattern | Tag |
|---------|-----|
| `user`, `account`, `person` | `actor` |
| `order`, `invoice`, `payment` | `transaction` |
| `product`, `item`, `inventory` | `inventory` |
| `log`, `audit`, `history` | `audit` |
| `config`, `setting` | `config` |
| `lookup`, `type`, `status` | `reference` |
| Plural names | `collection` |

## Limitations (V1)

- SQL Server only (no MySQL, PostgreSQL yet)
- No relationship inference (FK-based only)
- No query log analysis
- No graphical UI
- No VS Code extension

## Future Roadmap (V2)

- **Inference engine** — Detect relationships by naming patterns
- **Query analysis** — Analyze query logs for actual join patterns
- **Business ontology** — Custom entity definitions
- **UI** — Web-based graph visualization
- **VS Code extension** — Inline join suggestions

## License

MIT License
