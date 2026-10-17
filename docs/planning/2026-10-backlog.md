# OmicTerms — Implementation Backlog (dependency-ordered)

Companion docs: `2026-10-audit-and-architecture.md` (audit, architecture, milestones, risks), `2026-10-story-1-ui-redesign.md` (Story 1 full spec). Each `<!-- ISSUE -->` block below is one GitHub issue. Story 1 is mandatory-first; all later stories are ordered by dependency and value. Milestones: **M1** UI review · **M2** research workflow foundations · **M3** evidence/integration/reporting · **M4** Academy.

<!-- ISSUE: labels=epic:design-system|milestone:M1|priority:high|size:XL|type=feature|frontend|body_file=docs/planning/2026-10-story-1-ui-redesign.md -->
### Story 1 — Implement the OmicTerms Professional UI Redesign and Design System

Full specification lives in `docs/planning/2026-10-story-1-ui-redesign.md` (issue body includes it verbatim).

- **Purpose:** Deliver a reviewable, token-driven dark design system, two-area application shell, and reference-driven dashboard that preserves all existing backend flows.
- **Problem:** The current dashboard is ~80% decoration with no research/learning hierarchy, broken dark-mode badges, unloaded fonts, and no space for the product's real metrics.
- **Scope:** tokens + typography, shell (sidebar groups, header, footer, breadcrumbs), global search (documents only), notifications/help surfaces (honest empty states), dashboard panels (welcome, 5 metric cards, evidence map presentation, key findings, evidence quality + recent files, activity timeline, quick actions, Academy strip), dev-fixture framework, dark-theme defect fixes (D8–D12), responsive + a11y baseline, Playwright shell/dashboard specs, manual M1 review checklist.
- **Data honesty:** real endpoints only (`/users/me`, `/documents/`, `/projects/`); findings/validation/learning = empty states or dev fixtures with a visible badge; disabled quick actions carry reasons.
- **Dependencies:** none. **Blocks:** 6–12, 29, 31, 33, 37, 43, 53, 56.
- **Priority / size:** P0 · XL. **Milestone:** M1 (owner visual-review gate).
- **Out of scope:** any backend work, real validation/findings/learning data, documents/settings/admin/auth overhauls, mock replacement (Story 43), visual-regression CI (Story 9).

---

<!-- ISSUE: labels=epic:foundations|milestone:M2|priority:high|size:S|type=bug|backend -->
### Story 2 — Backend defect fixes (auth route order, config & token hygiene)

- **Purpose:** Repair verified backend defects before building on top of them.
- **Problem:** `PATCH /users/me` is shadowed by `PATCH /users/{user_id}` (registration order), password-reset tokens never verify their `purpose` claim, `enable_email` returns a tuple, and `scripts/tests-start.sh` calls a missing file.
- **Context:** `app/api/routes/users.py:80` vs `:103`, `app/utils.py` (`validate_password_reset_token`), `app/core/config.py` (`enable_email`), `backend/scripts/tests-start.sh`.
- **Scope:** reorder routes so `/me` variants register before `/{user_id}`; verify `purpose == "password_reset"` on reset-token validation (and reject others); make `enable_email` a real bool; point `tests-start.sh` at `app/backend_pre_start.py` or remove the step; delete stray empty `backend/main.py`.
- **Functional requirements:** all `/users/me` PATCH flows work for normal users; a chat/AI-purpose token can never be redeemed as a password reset; no behaviour change to other endpoints.
- **Acceptance criteria:** (1) `PATCH /api/v1/users/me` with a valid user token returns 200 and updates name/email — regression-tested; (2) `PATCH /api/v1/users/me` as non-admin is not 422; (3) a JWT signed with `purpose="other"` fails `POST /reset-password` with 400/401; (4) `settings.enable_email` is `bool` (type-asserted in a test); (5) `bash scripts/tests-start.sh` no longer references missing files; (6) full existing pytest suite still passes.
- **API/DB:** no schema change; endpoint behaviour corrected (this is a bug fix to an advertised contract).
- **Security:** closes a token-confusion path on password reset; keeps admin-only update semantics on `/users/{user_id}` (add test proving non-admin PATCH `/users/{uuid}` → 403).
- **Testing:** new pytest integration tests using a test client (introduced by Story 3 — if Story 3 not merged yet, land these tests with Story 3; coordinate: this story's ACs are verified in Story 3's harness).
- **Dependencies:** none (parallel with Story 1). **DoD:** merged, tests green, D1/D2/D3/D13 marked fixed in audit doc.
- **Priority / size:** P0 · S. **Out of scope:** refresh tokens, cookie migration (Story 46), other refactor.

---

<!-- ISSUE: labels=epic:foundations|milestone:M2|priority:high|size:M|type=chore|backend -->
### Story 3 — Backend test harness and coverage floor

