import time
import uuid

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


def _ctx(doc):
    return ValidationContext(document_id=str(doc.id), document=doc)


def _codes(issues):
    return {(issue.code, issue.severity) for issue in issues}


#  -----  VCF  -----


def test_vcf_valid_file_produces_no_errors(tmp_path):
    path = tmp_path / "ok.vcf"
    path.write_text(
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\n"
        "1\t123\t.\tA\tT\t50\tPASS\t.\tGT\t0/1\n"
    )
    doc = DummyDoc("ok.vcf", str(path))
    issues = VCFValidator().run(_ctx(doc))
    assert not [issue for issue in issues if issue.severity == "error"]


def test_vcf_missing_header_yields_header_code(tmp_path):
    path = tmp_path / "bad.vcf"
    path.write_text("CHROM\tPOS\n1\t123\n")
    doc = DummyDoc("bad.vcf", str(path))
    issues = VCFValidator().run(_ctx(doc))
    assert ("VCF-HEADER-001", "error") in _codes(issues)


def test_vcf_unparseable_genotype_yields_gt_code(tmp_path):
    path = tmp_path / "gt.vcf"
    path.write_text(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\n"
        "1\t123\t.\tA\tT\t50\tPASS\t.\tGT\tNOT_A_GT\n"
    )
    doc = DummyDoc("gt.vcf", str(path))
    issues = VCFValidator().run(_ctx(doc))
    assert ("VCF-GT-001", "error") in _codes(issues)


def test_vcf_invalid_base_yields_base_code(tmp_path):
    path = tmp_path / "base.vcf"
    path.write_text(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n" "1\t123\t.\tX\tT\t50\tPASS\t.\n"
    )
    doc = DummyDoc("base.vcf", str(path))
    issues = VCFValidator().run(_ctx(doc))
    assert ("VCF-BASE-001", "error") in _codes(issues)


def test_vcf_inconsistent_contigs_yields_warning(tmp_path):
    path = tmp_path / "contig.vcf"
    path.write_text(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "1\t123\t.\tA\tT\t50\tPASS\t.\n"
        "chr2\t124\t.\tC\tG\t50\tPASS\t.\n"
    )
    doc = DummyDoc("contig.vcf", str(path))
    issues = VCFValidator().run(_ctx(doc))
    assert ("VCF-CONTIG-001", "warning") in _codes(issues)


def test_vcf_pos_check_skipped_when_assembly_not_declared(tmp_path):
    path = tmp_path / "pos.vcf"
    path.write_text(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "1\t123\t.\tA\tT\t50\tPASS\t.\n"
    )
    doc = DummyDoc("pos.vcf", str(path))
    ctx = ValidationContext(document_id=str(doc.id), document=doc, assembly_declared=False)
    issues = VCFValidator().run(ctx)
    assert ("VCF-POS-001", "skipped") not in _codes(issues)


def test_vcf_pos_check_runs_when_assembly_declared(tmp_path):
    path = tmp_path / "pos2.vcf"
    path.write_text(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "1\t999999999999\t.\tA\tT\t50\tPASS\t.\n"
    )
    doc = DummyDoc("pos2.vcf", str(path))
    ctx = ValidationContext(
        document_id=str(doc.id),
        document=doc,
        assembly_declared=True,
        assembly="GRCh38",
    )
    issues = VCFValidator().run(ctx)
    assert ("VCF-POS-001", "error") in _codes(issues)


def test_vcf_pos_check_skipped_for_unknown_assembly(tmp_path):
    path = tmp_path / "pos3.vcf"
    path.write_text(
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
        "1\t123\t.\tA\tT\t50\tPASS\t.\n"
    )
    doc = DummyDoc("pos3.vcf", str(path))
    ctx = ValidationContext(
        document_id=str(doc.id),
        document=doc,
        assembly_declared=True,
        assembly="SomeUnknownAssembly",
    )
    issues = VCFValidator().run(ctx)
    assert ("VCF-POS-001", "skipped") in _codes(issues)


#  -----  BED  -----


def test_bed_valid_file_produces_no_errors(tmp_path):
    path = tmp_path / "ok.bed"
    path.write_text("chr1\t100\t200\nchr1\t300\t400\n")
    doc = DummyDoc("ok.bed", str(path))
    issues = BEDValidator().run(_ctx(doc))
    assert not [issue for issue in issues if issue.severity == "error"]


