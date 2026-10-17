# OmicTerms — Implementation Backlog, part 2 (Stories 28–63, traceability, risks)

Continuation of `2026-10-backlog.md`. Same marker format.

---

<!-- ISSUE: labels=epic:evidence-findings|milestone:M3|priority:high|size:M|type=feature|backend -->
### Story 28 — Evidence graph data model

- **Purpose:** Typed nodes and edges connecting datasets, runs, samples, findings, and reports — the substrate for the Evidence Map, provenance graph, and claim tracing.
- **Scope:** `EvidenceNode` (id, entity_type `document|run|sample|experiment|finding|report|artifact`, entity_id, label, project_id for tenancy, created_at; uniqueness on (entity_type, entity_id)) and `EvidenceEdge` (id, source_id, target_id, relation enum `derived_from|produced_by|supports|contradicts|reports_on|same_sample_as|input_to`, evidence_ref JSON nullable, created_by, created_at, note); service to auto-materialise nodes/edges when documents, runs, findings, reports are created (hook points documented); endpoints: `GET /projects/{id}/graph?depth=` (bounded, paginated by node cap e.g. 500 with `truncated` flag), `POST /projects/{id}/graph/edges` (manual linking: supports/contradicts — only between existing nodes, with note), `DELETE /graph/edges/{id}` (creator or admin); ownership enforced via project.
- **Acceptance criteria:** (1) upload doc → nodes for document/sample/experiment/project auto-exist with edges (integration test); (2) Story 22 run creation adds `input_to`/`produced_by` edges referencing sha256 evidence_ref; (3) graph query respects depth + node cap and reports `truncated: true` (no unbounded payload); (4) cross-project edge creation rejected 403/404; (5) `supports` edge requires an `evidence_ref` (validation), manual edges audit `created_by`; (6) pytest covers materialisation, caps, authz.
- **API/DB:** two additive tables + hooks. **Integrity:** edges assert documented relations only; nothing infers `supports` automatically — automatic relations are structural (`derived_from`, `input_to`).
- **Dependencies:** 22 (run hooks); findable graph needs 17's metadata for labels. **Priority / size:** P0 · M. **Out of scope:** visualization (29), findings (30), full-text search of graph.

---

<!-- ISSUE: labels=epic:evidence-findings|milestone:M3|priority:high|size:L|type=feature|frontend -->
### Story 29 — Multi-Omics Evidence Map visualization

- **Purpose:** Replace Story 1's presentation-only map with the real, inspectable graph.
- **Scope:** `/evidence` route replaces PlaceholderPage; render project graph with **layered fixed layout** (columns: omics layers → samples/experiments → runs → findings/reports) using SVG; node styling: typed icons + entity colours (genomics/transcriptomics/… from data_type; runs = primary; findings = learning-purple; reports = warning-neutral), edges styled per relation (solid structural, dashed manual `supports`); interactions: click node → inspector panel (label, type, key fields, sha256/run info, links "Open source" navigating to document/run detail), hover highlight of incident edges, pan/zoom (simple transform, no heavy lib unless justified), filter by entity type + relation, depth control; states: loading skeleton, empty (`EmptyState` onboarding: "Upload data and link a run to grow your graph"), truncated banner, error+retry, permissions-denied; respects fixture mode until real data exists (Story 1 fixtures removed only when real graph ships).
- **Acceptance criteria:** (1) experiment with 2 docs + 1 analysis run shows all nodes with correct typed edges; (2) inspector opens for every node type and "Open source" navigates correctly (Playwright); (3) 500-node cap renders ≤3 s and shows truncated banner; (4) filters keyboard-accessible; (5) axe: graph has text alternative summary ("N nodes, M edges" table view toggle for a11y); (6) no decorative-only edges — every drawn edge exists in API response (assert via route interception in test).
- **API/DB:** consumes 28. **Dependencies:** 28, 1. **Priority / size:** P0 · L. **Out of scope:** force-directed layout tuning, graph editing beyond single-edge create/delete, ontology browsing.

---

<!-- ISSUE: labels=epic:evidence-findings|milestone:M3|priority:high|size:M|type=feature|backend -->
### Story 30 — Findings model and CRUD with evidence references

- **Purpose:** Research claims that are explicitly tied to supporting material and validation status — never AI-fabricated "validated science".
- **Scope:** `Finding` (id, project_id, title, summary, status enum `draft|review|published|retracted`, validation_state enum `unvalidated|validated|disputed` **settable only by deterministic checks or human action — never auto**, created_by, updated_at, version int, supersedes_id nullable); `FindingEvidence` (finding_id, target_type document/run/artifact/report_passage/graph_edge, target_id, quote_or_field JSON, role `primary|supporting|contradicting`); endpoints: full CRUD (project ownership), `POST /findings/{id}/evidence`, `DELETE /findings/{id}/evidence/{eid}`, `POST /findings/{id}/validate` (runs registered deterministic checks → sets validation_state only if checks pass; failures keep state + attach issues), version bump on publish; every mutation emits Story 32 events (stub until then); evidence targets must exist and be accessible to the actor (referential + authz check).
- **Acceptance criteria:** (1) creating a finding with 2 evidence refs returns them resolved with labels; (2) `POST .../validate` with unresolved validation errors cannot set `validated` (integration test proving AI/manual cannot bypass — endpoint has no body to force it); (3) publishing requires ≥1 primary evidence (422 otherwise) — claim-to-evidence rule enforced server-side; (4) cross-project evidence link rejected; (5) version history: previous versions retrievable (`GET /findings/{id}/versions`); (6) pytest covers lifecycle + rules.
- **API/DB:** two additive tables. **Integrity:** no confidence percentage field exists unless a methodologically-defined calculation backs it — schema stores `validation_state` only (product rule from brief §4D).
- **Dependencies:** 28, 15, 22. **Priority / size:** P0 · M. **Out of scope:** AI-assisted drafting (Story 63), report integration (36).

---

<!-- ISSUE: labels=epic:evidence-findings|milestone:M3|priority:high|size:M|type=feature|frontend -->
### Story 31 — Findings panel and detail UI

