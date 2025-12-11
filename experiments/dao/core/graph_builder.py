"""
DAO Graph Builder - Transforms raw metadata into a knowledge graph.

Creates nodes for tables and columns, and edges for relationships.
"""

from datetime import datetime
from typing import Optional

from .extractor import RawMetadata, TableInfo, ColumnInfo, PrimaryKeyInfo, ForeignKeyInfo
from .storage import GraphStorage, Node, Edge


class GraphBuilder:
    """Builds a knowledge graph from raw database metadata."""

    # Edge weights (lower = stronger relationship)
    WEIGHT_FK = 1           # Foreign key relationships
    WEIGHT_FK_COL = 1       # Column-level FK relationships
    WEIGHT_INFERRED = 5     # Inferred relationships (v2)

    def __init__(self, storage: GraphStorage):
        """
        Initialize the graph builder.

        Args:
            storage: GraphStorage instance to store the graph.
        """
        self.storage = storage
        self._pk_columns: dict[str, set[str]] = {}  # table -> set of PK column names

    def build(self, metadata: RawMetadata, clear_existing: bool = True) -> dict:
        """
        Build the knowledge graph from raw metadata.

        Args:
            metadata: RawMetadata extracted from SQL Server.
            clear_existing: Whether to clear existing graph data.

        Returns:
            Dictionary with build statistics.
        """
        if clear_existing:
            self.storage.clear()

        # Build lookup for primary key columns
        self._build_pk_lookup(metadata.primary_keys)

        # Create nodes
        table_nodes = self._create_table_nodes(metadata.tables, metadata.primary_keys)
        column_nodes = self._create_column_nodes(metadata.columns)

        # Create edges
        fk_edges = self._create_fk_edges(metadata.foreign_keys)
        fk_col_edges = self._create_fk_column_edges(metadata.foreign_keys)

        # Store all nodes and edges
        self.storage.add_nodes(table_nodes)
        self.storage.add_nodes(column_nodes)
        self.storage.add_edges(fk_edges)
        self.storage.add_edges(fk_col_edges)

        # Store metadata
        self.storage.set_metadata("database_name", metadata.database_name)
        self.storage.set_metadata("server_name", metadata.server_name)
        self.storage.set_metadata("scan_timestamp", datetime.now().isoformat())
        self.storage.set_metadata("version", "1.0")

        stats = {
            "tables": len(table_nodes),
            "columns": len(column_nodes),
            "foreign_keys": len(fk_edges),
            "column_relationships": len(fk_col_edges),
            "database": metadata.database_name,
            "server": metadata.server_name
        }

        return stats

    def _build_pk_lookup(self, primary_keys: list[PrimaryKeyInfo]) -> None:
        """Build lookup dictionary for primary key columns."""
        self._pk_columns = {}
        for pk in primary_keys:
            table_name = pk.full_table_name
            if table_name not in self._pk_columns:
                self._pk_columns[table_name] = set()
            self._pk_columns[table_name].update(pk.columns)

    def _is_pk_column(self, table_name: str, column_name: str) -> bool:
        """Check if a column is part of the primary key."""
        return column_name in self._pk_columns.get(table_name, set())

    def _create_table_nodes(
        self,
        tables: list[TableInfo],
        primary_keys: list[PrimaryKeyInfo]
    ) -> list[Node]:
        """Create table nodes from table metadata."""
        # Build lookup for PKs
        pk_lookup: dict[str, list[str]] = {}
        for pk in primary_keys:
            pk_lookup[pk.full_table_name] = pk.columns

        nodes = []
        for table in tables:
            pk_columns = pk_lookup.get(table.full_name, [])

            node = Node(
                id=table.full_name,
                type="table",
                data={
                    "schema": table.schema,
                    "name": table.name,
                    "row_count": table.row_count,
                    "size_mb": table.size_mb,
                    "primary_key": pk_columns,
                    "tags": self._infer_table_tags(table.name)
                }
            )
            nodes.append(node)

        return nodes

    def _create_column_nodes(self, columns: list[ColumnInfo]) -> list[Node]:
        """Create column nodes from column metadata."""
        nodes = []
        for column in columns:
            is_pk = self._is_pk_column(column.full_table_name, column.name)

            node = Node(
                id=column.full_name,
                type="column",
                data={
                    "table": column.full_table_name,
                    "name": column.name,
                    "sql_type": column.sql_type,
                    "is_nullable": column.is_nullable,
                    "is_pk": is_pk,
                    "is_fk": False,  # Will be updated when processing FKs
                    "ordinal_position": column.ordinal_position,
                    "max_length": column.max_length,
                    "precision": column.precision,
                    "scale": column.scale
                }
            )
            nodes.append(node)

        return nodes

    def _create_fk_edges(self, foreign_keys: list[ForeignKeyInfo]) -> list[Edge]:
        """Create table-level foreign key edges."""
        edges = []
        seen = set()  # Avoid duplicate edges

        for fk in foreign_keys:
            edge_key = (fk.from_full_name, fk.to_full_name)
            if edge_key in seen:
                continue
            seen.add(edge_key)

            # Build via columns list
            via = []
            for from_col, to_col in zip(fk.from_columns, fk.to_columns):
                via.append(f"{fk.from_full_name}.{from_col}")
                via.append(f"{fk.to_full_name}.{to_col}")

            edge = Edge(
                id=f"fk:{fk.constraint_name}",
                from_id=fk.from_full_name,
                to_id=fk.to_full_name,
                type="fk",
                weight=self.WEIGHT_FK,
                data={
                    "constraint_name": fk.constraint_name,
                    "from_columns": fk.from_columns,
                    "to_columns": fk.to_columns,
                    "via": via
                }
            )
            edges.append(edge)

        return edges

    def _create_fk_column_edges(self, foreign_keys: list[ForeignKeyInfo]) -> list[Edge]:
        """Create column-level foreign key edges."""
        edges = []

        for fk in foreign_keys:
            for i, (from_col, to_col) in enumerate(zip(fk.from_columns, fk.to_columns)):
                from_col_id = f"{fk.from_full_name}.{from_col}"
                to_col_id = f"{fk.to_full_name}.{to_col}"

                edge = Edge(
                    id=f"fk_col:{fk.constraint_name}:{i}",
                    from_id=from_col_id,
                    to_id=to_col_id,
                    type="fk_col",
                    weight=self.WEIGHT_FK_COL,
                    data={
                        "constraint_name": fk.constraint_name,
                        "from_table": fk.from_full_name,
                        "to_table": fk.to_full_name
                    }
                )
                edges.append(edge)

                # Mark the from column as FK
                self._mark_column_as_fk(from_col_id)

        return edges

    def _mark_column_as_fk(self, column_id: str) -> None:
        """Mark a column node as being a foreign key."""
        node = self.storage.get_node(column_id)
        if node:
            node.data["is_fk"] = True
            self.storage.add_node(node)

    def _infer_table_tags(self, table_name: str) -> list[str]:
        """
        Infer semantic tags based on table naming conventions.

        This is a simple heuristic that can be expanded in v2.
        """
        tags = []
        name_lower = table_name.lower()

        # Common patterns
        if name_lower.endswith("s") or name_lower.endswith("es"):
            tags.append("collection")

        if any(word in name_lower for word in ["user", "account", "person", "member", "employee"]):
            tags.append("actor")

        if any(word in name_lower for word in ["order", "invoice", "payment", "transaction"]):
            tags.append("transaction")

        if any(word in name_lower for word in ["product", "item", "article", "inventory"]):
            tags.append("inventory")

        if any(word in name_lower for word in ["log", "audit", "history", "event"]):
            tags.append("audit")

        if any(word in name_lower for word in ["config", "setting", "option", "preference"]):
            tags.append("config")

        if any(word in name_lower for word in ["lookup", "type", "status", "category"]):
            tags.append("reference")

        return tags


def build_graph_from_metadata(
    metadata: RawMetadata,
    db_path: str = "dao_graph.sqlite",
    clear_existing: bool = True
) -> dict:
    """
    Convenience function to build a graph from metadata.

    Args:
        metadata: RawMetadata extracted from SQL Server.
        db_path: Path to SQLite database for graph storage.
        clear_existing: Whether to clear existing graph data.

    Returns:
        Dictionary with build statistics.
    """
    with GraphStorage(db_path) as storage:
        builder = GraphBuilder(storage)
        return builder.build(metadata, clear_existing)
