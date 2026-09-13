# Drill — extraction: sniffing bytes into a typed parse

## Concept
A stored file is just bytes. Before any analysis, code must decide what the
bytes *are*: a PDF, a VCF variant table, a count matrix, or plain prose.
The sniffer classifies in order of specificity — VCF meta lines, then BED
integer start/end columns, then a matrix header over numeric columns — and
every failure degrades gracefully to "text" instead of raising.

## Files
- `samples/regions.vcf` — a tiny 2-variant VCF
- `samples/counts.tsv` — a gene × sample count matrix
- `samples/note.txt` — plain prose, no structure
- `reference.py` — the reference answer. **Don't read it until you're done.**

## Your drill
Write `my_sniffer.py` in this directory. It must read each sample file and
print a JSON object, e.g.:
```
{"file": "regions.vcf", "kind": "vcf", "variant_count": 2}
```
Rules so the check passes:
1. Classify order: VCF → BED → matrix → text.
2. BED needs ≥3 tab-separated columns with integer positions in columns 2-3.
3. Matrix needs a header row whose first cell is an identifier (e.g. `gene`)
   and whose other cells are non-numeric sample names.
4. Never crash on a weird file — unknown shape means `"kind": "text"`.

Stick to the stdlib (`csv`, `pathlib`). No pandas. ~5 minutes.

## Check
Run `python3 my_sniffer.py` on each sample. Then run the reference:

```
python3 reference.py
```

Your output must match the reference for all three files (kind + counts).
Then debug any mismatch and re-run.

## Mastered when
You can re-type `sniff` from a blank file in under a minute, with the four-way
classify order and the "never raise, fall back to text" rule.