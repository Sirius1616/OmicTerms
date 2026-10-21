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


class MatrixValidator(Validator):
    name = "matrix_validator"

    def applies_to(self, ctx: ValidationContext) -> bool:
        doc = ctx.document
        if not doc:
            return False
        filename = getattr(doc, "filename", "") or ""
        data_type = getattr(doc, "data_type", None)
        dt = getattr(data_type, "value", str(data_type)) if data_type else ""
        if dt in ("expression", "methylation"):
            return True
        if filename.lower().endswith((".tsv", ".csv", ".txt", ".matrix")) and "counts" in filename.lower():
            return True
        content = _read_content(ctx)
        if content:
            try:
                text = content.decode("utf-8", errors="replace")
                # has header with tabs/commas
                for l in text.splitlines():
                    if not l.strip():
                        continue
                    if "\t" in l or "," in l:
                        return True
                    break
            except Exception:
                pass
        return False

    def run(self, ctx: ValidationContext) -> list[Issue]:
        issues: list[Issue] = []
        content = _read_content(ctx)
        if content is None:
            issues.append(Issue(code="MAT-HEADER-001", severity="error", message="Matrix header parse error"))
            return issues
        try:
            text = content.decode("utf-8", errors="replace")
        except Exception:
            issues.append(Issue(code="MAT-HEADER-001", severity="error", message="Matrix header parse error"))
            return issues
        # detect delimiter
        first_line = None
        for l in text.splitlines():
            if l.strip():
                first_line = l
                break
        if not first_line:
            issues.append(Issue(code="MAT-HEADER-001", severity="error", message="Matrix header parse error"))
            return issues
        delim = "\t" if "\t" in first_line else ","
        header = first_line.split(delim)
        if len(header) < 2:
            issues.append(Issue(code="MAT-HEADER-001", severity="error", message="Matrix header parse error"))
            return issues
        rows = []
        for l in text.splitlines():
            if not l.strip() or l == first_line:
                continue
            rows.append(l.split(delim))
        # shape
        if len(rows) == 0:
            issues.append(Issue(code="MAT-SHAPE-001", severity="error", message="Matrix row/column count agreement issue"))
            return issues
        # check consistent columns
        for r in rows:
            if len(r) != len(header):
                issues.append(Issue(code="MAT-SHAPE-001", severity="error", message="Matrix row/column count agreement issue"))
                break
        if any(i.code == "MAT-SHAPE-001" and i.severity == "error" for i in issues):
            return issues
        # duplicates
        feats = [r[0] for r in rows]
        if len(feats) != len(set(feats)):
            issues.append(Issue(code="MAT-DUP-001", severity="warning", message="Duplicate feature IDs detected"))
        # numeric check (first N sampled conceptually - do full pass under cap but small here)
        doc = ctx.document
        dt = getattr(getattr(doc, "data_type", None), "value", str(getattr(doc, "data_type", ""))) if doc else ""
        is_meth = dt == "methylation" or "methyl" in (getattr(doc, "filename", "") or "").lower()
        for r in rows:
            for val in r[1:]:
                v = val.strip()
                # try number
                try:
                    # int or float
                    float(v)
                except Exception:
                    issues.append(Issue(code="MAT-NONNUM-001", severity="error", message="Non-numeric cell detected"))
                    break
                else:
                    if is_meth:
                        try:
                            fv = float(v)
                            if fv < 0.0 or fv > 1.0:
                                issues.append(Issue(code="MAT-METH-001", severity="error", message="Methylation beta values must be in [0,1] when typed as methylation"))
                                break
                        except Exception:
                            pass
            if any(i.severity == "error" for i in issues):
                break
        return issues if issues else [Issue(code="DOC-OK-001", severity="info", message="Matrix validation completed with no errors")]
