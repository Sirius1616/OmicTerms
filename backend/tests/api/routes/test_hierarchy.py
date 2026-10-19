"""Project / Experiment / Sample CRUD and cross-user ownership denial."""

import uuid

import pytest

from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


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
