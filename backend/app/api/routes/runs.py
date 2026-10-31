"""Story 22 — AnalysisRun endpoints (provenance backbone).

Runs are tenant-scoped through their project: cross-user access returns 404
rather than a 403 to avoid leaking existence. Creation is intentionally a
plain record (no compute starts here — Story 25 owns execution); extraction
jobs emit their own records through the service (Story 13 wiring).
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    AnalysisRun,
    AnalysisRunCreate,
    AnalysisRunPublic,
    AnalysisRunsPublic,
    Project,
)
from app.services import runs

router = APIRouter(tags=["runs"])


def _owned_project(
    session: SessionDep, current_user: CurrentUser, project_id: UUID
) -> Project:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


def _owned_run(
    session: SessionDep, current_user: CurrentUser, run_id: UUID
) -> AnalysisRun:
    run = session.get(AnalysisRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    project = session.get(Project, run.project_id)
    if project is None or project.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.post(
    "/projects/{project_id}/runs",
    response_model=AnalysisRunPublic,
    status_code=201,
)
def create_run(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    run_in: AnalysisRunCreate,
) -> AnalysisRunPublic:
    project = _owned_project(session, current_user, project_id)
    run = runs.create_run(
        session,
        project,
        tool_name=run_in.tool_name,
        tool_version=run_in.tool_version,
        adapter_id=run_in.adapter_id,
        parameters=run_in.parameters,
        config_hash=run_in.config_hash,
        input_refs=run_in.input_refs,
        actor_user_id=current_user.id,
        notes=run_in.notes,
    )
    return AnalysisRunPublic.model_validate(run)


@router.get("/projects/{project_id}/runs", response_model=AnalysisRunsPublic)
def list_project_runs(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> AnalysisRunsPublic:
    project = _owned_project(session, current_user, project_id)
    count = session.exec(
        select(func.count())
        .select_from(AnalysisRun)
        .where(col(AnalysisRun.project_id) == project.id)
    ).one()
    statement = (
        select(AnalysisRun)
        .where(col(AnalysisRun.project_id) == project.id)
        .order_by(col(AnalysisRun.created_at).desc())
        .offset(skip)
        .limit(limit)
    )
    data = [
        AnalysisRunPublic.model_validate(run)
        for run in session.exec(statement).all()
    ]
    return AnalysisRunsPublic(data=data, count=count)


@router.get("/runs/{run_id}", response_model=AnalysisRunPublic)
def read_run(
    session: SessionDep, current_user: CurrentUser, run_id: UUID
) -> AnalysisRunPublic:
    run = _owned_run(session, current_user, run_id)
    return AnalysisRunPublic.model_validate(run)


@router.post("/runs/{run_id}/cancel", response_model=AnalysisRunPublic)
def cancel_run(
    session: SessionDep, current_user: CurrentUser, run_id: UUID
) -> AnalysisRunPublic:
    run = _owned_run(session, current_user, run_id)
    if run.status not in ("queued", "running"):
        raise HTTPException(
            status_code=422, detail="Only queued or running runs can be cancelled"
        )
    run = runs.cancel_run(session, run, actor_id=current_user.id)
    return AnalysisRunPublic.model_validate(run)
