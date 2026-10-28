from __future__ import annotations

import json
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session, col, select

from app.models import (
    Document,
    ProvenanceActorType,
    ValidationIssue,
    ValidationRun,
    ValidationSubjectType,
    ValidationTrigger,
)
from app.services import provenance
from app.validation import ValidationContext, get_registry


def _count_issues(issues: Sequence[Any]) -> dict[str, int]:
    counts = {"errors": 0, "warnings": 0, "info": 0, "skipped": 0, "total": len(issues)}
    for issue in issues:
        sev = issue.severity.value if hasattr(issue.severity, "value") else str(issue.severity)
        if sev == "error":
            counts["errors"] += 1
        elif sev == "warning":
            counts["warnings"] += 1
        elif sev == "info":
            counts["info"] += 1
        elif sev == "skipped":
            counts["skipped"] += 1
    return counts


def run_validation_for_document(
    session: Session,
    document: Document,
    trigger: ValidationTrigger = ValidationTrigger.manual,
) -> ValidationRun:
    from app.models import DatasetMetadata

    metadata = session.exec(
        select(DatasetMetadata).where(col(DatasetMetadata.document_id) == document.id)
    ).first()
    assembly = metadata.genome_assembly if metadata and metadata.genome_assembly else None
    ctx = ValidationContext(
        document_id=str(document.id),
        document=document,
        session=session,
        trigger=trigger.value if hasattr(trigger, "value") else str(trigger),
        assembly_declared=assembly is not None and assembly.strip() != "",
        assembly=assembly,
    )
    registry = get_registry()
    domain_issues = registry.run_all(ctx)

    run = ValidationRun(
        subject_type=ValidationSubjectType.document,
        subject_id=document.id,
        document_id=document.id,
        trigger=trigger,
        started_at=datetime.now(UTC),
        finished_at=datetime.now(UTC),
        status="succeeded",
        validator_set_version="1.0",
    )
    session.add(run)
    session.flush()

    for di in domain_issues:
        detail_str = di.detail
        if detail_str is not None and isinstance(detail_str, dict):
            detail_str = json.dumps(detail_str)
        issue = ValidationIssue(
            run_id=run.id,
            code=di.code,
            severity=di.severity,  # type: ignore[arg-type]
            message=di.message,
            detail=detail_str,
            field=di.field,
            path=di.path,
            suggestion=di.suggestion,
            dedup_key=di.dedup_key,
        )
        session.add(issue)

    session.add(run)
    session.commit()
    session.refresh(run)
    project_id = provenance.project_id_for_document(session, document.id)
    if project_id is not None:
        provenance.record(
            session,
            project_id=project_id,
            action="validation.run",
            entity_type="document",
            entity_id=str(document.id),
            actor_type=ProvenanceActorType.system,
            payload={
                "run_id": str(run.id),
                "trigger": run.trigger.value if hasattr(run.trigger, "value") else str(run.trigger),
                "status": run.status,
                **_count_issues(domain_issues),
            },
        )
    return run


def get_latest_validation_run(session: Session, document_id):
    statement = (
        select(ValidationRun)
        .where(col(ValidationRun.document_id) == document_id)
        .order_by(col(ValidationRun.started_at).desc())
        .limit(1)
    )
    return session.exec(statement).first()


def list_validation_runs(session: Session, document_id):
    statement = (
        select(ValidationRun)
        .where(col(ValidationRun.document_id) == document_id)
        .order_by(col(ValidationRun.started_at).desc())
    )
    runs = session.exec(statement).all()
    return runs
