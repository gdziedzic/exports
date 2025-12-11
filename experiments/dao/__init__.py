"""
DAO - Database Analysis & Ontology

A tool for extracting SQL Server schema and building a navigable
knowledge graph for joins, relationships, and semantic structure.
"""

__version__ = "1.0.0"
__author__ = "DAO Team"

from .core import (
    GraphStorage,
    Node,
    Edge,
    SQLServerExtractor,
    RawMetadata,
    GraphBuilder,
    QueryEngine,
    create_engine,
    build_connection_string,
    PYODBC_AVAILABLE,
)

__all__ = [
    "__version__",
    "GraphStorage",
    "Node",
    "Edge",
    "SQLServerExtractor",
    "RawMetadata",
    "GraphBuilder",
    "QueryEngine",
    "create_engine",
    "build_connection_string",
    "PYODBC_AVAILABLE",
]
