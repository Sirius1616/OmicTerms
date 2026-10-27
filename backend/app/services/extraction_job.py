"""Durable background extraction jobs.

Extraction used to run in a bare ``BackgroundTasks`` callback: work was lost on
restart, there was no retry, and no visibility into what happened. Now each
upload creates an :class:`ExtractionJob` row, a runner claims it with a
compare-and-set on ``status``, retries a bounded number of times with backoff,
and a periodic in-process poller recovers pending (or stale-running) jobs after a
restart.

``Document.extraction_status`` remains the single UI-facing status; the job
table is the audit/retry trail behind it. No Redis/Celery: the poller is a plain
asyncio task started from the FastAPI lifespan.
"""

import asyncio
import json
import logging
import time
import uuid
from collections.abc import Callable, Sequence
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, cast

from sqlalchemy import CursorResult, update
from sqlalchemy.engine import Engine
from sqlmodel import Session, col, select

import app as app_pkg
from app.core.config import settings
from app.crud import engine
from app.models import (
    Document,
    ExtractionJob,
    ExtractionJobStatus,
    ExtractionStatus,
)
from app.services.classification import classify
from app.services.extraction import extract_text

logger = logging.getLogger(__name__)

APP_ROOT = Path(app_pkg.__file__).resolve().parent.parent

Extractor = Callable[[Session, Document], None]

_background_tasks: set[asyncio.Task[None]] = set()


def upload_dir() -> Path:
    """Repo-root uploads/ directory, mirroring how the upload route stores it."""
    return APP_ROOT / settings.UPLOAD_DIR


def _now() -> datetime:
    return datetime.now(UTC)


def extract_document(session: Session, document: Document) -> None:
    """Extract a stored document and stage the result on the session.

    Does not commit: the job runner owns the transaction so a failure can be
    recorded without persisting a half-written success. Raises on any error.
    """
    file_id = Path(document.file_url).name
    result = extract_text(str(upload_dir() / file_id))

    if result.structure is not None:
        payload: dict = result.structure
    else:
        payload = {"kind": result.kind, "text": result.text}

    document.raw_extracted_json = json.dumps(payload)
    document.extraction_status = ExtractionStatus.success

    if document.data_type is None:
        document.data_type = classify(
            document.filename or "",
            result.kind,
            result.structure,
        )
    session.add(document)


def enqueue_extraction_job(session: Session, document_id: uuid.UUID) -> ExtractionJob:
    """Create a pending job row for a freshly uploaded document."""
    job = ExtractionJob(document_id=document_id)
    session.add(job)
    session.commit()
    session.refresh(job)
    return job


def _claim_job(session: Session, job_id: uuid.UUID) -> bool:
    """Atomically move a pending job to running.

    The ``WHERE status = 'pending'`` guard makes this a compare-and-set, so two
    workers (or a worker racing the recovery poller) can never run the same job.
    """
    result = cast(
        CursorResult[Any],
        session.execute(
            update(ExtractionJob)
            .where(
                col(ExtractionJob.id) == job_id,
                col(ExtractionJob.status) == ExtractionJobStatus.pending,
            )
            .values(
                status=ExtractionJobStatus.running,
                attempts=ExtractionJob.attempts + 1,
                started_at=_now(),
            )
        ),
    )
    session.commit()
    return result.rowcount == 1


def _require_job(session: Session, job_id: uuid.UUID) -> ExtractionJob:
    job = session.get(ExtractionJob, job_id)
    if job is None:
        raise LookupError(f"extraction job {job_id} not found")
    return job


def _trigger_upload_validation(session: Session, document_id: uuid.UUID) -> None:
    """Run the upload-triggered validation pass for a document.

    Validation must never turn a successful extraction into a failed job, so
    errors here are logged and swallowed. The run itself is committed by the
    validation service.
    """
    from app.models import ValidationTrigger
    from app.services.validation import run_validation_for_document

    try:
        document = session.get(Document, document_id)
        if document is None:
            return
        run_validation_for_document(
            session, document, trigger=ValidationTrigger.upload
        )
    except Exception:
        logger.exception(
            "upload-triggered validation failed for document %s", document_id
        )


