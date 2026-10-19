# Contributing

## Quality gates (CI)

Every push to `main` and every pull request runs `.github/workflows/ci.yml`.
All jobs must pass before a change can merge.

### Backend (`backend/`)

| Gate | Command |
| --- | --- |
| Lint | `uv run ruff check .` |
| Typecheck | `uv run mypy app` |
| Migrations | `uv run alembic upgrade head` → `downgrade base` → `upgrade head` (against a clean Postgres 16 service) |
| Tests | `bash scripts/test.sh` |

Run them locally from `backend/` after `uv sync --dev`:

```bash
uv run ruff check .
uv run mypy app
bash scripts/test.sh
```

The migration job proves the migration graph applies cleanly to an empty
database and that the downgrade path is reversible.

### Frontend (`frontend/`)

| Gate | Command |
| --- | --- |
| Lint / format | `npx biome check .` |
| Typecheck + build | `npm run build` |

The project uses **npm** (`package-lock.json` is the committed lockfile).

### Colour-literal rule

Source must use design tokens, not hardcoded colours. The `colour-literals`
job fails if `#rgb` / `#rrggbb` / `#rrggbbaa` / `rgb(...)` / `rgba(...)`
literals appear in `frontend/src/**/*.{ts,tsx}`, excluding
`src/fixtures/**` and `src/index.css`.

### Playwright (deferred)

End-to-end Playwright coverage is tracked in Story 60. It is not part of the CI
workflow yet: the runner image requires `chromium_headless_shell-1228`, which is
not available in the current environment. It will be added as a proper job when
Story 60 lands, rather than as a flaky `continue-on-error` job.
