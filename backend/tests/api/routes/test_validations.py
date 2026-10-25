"""Validation run endpoints and lifecycle (Story 15)."""

import uuid

import pytest

from app.core.config import settings
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def upload_env(tmp_path, monkeypatch, session):
    from sqlmodel import Session

    from app.services import extraction_job

    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    bind = session.get_bind()

    def run_now(job_id):
        with Session(bind) as db:
            extraction_job.process_job(db, job_id)

    monkeypatch.setattr("app.api.routes.documents.run_extraction_job", run_now)
    return tmp_path


def _owner_with_document(client, session, content=None):
    email = _email("val-owner")
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
    body = content or b"gene\tS1\nTP53\t1.0\n"
    document = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", body, "text/plain")},
        data={"sample_id": sample["id"]},
        headers=headers,
    ).json()
    return headers, document


def test_upload_creates_validation_run(upload_env, client, session):
    headers, document = _owner_with_document(client, session)

    response = client.get(
        f"/api/v1/documents/{document['id']}/validations", headers=headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 1
    run = body["data"][0]
    assert run["trigger"] == "upload"
    assert run["document_id"] == document["id"]
    assert run["status"] == "succeeded"
    assert body["latest_summary"]["run_id"] == run["id"]
    assert body["latest_summary"]["total"] == len(run["issues"])


def test_manual_rerun_appends_history_without_mutating_prior_run(upload_env, client, session):
    headers, document = _owner_with_document(client, session)

    before = client.get(
        f"/api/v1/documents/{document['id']}/validations", headers=headers
    ).json()
    prior_run = before["data"][0]

    rerun = client.post(
        f"/api/v1/documents/{document['id']}/validate", headers=headers
    )
    assert rerun.status_code == 200, rerun.text
    new_run = rerun.json()
    assert new_run["trigger"] == "manual"
    assert new_run["id"] != prior_run["id"]

    after = client.get(
        f"/api/v1/documents/{document['id']}/validations", headers=headers
    ).json()
    assert after["count"] == 2
    assert [run["id"] for run in after["data"]][:2] == [new_run["id"], prior_run["id"]]

    unchanged = client.get(f"/api/v1/validations/{prior_run['id']}", headers=headers)
    assert unchanged.status_code == 200, unchanged.text
    assert unchanged.json()["issues"] == prior_run["issues"]


def test_get_run_by_top_level_path(upload_env, client, session):
    headers, document = _owner_with_document(client, session)
    runs = client.get(
        f"/api/v1/documents/{document['id']}/validations", headers=headers
    ).json()
    run_id = runs["data"][0]["id"]

    response = client.get(f"/api/v1/validations/{run_id}", headers=headers)
    assert response.status_code == 200, response.text
    assert response.json()["id"] == run_id


def test_cross_user_cannot_validate_or_read_runs(upload_env, client, session):
    headers, document = _owner_with_document(client, session)
    runs = client.get(
        f"/api/v1/documents/{document['id']}/validations", headers=headers
    ).json()
    run_id = runs["data"][0]["id"]

    intruder_email = _email("val-intruder")
    create_user(session, intruder_email)
    intruder = login_headers(client, intruder_email)

    assert (
        client.post(
            f"/api/v1/documents/{document['id']}/validate", headers=intruder
        ).status_code
        == 403
    )
    assert (
        client.get(
            f"/api/v1/documents/{document['id']}/validations", headers=intruder
        ).status_code
        == 403
    )
    assert (
        client.get(f"/api/v1/validations/{run_id}", headers=intruder).status_code
        == 403
    )


def test_unknown_run_returns_404(upload_env, client, session):
    headers, _ = _owner_with_document(client, session)
    response = client.get(f"/api/v1/validations/{uuid.uuid4()}", headers=headers)
    assert response.status_code == 404


def test_skipped_issue_has_reason(upload_env, client, session):
    headers, document = _owner_with_document(client, session)
    runs = client.get(
        f"/api/v1/documents/{document['id']}/validations", headers=headers
    ).json()
    issues = runs["data"][0]["issues"]
    skipped = [issue for issue in issues if issue["severity"] == "skipped"]
    assert skipped
    assert all(issue["detail"] for issue in skipped)
