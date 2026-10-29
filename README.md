# OmicTerms — your genome, explained in plain English

[![CI](https://github.com/Sirius1616/OmicTerms/actions/workflows/ci.yml/badge.svg)](https://github.com/Sirius1616/OmicTerms/actions/workflows/ci.yml)

Your DNA is not destiny — but right now, the data that would prove it is locked inside `.vcf` files, methylation matrices, and peak calls that only bioinformaticians can read.

**OmicTerms is the translator.** It takes omics data and re-explains it in plain language, one question at a time — no jargon, no gatekeeping. Upload a gene expression matrix or a variant call file, and OmicTerms extracts the content, tells you what kind of data it is, checks whether it holds up, and walks you through what it actually means for your health, your family, or your research.

Built to support the fight against disease through **epigenomic drift** research — how the genome's regulatory state shifts over time in cancer and neurodegeneration.

---

## Why this matters

Whole-genome sequencing costs less than a nice dinner. Epigenomics can now spot drift in gene regulation years before symptoms appear. But the people who need that information most — patients, clinicians, researchers in other fields — can't read the raw output.

OmicTerms bridges that gap. The goal is simple: **nobody should need a PhD to understand their own genome.**

---

## What's inside

Under active development. The platform foundation is in place and the workspace is real end to end — from raw upload to an evidence graph you can see on screen.

**Working today**

- Full user authentication: registration, login with JWT, profile management, password reset via email, admin user management
- Organised data hierarchy: Project → Experiment → Sample → Document, with ownership checked on every access (including a full project tree endpoint)
- Document upload with **real file validation** — magic-byte sniffing (PDF/PNG/JPEG/zip), size limits, checksummed integrity, and extension sanity so a renamed `bomb.exe` can't masquerade as a PDF
- Text extraction pipeline — PDF (`pypdf`), OCR (`pytesseract`), `.docx`, `.eml` — running as durable background jobs with retries, backoff, and admin job statistics
- Omics data-type classification (expression / methylation / variants / peaks / document)
- **Validation engine** — per-format validators for VCF, BED, and expression matrices, plus cross-sample validation at the experiment level ([issue code catalogue](docs/validation-codes.md))
- Dataset metadata (genome assembly, coordinate system, source tool) with revalidation
- Import from public repositories — a live-verified **GEO adapter** that fetches a series, rate-caps the requests, checksums what arrives, and maps it straight into your project hierarchy
- **Append-only provenance log** — every meaningful event is recorded with request-id correlation and surfaced as an activity timeline on the dashboard and project pages
- **Evidence graph** — automatically materialised nodes and edges (supports / contradicts relationships) rendered as an interactive graph on the frontend
- Frontend: dashboard, document workspace, project management, activity timeline, evidence map, admin panel

**In progress** — tracked as [GitHub issues](https://github.com/Sirius1616/OmicTerms/issues)

- AI explanation and follow-up Q&A layer (the UI is built; the backend service isn't wired yet)
- Analysis runs, findings, and reports
- OmicTerms Academy — a guided learning area

## Tech stack

**Backend** (`backend/`)

- Python 3.14, FastAPI, SQLModel, Alembic, PostgreSQL
- Pydantic Settings for configuration, PyJWT for tokens, Argon2/Bcrypt password hashing
- Email delivery via the `emails` library with Jinja2 templates
- `pypdf`, `pytesseract`/Pillow, `python-docx` for text extraction
- Sentry for error tracking
- Tests with pytest; lint/type gates with ruff and mypy

**Frontend** (`frontend/`)

- Vite + React + TypeScript (npm-based)
- TanStack Router (file-based routing), TanStack Query for server state
- Tailwind CSS v4 with shadcn/ui components and an enforced semantic design-token system (no raw colour literals in code — a CI job checks)
- Evidence graph via `@xyflow/react`; Playwright for end-to-end tests
- API client generated from the backend's OpenAPI schema (`openapi-ts`)

## Getting started

### Prerequisites

- Python 3.14+ and [uv](https://docs.astral.sh/uv/)
- PostgreSQL
- Node.js (frontend is npm-based)

You can either run the services manually or use Docker Compose.

### Option 1: Docker Compose

```bash
docker compose up --build
```

This starts PostgreSQL, the backend API, and the frontend (nginx). Health checks are built in; the DB and API come up before the services that depend on them.

### Option 2: Manual setup

**Backend**

```bash
cd backend
uv sync
source .venv/bin/activate
```

Create a `.env` file in `backend/` (see `app/core/config.py` for the full list of settings). Minimum for local development:

```
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_USERNAME=postgres
DATABASE_PASSWORD=postgres
DATABASE_NAME=layterms
SECRET_KEY=change-me-to-a-long-random-string
FIRST_SUPERUSER=admin@example.com
FIRST_SUPERUSER_PASSWORD=change-me
```

Apply migrations and create the first admin user:

```bash
alembic upgrade head
python -m app.initial_data
```

Start the API:

```bash
uvicorn app.main:app --reload
```

- API: `http://localhost:8000/api/v1`
- Interactive docs: `http://localhost:8000/docs`

**Frontend**

```bash
cd frontend
npm install
npm run dev
```

Open `http://localhost:5173` and sign in with the superuser created above.

To regenerate the API client after backend changes:

```bash
npm run generate-client
```

## Project layout

```
backend/
  app/
    api/
      routes/            # login, users, documents, projects, experiments, samples,
                         # validations, evidence, jobs, private, utils
      deps.py            # auth dependencies (current user, admin)
    core/                # config, database, security
    models.py            # SQLModel tables + request/response schemas
    services/            # extraction, classification, validation, provenance,
                         # evidence graph, import jobs
    integration/         # repository adapters (GEO)
    crud.py              # database operations
    initial_data.py      # seeds the first superuser
  migration/             # Alembic migrations
  scripts/               # dev scripts (lint, format, tests, prestart)
frontend/
  src/
    routes/              # file-based router (login, dashboard, documents,
                         # projects, evidence, admin)
    components/          # UI components (evidence map, provenance timeline,
                         # documents, dashboard)
    services/            # API service layer
    client/              # generated API client
docs/
  planning/              # architecture audit, story backlog
  validation-codes.md    # catalogue of validation issue codes
  design-tokens.md       # frontend design-token reference
  contributing.md        # CI quality-gate reference
```

## License

Private.
