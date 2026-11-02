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

## 3. Adapter interface (Story 21, planned)

Upcoming: `app/integration/adapters/` maps tool outputs into typed internal
structures (`MappedDataset`) with an explicit mapping table documented here —
this file will grow that table when Story 21 lands. Nothing today is silently
coerced: keep any unmapped field visible and listed.
