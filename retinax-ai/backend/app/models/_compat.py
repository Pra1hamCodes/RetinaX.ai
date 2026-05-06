"""Cross-dialect column types so the ORM works on both SQLite and Postgres.

- UUID  : stored as native Postgres UUID, or as TEXT (`str(uuid)`) on SQLite.
- JSONB : stored as native Postgres JSONB, or as JSON (TEXT) on SQLite.
"""

from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import CHAR, JSON
from sqlalchemy.dialects.postgresql import JSONB as PG_JSONB
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator


class GUID(TypeDecorator):
    """Platform-independent UUID type."""

    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_UUID(as_uuid=True))
        return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return None
        if dialect.name == "postgresql":
            return value if isinstance(value, uuid.UUID) else uuid.UUID(str(value))
        return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return None
        if isinstance(value, uuid.UUID):
            return value
        return uuid.UUID(str(value))


class JSONColumn(TypeDecorator):
    """JSONB on Postgres, JSON (TEXT-encoded) on SQLite."""

    impl = JSON
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == "postgresql":
            return dialect.type_descriptor(PG_JSONB())
        return dialect.type_descriptor(JSON())

    def process_bind_param(self, value: Any, dialect):
        return value

    def process_result_value(self, value: Any, dialect):
        return value
