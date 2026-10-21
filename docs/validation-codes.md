# Validation Codes

| Code | Severity | Description |
| --- | --- | --- |
| DOC-OK-001 | info | Document present and accessible for validation |
| DOC-MISSING-001 | error | Document not found |
| VAL-INTERNAL-001 | skipped | Validator execution skipped due to internal error |
| VCF-HEADER-001 | error | VCF header missing or missing required columns |
| VCF-GT-001 | error | VCF sample/genotype columns not parseable |
| VCF-CONTIG-001 | warning | VCF contig naming inconsistent within file |
| VCF-POS-001 | error | VCF POS out of range when assembly declared |
| VCF-BASE-001 | error | VCF invalid bases detected |
| BED-COLS-001 | error | BED requires at least 3 columns |
| BED-COORD-001 | error | BED coordinates invalid (start >= end or negative start) |
| BED-INT-001 | error | BED coordinates must be integers |
| BED-COLCONSIST-001 | warning | BED column count inconsistent across rows |
| MAT-HEADER-001 | error | Matrix header parse error |
| MAT-DUP-001 | warning | Duplicate feature IDs detected |
| MAT-NONNUM-001 | error | Non-numeric cell detected |
| MAT-SHAPE-001 | error | Matrix row/column count agreement issue |
| MAT-METH-001 | error | Methylation beta values must be in [0,1] when typed as methylation |
