from __future__ import annotations

from app.validation.base import Issue, ValidationContext, Validator
from app.validation.files import decode_text, read_document_bytes

SKIPPED_PREFIXES = ("#", "track", "browser")


class BEDValidator(Validator):
    name = "bed_validator"

    def applies_to(self, ctx: ValidationContext) -> bool:
        document = ctx.document
        if document is None:
            return False
        filename = (getattr(document, "filename", "") or "").lower()
        if filename.endswith(".bed"):
            return True
        content = read_document_bytes(ctx)
        if content is None:
            return False
        for line in decode_text(content).splitlines():
            if not line.strip() or line.startswith(SKIPPED_PREFIXES):
                continue
            return len(line.split("\t")) >= 3
        return False

    def run(self, ctx: ValidationContext) -> list[Issue]:
        content = read_document_bytes(ctx)
        if content is None:
            return [
                Issue(
                    code="BED-READ-001",
                    severity="error",
                    message="BED file could not be read for validation",
                    suggestion="Re-upload the BED file and re-run validation",
                )
            ]

        rows = [
            line.split("\t")
            for line in decode_text(content).splitlines()
            if line.strip() and not line.startswith(SKIPPED_PREFIXES)
        ]
        if not rows:
            return [
                Issue(
                    code="BED-COLS-001",
                    severity="error",
                    message="BED file contains no interval rows",
                    suggestion="Provide a BED file with chrom, start and end columns",
                )
            ]

        issues: list[Issue] = []

        if any(len(row) < 3 for row in rows):
            return [
                Issue(
                    code="BED-COLS-001",
                    severity="error",
                    message="BED requires at least 3 columns",
                    suggestion="Every BED row needs chrom, start and end",
                )
            ]

        column_counts = {len(row) for row in rows}
        if len(column_counts) > 1:
            issues.append(
                Issue(
                    code="BED-COLCONSIST-001",
                    severity="warning",
                    message="BED column count inconsistent across rows",
                    suggestion="Keep the number of columns identical on every row",
                )
            )

        for index, row in enumerate(rows):
            try:
                start = int(row[1])
                end = int(row[2])
            except ValueError:
                issues.append(
                    Issue(
                        code="BED-INT-001",
                        severity="error",
                        message="BED coordinates must be integers",
                        path=f"row {index + 1}",
                        suggestion="Use integer genomic coordinates",
                    )
                )
                break
            if start < 0 or start >= end:
                issues.append(
                    Issue(
                        code="BED-COORD-001",
                        severity="error",
                        message="BED coordinates invalid (start >= end or negative start)",
                        path=f"row {index + 1}",
                        suggestion="BED intervals require 0 <= start < end",
                    )
                )
                break

        if not issues:
            issues.append(
                Issue(
                    code="BED-OK-001",
                    severity="info",
                    message="BED validation completed with no errors",
                )
            )
        return issues
