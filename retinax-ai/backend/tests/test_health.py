"""Smoke test for the FastAPI health endpoint.

Runs without a database: the route doesn't touch one. We patch out the
ML-heavy modules so importing `app.main` doesn't load TensorFlow.
"""

from __future__ import annotations

import os
import sys
import types

import pytest

# Stub out heavy modules before app.main is imported by TestClient.
for name in ("tensorflow", "tensorflow.keras", "tensorflow.keras.models"):
    sys.modules.setdefault(name, types.ModuleType(name))

os.environ.setdefault("DATABASE_URL", "postgresql+psycopg2://x:x@localhost/x")
os.environ.setdefault("JWT_SECRET_KEY", "test-secret-not-for-production")

fastapi = pytest.importorskip("fastapi")  # noqa: F841
TestClient = pytest.importorskip("fastapi.testclient").TestClient

from app.main import app                                                    # noqa: E402


def test_health_endpoint() -> None:
    with TestClient(app) as client:
        resp = client.get("/api/v1/health")
        assert resp.status_code == 200
        body = resp.json()
        assert body["status"] == "ok"
        assert "version" in body
