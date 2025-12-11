#!/usr/bin/env python3
"""
DAO CLI - Database Analysis & Ontology command-line interface.

Usage:
    dao scan --connection "..."     Extract schema and build graph
    dao explain <table>             Show table details and relationships
    dao path <table1> <table2>      Find join path between tables
    dao join <table1> <table2> ...  Generate JOIN SQL for tables
    dao tables                      List all tables
    dao relationships               List all foreign key relationships
    dao stats                       Show graph statistics
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Optional

# Support both module and standalone execution
try:
    from ..core.storage import GraphStorage
    from ..core.extractor import SQLServerExtractor, build_connection_string, PYODBC_AVAILABLE
    from ..core.graph_builder import GraphBuilder
    from ..core.query_engine import QueryEngine, create_engine
except ImportError:
    # Standalone execution - add parent to path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from core.storage import GraphStorage
    from core.extractor import SQLServerExtractor, build_connection_string, PYODBC_AVAILABLE
    from core.graph_builder import GraphBuilder
    from core.query_engine import QueryEngine, create_engine


# Default database path
DEFAULT_DB_PATH = "dao_graph.sqlite"


def get_db_path(args) -> str:
    """Get database path from args or default."""
    return getattr(args, "db", None) or DEFAULT_DB_PATH


def cmd_scan(args) -> int:
    """Execute the scan command - extract schema and build graph."""
    if not PYODBC_AVAILABLE:
        print("Error: pyodbc is required for SQL Server connection.")
        print("Install with: pip install pyodbc")
        return 1

    connection = args.connection

    # Build connection string if individual parts provided
    if args.server and args.database:
        connection = build_connection_string(
            server=args.server,
            database=args.database,
            driver=args.driver or "ODBC Driver 17 for SQL Server",
            trusted_connection=not (args.username and args.password),
            username=args.username,
            password=args.password
        )

    if not connection:
        print("Error: Connection string or --server/--database required.")
        return 1

    db_path = get_db_path(args)

    print(f"Connecting to SQL Server...")
    print(f"Graph will be stored in: {db_path}")

    try:
        with SQLServerExtractor(connection) as extractor:
            print("Extracting metadata...")
            metadata = extractor.extract_all()

            print(f"Database: {metadata.database_name}")
            print(f"Server: {metadata.server_name}")
            print(f"Tables found: {len(metadata.tables)}")
            print(f"Columns found: {len(metadata.columns)}")
            print(f"Foreign keys found: {len(metadata.foreign_keys)}")

            print("\nBuilding graph...")
            with GraphStorage(db_path) as storage:
                builder = GraphBuilder(storage)
                stats = builder.build(metadata, clear_existing=True)

            print("\nScan complete!")
            print(f"  Tables: {stats['tables']}")
            print(f"  Columns: {stats['columns']}")
            print(f"  Foreign keys: {stats['foreign_keys']}")
            print(f"  Column relationships: {stats['column_relationships']}")

            return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_explain(args) -> int:
    """Execute the explain command - show table details."""
    db_path = get_db_path(args)

    if not Path(db_path).exists():
        print(f"Error: Graph database not found at {db_path}")
        print("Run 'dao scan' first to build the graph.")
        return 1

    table_name = args.table

    try:
        engine = create_engine(db_path)
        explanation = engine.explain_table(table_name)

        if not explanation:
            print(f"Table '{table_name}' not found.")
            print("\nAvailable tables:")
            for t in engine.list_tables()[:10]:
                print(f"  {t['name']}")
            if len(engine.list_tables()) > 10:
                print(f"  ... and {len(engine.list_tables()) - 10} more")
            return 1

        # Print table info
        print(f"\n{explanation.name} ({explanation.table_name})")
        print("=" * (len(explanation.name) + len(explanation.table_name) + 3))

        if explanation.primary_key:
            print(f"PK: {', '.join(explanation.primary_key)}")
        else:
            print("PK: (none)")

        if explanation.row_count is not None:
            print(f"Rows: {explanation.row_count:,}")
        if explanation.size_mb is not None:
            print(f"Size: {explanation.size_mb:.2f} MB")

        if explanation.tags:
            print(f"Tags: {', '.join(explanation.tags)}")

        # Print columns
        if args.columns:
            print("\nColumns:")
            for col in explanation.columns:
                pk_marker = " [PK]" if col.get("is_pk") else ""
                fk_marker = " [FK]" if col.get("is_fk") else ""
                nullable = " NULL" if col.get("is_nullable") else " NOT NULL"
                print(f"  {col['name']}: {col['sql_type']}{nullable}{pk_marker}{fk_marker}")

        # Print relationships
        print("\nRelationships:")

        if explanation.outgoing_relationships:
            print("  References:")
            for rel in explanation.outgoing_relationships:
                cols = ", ".join(rel["from_columns"])
                to_cols = ", ".join(rel["to_columns"])
                print(f"    → {rel['to_table']} ({cols} → {to_cols})")
        else:
            print("  References: (none)")

        if explanation.incoming_relationships:
            print("  Referenced by:")
            for rel in explanation.incoming_relationships:
                cols = ", ".join(rel["from_columns"])
                to_cols = ", ".join(rel["to_columns"])
                print(f"    ← {rel['from_table']} ({cols} → {to_cols})")
        else:
            print("  Referenced by: (none)")

        print()
        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_path(args) -> int:
    """Execute the path command - find join path between tables."""
    db_path = get_db_path(args)

    if not Path(db_path).exists():
        print(f"Error: Graph database not found at {db_path}")
        print("Run 'dao scan' first to build the graph.")
        return 1

    from_table = args.from_table
    to_table = args.to_table

    try:
        engine = create_engine(db_path)
        result = engine.find_path(from_table, to_table)

        if not result.found:
            print(f"No path found between {from_table} and {to_table}.")
            print(result.explanation)
            return 1

        print(f"\nPath from {from_table} to {to_table}:")
        print("-" * 50)
        print(result.explanation)
        print(f"\nTotal weight: {result.total_weight}")

        if args.json:
            print("\nJSON:")
            print(json.dumps(result.to_dict(), indent=2))

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_join(args) -> int:
    """Execute the join command - generate JOIN SQL."""
    db_path = get_db_path(args)

    if not Path(db_path).exists():
        print(f"Error: Graph database not found at {db_path}")
        print("Run 'dao scan' first to build the graph.")
        return 1

    tables = args.tables
    if len(tables) < 2:
        print("Error: At least two tables required for a join.")
        return 1

    try:
        engine = create_engine(db_path)
        result = engine.generate_join(tables)

        if not result.success:
            print(f"Failed to generate join.")
            print(result.explanation)
            return 1

        print(f"\n-- Join for: {', '.join(result.tables)}")
        print(f"-- {result.explanation}")
        print()
        print(result.sql)

        if args.json:
            print("\n-- JSON:")
            print(json.dumps(result.to_dict(), indent=2))

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_tables(args) -> int:
    """Execute the tables command - list all tables."""
    db_path = get_db_path(args)

    if not Path(db_path).exists():
        print(f"Error: Graph database not found at {db_path}")
        print("Run 'dao scan' first to build the graph.")
        return 1

    try:
        engine = create_engine(db_path)
        tables = engine.list_tables()

        if not tables:
            print("No tables found in the graph.")
            return 0

        print(f"\nTables ({len(tables)}):")
        print("-" * 60)

        if args.json:
            print(json.dumps(tables, indent=2))
        else:
            for t in tables:
                pk_info = f" PK: {', '.join(t['pk'])}" if t['pk'] else ""
                row_info = f" ({t['row_count']:,} rows)" if t['row_count'] else ""
                print(f"  {t['name']}{pk_info}{row_info}")

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_relationships(args) -> int:
    """Execute the relationships command - list all FK relationships."""
    db_path = get_db_path(args)

    if not Path(db_path).exists():
        print(f"Error: Graph database not found at {db_path}")
        print("Run 'dao scan' first to build the graph.")
        return 1

    try:
        engine = create_engine(db_path)
        relationships = engine.list_relationships()

        if not relationships:
            print("No foreign key relationships found in the graph.")
            return 0

        print(f"\nForeign Key Relationships ({len(relationships)}):")
        print("-" * 70)

        if args.json:
            print(json.dumps(relationships, indent=2))
        else:
            for rel in relationships:
                from_cols = ", ".join(rel["from_columns"])
                to_cols = ", ".join(rel["to_columns"])
                print(f"  {rel['from_table']} ({from_cols})")
                print(f"    → {rel['to_table']} ({to_cols})")
                print(f"      [{rel['constraint']}]")
                print()

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def cmd_stats(args) -> int:
    """Execute the stats command - show graph statistics."""
    db_path = get_db_path(args)

    if not Path(db_path).exists():
        print(f"Error: Graph database not found at {db_path}")
        print("Run 'dao scan' first to build the graph.")
        return 1

    try:
        with GraphStorage(db_path) as storage:
            stats = storage.get_stats()
            db_name = storage.get_metadata("database_name")
            server_name = storage.get_metadata("server_name")
            scan_time = storage.get_metadata("scan_timestamp")
            version = storage.get_metadata("version")

        print("\nDAO Graph Statistics")
        print("=" * 40)
        print(f"Database: {db_name or 'Unknown'}")
        print(f"Server: {server_name or 'Unknown'}")
        print(f"Scan time: {scan_time or 'Unknown'}")
        print(f"Graph version: {version or 'Unknown'}")
        print()
        print(f"Tables: {stats['tables']}")
        print(f"Columns: {stats['columns']}")
        print(f"Foreign keys: {stats['foreign_keys']}")
        print(f"Column relationships: {stats['column_relationships']}")
        print()

        if args.json:
            print("JSON:")
            full_stats = {
                "database": db_name,
                "server": server_name,
                "scan_timestamp": scan_time,
                "version": version,
                **stats
            }
            print(json.dumps(full_stats, indent=2))

        return 0

    except Exception as e:
        print(f"Error: {e}")
        return 1


def main() -> int:
    """Main entry point for the DAO CLI."""
    parser = argparse.ArgumentParser(
        prog="dao",
        description="DAO - Database Analysis & Ontology",
        epilog="Use 'dao <command> --help' for more information on a command."
    )
    parser.add_argument(
        "--db",
        help=f"Path to graph database (default: {DEFAULT_DB_PATH})",
        default=None
    )
    parser.add_argument(
        "--version",
        action="version",
        version="%(prog)s 1.0.0"
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # scan command
    scan_parser = subparsers.add_parser(
        "scan",
        help="Extract schema from SQL Server and build graph"
    )
    scan_parser.add_argument(
        "--connection", "-c",
        help="ODBC connection string"
    )
    scan_parser.add_argument(
        "--server", "-s",
        help="SQL Server hostname or instance"
    )
    scan_parser.add_argument(
        "--database", "-d",
        help="Database name"
    )
    scan_parser.add_argument(
        "--driver",
        help="ODBC driver name (default: ODBC Driver 17 for SQL Server)"
    )
    scan_parser.add_argument(
        "--username", "-u",
        help="SQL Server username (for SQL auth)"
    )
    scan_parser.add_argument(
        "--password", "-p",
        help="SQL Server password (for SQL auth)"
    )
    scan_parser.set_defaults(func=cmd_scan)

    # explain command
    explain_parser = subparsers.add_parser(
        "explain",
        help="Show table details and relationships"
    )
    explain_parser.add_argument(
        "table",
        help="Table name (e.g., 'Users' or 'dbo.Users')"
    )
    explain_parser.add_argument(
        "--columns",
        action="store_true",
        help="Include column details"
    )
    explain_parser.set_defaults(func=cmd_explain)

    # path command
    path_parser = subparsers.add_parser(
        "path",
        help="Find join path between two tables"
    )
    path_parser.add_argument(
        "from_table",
        help="Source table"
    )
    path_parser.add_argument(
        "to_table",
        help="Target table"
    )
    path_parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format"
    )
    path_parser.set_defaults(func=cmd_path)

    # join command
    join_parser = subparsers.add_parser(
        "join",
        help="Generate JOIN SQL for tables"
    )
    join_parser.add_argument(
        "tables",
        nargs="+",
        help="Tables to join (at least 2)"
    )
    join_parser.add_argument(
        "--json",
        action="store_true",
        help="Include JSON output"
    )
    join_parser.set_defaults(func=cmd_join)

    # tables command
    tables_parser = subparsers.add_parser(
        "tables",
        help="List all tables"
    )
    tables_parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format"
    )
    tables_parser.set_defaults(func=cmd_tables)

    # relationships command
    rel_parser = subparsers.add_parser(
        "relationships",
        help="List all foreign key relationships"
    )
    rel_parser.add_argument(
        "--json",
        action="store_true",
        help="Output in JSON format"
    )
    rel_parser.set_defaults(func=cmd_relationships)

    # stats command
    stats_parser = subparsers.add_parser(
        "stats",
        help="Show graph statistics"
    )
    stats_parser.add_argument(
        "--json",
        action="store_true",
        help="Include JSON output"
    )
    stats_parser.set_defaults(func=cmd_stats)

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return 0

    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
