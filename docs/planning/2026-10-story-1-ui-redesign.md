# Story 1 — Implement the OmicTerms Professional UI Redesign and Design System

**Epic:** E1 · **Milestone:** M1 (UI review gate) · **Priority:** P0 · **Size:** XL · **Type:** feature
**Depends on:** nothing (first story). **Blocks:** Stories 6–12, 29, 31, 33, 37, 43, 53, 56 (all UI restyling).

> **Planning-time limitation:** the planning model could not view `img/dashboard-dark.png` / `img/dashboard-items.png`. This spec derives the design system from the written product brief and the codebase's existing token system (which already matches the brief's "deep navy + cyan" direction). **The implementing developer must keep the reference images open and reconcile layout details against them.** Where this spec and the images disagree on *layout proportions*, the images win; where they disagree on *data honesty* (fake vs real content), this spec wins. Log every deviation in the PR description.

---

## 1. User story & problem statement

As a researcher using OmicTerms daily — and as a technical beginner entering genomics through the Academy — I need one coherent, professional, information-rich dark interface that (a) makes my projects, data files, integrity status, findings, and activity legible at a glance, (b) connects my research workspace to my learning path, and (c) never lies to me about what is real data versus what is not yet available.

Today's dashboard is mostly decoration (animated motifs, fake genomic coordinates, a static carousel) wrapped around a 5-row document list; the sidebar has no information hierarchy for the product's two purposes; several components hardcode light-mode colours that break in dark mode; fonts are declared but never loaded. This story replaces that with a reviewable, token-driven professional design system and application shell while **preserving every working backend flow** (auth, upload, extraction, classification, rename, delete, admin, settings).

## 2. Context — components affected

**Replaced/rewritten:** `routes/_layout/index.tsx` (dashboard), `components/Sidebar/AppSidebar.tsx` + `Main.tsx` (nav model), `components/Common/{Footer,SpecimenDeck}.tsx`, hero/motif usage in dashboard.

**Restyled in place (token fixes + shell slots only):** `index.css` (tokens), `__root.tsx` (devtools gating), `_layout.tsx` (header/footer/breadcrumbs), `Documents/columns.tsx` (badge colours D9), `Sidebar/User.tsx` (avatar fallback), `ui/sonner.tsx` (D8 theme wiring), `Common/Logo.tsx` (descriptor), new `Common/` primitives (see §7).

**Created:** placeholder route pages (`projects`, `integrations`, `analysis-tools`, `evidence`, `reports`, `academy/*`), `components/Dashboard/*` panel components, `src/fixtures/dashboard.ts`, `src/components/Common/{PageHeader,Breadcrumbs,EmptyState,StatusBadge,PlaceholderPage,DevFixtureBadge,AiDisclosureTag}.tsx`, `hooks/useDashboardData.ts`.

**Untouched:** all backend code; generated API client; login/signup/reset pages (restyled in Story 6); documents list/detail/upload behaviour (visual overhaul in Story 7; Story 1 only fixes their broken badge colours); admin/settings behaviour (Story 8); ExplanationPanel/DocumentChat mocks (replaced by Story 43 — Story 1 must not deepen the mocks).

**No backend, database, or API changes are in scope.** The story uses only existing endpoints: `GET /users/me`, `GET /documents/` (`count`, `data[]` with `extraction_status`, `data_type`, names), `GET /projects/` (`count`, tree), and auth flows.

## 3. Scope

**In scope:** design tokens; typography loading; application shell (sidebar two-area nav, header, breadcrumbs, footer); global search (documents only); notifications surface (empty-state only); dashboard with panels A–H of the product brief; dev-fixture framework; dark-theme defect fixes (D8, D9, D0 devtools, D10 fonts, D12 footer); responsive layouts; accessibility baseline; Story-1-level Playwright tests + manual review checklist.

**Out of scope (deferred):** any backend work; real notifications/search-across-entities; real validation, findings, learning, provenance-graph data (their stories); visual overhaul of documents/settings/admin/auth pages; removal of the ExplanationPanel/DocumentChat mocks; visual-regression CI (Story 9); i18n; light-theme parity beyond "does not break" (dark is the product default; light must remain usable via existing tokens).

## 4. Design system specification

### 4.1 Colour tokens (extend `src/index.css`, keep oklch)