def test_bed_too_few_columns(tmp_path):
    path = tmp_path / "cols.bed"
    path.write_text("chr1\t100\n")
    doc = DummyDoc("cols.bed", str(path))
    issues = BEDValidator().run(_ctx(doc))
    assert ("BED-COLS-001", "error") in _codes(issues)


def test_bed_non_integer_coordinates(tmp_path):
    path = tmp_path / "int.bed"
    path.write_text("chr1\tstart\t200\n")
    doc = DummyDoc("int.bed", str(path))
    issues = BEDValidator().run(_ctx(doc))
    assert ("BED-INT-001", "error") in _codes(issues)


def test_bed_start_not_before_end(tmp_path):
    path = tmp_path / "coord.bed"
    path.write_text("chr1\t300\t200\n")
    doc = DummyDoc("coord.bed", str(path))
    issues = BEDValidator().run(_ctx(doc))
    assert ("BED-COORD-001", "error") in _codes(issues)


def test_bed_negative_start(tmp_path):
    path = tmp_path / "neg.bed"
    path.write_text("chr1\t-5\t200\n")
    doc = DummyDoc("neg.bed", str(path))
    issues = BEDValidator().run(_ctx(doc))
    assert ("BED-COORD-001", "error") in _codes(issues)


def test_bed_inconsistent_column_count_warns(tmp_path):
    path = tmp_path / "cols2.bed"
    path.write_text("chr1\t100\t200\nchr1\t300\t400\tname\n")
    doc = DummyDoc("cols2.bed", str(path))
    issues = BEDValidator().run(_ctx(doc))
    assert ("BED-COLCONSIST-001", "warning") in _codes(issues)


#  -----  MATRIX  -----


def test_matrix_valid_file_produces_no_errors(tmp_path):
    path = tmp_path / "counts.tsv"
    path.write_text("gene\tS1\tS2\nTP53\t1.0\t2.0\nBRCA1\t0.5\t1.5\n")
    doc = DummyDoc("counts.tsv", str(path))
    issues = MatrixValidator().run(_ctx(doc))
    assert not [issue for issue in issues if issue.severity == "error"]


def test_matrix_non_numeric_cell(tmp_path):
    path = tmp_path / "bad.tsv"
    path.write_text("gene\tS1\tS2\nTP53\t1.0\tx\n")
    doc = DummyDoc("bad.tsv", str(path))
    issues = MatrixValidator().run(_ctx(doc))
    assert ("MAT-NONNUM-001", "error") in _codes(issues)


def test_matrix_duplicate_feature_ids_warns(tmp_path):
    path = tmp_path / "dup.tsv"
    path.write_text("gene\tS1\nTP53\t1.0\nTP53\t2.0\n")
    doc = DummyDoc("dup.tsv", str(path))
    issues = MatrixValidator().run(_ctx(doc))
    assert ("MAT-DUP-001", "warning") in _codes(issues)


def test_matrix_row_column_mismatch(tmp_path):
    path = tmp_path / "shape.tsv"
    path.write_text("gene\tS1\tS2\nTP53\t1.0\n")
    doc = DummyDoc("shape.tsv", str(path))
    issues = MatrixValidator().run(_ctx(doc))
    assert ("MAT-SHAPE-001", "error") in _codes(issues)


def test_matrix_methylation_beta_out_of_range(tmp_path):
    path = tmp_path / "methylation.tsv"
    path.write_text("gene\tS1\ncg0001\t1.4\n")
    doc = DummyDoc("methylation.tsv", str(path), data_type="methylation")
    issues = MatrixValidator().run(_ctx(doc))
    assert ("MAT-METH-001", "error") in _codes(issues)


def test_matrix_methylation_beta_in_range(tmp_path):
    path = tmp_path / "methylation_ok.tsv"
    path.write_text("gene\tS1\ncg0001\t0.4\n")
    doc = DummyDoc("methylation_ok.tsv", str(path), data_type="methylation")
    issues = MatrixValidator().run(_ctx(doc))
    assert not [issue for issue in issues if issue.severity == "error"]


#  -----  Real-data scoping (validators must not cross formats)  -----


