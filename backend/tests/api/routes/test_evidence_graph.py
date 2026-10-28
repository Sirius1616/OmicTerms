"""Story 28 — Evidence graph data model.

Covers the acceptance criteria: auto-materialisation of nodes and structural
``belongs_to`` edges on hierarchy creation and document upload, a bounded
graph query with depth and node cap reporting ``truncated``, manual
``supports``/``contradicts`` edges requiring an ``evidence_ref`` and auditing
``created_by``, and cross-project/foreign-user access rules.
"""

import pathlib
import uuid

import pytest
from sqlmodel import col, select

from app.models import (
    Document,
    EvidenceEdge,
    EvidenceEntityType,
    EvidenceNode,
    EvidenceRelation,
)
from app.services import evidence
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _user(client, session, prefix="evid-owner"):
    email = _email(prefix)
    create_user(session, email)
    return login_headers(client, email)


@pytest.fixture()
def upload_env(tmp_path, monkeypatch):
    from app.core.config import settings

    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )
    return tmp_path


def _make_hierarchy(client, headers):
    response = client.post(
        "/api/v1/projects/", json={"name": f"P-{uuid.uuid4().hex[:6]}"}, headers=headers
    )
    project_id = response.json()["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/experiments",
        json={"name": "Baseline"},
        headers=headers,
    )
    experiment_id = response.json()["id"]
    response = client.post(
        f"/api/v1/experiments/{experiment_id}/samples",
        json={"name": "Sample one"},
        headers=headers,
    )
    sample_id = response.json()["id"]
    return project_id, experiment_id, sample_id


def _upload_doc(client, headers, sample_id, name="counts.tsv", content=b"gene\tS1\nTP53\t1.0\n"):
    response = client.post(
        "/api/v1/documents/",
        files={"file": (name, content, "text/plain")},
        data={"sample_id": sample_id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _get_graph(client, headers, project_id, depth=None):
    params = {"depth": depth} if depth is not None else {}
    return client.get(
        f"/api/v1/projects/{project_id}/graph", params=params, headers=headers
    )


def _node_map(body):
    return {node["entity_type"]: node for node in body["nodes"]}


def _edge_tuples(body):
    return {
        (edge["source_id"], edge["target_id"], edge["relation"]) for edge in body["edges"]
    }


def test_hierarchy_and_document_materialise_nodes_and_edges(
    upload_env, client, session
):
    headers = _user(client, session)
    project_id, experiment_id, sample_id = _make_hierarchy(client, headers)
    document = _upload_doc(client, headers, sample_id)

    body = _get_graph(client, headers, project_id).json()
    nodes = _node_map(body)
    assert set(nodes) == {"project", "experiment", "sample", "document"}
    assert nodes["project"]["entity_id"] == project_id
    assert nodes["experiment"]["entity_id"] == experiment_id
    assert nodes["sample"]["entity_id"] == sample_id
    assert nodes["document"]["entity_id"] == document["id"]

    expect = {
        (nodes["document"]["id"], nodes["sample"]["id"], "belongs_to"),
        (nodes["sample"]["id"], nodes["experiment"]["id"], "belongs_to"),
        (nodes["experiment"]["id"], nodes["project"]["id"], "belongs_to"),
    }
    assert expect <= _edge_tuples(body)

    # Re-uploading a second document must not duplicate structural edges:
    # 2 document→sample + 1 sample→experiment + 1 experiment→project = 4.
    _upload_doc(client, headers, sample_id, name="second.tsv")
    body = _get_graph(client, headers, project_id).json()
    document_nodes = [n for n in body["nodes"] if n["entity_type"] == "document"]
    assert len(document_nodes) == 2
    belongs = [e for e in body["edges"] if e["relation"] == "belongs_to"]
    assert len(belongs) == 4


def test_materialisation_is_idempotent(upload_env, client, session):
    headers = _user(client, session)
    _, _, sample_id = _make_hierarchy(client, headers)
    document_json = _upload_doc(client, headers, sample_id)

    nodes_before = len(list(session.exec(select(EvidenceNode)).all()))
    document = session.get(Document, uuid.UUID(document_json["id"]))
    evidence.materialise_document(session, document)
    nodes_after = len(list(session.exec(select(EvidenceNode)).all()))
    assert nodes_after == nodes_before
def test_graph_respects_depth_and_node_cap(client, session):
    headers = _user(client, session)
    project_id, _, _ = _make_hierarchy(client, headers)

    body = _get_graph(client, headers, project_id, depth=0).json()
    assert _node_map(body).keys() == {"project"}

    body = _get_graph(client, headers, project_id, depth=1).json()
    assert set(_node_map(body)) == {"project", "experiment"}

    body = _get_graph(client, headers, project_id, depth=2).json()
    assert set(_node_map(body)) == {"project", "experiment", "sample"}

    # Cap: insert cap+extra nodes directly, verify truncated + bounded payload.
    # Cap: 520 reachable artifact nodes (children of the project node via
    # belongs_to edges) exceed the 500-node cap, so the snapshot must be
    # truncated and bounded.
    extra = 520
    for index in range(extra):
        node = EvidenceNode(
            entity_type="artifact",
            entity_id=uuid.uuid4().hex,
            label=f"artifact {index}",
            project_id=uuid.UUID(project_id),
        )
        session.add(node)
    session.commit()
    nodes = session.exec(
        select(EvidenceNode).where(
            col(EvidenceNode.project_id) == uuid.UUID(project_id)
        )
    ).all()
    project_row = None
    for node in nodes:
        if node.entity_type == EvidenceEntityType.project:
            project_row = node
    for node in nodes:
        if node.entity_type == EvidenceEntityType.artifact:
            session.add(
                EvidenceEdge(
                    source_id=node.id,
                    target_id=project_row.id,
                    relation="belongs_to",
                )
            )
    session.commit()
    body = _get_graph(client, headers, project_id).json()
    assert len(body["nodes"]) == evidence.NODE_CAP
    assert body["truncated"] is True


def test_manual_edges_validation_and_created_by_audit(client, session):
    headers = _user(client, session)
    project_id, _, _ = _make_hierarchy(client, headers)
    graph = _get_graph(client, headers, project_id).json()
    nodes = _node_map(graph)
    sample_node, experiment_node, project_node = (
        nodes["sample"],
        nodes["experiment"],
        nodes["project"],
    )

    # manual creation is limited to supports/contradicts
    response = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": sample_node["id"],
            "target_id": experiment_node["id"],
            "relation": "derived_from",
            "note": "not allowed",
        },
        headers=headers,
    )
    assert response.status_code == 422

    # supports without evidence_ref is rejected
    response = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": sample_node["id"],
            "target_id": project_node["id"],
            "relation": "supports",
            "note": "claim reference missing",
        },
        headers=headers,
    )
    assert response.status_code == 422

    # valid supports edge with evidence_ref
    response = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": sample_node["id"],
            "target_id": project_node["id"],
            "relation": "supports",
            "note": "peaks near promoter",
            "evidence_ref": {"sha256": "a" * 64, "row": 3},
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    edge = response.json()
    assert edge["relation"] == "supports"
    assert edge["evidence_ref"] == {"sha256": "a" * 64, "row": 3}
    assert edge["note"] == "peaks near promoter"
    assert edge["created_by"] is not None
    graph = _get_graph(client, headers, project_id).json()
    assert any(e["id"] == edge["id"] for e in graph["edges"])

    # self-loop rejected
    response = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": sample_node["id"],
            "target_id": sample_node["id"],
            "relation": "contradicts",
            "note": "self loop",
        },
        headers=headers,
    )
    assert response.status_code == 422

    # foreign node rejected
    other = _user(client, session, prefix="evid-other")
    other_project_id, _, _ = _make_hierarchy(client, other)
    other_graph = _get_graph(client, other, other_project_id).json()
    other_node = _node_map(other_graph)["sample"]
    response = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": sample_node["id"],
            "target_id": other_node["id"],
            "relation": "contradicts",
            "note": "cross project",
        },
        headers=headers,
    )
    assert response.status_code == 404