Evolve the existing dark palette (verified current values: background `oklch(0.155 0.025 255)`, card `oklch(0.195 0.025 255)`, cyan primary `oklch(0.75 0.11 195)`). Required changes and additions (dark theme):

| Token | Value (dark) | Role |
|---|---|---|
| `--primary` | `oklch(0.72 0.13 252)` | **Electric blue** — primary actions, active nav, links (⚖ shift from cyan; keep old cyan value as `--accent-cyan`) |
| `--accent-cyan` *(new)* | `oklch(0.75 0.11 195)` | Data-viz accent, focus highlights, selection |
| `--color-valid` *(new)* | `oklch(0.74 0.13 172)` | Valid data, successful validation, completed ops |
| `--color-warning` *(new)* | `oklch(0.80 0.15 78)` | Warnings, needs-review |
| `--destructive` | keep `oklch(0.65 0.19 25)` | Errors, high-priority risks |
| `--color-learning` *(new)* | `oklch(0.70 0.16 305)` | Academy, learning progress, selected evidence |
| `--border` | keep `oklch(1 0 0 / 10%)`; add `--border-strong: oklch(1 0 0 / 16%)` | Subtle vs emphasised dividers |
| `--ring` | set to `--primary` value | Focus rings |

Map to shadcn semantic aliases so existing components inherit: `--chart-1…5` re-derived as [valid, primary, learning, warning, destructive]; keep base-pair tokens (`--pa-*`) **only** for the evidence-map/sequence viz and the welcome motif — no status UI may use raw base-pair colours. Light theme: provide matching `--color-*` values in `:root` (adjust existing light palette minimally). Publish a short token table in a new `docs/design-tokens.md`.

**Forbidden:** hardcoded hex/rgb, arbitrary Tailwind palettes (`amber-100`, `zinc-600`, `cyan-300`, …) in any file under `src/components`, `src/routes`, `src/hooks` — with a biome/ESLint-style CI grep in Story 5 exempting `src/fixtures/**` and `src/index.css`. Story 1 must clear all current violations (D9) from shared paths.

### 4.2 Typography (D10)

- Self-host via `@fontsource-variable/inter` and `@fontsource-variable/jetbrains-mono` (new dev-deps; ⚖ no CDN). Import in `main.tsx`.
- Scale (dark, desktop): body **14 px**/1.5 (⚖ density), `h1` 20/600, `h2` 16/600, `h3` 14/600, label/overline 11/500 uppercase `tracking-wider`, mono data 12–13 px tabular-nums. Mobile body stays 14 px.
- Sentence-case headings. No oversized display type anywhere in the authenticated app.

### 4.3 Spacing, elevation, radii

- Radius: `--radius: 0.5rem` (tighter than current 0.8); pills only for badges.
- Panel padding 16–20 px; grid gaps 12–16 px; section spacing 24 px. Max content width `max-w-[1600px]` (dashboard uses the full width; the current `max-w-7xl` is too narrow for a research dashboard).
- Elevation: borders-first; shadows only on overlays (`0 8px 24px rgb(0 0 0 / 0.35)`). No glow effects, no gradient blobs, no glassmorphism beyond the existing sticky-header blur (keep).

### 4.4 Iconography & imagery

- lucide icons only (already a dep); 16 px in tables/toolbars, 20 px in nav.
- One restrained scientific visual: a **static** SVG "data ribbon" (thin helical/coverage-trace line, `--accent-cyan`/`--color-learning` strokes at ≤30% opacity) used in the welcome banner right side. No animation loops in the authenticated app. `GenomicsMotif.tsx` exports that remain used (e.g., `CoverageTrace`) must take colour via `currentColor`/CSS vars — no hardcoded stops.

### 4.5 New/updated shared components (all under `components/Common/` unless noted)

