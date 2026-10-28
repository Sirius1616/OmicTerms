# OmicTerms backend

FastAPI + SQLModel service. See the root `README.md` for project-wide status.

## Provenance event log

Every meaningful mutation emits an append-only `ProvenanceEvent` row: who
(actor: user/system/job), what (an action code from a closed registry in
`app/services/provenance.py`), on which entity, and a non-secret JSON payload
(filenames, ids, statuses, hashes, field names — never passwords, tokens, or
extracted full text; auth routes emit no events at all).

- Rows are never updated or deleted through the API. `project_id` is a plain
  indexed UUID (no foreign key) so the audit trail survives project deletion;
  deleting a user anonymises their `actor_id` instead of rewriting history.
- A pure-ASGI `RequestIDMiddleware` stamps each request with an id, exposed to
  the app via a ContextVar and echoed back in the `X-Request-ID` response
  header; events store it for correlation with logs.
- History is exposed at `GET /api/v1/projects/{id}/events?action=&skip=&limit=`
  (ownership-enforced, descending by `occurred_at`, paginated; composite index
  `ix_provenanceevent_project_occurred` backs the query).
- Retention is documented with Story 61 (ADR/docs). Out of scope here: the
  timeline UI (Story 33), run graph (Story 34), and manifest export (Story 35).

## Extraction jobs

Text/structure extraction for an uploaded document runs as a durable job rather
than a fire-and-forget background callback:

- Uploading a document inserts a row in `extractionjob` (status `pending`) and
  schedules `run_extraction_job(job_id)`.
- The runner claims the job with a compare-and-set on `status` (`pending` →
  `running`), so a job can only ever run once even if two workers race.
- Failures retry up to `EXTRACTION_JOB_MAX_ATTEMPTS` times with
  `EXTRACTION_JOB_BACKOFF_SECONDS` between attempts; exhausted jobs end
  `failed` with `last_error` recorded.
- On startup an in-process asyncio poller (`EXTRACTION_POLL_INTERVAL`) recovers
  `pending` jobs and resets orphaned `running` jobs older than
  `EXTRACTION_JOB_STALE_RUNNING_SECONDS` back to `pending`. Disable it with
  `EXTRACTION_POLLER_ENABLED=false`.
- `Document.extraction_status` remains the single UI-facing status; the job
  table is the audit/retry trail. History is exposed at
  `GET /api/v1/documents/{id}/jobs`; admins can read aggregate counts at
  `GET /api/v1/jobs/stats`.

No Redis or Celery is used; durability comes from the table plus the recovery
poller, which is sufficient for the current single-process deployment.
