"""Story 28 — Evidence graph data model wiring.

Auto-materialises ``EvidenceNode``/``EvidenceEdge`` mirror rows when scientific
records are created, and keeps them truthful when records change or disappear.
Every edge in this module is derived from a real foreign key; nothing is
inferred and no user-facing claim is invented.

Hook points already wired:
- project created → node
- experiment created → node + ``belongs_to`` edge to its project node
- sample created → node + ``belongs_to`` edge to its experiment node
- document uploaded → document node + ``belongs_to`` edge to sample node
- document renamed → node label updated
- document/sample/experiment/project deleted → node + incident edges removed

Hook points still to come (their models do not exist yet):
- Story 25 analysis run created → run node, ``input_to`` edges to document
  inputs with sha256 ``evidence_ref``, ``produced_by`` edge back from the
  result artifact to the run.
- Story 30 finding created → finding node; ``supports`` edges stay manual.
- Story 36 report created → report node, ``reports_on`` edges to findings,
  ``derived_from`` edge from the report to its evidence snapshot.
"""

import uuid

from sqlmodel import Session, col, select

from app.models import (
    Document,
    EvidenceEdge,
    EvidenceEntityType,
    EvidenceNode,
    EvidenceRelation,
    Experiment,
    Project,
    Sample,
)

NODE_CAP = 500
AUTO_EDGES = {EvidenceRelation.belongs_to}
MANUAL_RELATIONS = {EvidenceRelation.supports, EvidenceRelation.contradicts}


def get_node(
    session: Session, entity_type: EvidenceEntityType, record_id: uuid.UUID
) -> EvidenceNode | None:
    return session.exec(
        select(EvidenceNode).where(
            EvidenceNode.entity_type == entity_type,
            EvidenceNode.entity_id == str(record_id),
        )
    ).first()


def _ensure_node(
    session: Session,
    project_id: uuid.UUID,
    entity_type: EvidenceEntityType,
    record_id: uuid.UUID,
    label: str,
) -> EvidenceNode:
    node = get_node(session, entity_type, record_id)
    if node:
        if node.label != label:
            node.label = label
            session.add(node)
            session.commit()
            session.refresh(node)
        return node
    node = EvidenceNode(
        entity_type=entity_type,
        entity_id=str(record_id),
        label=label,
        project_id=project_id,
    )
    session.add(node)
    session.commit()
    session.refresh(node)
    return node


def _ensure_edge(
    session: Session,
    source_id: uuid.UUID,
    target_id: uuid.UUID,
    relation: EvidenceRelation,
    *,
    evidence_ref: dict | None = None,
    created_by: uuid.UUID | None = None,
    note: str | None = None,
) -> EvidenceEdge | None:
    """Idempotent for structural edges; manual edges always create a row."""
    if relation in AUTO_EDGES:
        existing = session.exec(
            select(EvidenceEdge).where(
                EvidenceEdge.source_id == source_id,
                EvidenceEdge.target_id == target_id,
                EvidenceEdge.relation == relation,
            )
        ).first()
        if existing:
            return existing
    edge = EvidenceEdge(
        source_id=source_id,
        target_id=target_id,
        relation=relation,
        evidence_ref=evidence_ref,
        created_by=created_by,
        note=note,
    )
    session.add(edge)
    session.commit()
    session.refresh(edge)
    return edge


def _remove_node(
    session: Session, entity_type: EvidenceEntityType, record_id: uuid.UUID
) -> None:
    node = get_node(session, entity_type, record_id)
    if not node:
        return
    for edge in _incident_edges(session, node.id):
        session.delete(edge)
    session.delete(node)
    session.commit()


def _incident_edges(session: Session, node_id: uuid.UUID) -> list[EvidenceEdge]:
    as_source = session.exec(
        select(EvidenceEdge).where(EvidenceEdge.source_id == node_id)
    ).all()
    as_target = session.exec(
        select(EvidenceEdge).where(EvidenceEdge.target_id == node_id)
    ).all()
    return list(as_source) + list(as_target)


#  ----------  MATERIALISATION HOOKS  ----------


def ensure_project_node(session: Session, project: Project) -> EvidenceNode:
    return _ensure_node(
        session, project.id, EvidenceEntityType.project, project.id, project.name
    )


def ensure_experiment_node(session: Session, experiment: Experiment) -> EvidenceNode:
    node = _ensure_node(
        session,
        experiment.project_id,
        EvidenceEntityType.experiment,
        experiment.id,
        experiment.name,
    )
    project_node = get_node(session, EvidenceEntityType.project, experiment.project_id)
    if project_node:
        _ensure_edge(
            session, node.id, project_node.id, EvidenceRelation.belongs_to
        )
    return node


def ensure_sample_node(session: Session, sample: Sample) -> EvidenceNode:
    experiment = session.get(Experiment, sample.experiment_id)
    if not experiment:
        # Orphan sample: a node without tenancy cannot be represented safely
        # (the service never invents a project), so keep the graph honest.
        raise ValueError("sample has no resolvable experiment for evidence node")
    project_id = experiment.project_id
    node = _ensure_node(
        session, project_id, EvidenceEntityType.sample, sample.id, sample.name
    )
    experiment_node = get_node(
        session, EvidenceEntityType.experiment, sample.experiment_id
    )
    if experiment_node:
        _ensure_edge(
            session, node.id, experiment_node.id, EvidenceRelation.belongs_to
        )
    return node


