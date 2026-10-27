from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException
from sqlmodel import Session, col, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    ImportJob,
    ImportJobPublic,
    ImportJobsPublic,
    RepositoryImport,
    RepositoryImportPublic,
    RepositoryImportsPublic,
)
from app.services import import_jobs as import_jobs_service

router = APIRouter(prefix="/imports", tags=["imports"])

_REPO_TYPES = {"geo", "ena", "sra", "pride"}


def _owned_project_or_none(session: Session, user_id: uuid.UUID, project_id: uuid.UUID | None) -> uuid.UUID | None:
    if project_id is None:
        return None
    project = crud.get_project_owned_by(session, user_id, project_id)
    if project is None:
        raise HTTPException(status_code=403, detail="Project not owned by user")
    return project_id


def _owned_experiment_or_none(
    session: Session, user_id: uuid.UUID, experiment_id: uuid.UUID | None
) -> uuid.UUID | None:
    if experiment_id is None:
        return None
    experiment = crud.get_experiment_owned_by(session, user_id, experiment_id)
    if experiment is None:
        raise HTTPException(status_code=403, detail="Experiment not owned by user")
    return experiment_id


@router.post("/", response_model=RepositoryImportPublic)
def create_import(
    session: SessionDep,
    current_user: CurrentUser,
    repo: str,
    accession: str,
    project_id: uuid.UUID | None = None,
    experiment_id: uuid.UUID | None = None,
    query: str | None = None,
) -> RepositoryImportPublic:
    if repo not in _REPO_TYPES:
        raise HTTPException(status_code=422, detail="Unsupported repository type")
    if not accession or len(accession) > 256:
        raise HTTPException(status_code=422, detail="Invalid accession")
    owned_project_id = _owned_project_or_none(session, current_user.id, project_id)
    owned_experiment_id = _owned_experiment_or_none(session, current_user.id, experiment_id)
    imp = import_jobs_service.create_import(
        session,
        owner_id=current_user.id,
        repo=repo,  # type: ignore[arg-type]
        accession=accession,
        project_id=owned_project_id,
        experiment_id=owned_experiment_id,
        query=query,
    )
    return RepositoryImportPublic.model_validate(imp)


@router.get("/", response_model=RepositoryImportsPublic)
def list_imports(
    session: SessionDep, current_user: CurrentUser
) -> RepositoryImportsPublic:
    imports = session.exec(
        select(RepositoryImport)
        .where(RepositoryImport.owner_id == current_user.id)
        .order_by(col(RepositoryImport.created_at).desc())
    ).all()
    return RepositoryImportsPublic(
        data=[RepositoryImportPublic.model_validate(i) for i in imports],
        count=len(imports),
    )


@router.get("/{id}", response_model=RepositoryImportPublic)
def get_import(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> RepositoryImportPublic:
    imp = import_jobs_service.get_import_owned(session, id, current_user.id)
    if imp is None:
        raise HTTPException(status_code=404, detail="Import not found")
    return RepositoryImportPublic.model_validate(imp)


@router.get("/{id}/jobs", response_model=ImportJobsPublic)
def list_import_jobs(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> ImportJobsPublic:
    imp = import_jobs_service.get_import_owned(session, id, current_user.id)
    if imp is None:
        raise HTTPException(status_code=404, detail="Import not found")
    jobs = session.exec(
        select(ImportJob)
        .where(ImportJob.import_id == id)
        .order_by(col(ImportJob.created_at).desc())
    ).all()
    return ImportJobsPublic(
        data=[ImportJobPublic.model_validate(j) for j in jobs],
        count=len(jobs),
    )