| Component | Spec |
|---|---|
| `PageHeader` | Title + optional description + right-aligned action slot; consistent top spacing |
| `Breadcrumbs` | From TanStack route matches; max 3 levels; current crumb not a link |
| `EmptyState` | Icon slot + title + body + optional primary/secondary action; used by every panel with no data |
| `StatusBadge` | Variants: `valid \| warning \| error \| info \| neutral \| pending(pulse)`; **replaces** all ad-hoc badge colour logic incl. `Documents/columns.tsx` |
| `DataTypeBadge` | Existing five types; token-based colours; `document` = neutral |
| `MetricCard` | Label (overline) + value (24/600 tabular) + context line + optional footer action; states: `value \| empty \| loading(skeleton) \| unavailable(reason)` |
| `Panel` | Card with header (title + optional subtitle/actions) and body; used by all dashboard panels |
| `QuickAction` | Icon + label + description; variants `enabled \| disabled(tooltip reason)` |
| `AiDisclosureTag` | Small purple-tinted tag "AI-generated — verify against sources"; exported now, consumed in Story 41+ |
| `DevFixtureBadge` | Amber "DEV FIXTURES" chip, rendered globally when fixture mode is on |
| `PlaceholderPage` | For planned routes: product-area icon, title, one-paragraph honest explanation ("planned for milestone M2/M3 — not yet implemented"), link back to Home. **No fake controls.** |
| `GlobalSearch` | Header input (⌘K focus shortcut optional); Story 1 wires **documents only** via existing `readDocuments({ search })`, navigating to `/documents?q=…`; helper text states scope |
| `NotificationsBell` | Dropdown showing `EmptyState` ("Notifications arrive with the activity pipeline — M2"); button remains for layout stability |
| `HelpMenu` | Dropdown: "Documentation (coming M2)", link to repo Issues, keyboard-shortcut list |

`sonner.tsx` (D8): delete the `next-themes` import; read the app's own `useTheme()`; drop the `next-themes` dependency from `package.json` if nothing else uses it. `__root.tsx` (D11): render both devtools only when `import.meta.env.DEV`.

### 4.6 Interaction & state conventions

Every data-bearing component implements: **loading** (skeleton matching final layout — update `PendingDocuments` to 6 columns), **empty** (`EmptyState` with next step), **error** (inline error with retry button; never a blank panel), **success**, **warning** (amber left-edge or badge), **disabled** (55% opacity + `aria-disabled` + tooltip explaining why). Buttons: visible focus ring (`--ring`), `active:` scale-[0.98] max, no hover animations beyond colour.

## 5. Application shell

### 5.1 Sidebar (desktop ≥768 px; mobile = existing Sheet behaviour preserved)

Top block: `Logo` + product descriptor line **"Multi-omics research workspace"** (11 px, muted). Then grouped nav (`SidebarGroup` with overline labels):

**RESEARCH WORKSPACE**
| Item | Route | Story 1 behaviour |
|---|---|---|
| Home | `/` | active dashboard |
| Projects | `/projects` | **new minimal real page**: `GET /projects/` tree rendered read-only (name, experiment/sample counts, created date) + `EmptyState` + "Create when uploading data" hint. Full management CRUD → Story 10 |
| Data Sources | `/documents` | existing documents area (label change only; `/documents` path preserved) |
| Integrations | `/integrations` | `PlaceholderPage` (M3) |
| Analysis Tools | `/analysis-tools` | `PlaceholderPage` (M3) |
| Evidence Graph | `/evidence` | `PlaceholderPage` (M3) |
| Reports | `/reports` | `PlaceholderPage` (M3) |

**LEARNING & ACADEMY**
| Item | Route | Story 1 behaviour |
|---|---|---|
| OmicTerms Academy | `/academy` | `PlaceholderPage` (M4) with onboarding teaser copy |
| Learning Path | `/academy/path` | `PlaceholderPage` (M4) |
| Concept Explorer | `/academy/concepts` | `PlaceholderPage` (M4) |
| Interactive Labs | `/academy/labs` | `PlaceholderPage` (M4) |
| My Progress | `/academy/progress` | `PlaceholderPage` (M4) |

Bottom block: **Settings** (`/settings`), **Help** (`HelpMenu`), **Appearance** (existing Light/Dark/System dropdown, unchanged), `User` dropdown (existing Settings/Log Out — unchanged). Admin users keep an **Admin** item (existing `/admin`, position: above Settings, labelled "Admin"). Collapsible to the existing icon rail (Cmd/Ctrl+B, cookie persistence — keep shadcn behaviour); collapsed rail shows group separators and tooltips. Active state: `--primary` text + 8% primary tint background + 2 px left indicator. Mobile: same tree inside the Sheet; nav click closes the sheet (existing pattern).

