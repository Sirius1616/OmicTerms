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
