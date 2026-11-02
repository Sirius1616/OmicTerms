"""Adapter protocol + internal primitive types (Story 21).

Nothing here is validated into existence: every field is either measured or
explicitly ``unknown``. All original file fields ride along under ``raw``
keys so nothing is silently dropped by a mapping.

Identifier rules (checked in order):

1. ``rs`` + digits → ``rsid`` (dbSNP variant ids)
2. ``ENS`` + digits → ``ensembl`` (Ensembl family prefixes)
3. ``cg`` + ≥6 digits → ``cpg_probe`` (Illumina methylation probes)
4. 2-15 character uppercase alphanumeric token → ``symbol``
5. anything else → ``unknown`` (allowed by design)
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any, Literal, Protocol, runtime_checkable


@dataclass(frozen=True)
class IdentifierNamespace:
    """Which identifier space the first column uses, plus the rule that hit."""

    namespace: Literal["ensembl", "rsid", "cpg_probe", "symbol", "unknown"]
    evidence: str


def detect_namespace(value: str) -> IdentifierNamespace:
    token = value.strip()
    if not token:
        return IdentifierNamespace("unknown", "empty token")
    lowered = token.lower()
    if lowered.startswith("rs") and lowered[2:].isdigit():
        return IdentifierNamespace("rsid", f"rs-prefixed token {token}")
    if (
        lowered[:4] in ("ensg", "ense", "enst")
        and lowered[4:].isdigit()
    ):
        return IdentifierNamespace("ensembl", f"Ensembl token {token}")
    if (
        lowered.startswith("cg")
        and len(lowered) >= 8
        and lowered[2:].isdigit()
    ):
        return IdentifierNamespace("cpg_probe", f"illumina cpg probe {token}")
    if (
        2 <= len(token) <= 15
        and token.replace("-", "").replace("_", "").isalnum()
        and token.upper() == token
    ):
        return IdentifierNamespace("symbol", f"uppercase symbol token {token}")
    return IdentifierNamespace("unknown", f"unmatched token {token}")


@dataclass(frozen=True)
class VariantRecord:
    """One VCF variant row; ``raw`` keys every header field after parsing."""

    chrom: str
    pos: int | None
    ref: str
    alt: str
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class IntervalRecord:
    """One BED interval row: 0-based start, exclusive end per the BED spec."""

    chrom: str
    start: int
    end: int
    raw: dict[str, Any] = field(default_factory=dict)


@dataclass(frozen=True)
class FeatureAbundanceRow:
    """One matrix row: identifier plus per-sample values (string verbatim)."""

    identifier: str
    values: dict[str, str]
    raw: list[str] = field(default_factory=list)


DatasetKind = Literal["variants", "peaks", "expression", "methylation", "other"]


@dataclass(frozen=True)
class MappedDataset:
    """The typed view of one dataset. ``source`` keeps the parser's own
    JSON-serializable dict verbatim — added structure (like ``__meta``) is
    optional behaviour on top, never destructive."""

    kind: DatasetKind
    records: Sequence[VariantRecord | IntervalRecord | FeatureAbundanceRow]
    identifiers: IdentifierNamespace
    coordinate_meta: dict[str, Any] = field(default_factory=dict)
    sample_ids: list[str] = field(default_factory=list)
    columns: list[str] = field(default_factory=list)
    source: dict[str, Any] = field(default_factory=dict)
    provenance: dict[str, Any] = field(default_factory=dict)


@runtime_checkable
class Adapter(Protocol):
    """The Story 21 extension point: ``sniff`` → confidence, ``parse`` →
    mapped dataset, ``describe`` → registry mapping id."""

    def sniff(self, sample_bytes: bytes, filename: str) -> float:
        """Confidence in [0, 1] that this adapter can fully parse the file."""
        ...

    def parse(self, full_text: str) -> MappedDataset:
        ...

    def describe(self) -> str:
        """The registry ``internal_representation_mapping_id`` implemented."""
        ...
