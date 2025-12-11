#!/usr/bin/env python3
"""
DAO Core Tests - Unit tests for core functionality.

These tests verify the graph storage, builder, and query engine
without requiring a SQL Server connection.
"""

import json
import os
import sys
import tempfile
import unittest
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.storage import GraphStorage, Node, Edge
from core.extractor import (
    RawMetadata,
    TableInfo,
    ColumnInfo,
    PrimaryKeyInfo,
    ForeignKeyInfo,
)
from core.graph_builder import GraphBuilder
from core.query_engine import QueryEngine


class TestGraphStorage(unittest.TestCase):
    """Tests for GraphStorage class."""

    def setUp(self):
        """Create a temporary database for testing."""
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".sqlite")
        self.temp_file.close()
        self.db_path = self.temp_file.name
        self.storage = GraphStorage(self.db_path)

    def tearDown(self):
        """Clean up temporary database."""
        self.storage.close()
        os.unlink(self.db_path)

    def test_add_and_get_node(self):
        """Test adding and retrieving a node."""
        node = Node(
            id="dbo.Users",
            type="table",
            data={"schema": "dbo", "name": "Users"}
        )
        self.storage.add_node(node)

        retrieved = self.storage.get_node("dbo.Users")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.id, "dbo.Users")
        self.assertEqual(retrieved.type, "table")
        self.assertEqual(retrieved.data["name"], "Users")

    def test_add_multiple_nodes(self):
        """Test adding multiple nodes at once."""
        nodes = [
            Node(id="dbo.Users", type="table", data={"name": "Users"}),
            Node(id="dbo.Orders", type="table", data={"name": "Orders"}),
        ]
        self.storage.add_nodes(nodes)

        tables = self.storage.get_nodes_by_type("table")
        self.assertEqual(len(tables), 2)

    def test_add_and_get_edge(self):
        """Test adding and retrieving an edge."""
        # Add nodes first
        self.storage.add_node(Node(id="dbo.Orders", type="table", data={}))
        self.storage.add_node(Node(id="dbo.Users", type="table", data={}))

        edge = Edge(
            id="fk:FK_Orders_Users",
            from_id="dbo.Orders",
            to_id="dbo.Users",
            type="fk",
            weight=1,
            data={"constraint_name": "FK_Orders_Users"}
        )
        self.storage.add_edge(edge)

        retrieved = self.storage.get_edge("fk:FK_Orders_Users")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.from_id, "dbo.Orders")
        self.assertEqual(retrieved.to_id, "dbo.Users")

    def test_get_edges_from(self):
        """Test getting edges originating from a node."""
        self.storage.add_node(Node(id="A", type="table", data={}))
        self.storage.add_node(Node(id="B", type="table", data={}))
        self.storage.add_node(Node(id="C", type="table", data={}))

        self.storage.add_edge(Edge(id="e1", from_id="A", to_id="B", type="fk", weight=1, data={}))
        self.storage.add_edge(Edge(id="e2", from_id="A", to_id="C", type="fk", weight=1, data={}))

        edges = self.storage.get_edges_from("A")
        self.assertEqual(len(edges), 2)

    def test_get_stats(self):
        """Test graph statistics."""
        self.storage.add_node(Node(id="t1", type="table", data={}))
        self.storage.add_node(Node(id="t2", type="table", data={}))
        self.storage.add_node(Node(id="c1", type="column", data={}))

        stats = self.storage.get_stats()
        self.assertEqual(stats["tables"], 2)
        self.assertEqual(stats["columns"], 1)

    def test_metadata(self):
        """Test metadata storage."""
        self.storage.set_metadata("database_name", "TestDb")
        self.storage.set_metadata("version", "1.0")

        self.assertEqual(self.storage.get_metadata("database_name"), "TestDb")
        self.assertEqual(self.storage.get_metadata("version"), "1.0")
        self.assertIsNone(self.storage.get_metadata("nonexistent"))


