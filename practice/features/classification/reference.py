"""Reference answer: a minimal omics data type classifier.

Read the drill in README.md first — write my_classifier.py, run it, then compare.
Run:  python3 reference.py
"""

import csv
import json
from pathlib import Path

HERE = Path(__file__).parent / "samples"
METHYLATION_HINTS = ("cpg", "methyl")
EXPRESSION_HINTS = ("gene", "transcript", "symbol", "ensembl", "hgnc")
TYPED_EXTENSIONS = {".vcf": "variants", ".bed": "peaks", ".narrowpeak": "peaks"}


def rows_of(text: str) -> list[list[str]]:
    first = text.splitlines()[0] if text.splitlines() else ""
    delim = "\t" if "\t" in first else ","
    return [row for row in csv.reader(text.splitlines(), delimiter=delim)
            if row and any(c.strip() for c in row)]


def is_int(value: str) -> bool:
    return value.strip().lstrip("-").isdigit()


def classify(text: str, filename: str) -> str:
    lines = [l for l in text.splitlines() if l.strip()]
    if any(l.startswith("##") for l in lines) and any(
        l.lstrip("#").startswith("CHROM") for l in lines
    ):
        return "variants"

    rows = rows_of(text)
    # BED: first data row has integer start/end in columns 2-3.
    if len(rows[0]) >= 3:
        try:
            start, end = int(rows[0][1]), int(rows[0][2])
        except (ValueError, IndexError):
            start = end = None
        if start is not None and end is not None:
            if start < end:
                return "peaks"

    # Matrix: first row is a header; disambiguate by its first cell.
    if len(rows[0]) >= 2 and any(row[1:2] and c.strip() for row in rows[:3] for c in row[1:2] if not is_int(c)):
        first_cell = rows[0][0].strip().lower()
        if any(h in first_cell for h in METHYLATION_HINTS):
            return "methylation"
        if any(h in first_cell for h in EXPRESSION_HINTS):
            return "expression"
        # Identifier header with numeric-looking data -> expression by default.
        if any(c.strip() for c in rows[0][1:]):
            return "expression"

    ext = Path(filename).suffix.lower()
    if ext in TYPED_EXTENSIONS:
        return TYPED_EXTENSIONS[ext]
    return "document"


def main() -> None:
    for path in sorted(HERE.glob("*.*")):
        if path.suffix not in {".vcf", ".tsv", ".txt", ".bed"}:
            continue
        with open(path, encoding="utf-8") as handle:
            text = handle.read()
        print(json.dumps({"file": path.name, "data_type": classify(text, path.name)}))


if __name__ == "__main__":
    main()