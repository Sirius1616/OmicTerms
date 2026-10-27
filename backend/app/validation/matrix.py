from __future__ import annotations

from collections import Counter

from app.validation.base import Issue, ValidationContext, Validator
from app.validation.files import decode_text, read_document_bytes

MAX_CELLS_SCANNED = 100_000


class MatrixValidator(Validator):
    name = "matrix_validator"

    def applies_to(self, ctx: ValidationContext) -> bool:
        document = ctx.document
        if document is None:
            return False
        data_type = getattr(document, "data_type", None)
        data_type_value = getattr(data_type, "value", data_type)
        if data_type_value in ("expression", "methylation"):
            return True
        filename = (getattr(document, "filename", "") or "").lower()
        if filename.endswith((".tsv", ".csv", ".txt", ".matrix")):
            return True
        content = read_document_bytes(ctx)
        if content is None:
            return False
        for line in decode_text(content).splitlines():
            if not line.strip():
                continue
            return "\t" in line or "," in line
        return False

    def run(self, ctx: ValidationContext) -> list[Issue]:
        content = read_document_bytes(ctx)
        if content is None:
            return [
                Issue(
                    code="MAT-READ-001",
                    severity="error",
                    message="Matrix file could not be read for validation",
                    suggestion="Re-upload the matrix and re-run validation",
                )
            ]

        lines = [line for line in decode_text(content).splitlines() if line.strip()]
        if not lines:
            return [
                Issue(
                    code="MAT-HEADER-001",
                    severity="error",
                    message="Matrix header parse error",
                    suggestion="Provide a matrix with a header row",
                )
            ]

        header_line = lines[0]
        delimiter = "\t" if "\t" in header_line else ","
        header = header_line.split(delimiter)
        if len(header) < 2:
            return [
                Issue(
                    code="MAT-HEADER-001",
                    severity="error",
                    message="Matrix header parse error",
                    suggestion=(
                        "The header row needs a feature identifier column plus at "
                        "least one sample column"
                    ),
                )
            ]

        rows = [line.split(delimiter) for line in lines[1:]]
        if not rows:
            return [
                Issue(
                    code="MAT-SHAPE-001",
                    severity="error",
                    message="Matrix row/column count agreement issue",
                    suggestion="Provide at least one data row",
                )
            ]

        issues: list[Issue] = []

        if any(len(row) != len(header) for row in rows):
            issues.append(
                Issue(
                    code="MAT-SHAPE-001",
                    severity="error",
                    message="Matrix row/column count agreement issue",
                    detail=(
                        f"Header declares {len(header)} columns but some rows "
                        "declare a different count"
                    ),
                    suggestion="Every data row must have the same number of columns",
                )
            )
            return issues

        feature_counts = Counter(row[0] for row in rows)
        duplicates = {fid for fid, count in feature_counts.items() if count > 1}
        if duplicates:
            issues.append(
                Issue(
                    code="MAT-DUP-001",
                    severity="warning",
                    message="Duplicate feature IDs detected",
                    detail="Duplicated IDs: " + ", ".join(sorted(duplicates)[:10]),
                    suggestion="Aggregate or rename duplicated feature identifiers",
                )
            )

        is_methylation = self._is_methylation(ctx)
        scanned_cells = 0
        for row_index, row in enumerate(rows):
            for column_index, value in enumerate(row[1:], start=1):
                if scanned_cells >= MAX_CELLS_SCANNED:
                    break
                scanned_cells += 1
                cell = value.strip()
                try:
                    number = float(cell)
                except ValueError:
                    issues.append(
                        Issue(
                            code="MAT-NONNUM-001",
                            severity="error",
                            message="Non-numeric cell detected",
                            path=f"row {row_index + 2}, column {column_index + 1}",
                            suggestion="Expression and methylation matrices must be numeric",
                        )
                    )
                    break
                if is_methylation and not 0.0 <= number <= 1.0:
                    issues.append(
                        Issue(
                            code="MAT-METH-001",
                            severity="error",
                            message=(
                                "Methylation beta values must be in [0,1] when typed "
                                "as methylation"
                            ),
                            path=f"row {row_index + 2}, column {column_index + 1}",
                            suggestion="Store methylation levels as beta values in [0,1]",
                        )
                    )
                    break
            if any(issue.severity == "error" for issue in issues):
                break

        if not issues:
            issues.append(
                Issue(
                    code="MAT-OK-001",
                    severity="info",
                    message="Matrix validation completed with no errors",
                )
            )
        return issues

    @staticmethod
    def _is_methylation(ctx: ValidationContext) -> bool:
        document = ctx.document
        if document is None:
            return False
        data_type = getattr(document, "data_type", None)
        data_type_value = getattr(data_type, "value", data_type)
        if data_type_value == "methylation":
            return True
        filename = (getattr(document, "filename", "") or "").lower()
        return "methyl" in filename or "beta" in filename
