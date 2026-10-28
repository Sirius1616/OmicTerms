from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Experiment,
    ExperimentCreate,
    ExperimentPublic,
    ExperimentsPublic,
    ExperimentUpdate,
    ProvenanceActorType,
)
from app.services import provenance

router = APIRouter(tags=["experiments"])


@router.post(
    "/projects/{project_id}/experiments",
    response_model=ExperimentPublic,
    status_code=201,
)
def create_experiment(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    experiment_in: ExperimentCreate,
) -> ExperimentPublic:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    experiment = Experiment(project_id=project.id, name=experiment_in.name)
    session.add(experiment)
    session.commit()
    session.refresh(experiment)
    provenance.record(
        session,
        project_id=project.id,
        action="experiment.created",
        entity_type="experiment",
        entity_id=str(experiment.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"name": experiment.name},
    )
    return ExperimentPublic.model_validate(experiment)


@router.get("/projects/{project_id}/experiments", response_model=ExperimentsPublic)
def read_project_experiments(
    session: SessionDep, current_user: CurrentUser, project_id: UUID
) -> ExperimentsPublic:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    count = session.exec(
        select(func.count())
        .select_from(Experiment)
        .where(Experiment.project_id == project.id)
    ).one()
    experiments = session.exec(
        select(Experiment)
        .where(Experiment.project_id == project.id)
        .order_by(col(Experiment.created_at))
    ).all()
    data = [ExperimentPublic.model_validate(experiment) for experiment in experiments]
    return ExperimentsPublic(data=data, count=count)


@router.get("/experiments/{experiment_id}", response_model=ExperimentPublic)
def read_experiment(
    session: SessionDep, current_user: CurrentUser, experiment_id: UUID
) -> ExperimentPublic:
    experiment = crud.get_experiment_owned_by(session, current_user.id, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    return ExperimentPublic.model_validate(experiment)


@router.patch("/experiments/{experiment_id}", response_model=ExperimentPublic)
def update_experiment(
    session: SessionDep,
    current_user: CurrentUser,
    experiment_id: UUID,
    experiment_in: ExperimentUpdate,
) -> ExperimentPublic:
    experiment = crud.get_experiment_owned_by(session, current_user.id, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    experiment_data = experiment_in.model_dump(exclude_unset=True)
    before_name = experiment.name
    experiment.sqlmodel_update(experiment_data)
    session.add(experiment)
    session.commit()
    session.refresh(experiment)
    provenance.record(
        session,
        project_id=experiment.project_id,
        action="experiment.updated",
        entity_type="experiment",
        entity_id=str(experiment.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"before": before_name, "after": experiment.name},
    )
    return ExperimentPublic.model_validate(experiment)


@router.delete("/experiments/{experiment_id}", status_code=204)
def delete_experiment(
    session: SessionDep, current_user: CurrentUser, experiment_id: UUID
) -> None:
    experiment = crud.get_experiment_owned_by(session, current_user.id, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    provenance.record(
        session,
        project_id=experiment.project_id,
        action="experiment.deleted",
        entity_type="experiment",
        entity_id=str(experiment.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"name": experiment.name},
    )
    crud.delete_experiment_tree(session, experiment)
    session.commit()
