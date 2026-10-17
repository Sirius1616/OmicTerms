# OmicTerms Design Tokens

Source of truth: `frontend/src/index.css`. This document describes the token
system introduced in Story 1 (issue #19). Dark is the default theme; a cool
clinical light theme is also provided. Base radius is `0.5rem` and body text is
14px. Sans is **Inter Variable**; numeric/genomic readouts use **JetBrains Mono
Variable**.

## Principles

- **Semantic first.** Components reference semantic tokens (`--primary`,
  `--valid`, `--learning`, …), never raw palette utilities (`bg-blue-500`) or
  hex values. This is enforced by review; `src/` contains no Tailwind palette
  utilities or hex colours.
- **Research vs. learning.** Research surfaces use `--primary` (electric blue);
  Academy surfaces use `--learning` (violet), used sparingly (icons, progress,
  selected states).
- **Status has meaning.** `--valid` / `--warning` / `--destructive` communicate
  data integrity, never decoration.
- **The base-pair palette is reserved** for motif/sequence visualisation only.

## Semantic colour tokens

Values are `oklch(...)`. Token names below are the CSS custom properties; use
them through Tailwind utilities such as `bg-primary`, `text-muted-foreground`,
`border-border-strong`, `text-valid`.

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--background` | `0.982 0.006 230` | `0.155 0.025 255` | App background |
| `--foreground` | `0.22 0.02 235` | `0.955 0.012 220` | Primary text |
| `--card` | `1 0 0` | `0.195 0.025 255` | Panels/cards |
| `--popover` | `1 0 0` | `0.21 0.025 255` | Menus/dialogs |
| `--primary` | `0.52 0.14 252` | `0.72 0.13 252` | Research accent, active nav, focus |
| `--primary-foreground` | `0.985 0.005 230` | `0.16 0.03 255` | Text on primary |
| `--secondary` | `0.95 0.008 230` | `0.25 0.02 255` | Secondary surfaces |
| `--muted` | `0.95 0.008 230` | `0.245 0.02 255` | Subtle surfaces |
| `--muted-foreground` | `0.5 0.015 235` | `0.68 0.02 230` | Secondary text |
| `--accent` | `0.93 0.02 235` | `0.28 0.04 250` | Hover/accent surfaces |
| `--destructive` | `0.577 0.245 27.325` | `0.65 0.19 25` | Errors, destructive actions |
| `--border` | `0.9 0.01 230` | `1 0 0 / 10%` | Default borders |
| `--border-strong` | `0.84 0.012 235` | `1 0 0 / 16%` | Emphasised borders/dividers |
| `--input` | `0.9 0.01 230` | `1 0 0 / 14%` | Input borders |
| `--ring` | `0.52 0.14 252` | `0.72 0.13 252` | Focus ring (equals `--primary`) |

### Status & learning

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--accent-cyan` | `0.62 0.12 200` | `0.75 0.11 195` | Informational/pending accents |
| `--valid` | `0.55 0.13 165` | `0.74 0.13 172` | Valid, success, integrity OK |
| `--warning` | `0.66 0.14 75` | `0.8 0.15 78` | Warnings (amber) |
| `--learning` | `0.55 0.17 305` | `0.7 0.16 305` | Academy/learning surfaces |

### Chart series

Charts reuse the semantic set so data colours always carry meaning:

| Token | Meaning |
|---|---|
| `--chart-1` | valid (green) |
| `--chart-2` | primary (blue) |
| `--chart-3` | learning (violet) |
| `--chart-4` | warning (amber) |
| `--chart-5` | destructive (red) |

### Base-pair palette (visualisation only)

Reserved for motif/sequence rendering; do **not** use for chrome.

| Token | Light | Dark |
|---|---|---|
| `--pa-adenine` | `0.5 0.14 152` | `0.74 0.15 152` |
| `--pa-thymine` | `0.55 0.19 26` | `0.68 0.2 25` |
| `--pa-guanine` | `0.55 0.15 250` | `0.7 0.16 250` |
| `--pa-cytosine` | `0.65 0.13 92` | `0.84 0.14 92` |

### Sidebar

`--sidebar`, `--sidebar-foreground`, `--sidebar-primary`, `--sidebar-accent`,
`--sidebar-border`, `--sidebar-ring` mirror their main counterparts with a
slightly distinct elevated surface. Active nav items use `--primary` text plus
an 8% primary tint and a 2px left indicator.

## Radius

`--radius: 0.5rem`, with `--radius-sm/md/lg/xl` derived via `calc()`. Use
`rounded-md` / `rounded-lg` for controls and panels.

## Typography

- `--font-sans`: Inter Variable (body, UI).
- `--font-mono`: JetBrains Mono Variable (numeric/genomic readouts, kbd).
- Headings: `h1` = `text-xl`, `h2` = `text-base`, `h3` = `text-sm`, all
  `font-semibold`.
- `.overline` — 11px, medium, uppercase, wide tracking. Used for section
  overlines and sidebar group labels.
- `.readout` — mono, tabular numerals, tight tracking. Used for counts and
  data values.

## Motion

Genomics motion is authored as plain CSS classes in `index.css` so it is always
emitted: `.gm-scan`, `.gm-baserain`, `.gm-dna`, `.gm-breathe`, `.gm-chromo`,
`.gm-helixl`, `.gm-helixr`, `.gm-caret`, `.gm-pulseglow`, `.gm-flow-track`,
`.gm-progress`.

Rules:

- Looping motion (`.gm-baserain`, `.gm-dna`, `.gm-flow-track`, helix drift) is
  permitted on **auth pages only**.
- In the authenticated app, motion is limited to meaningful signals:
  `.gm-pulseglow` on analysing/pending badges, one-shot `.gm-progress` fills,
  and `.gm-scan`. No decorative loops.
- Respect `prefers-reduced-motion` when adding new motion (Story 9 audits this).

## Theming

`next-themes` is removed. Theme is managed by the app's own `theme-provider`
(`useTheme`), and Sonner is wired to it. `dark` is applied via the `.dark`
class. Devtools are gated to development builds.
