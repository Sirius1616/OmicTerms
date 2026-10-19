"""Behaviour of the durable extraction jobs (Story 13).

These exercise the session-level engine directly (claim, retry, terminal
states, crash recovery) with an injected extractor, so no real file or worker
thread is needed.
"""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlmodel import Session

from app.models import (
    Document,
    Experiment,
    ExtractionJob,
    ExtractionJobStatus,
    ExtractionStatus,
    Project,
    Sample,
    User,
)
from app.services.extraction_job import (
    enqueue_extraction_job,
    process_job,
    recover_pending_jobs,
)

pytestmark = pytest.mark.integration


def _make_document(session: Session) -> Document:
    user = User(
        email=f"{uuid.uuid4().hex[:8]}@example.com", hashed_password="x"
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    project = Project(name="Proj", user_id=user.id)
    session.add(project)
    session.commit()
    experiment = Experiment(name="Exp", project_id=project.id)
    session.add(experiment)
    session.commit()
    sample = Sample(name="Sample", experiment_id=experiment.id)
    session.add(sample)
    session.commit()

    document = Document(file_url="api/v1/uploads/abc.tsv", sample_id=sample.id)
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


def _succeeding(session: Session, document: Document) -> None:
    document.raw_extracted_json = "{}"
    document.extraction_status = ExtractionStatus.success
    session.add(document)


def test_success_completes_job(session: Session) -> None:
    document = _make_document(session)
    job = enqueue_extraction_job(session, document.id)
    assert job.status == ExtractionJobStatus.pending

    process_job(session, job.id, extractor=_succeeding, sleep=lambda _: None)

    job = session.get(ExtractionJob, job.id)
    assert job.status == ExtractionJobStatus.succeeded
    assert job.attempts == 1
    assert job.started_at is not None
    assert job.finished_at is not None
    assert job.last_error is None
    refreshed = session.get(Document, document.id)
    assert refreshed.extraction_status == ExtractionStatus.success


def test_retries_then_succeeds(session: Session) -> None:
    document = _make_document(session)
    job = enqueue_extraction_job(session, document.id)
    calls = {"n": 0}

    def flaky(session_: Session, doc: Document) -> None:
        calls["n"] += 1
        if calls["n"] < 3:
            raise RuntimeError("transient")
        _succeeding(session_, doc)

    process_job(
        session, job.id, extractor=flaky, sleep=lambda _: None, max_attempts=3
    )

    job = session.get(ExtractionJob, job.id)
    assert job.status == ExtractionJobStatus.succeeded
    assert job.attempts == 3
    assert calls["n"] == 3


def test_exhausted_retries_fail_never_pending(session: Session) -> None:
    document = _make_document(session)
    job = enqueue_extraction_job(session, document.id)

    def always_fails(session_: Session, doc: Document) -> None:
        raise RuntimeError("permanent")

    process_job(
        session, job.id, extractor=always_fails, sleep=lambda _: None, max_attempts=2
    )

    job = session.get(ExtractionJob, job.id)
    assert job.status == ExtractionJobStatus.failed
    assert job.attempts == 2
    assert "permanent" in (job.last_error or "")
    assert session.get(Document, document.id).extraction_status == (
        ExtractionStatus.failed
    )


def test_process_is_idempotent_after_success(session: Session) -> None:
    document = _make_document(session)
    job = enqueue_extraction_job(session, document.id)

    process_job(session, job.id, extractor=_succeeding, sleep=lambda _: None)
    process_job(session, job.id, extractor=_succeeding, sleep=lambda _: None)

    assert session.get(ExtractionJob, job.id).attempts == 1


def test_recover_returns_pending_and_skips_finished(session: Session) -> None:
    document = _make_document(session)
    pending = enqueue_extraction_job(session, document.id)
    finished = enqueue_extraction_job(session, document.id)
    process_job(session, finished.id, extractor=_succeeding, sleep=lambda _: None)

    recovered = recover_pending_jobs(session)

    assert pending.id in recovered
    assert finished.id not in recovered


def test_recovered_jobs_run_to_completion(session: Session) -> None:
    """The poller's recovery path: pending jobs are found and then completed."""
    document = _make_document(session)
    job = enqueue_extraction_job(session, document.id)

    for recovered_id in recover_pending_jobs(session):
        process_job(session, recovered_id, extractor=_succeeding, sleep=lambda _: None)

    assert session.get(ExtractionJob, job.id).status == ExtractionJobStatus.succeeded


def test_concurrent_jobs_do_not_cross_talk(session: Session) -> None:
    first = _make_document(session)
    second = _make_document(session)
    first_job = enqueue_extraction_job(session, first.id)
    second_job = enqueue_extraction_job(session, second.id)

    def touched_twice(session_: Session, doc: Document) -> None:
        doc.raw_extracted_json = f'{{"doc": "{doc.id}"}}'
        doc.extraction_status = ExtractionStatus.success
        session_.add(doc)

    process_job(session, first_job.id, extractor=touched_twice, sleep=lambda _: None)
    process_job(session, second_job.id, extractor=touched_twice, sleep=lambda _: None)

    assert session.get(Document, first.id).raw_extracted_json == (
        f'{{"doc": "{first.id}"}}'
    )
    assert session.get(Document, second.id).raw_extracted_json == (
        f'{{"doc": "{second.id}"}}'
    )


def test_recover_resets_stale_running(session: Session) -> None:
    document = _make_document(session)
    job = enqueue_extraction_job(session, document.id)
    job.status = ExtractionJobStatus.running
    job.started_at = datetime.now(UTC) - timedelta(hours=1)
    session.add(job)
    session.commit()

    recovered = recover_pending_jobs(session, stale_after=1)

    assert job.id in recovered
    refreshed = session.get(ExtractionJob, job.id)
    assert refreshed.status == ExtractionJobStatus.pending
    assert refreshed.started_at is None
