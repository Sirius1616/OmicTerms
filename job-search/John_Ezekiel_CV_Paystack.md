# JOHN EZEKIEL

**Security-focused Backend Developer** — Application Security Testing · Python · Web & API Security · OWASP/CWE
johnezekiel130@gmail.com · +234 813 658 7945 · github.com/Sirius1616 · linkedin.com/in/john-ezekiel-dev
Remote (Nigeria) · Full-time

---

## Profile

Backend developer with ~4 years in production, payments and billing environments, where security testing is baked into my workflow. I manually test every API endpoint I ship — probing authentication, authorization, and input handling with Burp Suite, OWASP ZAP, and SQLMap — and remediate findings before release. I found and fixed a session-cookie security flaw (CWE-614) in Tracecat, a 3.8k-star security-automation platform, with regression tests merged by the maintainer. I work from OWASP Top 10 / CWE reference points, script security checks in Python and Bash, and integrate them into release and CI workflows. Strong communicator comfortable explaining vulnerabilities and fixes to technical and non-technical audiences.

---

## Experience

### Backend Developer / Technical Support — Benin Electrics (BEDC) · Edo, Nigeria · Jan 2022 – Jan 2026
Customer-facing backend for electricity payments, billing, and account management across the BEDC franchise.
- Ran manual application security assessments across all API endpoints ahead of every release — testing authentication, broken access control, and input handling (Burp Suite, OWASP ZAP) — and remediated findings before they reached production.
- Maintained and scaled backend services as customer accounts grew from ~255,000 to **325,000**, including API design, database hardening, and release management in a high-volume payments/billing domain.
- Provided technical support for deployment and access issues; designed and delivered training programmes that raised internal digital literacy.

### Web Developer — Chingu (Agile Developer Program) · Remote · Feb 2026 – Present
Cross-functional, distributed Scrum teams shipping a full-stack web app within each 7-week Voyage.

**Voyage 60 — CramerBot (AI trading dashboard)**
- Because the app executes real trades, ran manual security testing across all API endpoints (auth, authorization, input handling) before features merged to production.
- Built an LLM data pipeline ingesting real-time posts and converting them into structured trading signals; contributed the Supabase/PostgreSQL data layer (Alembic migrations, Dockerised Postgres, upsert ingestion).

**Voyage 61 — Wordle-ish (word game, React 19 / Vite / Tailwind)**
- Tested Supabase RPC endpoints and a legacy Node/Express API with Burp Suite, OWASP ZAP, and SQLMap — checking injection, broken access control, and auth-bypass.
- Built frontend + Supabase backend (Postgres, Auth, Row Level Security, GitHub OAuth sign-in); worked inside a GitHub Actions CI pipeline enforcing lint + build on every pull request.

---

## Education

**Bachelor of Engineering (Mechanical)** — University of Benin, Edo · 2017

---

## Skills

**Application Security** — Manual penetration testing (Burp Suite, OWASP ZAP, SQLMap), web & API security testing, OWASP Top 10 / CWE, secure code review, auth & access control testing, injection & auth-bypass checks
**Secure Development / DevSecOps** — Security testing integrated into release workflows, GitHub Actions CI/CD, secure coding practices, secrets & session handling, Row Level Security, defense-in-depth for payments domains
**Backend & APIs** — Python, REST & RPC APIs, async services, SQLAlchemy/Alembic migrations, API auth (OAuth/JWT patterns), PostgreSQL, Supabase, Redis, SQL
**Scripting & Tooling** — Python, Bash, Docker, Git, Linux/Unix
**AI/LLM** — LLM pipeline integration, prompt-based data processing, structured-signal generation (relevant to securing LLM-integrated applications)

---

## Open Source

**Tracecat (tracecat/tracecat)** — 3.8k+ stars, security-automation platform
- Found and fixed a session-cookie security flaw (CWE-614): the auth cookie's Secure flag derived from the internal API URL instead of the public HTTPS URL, so it could transmit over plaintext HTTP. Shipped the fix with regression tests covering HTTP and HTTPS; reviewed and merged by a maintainer who credited the find.

**cytham/nanovar** — structural-variant caller for long-read sequencing
- Diagnosed a crash when BAM/CRAM files lacked an expected alignment-score tag; implemented a fallback alignment-score calculation from CIGAR/NM data and verified it against synthetic BAM test cases (PR open, pending maintainer review).
