"""Public repository import foundation (Story 64).

Covers import/job models and services, owner-scoped API endpoints, job state
transitions, and cross-tenant isolation. No network access is used; this story
delivers the foundation without repository fetching.
"""

import uuid

import pytest
from sqlmodel import select

from app.core.config import settings
from app.models import (
    ExternalRepoType,
    ImportJob,
    ImportJobStatus,
    RepositoryImportStatus,
)
from app.services import import_jobs as svc
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


def _user(client, session):
    email = _email("importer")
    create_user(session, email)
    headers = login_headers(client, email)
    return headers, email


def _make_import(client, headers):
    response = client.post(
        "/api/v1/imports/",
        params={"repo": "geo", "accession": "GSE00000"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()


def test_create_import_creates_pending_job(upload_env, client, session):
    headers, _ = _user(client, session)
    imp = _make_import(client, headers)
    assert imp["repo"] == "geo"
    assert imp["accession"] == "GSE00000"
    assert imp["status"] == "pending"

    jobs = client.get(f"/api/v1/imports/{imp['id']}/jobs", headers=headers).json()
    assert jobs["count"] == 1
    assert jobs["data"][0]["status"] == "pending"


def test_create_import_rejects_unknown_repo(upload_env, client, session):
    headers, _ = _user(client, session)
    response = client.post(
        "/api/v1/imports/",
        params={"repo": "zenodo", "accession": "X"},
        headers=headers,
    )
    assert response.status_code == 422


def test_list_imports_is_owner_scoped(upload_env, client, session):
    headers, _ = _user(client, session)
    _make_import(client, headers)
    listing = client.get("/api/v1/imports/", headers=headers).json()
    assert listing["count"] == 1


def test_cross_tenant_access_denied(upload_env, client, session):
    owner_headers, _ = _user(client, session)
    imp = _make_import(client, owner_headers)

    other_headers, _ = _user(client, session)
    assert client.get(f"/api/v1/imports/{imp['id']}", headers=other_headers).status_code == 404
    assert (
        client.get(f"/api/v1/imports/{imp['id']}/jobs", headers=other_headers).status_code
        == 404
    )
    other_listing = client.get("/api/v1/imports/", headers=other_headers).json()
    assert other_listing["count"] == 0


def test_create_import_with_owned_experiment(upload_env, client, session):
    headers, _ = _user(client, session)
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
    imp = client.post(
        "/api/v1/imports/",
        params={
            "repo": "geo",
            "accession": "GSE111111",
            "project_id": project["id"],
            "experiment_id": experiment["id"],
        },
        headers=headers,
    ).json()
    assert imp["project_id"] == project["id"]
    assert imp["experiment_id"] == experiment["id"]


def test_create_import_rejects_foreign_experiment(upload_env, client, session):
    headers, _ = _user(client, session)
    other_headers, _ = _user(client, session)
    project = client.post(
        "/api/v1/projects/",
        json={"name": f"P-{uuid.uuid4().hex[:6]}"},
        headers=other_headers,
    ).json()
    experiment = client.post(
        f"/api/v1/projects/{project['id']}/experiments",
        json={"name": "Experiment"},
        headers=other_headers,
    ).json()
    response = client.post(
        "/api/v1/imports/",
        params={"repo": "geo", "accession": "GSE1", "experiment_id": experiment["id"]},
        headers=headers,
    )
    assert response.status_code == 403


def _owner_id(session) -> uuid.UUID:
    user = create_user(session, _email("import-owner"))
    return user.id


def test_job_state_machine_lifecycle(session):
    owner_id = _owner_id(session)
    imp = svc.create_import(
        session, owner_id=owner_id, repo=ExternalRepoType.geo, accession="GSE1"
    )
    job = session.exec(select(ImportJob).where(ImportJob.import_id == imp.id)).one()

    claimed = svc.claim_job(session, job.id)
    assert claimed is not None
    assert claimed.status == ImportJobStatus.running
    assert claimed.attempts == 1

    completed = svc.complete_job(session, job.id, downloaded_bytes=1234)
    assert completed is not None
    assert completed.status == ImportJobStatus.succeeded
    assert completed.downloaded_bytes == 1234
    session.refresh(imp)
    assert imp.status == RepositoryImportStatus.succeeded


def test_illegal_job_transitions_rejected(session):
    owner_id = _owner_id(session)
    imp = svc.create_import(
        session, owner_id=owner_id, repo=ExternalRepoType.geo, accession="GSE2"
    )
    job = session.exec(select(ImportJob).where(ImportJob.import_id == imp.id)).one()
    # completing a pending job is illegal (must claim first)
    assert svc.complete_job(session, job.id) is None
    # completing a completed job again is illegal
    svc.claim_job(session, job.id)
    svc.complete_job(session, job.id)
    assert svc.complete_job(session, job.id) is None
    # cancelling after completion is illegal
    assert svc.cancel_job(session, job.id) is None


def test_fail_job_records_error_and_propagates(session):
    owner_id = _owner_id(session)
    imp = svc.create_import(
        session, owner_id=owner_id, repo=ExternalRepoType.geo, accession="GSE3"
    )
    job = session.exec(select(ImportJob).where(ImportJob.import_id == imp.id)).one()
    svc.claim_job(session, job.id)
    failed = svc.fail_job(session, job.id, "network timeout")
    assert failed is not None
    assert failed.last_error == "network timeout"
    session.refresh(imp)
    assert imp.status == RepositoryImportStatus.failed


def test_get_import_owned_is_tenant_scoped(session):
    owner_id = _owner_id(session)
    other_id = create_user(session, _email("import-other")).id
    imp = svc.create_import(
        session, owner_id=owner_id, repo=ExternalRepoType.geo, accession="GSE4"
    )
    assert svc.get_import_owned(session, imp.id, owner_id) is not None
    assert svc.get_import_owned(session, imp.id, other_id) is None