- **Purpose:** Dashboard Key Findings panel becomes real; findings become inspectable.
- **Scope:** dashboard panel (Story 1 slot) loads `GET /projects/{id}/findings?status=active` (scope: current user's projects, merged list); rows: title, 2-line summary, validation chip (unvalidated=amber, validated=teal, disputed=red — **no confidence numbers**), evidence count chips, status; `/findings/{id}` detail: full summary, evidence list with deep links (document/run/report), "Validate" action (calls 30), edit/publish actions with confirmations, activity history (Story 33 events), discrepancy banner when linked validation issues exist; new-finding creation form (title/summary/evidence picker from graph nodes); empty/loading/error states; fixture mode retires once real data lands (keep toggle for demo only).
- **Acceptance criteria:** (1) create finding via UI → appears in dashboard panel after invalidation; (2) chip shows `unvalidated` for new findings and only changes after successful `POST validate`; (3) every evidence link navigates to a real entity (Playwright walks all links); (4) publish blocked without primary evidence (server 422 surfaced inline); (5) destructive actions (retract) confirm with explicit copy; (6) axe clean.
- **API/DB:** consumes 30. **Dependencies:** 30, 1, 28. **Priority / size:** P0 · M. **Out of scope:** rich-text editor, statistical re-computation, AI summaries.

---

<!-- ISSUE: labels=epic:provenance|milestone:M2|priority:high|size:L|type=feature|backend -->
### Story 32 — Provenance event log (append-only audit trail)

- **Purpose:** Reconstruct who did what to what, with what inputs — foundation for timelines, manifests, and trust.
- **Scope:** `ProvenanceEvent` table: id, project_id, actor_type `user|system|job`, actor_id nullable, action code (`document.uploaded|document.renamed|document.deleted|validation.run|extraction.started|extraction.succeeded|extraction.failed|metadata.updated|project.created|…` — registry dict, documented), entity_type/entity_id, payload JSON (non-secret: filenames, status, hashes — **never** token contents or extracted full text), occurred_at (server clock), request_id; append-only (no update/delete API; DB role note in migration doc); service `record()` + FastAPI middleware to stamp request_id; wire emission into all existing mutation routes (projects/experiments/samples/documents/users-me) + Story 13/15 hooks (those stories call `record()` if merged first — coordinate ordering: this story lands emissions for the routes that exist when it merges; later stories add their own); `GET /projects/{id}/events?action=&limit=` (ownership, paginated, descending).
- **Acceptance criteria:** (1) upload → exactly one `document.uploaded` event with filename + sha256 (when Story 14 present) + actor; (2) rename → event with before/after; (3) no endpoint accepts user-supplied event mutation; (4) payload redaction test: login/reset routes emit **no** events containing passwords/tokens; (5) concurrent requests don't interleave request_ids incorrectly; (6) query performance: index on (project_id, occurred_at) verified by EXPLAIN in review; (7) pytest covers emission matrix per route.
- **API/DB:** additive table + registry module. **Security/Privacy:** payloads limited to operational metadata; retention documented (Story 61); GDPR-style user deletion anonymises actor_id rather than deleting history (decide + document here).
- **Dependencies:** 14 (hashes, optional), none else — **start early in M2**. **Priority / size:** P0 · L. **Out of scope:** UI (33), run graph (34), log shipping to external SIEM.

---

<!-- ISSUE: labels=epic:provenance|milestone:M2|priority:medium|size:M|type=feature|frontend -->
### Story 33 — Activity & provenance timeline UI (real data)

- **Purpose:** Story 1's document-derived activity strip becomes the full provenance timeline.
- **Scope:** dashboard Activity panel + `/projects/{id}/activity` page: consume `GET /projects/{id}/events`, render grouped timeline (today/yesterday/date), rows: icon per action, actor avatar+name (`system`/`job` styled distinctly), human message from action registry, mono timestamp with absolute tooltip, deep link when payload has entity id; filters by action category; copy: subtitle drops the "M2" disclaimer; states: loading/empty ("No activity yet")/error/truncated pagination ("Load more").
- **Acceptance criteria:** (1) upload → rename → validate sequence renders in order with correct actors (Playwright); (2) system/job events visually distinct from user events; (3) pagination works past 50 events; (4) no fixture events render when API returns data; (5) empty project shows EmptyState; (6) dashboard panel and project page share components.
- **API/DB:** consumes 32. **Dependencies:** 32, 1. **Priority / size:** P1 · M. **Out of scope:** export, real-time push updates (polling/refetch on focus suffices).

---

<!-- ISSUE: labels=epic:provenance|milestone:M3|priority:medium|size:M|type=feature|frontend -->
### Story 34 — Navigable provenance graph view

- **Purpose:** Follow a result back through runs and inputs — the "where did this come from" journey.
- **Scope:** from a document/run/finding detail: "Trace provenance" action → `/provenance/{entity_type}/{id}` view: upstream/downstream chain rendered with the Story 29 graph components (reuse: single-entity neighbourhood mode, depth ≤4), each node showing status/timestamps/sha256 short; "missing provenance" nodes flagged amber (from Story 35 checks); jump-to-entity links; states: chain of length 1 shows "No recorded predecessors — uploaded as original source" (honest), error/empty/loading.
- **Acceptance criteria:** (1) document → extraction run → analysis run → finding chain fully walkable in one screen (integration fixture); (2) missing-input nodes visibly flagged with reason from 35; (3) back-navigation safe (browser back restores prior view); (4) a11y text-equivalent chain list; (5) Playwright walks the chain.
- **API/DB:** consumes 28, 32, 35. **Dependencies:** 28, 32, 35, 29 (components). **Priority / size:** P1 · M. **Out of scope:** timeline scrubbing, replaying runs.

---

<!-- ISSUE: labels=epic:provenance|milestone:M3|priority:medium|size:M|type=feature|backend -->
### Story 35 — Analysis manifest export and missing-provenance warnings

- **Purpose:** Export a machine-readable record of how an entity was produced; warn loudly when records are incomplete.
- **Scope:** `GET /entities/{type}/{id}/manifest` (document/run/finding): JSON bundle — schema_version, entity + sha256, full upstream closure (inputs, runs, tool versions, params, references, validators + versions), events subset, generated_at, generator version; `missing_provenance` array (e.g., no tool version, no assembly declared, pre-provenance upload with no `document.uploaded` event); download endpoint sets `content-disposition`; validator registered with Story 15 that populates missing-provenance warnings; UI: "Export manifest" buttons (Story 31/37 slots) + warning chips surfaced on detail pages.
- **Acceptance criteria:** (1) manifest for a post-Story-22 run validates against a published JSON schema (schema file in repo, test asserts conformance); (2) pre-existing legacy document yields manifest with `missing_provenance` ≥1 (event absent) rather than failing; (3) manifest contains no secrets and no full extracted text (test scans for password/token keys); (4) determinism: two exports of unchanged entity differ only in `generated_at`; (5) UI download works with authz (cross-user 404).
- **API/DB:** endpoint + schema file; no table. **Integrity:** export ≠ replay — response states "record of inputs, not a guarantee of reproducibility".
- **Dependencies:** 32, 22, 15. **Priority / size:** P1 · M. **Out of scope:** one-click re-execution (needs workers + environment capture — future decision).

---

<!-- ISSUE: labels=epic:reports|milestone:M3|priority:high|size:L|type=feature|backend -->
### Story 36 — Report model and structured builder API

- **Purpose:** Reports as structured, versioned claim-and-evidence documents rather than free text.
- **Scope:** `Report` (id, project_id, title, status enum `draft|in_review|approved|exported`, current_version, created_by, timestamps) and `ReportVersion` (immutable snapshot: sections JSON — section {id, heading, order, paragraphs[] where paragraph = {id, text, finding_refs[], evidence_refs[]}}), `ReportApproval` (version_id, actor, state, note); endpoints: CRUD drafts, `POST /reports/{id}/versions` (snapshot), `GET /reports/{id}/versions`, publish-for-review, approve (admin or project owner — rule documented), evidence-integrity endpoint `GET /reports/{id}/audit` → structured issues: paragraphs with no refs, refs to deleted entities, **numeric tokens in paragraph text not found in any referenced artifact** (deterministic: parse numbers, compare against artifact JSON values within tolerance when artifact is machine-readable — result `unverifiable` if not); all mutations emit provenance events.
- **Acceptance criteria:** (1) snapshot immutability test (editing draft doesn't alter stored version); (2) paragraph with zero refs appears in audit as `missing_evidence` warning; (3) paragraph citing artifact containing value `42.7` with text "42.7" passes; text "42.9" vs artifact "42.7" → `numeric_mismatch` issue (tolerance 1e-6, documented); (4) approve requires prior publish state and distinct actor note; (5) cross-project ref rejected; (6) pytest covers audit logic incl. unverifiable path.
- **API/DB:** three additive tables. **Integrity:** deterministic audit only; approval is human attestation recorded, not a scientific endorsement (copy fixed in 37).
- **Dependencies:** 30, 32. **Priority / size:** P0 · L. **Out of scope:** rich text/Markdown editor UI (37 renders structured fields), citations metadata for external papers (later), word-processor import.

---

<!-- ISSUE: labels=epic:reports|milestone:M3|priority:high|size:L|type=feature|frontend -->
### Story 37 — Report editor UI

- **Purpose:** Build reports section-by-section with evidence attached to every claim, seeing audit issues live.
- **Scope:** `/reports` list (per project, status chips, create) + `/reports/{id}` editor: section list (add/reorder/rename/delete with confirm), paragraph blocks (text area + "attach evidence" picker from graph/findings — picker shows entity labels + types), inline audit gutter (warnings from `GET /reports/{id}/audit` re-run debounced 1 s: red for mismatch, amber for missing/unverifiable, grey for unverifiable-text), version sidebar (snapshots, restore-as-draft), status actions (publish/approve per roles), autosave draft (debounced PATCH) + unsaved-changes guard; states per Story 1; reuse design-system forms.
- **Acceptance criteria:** (1) create report → add section → add paragraph with 1 evidence → save version → listed immutable in sidebar (Playwright full flow); (2) audit gutter updates after typing a numeric claim lacking support (amber/red as per 36); (3) reload restores autosaved draft; (4) approve disabled for unauthorized user (server-enforced; UI mirrors); (5) keyboard: reorder sections via buttons (no drag-only); (6) axe clean.
- **API/DB:** consumes 36. **Dependencies:** 36, 1. **Priority / size:** P0 · L. **Out of scope:** collaborative editing, rich formatting, Markdown paste.

---

<!-- ISSUE: labels=epic:reports|milestone:M3|priority:medium|size:M|type=feature|backend+frontend -->
### Story 38 — Report consistency checks and evidence-coverage enforcement

- **Purpose:** Block or warn on claims that exceed their evidence before a report leaves draft.
- **Scope:** extend Story 36 audit into a gate: `blocking` rules (numeric mismatch vs machine-readable artifact; ref to deleted entity; approved version containing blocking issue) vs `warning` rules (missing evidence, unverifiable number); publish-for-review refuses on blocking issues (422 with issue list); frontend surfaces issue cards with "what to fix" actions (jump to paragraph, remove ref); configurable thresholds live in one documented module; integration into export (39) — exported artifacts embed the final audit summary.
- **Acceptance criteria:** (1) publish attempt with mismatch returns 422 + structured issues rendered inline; (2) warning-only issues allow publish but show persistent banner; (3) rules table documented with examples in `docs/report-checks.md`; (4) unit tests per rule (pass/fail/unverifiable); (5) no AI involved — pure deterministic.
- **API/DB:** endpoint behaviour change (additive response fields), no migration. **Dependencies:** 36, 37. **Priority / size:** P0 · M. **Out of scope:** prose-level overclaiming detection (AI-assisted → considered in 45 as advisory only, never a gate).

---

<!-- ISSUE: labels=epic:reports|milestone:M3|priority:medium|size:M|type=feature|backend+frontend -->
### Story 39 — Report preview, export, and version provenance

- **Purpose:** Produce shareable outputs with traceable origins.
- **Scope:** preview route (read-only rendering of a version: title page with status watermark DRAFT/APPROVED, sections, evidence footnotes numbered, provenance footer: report id, version, export timestamp, generator version, manifest hash); export: **Markdown + HTML** (server-side render from JSON — deterministic), print-to-PDF via print stylesheet (no PDF library dependency initially; revisit if demanded); every export records a `report.exported` provenance event + stores export artifact hash in the version; exported file lists unresolved warnings verbatim (nothing hidden); share links deferred (authz: downloads require login).
- **Acceptance criteria:** (1) export of a version matches preview content (golden-file test for Markdown); (2) DRAFT watermark present in HTML; (3) export blocked when blocking issues exist (same gate as 38); (4) footnote numbering maps 1:1 to evidence refs (test); (5) event + hash recorded; (6) Playwright: build minimal report → preview → download → assert filename+content marker.
- **API/DB:** artifact storage (content-addressed like 25), additive endpoint. **Integrity:** exported artefacts are immutable snapshots; exports never regenerate silently.
- **Dependencies:** 36, 38. **Priority / size:** P1 · M. **Out of scope:** DOCX/LaTeX, external citation managers, public share links.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M3|priority:high|size:L|type=feature|backend -->
### Story 40 — AI service infrastructure (provider abstraction, controls) — supersedes issue #10

- **Purpose:** One hardened, server-side AI gateway for all assisted features. ⚖ **Decision gate: owner selects provider(s) and monthly budget before this starts.**
- **Scope:** `app/services/ai/`: `AIProvider` protocol (`complete`, `stream`), one concrete adapter per approved provider (start with one), `AIRequest` (messages, system prompt id+version, max_tokens, temperature policy, purpose tag `explanation|chat|review`), response with usage+latency recorded; config via pydantic-settings (names only in code: `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL`, `AI_MAX_TOKENS`, `AI_RATE_PER_MIN`, `AI_DAILY_BUDGET_TOKENS`) — key never leaves server; persistence `AIUsageLog` (user_id, purpose, model, prompt_tokens, completion_tokens, latency_ms, status, created_at) for cost visibility + `GET /admin/ai/usage` (admin); per-user token-bucket rate limiter (in-DB or in-memory single-instance — documented), global daily budget tripwire (disable AI endpoints with 503 + clear message when exceeded); retries with exponential backoff, hard timeouts, circuit-breaker after N failures; prompt templates as versioned files (system prompts rendered server-side, user content strictly delimited); refusal/low-context responses as first-class outcomes (typed `InsufficientEvidence` result — callers must handle); OpenAPI: none for provider internals — only later feature endpoints.
- **Acceptance criteria:** (1) provider fully replaceable via config (adapter swap test with fake provider); (2) rate limit returns 429 with `Retry-After` (tested); (3) budget tripwire flips state and blocks calls (tested); (4) usage log row per call incl. failures; (5) no API key in logs/exceptions/responses (grep test over error paths); (6) timeout surfaces typed error to callers (tested); (7) prompts' user content cannot override system instructions in template rendering (unit test with injection string).
- **API/DB:** additive table + settings. **Security:** keys server-side only; no AI for authz/validation — explicitly documented in module docstring.
- **Dependencies:** none for infra; blocks 41–45, 58, 63 (59 uses the fake-provider test seam). **Priority / size:** P0 · L. **Out of scope:** embeddings/RAG infra (unless approved as part of 41's design), multi-model routing, fine-tuning.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M3|priority:high|size:M|type=feature|backend -->
### Story 41 — Grounded document explanations — supersedes issue #5

- **Purpose:** Plain-language explanations of extracted content and (where applicable) analysis summaries, grounded in the actual document and visibly non-authoritative.
- **Scope:** implement `Explanation` usage: on demand (`POST /documents/{id}/explain`) and after extraction success (optional auto-flag): pipeline = load `raw_extracted_json` (+ validation summary from 15) → context builder with hard token budget (truncate with notice; never silent) → AI call purpose `explanation` → store {summary_text, source_map JSON (statements → source field/offset where mappable), model, prompt_version, usage_id, disclaimer fixed string} on `Explanation` table (extend additively: `model`, `prompt_version`, `source_map`, `disclaimer` nullable columns); endpoint `GET /documents/{id}/explanations` returns `ExplanationPublic` + metadata; ownership enforced; cache per (document, prompt_version) to control cost; if insufficient content → typed refusal stored as explanation with `status=insufficient` (no fabricated summary).
- **Acceptance criteria:** (1) explanation generated for VCF fixture references actual file facts (test with fake provider returning templated text — assert store contains source_map + disclaimer); (2) refusal path: empty extraction → `insufficient` result, HTTP 200 with explicit status, **no** LLM call (mock asserts zero calls); (3) every stored explanation carries model + prompt_version + disclaimer; (4) regenerate endpoint creates new row (history kept) and rate-limits apply; (5) cross-user access 404; (6) cost: single 10 MiB doc → exactly 1 AI call (usage log assertion).
- **API/DB:** additive columns + endpoints; client regenerated; frontend still untouched (43).
- **Integrity/Security:** AI output labelled "AI-generated explanation — verify against sources" (AiDisclosureTag); cannot alter extraction results or validation states (no write paths to those tables); prompt-injection defenses from 44 apply (land 44's context-builder rules here if 44 not merged — minimum bar: document content wrapped as untrusted data).
- **Dependencies:** 40, 15. **Priority / size:** P0 · M. **Out of scope:** analysis-output explanations (needs 25; follow-up ticket when 25 lands), streaming (42 brings SSE), translations.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M3|priority:high|size:L|type=feature|backend -->
### Story 42 — Conversations and streaming chat — supersedes issue #6

- **Purpose:** Follow-up Q&A about a document with grounded context, streaming answers, and strict authz.
- **Scope:** endpoints per existing schemas + additions: `POST /documents/{id}/conversations`, `GET /documents/{id}/conversations`, `POST /conversations/{id}/messages` (body {content}) → **SSE stream** of tokens + final `done` event carrying message ids + usage; `GET /conversations/{id}/messages` paginated; persistence to existing `Conversation`/`Message` tables (extend `Message` additively: `usage_id`, `disclaimer`, `refusals JSON`); conversation context = system prompt (purpose `chat`) + document summary (from 41 if present, else extraction excerpt) + last N messages within token budget; server enforces: ownership per message, per-user rate limits (40), max messages/turn, max conversation length (rolling truncation policy documented), refusal handling (InsufficientEvidence → streamed plain refusal + structured `refusals` with reason); moderation-lite: no prompt logs at INFO level; disconnect-safe (partial message persisted with `interrupted` flag — additive column).
- **Acceptance criteria:** (1) send message → SSE token stream received in order → final message persisted with disclaimer; (2) non-owner conversation access → 404 at every endpoint (tested); (3) context budget respected: 200-message conversation still ≤ N tokens (test with fake provider asserting payload size); (4) rate limit hit mid-conversation → 429 stream error event, message not persisted as answer; (5) insufficient-evidence query → refusal text + `refusals` metadata (fake provider test); (6) usage log per turn; (7) load test informal: 20 concurrent streams don't interleave responses between users (test with tagged providers).
- **API/DB:** additive columns + SSE endpoints; client regenerated; OpenAPI documents SSE via description (client raw handling in services layer as with file fetch).
- **Dependencies:** 40, 41. **Priority / size:** P0 · L. **Out of scope:** multi-doc chat, voice, citations UI (43), fine-tuned moderation service.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M3|priority:high|size:M|type=feature|frontend -->
### Story 43 — Wire real explanations and chat into the UI (replace mocks)

- **Purpose:** Delete the mock layer in `services/documents.ts`; the core product promise becomes real.
- **Scope:** `ExplanationPanel`: fetch `GET /documents/{id}/explanations`, render summary + `AiDisclosureTag` + model/prompt metadata (collapsible "About this explanation"), generate/regenerate buttons with loading + insufficient state + error/retry; empty state explains "Generate explanation" (real button); `DocumentChat`: replace mock send/list with real endpoints, SSE consumption via `fetch` + ReadableStream, markdown rendering (evaluate `marked` or `react-markdown` — small justified dep), interrupted-message indicator, rate-limit/refusal surfacing (429 banner, refusal styling), message persistence across reload, auto-grow textarea (D14), regenerate last answer; delete `getExplanation`/`getConversation`/`listMessages`/`sendMessage` mocks entirely; fixture-mode chat demo removed.
- **Acceptance criteria:** (1) `services/documents.ts` contains zero mock/timeout-only methods (grep in CI); (2) upload → extraction success → Generate explanation → text + disclosure tag visible (Playwright with fake-provider backend fixture); (3) chat: send → streamed tokens render incrementally → reload shows history; (4) rate-limit 429 renders actionable banner; (5) refusal renders as styled notice, not an error; (6) Story 7 regression specs updated and green; (7) axe clean for chat region (aria-live for stream).
- **API/DB:** none new (consumes 41/42); SSE client helper in `services/ai.ts`.
- **Dependencies:** 7, 41, 42. **Priority / size:** P0 · M. **Out of scope:** conversation list UI beyond current doc scope, citations click-through.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M3|priority:high|size:M|type=chore|backend -->
### Story 44 — Prompt-injection resistance and AI input hardening

- **Purpose:** Uploaded documents are attacker-controllable input; treat them as untrusted data in every AI path.
- **Scope:** central `context_builder` module (single choke point used by 41/42/45): untrusted content wrapped in strict delimiters with instruction "data only" preface; length caps + per-document excerpts policy; strip control chars; never interpolate document text into system prompt or tool calls; output hygiene: escape/markdown-sanitize before UI render (frontend renders AI text as sanitized markdown — verified in 43); store `risk_flags` (heuristics: "ignore previous instructions" patterns) on AI responses (additive column) surfaced as info chips; logging: prompt content never logged (structured logger filters); tests: red-team suite with 15+ injection payloads across explanation+chat asserting (a) system prompt unchanged, (b) fake provider receives payload only in user/data slots, (c) refusal path triggers on forced-claim payloads when evidence absent.
- **Acceptance criteria:** (1) red-team suite green; (2) single choke point enforced — any AI caller must import `context_builder` (arch test/lint rule); (3) risk flags shown in UI as neutral info (43 wires chip); (4) log scan test: no document body in log records during generation.
- **Dependencies:** 40 (module placement), 41/42 (call sites — can land immediately after 41). **Priority / size:** P0 · M. **Out of scope:** content moderation of user chat (spam), external jailbreak services.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M3|priority:medium|size:M|type=chore|backend -->
### Story 45 — AI evaluation suite (faithfulness & behaviour gates)

- **Purpose:** Repeatable evidence that AI outputs stay grounded, disclosed, and safely refuse.
- **Scope:** `tests/ai/` (marked `ai_eval`, run locally + nightly CI, not per-PR if provider cost): golden dataset of ~20 cases (VCF fixture + expected facts list, insufficient-content case, injection case, ambiguous-stats case) with **fake-provider mode** for deterministic PR runs + **live mode** for nightly; metrics: grounded-claim check (required facts present in source_map), hallucination probe (prohibited claims list must not appear), refusal correctness, disclosure string present, response ≤ budget; runner produces JSON report + `docs/ai-eval-baseline.md` snapshot; PR CI runs fake-mode subset as gate.
- **Acceptance criteria:** (1) fake-mode suite green in Story 5 pipeline; (2) live nightly job documented (manual until M4; cost cap respected); (3) baseline drift fails with diff report; (4) prohibited-claims list co-reviewed by scientific reviewer (record in doc); (5) both 41 and 42 paths covered.
- **Dependencies:** 41, 42, 44. **Priority / size:** P1 · M. **Out of scope:** LLM-as-judge pipelines (needs approval), human rating UI.

---

<!-- ISSUE: labels=epic:ai-security|milestone:M2|priority:high|size:M|type=chore|backend+frontend -->
### Story 46 — Authentication hardening (session storage decision) — ⚖ decision gate

- **Purpose:** Close known auth weaknesses before wider use. ⚖ **Decision: stay on localStorage JWT (default) or migrate to httpOnly SameSite=strict cookies (recommended)?**
- **Scope (recommended path):** backend: login sets httpOnly cookie (`access_token`, `Secure` in prod, `SameSite=Lax` minimum) **in addition to** body token during a deprecation window; frontend reads no token from localStorage — `OpenAPI.TOKEN` falls back to cookie auth (cookie sent automatically; withCredentials on axios); CSRF: double-submit token for state-changing routes or SameSite strict + custom header check (choose one, document); `isLoggedIn` guard validates via `GET /users/me` (fix presence-only guard D); 401/403 handler → soft redirect without full page reload; logout clears cookie server-side (`POST /login/logout`); timeline: old clients keep working during window, then localStorage removal.
- **Acceptance criteria:** (1) after migration, `localStorage` contains no `access_token` post-login (Playwright assert); (2) XSS can no longer exfiltrate session token (token not in JS-readable storage — code review + test); (3) CSRF test: cross-site POST without header rejected; (4) all existing auth Playwright specs updated & green; (5) guard rejects invalid tokens immediately (redirect within one failed request); (6) admin routes still admin-gated server-side.
- **API/DB:** additive endpoint (logout); no schema change.
- **Dependencies:** Story 4 (test repairs), can run parallel to M2 features; blocks "M2 done". **Priority / size:** P0 · M (with decision) / S (without). **Out of scope:** refresh-token rotation, MFA, SSO.

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:high|size:L|type=feature|backend+frontend -->
### Story 47 — Learning domain models and Academy shell

- **Purpose:** The persistence backbone for all Academy features.
- **Scope:** tables: `LearnerProfile` (user_id, programming_level, biology_knowledge, math_comfort, python/linux/data_familiarity, goal enum `bioinformatics-engineering|computational-genomics|research-multi-omics`, updated_at); `LearningPath` (code, title, description, audience, sequence JSON of module codes); `Module` (code, path refs, title, summary, order, est_minutes, prerequisites); `Lesson` (module_id, slug, title, type `article|quiz|exercise|lab|capstone`, content_ref (repo path to authored content), order, estimated_minutes); `LessonProgress` (user_id, lesson_id, state `not_started|in_progress|completed`, score nullable, quiz_answers JSON nullable, completed_at, attempt_count); `SkillDemonstration` (user_id, skill_code, evidence JSON — quiz pass / lab test pass / capstone artefact, demonstrated_at); seeded paths (foundation → data-literacy → python → multi-omics, per brief §9) with module/lesson rows pointing to content files that Story 49–54 author (placeholder content files with honest "content pending" bodies until then); endpoints: profile CRUD (own), paths+modules+lessons catalog (authenticated), progress read/write (own), `GET /me/academy/summary` (aggregates for dashboard); Academy route group shell in frontend (from Story 1 placeholders): `/academy` overview with catalog cards, `/academy/path` renders current path structure with per-lesson state, breadcrumbs, loading/empty/error states.
- **Acceptance criteria:** (1) profile save → summary reflects goal + recommended path (rule table: goal→path mapping documented); (2) progress write/read round-trip; (3) catalog lists seeded structure with content-pending lessons flagged (visible honest state, not fake completion); (4) cross-user progress access denied; (5) migration additive; Playwright: visit academy → see catalog → open lesson → mark complete → summary updates; (6) dashboard Story-1 Academy panel can consume `/me/academy/summary` (contract test).
- **API/DB:** 6 additive tables + endpoints; content files under `content/academy/` (repo). **Dependencies:** none (start of M4 stream; UI styling per Story 1). **Priority / size:** P0 · L. **Out of scope:** content authoring (49–54), labs runtime (57), social features.

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:high|size:M|type=feature|frontend+backend -->
### Story 48 — Personalised onboarding assessment and path recommendation

- **Purpose:** Diagnose background and recommend a path; goal changeable later.
- **Scope:** onboarding flow at `/academy/onboarding` (4 short steps, one question group each: programming background, biology knowledge, math/stats comfort, tooling (Python/Linux/data) + goal select; skippable with defaults = "unknown" and a general path); recommendation engine: pure rule table (e.g., strong programming + no biology → `foundations` first with accelerated data-literacy; biologist + no code → `python-bridge` variant) — deterministic, unit-tested, no AI; result screen: recommended path, "why" bullet points derived from answers (templated, not generated), buttons "Start path" / "Retake" / "Change goal" (settings link); progress saved at each step (draft state on profile); completion dismisses the academy placeholder CTA on dashboard (consumes 47 summary).
- **Acceptance criteria:** (1) answer patterns A/B/C map to documented paths (parameterized tests); (2) retake overwrites profile and re-recommends; (3) skip → general path, UI states it's unpersonalised; (4) goal change from settings re-recommends without losing progress; (5) Playwright full onboarding flow green; (6) no free-text answers reach an LLM (no AI in story).
- **API/DB:** profile fields already in 47; recommendation logic backend or frontend? **Decision:** backend `GET /academy/recommendation` for testability (small endpoint added to 47's service).
- **Dependencies:** 47. **Priority / size:** P1 · M. **Out of scope:** adaptive re-assessment, video-based placement.

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:high|size:L|type=content -->
### Story 49 — Biology foundations content (lessons, quizzes, diagrams)

- **Purpose:** Beginner biology pathway per brief §9B, authored in-repo and connected to workspace concepts.
- **Scope:** author `content/academy/biology/*` markdown lessons (cells → DNA/RNA/gene/chromosome/protein → transcription/translation → expression/regulation → variation/mutations → inheritance/disease basics → vocabulary recap): each lesson = plain-English prose, ≤1 qualified programming analogy (explicit "analogy, not mechanism" callout box), SVG diagram(s) (hand-authored, dark-theme friendly), prerequisite links (frontmatter `prereqs:`), glossary links to Concept Explorer slugs (55), end quiz (3–5 MCQ JSON with explanations), "In your workspace" box linking real UI concepts (e.g., "your VCF files carry variants from this gene region — see Data Sources"); quiz items validated by a content linter (Story-based script: frontmatter schema, link integrity, required sections); scientific-review checklist in PR.
- **Acceptance criteria:** (1) all lessons pass content linter in CI; (2) every lesson has ≥1 diagram, ≥1 quiz, prereq links resolve to existing slugs; (3) analogy boxes present and worded as non-literal (review checklist); (4) learner with zero biology passes quiz 1 (usability spot-check documented); (5) no medical/clinical claims (linter keyword list + human review).
- **Dependencies:** 47 (slot registration), 48 (path wiring), 55 (slug contract — agree slug list first). **Priority / size:** P1 · L (content-heavy). **Out of scope:** video, translations, adaptive difficulty.

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:high|size:L|type=content -->
### Story 50 — Genomics data-literacy content (formats, assemblies, QC)

- **Purpose:** Teach the concepts behind OmicTerms' real file types per brief §9C.
- **Scope:** `content/academy/data-literacy/*`: FASTA/FASTQ (incl. quality scores), reference genomes/assemblies (GRCh38 vs hg19 — ties to Story 17 metadata fields), coordinates & annotation (0/1-based — ties to validation codes), VCF structure (tiny synthetic examples), expression matrices, sample sheets (link to workspace Sample model), QC concepts, raw→processed→output→interpretation lifecycle (mirrors OmicTerms' own pipeline: upload→extract→validate→analyze→report); exercises use **small synthetic/licensed files** in `content/academy/data-literacy/data/` (each with provenance README: generated-by, license); every topic maps to a workspace UI anchor (link) and a validation code where one exists; quizzes + "spot the problem" items aligned to Story 16's real error codes.
- **Acceptance criteria:** (1) content linter green; (2) every synthetic dataset has a license/provenance README; (3) ≥5 lessons reference actual validation codes with screenshots/commands matching Story 19 UI (checked at review); (4) quiz answers deterministic (MCQ); (5) scientific review recorded.
- **Dependencies:** 47, 16/19 (references), 48. **Priority / size:** P1 · L. **Out of scope:** cloud data subscriptions, large public datasets (size/licensing risk).

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:high|size:L|type=content -->
### Story 51 — Python bioinformatics exercises (with tests)

- **Purpose:** Progressive coding practice per brief §9D — "I watched it" → "I can do it" (aligns with repo's existing `practice.md` culture).
- **Scope:** `content/academy/python/*` exercise packages (5–7): parse FASTA/FASTQ → inspect base quality → read/normalise VCF records → pandas expression-table ops → validate sample metadata (reuse Story 17/18 rules in miniature) → write tested CLI script with documented workflow; each exercise: `README.md` (goal, starter `exercises/` code with `NotImplementedError` slots, hints ladder), `solution/`, `tests/` (pytest, runnable locally: `uv run pytest content/academy/python/<slug>/tests`), expected-output fixtures; **execution environment: local-run instructions in M4 phase 1 (no server execution — decision ⚖ defers sandboxed execution to 57)**; a repo script `scripts/check_exercises.py` runs all exercise tests in CI (solutions excluded from learner view via packaging note — acknowledge learners can read the repo; acceptable for this audience).
- **Acceptance criteria:** (1) CI runs exercise tests (starter fails, solution passes — verified by runner in both modes); (2) each exercise ≤30 min estimated with graded hints; (3) no dependency beyond stdlib+pandas(+biopython only if justified); (4) links to data-literacy lessons (50) in prerequisites; (5) docs how-to-run published.
- **Dependencies:** 47, 50. **Priority / size:** P1 · L. **Out of scope:** server-side code execution (57), autograding of learner submissions, IDE integration.

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:medium|size:M|type=content -->
### Story 52 — Multi-omics concepts content

- **Purpose:** Teach what each omics layer measures and the limits of linkage (brief §9E).
- **Scope:** `content/academy/multi-omics/*`: genomics vs transcriptomics vs epigenomics vs proteomics vs microbiome (what is measured, file types → registry entries from Story 20, example tools incl. NanoVar/MethMotif/TFregulomeR **as described tools, not as integrated features**), integration considerations (sample matching → link to Story 18's checks), inference limits & experimental design primer, stats sanity (multiple testing → link to Story 25's BH-FDR explanation), "how OmicTerms connects them" walkthrough mapped to Evidence Map (29); quizzes; each concept slug seeded into Concept Explorer (55).
- **Acceptance criteria:** (1) linter + review; (2) every layer lesson links its registry format row; (3) explicit "what this tool does NOT prove" section per lesson; (4) no claim of integrated support for planned tools (wording review); (5) slugs match 55 registry.
- **Dependencies:** 47, 20 (registry content), 50. **Priority / size:** P1 · M. **Out of scope:** hands-on multi-omics lab (58 capstone covers a scoped version).

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:high|size:M|type=feature|backend+frontend -->
### Story 53 — Progress tracking, assessments, and live dashboard Academy panel

- **Purpose:** Progress measured by demonstrated understanding; dashboard panel goes live.
- **Scope:** endpoints to write quiz results (`POST /academy/lessons/{id}/quiz` — server-graded against content JSON, stored on `LessonProgress.score` + skill demo on pass ≥ threshold), lab completion hooks (from 58), capstone artefact registration (from 54); `GET /me/academy/summary` returns: current path, completed/in-progress counts, next recommended lesson (rule: first incomplete by sequence whose prereqs are complete), overall %, recent demonstrations; frontend: `/academy/progress` dashboard (per-module progress rings, quiz history, skills list, "retake" affordances) + Story 1 dashboard Academy panel switches from placeholder to real data (progress bar, next-lesson CTA → lesson route, module chips with states).
- **Acceptance criteria:** (1) quiz submit → graded response returns correct/incorrect + explanation; score persists; summary's next-lesson recomputes (tests on sequences incl. prereq blocking); (2) dashboard panel shows real % for a seeded learner (Playwright); (3) learner who skips ahead gets prereq-blocked message, not fake unlock; (4) all data own-user only (authz tests); (5) empty state for brand-new user still honest ("No path started").
- **API/DB:** extends 47 tables (additive columns if needed: `summary` endpoint only otherwise). **Integrity:** completion = demonstrated (quiz pass/lab test), never time-watched (rule documented in UI copy).
- **Dependencies:** 47, 48, 49–51 (need content to score), 1 (panel). **Priority / size:** P0 · M. **Out of scope:** leaderboards, certificates.

---

<!-- ISSUE: labels=epic:academy|milestone:M4|priority:medium|size:L|type=content -->
### Story 54 — Guided capstone: end-to-end beginner project

- **Purpose:** One project proving the whole loop: inspect → validate → analyse → provenance → interpret → evidence-backed report (brief §9J).
- **Scope:** `content/academy/capstone/*`: staged brief using a bundled synthetic cohort (small RNA-seq counts + sample sheet + a VCF subset — synthetic, licensed, provenance README): Stage 1 upload+inspect (uses real workspace), Stage 2 validate (must encounter planted Story 16/18 issues and resolve/annotate), Stage 3 run DE (Story 25) and/or variant QC (27 if exists — keep DE path canonical), Stage 4 read provenance/manifest (35), Stage 5 draft a mini-report (36/37) with ≥3 evidence links, Stage 6 reflection quiz on limitations; rubric JSON per stage (auto-checkable parts server-side, reflective parts self-check); completion emits `SkillDemonstration(capstone)`; UI: `/academy/labs/capstone` runner page (stage checklist, links into workspace, progress persisted); expected outcomes + explicit limitations box ("what this does not demonstrate").
- **Acceptance criteria:** (1) a fresh test user can complete stages 1–5 in Playwright happy-path (scripted with fixture backend fakes where M4 deps absent — flag which stages are blocked until their stories exist and mark them skipped honestly); (2) rubric auto-checks implemented server-side for stages with deterministic criteria; (3) capstone content passes linter + scientific review; (4) completion visible on progress page (53); (5) dataset ≤5 MB total with README provenance.
- **Dependencies:** 15, 19, 25, 35, 36/37, 47, 53 (many — **capstone is final M4 story**). **Priority / size:** P1 · L. **Out of scope:** mentor review, publishing capstones.

---

<!-- ISSUE: labels=epic:explorer-labs|milestone:M4|priority:high|size:M|type=feature|backend+frontend -->
### Story 55 — Concept Explorer: glossary model, content, and search UI

- **Purpose:** Searchable concept layer connecting plain-English, technical definitions, prerequisites, formats/tools, and workspace examples (brief §9F).
- **Scope:** `Concept` table (slug PK, term, aliases[], plain_definition, technical_definition, body_ref (content file), related_slugs[], prereq_slugs[], format_refs[], tool_refs[], workspace_refs (JSON: routes/panels), created/updated) + seeded via content files under `content/concepts/*` (one YAML/MD per concept, linter-checked); endpoints: `GET /concepts?search=&tag=`, `GET /concepts/{slug}` (with resolved related terms), full-text search (Postgres `tsvector` generated column or `ILIKE` fallback — choose by migration simplicity, document); frontend `/academy/concepts`: search-as-you-type with keyboard nav, result list (term + plain definition snippet), detail page (definition pair tabs [Plain / Technical], prerequisites chain rendered as links, related chips, "Seen in your workspace" deep links, mini knowledge-check quiz (3 Q, from content), source references section (must cite content sources for scientific statements — frontmatter required); knowledge-check scores optionally feed 53 (skill demo per concept — additive).
- **Acceptance criteria:** (1) search "methylation" returns concept with both definitions; (2) alias search works ("expression matrix" → counts concept); (3) prereq chain cycles rejected by linter (CI); (4) every concept has ≥1 source reference or explicit `no-citation-needed` tag (linter); (5) deep links land on real routes (Playwright); (6) quiz scoring persists when learner logged in; (7) axe clean.
- **API/DB:** table + FTS column + endpoints; content seed migration. **Integrity:** sources required for scientific claims — content linter enforces.
- **Dependencies:** 47 (quiz persistence optional), 49/50/52 (slug corpus), 1 (UI). **Priority / size:** P0 · M. **Out of scope:** AI-generated definitions (static authored content only), ontology imports (OBO/EDAM future).

---

<!-- ISSUE: labels=epic:explorer-labs|milestone:M4|priority:high|size:L|type=feature|decision -->
### Story 56 — Interactive Labs runtime ⚖ (execution-environment decision gate)

- **Purpose:** Safe, beginner-friendly hands-on environment (brief §9G). ⚖ **Decide before start: browser-only Pyodide (recommended phase 1) vs server sandboxed execution (containers + seccomp + quotas) vs hybrid.** No user code runs on the app server under any option without isolation review sign-off.
- **Scope (recommended Pyodide path):** `components/Labs/`: lab runner page at `/academy/labs/{lab_id}`: split view (instructions/markdown left, code editor right — CodeMirror 6 eval or Monaco eval; justify choice), Pyodide loaded lazily from self-hosted assets (no CDN), file drop-in of lab datasets into virtual FS, "Run tests" executes lab's pytest-style assertions in-browser against learner code, output panel (stdout/results), pass/fail per assertion, hint ladder, reset, autosave (localStorage + optional server sync of code strings if 47 adds `LabSubmission` — keep phase 1 local-only if absent); lab manifest format (JSON: files, tests, limits — runtime enforces wall-clock + loop guard heuristics); states: loading-runtime (progress), runtime-error, test-pass celebration (restrained), offline/unsupported-browser fallback message with local-run instructions.
- **Acceptance criteria:** (1) no network calls to arbitrary URLs from lab runtime (lab assets local); (2) learner code never reaches the FastAPI server (network tab assertion in test); (3) a 10k-loop infinite code case terminates with timeout message ≤10 s; (4) lab manifest drives UI — adding a lab requires no code change (integration test with fixture lab); (5) Playwright runs one full lab to pass; (6) a11y: editor has accessible fallback instructions.
- **API/DB:** none in phase 1 (optional `LabSubmission` later). **Security:** the decision record (ADR) must cover XSS-from-lab-content, resource exhaustion, and version pinning of Pyodide assets.
- **Dependencies:** 47 (route shell), ⚖ decision. **Priority / size:** P1 · L. **Out of scope:** arbitrary package installs, GPU, collaborative editing.

---

<!-- ISSUE: labels=epic:explorer-labs|milestone:M4|priority:high|size:L|type=content -->
### Story 57 — Interactive lab content set

- **Purpose:** 5–7 labs teaching inspect → validate → process → interpret on synthetic data (brief §9G).
- **Scope:** labs: (1) inspect a FASTQ's quality; (2) hunt-and-fix a malformed VCF (tie to real validation codes); (3) sample-sheet consistency; (4) expression matrix with pandas; (5) provenance detective (read a manifest, spot missing info); (6) mini multi-omics match (join metadata across two synthetic files); manifest + datasets + tests + hints per lab, authored under `content/academy/labs/`; each lab maps to skill demonstrations (53) and links concept slugs (55); provenance README for datasets; content linter + review.
- **Acceptance criteria:** (1) every lab passes in the 56 runtime as both learner-starter (fails) and solution (passes); (2) datasets ≤2 MB each, synthetic, licensed; (3) difficulty ladder documented with prereq lessons; (4) completion events wired to 53; (5) scientific review recorded.
- **Dependencies:** 56 (runtime), 50/55 (links). **Priority / size:** P1 · L. **Out of scope:** real patient/cohort data (ethics/PII excluded absolutely).

---

<!-- ISSUE: labels=epic:explorer-labs|milestone:M4|priority:medium|size:L|type=feature|backend+frontend -->
### Story 58 — Research Paper Translator

- **Purpose:** Guided explanation of paper terminology/methods/figures linked to actual passages (brief §9H).
- **Scope:** justified by existing document pipeline (PDF upload + extraction): new document type scope `paper` (PDF): extraction already provides per-page text (extend `extraction.py` additively with page index preservation if missing — verify; small backend story tightly coupled); endpoints: `POST /documents/{id}/paper/ask` {question, selection?} → grounded answer over page text with page/paragraph citations (reuse 40–42 infra + 44 defenses; context = selected passage ± window), `GET /documents/{id}/paper/glossary` → extracted terms with definitions from Concept corpus first (55), falling back to AI marked as such; frontend: paper reader view (page text left, Q&A right), text selection → "Explain selection", citations click-to-scroll, glossary sidebar chips, **two visually distinct bubbles: "Authors say" (quote-backed, shows quote) vs "AI interpretation" (disclosure tag)**; refusal when selection empty → forces selection (no free-form paper-wide overclaiming).
- **Acceptance criteria:** (1) every AI answer contains ≥1 verifiable citation (page/quote) or is a refusal (test with fake provider); (2) "Authors say" block always includes verbatim quote matching extracted text (string containment test); (3) concept-first glossary: term in 55 → local definition used, no AI call (usage-log assertion); (4) injection payloads in PDF text handled per 44; (5) Playwright: select passage → explain → citation scroll works; (6) labels/disclosures reviewed for overclaiming.
- **API/DB:** additive endpoints + possibly `extraction` page-index column (small migration); depends heavily on 41/42/44/55.
- **Integrity:** never fabricate figure contents — figures are out of extraction scope; UI must say "figures not analysed" when asked about figures (refusal template).
- **Dependencies:** 41, 42, 44, 55, 7. **Priority / size:** P2 · L. **Out of scope:** OCR figure caption analysis, full paper summarisation reports, citation-graph features.

---

<!-- ISSUE: labels=epic:hardening|milestone:M3|priority:high|size:M|type=chore -->
### Story 59 — End-to-end coverage of core journeys

- **Purpose:** CI-proven coverage of the flows that define the product.
- **Scope:** Playwright specs: (1) signup → onboard-empty dashboard → upload → extraction success → validate → revalidate; (2) hierarchy manage (Story 10) → upload into created sample; (3) run analysis → charts → finding create → evidence link → validate finding; (4) report build → audit fix → publish → export download; (5) explanation + chat happy path with fake-AI backend seam (test-only provider mode flag); (6) auth hardening regressions (46) incl. cookie assertions; promote Playwright job from optional to blocking in CI (Story 5); add mobile-viewport smoke (390×844) for dashboard+documents; document how to run full suite locally.
- **Acceptance criteria:** (1) six journeys green locally & in CI; (2) CI Playwright job required for merge; (3) flakiness <5% across 10 consecutive runs (report in PR); (4) no test depends on real AI provider or network egress; (5) test data seeded deterministically (conftest factories).
- **Dependencies:** Stories 7, 10, 19, 25/26, 30/31, 37/39, 43, 46 (as merged — **write incrementally**, final story number closes when all exist; partial delivery acceptable with checklist on issue). **Priority / size:** P0 · M. **Out of scope:** performance/load testing (separate decision when usage exists).

---

<!-- ISSUE: labels=epic:hardening|milestone:M2|priority:medium|size:M|type=chore -->
### Story 60 — Deployment hardening and operational documentation

- **Purpose:** Ship confidently: reproducible deploys, health, observability, no hard-coded secrets.
- **Scope:** review `docker-compose.yml`: add migration step to backend startup (`alembic upgrade head` in entrypoint — verify current Dockerfile does this; make explicit), verify tesseract availability in image (OCR works in container), healthcheck endpoints remain, `SECRET_KEY`/`FIRST_SUPERUSER_PASSWORD` must be provided (fail fast when default in production — config already warns/raises: test it); Sentry init docs (DSN optional env), structured logging fields (request_id from 32), backup note for Postgres volume + uploads dir (pg_dump script `scripts/backup.sh` + restore tested once), `.env.example` files (names + safe defaults, no secrets), production deployment doc (reverse proxy, TLS termination at proxy, frontend nginx config already exists — document), run-book: common failures (migration mismatch, OCR missing, AI budget tripwire, disk full for uploads).
- **Acceptance criteria:** (1) fresh clone + `.env.example` → compose stack boots, migrations apply, superuser seeds, healthchecks green; (2) production mode with default `SECRET_KEY` refuses to boot (automated test); (3) backup/restore script demonstrated on disposable volume (record commands in PR); (4) no secret values committed (secret-scan step in CI — gitleaks action or equivalent); (5) run-book covers each scripted failure.
- **Dependencies:** 13 (job semantics in run-book), 32 (request ids). **Priority / size:** P1 · M. **Out of scope:** k8s/terraform, autoscaling, blue-green.

---

<!-- ISSUE: labels=epic:hardening|milestone:M3|priority:medium|size:M|type=chore -->
### Story 61 — Documentation and architecture decision records

- **Purpose:** Replace empty/stale docs with sources of truth.
- **Scope:** write `backend/README.md` (setup, env vars by **name**, test/lint commands, migrations, architecture map of `app/`); root `README.md` refresh (accurate feature status incl. what's mocked/planned, badge row, quickstart validated from scratch, link to planning docs); `docs/adr/` records for decisions already made (001 design tokens approach, 002 BackgroundTasks→job table, 003 adapter/registry pattern, 004 JWT→cookie, 005 AI provider abstraction + no-AI-for-rules rule, 006 lab runtime choice) — template with context/decision/consequences; `docs/validation-codes.md`, `docs/adapters.md`, `docs/design-tokens.md` exist (owners: 16/21/1 — **verify + link, don't duplicate**); API conventions doc (severity taxonomy, provenance emission, fixtures policy); contributor workflow (branch, CI gates, PR checklist incl. scientific-review label when content touched); delete/move `contract.txt` (unrelated product) and empty strays flagged in audit (D13).
- **Acceptance criteria:** (1) quickstart executed verbatim by a fresh environment succeeds (record in PR); (2) every ADR has status Accepted + date; (3) README feature-status table matches backlog reality at merge time; (4) no docs instruct commands that fail (link checker on relative links); (5) contract.txt relocated to `docs/attic/` or deleted (owner approval noted).
- **Dependencies:** tracks all stories; **final consolidation after M3**. **Priority / size:** P1 · M. **Out of scope:** user manual site, i18n, API reference portal (FastAPI /docs suffices).

---

<!-- ISSUE: labels=epic:hardening|milestone:M3|priority:high|size:M|type=chore -->
### Story 62 — Accessibility audit and remediation

- **Purpose:** Full WCAG 2.1 AA pass across all surfaces post-redesign (Story 1 provides baseline only).
- **Scope:** automated axe suite extended to every route (login, signup, reset, admin, settings, documents ×3, academy, evidence, reports, integrations) with serious/critical = fail; manual keyboard audit script (tab order, focus traps in dialogs/sheet, skip-to-content link — add if missing); colour-contrast report over token pairs (script asserting computed styles ≥4.5:1 body / ≥3:1 large+UI); screen-reader pass on: upload dialog, validation list, evidence inspector, report editor, chat (aria-live), labs; remediation fixes; `docs/a11y.md` (scope, known issues + dates, testing instructions).
- **Acceptance criteria:** (1) zero serious/critical axe violations across route list; (2) contrast script green for all token pairs; (3) documented keyboard path completes upload→validate→finding→report on desktop; (4) known-issues list empty or dated with owners; (5) CI runs axe suite (extends 9/59).
- **Dependencies:** 1 (baseline), 8, 19, 31, 37, 43 (all surfaces must exist first → late M3). **Priority / size:** P1 · M. **Out of scope:** AAA, cognitive-audit formal study (future research).

---

<!-- ISSUE: labels=epic:evidence-findings|milestone:M3|priority:medium|size:M|type=feature|backend+frontend -->
### Story 63 — AI-assisted finding drafting (advisory, never authoritative)

- **Purpose:** Let AI speed up drafting a finding from *already-linked* evidence without ever presenting generated language as a validated conclusion.
- **Scope:** frontend: "Draft with AI" affordance in the new-finding form (Story 31) — user must first attach ≥1 evidence ref; request → backend `POST /findings/draft` {evidence_ids[]} → context builder (Story 44, purpose `drafting`) → structured response {title, summary, caveats[]} grounded only in the provided evidence context; all returned text rendered with `AiDisclosureTag` and remains tagged until the user edits the field (confirmed via `edited_after_draft` flag); drafted findings are forced `status=draft` — publish rules from Stories 30/36 are unchanged and unaffected; insufficient/low-context evidence → typed refusal (no generated text, no LLM call when context empty); usage logged with purpose `drafting` (Story 40 limits apply); an eval case joins Story 45's suite (draft must not contain claims absent from supplied context).
- **Acceptance criteria:** (1) drafting endpoint rejects zero-evidence requests (422) and never calls the provider (mock assertion); (2) response fields strictly {title, summary, caveats[]} — schema-validated, extra content rejected; (3) UI disclosure tag persists until user edits; (4) drafted finding cannot bypass publish/evidence gates (tests from 30/36 still green); (5) usage log row + rate limit enforced; (6) eval case proving no out-of-context claims in fake-provider mode added to CI gate.
- **API/DB:** one additive endpoint; no schema beyond `edited_after_draft` boolean on `Finding` (additive migration with 30 if not yet shipped, else small follow-up).
- **Integrity/Security:** AI may only summarise material the user already linked; it cannot create evidence refs, set `validation_state`, or publish; prompt-injection defenses of 44 apply to all evidence content.
- **Dependencies:** 30, 31, 40, 41, 44. **Priority / size:** P1 · M. **Out of scope:** auto-attaching evidence, auto-publishing, statistical claims generation, draft language other than English.

---

## Traceability matrix — product brief → stories

| Brief section | Requirement (condensed) | Stories |
|---|---|---|
| §3 visual direction | Dark scientific SaaS design system, semantic colours, typography, density, states | **1**, 6–8, 9 |
| §3 shell | Branding, collapsible sidebar, global search, notifications, help, profile, breadcrumbs, footer | **1**, 11, 12 |
| §3 two-area IA | Research workspace + Learning groups, honest placeholder routing | **1**, 10, 24, 56 |
| §4A welcome banner | Greeting, workspace explanation, 3 entry points, restrained scientific visual | **1** |
| §4B summary cards | Projects, files, integrity, findings, learning — real values or honest states | **1**, 14 (sizes), 19 (integrity), 31 (findings), 53 (learning) |
| §4C evidence map | Multi-omics relationship visualisation, inspect→navigate, all states | **1** (presentation), 28, 29 |
| §4D key findings | Title/summary, justified strength, evidence refs, validation status, inspect path | 1 (empty/fixture), 30, 31 |
| §4E evidence quality + recent files | Quality summary + file list w/ type, status, project link | **1**, 14 (real sizes/hashes), 19, 35 |
| §4F activity/provenance timeline | Real events, actors, timestamps, versions, links | **1** (document-derived), 32, 33, 34 |
| §4G quick actions | Upload/Run/Link/Report with defined behaviour | **1** (honest states), 7 (upload), 25 (run), 30 (link), 37 (report) |
| §4H academy panel | Path, modules, next lesson, progress, route into explorer/labs | **1** (placeholder), 47, 53, 55, 56 |
| §5 integration | Registry, adapters, linking, preservation of identifiers/assembly, compatibility, execution records, extension path (NanoVar/MethMotif/TFregulomeR/forkedTF as *planned*) | 13, 17, 20, 21, 22, 23, 24, (27 stretch) |
| §6 validation | Type/schema, metadata, sample-ID, membership, assembly, coordinates, identifiers, dupes, checksums, compatibility, provenance-of-reference, actionable severities, revalidation, extensible validators, AI never overrides | 14, 15, 16, 17, 18, 19, 23, 41 (explain-only), 44 |
| §7 provenance | Source tracking, run history, versions, params, references, relationships, actor/time, missing-provenance warnings, graph, manifest export, audit events | 14, 22, 32, 33, 34, 35, 60 |
| §8 findings & reports | Claim–evidence links, editor, missing-evidence + numeric checks, overclaim warnings, disclosure of unresolved issues, preview/export, versioning, review states, AI not verified | 30, 31, 36, 37, 38, 39, 41, 45, 63 (advisory AI) |
| §9A Academy onboarding | Background assessment, goal, path recommendation, changeable | 47, 48 |
| §9B Biology foundations | Beginner pathway, plain English, qualified analogies, diagrams, quizzes, prereqs | 49 |
| §9C Data literacy | FASTA/FASTQ, assemblies, coordinates, VCF, matrices, sample sheets, QC, data lifecycle | 50, (55 glossary) |
| §9D Python exercises | Progressive exercises w/ starter, tests, hints, CLI workflows | 51, 56 (runtime) |
| §9E Multi-omics concepts | Layers, linkage considerations, inference limits | 52 |
| §9F Concept Explorer | Definitions, related/prereqs, formats/tools, workspace examples, checks, sources | 55 |
| §9G Interactive labs | Safe environment, synthetic datasets, isolation if executing | 56, 57 |
| §9H Paper translator | Passage-linked explanations, authors vs AI distinction | 58 |
| §9I Progress & assessment | Demonstrated skills, quiz/lab/capstone outcomes, next steps | 53 |
| §9J Capstone | End-to-end beginner project with explicit outcomes/limits | 54 |
| §10 AI trustworthiness | Grounding, source refs, fact/computed/interpret separation, insufficient-evidence handling, injection resistance, server authz, rate/cost/latency, config, evals, disclosures, no LLM for deterministic rules | 40, 41, 42, 44, 45, 46 (authz), 43 (disclosure), 58 |
| §11 UX completeness | Auth/authz, empty/loading/error states, search/sort, a11y, responsive, confirmations, unsaved recovery, audit, privacy/deletion, logging, tests/docs/deploy | 1, 4, 5, 6–12, 46, 59–62 |
| §12 architecture constraints | Incremental changes, conventions, testable logic, versioned migrations, compat, justified deps, ADRs, no hard-coded secrets | 2, 3, 5, 13–15, 21, 22, 60, 61 |

## Risks & assumptions (full list in `2026-10-audit-and-architecture.md` §3.5)

1. **Reference images unviewable by planner** → Story 1 reconciliation step + M1 human gate. *(Risk: dashboard diverges visually; mitigation: deviation log.)*
2. **No AI provider/budget decided** → M3 AI stream (40+) blocked until ⚖ decision.
3. **Existing E2E suite partly stale** → CI introduction (5) may surface reds; fixed by 4 before gates go blocking.
4. **BackgroundTasks durability** → ⚖ job-table decision (13); small blast radius either way.
5. **Scientific accuracy liability** in Academy content, findings "validation" semantics, variant track → mandatory review labels on stories 25, 27, 30, 45, 49, 50, 52, 54, 57.
6. **Scope gravity**: M3 packs integration+AI+evidence+reports — if velocity drops, order within M3 is: provenance(32/33) → validation completion(18/19) → registry/adapters(20/22) → findings(30/31) → AI(40–43) → analysis(25/26) → reports(36–39); reports may slip to M3.5 without breaking other streams.
7. **Assumption**: English-only, single-org multi-user (no orgs/teams model); local-volume uploads acceptable through M3; modern evergreen browsers; macOS/Linux dev.
8. **Storage scaling**: >GB-scale uploads will need the object-storage decision — revisit when Story 14's sizes are monitored.
