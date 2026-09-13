"""Unit tests for the extraction pipeline (sniffers + dispatcher).

These target the stdlib-only ``omics_parser`` and the text-level routing of
``extract_text``; PDF/OCR/DOCX extraction needs real fixtures and is exercised
manually against ``backend/app/services/*.{pdf,png,docx}``.
"""

from pathlib import Path

import pytest
from app.services.extraction import ExtractionResult, extract_text
from app.services.omics_parser import parse_omics

MATRIX_TSV = """gene\tS1\tS2\tS3
TP53\t1.2\t3.4\t0.0
BRCA1\t5.0\t0.0\t2.2
MYC\t0.1\t9.9\t1.1
"""

VCF = """##fileformat=VCFv4.2
##source=DemoCaller
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tTUMOR\tNORMAL
1\t100\trs1\tA\tG\t50\tPASS\tDP=40\tGT:DP\t0/1:20\t0/0:20
1\t200\t.\tC\tT\t30\tq10\tDP=10\tGT:DP\t1/1:10\t0/1:5
"""

BED = """chr1\t100\t200\tpeakA\t60\t+
chr1\t400\t500\tpeakB\t80\t-
chr2\t10\t50\tpeakC\t20\t+
"""

PROSE = """This is just a methods note.

It has prose, not a table. Count columns: no.
"""


def _write(tmp_path: Path, name: str, content: str) -> Path:
    path = tmp_path / name
    path.write_text(content)
    return path


class TestOmicsParser:
    def test_sniffs_vcf(self):
        result = parse_omics(VCF)
        assert result["kind"] == "vcf"
        assert result["variant_count"] == 2
        assert result["header"][0:2] == ["CHROM", "POS"]
        assert result["sample_columns"] == ["TUMOR", "NORMAL"]
        assert result["meta_lines"][0] == "##fileformat=VCFv4.2"

    def test_sniffs_bed(self):
        result = parse_omics(BED)
        assert result["kind"] == "bed"
        assert result["region_count"] == 3
        assert result["columns"] == 6

    def test_sniffs_matrix(self):
        result = parse_omics(MATRIX_TSV)
        assert result["kind"] == "matrix"
        assert result["header"] == ["gene", "S1", "S2", "S3"]
        assert result["row_count"] == 3
        assert result["column_count"] == 4
        assert result["numeric_data_columns"] == [True, True, True]
        assert result["preview_rows"][0][0] == "TP53"

    def test_prose_falls_back_to_text(self):
        result = parse_omics(PROSE)
        assert result["kind"] == "text"
        assert result["line_count"] == 3
        assert result["char_count"] == len(PROSE)

    def test_vcf_wins_over_matrix_shape(self):
        assert parse_omics(VCF)["kind"] == "vcf"


class TestExtractText:
    def test_tsv_routes_through_sniffer(self, tmp_path):
        path = _write(tmp_path, "counts.tsv", MATRIX_TSV)
        result = extract_text(str(path))
        assert isinstance(result, ExtractionResult)
        assert result.kind == "matrix"
        assert result.structure["row_count"] == 3

    def test_txt_prose_returns_plain_text(self, tmp_path):
        path = _write(tmp_path, "note.txt", PROSE)
        result = extract_text(str(path))
        assert result.kind == "text"
        assert result.structure is None
        assert result.text == PROSE

    def test_matrix_in_txt_is_sniffed(self, tmp_path):
        path = _write(tmp_path, "matrix.txt", MATRIX_TSV)
        result = extract_text(str(path))
        assert result.kind == "matrix"

    def test_missing_file_raises(self, tmp_path):
        with pytest.raises(FileNotFoundError):
            extract_text(str(tmp_path / "nope.tsv"))

    def test_unknown_extension_falls_back_to_text(self, tmp_path):
        path = _write(tmp_path, "notes.md", PROSE)
        result = extract_text(str(path))
        assert result.kind == "text"