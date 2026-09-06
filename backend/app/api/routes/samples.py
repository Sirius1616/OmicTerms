from uuid import UUID

from fastapi import APIRouter, HTTPException
from sqlmodel import func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Sample,
    SampleCreate,
    SamplePublic,
    SamplesPublic,
    SampleUpdate,
)

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
    return sample


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
        .order_by(Sample.created_at)
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
    return sample


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
    sample.sqlmodel_update(sample_data)
    session.add(sample)
    session.commit()
    session.refresh(sample)
    return sample


@router.delete("/samples/{sample_id}", status_code=204)
def delete_sample(
    session: SessionDep, current_user: CurrentUser, sample_id: UUID
) -> None:
    sample = crud.get_sample_owned_by(session, current_user.id, sample_id)
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    crud.delete_sample_tree(session, sample)
    session.commit()
