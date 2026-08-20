# JOHN EZEKIEL

**Python Backend Developer** — REST APIs · PostgreSQL · Redis · Docker · CI/CD · Security-first
johnezekiel130@gmail.com · +234 813 658 7945 · github.com/Sirius1616 · linkedin.com/in/john-ezekiel-dev
Remote (Nigeria) · Full-time

---

## Profile

Backend developer with ~4 years shipping production customer-facing systems, focused on Python, PostgreSQL/Redis data layers, Dockerised deployments, and GitHub Actions CI/CD. Security-first by habit: I manually test every API endpoint I ship (Burp Suite, OWASP ZAP, SQLMap) before it reaches production. Built production web apps in Agile teams, including an LLM-driven data pipeline (CramerBot) and a React 19 + Supabase app (Wordle-ish). Active open-source contributor — including a merged security fix (CWE-614) in a 3.8k-star security-automation platform. Background maintaining a payments/billing backend serving 325,000+ customer accounts in a regulated utility environment.

---

## Experience

### Backend Developer / Technical Support — Benin Electrics (BEDC) · Edo, Nigeria · Jan 2022 – Jan 2026
Customer-facing backend for electricity payments, billing, and account management across the BEDC franchise.
- Maintained and scaled backend services as customer accounts grew from ~255,000 to **325,000** — including API design, database work, and release management for a high-volume payments/billing domain.
- Ran manual security testing (Burp Suite, OWASP ZAP) across all API endpoints ahead of every release — probing authentication, authorization, and input handling — and remediated findings before they reached production.
- Provided technical support for deployment and access issues across the organisation; designed and delivered training programmes that raised internal digital literacy.

### Web Developer — Chingu (Agile Developer Program) · Remote · Feb 2026 – Present
Cross-functional, distributed Scrum teams shipping a full-stack web app within each 7-week Voyage.

**Voyage 60 — CramerBot (AI trading dashboard)**
- Built an LLM data pipeline that ingests real-time posts from a financial commentator and converts them into structured trading signals for paper and live trading.
- Contributed the Supabase/PostgreSQL data layer: **Alembic migrations**, Dockerised local Postgres, and upsert-based ingestion to persist scraped posts, AI signals, and user config without duplication.
- Because the app executes real trades, ran manual security testing across all API endpoints (auth, authorization, input handling) before features merged to production.

**Voyage 61 — Wordle-ish (word game, React 19 / Vite / Tailwind)**
- Built frontend + Supabase backend (Postgres, Auth, Row Level Security, GitHub OAuth sign-in, leaderboard, word-selection RPCs).
- Tested Supabase RPC endpoints and a legacy Node/Express API with Burp Suite, OWASP ZAP, and SQLMap — checking injection, broken access control, and auth-bypass.
- Worked inside a GitHub Actions CI pipeline enforcing lint + build on every pull request.

---

## Education

**Bachelor of Engineering (Mechanical)** — University of Benin, Edo · 2017

---

## Skills

**Backend & APIs** — Python, REST & RPC APIs, async services, SQLAlchemy/Alembic migrations, API auth (OAuth/JWT patterns, Row Level Security)
**Data** — PostgreSQL, Supabase, Redis, SQL, upsert/ETL ingestion patterns
**DevOps & Workflow** — Docker, GitHub Actions CI/CD, Git, Agile/Scrum
**Frontend** — JavaScript/TypeScript, React, Vite, Tailwind CSS
**Security** — Burp Suite, OWASP ZAP, SQLMap, OWASP Top 10 / CWE, secure coding, manual penetration testing
**AI/LLM** — LLM pipeline integration, prompt-based data processing, structured-signal generation
**Other** — Linux/Unix, C

---

## Open Source

**Tracecat (tracecat/tracecat)** — 3.8k+ stars, security-automation platform
- Found and fixed a session-cookie security flaw (CWE-614): the auth cookie's Secure flag derived from the internal API URL instead of the public HTTPS URL, so it could transmit over plaintext HTTP. Shipped the fix with regression tests covering HTTP and HTTPS; reviewed and merged by a maintainer who credited the find.

**cytham/nanovar** — structural-variant caller for long-read sequencing
- Diagnosed a crash when BAM/CRAM files lacked an expected alignment-score tag; implemented a fallback alignment-score calculation from CIGAR/NM data and verified it against synthetic BAM test cases (PR open, pending maintainer review).
