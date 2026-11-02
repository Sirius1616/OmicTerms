"""Story 30 — Finding endpoints.

Findings are tenant-scoped through their project (cross-user access returns
404 like every other resource). The business rules live in
``app/services/findings.py``; this layer only maps errors onto HTTP codes:

- ``FindingRuleError`` → 422 with the rule message (cross-project evidence,
  missing primary evidence on publish, frozen published finding, …)
- unknown or non-owned resource → 404 (never 403, to avoid leaking existence)
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Finding,
    FindingCreate,
    FindingEvidenceCreate,
    FindingEvidencePublic,
    FindingPublic,
    FindingsPublic,
    FindingUpdate,
    FindingValidationResult,
    FindingVersionsPublic,
    Project,
)
from app.services import findings

router = APIRouter(tags=["findings"])


def _not_found() -> HTTPException:
    return HTTPException(status_code=404, detail="Finding not found")


def _owned_project(
    session: SessionDep, current_user: CurrentUser, project_id: UUID
) -> Project:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _owned_finding(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> Finding:
    if not (finding := findings.get_owned_finding(session, finding_id, current_user.id)):
        raise _not_found()
    return finding


@router.post("/projects/{project_id}/findings", response_model=FindingPublic,
             status_code=201)
def create_finding(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    finding_in: FindingCreate,
) -> FindingPublic:
    project = _owned_project(session, current_user, project_id)
    refs = [
        (ref.target_type, ref.target_id, ref.quote_or_field, ref.role)
        for ref in finding_in.evidence
    ]
    try:
        finding = findings.create_finding(
            session,
            project.id,
            title=finding_in.title,
            summary=finding_in.summary,
            supersedes_id=finding_in.supersedes_id,
            evidence_refs=refs,
            actor_user_id=current_user.id,
        )
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return findings.finding_to_public(session, finding)


@router.get("/projects/{project_id}/findings", response_model=FindingsPublic)
def list_project_findings(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> FindingsPublic:
    project = _owned_project(session, current_user, project_id)
    count = session.exec(
        select(func.count())
        .select_from(Finding)
        .where(col(Finding.project_id) == project.id)
    ).one()
    statement = (
        select(Finding)
        .where(col(Finding.project_id) == project.id)
        .order_by(col(Finding.updated_at).desc())
        .offset(skip)
        .limit(limit)
    )
    data = [
        findings.finding_to_public(session, finding)
        for finding in session.exec(statement).all()
    ]
    return FindingsPublic(data=data, count=count)


@router.get("/findings/{finding_id}", response_model=FindingPublic)
def read_finding(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> FindingPublic:
    finding = _owned_finding(session, current_user, finding_id)
    return findings.finding_to_public(session, finding)


@router.patch("/findings/{finding_id}", response_model=FindingPublic)
def update_finding(
    session: SessionDep,
    current_user: CurrentUser,
    finding_id: UUID,
    finding_in: FindingUpdate,
) -> FindingPublic:
    finding = _owned_finding(session, current_user, finding_id)
    try:
        finding = findings.update_finding(
            session,
            finding,
            title=finding_in.title,
            summary=finding_in.summary,
            supersedes_id=finding_in.supersedes_id,
            disputed=finding_in.disputed,
            status=finding_in.status,
            actor_user_id=current_user.id,
        )
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return findings.finding_to_public(session, finding)


@router.delete("/findings/{finding_id}", status_code=204)
def delete_finding(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> None:
    finding = _owned_finding(session, current_user, finding_id)
    try:
        findings.delete_finding(session, finding, actor_user_id=current_user.id)
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.get("/findings/{finding_id}/versions", response_model=FindingVersionsPublic)
def list_finding_versions(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> FindingVersionsPublic:
    finding = _owned_finding(session, current_user, finding_id)
    versions, count = findings.list_finding_versions(session, finding)
    return FindingVersionsPublic(data=versions, count=count)


@router.post(
    "/findings/{finding_id}/evidence", response_model=FindingEvidencePublic
)
def add_finding_evidence(
    session: SessionDep,
    current_user: CurrentUser,
    finding_id: UUID,
    evidence_in: FindingEvidenceCreate,
) -> FindingEvidencePublic:
    finding = _owned_finding(session, current_user, finding_id)
    try:
        row = findings.add_evidence(
            session,
            finding,
            target_type=evidence_in.target_type,
            target_id=evidence_in.target_id,
            quote_or_field=evidence_in.quote_or_field,
            role=evidence_in.role,
            actor_user_id=current_user.id,
        )
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return findings.evidence_to_public(session, finding, row)


@router.delete(
    "/findings/{finding_id}/evidence/{evidence_id}", status_code=204
)
def remove_finding_evidence(
    session: SessionDep,
    current_user: CurrentUser,
    finding_id: UUID,
    evidence_id: UUID,
) -> None:
    finding = _owned_finding(session, current_user, finding_id)
    try:
        findings.remove_evidence(
            session, finding, evidence_id, actor_user_id=current_user.id
        )
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@router.post("/findings/{finding_id}/publish", response_model=FindingPublic)
def publish_finding(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> FindingPublic:
    finding = _owned_finding(session, current_user, finding_id)
    try:
        finding = findings.publish_finding(session, finding, actor_user_id=current_user.id)
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return findings.finding_to_public(session, finding)


@router.post("/findings/{finding_id}/retract", response_model=FindingPublic)
def retract_finding(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> FindingPublic:
    finding = _owned_finding(session, current_user, finding_id)
    try:
        finding = findings.retract_finding(session, finding, actor_user_id=current_user.id)
    except findings.FindingRuleError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    return findings.finding_to_public(session, finding)


@router.post(
    "/findings/{finding_id}/validate", response_model=FindingValidationResult
)
def validate_finding(
    session: SessionDep, current_user: CurrentUser, finding_id: UUID
) -> FindingValidationResult:
    """Deterministic claim checks.

    The endpoint takes **no body**: no caller — human or AI — can declare
    ``validated``. The result carries before/after validation states and the
    issues found; fixing them and re-running sets ``validated`` server-side.
    """
    finding = _owned_finding(session, current_user, finding_id)
    _, result = findings.validate_finding(
        session, finding, actor_user_id=current_user.id
    )
    return result
