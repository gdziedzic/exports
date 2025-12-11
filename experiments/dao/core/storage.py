"""
DAO Storage Layer - SQLite-based graph storage.

Stores nodes and edges for the database knowledge graph.
"""

import json
import sqlite3
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import Any, Optional


@dataclass
class Node:
    """Represents a node in the knowledge graph (table or column)."""
    id: str
    type: str  # 'table' or 'column'
    data: dict

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class Edge:
    """Represents an edge in the knowledge graph (relationship)."""
    id: str
    from_id: str
    to_id: str
    type: str  # 'fk', 'fk_col', 'inferred_fk'
    weight: int
    data: dict

    def to_dict(self) -> dict:
        return asdict(self)


class GraphStorage:
    """SQLite-based storage for the DAO knowledge graph."""

    def __init__(self, db_path: str = "dao_graph.sqlite"):
        """
        Initialize the graph storage.

        Args:
            db_path: Path to the SQLite database file.
        """
        self.db_path = Path(db_path)
        self._connection: Optional[sqlite3.Connection] = None
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        """Get or create a database connection."""
        if self._connection is None:
            self._connection = sqlite3.connect(str(self.db_path))
            self._connection.row_factory = sqlite3.Row
        return self._connection

    def _init_db(self) -> None:
        """Initialize the database schema."""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Create nodes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                data TEXT NOT NULL
            )
        """)

        # Create edges table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS edges (
                id TEXT PRIMARY KEY,
                from_id TEXT NOT NULL,
                to_id TEXT NOT NULL,
                type TEXT NOT NULL,
                weight INTEGER NOT NULL DEFAULT 1,
                data TEXT NOT NULL,
                FOREIGN KEY (from_id) REFERENCES nodes(id),
                FOREIGN KEY (to_id) REFERENCES nodes(id)
            )
        """)

        # Create indexes for faster lookups
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_id)
        """)
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_edges_type ON edges(type)
        """)

        # Create metadata table for scan info
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS metadata (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
        """)

        conn.commit()

    def clear(self) -> None:
        """Clear all data from the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM edges")
        cursor.execute("DELETE FROM nodes")
        cursor.execute("DELETE FROM metadata")
        conn.commit()

    def add_node(self, node: Node) -> None:
        """Add a node to the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO nodes (id, type, data) VALUES (?, ?, ?)",
            (node.id, node.type, json.dumps(node.data))
        )
        conn.commit()

    def add_nodes(self, nodes: list[Node]) -> None:
        """Add multiple nodes to the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.executemany(
            "INSERT OR REPLACE INTO nodes (id, type, data) VALUES (?, ?, ?)",
            [(n.id, n.type, json.dumps(n.data)) for n in nodes]
        )
        conn.commit()

    def get_node(self, node_id: str) -> Optional[Node]:
        """Get a node by ID."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, type, data FROM nodes WHERE id = ?", (node_id,))
        row = cursor.fetchone()
        if row:
            return Node(id=row["id"], type=row["type"], data=json.loads(row["data"]))
        return None

    def get_nodes_by_type(self, node_type: str) -> list[Node]:
        """Get all nodes of a specific type."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, type, data FROM nodes WHERE type = ?", (node_type,))
        return [
            Node(id=row["id"], type=row["type"], data=json.loads(row["data"]))
            for row in cursor.fetchall()
        ]

    def get_all_nodes(self) -> list[Node]:
        """Get all nodes in the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, type, data FROM nodes")
        return [
            Node(id=row["id"], type=row["type"], data=json.loads(row["data"]))
            for row in cursor.fetchall()
        ]

    def add_edge(self, edge: Edge) -> None:
        """Add an edge to the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """INSERT OR REPLACE INTO edges
               (id, from_id, to_id, type, weight, data)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (edge.id, edge.from_id, edge.to_id, edge.type, edge.weight, json.dumps(edge.data))
        )
        conn.commit()

    def add_edges(self, edges: list[Edge]) -> None:
        """Add multiple edges to the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.executemany(
            """INSERT OR REPLACE INTO edges
               (id, from_id, to_id, type, weight, data)
               VALUES (?, ?, ?, ?, ?, ?)""",
            [(e.id, e.from_id, e.to_id, e.type, e.weight, json.dumps(e.data)) for e in edges]
        )
        conn.commit()

    def get_edge(self, edge_id: str) -> Optional[Edge]:
        """Get an edge by ID."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, from_id, to_id, type, weight, data FROM edges WHERE id = ?",
            (edge_id,)
        )
        row = cursor.fetchone()
        if row:
            return Edge(
                id=row["id"],
                from_id=row["from_id"],
                to_id=row["to_id"],
                type=row["type"],
                weight=row["weight"],
                data=json.loads(row["data"])
            )
        return None

    def get_edges_from(self, node_id: str) -> list[Edge]:
        """Get all edges originating from a node."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, from_id, to_id, type, weight, data FROM edges WHERE from_id = ?",
            (node_id,)
        )
        return [
            Edge(
                id=row["id"],
                from_id=row["from_id"],
                to_id=row["to_id"],
                type=row["type"],
                weight=row["weight"],
                data=json.loads(row["data"])
            )
            for row in cursor.fetchall()
        ]

    def get_edges_to(self, node_id: str) -> list[Edge]:
        """Get all edges pointing to a node."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, from_id, to_id, type, weight, data FROM edges WHERE to_id = ?",
            (node_id,)
        )
        return [
            Edge(
                id=row["id"],
                from_id=row["from_id"],
                to_id=row["to_id"],
                type=row["type"],
                weight=row["weight"],
                data=json.loads(row["data"])
            )
            for row in cursor.fetchall()
        ]

    def get_edges_for_node(self, node_id: str) -> list[Edge]:
        """Get all edges connected to a node (both directions)."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            """SELECT id, from_id, to_id, type, weight, data
               FROM edges WHERE from_id = ? OR to_id = ?""",
            (node_id, node_id)
        )
        return [
            Edge(
                id=row["id"],
                from_id=row["from_id"],
                to_id=row["to_id"],
                type=row["type"],
                weight=row["weight"],
                data=json.loads(row["data"])
            )
            for row in cursor.fetchall()
        ]

    def get_edges_by_type(self, edge_type: str) -> list[Edge]:
        """Get all edges of a specific type."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "SELECT id, from_id, to_id, type, weight, data FROM edges WHERE type = ?",
            (edge_type,)
        )
        return [
            Edge(
                id=row["id"],
                from_id=row["from_id"],
                to_id=row["to_id"],
                type=row["type"],
                weight=row["weight"],
                data=json.loads(row["data"])
            )
            for row in cursor.fetchall()
        ]

    def get_all_edges(self) -> list[Edge]:
        """Get all edges in the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, from_id, to_id, type, weight, data FROM edges")
        return [
            Edge(
                id=row["id"],
                from_id=row["from_id"],
                to_id=row["to_id"],
                type=row["type"],
                weight=row["weight"],
                data=json.loads(row["data"])
            )
            for row in cursor.fetchall()
        ]

    def set_metadata(self, key: str, value: Any) -> None:
        """Store metadata about the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(
            "INSERT OR REPLACE INTO metadata (key, value) VALUES (?, ?)",
            (key, json.dumps(value))
        )
        conn.commit()

    def get_metadata(self, key: str) -> Optional[Any]:
        """Retrieve metadata from the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT value FROM metadata WHERE key = ?", (key,))
        row = cursor.fetchone()
        if row:
            return json.loads(row["value"])
        return None

    def get_stats(self) -> dict:
        """Get statistics about the graph."""
        conn = self._get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT COUNT(*) as count FROM nodes WHERE type = 'table'")
        table_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM nodes WHERE type = 'column'")
        column_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM edges WHERE type = 'fk'")
        fk_count = cursor.fetchone()["count"]

        cursor.execute("SELECT COUNT(*) as count FROM edges WHERE type = 'fk_col'")
        fk_col_count = cursor.fetchone()["count"]

        return {
            "tables": table_count,
            "columns": column_count,
            "foreign_keys": fk_count,
            "column_relationships": fk_col_count
        }

    def close(self) -> None:
        """Close the database connection."""
        if self._connection:
            self._connection.close()
            self._connection = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()
