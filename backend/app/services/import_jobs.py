from datetime import UTC, datetime
from uuid import UUID

from sqlmodel import Session

from app.models import (
    ExternalRepoType,
    ImportJob,
    ImportJobStatus,
    RepositoryImport,
    RepositoryImportStatus,
)


def create_import(
    session: Session,
    *,
    owner_id: UUID,
    repo: ExternalRepoType,
    accession: str,
    project_id: UUID | None = None,
    experiment_id: UUID | None = None,
    query: str | None = None,
    metadata_json: str | None = None,
) -> RepositoryImport:
    """Create a repository import record with its first import job (pending)."""
    imp = RepositoryImport(
        owner_id=owner_id,
        project_id=project_id,
        experiment_id=experiment_id,
        repo=repo,
        accession=accession,
        query=query,
        status=RepositoryImportStatus.pending,
        metadata_json=metadata_json,
    )
    session.add(imp)
    session.flush()
    job = ImportJob(import_id=imp.id, status=ImportJobStatus.pending)
    session.add(job)
    session.commit()
    session.refresh(imp)
    return imp


def claim_job(session: Session, job_id: UUID) -> ImportJob | None:
    """Claim a pending job for execution (records attempt, CAS on pending)."""
    job = session.get(ImportJob, job_id)
    if job is None or job.status != ImportJobStatus.pending:
        return None
    job.status = ImportJobStatus.running
    job.attempts += 1
    job.started_at = datetime.now(UTC)
    session.add(job)
    imp = session.get(RepositoryImport, job.import_id)
    if imp is not None:
        imp.status = RepositoryImportStatus.running
        imp.updated_at = datetime.now(UTC)
        session.add(imp)
    session.commit()
    session.refresh(job)
    return job


def complete_job(
    session: Session, job_id: UUID, downloaded_bytes: int | None = None
) -> ImportJob | None:
    """Mark a running job succeeded and propagate to the import record."""
    job = session.get(ImportJob, job_id)
    if job is None or job.status != ImportJobStatus.running:
        return None
    job.status = ImportJobStatus.succeeded
    job.finished_at = datetime.now(UTC)
    if downloaded_bytes is not None:
        job.downloaded_bytes = downloaded_bytes
    session.add(job)
    imp = session.get(RepositoryImport, job.import_id)
    if imp is not None:
        imp.status = RepositoryImportStatus.succeeded
        imp.updated_at = datetime.now(UTC)
        session.add(imp)
    session.commit()
    session.refresh(job)
    return job


def fail_job(session: Session, job_id: UUID, error: str) -> ImportJob | None:
    """Mark a running job failed, store error, propagate to the import record."""
    job = session.get(ImportJob, job_id)
    if job is None or job.status not in (ImportJobStatus.running, ImportJobStatus.pending):
        return None
    job.status = ImportJobStatus.failed
    job.last_error = error[:2000]
    job.finished_at = datetime.now(UTC)
    session.add(job)
    imp = session.get(RepositoryImport, job.import_id)
    if imp is not None:
        imp.status = RepositoryImportStatus.failed
        imp.updated_at = datetime.now(UTC)
        session.add(imp)
    session.commit()
    session.refresh(job)
    return job


def cancel_job(session: Session, job_id: UUID) -> ImportJob | None:
    """Cooperatively cancel a pending job (running jobs finish first)."""
    job = session.get(ImportJob, job_id)
    if job is None or job.status != ImportJobStatus.pending:
        return None
    job.status = ImportJobStatus.cancelled
    job.finished_at = datetime.now(UTC)
    session.add(job)
    imp = session.get(RepositoryImport, job.import_id)
    if imp is not None:
        imp.status = RepositoryImportStatus.cancelled
        imp.updated_at = datetime.now(UTC)
        session.add(imp)
    session.commit()
    session.refresh(job)
    return job


def get_import_owned(
    session: Session, import_id: UUID, owner_id: UUID
) -> RepositoryImport | None:
    """Tenant isolation: only the owner may see their import."""
    imp = session.get(RepositoryImport, import_id)
    if imp is None or imp.owner_id != owner_id:
        return None
    return imp