- **Purpose:** Turn the empty test scaffolding into a working integration-test harness so every later backend story can be tested.
- **Problem:** `tests/conftest.py` and all `tests/api/**`, `tests/crud/**`, `tests/utils/**` are empty; there is zero API coverage; no pytest configuration exists.
- **Scope:** pytest config in `pyproject.toml` (testpaths, markers `unit/integration`); `conftest.py` providing: function-scoped Postgres test DB (schema create/drop or transaction rollback), `TestClient` with overridden `get_session`, seeded fixtures (superuser, normal user, project/experiment/sample, uploaded document with tiny fixture files reusing `app/services/*` fixtures); move the two existing unit suites under `tests/unit/` without changing assertions; port empty `test_users.py`/`test_login.py` to real coverage of auth + ownership walks (including Story 2 ACs); delete stale `test_items.py`/`tests/utils/item.py`.
- **Acceptance criteria:** (1) `bash scripts/test.sh` runs green locally with only Docker/Postgres up; (2) integration tests cover: signup→login→me, admin CRUD, project/experiment/sample CRUD + ownership denial across users (403/404), document upload success + magic-byte rejection + size rejection, file serving authz; (3) `pytest -m unit` runs without a database; (4) no test writes outside the test DB; (5) coverage report generated (floor not yet enforced).
- **API/DB:** test-only code; no production change.
- **Security/Integrity:** codifies authorization expectations (cross-user access denied) as executable regression tests.
- **Dependencies:** Story 2 (its ACs land here); parallel with Story 1. **DoD:** `scripts/test.sh` green; scaffolding empties deleted or implemented.
- **Priority / size:** P0 · M. **Out of scope:** coverage gates in CI (Story 5), frontend tests (Story 4).

---

<!-- ISSUE: labels=epic:foundations|milestone:M2|priority:medium|size:M|type=chore|frontend -->
### Story 4 — Frontend test-suite repair and dead-code cleanup

- **Purpose:** Make the existing Playwright suite truthful before the UI changes multiply.
- **Problem:** `items.spec.ts` targets a route that doesn't exist; `login.spec.ts` expects removed "Welcome back…" dashboard copy; `admin.spec.ts` expects "Is superuser?"/"Superuser" wording that is now "Is admin?"/"Admin"; unused code (`useCopyToClipboard`, `ui/alert.tsx`, `ui/button-group.tsx`, unused `react-error-boundary`, unused `UploadsService` path) drifts silently.
- **Scope:** delete `items.spec.ts` + dead test utils; fix or remove stale assertions (coordinate with Story 1 for dashboard/login copy assertions); inventory-and-remove confirmed-unused source files/dependencies (keep shadcn primitives only if imported or trivially restorable — record keep/remove list in PR); remove `next-themes` if Story 1 confirmed it unused; revoke blob object URLs fix (D14) and align `PendingDocuments` skeleton to 6 columns.
- **Acceptance criteria:** (1) `bunx playwright test` runs only specs that reference existing routes/selectors; (2) full Playwright suite green against seeded stack; (3) removed packages absent from `package.json` and `bun run build` passes; (4) no `console` warnings about missing providers in app flows; (5) a PR checklist documents every removed file.
- **Dependencies:** Story 1 (for copy assertions) — can partially land before. **DoD:** green suite; dead-code list recorded.
- **Priority / size:** P1 · M. **Out of scope:** new feature tests (Story 60), visual regression (Story 9).

---

<!-- ISSUE: labels=epic:foundations|milestone:M2|priority:high|size:M|type=chore -->
### Story 5 — CI pipeline (lint, typecheck, tests, migration check)

- **Purpose:** Enforce quality gates on every push/PR; none exist today (`.github/` absent).
- **Scope:** GitHub Actions workflow: backend job (uv sync, `ruff check`, `mypy app`, `scripts/test.sh` against Postgres service container, `alembic upgrade head` on empty DB); frontend job (`bun install`, `biome check`, `bun run build`, optionally Playwright with stack — start as smoke job, full E2E in Story 60); job for the hardcoded-colour grep rule (excluding `src/fixtures/**`, `src/index.css`); cache uv/bun; fail-fast off; badge in README (README rewrite is Story 62 — add badge only).
- **Acceptance criteria:** (1) PR pipeline runs all listed checks and blocks merge on failure; (2) pipeline green on `main` with current code; (3) migration check proves migrations apply to a clean Postgres; (4) colour-literal rule active; (5) Playwright job optional/`continue-on-error` until Story 60 if flaky — explicitly documented.
- **Dependencies:** Stories 3, 4. **DoD:** green badge on `main`; gates documented in `docs/contributing.md` (Story 62 extends).
- **Priority / size:** P0 · M. **Out of scope:** deploy pipelines (Story 61), coverage thresholds (Story 62 may add).

---

<!-- ISSUE: labels=epic:design-system|milestone:M2|priority:medium|size:M|type=feature|frontend -->
### Story 6 — Redesign authentication pages in the new design system

- **Purpose:** Bring login/signup/recover/reset into the Story 1 design language without changing auth flows.
- **Context:** `routes/{login,signup,recover-password,reset-password}.tsx`, `Common/AuthLayout.tsx` (hardcoded hex gradient D9), existing RHF+zod forms.
- **Scope:** restyle AuthLayout to tokens (deep navy surfaces, restrained motif, product descriptor "Your genome, explained — and learnable"); consistent `PageHeader`-less centered card; error/success/loading/disabled states per Story 1 conventions; keep endpoints, validation rules, redirect logic identical; accessible labels/focus.
- **Acceptance criteria:** (1) all four pages pass axe spot-check; (2) no hardcoded colour literals; (3) existing Playwright `login/sign-up/reset-password` specs green (selectors updated only where markup requires, behaviour asserted unchanged); (4) light theme usable; (5) 390 px width usable without horizontal scroll.
- **Dependencies:** Story 1. **Security:** unchanged auth semantics; no token handling changes.
- **Priority / size:** P1 · M. **Out of scope:** password-policy changes, email template redesign, cookie migration (46).

---

<!-- ISSUE: labels=epic:design-system|milestone:M2|priority:high|size:L|type=feature|frontend -->
### Story 7 — Redesign Documents list, detail, and upload flows

