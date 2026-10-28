"""Story 28 — Evidence graph endpoints.

- ``GET  /projects/{project_id}/graph``: bounded snapshot (node cap + depth),
  ``truncated`` flag set by the service; ownership enforced via the project.
- ``POST /projects/{project_id}/graph/edges``: manual linking only between
  two existing nodes of the same project; limited to ``supports`` /
  ``contradicts``; ``supports`` requires an ``evidence_ref``; edges audited
  with ``created_by``.
- ``DELETE /graph/edges/{edge_id}``: creator or admin only; cross-project
  access returns 404 to avoid leaking existence.
"""

from uuid import UUID

from fastapi import APIRouter, HTTPException, Query

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.models import (
    EvidenceEdgeCreate,
    EvidenceGraphEdgePublic,
    EvidenceGraphPublic,
    EvidenceNode,
    EvidenceNodePublic,
    EvidenceRelation,
    Project,
    ProvenanceActorType,
)
from app.services import evidence, provenance

router = APIRouter(prefix="/projects", tags=["evidence"])
edge_router = APIRouter(prefix="/graph", tags=["evidence"])


def _owned_project(
    session: SessionDep, current_user: CurrentUser, project_id: UUID
) -> Project:
    project = crud.get_project_owned_by(session, current_user.id, project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.get("/{project_id}/graph", response_model=EvidenceGraphPublic)
def read_project_graph(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    depth: int | None = Query(default=None, ge=0, le=10),
) -> EvidenceGraphPublic:
    project = _owned_project(session, current_user, project_id)
    nodes, edges, truncated = evidence.build_project_graph(session, project.id, depth)
    return EvidenceGraphPublic(
        nodes=[EvidenceNodePublic.model_validate(node) for node in nodes],
        edges=[EvidenceGraphEdgePublic.model_validate(edge) for edge in edges],
        truncated=truncated,
    )


@router.post(
    "/{project_id}/graph/edges",
    response_model=EvidenceGraphEdgePublic,
    status_code=201,
)
def create_graph_edge(
    session: SessionDep,
    current_user: CurrentUser,
    project_id: UUID,
    edge_in: EvidenceEdgeCreate,
) -> EvidenceGraphEdgePublic:
    project = _owned_project(session, current_user, project_id)

    if edge_in.relation not in evidence.MANUAL_RELATIONS:
        raise HTTPException(
            status_code=422,
            detail="Manual edges are limited to supports and contradicts",
        )
    if edge_in.relation == EvidenceRelation.supports and edge_in.evidence_ref is None:
        raise HTTPException(
            status_code=422,
            detail="Supports edges require an evidence_ref",
        )

    def _node_for(node_id: UUID) -> EvidenceNode:
        node = session.get(EvidenceNode, node_id)
        if not node or node.project_id != project.id:
            raise HTTPException(status_code=404, detail="Graph node not found")
        return node

    source = _node_for(edge_in.source_id)
    target = _node_for(edge_in.target_id)
    if source.id == target.id:
        raise HTTPException(
            status_code=422, detail="An edge cannot connect a node to itself"
        )

    edge = evidence.create_manual_edge(
        session,
        source,
        target,
        edge_in.relation,
        edge_in.note,
        edge_in.evidence_ref,
        current_user.id,
    )
    provenance.record(
        session,
        project_id=project.id,
        action="evidence.edge_created",
        entity_type="graph_edge",
        entity_id=str(edge.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={
            "relation": edge.relation.value,
            "source": str(edge.source_id),
            "target": str(edge.target_id),
            "note": edge.note,
        },
    )
    return EvidenceGraphEdgePublic.model_validate(edge)


@edge_router.delete("/edges/{edge_id}", status_code=204)
def delete_graph_edge(
    session: SessionDep, current_user: CurrentUser, edge_id: UUID
) -> None:
    edge = evidence.get_edge(session, edge_id)
    if not edge:
        raise HTTPException(status_code=404, detail="Graph edge not found")
    project_id = evidence.edge_project_id(session, edge)
    if project_id is None:
        raise HTTPException(status_code=404, detail="Graph edge not found")
    owned = crud.get_project_owned_by(session, current_user.id, project_id)
    if not owned and not current_user.is_admin:
        # Don't leak edges outside the caller's project scope.
        raise HTTPException(status_code=404, detail="Project not found")
    if edge.created_by != current_user.id and not current_user.is_admin:
        raise HTTPException(
            status_code=403,
            detail="Only the edge creator or an admin can delete a graph edge",
        )
    provenance.record(
        session,
        project_id=project_id,
        action="evidence.edge_deleted",
        entity_type="graph_edge",
        entity_id=str(edge.id),
        actor_type=ProvenanceActorType.user,
        actor_id=current_user.id,
        payload={
            "relation": edge.relation.value,
            "source": str(edge.source_id),
            "target": str(edge.target_id),
        },
    )
    session.delete(edge)
    session.commit()
