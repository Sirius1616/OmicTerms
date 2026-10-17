# OmicTerms — Repository Audit & Target Architecture

Date: 2026-10-17. Basis: full local working-tree inspection (`main` @ `29e56ca`), GitHub API (issues), backend test run, code reading. Companion documents: `2026-10-backlog.md` (story cards), `2026-10-story-1-ui-redesign.md` (Story 1 spec).

## Stated inspection limitations

- **Design reference images could not be viewed by the planning model** (`img/dashboard-dark.png`, `img/dashboard-items.png`, `img/dashboard.png`, `img/docs.png`, `img/login.png`). The visual direction in the product brief was used instead; Story 1 requires the implementing developer to reconcile the spec against the images and treats that reconciliation as an acceptance step.
- `backend/.env` exists and was **not** read. No secret values were accessed or printed.
- GitHub Projects boards were not inspected in depth (only confirmed the repo has Projects enabled).

---

## Part 1 — Verified repository audit

### 1.1 Verified implemented functionality (tests pass / code confirmed)

**Backend (FastAPI + SQLModel + Alembic + PostgreSQL, Python 3.14, uv):**

| Area | Evidence | Status |
|---|---|---|
| Auth: register, login (JWT HS256), profile, password change, password reset via email, admin user management | `app/api/routes/{login,users,private}.py`, `app/core/security.py` (Argon2/Bcrypt via pwdlib) | Complete, one route-order defect (§1.4) |
| Project → Experiment → Sample → Document hierarchy with ownership walk & cascade deletes | `routes/{projects,experiments,samples,documents}.py`, `crud.py` | Complete (issue #11 closed) |
| Document upload: magic-byte validation, 10 MiB cap, path-traversal-guarded file serving | `routes/documents.py` | Complete (issue #4 closed) |
| Background text extraction: PDF (`pypdf`), OCR (tesseract), DOCX, EML, text→omics sniffing; status lifecycle `pending→success/failed` | `services/{extraction,extraction_job,omics_parser}.py` via FastAPI `BackgroundTasks` | Complete (issue #8 effectively done — still open) |
| Omics data-type classification (`expression/methylation/variants/peaks/document`) | `services/classification.py`, migration `efddf00027ce` | Complete (issue #9 effectively done — still open) |
| Migrations: 2 total, head `efddf00027ce`, full schema + data_type | `migration/versions/` | Complete |
| Unit tests: extraction + classification | `tests/test_extraction.py`, `tests/test_classification.py` | **21/21 passing** (verified by run) |
| Docker orchestration (db/backend/frontend), Sentry wiring, superuser seeding | `docker-compose.yml`, `app/main.py`, `initial_data.py` | Complete |

**Frontend (Vite + React 19 + TS, TanStack Router/Query/Table, Tailwind v4, shadcn/ui new-york):**

| Area | Evidence | Status |
|---|---|---|
| Auth pages (login/signup/recover/reset) with RHF+zod | `src/routes/{login,signup,recover-password,reset-password}.tsx` | Complete |
| Protected shell with collapsible sidebar, mobile sheet, theme system (dark default, oklch navy/cyan tokens) | `_layout.tsx`, `components/Sidebar/*`, `index.css`, `theme-provider.tsx` | Complete; token violations (§1.4) |
| Documents: list, upload dialog with inline project/experiment/sample creation, detail page (blob viewer for pdf/txt, rename, delete) | `routes/_layout/documents*.tsx`, `components/Documents/*` | Complete |
| Admin users table, user settings (profile/password/delete) | `routes/_layout/{admin,settings}.tsx` | Complete |
| Generated OpenAPI client + services layer | `src/client/*`, `src/services/*` | Complete |
| Playwright suite (auth, signup, reset, admin, settings) | `frontend/tests/*` | Partially stale (§1.4) |
| Dashboard | `routes/_layout/index.tsx` | **~80% decorative** — genomics motifs, fake `LabReadout` coordinates, static carousel; only real data is a 5-item recent-documents list |

### 1.2 Verified partial functionality (frontend exists, backend absent)

| Feature | Frontend state | Backend state |
|---|---|---|
| Document explanations | `ExplanationPanel` renders permanent empty state; `documentsApi.getExplanation` is a **mock** (800 ms delay, returns null) | **No endpoint.** `Explanation` table migrated but unused. Planned as issue #5 |
| Document chat | `DocumentChat` UI complete; `sendMessage` mock returns canned placeholder; no persistence/streaming | **No endpoint.** `Conversation`/`Message` tables migrated but unused. Planned as issue #6 |
| Hierarchy management | Can only **create** entities inline during upload | Full CRUD API exists — **no browse/rename/delete UI** |
| Project tree API | Used only inside upload dialog | Complete |
| Document viewer | Preview only for pdf/txt; object URLs never revoked | n/a |

### 1.3 Verified absent functionality

- No AI/LLM code, config, or keys anywhere in the backend (grep-verified).
- No validation beyond upload magic bytes + pydantic field constraints (no VCF/BED semantic validation, no sample-ID cross-file checks, no assembly/coordinate metadata).
- No provenance/audit/lineage models, endpoints, or UI.
- No findings, evidence graph, or reports (models, APIs, or UI).
- No Academy/learning anything (no models, content, routes, or UI).
- No analysis tools (no DE/PCA/variant compute — issues #12/#14–#17 unimplemented).
- No CI (`.github/` directory does not exist).
- No global search, notifications, or contextual help.
- No dashboard metrics/charts (chart tokens exist unused).
- No background-job durability (in-process `BackgroundTasks` only; lost on restart).

### 1.4 Verified defects and code-health issues

| # | Defect | Location | Severity |
|---|---|---|---|
| D1 | `PATCH /users/{user_id}` registered **before** `PATCH /users/me` → "update me" is shadowed and 422s | `backend/app/api/routes/users.py:80` vs `:103` | High (broken endpoint) |
| D2 | `enable_email` computed field returns a **tuple**, not bool | `app/core/config.py` | Low (works by accident) |
| D3 | `validate_password_reset_token` never checks the `purpose` claim it sets; `ResetToken` table unused | `app/utils.py` | Medium (security hygiene) |
| D4 | `scripts/tests-start.sh` calls non-existent `app/tests_pre_start.py` | `backend/scripts/` | Medium |
| D5 | Empty test scaffolding (`conftest.py`, all `tests/api/**`, `tests/crud/**`, `tests/utils/**`, stale `test_items.py`) — no API/integration tests at all | `backend/tests/` | High (quality gate) |
| D6 | No pytest/ruff/mypy config in `pyproject.toml`; `ty` invoked by `lint.sh` but not declared | `backend/pyproject.toml` | Medium |
| D7 | Stale Playwright specs: `items.spec.ts` targets non-existent route; login spec expects removed "Welcome back" copy; admin spec expects "Is superuser?" wording | `frontend/tests/` | Medium |
| D8 | Sonner Toaster reads `next-themes` context that is never provided → toasts ignore app theme | `components/ui/sonner.tsx` | Low |
| D9 | Hardcoded light-only colours in document status/type badges, `AuthLayout` gradient hexes, avatar fallback, motif SVGs — break dark theme | `Documents/columns.tsx`, `AuthLayout.tsx`, `Sidebar/User.tsx`, `GenomicsMotif.tsx` | Medium (visible) |
| D10 | Inter/JetBrains Mono declared as tokens but **never loaded** | `index.css`, `index.html` | Medium |
| D11 | Router + Query devtools rendered unconditionally (including production builds) | `routes/__root.tsx` | Medium |
| D12 | Footer social links point to bare `https://github.com/`, `https://x.com/`, `https://linkedin.com/` | `Common/Footer.tsx` | Low |
| D13 | `requirement.txt` is an unrelated host `pip freeze`; `backend/main.py` and `backend/README.md` are empty strays | repo root/backend | Low |
| D14 | Upload object URLs never revoked; chat textarea no auto-grow; `PendingDocuments` skeleton columns stale (4 vs 6) | `Documents/*`, `Pending/*` | Low |
| D15 | `git grep` for `TODO` finds nothing — incompleteness is untracked; open issues #8/#9 describe work that is already done | issues tracker | Low (process) |

### 1.5 Existing GitHub issues — disposition

| Issue | Title | Disposition in new backlog |
|---|---|---|
| #5 | Plain-language document explanations | **Absorbed → Story 41** (scope adjusted: grounded in extracted text, source refs required) |
| #6 | Conversations and chat messages | **Absorbed → Story 42** (+ Story 43 frontend wiring replaces mocks) |
| #8 | Text extraction pipeline | **Implemented in code** — recommend closing; remaining gap (durability) → Story 13 |
| #9 | Omics data type classification | **Implemented in code** — recommend closing; semantic validation → Stories 16/18 |
| #10 | AI service infrastructure | **Absorbed → Story 40** |
| #12 | Omics analysis module (DE + PCA) | **Absorbed → Story 25** (scheduled M3, scientific review gate) |
| #13 | Visualization layer | **Absorbed → Story 26** |
| #14–#17 | Variant QC, ClinVar, signatures, VEP-lite | **Absorbed → Story 27** (single stretch track; needs scientific + licensing review; external data dependencies) |
| #18 | Variant lab report view | **Absorbed → Story 27** (frontend portion) |

Recommended after issue creation: close #8/#9 with a comment pointing at the backlog; leave the rest open and comment with the superseding story number (or close as superseded — owner's call).

### 1.6 Other repo observations

- `contract.txt` at repo root is an **API contract for an unrelated product** (Scrum exam app). Not referenced by any code. Recommend deleting or moving to `docs/attic/`.
- `practice.md` + `practice/` is a personal learning log (drills for extraction/classification). Harmless; conceptually foreshadows the Academy.
- Local dir name is `Layterms`; product/branding is `OmicTerms` (already the `PROJECT_NAME` default and docker project name). Cosmetic only.

---

## Part 2 — Target architecture

### 2.1 Principles

1. **Extend, don't rewrite.** The existing stack (FastAPI/SQLModel/Alembic/Postgres; React/TanStack/Tailwind v4/shadcn) is sound and recent. Every story below works within it.
2. **Deterministic first.** Validation, arithmetic, compatibility checks, access control = code. AI = explanation/summarisation assistance only, never an authority over a failed check.
3. **Honest UI.** No control that silently does nothing; no fabricated scientific results; fixtures only behind an explicit dev toggle with a visible badge.
4. **Provenance by construction.** Every mutation that matters emits an append-only event; findings and reports must reference evidence.
5. **Additive schema changes only.** Alembic migrations remain forward-only; no destructive migrations without an explicit, approved story.

### 2.2 What remains unchanged

- Backend framework, ORM, migration tool, database engine, auth mechanism (JWT) for M1–M2.
- Frontend framework, router, data layer, component library, styling system (Tailwind v4 tokens in `index.css`).
- All existing API paths and response shapes (generated client stays valid; changes are additive).
- Existing extraction/classification services (extended, not replaced).
- Docker Compose topology (one worker slot added later only if Story 13's decision selects it).
- Existing user/project/experiment/sample/document data — preserved.

### 2.3 What changes (by area)

| Area | Change | Story |
|---|---|---|
| Design tokens | Extend existing oklch navy system with semantic status/learning colours; load real fonts; fix token violations | 1 |
| App shell | Two-area sidebar (Research / Learning), breadcrumbs, global search, notifications surface, honest placeholders for unwired routes | 1 |
| Dashboard | Replace decorative hero with reference-driven panels; real counts where APIs exist; dev fixtures for absent backends; Academy panel | 1 |
| Backend hygiene | Fix D1–D4; real test harness; CI | 2–5 |
| Ingestion | Durable extraction jobs (job table + poller; optional external worker), SHA-256 checksums | 13–14 |
| Validation | `ValidationRun`/`ValidationIssue` models, severity taxonomy (error/warning/info/skipped), pluggable validators, cross-file checks | 15–19 |
| Integration | Tool/format registry, adapter interface over `omics_parser`, `AnalysisRun` execution records, compatibility checker | 20–24 |
| Compute | DE+PCA module, plot artifacts; variant annotation track (stretch) | 25–27 |
| Evidence | `Finding`, `EvidenceNode`/`EvidenceLink` graph, map visualization, findings UI, AI-assisted drafting (advisory) | 28–31, 63 |
| Provenance | Append-only `ProvenanceEvent`, timeline, graph, manifest export | 32–35 |
| Reports | Structured claims + evidence refs, deterministic consistency checks, versioned export | 36–39 |
| AI | Provider abstraction (server-side config), grounded explanations, SSE chat, prompt-injection defenses, eval suite, advisory finding drafts | 40–45, 63 |
| Academy | Learning models (profile/path/module/lesson/progress), authored content, Concept Explorer, labs, capstone | 47–58 |
| Hardening | Cookie-based sessions (decision-gated), a11y audit, E2E coverage, ops docs, ADRs | 46, 59–62 |

### 2.4 Key architectural decisions (recommendations — need owner approval where marked ⚖)

| Decision | Recommendation | Affects |
|---|---|---|
| ⚖ Reference-image fidelity process | Implementing dev reconciles Story 1 spec against `img/dashboard-dark.png`/`dashboard-items.png` during the story; deviations logged in the PR | Story 1 |
| ⚖ Primary accent | Shift `--primary` from cyan to electric blue (hue ≈ 250); keep cyan as a data/accent token | Story 1 |
| ⚖ Typography density | 14 px base body (research-tool density), Inter + JetBrains Mono **self-hosted via `@fontsource`** (no CDN; offline-safe) | Story 1 |
| ⚖ Decorative motifs | Keep max two restrained scientific motifs (static SVG data ribbon in welcome banner); remove gamified loops (`BaseRain`, `ScanBeam`, fake `LabReadout`, auto-carousel) from the authenticated app | Story 1 |
| ⚖ Session storage | Keep localStorage JWT through M1–M2; migrate to httpOnly SameSite cookies in Story 46 | 46 |
| ⚖ Background jobs | Job table + in-process asyncio poller (no new infra) for M2; Redis/arq only if concurrent-user evidence demands | 13 |
| ⚖ Labs execution | Browser-side Pyodide for M4 phase 1 (no server code execution); server sandbox only behind a later decision | 57 |
| ⚖ AI provider | Owner chooses provider/budget; Story 40 ships an abstraction with one adapter + refusal/timeout/rate-limit defaults; no provider keys in repo | 40 |
| ⚖ Variant track (#14–#18) | Schedule as post-M3 stretch; requires scientific review + ClinVar/Ensembl licensing and data-refresh plan | 27 |
| Object storage | Stay on local `uploads/` volume through M3; S3-compatible storage is a separate future decision | 13+ |

### 2.5 Cross-cutting conventions (adopted by all stories)

- **Severity taxonomy** (validation): `error` (blocks use/reporting), `warning` (needs review), `info` (context), `skipped` (check not performed — always explained why). Adopted by Stories 15+; UI badge colours defined in Story 1 tokens.
- **Provenance emission:** services call `provenance.record(actor, entity, action, payload)` once Story 32 lands; stories before it must not invent ad-hoc logs.
- **AI disclosure:** any AI-produced text renders with an "AI-generated explanation — not a scientific conclusion" marker (component from Story 1, wired in 41+).
- **Fixtures:** `frontend/src/fixtures/**` only, activated solely by `import.meta.env.DEV && localStorage['omiterms:fixtures']==='on'`, always showing a "DEV FIXTURES" badge. Production builds must tree-shake them.
- **API changes:** additive only; regenerate the OpenAPI client per `frontend/README.md` flow; never rename existing endpoints.
- **Testing floor:** every backend story ships pytest coverage for its new logic; every frontend story ships Playwright coverage for its new journey; CI (Story 5) gates all of it.

---

## Part 3 — Epics, milestones, parallelisation

### Epics (12)

| Epic | Name | Stories |
|---|---|---|
| E1 | Design system & redesigned UI | 1, 6, 7, 8 |
| E2 | Repository audit remediation & foundations | 2, 3, 4, 5, 46 |
| E3 | Research workspace & project management | 10, 11, 12 |
| E4 | Data ingestion & integrity validation | 13–19 |
| E5 | Cross-tool & multi-omics integration (+ analysis compute) | 20–27 |
| E6 | Evidence graph & findings | 28–31, 63 |
| E7 | Provenance & reproducibility | 32–35 |
| E8 | Evidence-backed reports | 36–39 |
| E9 | OmicTerms Academy & personalised learning | 47–54 |
| E10 | Concept Explorer & interactive labs | 55–58 |
| E11 | AI grounding, privacy & security | 40–45 |
| E12 | Testing, accessibility, deployment & documentation | 9, 59, 60, 61, 62 (plus 5, shared with E2) |

### Milestones

| Milestone | Goal | Contents |
|---|---|---|
| **M1 — UI review** | Owner reviews look & feel of shell + dashboard | Story 1 |
| **M2 — Research workflow foundations** | Upload → durable extraction → validation → hierarchy management → provenance timeline → CI/hardening | 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 16, 17, 32, 33, 46, 60 |
| **M3 — Evidence, integration & reporting** | Validation completion, tool registry, analysis compute, evidence graph, findings, reports, AI explanations/chat | 9, 18, 19, 20, 21, 22, 23, 24, 25, 26, 28, 29, 30, 31, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 59, 61, 62, 63 |
| **M4 — Academy & learning** | Onboarding, pathways, content, Concept Explorer, labs, capstone | 47–58 |
| **Stretch** | Variant annotation track (supersedes issues #14–#18) | 27 |

### Parallelisable streams (after M1)

- **Stream A (backend foundations):** 2 → 3 → 5, with 13/14/15 alongside.
- **Stream B (frontend polish):** 6, 7, 8, 9 (all depend only on Story 1).
- **Stream C (workspace):** 10, 11, 12 (depend on 1/7).
- **Stream D (provenance):** 32 → 33 (independent of validation).
- M3 streams: integration (20–24) ∥ AI (40–45, 63) ∥ evidence (28–31) once 22 lands; reports (36–39) last.
- M4 streams: models (47) → onboarding (48) → content (49–52) ∥ Concept Explorer (55) ∥ labs (56 → 57); capstone (54) closes M4, paper translator (58) can trail.

### Blocking dependencies & decision gates (summary)

- Story 1 blocks all other frontend restyling stories (6–12, 29, 31, 33, 37, 43, 53, 56).
- Story 5 (CI) blocks declaring M2 done.
- Story 15 blocks 16–19.
- Story 22 blocks 23, 25, 28, 32 (provenance of runs).
- Story 25 blocks 26 and 27.
- Story 40 (AI infra) blocks 41 → 42 → 43/44/45/58/63; 59's AI journey uses the fake-provider test seam. ⚖ provider decision required to start 40.
- Story 56 has a ⚖ runtime decision gate before lab content (57).
- Story 27 requires ⚖ scientific + licensing review before start.

### External dependencies / credentials

- SMTP (password reset emails) — already optional; Mailcatcher used in tests.
- AI provider API key — required for Stories 40+ (M3); not present in repo.
- ClinVar variant_summary TSV + Ensembl/UCSC REST access — Story 27 only (stretch).
- Tesseract binary in deployment image for OCR — already assumed by `pytesseract` (verify in Story 60).
- Sentry DSN — optional, documented in Story 60.

### Work requiring scientific review

Academy content accuracy (49–54), lab datasets (58), variant-track interpretations (27), confidence/evidence-strength semantics for findings (30), report consistency-check thresholds (38), AI faithfulness criteria (45).

### Acceptance criteria not yet verifiable

- Any AC referencing findings/validation/learning data before their stories land — resolved by using fixtures-with-badge or empty states in Story 1, then real data as stories land.
- Visual fidelity ACs in Story 1 — verifiable only by human comparison against reference images (tooling lands in Story 9).
