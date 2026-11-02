"""The first adapter implementation (Story 21).

``OmicsAdapter`` wraps the omics sniffers behind the adapter API without
changing their observable behaviour: ``MappedDataset.source`` *is* the
legacy JSON structure (same keys) so existing extraction and validation
tests keep passing unchanged. The typed ``records`` are derived in the same
single pass through the ``parse_*_full`` helpers in
``app.services.omics_parser`` — the sniff stage runs on a prefix only.
"""

from __future__ import annotations

from typing import Any

from app.integration.adapters.base import (
    DatasetKind,
    FeatureAbundanceRow,
    IdentifierNamespace,
    IntervalRecord,
    MappedDataset,
    VariantRecord,
    detect_namespace,
)
from app.services import omics_parser

RECORD_CAP = 100
VARIANT_RECORD_CAP = 1000
PARSER_VERSION = "1.0"


class OmicsAdapter:
    """Sniff-and-map adapter for the text omics family."""

    parser_version = PARSER_VERSION

    def describe(self) -> str:
        # Matches ToolDefinition.internal_representation_mapping_id in the
        # Story 20 registry seed.
        return "extraction-pipeline:v1"

    def sniff(self, sample_bytes: bytes, filename: str) -> float:
        probe = sample_bytes.decode("utf-8", errors="replace")[:2000]
        kind = omics_parser.parse_omics(probe).get("kind")
        if kind == "vcf":
            return 0.95
        if kind == "bed":
            return 0.9
        if kind == "matrix":
            return 0.8
        return 0.2

    def parse(self, full_text: str) -> MappedDataset:
        """One classification pass, then a single targeted parse for the
        records. Identical structure keys, extra typed records."""
        kind = omics_parser.parse_omics(full_text).get("kind")
        if kind == "vcf":
            return self._parse_vcf(full_text)
        if kind == "bed":
            return self._parse_bed(full_text)
        if kind == "matrix":
            return self._parse_matrix(full_text)
        return self._parse_other(full_text)

    #  ----------  per-family parsers (single full pass each)  ----------

    def _parse_vcf(self, full_text: str) -> MappedDataset:
        structure, raw_rows = omics_parser.parse_vcf_full(full_text)
        header = structure["header"]
        samples = structure["sample_columns"]

        records: list[VariantRecord] = []
        identifier = IdentifierNamespace("unknown", "no named variant in preview")
        named = False
        for row in raw_rows[:VARIANT_RECORD_CAP]:
            values = dict(zip(header, row))
            records.append(
                VariantRecord(
                    chrom=str(values.get("CHROM", "")),
                    pos=_as_int(values.get("POS")),
                    ref=str(values.get("REF", "")),
                    alt=str(values.get("ALT", "")),
                    raw=values,
                )
            )
            if not named and str(values.get("ID", ".")) not in ("", "."):
                candidate = detect_namespace(str(values["ID"]))
                if candidate.namespace != "unknown":
                    identifier = candidate
                    named = True
        # FORMAT/GT ride along verbatim in raw — nothing is coerced.
        coordinate_meta = {
            "system": "1-based",
            "end_inclusive": True,
        }
        return MappedDataset(
            kind="variants",
            records=records,
            identifiers=identifier,
            coordinate_meta=coordinate_meta,
            sample_ids=samples,
            columns=header,
            source=structure,
            provenance={"parser_id": "vcf", "parser_version": self.parser_version},
        )

    def _parse_bed(self, full_text: str) -> MappedDataset:
        structure, raw_rows = omics_parser.parse_bed_full(full_text)
        records = [
            IntervalRecord(
                chrom=str(row[0]),
                start=int(str(row[1]).strip()),
                end=int(str(row[2]).strip()),
                raw={"row": list(row[:6])},
            )
            for row in raw_rows[:RECORD_CAP]
            if len(row) >= 3
        ]
        coordinate_meta = {
            "system": "0-based half-open",
            "end_exclusive": True,
        }
        return MappedDataset(
            kind="peaks",
            records=records,
            identifiers=IdentifierNamespace("unknown", "bed carries no id column"),
            coordinate_meta=coordinate_meta,
            sample_ids=[],
            columns=["chrom", "start", "end", "name", "score", "strand"],
            source=structure,
            provenance={"parser_id": "bed", "parser_version": self.parser_version},
        )

    def _parse_matrix(self, full_text: str) -> MappedDataset:
        structure, rows, header = omics_parser.parse_matrix_full(full_text)
        sample_ids = list(header[1:])
        records: list[FeatureAbundanceRow] = []
        namespace = IdentifierNamespace("unknown", "empty")
        for row in rows[:RECORD_CAP]:
            identifier = str(row[0]) if row else ""
            if identifier and namespace.namespace == "unknown":
                namespace = detect_namespace(identifier)
            values = {
                header[index + 1] if index + 1 < len(header) else f"col{index + 1}": str(
                    value
                )
                for index, value in enumerate(row[1:])
            }
            records.append(
                FeatureAbundanceRow(identifier=identifier, values=values, raw=list(row))
            )
        kind: DatasetKind = (
            "methylation"
            if namespace.namespace == "cpg_probe"
            else "expression"
        )
        return MappedDataset(
            kind=kind,
            records=records,
            identifiers=namespace,
            coordinate_meta={},
            sample_ids=sample_ids,
            columns=header,
            source=structure,
            provenance={"parser_id": "matrix", "parser_version": self.parser_version},
        )

    def _parse_other(self, full_text: str) -> MappedDataset:
        structure = omics_parser.parse_omics(full_text)
        return MappedDataset(
            kind="other",
            records=[],
            identifiers=IdentifierNamespace("unknown", "not a structured file"),
            source=structure,
            provenance={"parser_id": "text", "parser_version": self.parser_version},
        )


def _as_int(value: Any) -> int | None:
    text = str(value).strip()
    if text.isdigit() or (text.startswith("-") and text[1:].isdigit()):
        return int(text)
    return None


OMICS_ADAPTER = OmicsAdapter()
