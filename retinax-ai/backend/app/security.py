from datetime import datetime, timedelta, timezone
from typing import Any

import jwt
from passlib.hash import bcrypt as bcrypt_hash
from passlib.hash import pbkdf2_sha256

from app.config import get_settings

settings = get_settings()


def hash_password(plain: str) -> str:
    return pbkdf2_sha256.hash(plain)


def verify_password(plain: str, hashed: str) -> bool:
    if hashed.startswith("$2"):
        try:
            return bcrypt_hash.verify(plain, hashed)
        except Exception:
            return False
    return pbkdf2_sha256.verify(plain, hashed)


def create_access_token(subject: str, extra: dict[str, Any] | None = None) -> str:
    now = datetime.now(timezone.utc)
    payload: dict[str, Any] = {
        "sub": subject,
        "iat": int(now.timestamp()),
        "exp": int((now + timedelta(minutes=settings.jwt_access_token_expire_minutes)).timestamp()),
    }
    if extra:
        payload.update(extra)
    return jwt.encode(payload, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str) -> dict[str, Any]:
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