### 5.2 Header (sticky, existing h-16 + blur retained)

Left: `SidebarTrigger`, `Breadcrumbs`, page context. Right: `GlobalSearch` (w-64→w-80 on xl), `NotificationsBell`, user avatar (opens same dropdown as sidebar on mobile only). Remove the decorative `BaseRain` strip and right-aligned `BasePairCode` from the header. Keep the 4 px top marquee **only if** the reference shows a top accent rule; otherwise remove (log deviation).

### 5.3 Footer

`v{version}` from `import.meta.env.VITE_APP_VERSION || package.json version` (add `VITE_APP_VERSION` substitution in `vite.config.ts`), tagline "From data to discovery", link: GitHub repo `https://github.com/Sirius1616/OmicTerms` (replace D12 placeholder socials), "Report an issue" → repo issues URL. Single row, 12 px muted text.

### 5.4 Auth pages

Unchanged routes/behaviour; Story 1 only ensures they render correctly with new fonts/tokens and are not visually broken by shell changes (full redesign → Story 6).

## 6. Dashboard specification

Route `/` (auth-gated as today). Desktop grid: 12 columns, gap-4, panels use `Panel`. Order (reconcile proportions with reference):

### 6.1 Welcome banner (cols 12, compact ~120–140 px)

Left: overline "RESEARCH WORKSPACE", `h1` "Welcome back, {full_name || email local-part}." (from `GET /users/me`), one-line descriptor "Validate, connect, and report on multi-omics data — and learn the biology as you go." Three compact entry buttons: **Open Data Sources** → `/documents` (primary), **Explore Academy** → `/academy` (secondary), **Recent activity** → scrolls/focuses the activity panel (or `/` anchor). Right (hidden <xl): static data-ribbon SVG. No fake status text, no spinners, no readouts.

### 6.2 Summary cards (5 × `MetricCard`, grid-cols-5 → 3 (md) → 2 (sm))

| Card | Data source (real) | Value | Context / action |
|---|---|---|---|
| Active projects | `GET /projects/` → `count` | number | "experiments · samples" from tree totals; action → `/projects` |
| Data files | `GET /documents/` → `count` | number | "N extracting · M failed" from `data[]` statuses; action → `/documents` |
| Data integrity | *no backend yet* | `unavailable` state: "Validation engine lands in M2" | action → disabled QuickAction link to docs (Story 19 replaces) |
| Key findings | *no backend yet* | `empty`: "No findings yet" | body explains findings will link claims to evidence; action → `/evidence` placeholder |
| Learning progress | *no backend yet* | `empty`: "Start the Academy path" | action → `/academy` |

Dev-fixture mode replaces the last three with fixture values **plus visible `DevFixtureBadge`**. All cards: skeleton while queries load; error state with retry.

### 6.3 Multi-Omics Evidence Map (cols 8) — presentation only

`Panel` "Multi-Omics Evidence Map", subtitle "How your datasets, runs, and findings connect". Story 1 implementation: a **static, clearly-labelled architecture preview** — an SVG/HTML diagram of the intended node types (Genomics, Transcriptomics, Epigenomics, Proteomics, Microbiome, Samples & Experiments, Analysis Tools, Candidate Findings, Reports) arranged around a centre "Evidence Graph" node with **no connecting lines drawn between specific user entities** (drawing fake edges would fabricate relationships). Overlaid `EmptyState`: "Your evidence graph will appear here once datasets are linked — planned for M3", action → `/evidence`. In dev-fixture mode: render the fixture graph via a simple SVG force-free layout (fixed coordinates, typed edges from fixture, node click → fixture inspector popover with a "not real data" warning). Real rendering engine (29) lands in M3. Loading/error states required for the fixture path.

### 6.4 Key Findings (cols 4)

`Panel` "Key Findings". Default: `EmptyState` ("Findings will appear here with links to their supporting evidence. Nothing is a finding until it is backed by data."). Fixture mode: 3 fixture rows — each with title, 2-line summary, evidence-strength chip **rendered as "not assessed"** (never a fabricated confidence number), source-dataset chips, validation chip (`warning` "unvalidated"), "Inspect" link disabled with tooltip "arrives with Story 31". Footer link → `/evidence`.

