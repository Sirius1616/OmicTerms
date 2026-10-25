from __future__ import annotations

import logging
from pathlib import Path

from app.core.config import settings
from app.validation.base import ValidationContext

logger = logging.getLogger(__name__)

# backend/ - the same base the upload route uses to store files.
APP_ROOT = Path(__file__).resolve().parents[2]


def resolve_upload_path(file_url: str | None) -> Path | None:
    """Resolve a stored upload reference to a readable path on disk.

    Documents store the public URL of the upload (``{API_V1_STR}/{UPLOAD_DIR}/{file_id}``)
    while the bytes live under the configured upload directory. Absolute paths are
    also accepted so validated files can be checked outside the upload pipeline.
    """
    if not file_url:
        return None

    candidate = Path(file_url)
    if candidate.is_absolute() and candidate.is_file():
        return candidate

    file_id = candidate.name
    if not file_id:
        return None

    roots = (
        APP_ROOT / settings.UPLOAD_DIR,
        Path(settings.UPLOAD_DIR),
        Path.cwd() / settings.UPLOAD_DIR,
    )
    for root in roots:
        resolved = root / file_id
        if resolved.is_file():
            return resolved
    return None


def read_document_bytes(ctx: ValidationContext) -> bytes | None:
    """Read the uploaded bytes for the validated document, if it is still on disk."""
    document = ctx.document
    if document is None:
        return None
    file_url = getattr(document, "file_url", None)
    path = resolve_upload_path(file_url)
    if path is None or not path.is_file():
        logger.info("No readable file on disk for upload reference %s", file_url)
        return None
    try:
        return path.read_bytes()
    except OSError:
        logger.warning("Unable to read uploaded file %s", file_url)
        return None


def decode_text(content: bytes) -> str:
    return content.decode("utf-8", errors="replace")
