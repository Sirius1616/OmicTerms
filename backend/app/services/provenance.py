"""Provenance / audit stub.

Story 32 will replace this no-op with durable audit records. Metadata writes call
it now so the integration point exists without inventing persistence early.
"""

from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger(__name__)


def record(**event: Any) -> None:
    """Record a provenance event (currently a no-op)."""
    logger.debug("provenance.record %s", event)


def record_import_origin(
    *,
    repo: str,
    accession: str,
    source_urls: list[str] | None = None,
    import_id: str | None = None,
    job_id: str | None = None,
    fetched_at: str | None = None,
    **extra: Any,
) -> None:
    record(
        type="import.origin",
        repo=repo,
        accession=accession,
        source_urls=source_urls or [],
        import_id=import_id,
        job_id=job_id,
        fetched_at=fetched_at,
        **extra,
    )
