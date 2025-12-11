"""
DAO Query Engine - Path finding, join generation, and explainers.

Implements graph algorithms for finding relationships and generating SQL.
"""

import heapq
from dataclasses import dataclass, field
from typing import Optional

from .storage import GraphStorage, Node, Edge


@dataclass
class PathResult:
    """Result of a path finding operation."""
    found: bool
    path: list[str]  # List of table names in order
    edges: list[Edge]  # Edges connecting the tables
    total_weight: int
    explanation: str

    def to_dict(self) -> dict:
        return {
            "found": self.found,
            "path": self.path,
            "edges": [e.to_dict() for e in self.edges],
            "total_weight": self.total_weight,
            "explanation": self.explanation
        }


@dataclass
class TableExplanation:
    """Detailed explanation of a table and its relationships."""
    table_name: str
    schema: str
    name: str
    primary_key: list[str]
    row_count: Optional[int]
    size_mb: Optional[float]
    columns: list[dict]
    outgoing_relationships: list[dict]  # This table references...
    incoming_relationships: list[dict]  # Referenced by...
    tags: list[str]


@dataclass
class JoinResult:
    """Result of a join generation operation."""
    success: bool
    sql: str
    tables: list[str]
    joins: list[dict]
    explanation: str

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "sql": self.sql,
            "tables": self.tables,
            "joins": [j for j in self.joins],
            "explanation": self.explanation
        }


