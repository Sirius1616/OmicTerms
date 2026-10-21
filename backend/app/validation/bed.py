from __future__ import annotations

from pathlib import Path

from app.validation.base import Issue, ValidationContext, Validator


def _read_content(ctx: ValidationContext) -> bytes | None:
    document = ctx.document
    if document is None:
        return None
    file_url = getattr(document, "file_url", "")
    candidates = [Path(file_url)] if file_url else []
    for c in candidates:
        if c.exists() and c.is_file():
            try:
                return c.read_bytes()
            except Exception:
                continue
    return None


class BEDValidator(Validator):
    name = "bed_validator"

    def applies_to(self, ctx: ValidationContext) -> bool:
        doc = ctx.document
        if not doc:
            return False
        filename = getattr(doc, "filename", "") or ""
        if filename.lower().endswith(".bed"):
            return True
        content = _read_content(ctx)
        if content:
            try:
                text = content.decode("utf-8", errors="replace")
                # BED usually starts with chrom
                for l in text.splitlines():
                    if not l.strip() or l.startswith("#") or l.startswith("track"):
                        continue
                    parts = l.split("\t")
                    if len(parts) >= 3:
                        return True
                    break
            except Exception:
                pass
        return False

    def run(self, ctx: ValidationContext) -> list[Issue]:
        issues: list[Issue] = []
        content = _read_content(ctx)
        if content is None:
            issues.append(Issue(code="BED-COLS-001", severity="error", message="BED requires at least 3 columns"))
            return issues
        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            issues.append(Issue(code="BED-COLS-001", severity="error", message="BED requires at least 3 columns"))
            return issues
        rows = []
        for l in text.splitlines():
            if not l.strip() or l.startswith("#") or l.startswith("track") or l.startswith("browser"):
                continue
            rows.append(l.split("\t"))
        if not rows:
            issues.append(Issue(code="BED-COLS-001", severity="error", message="BED requires at least 3 columns"))
            return issues
        col_counts = set(len(r) for r in rows)
        if len(col_counts) > 1:
            issues.append(
                Issue(
                    code="BED-COLCONSIST-001",
                    severity="warning",
                    message="BED column count inconsistent across rows",
                    suggestion="Ensure consistent number of columns",
                )
            )
        for r in rows:
            if len(r) < 3:
                issues.append(Issue(code="BED-COLS-001", severity="error", message="BED requires at least 3 columns"))
                break
        if any(i.code == "BED-COLS-001" and i.severity == "error" for i in issues):
            return issues
        for r in rows:
            try:
                start = int(r[1])
                end = int(r[2])
            except Exception:
                issues.append(Issue(code="BED-INT-001", severity="error", message="BED coordinates must be integers"))
                break
            else:
                if start < 0 or start >= end:
                    issues.append(Issue(code="BED-COORD-001", severity="error", message="BED coordinates invalid (start >= end or negative start)"))
                    break
        return issues if issues else [Issue(code="DOC-OK-001", severity="info", message="BED validation completed with no errors")]
