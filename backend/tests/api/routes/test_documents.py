"""Document upload, listing, serving, and cross-user denial.

Extraction runs in a background task that owns its own session; here it is
replaced with a no-op so these tests exercise the upload/serving contract
without touching the real database engine. Extraction itself is covered by the
`test_extraction_jobs` / `test_extraction` suites.
"""

import uuid
from pathlib import Path

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


def _owner(client, session):
    email = _email("owner")
    create_user(session, email)
    return login_headers(client, email)


def _make_sample(client, headers) -> str:
    response = client.post(
        "/api/v1/projects/",
        json={"name": f"P-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    )
    project_id = response.json()["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/experiments",
        json={"name": "Experiment"},
        headers=headers,
    )
    experiment_id = response.json()["id"]
    response = client.post(
        f"/api/v1/experiments/{experiment_id}/samples",
        json={"name": "Sample"},
        headers=headers,
    )
    return response.json()["id"]


def test_upload_list_serve_and_cross_user_denial(upload_env, client, session):
    owner = _owner(client, session)
    sample_id = _make_sample(client, owner)
    content = b"gene\tS1\tS2\nTP53\t1.0\t2.0\n"

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", content, "text/tab-separated-values")},
        data={"sample_id": sample_id, "data_type": "expression"},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    document = response.json()
    assert document["data_type"] == "expression"
    assert document["extraction_status"] == "pending"
    document_id = document["id"]
    file_id = Path(document["file_url"]).name

    response = client.get("/api/v1/documents/", headers=owner)
    assert response.status_code == 200
    assert response.json()["count"] == 1

    assert (
        client.get(f"/api/v1/documents/{document_id}", headers=owner).status_code == 200
    )

    response = client.get(f"/api/v1/uploads/{file_id}", headers=owner)
    assert response.status_code == 200
    assert response.content == content

    intruder_email = _email("intruder")
    create_user(session, intruder_email)
    intruder = login_headers(client, intruder_email)
    assert (
        client.get(f"/api/v1/documents/{document_id}", headers=intruder).status_code
        == 403
    )
    assert (
        client.get(f"/api/v1/uploads/{file_id}", headers=intruder).status_code == 403
    )
    assert (
        client.delete(f"/api/v1/documents/{document_id}", headers=intruder).status_code
        == 403
    )

    assert (
        client.delete(f"/api/v1/documents/{document_id}", headers=owner).status_code
        == 204
    )
    assert not (upload_env / file_id).exists()


def test_document_jobs_endpoint_is_scoped_to_owner(upload_env, client, session):
    """Story 13 AC1 + security: job history exists and is tenant-scoped."""
    owner = _owner(client, session)
    sample_id = _make_sample(client, owner)

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    document_id = response.json()["id"]

    response = client.get(f"/api/v1/documents/{document_id}/jobs", headers=owner)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] >= 1
    job = body["data"][0]
    assert job["document_id"] == document_id
    assert job["status"] == "pending"
    assert job["last_error"] is None

    missing = f"/api/v1/documents/{uuid.uuid4()}/jobs"
    assert client.get(missing, headers=owner).status_code == 404

    intruder_email = _email("intruder")
    create_user(session, intruder_email)
    intruder = login_headers(client, intruder_email)
    assert (
        client.get(f"/api/v1/documents/{document_id}/jobs", headers=intruder).status_code
        == 403
    )


def test_upload_rejects_invalid_magic_bytes(upload_env, client, session):
    owner = _owner(client, session)
    sample_id = _make_sample(client, owner)

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("payload.bin", b"\x00\x01\x02\x03", "application/octet-stream")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    assert response.status_code == 415


def test_upload_rejects_oversize(upload_env, client, session, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_MAX_SIZE", 10)
    owner = _owner(client, session)
    sample_id = _make_sample(client, owner)

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("big.txt", b"x" * 64, "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    assert response.status_code == 413


def test_upload_rejects_sample_not_owned(upload_env, client, session):
    owner = _owner(client, session)
    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": str(uuid.uuid4())},
        headers=owner,
    )
    assert response.status_code == 403


def test_upload_stores_sha256_and_size_bytes(upload_env, client, session):
    owner = _owner(client, session)
    sample_id = _make_sample(client, owner)
    content = b"gene\tS1\nTP53\t1.0\n"

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", content, "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    document = response.json()
    assert document.get("size_bytes") == len(content)
    assert isinstance(document.get("sha256"), str)
    assert len(document["sha256"]) == 64


def test_dedup_hint_by_sha256_lists_existing_document(upload_env, client, session):
    owner = _owner(client, session)
    sample_id = _make_sample(client, owner)
    content = b"gene\tS1\nBRCA1\t2.0\n"

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", content, "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    sha = response.json()["sha256"]

    response2 = client.get(f"/api/v1/documents/?sha256={sha}", headers=owner)
    assert response2.status_code == 200
    body = response2.json()
    assert body["count"] >= 1
    assert body["data"][0]["sha256"] == sha