def test_vcf_document_does_not_trigger_bed_or_matrix_validators(tmp_path):
    """A real VCF's rows also have >=3 tab columns; only the VCF validator
    may run on it (found with real 1000 Genomes data)."""
    path = tmp_path / "real.vcf"
    path.write_text(
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\n"
        "MT\t72\t.\tT\tC\t100\tPASS\t.\tGT\t0\n"
    )
    doc = DummyDoc("real.vcf", str(path), data_type="variants")
    assert BEDValidator().applies_to(_ctx(doc)) is False
    assert MatrixValidator().applies_to(_ctx(doc)) is False
    issues = VCFValidator().run(_ctx(doc))
    assert not [issue for issue in issues if issue.severity == "error"]


def test_peaks_document_does_not_trigger_matrix_validator(tmp_path):
    """Real narrowPeak BEDs are tab-separated; the matrix validator must not
    fire on them (found with real ENCODE narrowPeak data)."""
    path = tmp_path / "peaks.bed"
    path.write_text("chr7\t143620479\t143621175\t.\t1000\t.\t21.47\t419.24\t413.13\t300\n")
    doc = DummyDoc("peaks.bed", str(path), data_type="peaks")
    assert MatrixValidator().applies_to(_ctx(doc)) is False
    issues = BEDValidator().run(_ctx(doc))
    assert not [issue for issue in issues if issue.severity == "error"]


def test_expression_document_does_not_trigger_bed_validator(tmp_path):
    """Real GEO FPKM tracking files (.tsv) have >=3 columns per row; the BED
    validator must not fire on them."""
    path = tmp_path / "fpkm.tsv"
    path.write_text(
        "tracking_id\tclass_code\tgene_id\nENSG0001\t-\tENSG0001\nENSG0002\t-\tENSG0002\n"
    )
    doc = DummyDoc("fpkm.tsv", str(path), data_type="expression")
    assert BEDValidator().applies_to(_ctx(doc)) is False
    issues = MatrixValidator().applies_to(_ctx(doc))
    assert issues is True  # it IS the matrix validator's domain


def test_registry_runs_only_the_matching_format_validator(tmp_path):
    """Registry-level behaviour: a classified document produces issues only
    from its own format's validator."""
    from app.validation import get_registry

    path = tmp_path / "real.vcf"
    path.write_text(
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tS1\n"
        "MT\t72\t.\tT\tC\t100\tPASS\t.\tGT\t0\n"
    )
    doc = DummyDoc("real.vcf", str(path), data_type="variants")
    issues = get_registry().run_all(_ctx(doc))
    codes = {issue.code for issue in issues}
    assert "BED-INT-001" not in codes
    assert "MAT-NONNUM-001" not in codes
    assert "VCF-OK-001" in codes


def test_unknown_extension_unclassified_falls_back_to_sniff(tmp_path):
    """Unclassified files with unknown extensions keep the honest discovery
    path (sniffing); classification then locks the scope."""
    path = tmp_path / "something.fpkm_tracking"
    path.write_text("tracking\tcol2\nENSG0001\tvalue\n")
    doc = DummyDoc("something.fpkm_tracking", str(path))
    assert BEDValidator().applies_to(_ctx(doc)) is False  # 2 columns, no sniff hit
    assert MatrixValidator().applies_to(_ctx(doc)) is True
    assert VCFValidator().applies_to(_ctx(doc)) is False


def test_untyped_document_falls_back_to_content_sniff(tmp_path):
    """With no data_type and a generic extension, the honest content
    fallback still routes the file to its validator."""
    path = tmp_path / "peak-file.bed"
    path.write_text("chr1\t100\t200\n")
    doc = DummyDoc("peak-file.bed", str(path))
    assert BEDValidator().applies_to(_ctx(doc)) is True
    path2 = tmp_path / "mystery.dat"
    path2.write_text("gene\tS1\nTP53\t1.0\n")
    doc2 = DummyDoc("mystery.dat", str(path2))
    assert MatrixValidator().applies_to(_ctx(doc2)) is True
    path3 = tmp_path / "variants-file.vcf"
    path3.write_text("##fileformat=VCFv4.2\n")
    doc3 = DummyDoc("variants-file.vcf", str(path3))
    assert VCFValidator().applies_to(_ctx(doc3)) is True


def test_other_format_extension_never_sniffs(tmp_path):
    """A matrix-shaped file named .bed must never fire the matrix validator:
    the extension is the stronger signal than the content shape."""
    path = tmp_path / "not-really.bed"
    path.write_text("gene\tS1\nTP53\t1.0\n")
    doc = DummyDoc("not-really.bed", str(path))
    assert MatrixValidator().applies_to(_ctx(doc)) is False
    assert BEDValidator().applies_to(_ctx(doc)) is True


