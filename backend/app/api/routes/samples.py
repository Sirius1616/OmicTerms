from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Experiment,
    ProvenanceActorType,
    Sample,
    SampleCreate,
    SamplePublic,
    SamplesPublic,
    SampleUpdate,
)
from app.services import evidence, provenance

router = APIRouter(tags=["samples"])


@router.post(
    "/experiments/{experiment_id}/samples", response_model=SamplePublic, status_code=201
)
def create_sample(
    session: SessionDep,
    current_user: CurrentUser,
    experiment_id: UUID,
    sample_in: SampleCreate,
) -> SamplePublic:
    experiment = crud.get_experiment_owned_by(session, current_user.id, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    sample = Sample(experiment_id=experiment.id, name=sample_in.name)
    session.add(sample)
    session.commit()
    session.refresh(sample)
    evidence.ensure_sample_node(session, sample)
    provenance.record(
        session,
        project_id=experiment.project_id,
        action="sample.created",
        entity_type="sample",
        entity_id=str(sample.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"name": sample.name},
    )
    return SamplePublic.model_validate(sample)


@router.get("/experiments/{experiment_id}/samples", response_model=SamplesPublic)
def read_experiment_samples(
    session: SessionDep, current_user: CurrentUser, experiment_id: UUID
) -> SamplesPublic:
    experiment = crud.get_experiment_owned_by(session, current_user.id, experiment_id)
    if not experiment:
        raise HTTPException(status_code=404, detail="Experiment not found")
    count = session.exec(
        select(func.count())
        .select_from(Sample)
        .where(Sample.experiment_id == experiment.id)
    ).one()
    samples = session.exec(
        select(Sample)
        .where(Sample.experiment_id == experiment.id)
        .order_by(col(Sample.created_at))
    ).all()
    data = [SamplePublic.model_validate(sample) for sample in samples]
    return SamplesPublic(data=data, count=count)


@router.get("/samples/{sample_id}", response_model=SamplePublic)
def read_sample(
    session: SessionDep, current_user: CurrentUser, sample_id: UUID
) -> SamplePublic:
    sample = crud.get_sample_owned_by(session, current_user.id, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    return SamplePublic.model_validate(sample)


@router.patch("/samples/{sample_id}", response_model=SamplePublic)
def update_sample(
    session: SessionDep,
    current_user: CurrentUser,
    sample_id: UUID,
    sample_in: SampleUpdate,
) -> SamplePublic:
    sample = crud.get_sample_owned_by(session, current_user.id, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    sample_data = sample_in.model_dump(exclude_unset=True)
    before_name = sample.name
    experiment = session.get(Experiment, sample.experiment_id)
    sample.sqlmodel_update(sample_data)
    session.add(sample)
    session.commit()
    session.refresh(sample)
    evidence.ensure_sample_node(session, sample)
    provenance.record(
        session,
        project_id=experiment.project_id if experiment else sample.experiment_id,
        action="sample.updated",
        entity_type="sample",
        entity_id=str(sample.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"before": before_name, "after": sample.name},
    )
    return SamplePublic.model_validate(sample)


@router.delete("/samples/{sample_id}", status_code=204)
def delete_sample(
    session: SessionDep, current_user: CurrentUser, sample_id: UUID
) -> None:
    sample = crud.get_sample_owned_by(session, current_user.id, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    experiment = session.get(Experiment, sample.experiment_id)
    provenance.record(
        session,
        project_id=experiment.project_id if experiment else sample.experiment_id,
        action="sample.deleted",
        entity_type="sample",
        entity_id=str(sample.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"name": sample.name},
    )
    crud.delete_sample_tree(session, sample)
    evidence.remove_sample_node(session, sample.id)
    session.commit()