class TestGraphBuilder(unittest.TestCase):
    """Tests for GraphBuilder class."""

    def setUp(self):
        """Create temporary database and sample metadata."""
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".sqlite")
        self.temp_file.close()
        self.db_path = self.temp_file.name
        self.storage = GraphStorage(self.db_path)

        # Create sample metadata
        self.metadata = RawMetadata(
            tables=[
                TableInfo(schema="dbo", name="Users", row_count=100),
                TableInfo(schema="dbo", name="Orders", row_count=500),
                TableInfo(schema="dbo", name="Products", row_count=50),
                TableInfo(schema="dbo", name="OrderItems", row_count=1000),
            ],
            columns=[
                ColumnInfo(table_schema="dbo", table_name="Users", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="Users", name="Name", sql_type="nvarchar", is_nullable=False, ordinal_position=2),
                ColumnInfo(table_schema="dbo", table_name="Orders", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="Orders", name="UserId", sql_type="int", is_nullable=False, ordinal_position=2),
                ColumnInfo(table_schema="dbo", table_name="Products", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="Products", name="Name", sql_type="nvarchar", is_nullable=False, ordinal_position=2),
                ColumnInfo(table_schema="dbo", table_name="OrderItems", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="OrderItems", name="OrderId", sql_type="int", is_nullable=False, ordinal_position=2),
                ColumnInfo(table_schema="dbo", table_name="OrderItems", name="ProductId", sql_type="int", is_nullable=False, ordinal_position=3),
            ],
            primary_keys=[
                PrimaryKeyInfo(table_schema="dbo", table_name="Users", constraint_name="PK_Users", columns=["Id"]),
                PrimaryKeyInfo(table_schema="dbo", table_name="Orders", constraint_name="PK_Orders", columns=["Id"]),
                PrimaryKeyInfo(table_schema="dbo", table_name="Products", constraint_name="PK_Products", columns=["Id"]),
                PrimaryKeyInfo(table_schema="dbo", table_name="OrderItems", constraint_name="PK_OrderItems", columns=["Id"]),
            ],
            foreign_keys=[
                ForeignKeyInfo(
                    constraint_name="FK_Orders_Users",
                    from_schema="dbo", from_table="Orders", from_columns=["UserId"],
                    to_schema="dbo", to_table="Users", to_columns=["Id"]
                ),
                ForeignKeyInfo(
                    constraint_name="FK_OrderItems_Orders",
                    from_schema="dbo", from_table="OrderItems", from_columns=["OrderId"],
                    to_schema="dbo", to_table="Orders", to_columns=["Id"]
                ),
                ForeignKeyInfo(
                    constraint_name="FK_OrderItems_Products",
                    from_schema="dbo", from_table="OrderItems", from_columns=["ProductId"],
                    to_schema="dbo", to_table="Products", to_columns=["Id"]
                ),
            ],
            database_name="TestDb",
            server_name="localhost"
        )

    def tearDown(self):
        """Clean up temporary database."""
        self.storage.close()
        os.unlink(self.db_path)

    def test_build_graph(self):
        """Test building a graph from metadata."""
        builder = GraphBuilder(self.storage)
        stats = builder.build(self.metadata)

        self.assertEqual(stats["tables"], 4)
        self.assertEqual(stats["columns"], 9)
        self.assertEqual(stats["foreign_keys"], 3)

    def test_table_nodes_have_pk(self):
        """Test that table nodes have primary key info."""
        builder = GraphBuilder(self.storage)
        builder.build(self.metadata)

        users = self.storage.get_node("dbo.Users")
        self.assertIsNotNone(users)
        self.assertEqual(users.data["primary_key"], ["Id"])

    def test_column_nodes_have_pk_flag(self):
        """Test that column nodes have is_pk flag."""
        builder = GraphBuilder(self.storage)
        builder.build(self.metadata)

        user_id = self.storage.get_node("dbo.Users.Id")
        self.assertIsNotNone(user_id)
        self.assertTrue(user_id.data["is_pk"])

        user_name = self.storage.get_node("dbo.Users.Name")
        self.assertIsNotNone(user_name)
        self.assertFalse(user_name.data["is_pk"])


