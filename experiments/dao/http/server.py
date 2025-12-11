#!/usr/bin/env python3
"""
DAO HTTP Server - Lightweight REST API for the DAO knowledge graph.

Provides endpoints for querying the graph without using the CLI.

Endpoints:
    GET /tables              - List all tables
    GET /tables/<name>       - Get table details (explain)
    GET /columns             - List all columns
    GET /relationships       - List all FK relationships
    GET /path?from=A&to=B    - Find path between tables
    GET /join?tables=A,B,C   - Generate JOIN SQL
    GET /stats               - Get graph statistics
    GET /health              - Health check
"""

import json
import sys
from http.server import HTTPServer, BaseHTTPRequestHandler
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse

# Support both module and standalone execution
try:
    from ..core.storage import GraphStorage
    from ..core.query_engine import QueryEngine, create_engine
except ImportError:
    # Standalone execution - add parent to path
    sys.path.insert(0, str(Path(__file__).parent.parent))
    from core.storage import GraphStorage
    from core.query_engine import QueryEngine, create_engine


# Default settings
DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 9000
DEFAULT_DB_PATH = "dao_graph.sqlite"


class DAORequestHandler(BaseHTTPRequestHandler):
    """HTTP request handler for DAO API."""

    # Class-level storage for configuration
    db_path: str = DEFAULT_DB_PATH
    engine: Optional[QueryEngine] = None

    def _send_json(self, data: Any, status: int = 200) -> None:
        """Send a JSON response."""
        response = json.dumps(data, indent=2)
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(response)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response.encode())

    def _send_error(self, message: str, status: int = 400) -> None:
        """Send an error response."""
        self._send_json({"error": message}, status)

    def _get_engine(self) -> Optional[QueryEngine]:
        """Get or create query engine."""
        if not Path(self.db_path).exists():
            return None

        if DAORequestHandler.engine is None:
            DAORequestHandler.engine = create_engine(self.db_path)

        return DAORequestHandler.engine

    def _parse_path(self) -> tuple[str, dict]:
        """Parse URL path and query parameters."""
        parsed = urlparse(self.path)
        path = parsed.path
        query = parse_qs(parsed.query)
        # Flatten single-value params
        params = {k: v[0] if len(v) == 1 else v for k, v in query.items()}
        return path, params

    def do_GET(self) -> None:
        """Handle GET requests."""
        path, params = self._parse_path()

        # Route to appropriate handler
        if path == "/health":
            self._handle_health()
        elif path == "/tables":
            self._handle_tables()
        elif path.startswith("/tables/"):
            table_name = path[8:]  # Remove "/tables/"
            self._handle_table_detail(table_name)
        elif path == "/columns":
            self._handle_columns()
        elif path == "/relationships":
            self._handle_relationships()
        elif path == "/path":
            self._handle_path(params)
        elif path == "/join":
            self._handle_join(params)
        elif path == "/stats":
            self._handle_stats()
        else:
            self._send_error(f"Unknown endpoint: {path}", 404)

    def do_OPTIONS(self) -> None:
        """Handle CORS preflight requests."""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def _handle_health(self) -> None:
        """Handle /health endpoint."""
        db_exists = Path(self.db_path).exists()
        self._send_json({
            "status": "ok" if db_exists else "no_graph",
            "database": self.db_path,
            "database_exists": db_exists
        })

    def _handle_tables(self) -> None:
        """Handle /tables endpoint."""
        engine = self._get_engine()
        if not engine:
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        tables = engine.list_tables()
        self._send_json({
            "count": len(tables),
            "tables": tables
        })

    def _handle_table_detail(self, table_name: str) -> None:
        """Handle /tables/<name> endpoint."""
        engine = self._get_engine()
        if not engine:
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        explanation = engine.explain_table(table_name)
        if not explanation:
            self._send_error(f"Table '{table_name}' not found.", 404)
            return

        self._send_json({
            "table_name": explanation.table_name,
            "schema": explanation.schema,
            "name": explanation.name,
            "primary_key": explanation.primary_key,
            "row_count": explanation.row_count,
            "size_mb": explanation.size_mb,
            "columns": explanation.columns,
            "outgoing_relationships": explanation.outgoing_relationships,
            "incoming_relationships": explanation.incoming_relationships,
            "tags": explanation.tags
        })

    def _handle_columns(self) -> None:
        """Handle /columns endpoint."""
        engine = self._get_engine()
        if not engine:
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        columns = engine.storage.get_nodes_by_type("column")
        column_list = [
            {
                "id": c.id,
                **c.data
            }
            for c in sorted(columns, key=lambda x: x.id)
        ]

        self._send_json({
            "count": len(column_list),
            "columns": column_list
        })

    def _handle_relationships(self) -> None:
        """Handle /relationships endpoint."""
        engine = self._get_engine()
        if not engine:
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        relationships = engine.list_relationships()
        self._send_json({
            "count": len(relationships),
            "relationships": relationships
        })

    def _handle_path(self, params: dict) -> None:
        """Handle /path endpoint."""
        engine = self._get_engine()
        if not engine:
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        from_table = params.get("from")
        to_table = params.get("to")

        if not from_table or not to_table:
            self._send_error("Missing required parameters: 'from' and 'to'")
            return

        result = engine.find_path(from_table, to_table)
        self._send_json(result.to_dict())

    def _handle_join(self, params: dict) -> None:
        """Handle /join endpoint."""
        engine = self._get_engine()
        if not engine:
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        tables_param = params.get("tables")
        if not tables_param:
            self._send_error("Missing required parameter: 'tables' (comma-separated)")
            return

        tables = [t.strip() for t in tables_param.split(",") if t.strip()]

        if len(tables) < 2:
            self._send_error("At least two tables required for a join.")
            return

        result = engine.generate_join(tables)
        self._send_json(result.to_dict())

    def _handle_stats(self) -> None:
        """Handle /stats endpoint."""
        if not Path(self.db_path).exists():
            self._send_error("Graph database not found. Run 'dao scan' first.", 404)
            return

        with GraphStorage(self.db_path) as storage:
            stats = storage.get_stats()
            db_name = storage.get_metadata("database_name")
            server_name = storage.get_metadata("server_name")
            scan_time = storage.get_metadata("scan_timestamp")
            version = storage.get_metadata("version")

        self._send_json({
            "database": db_name,
            "server": server_name,
            "scan_timestamp": scan_time,
            "version": version,
            **stats
        })

    def log_message(self, format: str, *args) -> None:
        """Custom log format."""
        print(f"[DAO] {args[0]} {args[1]} {args[2]}")


