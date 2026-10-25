"""Dataset metadata capture (Story 17).

Covers round-trip persistence, ownership enforcement, enum validation and the
link between declared assembly metadata and validation results.
"""

import uuid

import pytest

from app.core.config import settings
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def upload_env(tmp_path, monkeypatch):
    """Keep uploads inside the test tmp dir and stop the background extraction
    job from touching the real database engine."""
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )
    return tmp_path


def _owner_with_document(client, session):
    email = _email("owner")
    create_user(session, email)
    headers = login_headers(client, email)
    project = client.post(
        "/api/v1/projects/",
        json={"name": f"P-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    ).json()
    experiment = client.post(
        f"/api/v1/projects/{project['id']}/experiments",
        json={"name": "Experiment"},
        headers=headers,
    ).json()
    sample = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sample"},
        headers=headers,
    ).json()
    document = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": sample["id"]},
        headers=headers,
    ).json()
    return headers, document


def test_metadata_round_trips(upload_env, client, session):
    headers, document = _owner_with_document(client, session)

    response = client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={
            "genome_assembly": "GRCh38",
            "coordinate_system": "0-based",
            "source_tool": "example-tool",
            "source_tool_version": "1.2.3",
            "reference_database": "example-ref",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["genome_assembly"] == "GRCh38"
    assert body["coordinate_system"] == "0-based"
    assert body["source_tool"] == "example-tool"
    assert body["source_tool_version"] == "1.2.3"
    assert body["reference_database"] == "example-ref"
    assert body["document_id"] == document["id"]

    fetched = client.get(
        f"/api/v1/documents/{document['id']}/metadata", headers=headers
    )
    assert fetched.status_code == 200, fetched.text
    assert fetched.json()["genome_assembly"] == "GRCh38"
    assert fetched.json()["recorded_at"] is not None


def test_metadata_update_preserves_recorded_fields(upload_env, client, session):
    headers, document = _owner_with_document(client, session)

    created = client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={"genome_assembly": "GRCh38", "coordinate_system": "1-based"},
        headers=headers,
    ).json()

    updated = client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={"genome_assembly": "hg19"},
        headers=headers,
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["genome_assembly"] == "hg19"
    assert updated.json()["id"] == created["id"]


def test_metadata_invalid_coordinate_system_rejected(upload_env, client, session):
    headers, document = _owner_with_document(client, session)

    response = client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={"coordinate_system": "2-based"},
        headers=headers,
    )
    assert response.status_code == 422, response.text


def test_metadata_cross_user_access_denied(upload_env, client, session):
    _owner_headers, document = _owner_with_document(client, session)

    intruder_email = _email("intruder")
    create_user(session, intruder_email)
    intruder = login_headers(client, intruder_email)

    response = client.get(
        f"/api/v1/documents/{document['id']}/metadata", headers=intruder
    )
    assert response.status_code == 403

    response = client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={"genome_assembly": "GRCh38"},
        headers=intruder,
    )
    assert response.status_code == 403


def test_metadata_missing_returns_404(upload_env, client, session):
    headers, document = _owner_with_document(client, session)

    response = client.get(
        f"/api/v1/documents/{document['id']}/metadata", headers=headers
    )
    assert response.status_code == 404


def test_declared_assembly_makes_validation_report_assembly(upload_env, client, session):
    """Story 17 AC2: declaring the assembly removes the 'assembly not declared'
    skipped state, and the validation run records the declared value."""
    headers, document = _owner_with_document(client, session)

    client.put(
        f"/api/v1/documents/{document['id']}/metadata",
        json={"genome_assembly": "GRCh38", "coordinate_system": "0-based"},
        headers=headers,
    )

    response = client.post(
        f"/api/v1/documents/{document['id']}/validate", headers=headers
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    codes = {(issue["code"], issue["severity"]) for issue in issues}
    assert ("META-ASSEMBLY-001", "info") in codes
    assert ("META-ASSEMBLY-002", "skipped") not in codes


def test_undeclared_assembly_yields_skipped_with_reason(upload_env, client, session):
    """Story 15 AC2 + Story 17: undeclared assembly produces a `skipped` issue
    that carries its reason."""
    headers, document = _owner_with_document(client, session)

    response = client.post(
        f"/api/v1/documents/{document['id']}/validate", headers=headers
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    skipped = [
        issue for issue in issues if issue["severity"] == "skipped"
    ]
    assert skipped, "expected at least one skipped issue"
    assert any(issue["detail"] for issue in skipped)