- **Purpose:** The product's core screens must match the new design system and fix known UX defects, preserving the working flows.
- **Context:** `routes/_layout/documents*.tsx`, `components/Documents/*`, `components/DataTable.tsx`, `Pending/PendingDocuments.tsx`.
- **Scope:** apply Story 1 tokens/components (PageHeader, StatusBadge, DataTypeBadge, EmptyState, Panel); table: density, sticky header, column alignment, mobile horizontal-scroll affordance, fix raw `<a href="Open">` → Router `Link`; upload dialog: drop-zone affordance (still click-to-browse), progress via `XMLHttpRequest` or indeterminate bar (upload has no progress API today — use indeterminate + success/fail), keep inline entity creation + data-type select; detail page: header with breadcrumb to sample path, viewer panel (fix object-URL revocation), explanation/chat panels keep current mock behaviour but restyle + label them "Preview — explanation service arrives M3" honestly; delete/rename confirmations per Story 1 conventions.
- **Acceptance criteria:** (1) documents list shows all columns with token colours in dark+light; (2) upload → list reflects new document within refresh, status badge animates pending→success (existing extraction); (3) rename/delete flows work unchanged with confirm-on-destructive; (4) detail page keyboard-accessible; (5) no mock deepened — chat/explanation still return their documented mock values and say so; (6) Playwright: new `documents.spec.ts` covering list→upload→detail→rename→delete happy path green; (7) 390/768/1280/1920 px checks pass.
- **API/DB:** none (existing endpoints only).
- **Dependencies:** Story 1. **DoD:** merged with spec above; Story 7 owner confirms upload regression tests pass.
- **Priority / size:** P0 · L. **Out of scope:** multi-file upload, real explanations/chat (41/43), validation UI (19), file-size display (API lacks it — note for Story 14).

---

<!-- ISSUE: labels=epic:design-system|milestone:M2|priority:medium|size:S|type=feature|frontend -->
### Story 8 — Redesign Settings and Admin pages

- **Purpose:** Consistency for the remaining authenticated surfaces.
- **Context:** `routes/_layout/{settings,admin}.tsx`, `components/{UserSettings,Admin}/*`, tabs, `DataTable`.
- **Scope:** PageHeader + tabs restyle; admin table badges via StatusBadge; forms per Story 1 states; fix the dead `tabsConfig.slice(0,3)` no-op (D: settings.tsx) — either remove or restore intended admin tab; confirm the `(user as { is_admin?: boolean })` casts resolve against generated types (fix typing, not behaviour).
- **Acceptance criteria:** (1) profile edit, password change, delete-account confirm, admin CRUD all function per existing Playwright specs (green); (2) keyboard nav complete; (3) no hardcoded colours; (4) admin gate visible only for admins (existing rule preserved).
- **Dependencies:** Story 1. **Security:** unchanged admin semantics; delete-account confirmation remains mandatory.
- **Priority / size:** P1 · S. **Out of scope:** role model changes, pagination upgrade for users list.

---

<!-- ISSUE: labels=epic:hardening|milestone:M2|priority:medium|size:M|type=chore|frontend -->
### Story 9 — Visual regression and accessibility tooling

- **Purpose:** Make the Story 1 "manual-only" visual gate repeatable.
- **Scope:** add `@axe-core/playwright`; axe assertions on `/`, `/documents`, `/login` (fail on serious/critical); Playwright screenshot baselines (chromium, fixed viewport 1440×900, theme dark) for shell+dashboard+documents list; store baselines in repo; CI job (or local `bun run test:visual`) documented; document known intentional diffs policy (baselines regenerated only via reviewed PR).
- **Acceptance criteria:** (1) axe violations ≥ serious fail the suite; (2) screenshot diff job green on `main`; (3) an intentional UI change flow documented (one command to regenerate + review); (4) Story 1 manual checklist reduced to items tooling can't cover.
- **Dependencies:** Stories 1, 5. **DoD:** both gates active in CI.
- **Priority / size:** P1 · M. **Out of scope:** cross-browser matrix, per-pixel perfection on animated surfaces (snapshot after `animations: disabled`).

---

<!-- ISSUE: labels=epic:workspace|milestone:M2|priority:high|size:L|type=feature|frontend -->
### Story 10 — Project / Experiment / Sample management UI

- **Purpose:** The hierarchy can only be created inside the upload dialog today; researchers need to browse, rename, and delete it.
- **Context:** full CRUD API exists (`/projects`, `/experiments`, `/samples`); frontend has read wrappers only for the tree.
- **Scope:** `/projects` page: tree table/cards (project → experiments → samples counts, created date, actions); create project; per-level rename (PATCH) and delete with cascade-warning confirmation ("deletes N experiments, M samples, K documents"); detail view per project (documents filtered by project via existing document list `search`/client filter — use ownership names already on `DocumentPublic`); empty/loading/error states; hooks in `services/hierarchy.ts` for read/update/delete; server-side invalidation of `["hierarchy"]`, `["projects"]`, `["documents"]`.
- **Acceptance criteria:** (1) create→rename→delete each level works and reflects in upload dialog immediately after invalidation; (2) delete confirmation states exact cascade counts (fetched from tree); (3) cross-user project returns 404/403 and UI shows error state (backend already enforces); (4) tree keyboard-navigable (expand/collapse with aria-expanded); (5) Playwright CRUD flow green; (6) breadcrumbs on detail views.
- **API/DB:** none new (uses existing endpoints; add tests in Story 3 harness for cascade counts if absent).
- **Security:** server-side ownership re-verified by API; UI never assumes access.
- **Dependencies:** Stories 1, 7 (page patterns). **DoD:** hierarchy fully manageable without upload.
- **Priority / size:** P0 · L. **Out of scope:** bulk import, permissions sharing between users, project-level metadata.

