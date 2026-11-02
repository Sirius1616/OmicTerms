# Adapters & Registry

How OmicTerms's integration surface grows without breaking its promise of
traceability — three moving pieces, in read order: the **registry** (what is
claimed), the **pipeline** (what actually runs), and the **CI truth check**
(that the two agree).

## 1. Registry (Story 20)

The tool and format registry is the queryable source of truth for supported
and planned integration surface. Endpoints (both require a session, both are
paginated, both expose metadata only):

- `GET /api/v1/registry/tools?status=supported|planned|experimental`
- `GET /api/v1/registry/formats`

Rows are seeded from `backend/app/services/registry_seed.py`:

- the Alembic migration `v4b7d8e0f2h6` bulk-inserts the same rows at upgrade;
- the endpoints self-seed on first read in a fresh deployment (idempotent);
- a fresh SQLite CI run seeds via `seed_registry(session)`.

### Adding a row

1. append the row to `FORMATS` / `TOOLS` in `backend/app/services/registry_seed.py`;
2. ship it inside a new Alembic migration that creates/extends seed data
   (copy the bulk-insert pattern of `v4b7d8e0f2h6`);
3. run the backend suite — the truth-check test enforces that nothing is
   claimed as `supported` unless the pipeline can really exercise it.
   No code change is needed beyond the seed/migration itself.

### Status semantics

| Status | Meaning | Verification |
| --- | --- | --- |
| `supported` | A parser/dispatch path exists and is exercised by tests. | `test_registry_matches_extraction_reality` fails if a `supported` row claims a parser or extension the extraction pipeline does not handle. |
| `planned` / `experimental` | Visible promise only. | Rows must not fake capabilities: the test asserts planned rows carry no invented input formats or mapping ids. |

## 2. Pipeline ground truth (extractors today)

`backend/app/services/extraction.py` exposes the constants the registry is
checked against:

- `SUPPORTED_PARSER_IDS` — `pdf`, `image` (OCR), `docx` (also wrapped in
  ZIP), `email`, `text`, and the omics sniffers `vcf`, `bed`, `matrix`;
- `SUPPORTED_EXTENSIONS` — `.pdf .png .jpg .jpeg .docx .eml .zip .txt .tsv
  .csv .vcf .bed`.

Adding a parser means: implement it in `extract_text`, extend the constants,
extend the seed, and run the suite.

## 3. Adapter interface (Story 21)

`backend/app/integration/adapters/` is the extension point. One adapter,
`OmicsAdapter` (mapping id `extraction-pipeline:v1`), owns the text omics
family behind the adapter protocol (`sniff` → confidence in [0, 1],
`parse` → `MappedDataset`, `describe` → registry mapping id).

`omics_parser.parse_omics` keeps its legacy JSON structure
(`MappedDataset.source` is the same dict, byte-for-byte), which keeps
existing extraction/validation flows stable; new consumers go through the
API and get typed `records` plus metadata in the additive `__meta`
envelope inside `raw_extracted_json`:

```json
"__meta": {
  "adapter_id": "extraction-pipeline:v1",
  "parser_id": "matrix",
  "parser_version": "1.0",
  "dataset_kind": "expression"
}
```

Validators read `__meta` as metadata and keep parsing files as their own
surface (format bytes stay the primary source — the envelope is optional
colour, never required).

### Mapping table — OmicsAdapter (`extraction-pipeline:v1`)

Records are capped (`RECORD_CAP = 100` rows; 1000 variants) — large files
keep their totals in `source`, previews live in `records`. Nothing is
coerced and nothing is dropped silently: every unmapped value remains
verbatim in `raw`.

| Family | Source column | Internal field | Mapping note |
| --- | --- | --- | --- |
| VCF | `CHROM` | `VariantRecord.chrom` | 1-based pos documented in `coordinate_meta` |
| VCF | `POS` | `VariantRecord.pos` | `int | None`; invalid stays `None`, raw keeps the text |
| VCF | `ID` | `IdentifierNamespace` | rule-ordered namespace detection |
| VCF | `REF`/`ALT` | `VariantRecord.ref`/`.alt` | string-verbatim |
| VCF | `FORMAT`, sample columns, `INFO`, `QUAL`, `FILTER` | — (raw only) | **unmapped by design**: format-additive consumers (Story 25) will add explicit mappings |
| BED | col 1 | `IntervalRecord.chrom` | 0-based half-open documented |
| BED | col 2/3 | `start`/`end` | ints (parser guarantees) |
| BED | col 4-6 | — (raw only) | name/score/strand unmapped |
| Matrix | col 1 | `identifier` + `IdentifierNamespace` | `cpg_probe` → methylation kind, otherwise `expression` |
| Matrix | col ≥2 | `values[sample_id]` | string-verbatim; numeric coercion is a consumer decision |

`Identifiers` are never fabricated: unmatched tokens report `unknown` with
the rule trace in `evidence`. Registering a new adapter is one
`register_adapter(...)` call — no core code changes (AC4 tests in
`tests/unit/test_adapters.py`).
