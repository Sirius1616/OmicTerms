# Validation Codes

Validation runs are composed of ordered validators. Each validator returns zero
or more issues. A validator that raises is isolated: the run continues and the
failure is recorded as a `skipped` issue with `VAL-INTERNAL-001`.

| Code | Severity | Description |
| --- | --- | --- |
| DOC-OK-001 | info | Document present and accessible for validation |
| DOC-MISSING-001 | error | Document not found |
| META-ASSEMBLY-001 | info | Genome assembly is declared for the dataset |
| META-ASSEMBLY-002 | skipped | Assembly-dependent checks skipped because assembly is not declared |
| VAL-INTERNAL-001 | skipped | Validator execution skipped due to internal error |
| VCF-READ-001 | error | VCF bytes could not be read from storage |
| VCF-OK-001 | info | VCF validation completed with no errors |
| VCF-HEADER-001 | error | VCF header missing or missing required columns |
| VCF-GT-001 | error | VCF sample/genotype columns not parseable |
| VCF-CONTIG-001 | warning | VCF contig naming inconsistent within file |
| VCF-POS-001 | error | VCF POS out of range when assembly declared |
| VCF-BASE-001 | error | VCF invalid bases detected |
| BED-READ-001 | error | BED bytes could not be read from storage |
| BED-OK-001 | info | BED validation completed with no errors |
| BED-COLS-001 | error | BED requires at least 3 columns |
| BED-COORD-001 | error | BED coordinates invalid (start >= end or negative start) |
| BED-INT-001 | error | BED coordinates must be integers |
| BED-COLCONSIST-001 | warning | BED column count inconsistent across rows |
| MAT-READ-001 | error | Matrix bytes could not be read from storage |
| MAT-OK-001 | info | Matrix validation completed with no errors |
| MAT-HEADER-001 | error | Matrix header parse error |
| MAT-DUP-001 | warning | Duplicate feature IDs detected |
| MAT-NONNUM-001 | error | Non-numeric cell detected |
| MAT-SHAPE-001 | error | Matrix row/column count agreement issue |
| MAT-METH-001 | error | Methylation beta values must be in [0,1] when typed as methylation |
| CROSS-APPLICABLE-001 | info | Cross-file checks not applicable (fewer than two documents) |
| CROSS-OK-001 | info | Cross-file checks completed with no issues |
| CROSS-SAMPLE-001 | warning | Sample identifier mismatch across files (near-match) |
| CROSS-SAMPLE-002 | error | Sample identifier mismatch across files |
| CROSS-DUP-001 | info | Identical file re-uploaded for same sample and data type |
| CROSS-DUP-002 | warning | Multiple different files for same sample and data type |
| CROSS-ASSEMBLY-001 | error | Assembly mismatch across files in experiment |
| CROSS-ID-NS-001 | warning | Mixed identifier namespaces across matrices |
| CROSS-IO-001 | skipped | Input/output compatibility checks skipped (requires AnalysisRun) |