def run_server(
    host: str = DEFAULT_HOST,
    port: int = DEFAULT_PORT,
    db_path: str = DEFAULT_DB_PATH
) -> None:
    """
    Run the DAO HTTP server.

    Args:
        host: Host to bind to (default: 127.0.0.1)
        port: Port to listen on (default: 9000)
        db_path: Path to graph database
    """
    # Configure the handler
    DAORequestHandler.db_path = db_path
    DAORequestHandler.engine = None  # Reset engine

    server = HTTPServer((host, port), DAORequestHandler)

    print(f"DAO HTTP Server")
    print(f"===============")
    print(f"Listening on: http://{host}:{port}")
    print(f"Graph database: {db_path}")
    print()
    print("Endpoints:")
    print("  GET /tables              - List all tables")
    print("  GET /tables/<name>       - Get table details")
    print("  GET /columns             - List all columns")
    print("  GET /relationships       - List all FK relationships")
    print("  GET /path?from=A&to=B    - Find path between tables")
    print("  GET /join?tables=A,B,C   - Generate JOIN SQL")
    print("  GET /stats               - Get graph statistics")
    print("  GET /health              - Health check")
    print()
    print("Press Ctrl+C to stop...")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.shutdown()


def main() -> int:
    """Main entry point for the HTTP server."""
    import argparse

    parser = argparse.ArgumentParser(
        description="DAO HTTP Server - REST API for database schema graph"
    )
    parser.add_argument(
        "--host",
        default=DEFAULT_HOST,
        help=f"Host to bind to (default: {DEFAULT_HOST})"
    )
    parser.add_argument(
        "--port", "-p",
        type=int,
        default=DEFAULT_PORT,
        help=f"Port to listen on (default: {DEFAULT_PORT})"
    )
    parser.add_argument(
        "--db",
        default=DEFAULT_DB_PATH,
        help=f"Path to graph database (default: {DEFAULT_DB_PATH})"
    )

    args = parser.parse_args()

    run_server(args.host, args.port, args.db)
    return 0


if __name__ == "__main__":
    sys.exit(main())
