"""Unit tests for omics data type classification.

The classify() heuristic turns an extraction result (kind + structure) and the
original filename into a DataType. Matrix tables are the interesting case: the
first header cell tells expression apart from methylation.
"""

import pytest

from app.models import DataType
from app.services.classification import classify

pytestmark = pytest.mark.unit

VCF_STRUCTURE = {"kind": "vcf", "header": ["#CHROM", "POS", "ID", "REF", "ALT"]}
BED_STRUCTURE = {"kind": "bed", "header": ["chrom", "start", "end", "name"]}
EXPRESSION_MATRIX = {
    "kind": "matrix",
    "header": ["gene", "S1", "S2", "S3"],
    "row_count": 3,
    "column_count": 4,
}
METHYLATION_MATRIX = {
    "kind": "matrix",
    "header": ["cpg", "S1", "S2", "S3"],
    "row_count": 3,
    "column_count": 4,
}
GENERIC_MATRIX = {
    "kind": "matrix",
    "header": ["id", "S1", "S2", "S3"],
    "row_count": 3,
    "column_count": 4,
}


def test_vcf_structure_classifies_as_variants() -> None:
    assert classify("tumor.vcf", "vcf", VCF_STRUCTURE) == DataType.variants


def test_bed_structure_classifies_as_peaks() -> None:
    assert classify("atac.bed", "bed", BED_STRUCTURE) == DataType.peaks


def test_expression_matrix_header() -> None:
    assert classify("counts.tsv", "matrix", EXPRESSION_MATRIX) == DataType.expression


def test_methylation_matrix_header() -> None:
    assert (
        classify("beta_tumor.tsv", "matrix", METHYLATION_MATRIX) == DataType.methylation
    )


def test_probe_style_id_header_defaults_to_expression() -> None:
    probe_matrix = {
        "kind": "matrix",
        "header": ["IlmnID", "S1", "S2"],
        "row_count": 2,
        "column_count": 3,
    }
    assert classify("450k.csv", "matrix", probe_matrix) == DataType.expression


def test_generic_matrix_defaults_to_expression() -> None:
    assert classify("data.tsv", "matrix", GENERIC_MATRIX) == DataType.expression


def test_ambiguous_matrix_no_structure() -> None:
    assert classify("data.tsv", None, None) == DataType.document


def test_vcf_extension_fallback_for_plain_text() -> None:
    assert classify("somatic.vcf", "text", None) == DataType.variants


def test_bed_extension_fallback_for_plain_text() -> None:
    assert classify("peaks.bed", "text", None) == DataType.peaks


def test_plain_document_remains_document() -> None:
    assert classify("methods.pdf", "pdf", None) == DataType.document
    assert classify("report.txt", "text", None) == DataType.document
    assert classify("analysis.docx", "docx", None) == DataType.document


def test_none_filename_does_not_crash() -> None:
    assert classify("", "text", None) == DataType.document
