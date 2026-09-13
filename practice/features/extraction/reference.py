"""Reference answer: a minimal four-way sniffer.

Read the drill in README.md first — write my_sniffer.py, run it, then compare.
Run:  python3 reference.py
"""

import csv
import json
from pathlib import Path

HERE = Path(__file__).parent / "samples"
HEADER_HINTS = {"gene", "geneid", "gene_id", "symbol", "transcript", "probe",
                "feature", "name", "id", "cpg", "refseq", "locus"}


def is_float(value: str) -> bool:
    try:
        float(value)
        return True
    except ValueError:
        return False


def is_int(value: str) -> bool:
    return value.strip().lstrip("-").isdigit()


def rows_of(text: str) -> list[list[str]]:
    delim = "\t" if "\t" in text.splitlines()[0] else ","
    return [row for row in csv.reader(text.splitlines(), delimiter=delim)
            if row and any(c.strip() for c in row)]


def sniff(text: str) -> dict:
    lines = [l for l in text.splitlines() if l.strip()]
    if any(l.startswith("##") for l in lines[:25]) and any(
        l.startswith("#CHROM") for l in lines[:250]
    ):
        variants = [l for l in lines if not l.startswith("#")]
        return {"kind": "vcf", "variant_count": len(variants)}

    rows = rows_of(text)
    if rows and len(rows[0]) >= 3 and not is_float(rows[0][0]) \
            and rows[0][0].lower() not in HEADER_HINTS \
            and is_int(rows[0][1]) and is_int(rows[0][2]):
        return {"kind": "bed", "region_count": len(rows)}

    if rows and len(rows[0]) >= 2 and rows[0][0].lower() in HEADER_HINTS:
        return {"kind": "matrix",
                "row_count": len(rows) - 1, "col_count": len(rows[0])}

    return {"kind": "text"}


for path in sorted(HERE.glob("*")):
    print(json.dumps({"file": path.name, **sniff(path.read_text())}))