class TestQueryEngine(unittest.TestCase):
    """Tests for QueryEngine class."""

    def setUp(self):
        """Create temporary database and build graph."""
        self.temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=".sqlite")
        self.temp_file.close()
        self.db_path = self.temp_file.name
        self.storage = GraphStorage(self.db_path)

        # Create and build graph with sample metadata
        metadata = RawMetadata(
            tables=[
                TableInfo(schema="dbo", name="Users", row_count=100),
                TableInfo(schema="dbo", name="Orders", row_count=500),
                TableInfo(schema="dbo", name="Products", row_count=50),
                TableInfo(schema="dbo", name="OrderItems", row_count=1000),
            ],
            columns=[
                ColumnInfo(table_schema="dbo", table_name="Users", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="Orders", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="Orders", name="UserId", sql_type="int", is_nullable=False, ordinal_position=2),
                ColumnInfo(table_schema="dbo", table_name="Products", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="OrderItems", name="Id", sql_type="int", is_nullable=False, ordinal_position=1),
                ColumnInfo(table_schema="dbo", table_name="OrderItems", name="OrderId", sql_type="int", is_nullable=False, ordinal_position=2),
                ColumnInfo(table_schema="dbo", table_name="OrderItems", name="ProductId", sql_type="int", is_nullable=False, ordinal_position=3),
            ],
            primary_keys=[
                PrimaryKeyInfo(table_schema="dbo", table_name="Users", constraint_name="PK_Users", columns=["Id"]),
                PrimaryKeyInfo(table_schema="dbo", table_name="Orders", constraint_name="PK_Orders", columns=["Id"]),
                PrimaryKeyInfo(table_schema="dbo", table_name="Products", constraint_name="PK_Products", columns=["Id"]),
                PrimaryKeyInfo(table_schema="dbo", table_name="OrderItems", constraint_name="PK_OrderItems", columns=["Id"]),
            ],
            foreign_keys=[
                ForeignKeyInfo(
                    constraint_name="FK_Orders_Users",
                    from_schema="dbo", from_table="Orders", from_columns=["UserId"],
                    to_schema="dbo", to_table="Users", to_columns=["Id"]
                ),
                ForeignKeyInfo(
                    constraint_name="FK_OrderItems_Orders",
                    from_schema="dbo", from_table="OrderItems", from_columns=["OrderId"],
                    to_schema="dbo", to_table="Orders", to_columns=["Id"]
                ),
                ForeignKeyInfo(
                    constraint_name="FK_OrderItems_Products",
                    from_schema="dbo", from_table="OrderItems", from_columns=["ProductId"],
                    to_schema="dbo", to_table="Products", to_columns=["Id"]
                ),
            ],
            database_name="TestDb",
            server_name="localhost"
        )

        builder = GraphBuilder(self.storage)
        builder.build(metadata)

        self.engine = QueryEngine(self.storage)

    def tearDown(self):
        """Clean up temporary database."""
        self.storage.close()
        os.unlink(self.db_path)

    def test_find_direct_path(self):
        """Test finding a direct path between two tables."""
        result = self.engine.find_path("dbo.Orders", "dbo.Users")

        self.assertTrue(result.found)
        self.assertEqual(len(result.path), 2)
        self.assertEqual(result.path[0], "dbo.Orders")
        self.assertEqual(result.path[1], "dbo.Users")

    def test_find_indirect_path(self):
        """Test finding an indirect path through multiple tables."""
        # Users -> Orders -> OrderItems -> Products
        result = self.engine.find_path("dbo.Users", "dbo.Products")

        self.assertTrue(result.found)
        # Path should go through Orders and OrderItems
        self.assertIn("dbo.Orders", result.path)
        self.assertIn("dbo.OrderItems", result.path)

    def test_path_not_found(self):
        """Test when no path exists."""
        # Add an isolated table
        self.storage.add_node(Node(id="dbo.Isolated", type="table", data={"schema": "dbo", "name": "Isolated"}))
        self.engine.refresh()

        result = self.engine.find_path("dbo.Users", "dbo.Isolated")
        self.assertFalse(result.found)

    def test_same_table_path(self):
        """Test path from table to itself."""
        result = self.engine.find_path("dbo.Users", "dbo.Users")

        self.assertTrue(result.found)
        self.assertEqual(len(result.path), 1)

    def test_generate_join(self):
        """Test generating a JOIN query."""
        result = self.engine.generate_join(["dbo.Users", "dbo.Orders"])

        self.assertTrue(result.success)
        self.assertIn("SELECT", result.sql)
        self.assertIn("FROM dbo.Users", result.sql)
        self.assertIn("JOIN dbo.Orders", result.sql)
        self.assertIn("ON", result.sql)

    def test_generate_multi_join(self):
        """Test generating a multi-table JOIN."""
        result = self.engine.generate_join(["dbo.Users", "dbo.Orders", "dbo.OrderItems"])

        self.assertTrue(result.success)
        # Should have two JOINs
        self.assertEqual(result.sql.count("JOIN"), 2)

    def test_explain_table(self):
        """Test explaining a table."""
        explanation = self.engine.explain_table("Users")

        self.assertIsNotNone(explanation)
        self.assertEqual(explanation.table_name, "dbo.Users")
        self.assertEqual(explanation.name, "Users")
        self.assertEqual(explanation.primary_key, ["Id"])

    def test_explain_table_not_found(self):
        """Test explaining a non-existent table."""
        explanation = self.engine.explain_table("NonExistent")
        self.assertIsNone(explanation)

    def test_list_tables(self):
        """Test listing all tables."""
        tables = self.engine.list_tables()

        self.assertEqual(len(tables), 4)
        names = [t["name"] for t in tables]
        self.assertIn("dbo.Users", names)
        self.assertIn("dbo.Orders", names)

    def test_list_relationships(self):
        """Test listing all relationships."""
        rels = self.engine.list_relationships()

        self.assertEqual(len(rels), 3)
        from_tables = [r["from_table"] for r in rels]
        self.assertIn("dbo.Orders", from_tables)
        self.assertIn("dbo.OrderItems", from_tables)

    def test_resolve_short_name(self):
        """Test resolving short table names."""
        # Should find "Users" -> "dbo.Users"
        resolved = self.engine._resolve_table_name("Users")
        self.assertEqual(resolved, "dbo.Users")

        # Full name should work too
        resolved = self.engine._resolve_table_name("dbo.Users")
        self.assertEqual(resolved, "dbo.Users")

    def test_generate_aliases(self):
        """Test alias generation."""
        aliases = self.engine._generate_aliases(["dbo.Users", "dbo.Orders", "dbo.OrderItems"])

        self.assertEqual(aliases["dbo.Users"], "u")
        self.assertEqual(aliases["dbo.Orders"], "o")
        # OrderItems should get "or" since "o" is taken
        self.assertIn(aliases["dbo.OrderItems"], ["or", "oi"])


if __name__ == "__main__":
    unittest.main()