---

<!-- ISSUE: labels=epic:workspace|milestone:M2|priority:medium|size:M|type=feature|frontend -->
### Story 11 — Global search (documents and projects)

- **Purpose:** One place to find files and research content; grows into cross-entity search.
- **Context:** `readDocuments` already accepts `search` (SQLModel `Filter`); projects list can be filtered client-side (dataset sizes are small for now).
- **Scope:** header `GlobalSearch` opens a command-style panel (reusable dialog, ⌘K/Ctrl+K); sections: Documents (server `search`), Projects (client filter), plus a scoped note "Findings, genes, and samples arrive with the evidence graph (M3)"; keyboard nav (arrows/Enter/Esc); empty + loading + error states; result click navigates (documents → detail, projects → detail).
- **Acceptance criteria:** (1) typing ≥2 chars shows debounced (250 ms) document results from the API within one request per pause; (2) project results filter correctly; (3) placeholder states for future sources visible and honest; (4) full keyboard operation; (5) panel accessible from every authenticated page; (6) Playwright spec covers open→type→navigate.
- **API/DB:** none (verify server `search` matches filename; if it only matches other fields, document actual behaviour in the panel subtitle — do not change backend here).
- **Dependencies:** Stories 1, 10. **Priority / size:** P1 · M. **Out of scope:** full-text of extracted content, gene/variant search, backend search indexing.

---

<!-- ISSUE: labels=epic:workspace|milestone:M2|priority:low|size:S|type=feature|frontend -->
### Story 12 — Notifications and contextual help surfaces

- **Purpose:** Ship the shell affordances now with honest states, so later stories only fill them.
- **Scope:** finalize `NotificationsBell` (Story 1 placeholder) behind a `NotificationItem` type; `HelpMenu` gains contextual per-route topic (e.g., on `/documents`: "How upload validation works" → docs anchor) — content is static Markdown bundled in-repo (`src/content/help/*.md`); mark docs-links that don't exist yet as disabled; wire a simple in-app toast→notification conversion only for existing app events (upload success/failure) — client-side only, no persistence.
- **Acceptance criteria:** (1) bell lists current-session toasts (upload outcome) and clears on read; (2) help topic changes per route; (3) no fake system notifications; (4) a11y: `aria-live` on bell count, menu keyboard support; (5) Story 1 empty state remains when no session events.
- **API/DB:** none. **Dependencies:** Story 1. **Priority / size:** P2 · S. **Out of scope:** server-side notifications, email digests.

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M2|priority:high|size:L|type=feature|backend -->
### Story 13 — Durable extraction jobs with status polling

- **Purpose:** Extraction currently runs in-process `BackgroundTasks` — lost on restart, no retry, no visibility.
- **Context:** `routes/documents.py` enqueue, `services/extraction_job.py`, `ExtractionStatus` enum already on `Document`.
- **Scope (⚖ decision: job table + in-process asyncio poller, no Redis):** new `ExtractionJob` table (id, document_id FK, status pending/running/succeeded/failed, attempts, last_error, started/finished_at); upload creates job row and schedules runner; runner claims jobs (status CAS), retries up to 3 with backoff, updates document + job; periodic in-process poller started on FastAPI lifespan recovers `pending` jobs after restart; new endpoints `GET /documents/{id}/jobs` (history) and `GET /jobs/stats` (admin) — additive; structured logging with job ids.
- **Acceptance criteria:** (1) upload yields a job record retrievable at `GET /documents/{id}/jobs`; (2) killing the server mid-pending and restarting results in job completion (poller recovery) — integration-tested with a monkeypatched slow extractor; (3) failures set `failed` with `last_error` and never leave status `pending` > retry window; (4) document `extraction_status` remains the single UI-facing status (no double source of truth); (5) concurrent uploads process without cross-talk (per-job session); (6) no regression in Story 7 upload tests.
- **API/DB:** Alembic migration (additive: new table); regenerate OpenAPI client.
- **Security:** jobs are tenant-scoped — job listing requires ownership via document walk; poller ignores other users' docs by construction.
- **Dependencies:** none (parallel with Story 1). **DoD:** migration + endpoints + tests + docs note in backend README (Story 62).
- **Priority / size:** P0 · L. **Out of scope:** Celery/Redis, progress percentages (job granularity is document-level), xlsx support.

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M2|priority:high|size:M|type=feature|backend -->
### Story 14 — Upload integrity: SHA-256 checksums and size provenance

