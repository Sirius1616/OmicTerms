"""Story 21 — adapter interface and internal representation mappings.

``adapters.base`` defines the extension point; ``omics`` is the first
implementation (behaviour-preserving wrapper of the omics sniffers).
Extensions register through :func:`register_adapter` without touching core
services: the extraction dispatcher looks adapters up here only.
"""

from app.integration.adapters.base import (
    Adapter,
    FeatureAbundanceRow,
    IdentifierNamespace,
    IntervalRecord,
    MappedDataset,
    VariantRecord,
    detect_namespace,
)
from app.integration.adapters.omics import OMICS_ADAPTER

_registry: dict[str, Adapter] = {
    OMICS_ADAPTER.describe(): OMICS_ADAPTER,
}


def register_adapter(adapter: Adapter) -> None:
    """Register an adapter implementation (test/extension point, not core)."""
    _registry[adapter.describe()] = adapter


def get_adapter(mapping_id: str) -> Adapter | None:
    return _registry.get(mapping_id)


def known_adapters() -> list[str]:
    return sorted(_registry)


__all__ = [
    "OMICS_ADAPTER",
    "Adapter",
    "FeatureAbundanceRow",
    "IdentifierNamespace",
    "IntervalRecord",
    "MappedDataset",
    "VariantRecord",
    "detect_namespace",
    "get_adapter",
    "known_adapters",
    "register_adapter",
]
