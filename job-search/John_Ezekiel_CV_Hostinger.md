# JOHN EZEKIEL

**Python Backend Developer** — AI/LLM Integration · High-throughput REST APIs · PostgreSQL · Docker · CI/CD
johnezekiel130@gmail.com · +234 813 658 7945 · github.com/Sirius1616 · linkedin.com/in/john-ezekiel-dev
Remote (Worldwide) · Full-time

---

## Profile

Backend developer with ~4 years shipping production customer-facing systems — Python services, PostgreSQL/Redis data layers, Dockerised deployments, and GitHub Actions CI/CD. My standout differentiator is AI/LLM integration: I designed and built an LLM data pipeline that turns real-time financial posts into structured trading signals, end to end — ingestion, prompt-based transformation, and persistence. I work comfortably with AI-assisted development workflows (LLM pipelines, structured outputs, prompt engineering) and am highly curious about the fast-moving AI field. Background maintaining a high-volume payments/billing backend serving 325,000+ customer accounts, where I practised security-first shipping: manual testing of every API endpoint before release.

---

## Experience

### Backend Developer / Technical Support — Benin Electrics (BEDC) · Edo, Nigeria · Jan 2022 – Jan 2026
Customer-facing backend for electricity payments, billing, and account management across the BEDC franchise.
- Maintained and scaled backend services as customer accounts grew from ~255,000 to **325,000** — API design, database work, and release management for a high-volume payments/billing domain.
- Ran manual security testing (Burp Suite, OWASP ZAP) across all API endpoints ahead of every release and remediated findings before they reached production.
- Provided technical support for deployment and access issues; designed and delivered training programmes that raised internal digital literacy.

### Web Developer — Chingu (Agile Developer Program) · Remote · Feb 2026 – Present
Cross-functional, distributed Scrum teams shipping a full-stack web app within each 7-week Voyage.

**Voyage 60 — CramerBot (AI trading dashboard)**
- **Built the LLM data pipeline end to end**: ingests real-time posts from a financial commentator, converts them into structured trading signals via prompt-based LLM processing, and persists them for paper and live trading.
- Contributed the Supabase/PostgreSQL data layer: **Alembic migrations**, Dockerised local Postgres, and upsert-based ingestion to persist scraped posts, AI signals, and user config without duplication.
- Shipped with security testing across all API endpoints (auth, authorization, input handling) before features merged to production.

**Voyage 61 — Wordle-ish (word game, React 19 / Vite / Tailwind)**
- Built frontend + Supabase backend (Postgres, Auth, Row Level Security, GitHub OAuth sign-in, leaderboard, word-selection RPCs).
- Worked inside a GitHub Actions CI pipeline enforcing lint + build on every pull request.

---

## Education

**Bachelor of Engineering (Mechanical)** — University of Benin, Edo · 2017

---

## Skills

**AI/LLM** — LLM pipeline integration, prompt-based data processing, structured-signal generation, LLM-assisted development workflows
**Backend & APIs** — Python, REST & RPC APIs, async services, SQLAlchemy/Alembic migrations, API auth (OAuth/JWT patterns, Row Level Security), high-throughput data ingestion
**Data** — PostgreSQL, Supabase, Redis, SQL, upsert/ETL patterns
**DevOps & Workflow** — Docker, GitHub Actions CI/CD, Git, Agile/Scrum
**Security** — Burp Suite, OWASP ZAP, SQLMap, OWASP Top 10 / CWE, secure coding, manual penetration testing
**Frontend** — JavaScript/TypeScript, React, Vite, Tailwind CSS
**Other** — Linux/Unix, C

---

## Open Source

**Tracecat (tracecat/tracecat)** — 3.8k+ stars, security-automation platform
- Found and fixed a session-cookie security flaw (CWE-614): the auth cookie's Secure flag derived from the internal API URL instead of the public HTTPS URL, so it could transmit over plaintext HTTP. Shipped the fix with regression tests covering HTTP and HTTPS; reviewed and merged by a maintainer who credited the find.

**cytham/nanovar** — structural-variant caller for long-read sequencing
- Diagnosed a crash when BAM/CRAM files lacked an expected alignment-score tag; implemented a fallback alignment-score calculation from CIGAR/NM data and verified it against synthetic BAM test cases (PR open, pending maintainer review).
