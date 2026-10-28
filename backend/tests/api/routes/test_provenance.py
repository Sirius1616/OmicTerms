"""Story 32 — Provenance event log: emission matrix, redaction, isolation.

Covers the acceptance criteria of the append-only audit trail: exactly-one
upload event, rename before/after, no user-supplied event mutation, payload
redaction on auth routes, per-request request ids, tenant isolation, actor
anonymisation on user deletion, and the closed action-code registry.
"""

import uuid

import pytest
from sqlmodel import col, select

from app.models import ProvenanceEvent
from app.services import provenance
from tests.utils.user import DEFAULT_PASSWORD, create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _owner(client, session):
    email = _email("prov-owner")
    create_user(session, email)
    return login_headers(client, email)


def _events(session, action: str | None = None) -> list[ProvenanceEvent]:
    statement = select(ProvenanceEvent).order_by(col(ProvenanceEvent.occurred_at))
    if action is not None:
        statement = statement.where(col(ProvenanceEvent.action) == action)
    return list(session.exec(statement).all())


def _make_hierarchy(client, headers):
    response = client.post(
        "/api/v1/projects/", json={"name": f"P-{uuid.uuid4().hex[:6]}"}, headers=headers
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
    return project_id, experiment_id, response.json()["id"]


@pytest.fixture()
def upload_env(tmp_path, monkeypatch):
    monkeypatch.setattr("app.core.config.settings.UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )
    return tmp_path


def test_upload_emits_exactly_one_document_uploaded_event(
    upload_env, client, session
):
    owner = _owner(client, session)
    project_id, _, sample_id = _make_hierarchy(client, owner)
    content = b"gene\tS1\nTP53\t1.0\n"

    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", content, "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    assert response.status_code == 201, response.text
    document = response.json()

    events = [
        e
        for e in _events(session, "document.uploaded")
        if e.entity_id == document["id"]
    ]
    assert len(events) == 1
    event = events[0]
    assert event.payload["filename"] == "counts.tsv"
    assert event.payload["sha256"] == document["sha256"]
    assert event.payload["size_bytes"] == len(content)
    assert event.actor_type == "user"
    assert event.actor_id is not None
    assert str(event.project_id) == project_id


def test_rename_emits_before_and_after(upload_env, client, session):
    owner = _owner(client, session)
    _, _, sample_id = _make_hierarchy(client, owner)
    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    document_id = response.json()["id"]

    client.patch(
        f"/api/v1/documents/{document_id}",
        json={"filename": "renamed-counts.tsv"},
        headers=owner,
    )
    events = _events(session, "document.renamed")
    event = events[-1]
    assert event.payload["before"] == "counts.tsv"
    assert event.payload["after"] == "renamed-counts.tsv"


def test_delete_emits_document_deleted(upload_env, client, session):
    owner = _owner(client, session)
    _, _, sample_id = _make_hierarchy(client, owner)
    response = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": sample_id},
        headers=owner,
    )
    document_id = response.json()["id"]
    client.delete(f"/api/v1/documents/{document_id}", headers=owner)

    events = [e for e in _events(session, "document.deleted") if e.entity_id == document_id]
    assert len(events) == 1
    assert events[0].payload["filename"] == "counts.tsv"


def test_hierarchy_emission_matrix(client, session):
    owner = _owner(client, session)
    project_id, experiment_id, sample_id = _make_hierarchy(client, owner)

    client.patch(f"/api/v1/projects/{project_id}", json={"name": "Renamed-P"}, headers=owner)
    client.patch(
        f"/api/v1/experiments/{experiment_id}", json={"name": "Renamed-E"}, headers=owner
    )
    client.patch(f"/api/v1/samples/{sample_id}", json={"name": "Renamed-S"}, headers=owner)
    client.delete(f"/api/v1/samples/{sample_id}", headers=owner)
    client.delete(f"/api/v1/experiments/{experiment_id}", headers=owner)
    client.delete(f"/api/v1/projects/{project_id}", headers=owner)

    expected = {
        "project.created": 1,
        "project.updated": 1,
        "project.deleted": 1,
        "experiment.created": 1,
        "experiment.updated": 1,
        "experiment.deleted": 1,
        "sample.created": 1,
        "sample.updated": 1,
        "sample.deleted": 1,
    }
    events = _events(session)
    for action, count in expected.items():
        matching = [
            e
            for e in events
            if e.action == action
            and e.entity_id in (project_id, experiment_id, sample_id)
        ]
        assert len(matching) == count, f"expected {count} {action}, got {len(matching)}"

    rename = next(
        e for e in events if e.action == "project.updated" and e.entity_id == project_id
    )
    assert rename.payload["fields"] == ["name"]

    deleted = next(
        e for e in events if e.action == "project.deleted" and e.entity_id == project_id
    )
    assert deleted.payload["name"]  # project name preserved after deletion


def test_events_endpoint_requires_ownership(client, session):
    owner = _owner(client, session)
    project_id, _, _ = _make_hierarchy(client, owner)

    intruder_email = _email("prov-intruder")
    create_user(session, intruder_email)
    intruder = login_headers(client, intruder_email)
    assert (
        client.get(f"/api/v1/projects/{project_id}/events", headers=intruder).status_code
        == 404
    )

    response = client.get(f"/api/v1/projects/{project_id}/events", headers=owner)
    assert response.status_code == 200
    assert response.json()["count"] >= 3


def test_no_mutation_endpoint_for_events(client, session):
    owner = _owner(client, session)
    project_id, _, _ = _make_hierarchy(client, owner)
    url = f"/api/v1/projects/{project_id}/events"
    assert client.post(url, json={}, headers=owner).status_code == 405
    assert client.patch(url, json={}, headers=owner).status_code == 405
    assert client.delete(url, headers=owner).status_code == 405
    assert client.put(url, json={}, headers=owner).status_code == 405


def test_events_action_filter_and_pagination(client, session):
    owner = _owner(client, session)
    project_id, _, _ = _make_hierarchy(client, owner)

    response = client.get(
        f"/api/v1/projects/{project_id}/events",
        params={"action": "project.created"},
        headers=owner,
    )
    body = response.json()
    assert body["count"] == 1
    assert body["data"][0]["action"] == "project.created"

    response = client.get(
        f"/api/v1/projects/{project_id}/events",
        params={"limit": 2, "skip": 0},
        headers=owner,
    )
    assert len(response.json()["data"]) == 2
    occurred = [e["occurred_at"] for e in response.json()["data"]]
    assert occurred == sorted(occurred, reverse=True)


def test_auth_routes_emit_no_events_with_secrets(client, session):
    email = _email("prov-secret")
    create_user(session, email)
    before = len(_events(session))

    client.post(
        "/api/v1/login/access-token",
        data={"username": email, "password": DEFAULT_PASSWORD},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    client.post(f"/api/v1/password-recovery/{email}")

    new_events = _events(session)[before:]
    for event in new_events:
        serialized = str(event.payload)
        assert DEFAULT_PASSWORD not in serialized
        assert "token" not in event.payload or event.payload.get("token") is None

    login_related = [e for e in new_events if e.action in ("user.password_changed",)]
    assert login_related == []


def test_request_id_stamped_and_distinct(client, session):
    owner = _owner(client, session)
    response = client.post(
        "/api/v1/projects/", json={"name": f"P-{uuid.uuid4().hex[:6]}"}, headers=owner
    )
    project_id = response.json()["id"]
    first_id = response.headers.get("X-Request-ID")
    assert first_id

    event = next(e for e in _events(session, "project.created") if e.entity_id == project_id)
    assert event.request_id == first_id

    response = client.post(
        "/api/v1/projects/", json={"name": f"P-{uuid.uuid4().hex[:6]}"}, headers=owner
    )
    second_id = response.headers.get("X-Request-ID")
    assert second_id and second_id != first_id


def test_user_deletion_anonymises_actor_id(client, session):
    email = _email("prov-delete")
    create_user(session, email)
    user = login_headers(client, email)
    client.patch(
        "/api/v1/users/me", json={"full_name": "Ephemeral"}, headers=user
    )
    before = [e for e in _events(session, "user.updated")]
    assert any(e.actor_id is not None for e in before)

    client.delete("/api/v1/users/me", headers=user)

    after = _events(session, "user.updated")
    for event in after:
        assert event.actor_id is None
        assert event.payload  # history preserved, identity erased


def test_record_rejects_unregistered_action(session):
    with pytest.raises(ValueError):
        provenance.record(
            session,
            project_id=None,
            action="not.a.real.action",
            entity_type="document",
            entity_id=str(uuid.uuid4()),
            actor_type="user",
        )


def test_registry_codes_are_namespaced():
    for action in provenance.ACTION_REGISTRY:
        domain, _, code = action.partition(".")
        assert code, f"action {action} must be namespaced as domain.code"
        assert domain in {
            "project",
            "experiment",
            "sample",
            "document",
            "metadata",
            "extraction",
            "validation",
            "user",
            "import",
        }