### 6.5 Evidence quality & recent files (cols 4, under findings)

Top half: "Evidence quality" mini-summary — three rows: Datasets with checksums `0 / N` ("from M2"), Validation runs `—`, Provenance coverage `—`, each with a "How this is measured" tooltip; honest zeros/dashes, no fake percentages. Bottom half: "Recent files" — top 5 from `GET /documents/` sorted by `uploaded_at` desc: icon by extension, filename (`file_url` basename), size **absent (not returned by API — omit rather than invent)**, `StatusBadge` (extraction status), `DataTypeBadge`, relative time, link → `/documents/{id}`. Empty → `EmptyState` + Upload CTA.

### 6.6 Activity & provenance timeline (cols 8)

`Panel` "Recent activity", subtitle "Uploads and processing events. Full provenance lands in M2." Data: derive events from real documents (`uploaded_at` → "You uploaded {filename}", extraction status → if `failed`: "Extraction failed for {filename}" at same timestamp with error styling; no fabricated run times). Render as vertical timeline rows: timestamp (mono, relative + absolute tooltip), actor (avatar + "You"), event text, right-side link. Cap at 10. Fixture mode adds validation-run/analysis/finding events watermarked as fixtures. Empty → `EmptyState` "Activity appears here as soon as you upload data."

### 6.7 Quick actions (strip above Academy panel, 4 × `QuickAction`)

| Action | State in Story 1 |
|---|---|
| Upload data | **enabled** → opens the existing `UploadDocument` dialog (reused, real flow) |
| Run analysis | disabled — tooltip "Analysis tools arrive in M3 (Story 25)" |
| Link evidence | disabled — tooltip "Evidence linking arrives in M3 (Story 30)" |
| Generate report | disabled — tooltip "Reports arrive in M3 (Story 36)" |

Disabled actions are visibly non-interactive (`aria-disabled`, no pointer, 55% opacity) — never clickable dead ends.

### 6.8 Academy progress panel (cols 12, compact strip)

Left: `color-learning` accent block with academy mark, "OmicTerms Academy", copy "Learn the biology and the tooling behind your data — pathways for software engineers entering genomics." Middle: placeholder progress bar at 0% labelled "No path started" + three module chips (Biology foundations · Genomics data literacy · Python for bioinformatics) rendered as `neutral` "not started". Right: **Start onboarding** button → `/academy` placeholder (tooltip "Onboarding ships in M4, Story 48"). Fixture mode: 42% progress + 2 completed modules, watermarked.

## 7. Research-vs-learning hierarchy

Sidebar group overlines + the learning accent colour are the only chromatic distinction; learning surfaces use `--color-learning` sparingly (icons, progress, selected states), research surfaces use `--primary`. The dashboard always shows both (welcome buttons, Academy strip) but research panels occupy the top ~70%. No separate "mode switcher" — one product, two areas (per brief).

## 8. Responsive rules

| Breakpoint | Behaviour |
|---|---|
| ≥1536 (2xl) | 12-col dashboard; 5 cards in a row; evidence map 8 cols; ribbon visible |
| 1280–1535 | Cards wrap 3+2; map/findings stack at 12 cols each if needed |
| 768–1279 (md) | Sidebar collapsible (default expanded); cards 3-col; map + findings stack full width; search collapses to icon that expands inline |
| <768 | Sidebar = Sheet; cards 2-col (Data integrity + Learning progress may stack full width); welcome banner single-column, ribbon hidden; quick actions 2×2; timeline timestamps above text; header keeps search icon + bell only; tables on `/documents` keep existing horizontal overflow (improved in Story 7) |

## 9. Accessibility

WCAG 2.1 AA: body text ≥ 4.5:1 on all new surfaces (verify `--muted-foreground` on `--card`); interactive elements have visible `--ring` focus; sidebar nav uses `<ul>/<li>` + `aria-current="page"`; decorative SVGs `aria-hidden`; timeline is a semantic `<ol>`; MetricCard values announced via card labels; ⌘K/search has a visible label (can be `sr-only`); all icon-only buttons have `aria-label` + tooltip. Manual pass with keyboard only + axe (Story 9 automates).

## 10. Data honesty matrix (binding)

