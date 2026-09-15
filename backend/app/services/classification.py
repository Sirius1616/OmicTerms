"""Heuristic classification of the omics data type of an uploaded document.

Runs after extraction: the structured parse (kind + structure) is the strongest
signal, disambiguated by the matrix header (gene column -> expression, CpG
column -> methylation). Filename extensions are only a fallback for plain-text
extractions that sniffed no structure.
"""

from pathlib import Path

from app.models import DataType

_KIND_VCF = "vcf"
_KIND_BED = "bed"
_KIND_MATRIX = "matrix"

_METHYLATION_HEADER_HINTS = ("cpg", "methyl")
_EXPRESSION_HEADER_HINTS = (
    "gene",
    "transcript",
    "ensembl",
    "ensemble",
    "hgnc",
    "symbol",
)

_TYPED_EXTENSIONS = {
    ".vcf": DataType.variants,
    ".bed": DataType.peaks,
    ".narrowpeak": DataType.peaks,
    ".broadpeak": DataType.peaks,
}


def _classify_matrix_header(header: list[str] | None) -> DataType | None:
    if not header:
        return None
    first = str(header[0]).strip().lower()
    if any(hint in first for hint in _METHYLATION_HEADER_HINTS):
        return DataType.methylation
    if any(hint in first for hint in _EXPRESSION_HEADER_HINTS):
        return DataType.expression
    return None


def classify(
    filename: str,
    kind: str | None = None,
    structure: dict | None = None,
) -> DataType:
    """Infer the omics data type of an uploaded document.

    Precedence: structured kind (vcf/bed) > matrix header disambiguation >
    filename extension fallback > :attr:`DataType.document`. ``structure`` is
    ``ExtractionResult.structure`` produced by ``app.services.extraction``.
    """
    if kind == _KIND_VCF:
        return DataType.variants
    if kind == _KIND_BED:
        return DataType.peaks
    if kind == _KIND_MATRIX:
        header = (structure.get("header") or []) if structure else None
        detected = _classify_matrix_header(header)
        if detected is not None:
            return detected
        return DataType.expression

    ext = Path(filename).suffix.lower()
    if data_type := _TYPED_EXTENSIONS.get(ext):
        return data_type
    return DataType.document