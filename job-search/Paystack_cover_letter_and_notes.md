# Paystack — Application Security Engineer (via Talent Safari)

Target role: **Intermediate Application Security Engineer** (Paystack · Lagos / Kenya / South Africa / Remote, hybrid)
Apply: Talent Safari Ashby portal
https://jobs.ashbyhq.com/talentsafari/e0abeae6-2eb1-43f5-9a9f-e10730739749
Attachments: CV (John_Ezekiel_CV_Paystack.pdf) + this cover letter

> Notes before applying:
> - The role is posted through Talent Safari but is a **Paystack** position (Paystack = Stripe subsidiary, benefits include Stripe equity).
> - Hybrid working environment — Nigeria-remote is accepted.
> - If the Ashby form allows a "cover letter" field, paste the letter below. Otherwise attach it as a file.

---

## Cover letter (attach/paste)

**John Ezekiel** — Application for Application Security Engineer
johnezekiel130@gmail.com · +234 813 658 7945 · github.com/Sirius1616 · linkedin.com/in/john-ezekiel-dev

Dear Paystack Security Team,

I'm applying for the Application Security Engineer role. I'm a backend developer with ~4 years in production payments and billing environments where security testing is a release gate, not an afterthought — and I've spent the last year deliberately deepening that into a security-engineering skillset.

Three things make me a strong fit:

**1. Application security testing is my habit, not a task.** At Benin Electrics (BEDC), I manually tested every API endpoint ahead of every release with Burp Suite and OWASP ZAP — probing authentication, authorization, and input handling — and remediated findings before they reached production, on a payments backend serving 325,000 customer accounts. At Chingu, I repeated the same discipline on new builds: CramerBot (an AI trading dashboard that executes real trades) and a word game, where I tested Supabase RPC endpoints and a Node/Express API with Burp Suite, OWASP ZAP, and SQLMap for injection, broken access control, and auth-bypass.

**2. I've shipped a real security fix in a security tool.** I found and fixed CWE-614 in Tracecat, a 3.8k-star security-automation platform: the auth cookie's Secure flag was derived from the internal API URL instead of the public HTTPS URL, so it could transmit over plaintext HTTP. I shipped the fix with regression tests covering both cases, and it was merged by a maintainer who credited the find. That's the OWASP/CWE mindset working end-to-end: identify the class, root the cause, fix it properly, and prove it with tests.

**3. I speak both languages — security and engineering.** I work from OWASP Top 10 / CWE reference points, and I script security checks in Python and Bash. Because I also build and ship the backend (Python, PostgreSQL, Docker, GitHub Actions CI/CD), I can review code and explain a fix to a developer and to a non-technical stakeholder with equal clarity — and I can guide teams during sprints, not just report findings after.

I'm comfortable in a hybrid, distributed setup and genuinely excited about securing Paystack's fintech platform as it scales. I'd welcome the chance to talk through how my background maps to your SDLC, vulnerability management, and DevSecOps initiatives.

Sincerely,
John Ezekiel
+234 813 658 7945 · johnezekiel130@gmail.com
github.com/Sirius1616 | linkedin.com/in/john-ezekiel-dev
