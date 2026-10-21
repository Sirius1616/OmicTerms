import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Document,
    Experiment,
    Message,
    Project,
    Sample,
    ValidationIssuePublic,
    ValidationRun,
    ValidationRunPublic,
    ValidationRunsPublic,
    ValidationTrigger,
)
from app.services.validation import list_validation_runs, run_validation_for_document

router = APIRouter(prefix="/documents", tags=["documents"])


def _check_document_owner(session: SessionDep, document_id: uuid.UUID, user_id: uuid.UUID) -> Document:
    document = session.get(Document, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    sample = session.get(Sample, document.sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Document not found")
    experiment = session.get(Experiment, sample.experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Document not found")
    project = session.get(Project, experiment.project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return document


@router.post("/{id}/validate", response_model=ValidationRunPublic)
def validate_document(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> Any:
    document = _check_document_owner(session, id, current_user.id)
    run = run_validation_for_document(session, document, trigger=ValidationTrigger.manual)
    session.refresh(run)
    issues = [
        ValidationIssuePublic(
            id=issue.id,
            code=issue.code,
            severity=issue.severity,
            message=issue.message,
            detail=issue.detail,
            field=issue.field,
            path=issue.path,
            suggestion=issue.suggestion,
            dedup_key=issue.dedup_key,
        )
        for issue in run.issues
    ]
    return ValidationRunPublic(
        id=run.id,
        subject_type=run.subject_type,
        subject_id=run.subject_id,
        document_id=run.document_id,
        trigger=run.trigger,
        started_at=run.started_at,
        finished_at=run.finished_at,
        status=run.status,
        validator_set_version=run.validator_set_version,
        issues=issues,
    )


@router.get("/{id}/validations", response_model=ValidationRunsPublic)
def list_document_validations(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    document = _check_document_owner(session, id, current_user.id)
    runs = list_validation_runs(session, document.id)
    data = []
    for run in runs:
        issues = [
            ValidationIssuePublic(
                id=issue.id,
                code=issue.code,
                severity=issue.severity,
                message=issue.message,
                detail=issue.detail,
                field=issue.field,
                path=issue.path,
                suggestion=issue.suggestion,
                dedup_key=issue.dedup_key,
            )
            for issue in run.issues
        ]
        data.append(
            ValidationRunPublic(
                id=run.id,
                subject_type=run.subject_type,
                subject_id=run.subject_id,
                document_id=run.document_id,
                trigger=run.trigger,
                started_at=run.started_at,
                finished_at=run.finished_at,
                status=run.status,
                validator_set_version=run.validator_set_version,
                issues=issues,
            )
        )
    return ValidationRunsPublic(data=data, count=len(data))


@router.get("/validations/{run_id}", response_model=ValidationRunPublic)
def get_validation_run(
    session: SessionDep, current_user: CurrentUser, run_id: uuid.UUID
) -> Any:
    run = session.get(ValidationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Validation run not found")
    if run.document_id:
        document = session.get(Document, run.document_id)
        if not document:
            raise HTTPException(status_code=404, detail="Validation run not found")
        _check_document_owner(session, document.id, current_user.id)
    else:
        raise HTTPException(status_code=404, detail="Validation run not found")
    issues = [
        ValidationIssuePublic(
            id=issue.id,
            code=issue.code,
            severity=issue.severity,
            message=issue.message,
            detail=issue.detail,
            field=issue.field,
            path=issue.path,
            suggestion=issue.suggestion,
            dedup_key=issue.dedup_key,
        )
        for issue in run.issues
    ]
    return ValidationRunPublic(
        id=run.id,
        subject_type=run.subject_type,
        subject_id=run.subject_id,
        document_id=run.document_id,
        trigger=run.trigger,
        started_at=run.started_at,
        finished_at=run.finished_at,
        status=run.status,
        validator_set_version=run.validator_set_version,
        issues=issues,
    )
