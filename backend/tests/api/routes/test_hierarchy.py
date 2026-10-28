"""Project / Experiment / Sample CRUD and cross-user ownership denial."""

import uuid

import pytest

from app.core.config import settings
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def upload_env(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )
    return tmp_path


def test_hierarchy_crud_and_ownership_denial(client, session):
    owner_email = _email("owner")
    intruder_email = _email("intruder")
    create_user(session, owner_email)
    create_user(session, intruder_email)
    owner = login_headers(client, owner_email)
    intruder = login_headers(client, intruder_email)

    response = client.post(
        "/api/v1/projects/", json={"name": "Project A"}, headers=owner
    )
    assert response.status_code == 201, response.text
    project_id = response.json()["id"]

    response = client.post(
        f"/api/v1/projects/{project_id}/experiments",
        json={"name": "Experiment A"},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    experiment_id = response.json()["id"]

    response = client.post(
        f"/api/v1/experiments/{experiment_id}/samples",
        json={"name": "Sample A"},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    sample_id = response.json()["id"]

    response = client.get("/api/v1/projects/", headers=owner)
    assert response.status_code == 200
    tree = response.json()
    assert tree["count"] == 1
    assert tree["data"][0]["experiments"][0]["samples"][0]["name"] == "Sample A"

    assert (
        client.patch(
            f"/api/v1/projects/{project_id}", json={"name": "Project B"}, headers=owner
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/v1/experiments/{experiment_id}",
            json={"name": "Experiment B"},
            headers=owner,
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/v1/samples/{sample_id}", json={"name": "Sample B"}, headers=owner
        ).status_code
        == 200
    )

    # Cross-user access is denied across every level.
    assert (
        client.get(f"/api/v1/projects/{project_id}", headers=intruder).status_code
        == 404
    )
    assert (
        client.patch(
            f"/api/v1/projects/{project_id}",
            json={"name": "Intruder Project"},
            headers=intruder,
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/projects/{project_id}/experiments",
            json={"name": "Intruder Experiment"},
            headers=intruder,
        ).status_code
        == 404
    )
    assert (
        client.get(f"/api/v1/experiments/{experiment_id}", headers=intruder).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/experiments/{experiment_id}/samples",
            json={"name": "Intruder Sample"},
            headers=intruder,
        ).status_code
        == 404
    )
    assert (
        client.get(f"/api/v1/samples/{sample_id}", headers=intruder).status_code == 404
    )
    assert client.get("/api/v1/projects/", headers=intruder).json()["count"] == 0

    # Deleting a project cascades through experiments and samples.
    assert (
        client.delete(f"/api/v1/projects/{project_id}", headers=owner).status_code == 204
    )
    assert (
        client.get(f"/api/v1/experiments/{experiment_id}", headers=owner).status_code
        == 404
    )
    assert client.get(f"/api/v1/samples/{sample_id}", headers=owner).status_code == 404


def test_projects_tree_scopes_experiments_to_their_own_project(client, session):
    """Regression: every project node must list only its own experiments."""
    owner_email = _email("tree-owner")
    create_user(session, owner_email)
    owner = login_headers(client, owner_email)

    project_1 = client.post(
        "/api/v1/projects/", json={"name": "Project One"}, headers=owner
    ).json()
    project_2 = client.post(
        "/api/v1/projects/", json={"name": "Project Two"}, headers=owner
    ).json()
    experiment_1 = client.post(
        f"/api/v1/projects/{project_1['id']}/experiments",
        json={"name": "Experiment One"},
        headers=owner,
    ).json()
    experiment_2 = client.post(
        f"/api/v1/projects/{project_2['id']}/experiments",
        json={"name": "Experiment Two"},
        headers=owner,
    ).json()

    tree = client.get("/api/v1/projects/", headers=owner).json()["data"]
    by_name = {node["name"]: node for node in tree}
    assert [e["name"] for e in by_name["Project One"]["experiments"]] == [
        "Experiment One"
    ]
    assert [e["name"] for e in by_name["Project Two"]["experiments"]] == [
        "Experiment Two"
    ]

    # Single-project tree is scoped the same way.
    single = client.get(f"/api/v1/projects/{project_1['id']}", headers=owner).json()
    assert [e["id"] for e in single["experiments"]] == [experiment_1["id"]]
    assert experiment_2["id"] not in [e["id"] for e in single["experiments"]]


def test_delete_document_cascades_validation_and_metadata(
    upload_env, client, session
):
    """Regression: deleting a document also removes its validation runs,
    issues, dataset metadata, and extraction jobs (FK-safe on Postgres)."""
    from sqlmodel import col, select

    from app.models import (
        DatasetMetadata,
        Document,
        ValidationIssue,
        ValidationRun,
    )

    owner_email = _email("cascade")
    create_user(session, owner_email)
    owner = login_headers(client, owner_email)
    project = client.post(
        "/api/v1/projects/", json={"name": "Cascade Project"}, headers=owner
    ).json()
    experiment = client.post(
        f"/api/v1/projects/{project['id']}/experiments",
        json={"name": "Cascade Experiment"},
        headers=owner,
    ).json()
    sample = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Cascade Sample"},
        headers=owner,
    ).json()

    document = client.post(
        "/api/v1/documents/",
        files={"file": ("c.vcf", b"bad vcf", "text/plain")},
        data={"sample_id": sample["id"]},
        headers=owner,
    ).json()
    client.post(f"/api/v1/documents/{document['id']}/validate", headers=owner)
    client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={"genome_assembly": "GRCh38"},
        headers=owner,
    )
    doc_id = uuid.UUID(document["id"])

    assert client.delete(f"/api/v1/documents/{doc_id}", headers=owner).status_code == 204

    assert session.get(Document, doc_id) is None
    assert (
        session.exec(
            select(ValidationRun).where(col(ValidationRun.document_id) == doc_id)
        ).all()
        == []
    )
    assert (
        session.exec(
            select(DatasetMetadata).where(col(DatasetMetadata.document_id) == doc_id)
        ).all()
        == []
    )
    issues = session.exec(
        select(ValidationIssue)
        .join(ValidationRun, col(ValidationRun.id) == col(ValidationIssue.run_id))
        .where(col(ValidationRun.document_id) == doc_id)
    ).all()
    assert issues == []
