"""Story 21 — adapter interface + internal representation mappings.

Round-trip retention of everything a tool emitted (AC2), honest identifier
namespace detection (AC3), the extension point working without touching core
files (AC4), and the additive ``__meta`` envelope for validators (AC5).
"""

import pytest

from app.integration.adapters import (
    OMICS_ADAPTER,
    get_adapter,
    known_adapters,
    register_adapter,
)
from app.services.extraction import extract_text

pytestmark = pytest.mark.unit

VCF = """##fileformat=VCFv4.2
##INFO=<ID=DP,Number=1,Type=Integer,Description="Total Depth">
#CHROM\tPOS\tID\tREF\tALT\tQUAL\tFILTER\tINFO\tFORMAT\tTUMOR\tNORMAL
1\t100\trs123\tA\tG\t50\tPASS\tDP=40\tGT:DP\t0/1:20\t0/0:20
1\t200\t.\tC\tT\t30\tq10\tDP=10\tGT:DP\t1/1:10\t0/1:5
"""

BED = """chr1\t100\t200\tpeakA\t60\t+
chr2\t10\t50\tpeakB\t80\t-
"""

EXPRESSION_TSV = """gene\tS1\tS2
TP53\t1.2\t3.4
ENSG00000141510\t5.0\t0.0
UNKNOWN_1\t0.1\t9.9
"""

METHYLATION_TSV = """cpg\tS1\tS2
cg00000029\t0.9\t0.2
cg11111111\t0.4\t0.8
"""


class TestRoundTripRetention:
    def test_vcf_variant_records_raw_verbatim(self):
        dataset = OMICS_ADAPTER.parse(VCF)

        assert dataset.kind == "variants"
        assert dataset.provenance == {
            "parser_id": "vcf",
            "parser_version": OMICS_ADAPTER.parser_version,
        }
        first = dataset.records[0].raw
        assert first["FORMAT"] == "GT:DP"
        assert first["TUMOR"] == "0/1:20"
        assert first["NORMAL"] == "0/0:20"
        assert first["INFO"] == "DP=40"
        assert first["CHROM"] == "1"
        assert first["POS"] == "100"

        # Typed mapping reads the same fields, uncoerced.
        assert dataset.records[0].ref == "A"
        assert dataset.records[0].alt == "G"
        assert dataset.records[0].pos == 100

        # The legacy structure survives intact for the extraction pipeline.
        assert dataset.source["kind"] == "vcf"
        assert dataset.source["variant_count"] == 2
        assert dataset.source["sample_columns"] == ["TUMOR", "NORMAL"]

    def test_bed_intervals_from_preview_rows(self):
        dataset = OMICS_ADAPTER.parse(BED)
        assert dataset.kind == "peaks"
        assert dataset.coordinate_meta == {
            "system": "0-based half-open",
            "end_exclusive": True,
        }
        assert dataset.identifiers.namespace == "unknown"
        assert dataset.records[0].chrom == "chr1"
        assert dataset.records[0].start == 100
        assert dataset.records[0].end == 200

    def test_source_structure_identity_is_held(self):
        from app.services.omics_parser import parse_omics

        dataset = OMICS_ADAPTER.parse(VCF)
        assert parse_omics(VCF) == dataset.source


class TestNamespaceDetection:
    def test_expression_matrix_is_expression(self):
        dataset = OMICS_ADAPTER.parse(EXPRESSION_TSV)
        assert dataset.kind == "expression"
        # First row wins the namespace decision, unknown stays allowed (AC3).
        assert dataset.identifiers.namespace == "symbol"

    def test_cpg_matrix_is_methylation(self):
        dataset = OMICS_ADAPTER.parse(METHYLATION_TSV)
        assert dataset.kind == "methylation"
        assert dataset.identifiers.namespace == "cpg_probe"
        assert dataset.records[0].values["S1"] == "0.9"

    def test_ensembl_and_rsid_examples(self):
        from app.integration.adapters import detect_namespace

        assert detect_namespace("ENSG00000141510").namespace == "ensembl"
        assert detect_namespace("ENST00000269305").namespace == "ensembl"
        assert detect_namespace("rs1255").namespace == "rsid"
        assert detect_namespace("cg00000029").namespace == "cpg_probe"
        assert detect_namespace("BRCA1").namespace == "symbol"
        # anything else stays unknown intentionally, with an honest trace
        assert detect_namespace(chr(94) + "weird$").namespace == "unknown"


class TestExtensionPoint:
    def test_fake_adapter_registers_without_touching_core(self):
        from app.integration.adapters.base import Adapter, MappedDataset

        class FakeAdapter:
            def sniff(self, sample_bytes: bytes, filename: str) -> float:
                return 1.0

            def parse(self, full_text: str) -> MappedDataset:
                return MappedDataset(kind="other")

            def describe(self) -> str:
                return "fake-adapter:v1"

        assert isinstance(FakeAdapter(), Adapter)
        before = len(known_adapters())
        facade = FakeAdapter()
        register_adapter(facade)
        assert get_adapter("fake-adapter:v1") is facade
        assert len(known_adapters()) == before + 1
        assert get_adapter("nonexistent:v99") is None


class TestMetaEnvelope:
    def test_extract_text_emits_meta_envelope(self, tmp_path):
        path = tmp_path / "counts.tsv"
        path.write_text(EXPRESSION_TSV)
        result = extract_text(str(path))
        assert result.structure is not None
        meta = result.structure["__meta"]
        assert meta["adapter_id"] == "extraction-pipeline:v1"
        assert meta["dataset_kind"] == "expression"
        assert meta["parser_version"]

    def test_sniff_confidence_is_ordered_by_kind(self):
        probe = VCF.encode()[:200]
        bed_probe = BED.encode()[:200]
        prose = b"totally unrelated text\n"
        assert OMICS_ADAPTER.sniff(probe, "file.vcf") > OMICS_ADAPTER.sniff(
            bed_probe, "file.bed"
        )
        assert OMICS_ADAPTER.sniff(bed_probe, "x.bed") > OMICS_ADAPTER.sniff(
            prose, "x.txt"
        )
