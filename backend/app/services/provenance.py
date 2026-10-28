"""Provenance / audit trail (Story 32).

Every meaningful mutation emits an append-only :class:`ProvenanceEvent` row:
who (actor), what (action code from a closed registry), on which entity, with
a non-secret operational payload. Rows are never updated or deleted through
the API — the trail is the foundation for timelines (Story 33), manifests
(Story 35), and trust in reports.

Payload discipline: payloads carry filenames, ids, statuses, hashes and field
names only — never password/token contents or extracted full text. Auth
routes (login, password recovery/reset) emit no events at all, so secrets can
never enter the trail (redaction-tested).
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import update
from sqlmodel import Session, col

from app.core.request_id import get_request_id
from app.models import ProvenanceActorType, ProvenanceEvent

# Closed registry of emitted action codes. Extend only with review; services
# must never invent ad-hoc codes (tests enforce membership).
ACTION_REGISTRY: set[str] = {
    "project.created",
    "project.updated",
    "project.deleted",
    "experiment.created",
    "experiment.updated",
    "experiment.deleted",
    "sample.created",
    "sample.updated",
    "sample.deleted",
    "document.uploaded",
    "document.renamed",
    "document.deleted",
    "metadata.updated",
    "extraction.started",
    "extraction.succeeded",
    "extraction.failed",
    "validation.run",
    "user.updated",
    "user.password_changed",
    "import.origin",
    "import.succeeded",
    "import.failed",
}


def record(
    session: Session,
    *,
    project_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: str,
    actor_type: ProvenanceActorType,
    actor_id: uuid.UUID | None = None,
    payload: dict[str, Any] | None = None,
) -> ProvenanceEvent:
    """Persist one provenance event (commits on the caller's session)."""
    if action not in ACTION_REGISTRY:
        raise ValueError(f"unregistered provenance action: {action}")
    event = ProvenanceEvent(
        project_id=project_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        actor_type=actor_type,
        actor_id=actor_id,
        payload=payload or {},
        occurred_at=datetime.now(UTC),
        request_id=get_request_id(),
    )
    session.add(event)
    session.commit()
    session.refresh(event)
    return event


def record_import_origin(
    session: Session,
    *,
    project_id: uuid.UUID | None,
    repo: str,
    accession: str,
    source_urls: list[str] | None = None,
    import_id: str | None = None,
    job_id: str | None = None,
    fetched_at: str | None = None,
    **extra: Any,
) -> ProvenanceEvent:
    return record(
        session,
        project_id=project_id,
        action="import.origin",
        entity_type="import",
        entity_id=import_id or accession,
        actor_type=ProvenanceActorType.job,
        payload={
            "repo": repo,
            "accession": accession,
            "source_urls": source_urls or [],
            "import_id": import_id,
            "job_id": job_id,
            "fetched_at": fetched_at,
            **extra,
        },
    )


def project_id_for_document(session: Session, document_id: uuid.UUID) -> uuid.UUID | None:
    """Resolve the owning project of a document via the hierarchy walk."""
    from app.models import Document, Experiment, Sample

    document = session.get(Document, document_id)
    if document is None:
        return None
    sample = session.get(Sample, document.sample_id)
    if sample is None:
        return None
    experiment = session.get(Experiment, sample.experiment_id)
    if experiment is None:
        return None
    return experiment.project_id


def anonymise_actor(session: Session, actor_id: uuid.UUID) -> None:
    """GDPR-style erasure: blank the actor reference, keep the history."""
    session.execute(
        update(ProvenanceEvent)
        .where(col(ProvenanceEvent.actor_id) == actor_id)
        .values(actor_id=None)
    )