def test_edge_delete_rules(client, session):
    headers = _user(client, session)
    project_id, _, _ = _make_hierarchy(client, headers)
    graph = _get_graph(client, headers, project_id).json()
    nodes = _node_map(graph)

    response = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": nodes["sample"]["id"],
            "target_id": nodes["experiment"]["id"],
            "relation": "contradicts",
            "note": "conflicting measurements",
        },
        headers=headers,
    )
    assert response.status_code == 201, response.text
    edge = response.json()

    # foreign user cannot delete
    other = _user(client, session, prefix="evid-other")
    response = client.delete(f"/api/v1/graph/edges/{edge['id']}", headers=other)
    assert response.status_code == 404

    # non-creator member of another project cannot delete
    third = _user(client, session, prefix="evid-third")
    _make_hierarchy(client, third)
    response = client.delete(f"/api/v1/graph/edges/{edge['id']}", headers=third)
    assert response.status_code == 404

    # creator deletes
    response = client.delete(f"/api/v1/graph/edges/{edge['id']}", headers=headers)
    assert response.status_code == 204, response.text
    graph = _get_graph(client, headers, project_id).json()
    assert all(e["id"] != edge["id"] for e in graph["edges"])


def test_document_delete_removes_node_and_edges(upload_env, client, session):
    headers = _user(client, session)
    project_id, _, sample_id = _make_hierarchy(client, headers)
    document = _upload_doc(client, headers, sample_id)
    response = client.delete(f"/api/v1/documents/{document['id']}", headers=headers)
    assert response.status_code == 204, response.text
    graph = _get_graph(client, headers, project_id).json()
    assert set(_node_map(graph)) == {"project", "experiment", "sample"}


def test_graph_access_is_owner_scoped(client, session):
    headers = _user(client, session)
    project_id, _, _ = _make_hierarchy(client, headers)
    other = _user(client, session, prefix="evid-outside")
    response = _get_graph(client, other, project_id)
    assert response.status_code == 404


def test_run_and_finding_hooks_documented():
    source = pathlib.Path("app/services/evidence.py").read_text()
    for token in ("Story 25", "Story 30", "Story 36", "input_to", "produced_by"):
        assert token in source


def test_relation_registry_covers_documented_relations():
    for relation in (
        "derived_from",
        "produced_by",
        "supports",
        "contradicts",
        "reports_on",
        "same_sample_as",
        "input_to",
        "belongs_to",
    ):
        assert hasattr(EvidenceRelation, relation)