#  -----  Story 7 fixture compatibility  -----


STORY7_VCF = """##fileformat=VCFv4.2
##source=DemoCaller
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tTUMOR\tNORMAL
1\t100\trs1\tA\tG\t50\tPASS\tDP=40\tGT:DP\t0/1:20\t0/0:20
1\t200\t.\tC\tT\t30\tq10\tDP=10\tGT:DP\t1/1:10\t0/1:5
"""

STORY7_BED = """chr1\t100\t200\tpeakA\t60\t+
chr1\t400\t500\tpeakB\t80\t-
chr2\t10\t50\tpeakC\t20\t+
"""

STORY7_MATRIX = """gene\tS1\tS2\tS3
TP53\t1.2\t3.4\t0.0
BRCA1\t5.0\t0.0\t2.2
MYC\t0.1\t9.9\t1.1
"""


def _story7_issues(tmp_path, name, content, validator):
    path = tmp_path / name
    path.write_text(content)
    return validator.run(_ctx(DummyDoc(name, str(path))))


def test_story7_vcf_fixture_has_no_false_positive_errors(tmp_path):
    issues = _story7_issues(tmp_path, "story7.vcf", STORY7_VCF, VCFValidator())
    assert not [issue for issue in issues if issue.severity == "error"]


def test_story7_bed_fixture_has_no_false_positive_errors(tmp_path):
    issues = _story7_issues(tmp_path, "story7.bed", STORY7_BED, BEDValidator())
    assert not [issue for issue in issues if issue.severity == "error"]


def test_story7_matrix_fixture_has_no_false_positive_errors(tmp_path):
    issues = _story7_issues(tmp_path, "story7.tsv", STORY7_MATRIX, MatrixValidator())
    assert not [issue for issue in issues if issue.severity == "error"]


#  -----  Performance budget  -----


def test_ten_mib_matrix_completes_within_two_seconds(tmp_path):
    """10 MiB worst case must finish within the Story 16 budget."""
    header = "gene\t" + "\t".join(f"S{i}" for i in range(50)) + "\n"
    row = "GENE\t" + "\t".join("1.0" for _ in range(50)) + "\n"
    target = 10 * 1024 * 1024
    body = [header]
    size = len(header.encode())
    while size < target:
        body.append(row)
        size += len(row.encode())
    path = tmp_path / "big.tsv"
    path.write_text("".join(body))

    started = time.perf_counter()
    issues = MatrixValidator().run(_ctx(DummyDoc("big.tsv", str(path))))
    elapsed = time.perf_counter() - started

    assert not [issue for issue in issues if issue.severity == "error"]
    assert elapsed <= 2.0, f"matrix validation took {elapsed:.3f}s for 10 MiB"


def test_ten_mib_vcf_completes_within_two_seconds(tmp_path):
    header = (
        "##fileformat=VCFv4.2\n"
        "#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\n"
    )
    row = "1\t100\t.\tA\tG\t50\tPASS\t.\n"
    target = 10 * 1024 * 1024
    body = [header]
    size = len(header.encode())
    while size < target:
        body.append(row)
        size += len(row.encode())
    path = tmp_path / "big.vcf"
    path.write_text("".join(body))

    started = time.perf_counter()
    issues = VCFValidator().run(_ctx(DummyDoc("big.vcf", str(path))))
    elapsed = time.perf_counter() - started

    assert not [issue for issue in issues if issue.severity == "error"]
    assert elapsed <= 2.0, f"VCF validation took {elapsed:.3f}s for 10 MiB"


def test_ten_mib_bed_completes_within_two_seconds(tmp_path):
    row = "chr1\t100\t200\tpeakA\t60\t+\n"
    target = 10 * 1024 * 1024
    body = [row]
    size = len(row.encode())
    while size < target:
        body.append(row)
        size += len(row.encode())
    path = tmp_path / "big.bed"
    path.write_text("".join(body))

    started = time.perf_counter()
    issues = BEDValidator().run(_ctx(DummyDoc("big.bed", str(path))))
    elapsed = time.perf_counter() - started

    assert not [issue for issue in issues if issue.severity == "error"]
    assert elapsed <= 2.0, f"BED validation took {elapsed:.3f}s for 10 MiB"
