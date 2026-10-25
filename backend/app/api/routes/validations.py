import uuid
from typing import Any

from fastapi import APIRouter, HTTPException

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Document,
    Experiment,
    Project,
    Sample,
    ValidationIssuePublic,
    ValidationRun,
    ValidationRunPublic,
    ValidationRunsPublic,
    ValidationRunSummary,
    ValidationSubjectType,
    ValidationTrigger,
)
from app.services.validation import list_validation_runs, run_validation_for_document

router = APIRouter(prefix="/documents", tags=["documents"])
validation_router = APIRouter(tags=["validations"])


def _check_document_owner(
    session: SessionDep, document_id: uuid.UUID, user_id: uuid.UUID
) -> Document:
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


def _to_public(run: ValidationRun) -> ValidationRunPublic:
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


def _summarize(run: ValidationRun | None) -> ValidationRunSummary | None:
    if run is None:
        return None
    summary = ValidationRunSummary(run_id=run.id)
    for issue in run.issues:
        severity = str(issue.severity)
        if severity == "error":
            summary.errors += 1
        elif severity == "warning":
            summary.warnings += 1
        elif severity == "skipped":
            summary.skipped += 1
        else:
            summary.info += 1
        summary.total += 1
    return summary


@router.post("/{id}/validate", response_model=ValidationRunPublic)
def validate_document(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    document = _check_document_owner(session, id, current_user.id)
    run = run_validation_for_document(session, document, trigger=ValidationTrigger.manual)
    session.refresh(run)
    return _to_public(run)


@router.get("/{id}/validations", response_model=ValidationRunsPublic)
def list_document_validations(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    document = _check_document_owner(session, id, current_user.id)
    runs = list_validation_runs(session, document.id)
    data = [_to_public(run) for run in runs]
    return ValidationRunsPublic(
        data=data,
        count=len(data),
        latest_summary=_summarize(runs[0] if runs else None),
    )


@validation_router.get("/validations/{run_id}", response_model=ValidationRunPublic)
def get_validation_run(
    session: SessionDep, current_user: CurrentUser, run_id: uuid.UUID
) -> Any:
    run = session.get(ValidationRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Validation run not found")
    if not run.document_id:
        raise HTTPException(status_code=404, detail="Validation run not found")
    document = session.get(Document, run.document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Validation run not found")
    _check_document_owner(session, document.id, current_user.id)
    return _to_public(run)


def _check_experiment_owner(session: SessionDep, experiment_id: uuid.UUID, user_id: uuid.UUID) -> Experiment:
    experiment = session.get(Experiment, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    project = session.get(Project, experiment.project_id)
    if not project or project.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return experiment


@router.post("/experiments/{id}/validate-cross", response_model=ValidationRunPublic)
def validate_experiment_cross(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    experiment = _check_experiment_owner(session, id, current_user.id)
    from app.services.cross_validation import run_cross_validation_for_experiment

    run = run_cross_validation_for_experiment(session, experiment, trigger=ValidationTrigger.manual)
    session.refresh(run)
    return _to_public(run)


@router.get("/experiments/{id}/validations-cross", response_model=ValidationRunsPublic)
def list_experiment_cross_validations(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> Any:
    experiment = _check_experiment_owner(session, id, current_user.id)
    from sqlmodel import col, select

    runs = session.exec(
        select(ValidationRun)
        .where(col(ValidationRun.subject_type) == ValidationSubjectType.experiment)
        .where(col(ValidationRun.subject_id) == experiment.id)
        .order_by(col(ValidationRun.started_at).desc())
    ).all()
    data = [_to_public(run) for run in runs]
    return ValidationRunsPublic(
        data=data,
        count=len(data),
        latest_summary=_summarize(runs[0] if runs else None),
    )
