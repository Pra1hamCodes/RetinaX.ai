import logging
import shutil
import uuid
from pathlib import Path
from typing import BinaryIO

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".tif", ".tiff"}
MAX_BYTES = 10 * 1024 * 1024  # 10 MB


class StorageError(Exception):
    pass


def _ensure_dirs() -> None:
    settings.upload_dir.mkdir(parents=True, exist_ok=True)
    settings.heatmap_dir.mkdir(parents=True, exist_ok=True)


def save_upload(filename: str, fileobj: BinaryIO) -> Path:
    """Persist an uploaded fundus image; return its on-disk path."""
    _ensure_dirs()

    suffix = Path(filename).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        raise StorageError(f"Unsupported file type: {suffix or '(none)'}")

    # Validate size by streaming to a temp file
    target = settings.upload_dir / f"{uuid.uuid4().hex}{suffix}"
    bytes_written = 0
    with target.open("wb") as out:
        while chunk := fileobj.read(64 * 1024):
            bytes_written += len(chunk)
            if bytes_written > MAX_BYTES:
                out.close()
                target.unlink(missing_ok=True)
                raise StorageError("File exceeds 10 MB limit")
            out.write(chunk)

    if bytes_written == 0:
        target.unlink(missing_ok=True)
        raise StorageError("Empty file")

    logger.info("Saved upload %s (%d bytes)", target.name, bytes_written)
    return target


def public_url_for(path: Path) -> str:
    """Translate an on-disk path under storage_local_dir into a public URL."""
    try:
        rel = path.resolve().relative_to(settings.storage_local_dir.resolve())
    except ValueError as exc:
        raise StorageError("Path is outside storage root") from exc
    return f"{settings.storage_public_base_url.rstrip('/')}/{rel.as_posix()}"


def delete_file(path: Path) -> None:
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Failed to delete %s", path, exc_info=True)
