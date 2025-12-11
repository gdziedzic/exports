"""
DAO Core - Database Analysis & Ontology core modules.

Provides functionality for extracting SQL Server metadata, building
a knowledge graph, and querying relationships.
"""

from .storage import GraphStorage, Node, Edge
from .extractor import (
    SQLServerExtractor,
    RawMetadata,
    TableInfo,
    ColumnInfo,
    PrimaryKeyInfo,
    ForeignKeyInfo,
    build_connection_string,
    parse_connection_string,
    PYODBC_AVAILABLE
)
from .graph_builder import GraphBuilder, build_graph_from_metadata
from .query_engine import (
    QueryEngine,
    PathResult,
    TableExplanation,
    JoinResult,
    create_engine
)

__all__ = [
    # Storage
    "GraphStorage",
    "Node",
    "Edge",
    # Extractor
    "SQLServerExtractor",
    "RawMetadata",
    "TableInfo",
    "ColumnInfo",
    "PrimaryKeyInfo",
    "ForeignKeyInfo",
    "build_connection_string",
    "parse_connection_string",
    "PYODBC_AVAILABLE",
    # Graph Builder
    "GraphBuilder",
    "build_graph_from_metadata",
    # Query Engine
    "QueryEngine",
    "PathResult",
    "TableExplanation",
    "JoinResult",
    "create_engine",
]