| Datum | Source in Story 1 |
|---|---|
| User name/email | real `GET /users/me` |
| Project/experiment/sample counts | real `GET /projects/` |
| Document count, statuses, types, names, dates | real `GET /documents/` |
| Activity timeline | real, derived from documents only, labelled as such |
| Data integrity metrics | honestly unavailable (engine in M2) |
| Findings, evidence edges, learning progress | **absent** → empty states; **or** dev fixtures behind `omiterms:fixtures` toggle with `DevFixtureBadge`; never silent hard-coding |
| Quick actions 2–4 | visibly disabled with reasons |
| Fixture content | synthetic, labelled "Fixture — not real scientific data" inside the data itself |

Fixture module: `src/fixtures/dashboard.ts` exporting typed bundles; activation `import.meta.env.DEV && localStorage.getItem('omiterms:fixtures') === 'on'`; a dev-only toggle lives in the Help menu ("Enable dev fixtures"); `if (import.meta.env.PROD)` guards ensure production builds contain no fixture graph data (verify in `vite build` output).

## 11. Coexistence with the existing application

- Same routes, same auth guard, same generated client, same services layer — Story 1 introduces **no new API calls** beyond reusing the three GETs listed above.
- `documents` flow (upload dialog with inline create, rename, delete, viewer, chat/explanation mocks) keeps working; only shared badge colours and layout chrome change.
- Theme system keeps the existing custom `ThemeProvider` (localStorage `vite-ui-theme`, default dark).
- shadcn sidebar behaviour (collapse cookie, mobile sheet, keyboard shortcut) preserved — content swapped, machinery kept.
- Rollback: single-PR story; revert restores prior UI without data risk (no migrations).

## 12. Testing & visual review

**Automated:**
- `bun run lint` (biome) and `bun run build` (tsc) pass; new grep rule finds no forbidden colour literals outside `src/fixtures/**` + `index.css`.
- New Playwright specs (chromium, existing auth setup): `shell.spec.ts` — both nav groups render; Data Sources → `/documents`; Settings/Admin/placeholder routes reachable; sidebar collapse persists; mobile viewport opens Sheet. `dashboard.spec.ts` — with seeded superuser: metric cards show real counts matching API (assert card text vs a direct API fetch helper); empty states render for a fresh user; disabled quick actions expose tooltips and are not focus-activatable; devtools absent in build mode (assert via `import.meta.env`-driven DOM marker). Update stale login assertion copy (D7) only where it contradicts new shell text.
- Existing suites must stay green: `login`, `sign-up`, `reset-password`, `admin`, `user-settings` specs (fix `admin.spec.ts` "Is superuser?" wording as part of D7 cleanup if it already fails on main).

**Manual review checklist (M1 gate — owner):**
1. Side-by-side with `img/dashboard-dark.png` and `img/dashboard-items.png`: panel inventory, sidebar grouping, colour temperature, density, typography hierarchy.
2. Dark and light themes on `/`, `/documents`, `/login`.
3. Keyboard-only walkthrough; focus visible on every control.
4. 1440×900, 1024×768, 390×844 viewports.
5. Fresh user (no data) and populated user (5+ docs, 2+ projects).
6. Dev-fixture mode on/off comparison; badge visible when on.
7. Screen-reader spot check (VoiceOver/NVDA) on sidebar nav + summary cards.
Known limitation: no automated screenshot-diff baseline until Story 9.

## 13. Definition of done

- All §4–§10 requirements merged to `main`; PR includes deviation log vs reference images.
- No regression in existing Playwright specs; new specs green; lint/typecheck green.
- Owner completes the manual M1 checklist and approves the visual direction (or requests a targeted revision story).
- `docs/design-tokens.md` published; this story's deferred list confirmed unchanged.

## 14. Priority / size / effort

P0 · XL · ~1–2 weeks single frontend engineer. No backend coordination.

## 15. Explicitly deferred (do not sneak in)

Real validation/findings/learning/provenance data or endpoints; notifications backend; search beyond documents; documents/settings/admin/auth visual overhauls (Stories 6–8, and 7 for documents); fixing ExplanationPanel/DocumentChat mocks (Story 43); visual-regression CI (Story 9); charting library adoption (Story 26); removing `SpecimenDeck` from anywhere except the dashboard (if reused elsewhere, keep until that page's story); i18n; browser扩展; any API/client regeneration.