- **Purpose:** Later validation, dedup, and provenance need trustworthy file identity.
- **Scope:** compute SHA-256 while streaming upload (below the 10 MiB cap; enforce cap during stream, not after); store `sha256` + `size_bytes` on `Document` (nullable→backfill not possible for prior rows — keep nullable, document); expose in `DocumentPublic`; add `GET /documents/?sha256=` dedup hint (returns existing docs same user); upload rejects nothing on hash failure (it can't fail) but records errors; expose size+hash in documents list/detail (Story 7/1 UI consumes: size column finally real).
- **Acceptance criteria:** (1) new uploads show exact byte size and 64-hex checksum via API; (2) same file re-uploaded by same user → dedup hint endpoint lists prior doc (informational only, upload still allowed); (3) integrity re-hash utility `scripts/verify-uploads.py` detects tampering on a fixture (exit code 1); (4) migration additive + client regenerated; (5) performance: hashing adds no measurable latency beyond stream (measured informally, ≤50 ms for 10 MiB).
- **API/DB:** Alembic additive migration; OpenAPI regeneration.
- **Security/Integrity:** foundation for Story 15's "file integrity" check and Story 32 provenance (hash as content address).
- **Dependencies:** Story 13 optional but same migration window preferred. **DoD:** checksums live + utility + tests.
- **Priority / size:** P0 · M. **Out of scope:** virus scanning, content-addressed storage, hash-based caching.

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M2|priority:high|size:L|type=feature|backend -->
### Story 15 — Validation engine foundation (runs, severities, extensible validators)

- **Purpose:** A deterministic, testable validation layer before any integration or reporting consumes data.
- **Problem:** only upload magic bytes exist; no structured results, no severities, no revalidation.
- **Scope:** new models: `ValidationRun` (id, subject_type document/dataset/report, subject_id, trigger upload/manual/dependency, started/finished, status, validator_set_version) and `ValidationIssue` (run_id FK, code, severity enum `error|warning|info|skipped`, message, detail JSON, field/path, suggestion, dedup_key) — additive migration; validator registry pattern `app/validation/` (`Validator` protocol: `applies_to(doc) -> bool`, `run(ctx) -> list[Issue]`; registry ordered, isolated exceptions → `skipped` issue with reason); service `run_validation(subject, trigger)`; endpoints `POST /documents/{id}/validate`, `GET /documents/{id}/validations` (+ latest summary), `GET /validations/{run_id}`; ownership walk enforced; runs are append-only history; auto-trigger after extraction succeeds (hook in extraction job completion).
- **Acceptance criteria:** (1) uploading a VCF produces a run with ≥1 issue or an explicit `info` "all checks passed" record; (2) severities use the four-value taxonomy with `skipped` always carrying a reason (e.g., "assembly not declared"); (3) a validator raising does not fail the run — it yields `skipped` + logged error; (4) re-running manual validation appends a new run (history preserved, old run immutable); (5) cross-user access to validation endpoints denied; (6) pytest covers registry, run lifecycle, immutability.
- **API/DB:** additive migration + client regen; no AI in the loop (rule-based only).
- **Integrity:** validation results are computed, stored, and never editable; UI copy rules (error blocks, warning reviews) fixed here.
- **Dependencies:** 13, 14 (same ingestion window). **DoD:** engine + endpoints + tests + extension doc.
- **Priority / size:** P0 · L. **Out of scope:** actual format validators (16), cross-file (18), UI (19), AI explanation of results (41).

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M3|priority:high|size:M|type=feature|backend -->
### Story 16 — Format validators: VCF, BED, and expression/methylation matrices

- **Purpose:** The first deterministic domain checks, extending `services/omics_parser.py`.
- **Scope:** validators implementing Story 15's protocol: **VCF** — header present, required columns (`#CHROM POS ID REF ALT QUAL FILTER INFO`), GT sample columns parseable, contig naming consistency within file, POS ≤ declared reference length when assembly declared, invalid bases flagged `error`; **BED** — ≥3 columns, start<end, integer coords, ≥0 start, column-count consistency; **matrix** — header parse, duplicate feature IDs `warning`, non-numeric cells `error` (first N sampled + full pass under size cap), row/column count agreement, methylation beta values in [0,1] when typed methylation `error`; all produce codes like `VCF-HEADER-001` documented in `docs/validation-codes.md`.
- **Acceptance criteria:** (1) unit tests per code using tiny inline fixtures, including passing files that produce zero errors; (2) a malformed fixture per format yields the documented code/severity; (3) 10 MiB worst-case runs complete ≤2 s (measured in test with marker); (4) codes registered in the docs table; (5) Story 7 fixture files (VCF/BED/matrix) validate without false positives.
- **Dependencies:** Story 15. **Integrity:** deterministic only — no probabilistic claims; no assembly inference without evidence (`skipped` otherwise).
- **Priority / size:** P0 · M. **Out of scope:** reference-genome sequence validation (needs external data; Story 27 track), Pedigree/multi-sample phasing checks.

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M3|priority:high|size:M|type=feature|backend+frontend -->
### Story 17 — Dataset metadata capture (assembly, coordinates, tool, versions)

- **Purpose:** Compatibility and provenance require declared context; today none exists.
- **Scope:** new `DatasetMetadata` (1:1 document, nullable fields: genome_assembly enum/text e.g. GRCh38/hg19, coordinate_system `0-based|1-based|unknown`, source_tool name, source_tool_version, reference_database, declared_by user, recorded_at) + PUT/GET `/documents/{id}/metadata` (ownership enforced, validation: assembly pattern, coordinate system enum); UI: metadata form section on document detail (Story 7 layout slot) with per-field help; validation engine reads declared values — undeclared fields make dependent checks `skipped` with reason "assembly not declared".
- **Acceptance criteria:** (1) metadata round-trips via API and displays on detail page; (2) declaring assembly makes VCF POS-vs-length check run instead of `skipped` (integration test with GRCh38 fixture lengths table — bundled subset only); (3) invalid enum rejected 422 with field error; (4) audit event stub hook left for Story 32 (`provenance.record` optional no-op until then); (5) Playwright: fill metadata → see saved → validation history differs.
- **API/DB:** additive migration; client regen.
- **Dependencies:** 15 (integration point), 7 (UI host). **Priority / size:** P0 · M. **Out of scope:** auto-detection of assembly (would need sequence evidence; future), per-assembly full statistics.

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M3|priority:high|size:L|type=feature|backend -->
### Story 18 — Cross-file validation: sample identity and comparability

- **Purpose:** Catch the classic multi-omics failure: files that don't refer to the same samples/conditions/assembly before they're linked or reported.
- **Scope:** run-level checks within an experiment scope: (a) sample-ID consistency — identifiers in matrix columns/VCF sample fields vs declared `Sample` names (mismatch `error`, near-match case/whitespace `warning` with suggestion); (b) duplicate/conflicting files — same sample + data_type twice in one experiment `warning` (use dedup hash to distinguish identical re-upload `info`); (c) assembly compatibility across declared metadata in one experiment — mismatch `error` for linked comparisons; (d) identifier namespace conflicts (Ensembl vs symbols mixed in one matrix `warning`); (e) input/output compatibility placeholder — links to AnalysisRun inputs once Story 22 exists (implement checks that apply now; register disabled checks with `skipped` reasons for runs not yet present); UI endpoint: `POST /experiments/{id}/validate-cross` + results attached to experiment; trigger: after upload when ≥2 docs share experiment, debounced.
- **Acceptance criteria:** (1) experiment with matrix naming `Sample_A` vs declared sample `Sample-A` produces `warning` with actionable suggestion (not silent pass); (2) two assemblies linked in one experiment produce `error` naming both files; (3) single-doc experiments produce explicit `info` "cross-file checks not applicable" — never an empty implied-pass; (4) results retrievable with per-issue subject file references; (5) pytest covers matrix of cases incl. no-false-positive on consistent fixtures; (6) results feed UI (Story 19 displays them; this story ships API + tests only if 19 not yet merged).
- **API/DB:** no new tables (issues live on `ValidationRun` with `subject_type=experiment`); additive endpoints.
- **Integrity:** deterministic; suggestions never auto-applied; no silent data mutation.
- **Dependencies:** 16, 17, (22 for run-compat checks — those register as `skipped` until 22 lands). **Priority / size:** P0 · L. **Out of scope:** automatic renames/fixups, fuzzy matching beyond documented normalization (case, whitespace, dash/underscore).

---

<!-- ISSUE: labels=epic:ingestion-validation|milestone:M3|priority:high|size:M|type=feature|frontend -->
### Story 19 — Validation results UI (document detail + revalidation)

- **Purpose:** Make validation legible: what was checked, what failed, why it matters, what to do.
- **Scope:** on document detail (Story 7 layout): "Data integrity" tab/section — latest run summary chips (errors/warnings/info/skipped counts, run time, trigger), issue list grouped by severity with code, message, detail, suggestion, "Revalidate" button (POST), run history dropdown (past runs, compare counts), experiment-level cross-file results banner when present; empty state "Not yet validated" + run button; loading skeletons; error+retry; severity colours from Story 1 tokens; `docs/validation-codes.md` linked per issue ("What does VCF-POS-003 mean?"); no AI text.
- **Acceptance criteria:** (1) uploading a broken fixture shows red error issue with code+action within one poll/refetch; (2) revalidate appends run and UI shows it as latest without losing history; (3) `skipped` reasons visible verbatim; (4) cross-user document shows backend-denied error state (no data leak); (5) Playwright spec: validate → inspect → revalidate green; (6) axe clean on the section.
- **API/DB:** consumes Story 15/18 endpoints. **Dependencies:** 15, 18, 7. **Priority / size:** P0 · M. **Out of scope:** AI explanations of results (41), fix-it autofix buttons.

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:medium|size:M|type=feature|backend -->
### Story 20 — Tool and format registry

- **Purpose:** A single, queryable source of truth for supported tools/formats and their mapping status — replacing "undocumented support in code".
- **Scope:** `ToolDefinition` table seeded via migration: name, version_policy, category (variant-caller/methylation/TF-binding/expression/…), website/docs URL, input formats, output formats, internal representation mapping id, support_status `supported|planned|experimental`; `FormatDefinition`: extension, media type, description, parser id, examples; endpoints `GET /registry/tools`, `GET /registry/formats` (public to authenticated users); seed realistic rows only for what exists (VCF, BED, count matrix, methylation matrix, PDF, DOCX, EML, TXT as supported; NanoVar/MethMotif/TFregulomeR/forkedTF as **`planned`** with explicit status — never claimed as working); registry consumed by Stories 21/24 and Academy content (55).
- **Acceptance criteria:** (1) registry lists exactly the parsers that exist as `supported` — verified by test asserting status matches `extraction.py` dispatch coverage; (2) planned tools visible with `planned` status and no fake capabilities; (3) endpoints paginated + ownership-free (metadata only); (4) adding a row requires only migration/seed change (documented in `docs/adapters.md`); (5) client regenerated.
- **API/DB:** additive table + seed migration.
- **Integrity:** registry statuses are promises — CI test (Story 5 rule) fails if `supported` lacks a corresponding parser test.
- **Dependencies:** none. **Priority / size:** P1 · M. **Out of scope:** executing tools, adapter implementations (21).

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:high|size:L|type=feature|backend -->
### Story 21 — Adapter interface and internal representation mappings

- **Purpose:** Map tool outputs into typed internal structures without flattening domain-specific fields — the extension point for future tools.
- **Scope:** `app/integration/adapters/` package: `Adapter` protocol (`sniff(sample_bytes, filename) -> confidence`, `parse(full) -> MappedDataset`, `describe() -> registry_mapping_id`); `MappedDataset` dataclass: `kind` (variants/peaks/expression/methylation/other), `records` (typed unions: `VariantRecord`, `IntervalRecord`, `FeatureAbundanceRow` — preserve all original fields under `raw` dict), `identifiers` (namespace detected: ensembl/symbol/probe/rsid/unknown), `coordinate_meta`, `sample_ids`, `columns`, `provenance` (parser id + version); rewire `omics_parser.parse_omics` as the first adapter implementation (behaviour-preserving refactor behind adapter API, keeping existing tests green); explicit mapping table doc (`docs/adapters.md`: source column → internal field, with unmapped-fields list); emit adapter id + parser version into `raw_extracted_json` envelope (additive key `__meta`).
- **Acceptance criteria:** (1) all 21 existing extraction/classification unit tests pass unchanged; (2) round-trip test: VCF fixture → `MappedDataset` retains FORMAT/GT raw fields verbatim (equality assert on `raw`); (3) identifier namespace detection reported, `unknown` allowed; (4) adding a fake adapter in tests registers without touching core (proves extension point); (5) `__meta` envelope readable by Story 16 validators (adapter documented, no double parse).
- **API/DB:** no endpoint change (envelope key additive within `raw_extracted_json`).
- **Integrity:** no field coercion without explicit mapping entry; document what is dropped (nothing is silently dropped).
- **Dependencies:** 20. **DoD:** package + docs + tests. **Priority / size:** P0 · L. **Out of scope:** actual NanoVar/MethMotif/… adapters (need real format samples + scientific review; follow-up after 20's `planned` rows flip).

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:high|size:M|type=feature|backend -->
### Story 22 — AnalysisRun execution records (provenance backbone)

- **Purpose:** Record what ran, with what, on what, producing what — prerequisite for provenance, compatibility, and reproducibility claims.
- **Scope:** `AnalysisRun` table: id, project_id, tool_name, tool_version, adapter_id, parameters JSON, config_hash, input_refs JSON (list of {document_id, sha256}), output_refs JSON (list of {document_id|artifact_key, sha256|content_key}), status enum (queued/running/succeeded/failed/cancelled), started/finished, actor_user_id, runtime_info (host, python version), notes; endpoints: create+start (internal service API first), `GET /projects/{id}/runs`, `GET /runs/{id}`, `POST /runs/{id}/cancel` (cooperative), status transitions CAS-protected; wire Story 13 extraction to optionally emit run records (adapter_id = parser); Story 17 metadata feeds reference versions when present.
- **Acceptance criteria:** (1) a run record contains complete input/output refs for a document processed end-to-end (integration test with fixture file, asserting sha256 refs match Story 14 values); (2) illegal status transitions rejected; (3) runs are tenant-scoped (404 cross-user); (4) `GET /projects/{id}/runs` ordered desc, paginated; (5) migration additive + client regenerated; (6) missing fields (e.g., no tool version) stored as null and flagged by Story 35's missing-provenance check later — schema uses nullable not fake defaults.
- **API/DB:** additive table. **Dependencies:** 14 (hashes), 20 (tool identity). **Priority / size:** P0 · M. **Out of scope:** scheduling/queueing real compute (25), cancelling processes (cooperative flag only until workers exist).

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:high|size:M|type=feature|backend -->
### Story 23 — Compatibility checker: can these datasets be compared or combined?

- **Purpose:** Deterministic pre-flight answers before linking datasets in the evidence graph or a report.
- **Scope:** service `check_compatibility(dataset_a, dataset_b, intended_use)` returning typed findings: assembly match/mismatch/undeclared; coordinate system match; identifier namespace overlap % (computed); sample overlap (from metadata + cross-file validation results); data-type comparability matrix (documented rules: e.g., expression+expression comparable for co-expression; VCF+matrix only via sample join — rule table in code + docs); `GET /experiments/{id}/compatibility?targets=` endpoint; every incompatibility includes explanation + remediation text (static templates); integrate with Story 18 issue codes (reuse, don't duplicate).
- **Acceptance criteria:** (1) two GRCh38 vs hg19 VCFs → `error` pair with remediation "harmonize assembly or keep analyses separate"; (2) undeclared assembly → `warning` + `skipped` comparison detail, not a pass; (3) rule table covered by parameterized unit tests; (4) response includes per-check provenance (which validator produced it); (5) no network calls (fully deterministic).
- **API/DB:** endpoint only; no schema change.
- **Integrity:** refuses to answer when inputs lack required declarations — explicit "cannot determine" state.
- **Dependencies:** 16, 17, 18, 22. **Priority / size:** P0 · M. **Out of scope:** automatic harmonization, statistical batch-correction advice.

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:medium|size:M|type=feature|frontend -->
### Story 24 — Integrations UI: registry page and compatibility reports

- **Purpose:** Users can see what's supported, what's planned, and read compatibility reports.
- **Scope:** `/integrations` replaces PlaceholderPage: two tabs — **Tools & formats** (cards/tables from `/registry/*`, status chips supported/experimental/planned, filters by category, links to docs, honest `planned` presentation with "not yet implemented" text); **Compatibility** (pick an experiment → run compatibility check → report view: pass/warn/error table with explanations and remediation links, history of past checks if stored via validation runs); states: loading/empty (`EmptyState` "No tools registered" impossible by seed — still handle error)/error/retry.
- **Acceptance criteria:** (1) registry page renders seed data with statuses matching API; (2) compatibility report run on a fixture experiment shows seeded mismatches with remediation text; (3) no control implies execution of external tools; (4) breadcrumbs + PageHeader per Story 1; (5) Playwright: navigate, filter, run check; (6) axe clean.
- **API/DB:** consumes 20/23. **Dependencies:** 20, 23, 1. **Priority / size:** P1 · M. **Out of scope:** running tools, marketplace-style install.

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:medium|size:L|type=feature|backend|frontend -->
### Story 25 — Analysis module: differential expression and PCA (supersedes issue #12)

- **Purpose:** First real compute: turn an expression matrix + sample metadata into statistics with recorded provenance.
- **Context:** absorbs issue #12's scope; scientific review required before merge.
- **Scope:** `app/services/analysis.py`: parse count/expression matrix + sample sheet (conditions); DE: log2FC + Welch t-test + Benjamini-Hochberg FDR per feature (implement in numpy/pandas — evaluate first: if `scipy` is needed, add as explicit dependency with justification in PR); PCA via SVD (no sklearn); results stored as `AnalysisArtifact` (JSON content-addressed under `uploads/`, linked from `AnalysisRun.output_refs`) + summary row counts in run record; endpoint `POST /experiments/{id}/analyses` {type: de|pca, params} → run lifecycle queued/running/succeeded/failed (reuse Story 22 CAS transitions; execution in-process async with size caps), `GET /runs/{id}/artifacts`; guardrails: min samples (≥3 per group for DE → `failed` with clear reason), feature count caps, NaN policy documented.
- **Acceptance criteria:** (1) synthetic matrix fixture with planted difference yields that feature as top-ranked (deterministic test); (2) BH-FDR verified against hand-computed small example; (3) PCA outputs coordinates + explained variance summing ≤1; (4) run records complete input sha256 → artifact sha256 chain; (5) under-sized input fails with actionable message, not traceback; (6) unit tests independent of UI; (7) **scientific review sign-off recorded in PR**.
- **API/DB:** additive tables (`AnalysisArtifact`) + endpoints; client regen.
- **Integrity:** statistics computed deterministically; no p-value rounding tricks; results labelled "computed statistics, not peer-reviewed findings".
- **Dependencies:** 13, 17, 22. **Priority / size:** P1 · L. **Out of scope:** plots (26), multi-factor designs, batch correction, non-expression types (methylation DE later), GPU.

---

<!-- ISSUE: labels=epic:integration|milestone:M3|priority:medium|size:L|type=feature|backend|frontend -->
### Story 26 — Visualization layer: plots and interactive charts (supersedes issue #13)

- **Purpose:** Render analysis artifacts as publication-usable + explorable visuals within the design system.
- **Scope:** server: matplotlib/seaborn **static PNG** artifacts (volcano, PCA scatter, heatmap of top-N features) stored as `AnalysisArtifact(kind=plot)` — add heavy deps only here with justification; JSON twin data for interactivity stored alongside; endpoints to fetch artifact PNG (authz via run ownership) and JSON; frontend: new `components/Charts/` using an existing-or-new lightweight chart lib (evaluate `recharts` vs `@visx` vs `echarts` in PR — must support dark tokens); document detail gains "Analysis" tab (Story 7 slot): chart cards with hover tooltips (gene, stats), static-image fallback, empty/error/loading states; design tokens only.
- **Acceptance criteria:** (1) DE run → volcano renders with axis labels + FDR threshold lines; (2) PCA → scatter coloured by condition with variance % in axis titles; (3) chart JSON matches PNG source data (test comparing arrays); (4) dark/light themes legible (contrast ≥3:1 for chart ink); (5) plots carry provenance footer (tool version + run id + input filename); (6) Playwright: run analysis → tab shows charts; (7) **scientific viz review** (axes/units correctness) recorded in PR.
- **API/DB:** artifact endpoints additive. **Dependencies:** 25, 1. **Priority / size:** P1 · L. **Out of scope:** publication export/plotly dashboards, interactive genome browsers, variant-track plots (Story 27).

---

<!-- ISSUE: labels=epic:integration|milestone:stretch|priority:low|size:XL|type=feature|backend|frontend -->
### Story 27 — Variant annotation track (supersedes issues #14, #15, #16, #17, #18)

- **Purpose:** One coherent, review-gated track: VCF QC + landscape → ClinVar annotation → mutation signatures → VEP-lite consequences → lab-report view.
- **⚠ Gates before starting:** (a) owner confirms this remains in product scope; (b) scientific reviewer signs off on each module's methodology; (c) licensing/data plan for ClinVar TSV + Ensembl/GENCODE annotation subsets + reference fetches approved; (d) `cyvcf2`-style dependency decision (evaluate `cyvcf2` vs pure-python parsing for the 10 MiB cap).
- **Scope (sequential sub-stories, tracked as checkboxes on this issue):** QC core (Ti/Tv, per-chrom density, AF spectrum, hotspot windows) → ClinVar match by (chrom,pos,ref,alt) with local cached data + refresh script, results explicitly "research annotation, not diagnosis" → 96-trinucleotide spectrum with cached reference flanks (mock-able client) → consequence classification + AA change via bundled annotation subset → frontend lab-report view on document detail reusing Story 26 chart components and Story 25 run lifecycle. Each sub-module ships fixture-based tests with no network in CI.
- **Acceptance criteria:** (1) each module's sub-AC from the superseded issues #14–#18 met; (2) all results flow through `AnalysisRun` provenance (input sha256, tool version, params); (3) no medical-interpretation language anywhere (lint the copy in review); (4) offline mode: tests never hit network; (5) report view blocked when validation errors exist (ties to Story 38 rules).
- **API/DB:** additive artifacts/endpoints; large-cache storage decision (local `data/` dir + documented refresh).
- **Dependencies:** 25, 26, 15, 19, 41 (explanations), plus gates above. **Priority / size:** P2 · XL · **stretch after M3**.
- **Out of scope:** polygenic scores, clinical reporting, diagnosis wording, realtime annotation APIs.