def materialise_document(
    session: Session,
    document: Document,
    *,
    project_id: uuid.UUID | None = None,
) -> EvidenceNode | None:
    """Node for the document plus its containment chain (AC 1)."""
    sample = session.get(Sample, document.sample_id)
    if not sample:
        return None
    experiment = session.get(Experiment, sample.experiment_id)
    if not experiment:
        return None

    project = session.get(Project, experiment.project_id)
    if not project:
        return None
    project_node = _ensure_node(
        session, project.id, EvidenceEntityType.project, project.id, project.name
    )
    experiment_node = _ensure_node(
        session,
        experiment.project_id,
        EvidenceEntityType.experiment,
        experiment.id,
        experiment.name,
    )
    sample_node = _ensure_node(
        session, experiment.project_id, EvidenceEntityType.sample, sample.id, sample.name
    )
    _ensure_edge(session, sample_node.id, experiment_node.id, EvidenceRelation.belongs_to)
    _ensure_edge(session, experiment_node.id, project_node.id, EvidenceRelation.belongs_to)

    document_node = _ensure_node(
        session,
        project_id or experiment.project_id,
        EvidenceEntityType.document,
        document.id,
        document.filename or document.file_url,
    )
    _ensure_edge(session, document_node.id, sample_node.id, EvidenceRelation.belongs_to)
    return document_node


def rename_document_node(session: Session, document: Document) -> None:
    node = get_node(session, EvidenceEntityType.document, document.id)
    label = document.filename or document.file_url
    if node and node.label != label:
        node.label = label
        session.add(node)
        session.commit()


def remove_document_node(session: Session, document_id: uuid.UUID) -> None:
    _remove_node(session, EvidenceEntityType.document, document_id)


def remove_sample_node(session: Session, sample_id: uuid.UUID) -> None:
    _remove_node(session, EvidenceEntityType.sample, sample_id)


def remove_experiment_node(session: Session, experiment_id: uuid.UUID) -> None:
    _remove_node(session, EvidenceEntityType.experiment, experiment_id)


def purge_project_graph(session: Session, project_id: uuid.UUID) -> None:
    nodes = session.exec(
        select(EvidenceNode).where(col(EvidenceNode.project_id) == project_id)
    ).all()
    for node in nodes:
        for edge in _incident_edges(session, node.id):
            session.delete(edge)
        session.delete(node)
    session.commit()


#  ----------  GRAPH QUERY  ----------


def build_project_graph(
    session: Session, project_id: uuid.UUID, depth: int | None = None
) -> tuple[list[EvidenceNode], list[EvidenceEdge], bool]:
    """Bounded snapshot rooted at the project node.

    Nodes are ordered by ``created_at``; beyond ``NODE_CAP`` the remainder is
    dropped and ``truncated`` is reported so callers never silently see a
    partial graph. ``depth`` bounds the BFS below the project node (0 = project
    only, 1 = +experiments, 2 = +samples, 3 = +documents & sources).
    Edges are returned only when both endpoints are in the kept node set.
    """
    all_nodes = session.exec(
        select(EvidenceNode)
        .where(col(EvidenceNode.project_id) == project_id)
        .order_by(col(EvidenceNode.created_at))
    ).all()
    truncated = len(all_nodes) > NODE_CAP
    nodes = list(all_nodes)[:NODE_CAP]
    if not nodes:
        return [], [], truncated

    included = {node.id for node in nodes}
    edges = session.exec(
        select(EvidenceEdge).where(col(EvidenceEdge.source_id).in_(included))
    ).all()
    edges = [edge for edge in edges if edge.target_id in included]

    # ``belongs_to`` edges point child → parent (document→sample→experiment→
    # project), so walking outward from the project root means following the
    # edges backwards: from target_id to source_id.
    adjacency: dict[uuid.UUID, list[uuid.UUID]] = {}
    for edge in edges:
        adjacency.setdefault(edge.target_id, []).append(edge.source_id)

    root = next((n for n in nodes if n.entity_type == EvidenceEntityType.project), None)
    if root is None:
        return nodes, [], truncated

    visited = {root.id}
    frontier = [root.id]
    level = 0
    while frontier and (depth is None or level < depth):
        neighbours: list[uuid.UUID] = []
        for node_id in frontier:
            for child in adjacency.get(node_id, []):
                if child not in visited:
                    visited.add(child)
                    neighbours.append(child)
        if not neighbours:
            break
        frontier = neighbours
        level += 1

    kept_nodes = [node for node in nodes if node.id in visited]
    kept_ids = {node.id for node in kept_nodes}
    kept_edges = [
        edge
        for edge in edges
        if edge.source_id in kept_ids and edge.target_id in kept_ids
    ]
    return kept_nodes, kept_edges, truncated


#  ----------  MANUAL EDGES  ----------


def create_manual_edge(
    session: Session,
    source: EvidenceNode,
    target: EvidenceNode,
    relation: EvidenceRelation,
    note: str,
    evidence_ref: dict | None,
    created_by: uuid.UUID,
) -> EvidenceEdge:
    """User-created ``supports``/``contradicts`` edge, audited with creator."""
    if relation not in MANUAL_RELATIONS:
        raise ValueError("manual relations are limited to supports and contradicts")
    edge = EvidenceEdge(
        source_id=source.id,
        target_id=target.id,
        relation=relation,
        evidence_ref=evidence_ref,
        created_by=created_by,
        note=note,
    )
    session.add(edge)
    session.commit()
    session.refresh(edge)
    return edge


def get_edge(session: Session, edge_id: uuid.UUID) -> EvidenceEdge | None:
    return session.get(EvidenceEdge, edge_id)


def edge_project_id(session: Session, edge: EvidenceEdge) -> uuid.UUID | None:
    source = session.exec(
        select(EvidenceNode).where(EvidenceNode.id == edge.source_id)
    ).first()
    return source.project_id if source else None
