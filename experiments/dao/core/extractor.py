"""
DAO Extractor - SQL Server metadata extraction.

Extracts schema metadata from SQL Server databases using INFORMATION_SCHEMA
and sys.* system tables.
"""

from dataclasses import dataclass, field
from typing import Optional

# Try to import pyodbc, but allow graceful fallback
try:
    import pyodbc
    PYODBC_AVAILABLE = True
except ImportError:
    PYODBC_AVAILABLE = False


@dataclass
class TableInfo:
    """Information about a database table."""
    schema: str
    name: str
    row_count: Optional[int] = None
    size_mb: Optional[float] = None

    @property
    def full_name(self) -> str:
        return f"{self.schema}.{self.name}"


@dataclass
class ColumnInfo:
    """Information about a table column."""
    table_schema: str
    table_name: str
    name: str
    sql_type: str
    is_nullable: bool
    ordinal_position: int
    max_length: Optional[int] = None
    precision: Optional[int] = None
    scale: Optional[int] = None

    @property
    def full_table_name(self) -> str:
        return f"{self.table_schema}.{self.table_name}"

    @property
    def full_name(self) -> str:
        return f"{self.table_schema}.{self.table_name}.{self.name}"


@dataclass
class PrimaryKeyInfo:
    """Information about a primary key."""
    table_schema: str
    table_name: str
    constraint_name: str
    columns: list[str] = field(default_factory=list)

    @property
    def full_table_name(self) -> str:
        return f"{self.table_schema}.{self.table_name}"


@dataclass
class ForeignKeyInfo:
    """Information about a foreign key relationship."""
    constraint_name: str
    from_schema: str
    from_table: str
    from_columns: list[str]
    to_schema: str
    to_table: str
    to_columns: list[str]

    @property
    def from_full_name(self) -> str:
        return f"{self.from_schema}.{self.from_table}"

    @property
    def to_full_name(self) -> str:
        return f"{self.to_schema}.{self.to_table}"


@dataclass
class RawMetadata:
    """Raw metadata extracted from SQL Server."""
    tables: list[TableInfo]
    columns: list[ColumnInfo]
    primary_keys: list[PrimaryKeyInfo]
    foreign_keys: list[ForeignKeyInfo]
    database_name: str = ""
    server_name: str = ""

    def to_dict(self) -> dict:
        return {
            "database_name": self.database_name,
            "server_name": self.server_name,
            "tables": [
                {
                    "schema": t.schema,
                    "name": t.name,
                    "full_name": t.full_name,
                    "row_count": t.row_count,
                    "size_mb": t.size_mb
                }
                for t in self.tables
            ],
            "columns": [
                {
                    "table_schema": c.table_schema,
                    "table_name": c.table_name,
                    "name": c.name,
                    "full_name": c.full_name,
                    "sql_type": c.sql_type,
                    "is_nullable": c.is_nullable,
                    "ordinal_position": c.ordinal_position,
                    "max_length": c.max_length,
                    "precision": c.precision,
                    "scale": c.scale
                }
                for c in self.columns
            ],
            "primary_keys": [
                {
                    "table_schema": pk.table_schema,
                    "table_name": pk.table_name,
                    "full_table_name": pk.full_table_name,
                    "constraint_name": pk.constraint_name,
                    "columns": pk.columns
                }
                for pk in self.primary_keys
            ],
            "foreign_keys": [
                {
                    "constraint_name": fk.constraint_name,
                    "from_schema": fk.from_schema,
                    "from_table": fk.from_table,
                    "from_full_name": fk.from_full_name,
                    "from_columns": fk.from_columns,
                    "to_schema": fk.to_schema,
                    "to_table": fk.to_table,
                    "to_full_name": fk.to_full_name,
                    "to_columns": fk.to_columns
                }
                for fk in self.foreign_keys
            ]
        }


