from collections.abc import Sequence
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    Experiment,
    ExperimentTreeNode,
    Project,
    ProjectCreate,
    ProjectPublic,
    ProjectTreeNode,
    ProjectTreePublic,
    ProjectUpdate,
    ProvenanceActorType,
    ProvenanceEvent,
    ProvenanceEventPublic,
    ProvenanceEventsPublic,
    Sample,
    SampleTreeNode,
)
from app.services import evidence, provenance

router = APIRouter(prefix="/projects", tags=["projects"])


def _build_tree(
    project: Project,
    experiments: Sequence[Experiment],
    samples: Sequence[Sample],
) -> ProjectTreeNode:
    samples_by_experiment: dict[UUID, list[SampleTreeNode]] = {}
    for sample in samples:
        samples_by_experiment.setdefault(sample.experiment_id, []).append(
            SampleTreeNode(id=sample.id, name=sample.name, created_at=sample.created_at)
        )
    experiment_nodes = [
        ExperimentTreeNode(
            id=experiment.id,
            project_id=experiment.project_id,
            name=experiment.name,
            created_at=experiment.created_at,
            samples=samples_by_experiment.get(experiment.id, []),
        )
        for experiment in experiments
    ]
    return ProjectTreeNode(
        id=project.id,
        name=project.name,
        description=project.description,
        created_at=project.created_at,
        experiments=experiment_nodes,
    )


@router.get("/", response_model=ProjectTreePublic)
def read_projects_tree(
    session: SessionDep, current_user: CurrentUser
) -> ProjectTreePublic:
    projects = session.exec(
        select(Project)
        .where(Project.user_id == current_user.id)
        .order_by(col(Project.created_at))
    ).all()
    count = len(projects)
    experiments = session.exec(
        select(Experiment)
        .join(Project, col(Project.id) == Experiment.project_id)
        .where(Project.user_id == current_user.id)
    ).all()
    samples = session.exec(
        select(Sample)
        .join(Experiment, col(Experiment.id) == Sample.experiment_id)
        .join(Project, col(Project.id) == Experiment.project_id)
        .where(Project.user_id == current_user.id)
    ).all()
    tree = []
    for project in projects:
        # Scope each node to its own experiments/samples — the flat lists are
        # user-wide queries, so filter them per project.
        project_experiments = [
            experiment for experiment in experiments if experiment.project_id == project.id
        ]
        experiment_ids = {experiment.id for experiment in project_experiments}
        project_samples = [
            sample for sample in samples if sample.experiment_id in experiment_ids
        ]
        tree.append(_build_tree(project, project_experiments, project_samples))
    return ProjectTreePublic(data=tree, count=count)


@router.post("/", response_model=ProjectPublic, status_code=201)
def create_project(
    session: SessionDep, current_user: CurrentUser, project_in: ProjectCreate
) -> ProjectPublic:
    project = Project(
        user_id=current_user.id,
        name=project_in.name,
        description=project_in.description,
    )
    session.add(project)
    session.commit()
    session.refresh(project)
    evidence.ensure_project_node(session, project)
    provenance.record(
        session,
        project_id=project.id,
        action="project.created",
        entity_type="project",
        entity_id=str(project.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"name": project.name},
    )
    return ProjectPublic.model_validate(project)


@router.get("/{project_id}", response_model=ProjectTreeNode)
def read_project_tree(
    session: SessionDep, current_user: CurrentUser, project_id: UUID
) -> ProjectTreeNode:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    experiments = session.exec(
        select(Experiment)
        .where(Experiment.project_id == project.id)
        .order_by(col(Experiment.created_at))
    ).all()
    samples = session.exec(
        select(Sample)
        .join(Experiment, col(Experiment.id) == Sample.experiment_id)
        .where(Experiment.project_id == project.id)
    ).all()
    return _build_tree(project, experiments, samples)


@router.patch("/{project_id}", response_model=ProjectPublic)
def update_project(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    project_in: ProjectUpdate,
) -> ProjectPublic:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    project_data = project_in.model_dump(exclude_unset=True)
    project.sqlmodel_update(project_data)
    session.add(project)
    session.commit()
    session.refresh(project)
    evidence.ensure_project_node(session, project)
    provenance.record(
        session,
        project_id=project.id,
        action="project.updated",
        entity_type="project",
        entity_id=str(project.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"fields": sorted(project_data)},
    )
    return ProjectPublic.model_validate(project)


@router.delete("/{project_id}", status_code=204)
def delete_project(
    session: SessionDep, current_user: CurrentUser, project_id: UUID
) -> None:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    provenance.record(
        session,
        project_id=project.id,
        action="project.deleted",
        entity_type="project",
        entity_id=str(project.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={"name": project.name},
    )
    crud.delete_project_tree(session, project)
    evidence.purge_project_graph(session, project.id)
    session.commit()


@router.get("/{project_id}/events", response_model=ProvenanceEventsPublic)
def read_project_events(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    action: str | None = Query(default=None, max_length=64),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=200),
) -> ProvenanceEventsPublic:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    query = select(ProvenanceEvent).where(
        col(ProvenanceEvent.project_id) == project.id
    )
    if action is not None:
        query = query.where(col(ProvenanceEvent.action) == action)
    count = session.exec(
        select(func.count()).select_from(query.subquery())
    ).one()
    events = session.exec(
        query.order_by(col(ProvenanceEvent.occurred_at).desc())
        .offset(skip)
        .limit(limit)
    ).all()
    return ProvenanceEventsPublic(
        data=[ProvenanceEventPublic.model_validate(event) for event in events],
        count=count,
    )
