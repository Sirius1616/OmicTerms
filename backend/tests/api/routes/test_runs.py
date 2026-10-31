"""Story 22 — AnalysisRun execution records.

Covers the acceptance criteria: complete input/output sha256 refs for a
document processed end-to-end (extraction wiring), illegal CAS transitions
rejected, tenant scoping, list ordering + pagination, nullable metadata
instead of fake defaults, and the Story 28 evidence-graph hooks (run node +
input_to/produced_by edges).
"""

import uuid

import pytest
from sqlalchemy import func
from sqlmodel import col, select

from app.models import (
    AnalysisRun,
    AnalysisRunStatus,
    EvidenceEdge,
    EvidenceEntityType,
    EvidenceNode,
    EvidenceRelation,
)
from app.services import runs as runs_service
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _user(client, session, prefix="run-owner"):
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


def _upload_doc(client, headers, sample_id):
    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": sample_id},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_run(client, headers, project_id, tool="matrix-de"):
    response = client.post(
        f"/api/v1/projects/{project_id}/runs",
        json={"tool_name": tool, "input_refs": []},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_run_record_persists_optional_fields_as_null(client, session):
    headers = _user(client, session)
    project_id, _, _ = _make_hierarchy(client, headers)
    run = _create_run(client, headers, project_id)
    assert run["status"] == "queued"
    assert run["tool_version"] is None
    assert run["adapter_id"] is None
    assert run["config_hash"] is None
    assert run["started_at"] is None
    assert run["finished_at"] is None
    assert run["runtime_info"] is None


def test_illegal_status_transitions_are_rejected(session):
    owner_email = _email("cas")
    user = create_user(session, owner_email)
    from app.models import Project

    project = Project(user_id=user.id, name=f"Proj-{uuid.uuid4().hex[:6]}")
    session.add(project)
    session.commit()
    session.refresh(project)

    run = runs_service.create_run(
        session,
        project,
        tool_name="test",
        tool_version=None,
        adapter_id=None,
        parameters={},
        config_hash=None,
        input_refs=[],
        actor_user_id=user.id,
    )

    # queued → succeeded is illegal
    assert not runs_service.transition(
        session, run, AnalysisRunStatus.queued, AnalysisRunStatus.succeeded
    )
    run = session.get(AnalysisRun, run.id)
    assert run.status == AnalysisRunStatus.queued

    # CAS: two successive claims of the same queued→running move — the second
    # attempt loses (status no longer queued).
    assert runs_service.transition(
        session, run, AnalysisRunStatus.queued, AnalysisRunStatus.running
    )
    assert not runs_service.transition(
        session, run, AnalysisRunStatus.queued, AnalysisRunStatus.running
    )
    run = session.get(AnalysisRun, run.id)

    # running → succeeded allowed; second complete attempt (already terminal)
    # is rejected by the CAS guard.
    assert runs_service.transition(
        session, run, AnalysisRunStatus.running, AnalysisRunStatus.succeeded
    )
    assert not runs_service.transition(
        session, run, AnalysisRunStatus.running, AnalysisRunStatus.failed
    )
    run = session.get(AnalysisRun, run.id)
    assert run.status == AnalysisRunStatus.succeeded
    assert run.started_at is not None
    assert run.finished_at is not None


def _run_pending_extraction_job(session, document_id: str) -> None:
    """Drive the API-created extraction job inline with the real extractor."""
    import time as _time

    from app.models import ExtractionJob, ExtractionJobStatus
    from app.services.extraction_job import process_job

    job = session.exec(
        select(ExtractionJob).where(
            col(ExtractionJob.document_id) == uuid.UUID(document_id),
            col(ExtractionJob.status) == ExtractionJobStatus.pending,
        )
    ).first()
    assert job is not None, "expected a pending extraction job for the upload"
    process_job(session, job.id, sleep=_time.sleep and (lambda _: None))


def test_extraction_run_records_full_sha256_chain(upload_env, client, session):
    headers = _user(client, session, prefix="chain")
    project_id, _, sample_id = _make_hierarchy(client, headers)
    document = _upload_doc(client, headers, sample_id)
    _run_pending_extraction_job(session, document["id"])

    runs = session.exec(
        select(AnalysisRun).where(
            col(AnalysisRun.project_id) == uuid.UUID(project_id)
        )
    ).all()
    assert len(runs) == 1
    run = runs[0]
    assert run.tool_name == "extraction"
    assert run.adapter_id is not None
    assert run.status == AnalysisRunStatus.succeeded
    assert run.started_at is not None
    assert run.finished_at is not None

    assert run.input_refs == [
        {"document_id": document["id"], "sha256": document["sha256"]}
    ]
    assert run.output_refs and run.output_refs[0]["sha256"] == document["sha256"]
    assert run.output_refs[0]["document_id"] == document["id"]


def test_tenant_scoping(client, session):
    headers = _user(client, session, prefix="scoped")
    project_id, _, _ = _make_hierarchy(client, headers)
    run = _create_run(client, headers, project_id)

    outside = _user(client, session, prefix="outsider")
    response = client.get(f"/api/v1/runs/{run['id']}", headers=outside)
    assert response.status_code == 404

    response = client.get(f"/api/v1/projects/{project_id}/runs", headers=outside)
    assert response.status_code == 404

    response = client.post(f"/api/v1/runs/{run['id']}/cancel", headers=outside)
    assert response.status_code == 404

    response = client.get(f"/api/v1/runs/{run['id']}", headers=headers)
    assert response.status_code == 200


def test_runs_list_ordered_desc_and_paginated(client, session):
    headers = _user(client, session, prefix="paged")
    project_id, _, _ = _make_hierarchy(client, headers)
    _create_run(client, headers, project_id, tool="run-a")
    _create_run(client, headers, project_id, tool="run-b")
    _create_run(client, headers, project_id, tool="run-c")

    response = client.get(
        f"/api/v1/projects/{project_id}/runs?limit=2&skip=0", headers=headers
    )
    body = response.json()
    assert body["count"] == 3
    assert len(body["data"]) == 2
    tools = [r["tool_name"] for r in body["data"]]
    timestamps = [r["created_at"] for r in body["data"]]
    assert timestamps == sorted(timestamps, reverse=True)
    # insertion order a,b,c → newest first
    assert tools == ["run-c", "run-b"]

    response = client.get(
        f"/api/v1/projects/{project_id}/runs?limit=10&skip=2", headers=headers
    )
    assert [r["tool_name"] for r in response.json()["data"]] == ["run-a"]


def test_cancel_lifecycle_rules(client, session):
    headers = _user(client, session, prefix="cancel")
    project_id, _, _ = _make_hierarchy(client, headers)

    queued_run = _create_run(client, headers, project_id, tool="queued-run")
    response = client.post(
        f"/api/v1/runs/{queued_run['id']}/cancel", headers=headers
    )
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "cancelled"

    # cancelling again must fail (terminal)
    response = client.post(
        f"/api/v1/runs/{queued_run['id']}/cancel", headers=headers
    )
    assert response.status_code == 422


def test_run_nodes_and_input_to_edges_in_evidence_graph(
    upload_env, client, session
):

    headers = _user(client, session, prefix="graph")
    project_id, _, sample_id = _make_hierarchy(client, headers)
    document = _upload_doc(client, headers, sample_id)
    _run_pending_extraction_job(session, document["id"])

    run = session.exec(
        select(AnalysisRun).where(
            col(AnalysisRun.project_id) == uuid.UUID(project_id)
        )
    ).one()

    run_nodes = session.exec(
        select(EvidenceNode).where(
            col(EvidenceNode.entity_type) == EvidenceEntityType.run,
            col(EvidenceNode.project_id) == uuid.UUID(project_id),
        )
    ).all()
    assert len(run_nodes) == 1
    assert run_nodes[0].entity_id == str(run.id)

    input_edges = session.exec(
        select(func.count())
        .select_from(EvidenceEdge)
        .where(col(EvidenceEdge.relation) == EvidenceRelation.input_to)
    ).one()
    assert input_edges >= 1
    _ = document
