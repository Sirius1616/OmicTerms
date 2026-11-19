from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class Issue:
    code: str
    severity: str
    message: str
    detail: str | None = None
    field: str | None = None
    path: str | None = None
    suggestion: str | None = None
    dedup_key: str | None = None


@dataclass(slots=True)
class ValidationContext:
    document_id: str
    document: object | None = None
    session: object | None = None
    trigger: str = "manual"
    assembly_declared: bool = False
    assembly: str | None = None


class Validator(Protocol):
    name: str

    def applies_to(self, ctx: ValidationContext) -> bool: ...

    def run(self, ctx: ValidationContext) -> list[Issue]: ...


def data_type_of(ctx: ValidationContext) -> str | None:
    """The document's classified omics type, as a plain string."""
    document = ctx.document
    if document is None:
        return None
    data_type = getattr(document, "data_type", None)
    value = getattr(data_type, "value", data_type)
    return value if isinstance(value, str) else None


def format_scope_applies(
    ctx: ValidationContext,
    *,
    data_types: frozenset[str],
    extensions: tuple[str, ...],
    content_sniff: Callable[[], bool],
) -> bool:
    """Scoping rule for one format validator (Story 16 + real-data fix).

    A validator claims a document when the document's classified
    ``data_type`` or its extension belongs to the format — whichever is
    known first. Content-shape sniffing (``content_sniff``) is only used
    when the record is effectively untyped (no classified data_type AND a
    generic/unknown extension), so real files with a known type never trip
    another format's heuristics (a VCF row also has >=3 tab columns; a BED
    also contains tabs).
    """
    document = ctx.document
    if document is None:
        return False
    data_type = data_type_of(ctx)
    if data_type is not None:
        return data_type in data_types
    filename = (getattr(document, "filename", "") or "").lower()
    if any(filename.endswith(ext) for ext in extensions):
        return True
    if any(
        filename.endswith(other)
        for other in OTHER_FORMAT_EXTENSIONS
        if other not in extensions
    ):
        return False
    return content_sniff()


OTHER_FORMAT_EXTENSIONS = (
    ".vcf",
    ".vcf.gz",
    ".bed",
    ".tsv",
    ".csv",
    ".txt",
    ".matrix",
    ".pdf",
    ".docx",
    ".doc",
    ".eml",
    ".png",
    ".jpg",
    ".jpeg",
    ".zip",
)
