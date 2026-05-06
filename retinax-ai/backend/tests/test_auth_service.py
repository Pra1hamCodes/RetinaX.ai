from __future__ import annotations

import os
import sys
import types

import pytest

for name in ("tensorflow", "tensorflow.keras", "tensorflow.keras.models"):
    sys.modules.setdefault(name, types.ModuleType(name))

os.environ.setdefault("DATABASE_URL", "sqlite:///./storage/test-auth-service.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production")

fastapi = pytest.importorskip("fastapi")  # noqa: F841

from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app.database import Base  # noqa: E402
from app.models import User  # noqa: E402,F401
from app.schemas.auth import SignupRequest  # noqa: E402
from app.services.auth_service import signup  # noqa: E402


def test_signup_rejects_duplicate_email() -> None:
    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    Base.metadata.create_all(bind=engine)

    db = TestingSessionLocal()
    try:
        first = signup(
            db,
            SignupRequest(email="alice@example.com", password="password123", display_name="Alice"),
        )
        assert first.email == "alice@example.com"

        with pytest.raises(fastapi.HTTPException) as exc_info:
            signup(
                db,
                SignupRequest(email="alice@example.com", password="password123", display_name="Alice 2"),
            )

        assert exc_info.value.status_code == 409
        assert exc_info.value.detail == "Email already registered"
    finally:
        db.close()