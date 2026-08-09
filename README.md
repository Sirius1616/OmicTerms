# OmicTerms — your genome, explained in plain English

Your DNA is not destiny — but right now, the data that would prove it is locked inside `.vcf` files, methylation matrices, and peak calls that only bioinformaticians can read.

**OmicTerms is the translator.** It takes omics data and re-explains it in plain language, one question at a time — no jargon, no gatekeeping. Upload a gene expression matrix or a variant call file, and OmicTerms extracts the content, tells you what kind of data it is, and walks you through what it actually means for your health, your family, or your research.

Built to support the fight against disease through **epigenomic drift** research — how the genome's regulatory state shifts over time in cancer and neurodegeneration.

---

## Why this matters

Whole-genome sequencing costs less than a nice dinner. Epigenomics can now spot drift in gene regulation years before symptoms appear. But the people who need that information most — patients, clinicians, researchers in other fields — can't read the raw output.

OmicTerms bridges that gap. The goal is simple: **nobody should need a PhD to understand their own genome.**

---

## Current state

Under active development. The backend foundation is complete; the document workflow is the active milestone.

**Implemented**

- Full user authentication: registration, login with JWT, profile management, password reset via email, admin user management
- Document upload with **real file validation** — magic-byte sniffing (PDF/PNG/JPEG/zip), size limits, and extension sanity so a renamed `bomb.exe` can't masquerade as a PDF
- Project → Experiment → Sample → Document data hierarchy, with ownership rooted at the project level
- Text extraction service (PDF via `pypdf`, OCR via `pytesseract`, `.docx`, `.eml`) — orchestration in progress
- Database models for users, projects, experiments, samples, documents, explanations, and conversations (SQLModel + Alembic migrations)
- Frontend shell: login/signup/password-recovery pages, dashboard, and a documents area with upload, explanation, and chat UI

**In progress** — tracked as [GitHub issues](https://github.com/Sirius1616/Layterms/issues)

- Project/Experiment/Sample CRUD routes + the ownership walk (document → sample → experiment → project → user)
- Background text-extraction jobs that flip `pending → success / failed`
- Omics data-type classification (`expression`, `methylation`, `variants`, `peaks`, `document`)
- AI service layer for plain-language explanations and follow-up Q&A
- Streaming conversation answers

## Tech stack

**Backend** (`backend/`)

- FastAPI, SQLModel, Alembic, PostgreSQL
- Pydantic Settings for configuration, PyJWT for tokens, Argon2/Bcrypt password hashing
- Email delivery via the `emails` library with Jinja2 templates
- `pypdf`, `pytesseract`/Pillow, `python-docx` for text extraction
- Sentry for error tracking

**Frontend** (`frontend/`)

- Vite + React + TypeScript
- TanStack Router (file-based routing), TanStack Query for server state
- Tailwind CSS v4 with shadcn/ui components
- API client generated from the backend's OpenAPI schema (`openapi-ts`)

## Getting started

### Prerequisites

- Python 3.14+
- [uv](https://docs.astral.sh/uv/) (package manager, from `uv.lock`)
- PostgreSQL running locally
- Node.js or Bun

### 1. Backend

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

### 2. Frontend

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
      routes/            # login, users, utils, private, documents
      deps.py            # auth dependencies (current user, admin)
    core/                # config, database, security
    models.py            # SQLModel tables + request/response schemas
    services/            # text extraction (pdf, image OCR, docx, eml)
    crud.py              # database operations
    initial_data.py      # seeds the first superuser
    utils.py             # email and token helpers
  migration/             # Alembic migrations
  scripts/               # dev scripts (lint, format, tests, prestart)
frontend/
  src/
    routes/              # file-based router (login, dashboard, documents)
    components/          # UI components
    services/            # API service layer
    types/               # domain types
    client/              # generated API client
```

## License

Private.
