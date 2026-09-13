"""Sniffing parsers for structured omics text files.

Each parser returns a plain-JSON-serializable ``dict`` so the caller can
persist the result into ``Document.raw_extracted_json`` without importing
any model code. Stdlib only: matrices and region/variant tables are parsed
with the ``csv`` module instead of pulling in pandas.

The sniffer classifies a text blob in order of decreasing specificity:

1. VCF     ``##`` meta lines with a ``#CHROM`` column header
2. BED     at least 3 tab-separated fields, integer start/end positions
3. Matrix  an identifier header row (e.g. gene column) over numeric columns
4. text    everything else falls back to a plain-text preview

A wrong guess degrades gracefully to ``text`` rather than raising.
"""

from __future__ import annotations

import csv
from pathlib import Path

PREVIEW_ROWS = 5
READ_CAP_BYTES = 50_000_000
COLUMN_CAP = 30

MATRIX_HEADER_HINTS = {
    "gene",
    "geneid",
    "gene_id",
    "genes",
    "symbol",
    "transcript",
    "transcript_id",
    "probe",
    "probeset",
    "feature",
    "name",
    "id",
    "cpg",
    "cpgs",
    "probe_id",
    "molecule",
    "gene_name",
    "refseq",
    "locus",
}


def read_text(path: Path, cap: int = READ_CAP_BYTES) -> str:
    """Decode a file's bytes as a string, trying common encodings."""
    raw = path.read_bytes()[:cap]
    for enc in ("utf-8", "utf-16", "latin-1"):
        try:
            return raw.decode(enc)
        except (UnicodeDecodeError, ValueError):
            continue
    return raw.decode("utf-8", errors="replace")


def parse_omics(text: str) -> dict:
    """Classify a text blob and return a JSON-serializable parse result."""
    if _looks_like_vcf(text):
        return _parse_vcf(text)

    rows = _rows(text)
    if _looks_like_bed(rows):
        return _parse_bed(rows)
    if _looks_like_matrix(rows):
        return _parse_matrix(rows)

    lines = [line[:200] for line in text.splitlines()][:PREVIEW_ROWS]
    return {
        "kind": "text",
        "line_count": len(text.splitlines()),
        "char_count": len(text),
        "preview_lines": lines,
    }


def _looks_like_vcf(text: str) -> bool:
    lines = [line for line in text.splitlines() if line.strip()][:250]
    has_chrom = any(line.startswith("#CHROM") for line in lines)
    if has_chrom and not lines[0].startswith("#CHROM"):
        return True
    return lines[0].startswith("#CHROM") if lines else False


def _parse_vcf(text: str) -> dict:
    meta: list[str] = []
    header: list[str] = []
    sample_columns: list[str] = []
    variant_count = 0
    preview: list[list[str]] = []

    for raw in text.splitlines():
        line = raw.rstrip()
        if not line:
            continue
        if line.startswith("##"):
            if len(meta) < 200:
                meta.append(line)
        elif line.startswith("#CHROM"):
            header = line.lstrip("#").split("\t")
            if "FORMAT" in header:
                sample_columns = header[header.index("FORMAT") + 1 :]
        elif line.startswith("#"):
            continue
        else:
            variant_count += 1
            if len(preview) < PREVIEW_ROWS:
                preview.append(line.split("\t")[:COLUMN_CAP])

    return {
        "kind": "vcf",
        "meta_lines": meta,
        "header": header,
        "sample_columns": sample_columns,
        "variant_count": variant_count,
        "preview_rows": preview,
    }


def _rows(text: str) -> list[list[str]]:
    sample = "\n".join(text.splitlines()[:5])
    delim = "\t" if "\t" in sample else ","
    return [
        row
        for row in csv.reader(text.splitlines(), delimiter=delim)
        if row and any(cell.strip() for cell in row)
    ]


def _is_int(value: str) -> bool:
    return value.strip().lstrip("-").isdigit()


def _is_float(value: str) -> bool:
    try:
        float(value)
        return True
    except ValueError:
        return False


def _looks_like_bed(rows: list[list[str]]) -> bool:
    if not rows or len(rows[0]) < 3:
        return False
    first = rows[0]
    if not first[0].strip() or _is_float(first[0]):
        return False
    if first[0].strip().lower() in MATRIX_HEADER_HINTS:
        return False
    return _is_int(first[1]) and _is_int(first[2])


def _parse_bed(rows: list[list[str]]) -> dict:
    fields: list[list[str]] = []
    region_count = 0
    for cols in rows:
        if len(cols) >= 3 and _is_int(cols[1]) and _is_int(cols[2]):
            region_count += 1
            if len(fields) < PREVIEW_ROWS:
                fields.append(cols[:6])
    width = len(fields[0]) if fields else 0
    return {
        "kind": "bed",
        "columns": width,
        "region_count": region_count,
        "preview_rows": fields,
    }


def _looks_like_matrix(rows: list[list[str]]) -> bool:
    if len(rows) < 2 or len(rows[0]) < 2:
        return False
    header = rows[0]
    if header[0].strip().lower() in MATRIX_HEADER_HINTS:
        return True
    if not header[0].strip() or _is_float(header[0]):
        return False
    if len(header) >= 3 and _is_int(header[1]) and _is_int(header[2]):
        return False
    concise = rows[:20]
    return all(not _is_float(str(cell)) for cell in header[1:]) and any(
        _is_float(str(cell)) for row in concise[1:] for cell in row[1:]
    )


def _parse_matrix(rows: list[list[str]]) -> dict:
    header = rows[0][:COLUMN_CAP]
    data_rows = rows[1:]
    row_count = len(data_rows)
    col_count = len(rows[0])
    preview = [row[:COLUMN_CAP] for row in data_rows[:PREVIEW_ROWS]]

    numeric_columns: list[bool] = []
    for idx in range(1, min(col_count, COLUMN_CAP + 1)):
        probe = [row[idx] for row in data_rows[:20] if idx < len(row)]
        numeric_columns.append(bool(probe) and all(_is_float(str(cell)) for cell in probe))

    return {
        "kind": "matrix",
        "header": header,
        "row_count": row_count,
        "column_count": col_count,
        "numeric_data_columns": numeric_columns,
        "preview_rows": preview,
    }