class QueryEngine:
    """Executes queries against the DAO knowledge graph."""

    def __init__(self, storage: GraphStorage):
        """
        Initialize the query engine.

        Args:
            storage: GraphStorage instance containing the graph.
        """
        self.storage = storage
        self._adjacency: dict[str, list[tuple[str, Edge]]] = {}
        self._build_adjacency()

    def _build_adjacency(self) -> None:
        """Build adjacency list for efficient path finding."""
        self._adjacency = {}

        # Get all FK edges (table-level)
        edges = self.storage.get_edges_by_type("fk")

        for edge in edges:
            # Add forward edge
            if edge.from_id not in self._adjacency:
                self._adjacency[edge.from_id] = []
            self._adjacency[edge.from_id].append((edge.to_id, edge))

            # Add reverse edge (for undirected join traversal)
            if edge.to_id not in self._adjacency:
                self._adjacency[edge.to_id] = []
            # Create reverse edge representation
            reverse_edge = Edge(
                id=f"rev:{edge.id}",
                from_id=edge.to_id,
                to_id=edge.from_id,
                type=edge.type,
                weight=edge.weight,
                data={
                    **edge.data,
                    "reverse": True,
                    "original_direction": "from"
                }
            )
            self._adjacency[edge.to_id].append((edge.from_id, reverse_edge))

    def refresh(self) -> None:
        """Refresh the adjacency list from storage."""
        self._build_adjacency()

    def find_path(self, from_table: str, to_table: str) -> PathResult:
        """
        Find the shortest path between two tables using Dijkstra's algorithm.

        Args:
            from_table: Starting table name (e.g., "dbo.Users")
            to_table: Target table name (e.g., "dbo.Orders")

        Returns:
            PathResult with the path if found.
        """
        # Resolve table names
        from_table = self._resolve_table_name(from_table)
        to_table = self._resolve_table_name(to_table)

        if not from_table or not to_table:
            return PathResult(
                found=False,
                path=[],
                edges=[],
                total_weight=0,
                explanation="One or both tables not found in the graph."
            )

        if from_table == to_table:
            return PathResult(
                found=True,
                path=[from_table],
                edges=[],
                total_weight=0,
                explanation="Same table specified for source and target."
            )

        # Dijkstra's algorithm
        distances = {from_table: 0}
        previous: dict[str, tuple[str, Edge]] = {}
        heap = [(0, from_table)]
        visited = set()

        while heap:
            current_dist, current = heapq.heappop(heap)

            if current in visited:
                continue
            visited.add(current)

            if current == to_table:
                break

            for neighbor, edge in self._adjacency.get(current, []):
                if neighbor in visited:
                    continue

                new_dist = current_dist + edge.weight
                if neighbor not in distances or new_dist < distances[neighbor]:
                    distances[neighbor] = new_dist
                    previous[neighbor] = (current, edge)
                    heapq.heappush(heap, (new_dist, neighbor))

        # Reconstruct path
        if to_table not in previous and from_table != to_table:
            return PathResult(
                found=False,
                path=[],
                edges=[],
                total_weight=0,
                explanation=f"No path found between {from_table} and {to_table}."
            )

        path = []
        edges = []
        current = to_table

        while current in previous:
            path.append(current)
            prev, edge = previous[current]
            edges.append(edge)
            current = prev

        path.append(from_table)
        path.reverse()
        edges.reverse()

        return PathResult(
            found=True,
            path=path,
            edges=edges,
            total_weight=distances.get(to_table, 0),
            explanation=self._explain_path(path, edges)
        )

    def find_multi_path(self, tables: list[str]) -> PathResult:
        """
        Find a path connecting multiple tables.

        Uses a greedy approach to connect tables in order.

        Args:
            tables: List of table names to connect.

        Returns:
            PathResult with the combined path.
        """
        if len(tables) < 2:
            return PathResult(
                found=False,
                path=tables,
                edges=[],
                total_weight=0,
                explanation="Need at least two tables to find a path."
            )

        # Resolve all table names
        resolved_tables = [self._resolve_table_name(t) for t in tables]
        if not all(resolved_tables):
            missing = [t for t, r in zip(tables, resolved_tables) if not r]
            return PathResult(
                found=False,
                path=[],
                edges=[],
                total_weight=0,
                explanation=f"Tables not found: {', '.join(missing)}"
            )

        # Find path between consecutive tables
        full_path = [resolved_tables[0]]
        full_edges = []
        total_weight = 0

        for i in range(len(resolved_tables) - 1):
            result = self.find_path(resolved_tables[i], resolved_tables[i + 1])
            if not result.found:
                return PathResult(
                    found=False,
                    path=full_path,
                    edges=full_edges,
                    total_weight=total_weight,
                    explanation=f"No path found between {resolved_tables[i]} and {resolved_tables[i + 1]}."
                )

            # Add path (skip first node as it's the same as previous end)
            full_path.extend(result.path[1:])
            full_edges.extend(result.edges)
            total_weight += result.total_weight

        return PathResult(
            found=True,
            path=full_path,
            edges=full_edges,
            total_weight=total_weight,
            explanation=self._explain_path(full_path, full_edges)
        )

    def generate_join(self, tables: list[str], select_all: bool = True) -> JoinResult:
        """
        Generate a JOIN query for the specified tables.

        Args:
            tables: List of table names to join.
            select_all: Whether to select all columns (SELECT *).

        Returns:
            JoinResult with the generated SQL.
        """
        if len(tables) < 2:
            return JoinResult(
                success=False,
                sql="",
                tables=tables,
                joins=[],
                explanation="Need at least two tables to generate a join."
            )

        # Find path connecting all tables
        path_result = self.find_multi_path(tables)
        if not path_result.found:
            return JoinResult(
                success=False,
                sql="",
                tables=tables,
                joins=[],
                explanation=path_result.explanation
            )

        # Generate aliases
        aliases = self._generate_aliases(path_result.path)

        # Build SELECT clause
        if select_all:
            select_parts = [f"    {aliases[t]}.*" for t in path_result.path]
            select_clause = ",\n".join(select_parts)
        else:
            select_clause = "    *"

        # Build FROM and JOIN clauses
        first_table = path_result.path[0]
        from_clause = f"{first_table} {aliases[first_table]}"

        join_clauses = []
        joins_info = []

        for i, edge in enumerate(path_result.edges):
            # Determine join direction
            from_table = path_result.path[i]
            to_table = path_result.path[i + 1]

            # Get column mappings from edge data
            is_reverse = edge.data.get("reverse", False)

            if is_reverse:
                # Reversed edge: original was to_table -> from_table
                from_cols = edge.data.get("to_columns", [])
                to_cols = edge.data.get("from_columns", [])
            else:
                from_cols = edge.data.get("from_columns", [])
                to_cols = edge.data.get("to_columns", [])

            # Build ON conditions
            on_conditions = []
            for from_col, to_col in zip(from_cols, to_cols):
                if is_reverse:
                    on_conditions.append(
                        f"{aliases[to_table]}.{from_col} = {aliases[from_table]}.{to_col}"
                    )
                else:
                    on_conditions.append(
                        f"{aliases[to_table]}.{to_col} = {aliases[from_table]}.{from_col}"
                    )

            on_clause = " AND ".join(on_conditions) if on_conditions else "1=1"

            join_clause = f"JOIN {to_table} {aliases[to_table]}\n    ON {on_clause}"
            join_clauses.append(join_clause)

            joins_info.append({
                "from_table": from_table,
                "from_alias": aliases[from_table],
                "to_table": to_table,
                "to_alias": aliases[to_table],
                "on_conditions": on_conditions,
                "constraint": edge.data.get("constraint_name", "")
            })

        # Assemble SQL
        sql = f"SELECT\n{select_clause}\nFROM {from_clause}"
        if join_clauses:
            sql += "\n" + "\n".join(join_clauses)
        sql += ";"

        return JoinResult(
            success=True,
            sql=sql,
            tables=path_result.path,
            joins=joins_info,
            explanation=f"Generated join connecting {len(path_result.path)} tables via {len(join_clauses)} JOIN(s)."
        )

    def explain_table(self, table_name: str) -> Optional[TableExplanation]:
        """
        Get a detailed explanation of a table and its relationships.

        Args:
            table_name: Table name (e.g., "dbo.Users" or just "Users")

        Returns:
            TableExplanation or None if table not found.
        """
        resolved_name = self._resolve_table_name(table_name)
        if not resolved_name:
            return None

        table_node = self.storage.get_node(resolved_name)
        if not table_node:
            return None

        # Get columns for this table
        all_columns = self.storage.get_nodes_by_type("column")
        columns = [
            c.data for c in all_columns
            if c.data.get("table") == resolved_name
        ]
        columns.sort(key=lambda c: c.get("ordinal_position", 0))

        # Get relationships
        outgoing = []
        incoming = []

        edges = self.storage.get_edges_by_type("fk")
        for edge in edges:
            if edge.from_id == resolved_name:
                outgoing.append({
                    "to_table": edge.to_id,
                    "constraint": edge.data.get("constraint_name", ""),
                    "from_columns": edge.data.get("from_columns", []),
                    "to_columns": edge.data.get("to_columns", [])
                })
            elif edge.to_id == resolved_name:
                incoming.append({
                    "from_table": edge.from_id,
                    "constraint": edge.data.get("constraint_name", ""),
                    "from_columns": edge.data.get("from_columns", []),
                    "to_columns": edge.data.get("to_columns", [])
                })

        return TableExplanation(
            table_name=resolved_name,
            schema=table_node.data.get("schema", ""),
            name=table_node.data.get("name", ""),
            primary_key=table_node.data.get("primary_key", []),
            row_count=table_node.data.get("row_count"),
            size_mb=table_node.data.get("size_mb"),
            columns=columns,
            outgoing_relationships=outgoing,
            incoming_relationships=incoming,
            tags=table_node.data.get("tags", [])
        )

    def list_tables(self) -> list[dict]:
        """Get a summary list of all tables."""
        tables = self.storage.get_nodes_by_type("table")
        return [
            {
                "name": t.id,
                "schema": t.data.get("schema", ""),
                "table": t.data.get("name", ""),
                "row_count": t.data.get("row_count"),
                "size_mb": t.data.get("size_mb"),
                "pk": t.data.get("primary_key", []),
                "tags": t.data.get("tags", [])
            }
            for t in sorted(tables, key=lambda x: x.id)
        ]

    def list_relationships(self) -> list[dict]:
        """Get a summary list of all foreign key relationships."""
        edges = self.storage.get_edges_by_type("fk")
        return [
            {
                "from_table": e.from_id,
                "to_table": e.to_id,
                "constraint": e.data.get("constraint_name", ""),
                "from_columns": e.data.get("from_columns", []),
                "to_columns": e.data.get("to_columns", [])
            }
            for e in sorted(edges, key=lambda x: (x.from_id, x.to_id))
        ]

    def _resolve_table_name(self, table_name: str) -> Optional[str]:
        """
        Resolve a table name to its full qualified name.

        Handles cases like "Users" -> "dbo.Users"
        """
        # Check if it's already a full name
        node = self.storage.get_node(table_name)
        if node and node.type == "table":
            return table_name

        # Try to find by short name
        tables = self.storage.get_nodes_by_type("table")
        for table in tables:
            if table.data.get("name", "").lower() == table_name.lower():
                return table.id

        return None

    def _generate_aliases(self, tables: list[str]) -> dict[str, str]:
        """
        Generate short aliases for tables.

        Uses first letter(s) of table name, with numbers for conflicts.
        """
        aliases = {}
        used = set()

        for table in tables:
            # Extract table name (after the dot)
            name = table.split(".")[-1] if "." in table else table

            # Try single letter first
            base = name[0].lower()
            alias = base

            counter = 1
            while alias in used:
                counter += 1
                if counter <= len(name):
                    alias = name[:counter].lower()
                else:
                    alias = f"{base}{counter - len(name)}"

            aliases[table] = alias
            used.add(alias)

        return aliases

    def _explain_path(self, path: list[str], edges: list[Edge]) -> str:
        """Generate a human-readable explanation of a path."""
        if len(path) == 0:
            return "Empty path."

        if len(path) == 1:
            return f"Single table: {path[0]}"

        explanations = [f"Path: {path[0]}"]

        for i, edge in enumerate(edges):
            direction = "→" if not edge.data.get("reverse") else "←"
            constraint = edge.data.get("constraint_name", "relationship")
            explanations.append(f"  {direction} {path[i + 1]} (via {constraint})")

        return "\n".join(explanations)


def create_engine(db_path: str = "dao_graph.sqlite") -> QueryEngine:
    """
    Create a query engine from a graph database.

    Args:
        db_path: Path to SQLite database.

    Returns:
        QueryEngine instance.
    """
    storage = GraphStorage(db_path)
    return QueryEngine(storage)