def process_job(
    session: Session,
    job_id: uuid.UUID,
    *,
    extractor: Extractor = extract_document,
    sleep: Callable[[float], None] = time.sleep,
    max_attempts: int | None = None,
    backoff: Sequence[int] | None = None,
) -> None:
    """Run a single job to completion, retrying up to ``max_attempts`` times.

    Concurrency-safe: returns without doing anything if the job is terminal or
    was already claimed. ``extractor`` and ``sleep`` are injectable for tests.
    """
    max_attempts = max_attempts or settings.EXTRACTION_JOB_MAX_ATTEMPTS
    delays = list(
        backoff if backoff is not None else settings.EXTRACTION_JOB_BACKOFF_SECONDS
    )

    job = session.get(ExtractionJob, job_id)
    if job is None or job.status in (
        ExtractionJobStatus.succeeded,
        ExtractionJobStatus.failed,
    ):
        return
    if not _claim_job(session, job_id):
        return
    session.refresh(job)

    while True:
        document = session.get(Document, job.document_id)
        try:
            if document is None:
                raise FileNotFoundError(f"document {job.document_id} no longer exists")
            extractor(session, document)
        except Exception as exc:  # noqa: BLE001 - any failure is a job failure
            session.rollback()
            job = _require_job(session, job_id)
            document = session.get(Document, job.document_id)
            job.last_error = str(exc)[:2000]
            if job.attempts >= max_attempts:
                job.status = ExtractionJobStatus.failed
                job.finished_at = _now()
                if document is not None:
                    document.extraction_status = ExtractionStatus.failed
                    session.add(document)
                session.add(job)
                session.commit()
                logger.error(
                    "extraction job %s failed after %s attempts: %s",
                    job.id,
                    job.attempts,
                    job.last_error,
                )
                return
            session.add(job)
            session.commit()
            delay = delays[min(job.attempts - 1, len(delays) - 1)] if delays else 0
            logger.warning(
                "extraction job %s attempt %s failed, retrying in %ss: %s",
                job.id,
                job.attempts,
                delay,
                job.last_error,
            )
            sleep(delay)
            job = _require_job(session, job_id)
            job.attempts += 1
            session.add(job)
            session.commit()
        else:
            job = _require_job(session, job_id)
            job.status = ExtractionJobStatus.succeeded
            job.last_error = None
            job.finished_at = _now()
            session.add(job)
            session.commit()
            _trigger_upload_validation(session, job.document_id)
            logger.info("extraction job %s succeeded", job.id)
            return


def recover_pending_jobs(
    session: Session, *, stale_after: int | None = None
) -> list[uuid.UUID]:
    """Return ids of jobs that need running.

    ``running`` jobs whose ``started_at`` predates the staleness window are
    assumed orphaned by a crash and reset to ``pending`` (a restart may have
    interrupted them). Pending jobs are always returned.
    """
    stale_seconds = (
        settings.EXTRACTION_JOB_STALE_RUNNING_SECONDS
        if stale_after is None
        else stale_after
    )
    session.execute(
        update(ExtractionJob)
        .where(
            col(ExtractionJob.status) == ExtractionJobStatus.running,
            col(ExtractionJob.started_at)
            < _now() - timedelta(seconds=stale_seconds),
        )
        .values(status=ExtractionJobStatus.pending, started_at=None)
    )
    session.commit()
    job_ids = session.exec(
        select(ExtractionJob.id)
        .where(ExtractionJob.status == ExtractionJobStatus.pending)
        .order_by(col(ExtractionJob.created_at))
    ).all()
    return list(job_ids)


def run_extraction_job(job_id: uuid.UUID) -> None:
    """Entry point scheduled after upload; owns its own session."""
    with Session(engine) as session:
        process_job(session, job_id)


async def poll_extraction_jobs(
    interval: int | None = None, *, app_engine: Engine = engine
) -> None:
    """Periodically recover pending/stale jobs and run them.

    Started from the FastAPI lifespan; disabled in tests via
    ``EXTRACTION_POLLER_ENABLED``.
    """
    interval = interval or settings.EXTRACTION_POLL_INTERVAL
    while True:
        await asyncio.sleep(interval)
        try:
            with Session(app_engine) as session:
                job_ids = recover_pending_jobs(session)
            for job_id in job_ids:
                task = asyncio.create_task(
                    asyncio.to_thread(run_extraction_job, job_id)
                )
                _background_tasks.add(task)
                task.add_done_callback(_background_tasks.discard)
        except Exception:  # the poller must never die
            logger.exception("extraction poller tick failed")


def stop_poller() -> None:
    """Cancel outstanding poller-spawned tasks (called on shutdown)."""
    for task in list(_background_tasks):
        task.cancel()
    _background_tasks.clear()