class SQLServerExtractor:
    """Extracts metadata from SQL Server databases."""

    # SQL queries for metadata extraction
    TABLES_QUERY = """
        SELECT
            t.TABLE_SCHEMA,
            t.TABLE_NAME,
            p.rows as ROW_COUNT,
            CAST(ROUND(((SUM(a.total_pages) * 8) / 1024.00), 2) AS DECIMAL(18,2)) AS SIZE_MB
        FROM INFORMATION_SCHEMA.TABLES t
        LEFT JOIN sys.tables st ON st.name = t.TABLE_NAME
        LEFT JOIN sys.indexes i ON st.object_id = i.object_id AND i.index_id <= 1
        LEFT JOIN sys.partitions p ON i.object_id = p.object_id AND i.index_id = p.index_id
        LEFT JOIN sys.allocation_units a ON p.partition_id = a.container_id
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        GROUP BY t.TABLE_SCHEMA, t.TABLE_NAME, p.rows
        ORDER BY t.TABLE_SCHEMA, t.TABLE_NAME
    """

    COLUMNS_QUERY = """
        SELECT
            c.TABLE_SCHEMA,
            c.TABLE_NAME,
            c.COLUMN_NAME,
            c.DATA_TYPE,
            c.IS_NULLABLE,
            c.ORDINAL_POSITION,
            c.CHARACTER_MAXIMUM_LENGTH,
            c.NUMERIC_PRECISION,
            c.NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS c
        INNER JOIN INFORMATION_SCHEMA.TABLES t
            ON c.TABLE_SCHEMA = t.TABLE_SCHEMA
            AND c.TABLE_NAME = t.TABLE_NAME
        WHERE t.TABLE_TYPE = 'BASE TABLE'
        ORDER BY c.TABLE_SCHEMA, c.TABLE_NAME, c.ORDINAL_POSITION
    """

    PRIMARY_KEYS_QUERY = """
        SELECT
            tc.TABLE_SCHEMA,
            tc.TABLE_NAME,
            tc.CONSTRAINT_NAME,
            kcu.COLUMN_NAME,
            kcu.ORDINAL_POSITION
        FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
        INNER JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
            AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
            AND tc.TABLE_NAME = kcu.TABLE_NAME
        WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
        ORDER BY tc.TABLE_SCHEMA, tc.TABLE_NAME, kcu.ORDINAL_POSITION
    """

    FOREIGN_KEYS_QUERY = """
        SELECT
            fk.name AS CONSTRAINT_NAME,
            SCHEMA_NAME(t1.schema_id) AS FROM_SCHEMA,
            t1.name AS FROM_TABLE,
            c1.name AS FROM_COLUMN,
            SCHEMA_NAME(t2.schema_id) AS TO_SCHEMA,
            t2.name AS TO_TABLE,
            c2.name AS TO_COLUMN,
            fkc.constraint_column_id AS ORDINAL_POSITION
        FROM sys.foreign_keys fk
        INNER JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id
        INNER JOIN sys.tables t1 ON fkc.parent_object_id = t1.object_id
        INNER JOIN sys.columns c1 ON fkc.parent_object_id = c1.object_id AND fkc.parent_column_id = c1.column_id
        INNER JOIN sys.tables t2 ON fkc.referenced_object_id = t2.object_id
        INNER JOIN sys.columns c2 ON fkc.referenced_object_id = c2.object_id AND fkc.referenced_column_id = c2.column_id
        ORDER BY fk.name, fkc.constraint_column_id
    """

    DATABASE_INFO_QUERY = """
        SELECT DB_NAME() AS DATABASE_NAME, @@SERVERNAME AS SERVER_NAME
    """

    def __init__(self, connection_string: str):
        """
        Initialize the extractor.

        Args:
            connection_string: ODBC connection string for SQL Server.
                Example: "Driver={ODBC Driver 17 for SQL Server};Server=.;Database=MyDb;Trusted_Connection=yes;"
        """
        if not PYODBC_AVAILABLE:
            raise ImportError(
                "pyodbc is required for SQL Server extraction. "
                "Install it with: pip install pyodbc"
            )
        self.connection_string = connection_string
        self._connection = None

    def _get_connection(self):
        """Get or create a database connection."""
        if self._connection is None:
            self._connection = pyodbc.connect(self.connection_string)
        return self._connection

    def _execute_query(self, query: str) -> list[dict]:
        """Execute a query and return results as list of dicts."""
        conn = self._get_connection()
        cursor = conn.cursor()
        cursor.execute(query)

        columns = [column[0] for column in cursor.description]
        results = []
        for row in cursor.fetchall():
            results.append(dict(zip(columns, row)))
        return results

    def extract_tables(self) -> list[TableInfo]:
        """Extract table metadata."""
        rows = self._execute_query(self.TABLES_QUERY)
        return [
            TableInfo(
                schema=row["TABLE_SCHEMA"],
                name=row["TABLE_NAME"],
                row_count=row.get("ROW_COUNT"),
                size_mb=float(row["SIZE_MB"]) if row.get("SIZE_MB") else None
            )
            for row in rows
        ]

    def extract_columns(self) -> list[ColumnInfo]:
        """Extract column metadata."""
        rows = self._execute_query(self.COLUMNS_QUERY)
        return [
            ColumnInfo(
                table_schema=row["TABLE_SCHEMA"],
                table_name=row["TABLE_NAME"],
                name=row["COLUMN_NAME"],
                sql_type=row["DATA_TYPE"],
                is_nullable=row["IS_NULLABLE"] == "YES",
                ordinal_position=row["ORDINAL_POSITION"],
                max_length=row.get("CHARACTER_MAXIMUM_LENGTH"),
                precision=row.get("NUMERIC_PRECISION"),
                scale=row.get("NUMERIC_SCALE")
            )
            for row in rows
        ]

    def extract_primary_keys(self) -> list[PrimaryKeyInfo]:
        """Extract primary key metadata."""
        rows = self._execute_query(self.PRIMARY_KEYS_QUERY)

        # Group by constraint
        pk_map: dict[str, PrimaryKeyInfo] = {}
        for row in rows:
            key = f"{row['TABLE_SCHEMA']}.{row['TABLE_NAME']}.{row['CONSTRAINT_NAME']}"
            if key not in pk_map:
                pk_map[key] = PrimaryKeyInfo(
                    table_schema=row["TABLE_SCHEMA"],
                    table_name=row["TABLE_NAME"],
                    constraint_name=row["CONSTRAINT_NAME"],
                    columns=[]
                )
            pk_map[key].columns.append(row["COLUMN_NAME"])

        return list(pk_map.values())

    def extract_foreign_keys(self) -> list[ForeignKeyInfo]:
        """Extract foreign key metadata."""
        rows = self._execute_query(self.FOREIGN_KEYS_QUERY)

        # Group by constraint
        fk_map: dict[str, ForeignKeyInfo] = {}
        for row in rows:
            constraint_name = row["CONSTRAINT_NAME"]
            if constraint_name not in fk_map:
                fk_map[constraint_name] = ForeignKeyInfo(
                    constraint_name=constraint_name,
                    from_schema=row["FROM_SCHEMA"],
                    from_table=row["FROM_TABLE"],
                    from_columns=[],
                    to_schema=row["TO_SCHEMA"],
                    to_table=row["TO_TABLE"],
                    to_columns=[]
                )
            fk_map[constraint_name].from_columns.append(row["FROM_COLUMN"])
            fk_map[constraint_name].to_columns.append(row["TO_COLUMN"])

        return list(fk_map.values())

    def extract_database_info(self) -> tuple[str, str]:
        """Extract database and server name."""
        rows = self._execute_query(self.DATABASE_INFO_QUERY)
        if rows:
            return rows[0]["DATABASE_NAME"], rows[0]["SERVER_NAME"]
        return "", ""

    def extract_all(self) -> RawMetadata:
        """Extract all metadata from the database."""
        database_name, server_name = self.extract_database_info()

        return RawMetadata(
            tables=self.extract_tables(),
            columns=self.extract_columns(),
            primary_keys=self.extract_primary_keys(),
            foreign_keys=self.extract_foreign_keys(),
            database_name=database_name,
            server_name=server_name
        )

    def close(self) -> None:
        """Close the database connection."""
        if self._connection:
            self._connection.close()
            self._connection = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.close()


