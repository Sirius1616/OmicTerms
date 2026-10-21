import uuid
from pathlib import Path

from app.validation import ValidationContext
from app.validation.bed import BEDValidator
from app.validation.matrix import MatrixValidator
from app.validation.vcf import VCFValidator


class DummyDoc:
    def __init__(self, filename, file_url=None, data_type=None):
        self.id = uuid.uuid4()
        self.filename = filename
        self.file_url = file_url
        self.data_type = data_type


def test_vcf_header_ok(tmp_path):
    p = tmp_path / "ok.vcf"
    p.write_text("#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n1\t123\t.\tA\tT\t.\tPASS\t.\n")
    doc = DummyDoc("ok.vcf", str(p))
    v = VCFValidator()
    ctx = ValidationContext(document_id=str(doc.id), document=doc)
    issues = v.run(ctx)
    # should not have VCF-HEADER-001 error
    assert all(not (i.code == "VCF-HEADER-001" and i.severity == "error") for i in issues)


def test_vcf_malformed_header(tmp_path):
    p = tmp_path / "bad.vcf"
    p.write_text("CHROM\tPOS\n1\t123\n")
    doc = DummyDoc("bad.vcf", str(p))
    v = VCFValidator()
    ctx = ValidationContext(document_id=str(doc.id), document=doc)
    issues = v.run(ctx)
    assert any(i.code == "VCF-HEADER-001" and i.severity == "error" for i in issues)


def test_bed_ok(tmp_path):
    p = tmp_path / "ok.bed"
    p.write_text("chr1\t100\t200\nchr1\t300\t400\n")
    doc = DummyDoc("ok.bed", str(p))
    v = BEDValidator()
    ctx = ValidationContext(document_id=str(doc.id), document=doc)
    issues = v.run(ctx)
    assert all(i.severity != "error" for i in issues)


def test_bed_malformed(tmp_path):
    p = tmp_path / "bad.bed"
    p.write_text("chr1\t100\n")
    doc = DummyDoc("bad.bed", str(p))
    v = BEDValidator()
    ctx = ValidationContext(document_id=str(doc.id), document=doc)
    issues = v.run(ctx)
    assert any(i.code.startswith("BED-") and i.severity == "error" for i in issues)


def test_matrix_ok(tmp_path):
    p = tmp_path / "counts.tsv"
    p.write_text("gene\tS1\tS2\nTP53\t1.0\t2.0\nBRCA1\t0.5\t1.5\n")
    doc = DummyDoc("counts.tsv", str(p))
    v = MatrixValidator()
    ctx = ValidationContext(document_id=str(doc.id), document=doc)
    issues = v.run(ctx)
    assert all(i.severity != "error" for i in issues)


def test_matrix_malformed(tmp_path):
    p = tmp_path / "bad.tsv"
    p.write_text("gene\tS1\tS2\nTP53\t1.0\tx\n")
    doc = DummyDoc("bad.tsv", str(p))
    v = MatrixValidator()
    ctx = ValidationContext(document_id=str(doc.id), document=doc)
    issues = v.run(ctx)
    assert any(i.code == "MAT-NONNUM-001" and i.severity == "error" for i in issues)
