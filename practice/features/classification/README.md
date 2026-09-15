# Drill — classification: turning a parsed document into a data type

## Concept
Extraction tells you the *shape* of the bytes (vcf / bed / matrix / text).
Classification takes that one step further: it tags the document with an omics
**data type** — `expression`, `methylation`, `variants`, `peaks`, `document` —
so the right analysis pipeline can run later. The interesting case is a
matrix: on its own it is ambiguous. A first header cell of `gene` means
expression; `cpg` means methylation. Auto-detection is just a header grep plus
a filename-extension fallback; when nothing matches, the safe default is
`document`.

## Files
- `samples/regions.vcf` — tiny VCF → `variants`
- `samples/counts.tsv` — gene × sample matrix → `expression`
- `samples/met.tsv` — cpg × sample matrix → `methylation`
- `samples/peaks.bed` — BED intervals → `peaks`
- `samples/note.txt` — plain prose → `document`
- `reference.py` — the reference answer. **Don't read it until you're done.**

## Your drill
Write `my_classifier.py` in this directory. It must read each sample file and
print exactly one JSON line per file, e.g.:
```
{"file": "regions.vcf", "data_type": "variants"}
```
Rules so the check passes:
1. Classify by content first: VCF → `variants`, BED → `peaks`.
2. Matrix: read the first header cell. If it starts with or contains `cpg` or
   `methyl` → `methylation`; if it contains `gene` / `transcript` / `symbol` →
   `expression`; otherwise a numeric matrix defaults to `expression`.
3. Fall back to the filename extension for plain text (`.vcf` → `variants`,
   `.bed` → `peaks`).
4. Everything else → `document`. Never crash.

Stick to the stdlib (`csv`, `pathlib`). No pandas. ~5 minutes.

## Check
Run `python3 my_classifier.py`. Then run the reference:

```
python3 reference.py
```

Your output must match the reference for all five files. Debug mismatches,
then re-run. Extra stretch: what happens for a CSV with no header row? Decide
a rule and keep it consistent with rule 2.

## Mastered when
You can re-type `classify` from a blank file in under a minute, including the
matrix-header disambiguation and the "safe default is document" rule.