def parse_connection_string(connection_string: str) -> dict:
    """
    Parse a connection string into components.

    Supports formats:
    - ODBC style: "Driver={...};Server=...;Database=...;"
    - Simple style: "Server=...;Database=..."
    """
    parts = {}
    for part in connection_string.split(";"):
        part = part.strip()
        if "=" in part:
            key, value = part.split("=", 1)
            parts[key.strip().lower()] = value.strip()
    return parts


def build_connection_string(
    server: str,
    database: str,
    driver: str = "ODBC Driver 17 for SQL Server",
    trusted_connection: bool = True,
    username: Optional[str] = None,
    password: Optional[str] = None
) -> str:
    """
    Build an ODBC connection string.

    Args:
        server: SQL Server hostname or instance (e.g., ".", "localhost", "server\\instance")
        database: Database name
        driver: ODBC driver name
        trusted_connection: Use Windows authentication
        username: SQL Server username (if not using trusted connection)
        password: SQL Server password (if not using trusted connection)
    """
    parts = [
        f"Driver={{{driver}}}",
        f"Server={server}",
        f"Database={database}"
    ]

    if trusted_connection:
        parts.append("Trusted_Connection=yes")
    else:
        if username:
            parts.append(f"UID={username}")
        if password:
            parts.append(f"PWD={password}")

    return ";".join(parts) + ";"
