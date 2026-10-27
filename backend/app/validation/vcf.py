from __future__ import annotations

from app.validation.base import Issue, ValidationContext, Validator
from app.validation.files import decode_text, read_document_bytes

REQUIRED_COLUMNS = [
    "#CHROM",
    "POS",
    "ID",
    "REF",
    "ALT",
    "QUAL",
    "FILTER",
    "INFO",
]
VALID_BASES = set("ACGTN")


class VCFValidator(Validator):
    name = "vcf_validator"

    def applies_to(self, ctx: ValidationContext) -> bool:
        document = ctx.document
        if document is None:
            return False
        filename = (getattr(document, "filename", "") or "").lower()
        if filename.endswith((".vcf", ".vcf.gz")):
            return True
        content = read_document_bytes(ctx)
        if content is None:
            return False
        return content.startswith((b"##fileformat=VCF", b"#CHROM"))

    def run(self, ctx: ValidationContext) -> list[Issue]:
        content = read_document_bytes(ctx)
        if content is None:
            return [
                Issue(
                    code="VCF-READ-001",
                    severity="error",
                    message="VCF file could not be read for validation",
                    suggestion="Re-upload the VCF file and re-run validation",
                )
            ]

        text = decode_text(content)
        lines = text.splitlines()
        header_index = next(
            (i for i, line in enumerate(lines) if line.startswith("#CHROM")), None
        )
        if header_index is None:
            return [
                Issue(
                    code="VCF-HEADER-001",
                    severity="error",
                    message="VCF header missing or missing required columns",
                    suggestion="Provide a VCF with a #CHROM header line",
                )
            ]

        header = lines[header_index].split("\t")
        if header[: len(REQUIRED_COLUMNS)] != REQUIRED_COLUMNS:
            return [
                Issue(
                    code="VCF-HEADER-001",
                    severity="error",
                    message="VCF header missing or missing required columns",
                    suggestion=(
                        "Ensure the header starts with: "
                        + " ".join(REQUIRED_COLUMNS)
                    ),
                )
            ]

        sample_columns = header[len(REQUIRED_COLUMNS) + 1 :]
        body = [line for line in lines[header_index + 1 :] if line.strip()]

        issues: list[Issue] = []

        if sample_columns and not self._genotypes_parseable(body, sample_columns):
            issues.append(
                Issue(
                    code="VCF-GT-001",
                    severity="error",
                    message="VCF sample/genotype columns not parseable",
                    suggestion=(
                        "Ensure FORMAT declares GT and every sample column is a "
                        "genotype value such as 0/1"
                    ),
                )
            )
            return issues

        contig_issue = self._contig_consistency(body)
        if contig_issue is not None:
            issues.append(contig_issue)

        base_issue = self._invalid_bases(body)
        if base_issue is not None:
            issues.append(base_issue)

        pos_issue = self._pos_within_declared_assembly(body, ctx)
        if pos_issue is not None:
            issues.append(pos_issue)

        if not issues:
            issues.append(
                Issue(
                    code="VCF-OK-001",
                    severity="info",
                    message="VCF validation completed with no errors",
                )
            )
        return issues

    @staticmethod
    def _genotypes_parseable(body: list[str], sample_columns: list[str]) -> bool:
        if not body:
            return True
        parts = body[0].split("\t")
        if len(parts) <= len(REQUIRED_COLUMNS) + 1:
            return False
        format_field = parts[len(REQUIRED_COLUMNS)]
        if "GT" not in format_field.split(":"):
            return False
        sample_values = parts[len(REQUIRED_COLUMNS) + 1 :]
        if len(sample_values) != len(sample_columns):
            return False
        for value in sample_values:
            genotype = value.split(":")[0]
            alleles = genotype.replace("|", "/").split("/")
            if not genotype or any(not allele.isdigit() for allele in alleles):
                return False
        return True

    @staticmethod
    def _contig_consistency(body: list[str]) -> Issue | None:
        chroms = {line.split("\t")[0] for line in body if line.strip()}
        if len(chroms) < 2:
            return None
        prefixed = {chrom.startswith("chr") for chrom in chroms}
        if len(prefixed) > 1:
            return Issue(
                code="VCF-CONTIG-001",
                severity="warning",
                message="VCF contig naming inconsistent within file",
                suggestion="Use one contig naming convention across the file",
            )
        return None

    @staticmethod
    def _invalid_bases(body: list[str]) -> Issue | None:
        for line in body:
            parts = line.split("\t")
            if len(parts) < 5:
                continue
            ref = parts[3].upper()
            alt = parts[4].upper()
            if any(base not in VALID_BASES for base in ref):
                return Issue(
                    code="VCF-BASE-001",
                    severity="error",
                    message="VCF invalid bases detected",
                    suggestion="REF and ALT may only contain A, C, G, T or N",
                )
            for allele in alt.split(","):
                if any(base not in VALID_BASES for base in allele):
                    return Issue(
                        code="VCF-BASE-001",
                        severity="error",
                        message="VCF invalid bases detected",
                        suggestion="REF and ALT may only contain A, C, G, T or N",
                    )
        return None

    @staticmethod
    def _pos_within_declared_assembly(
        body: list[str], ctx: ValidationContext
    ) -> Issue | None:
        if not getattr(ctx, "assembly_declared", False):
            return None
        assembly = getattr(ctx, "assembly", None)
        lengths = ASSEMBLY_CONTIG_LENGTHS.get((assembly or "").lower())
        if not lengths:
            return Issue(
                code="VCF-POS-001",
                severity="skipped",
                message="VCF POS range check skipped",
                detail=f"No bundled contig lengths available for assembly {assembly}",
                suggestion="Supply reference contig lengths to enable this check",
            )
        for line in body:
            parts = line.split("\t")
            if len(parts) < 2:
                continue
            try:
                pos = int(parts[1])
            except ValueError:
                return Issue(
                    code="VCF-POS-001",
                    severity="error",
                    message="VCF POS value is not an integer",
                    suggestion="POS must be a positive integer",
                )
            limit = lengths.get(parts[0].removeprefix("chr"))
            if limit is not None and pos > limit:
                return Issue(
                    code="VCF-POS-001",
                    severity="error",
                    message="VCF POS exceeds the declared assembly contig length",
                    detail=f"POS {pos} exceeds {parts[0]} length {limit}",
                    suggestion="Check that positions match the declared assembly",
                )
        return None


# Bundled subset of reference contig lengths used for the declared-assembly
# POS check. These are published reference chromosome lengths for GRCh38 only;
# any other assembly yields a `skipped` result rather than a guess.
ASSEMBLY_CONTIG_LENGTHS: dict[str, dict[str, int]] = {
    "grch38": {
        "1": 248956422,
        "2": 242193529,
        "3": 198295559,
        "4": 190214555,
        "5": 181538259,
        "6": 170805979,
        "7": 159345973,
        "8": 145138636,
        "9": 138394717,
        "10": 133797422,
        "11": 135086622,
        "12": 133275309,
        "13": 114364328,
        "14": 107043718,
        "15": 101991189,
        "16": 90338345,
        "17": 83257441,
        "18": 80373285,
        "19": 58617616,
        "20": 64444167,
        "21": 46709983,
        "22": 50818468,
        "X": 156040895,
        "Y": 57227415,
    },
}
