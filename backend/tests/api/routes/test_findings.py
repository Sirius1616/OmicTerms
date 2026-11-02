"""Story 30 — Findings: claims tied to evidence.

Covers the acceptance criteria end to end:

1. creating a finding with two evidence refs returns them resolved with labels
2. the validate endpoint cannot be forced — no body path to ``validated``,
   state flips only when the deterministic checks pass
3. publishing requires ≥1 primary evidence (422 otherwise); publishes bump
   the version
4. cross-project evidence links are rejected
5. version history is retrievable (``GET /findings/{id}/versions``)
6. pytest covers the lifecycle: draft → review → published → retracted, the
   published freeze, dispute handling, and the evidence-graph hooks.
"""

import uuid
from datetime import datetime

import pytest
from sqlmodel import col, select

from app.models import (
    EvidenceEntityType,
    EvidenceNode,
    ProvenanceEvent,
    ValidationRun,
    ValidationSeverity,
    ValidationSubjectType,
)
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


@pytest.fixture(autouse=True)
def _isolated_extraction_jobs(tmp_path, monkeypatch):
    """Keep uploads inside the test session (same pattern as test_runs.py).

    Without this, the upload route schedules the real extraction job which
    opens its own engine (the application Postgres) — the suite stays hermetic
    instead.
    """
    from app.core.config import settings

    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _user(client, session, prefix="finding-owner"):
    email = _email(prefix)
    create_user(session, email)
    return login_headers(client, email)


def _make_hierarchy(client, headers, project_name=None):
    response = client.post(
        "/api/v1/projects/",
        json={"name": project_name or f"P-{uuid.uuid4().hex[:6]}"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    project_id = response.json()["id"]
    response = client.post(
        f"/api/v1/projects/{project_id}/experiments",
        json={"name": "Baseline"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    experiment_id = response.json()["id"]
    response = client.post(
        f"/api/v1/experiments/{experiment_id}/samples",
        json={"name": "Sample one"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    sample_id = response.json()["id"]

    upload = client.post(
        "/api/v1/documents/",
        files={"file": ("counts.tsv", b"gene\tS1\nTP53\t1.0\n", "text/plain")},
        data={"sample_id": sample_id},
        headers=headers,
    )
    assert upload.status_code == 201, upload.text
    document = upload.json()
    return project_id, document


def _create_run(client, headers, project_id, tool="matrix-de-from-test"):
    response = client.post(
        f"/api/v1/projects/{project_id}/runs",
        json={"tool_name": tool, "input_refs": []},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()


def _create_finding(client, headers, project_id, evidence=None, **overrides):
    payload = {
        "title": "Treatment shifts immune-response expression",
        "summary": "Candidate claim tied to project datasets.",
        "evidence": evidence or [],
    }
    payload.update(overrides)
    response = client.post(
        f"/api/v1/projects/{project_id}/findings", json=payload, headers=headers
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_ac1_creating_with_evidence_resolves_labels(client, session):
    headers = _user(client, session)
    project_id, document = _make_hierarchy(client, headers)
    run = _create_run(client, headers, project_id)

    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
                "quote_or_field": {
                    "quote": "TP53",
                    "source_sha256": document["sha256"],
                },
            },
            {
                "target_type": "run",
                "target_id": run["id"],
                "role": "supporting",
            },
        ],
    )
    assert [e["role"] for e in finding["evidence"]] == ["primary", "supporting"]
    labels = [e["label"] for e in finding["evidence"]]
    assert labels == ["counts.tsv", "matrix-de-from-test"]

    # The concrete quote is preserved verbatim for later re-checks.
    assert finding["evidence"][0]["quote_or_field"]["quote"] == "TP53"


def test_ac2_validate_cannot_be_forced_without_evidence(client, session):
    headers = _user(client, session)
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "supporting",
            }
        ],
    )

    # A body is posted to prove there is no body path: the endpoint has no
    # acknowledgement mechanism, the checks decide.
    response = client.post(
        f"/api/v1/findings/{finding['id']}/validate",
        json={"validation_state": "validated"},
        headers=headers,
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["validation_state_before"] == "unvalidated"
    assert body["validation_state_after"] == "unvalidated"
    codes = [issue["code"] for issue in body["issues"]]
    assert "finding.no_primary_evidence" in codes
    for issue in body["issues"]:
        assert issue["severity"] == "error"

    # The failed attempt persists as a validation run for the finding subject.
    runs = session.exec(
        select(ValidationRun).where(
            col(ValidationRun.subject_type) == ValidationSubjectType.finding,
            col(ValidationRun.subject_id) == uuid.UUID(finding["id"]),
        )
    ).all()
    assert len(runs) == 1
    assert runs[0].issues

    # Fix the gap and revalidate: only then does the server set validated.
    add = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "document",
            "target_id": document["id"],
            "role": "primary",
        },
        headers=headers,
    )
    assert add.status_code == 200, add.text

    response = client.post(
        f"/api/v1/findings/{finding['id']}/validate", headers=headers
    )
    body = response.json()
    assert body["validation_state_after"] == "validated"

    finding_after = client.get(
        f"/api/v1/findings/{finding['id']}", headers=headers
    ).json()
    assert finding_after["validation_state"] == "validated"


def test_validate_rejected_after_material_is_deleted(client, session):
    headers = _user(client, session, prefix="unresolved")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )
    first = client.post(
        f"/api/v1/findings/{finding['id']}/validate", headers=headers
    )
    assert first.status_code == 200, first.text
    assert first.json()["validation_state_after"] == "validated"

    delete = client.delete(
        f"/api/v1/documents/{document['id']}", headers=headers
    )
    assert delete.status_code == 204, delete.text

    revalidate = client.post(
        f"/api/v1/findings/{finding['id']}/validate", headers=headers
    )
    assert revalidate.status_code == 200
    body = revalidate.json()
    # Failures keep the state (product rule) and report unresolved evidence.
    assert body["validation_state_after"] == "validated"
    assert "finding.evidence_unresolved" in [
        issue["code"] for issue in body["issues"]
    ]


def test_contradicting_evidence_blocks_auto_validation(client, session):
    headers = _user(client, session, prefix="contradict")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )
    add = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "document",
            "target_id": document["id"],
            "role": "contradicting",
        },
        headers=headers,
    )
    assert add.status_code == 200, add.text

    response = client.post(
        f"/api/v1/findings/{finding['id']}/validate", headers=headers
    )
    body = response.json()
    assert body["validation_state_after"] == "unvalidated"
    assert "finding.contradicting_evidence" in [
        issue["code"] for issue in body["issues"]
    ]


def test_ac3_publish_requires_primary_evidence_and_bumps_version(client, session):
    headers = _user(client, session)
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "supporting",
            }
        ],
    )
    assert finding["version"] == 1

    denied = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert denied.status_code == 422
    assert "primary" in denied.json()["detail"]

    add_primary = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "document",
            "target_id": document["id"],
            "role": "primary",
        },
        headers=headers,
    )
    assert add_primary.status_code == 200, add_primary.text

    published = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert published.status_code == 200, published.text
    body = published.json()
    assert body["status"] == "published"
    assert body["version"] >= 2  # every publish bumps (first publish → 2)

    response = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert response.status_code == 422


def test_ac3b_double_primary_evidence_satisfies_the_rule(client, session):
    headers = _user(client, session, prefix="twoprim")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            },
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            },
        ],
    )
    publish = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert publish.status_code == 200, publish.text
    assert publish.json()["status"] == "published"


def test_ac4_cross_project_evidence_rejected(client, session):
    owner = _user(client, session, prefix="owner")
    outsider = _user(client, session, prefix="other")
    owner_project, _owner_document = _make_hierarchy(client, owner)
    _, other_document = _make_hierarchy(client, outsider)

    finding = _create_finding(client, owner, owner_project)

    response = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "document",
            "target_id": other_document["id"],
            "role": "primary",
        },
        headers=owner,
    )
    assert response.status_code == 422
    assert "Cross-project" in response.json()["detail"]

    stored = client.get(f"/api/v1/findings/{finding['id']}", headers=owner).json()
    assert stored["evidence"] == []


def test_ac4b_cross_project_supersede_rejected(client, session):
    owner = _user(client, session, prefix="sup-owner")
    outsider = _user(client, session, prefix="sup-other")
    owner_project, _ = _make_hierarchy(client, owner)
    other_project, _ = _make_hierarchy(client, outsider)
    other_finding = _create_finding(client, outsider, other_project)

    response = client.post(
        f"/api/v1/projects/{owner_project}/findings",
        json={
            "title": "Superseding attempt",
            "summary": "Must be rejected.",
            "supersedes_id": other_finding["id"],
        },
        headers=owner,
    )
    assert response.status_code == 422


def test_ac5_version_history_is_retrievable(client, session):
    headers = _user(client, session, prefix="versions")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )

    empty = client.get(
        f"/api/v1/findings/{finding['id']}/versions", headers=headers
    )
    assert empty.status_code == 200
    assert empty.json() == {"data": [], "count": 0}

    first_publish = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert first_publish.status_code == 200, first_publish.text
    version_two = first_publish.json()["version"]
    assert version_two == 2

    # Retract; the claim stays visibly retracted until a human returns it to
    # review, then publish a changed claim in a new version.
    retract = client.post(
        f"/api/v1/findings/{finding['id']}/retract",
        headers=headers,
    )
    assert retract.status_code == 200, retract.text
    assert retract.json()["status"] == "retracted"

    back_to_review = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"status": "review"},
        headers=headers,
    )
    assert back_to_review.status_code == 200, back_to_review.text
    assert back_to_review.json()["status"] == "review"

    edit = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"title": "Reviewed: immune-response shift"},
        headers=headers,
    )
    assert edit.status_code == 200, edit.text

    second_publish = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert second_publish.status_code == 200, second_publish.text
    assert second_publish.json()["version"] == version_two + 1

    history = client.get(
        f"/api/v1/findings/{finding['id']}/versions", headers=headers
    ).json()
    assert history["count"] == 2
    versions = [entry["version"] for entry in history["data"]]
    assert versions == sorted(versions, reverse=True)
    newest = history["data"][0]
    assert newest["title"] == "Reviewed: immune-response shift"
    assert newest["status"] == "published"
    assert newest["published_by"] is not None
    older = history["data"][1]
    assert older["title"] == "Treatment shifts immune-response expression"


def test_published_findings_are_freezed_until_retraction(client, session):
    headers = _user(client, session, prefix="frozen")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )
    publish = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert publish.status_code == 200, publish.text

    assert (
        client.patch(
            f"/api/v1/findings/{finding['id']}",
            json={"title": "Post-publication edit"},
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/evidence",
            json={
                "target_type": "document",
                "target_id": document["id"],
                "role": "supporting",
            },
            headers=headers,
        ).status_code
        == 422
    )
    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/retract", headers=headers
        ).status_code
        == 200
    )
    retract_state = client.get(
        f"/api/v1/findings/{finding['id']}", headers=headers
    ).json()
    assert retract_state["status"] == "retracted"

    second_retract = client.post(
        f"/api/v1/findings/{finding['id']}/retract", headers=headers
    )
    assert second_retract.status_code == 422  # already retracted

    delete_after_retraction = client.delete(
        f"/api/v1/findings/{finding['id']}", headers=headers
    )
    assert delete_after_retraction.status_code == 204
    assert (
        client.get(
            f"/api/v1/findings/{finding['id']}", headers=headers
        ).status_code
        == 404
    )


def test_published_cannot_be_deleted_directly(client, session):
    headers = _user(client, session, prefix="noerase")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )
    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/publish", headers=headers
        ).status_code
        == 200
    )
    response = client.delete(
        f"/api/v1/findings/{finding['id']}", headers=headers
    )
    assert response.status_code == 422
    assert "retracted" in response.json()["detail"]


def test_dispute_is_a_human_action_and_never_wipes_validated_silently(client, session):
    headers = _user(client, session, prefix="disputed")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )
    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/validate", headers=headers
        ).json()["validation_state_after"]
        == "validated"
    )

    dispute = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"disputed": True},
        headers=headers,
    )
    assert dispute.status_code == 200, dispute.text
    assert dispute.json()["validation_state"] == "disputed"

    resolve = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"disputed": False},
        headers=headers,
    )
    # Undoing a dispute re-earns validation: state returns to unvalidated,
    # never silently back to validated.
    assert resolve.status_code == 200, resolve.text
    assert resolve.json()["validation_state"] == "unvalidated"


def test_tenant_scoping_and_label_none_for_unresolvable_targets(client, session):
    owner = _user(client, session, prefix="scoped-findings")
    outsider = _user(client, session, prefix="outsider-findings")
    project_id, _ = _make_hierarchy(client, owner)
    finding = _create_finding(client, owner, project_id)

    for method, path in (
        ("get", f"/api/v1/findings/{finding['id']}"),
        ("patch", f"/api/v1/findings/{finding['id']}"),
        ("get", f"/api/v1/findings/{finding['id']}/versions"),
    ):
        if method == "patch":
            response = getattr(client, method)(
                path, json={"title": "hijack"}, headers=outsider
            )
        else:
            response = getattr(client, method)(path, headers=outsider)
        assert response.status_code == 404, path
        assert response.status_code == 404

    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/validate", headers=outsider
        ).status_code
        == 404
    )

    # Edge id that cannot exist → the API stays honest about unresolvable
    # types with 422 rather than a fabricated reference.
    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/evidence",
            json={
                "target_type": "report_passage",
                "target_id": "not-modelled",
                "role": "primary",
            },
            headers=owner,
        ).status_code
        == 422
    )


def test_graph_edge_evidence_resolves_with_label(client, session):
    headers = _user(client, session, prefix="graph-edge")
    project_id, document = _make_hierarchy(client, headers)

    graph = client.get(f"/api/v1/projects/{project_id}/graph", headers=headers)
    assert graph.status_code == 200, graph.text
    nodes = graph.json()["nodes"]
    project_node = next(n for n in nodes if n["entity_type"] == "project")
    document_node = next(n for n in nodes if n["entity_type"] == "document")

    edge = client.post(
        f"/api/v1/projects/{project_id}/graph/edges",
        json={
            "source_id": document_node["id"],
            "target_id": project_node["id"],
            "relation": "supports",
            "note": "promoter-highlights",
            "evidence_ref": {"sha256": document["sha256"]},
        },
        headers=headers,
    )
    assert edge.status_code == 201, edge.text

    finding = _create_finding(client, headers, project_id)
    response = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "graph_edge",
            "target_id": edge.json()["id"],
            "role": "primary",
        },
        headers=headers,
    )
    assert response.status_code == 200, response.text
    assert response.json()["label"] == "evidence edge: promoter-highlights"


def test_evidence_node_materialised_and_purged_with_finding(client, session):
    headers = _user(client, session, prefix="graph-node")
    project_id, _ = _make_hierarchy(client, headers)
    finding = _create_finding(client, headers, project_id)

    nodes = session.exec(
        select(EvidenceNode).where(
            col(EvidenceNode.entity_type) == EvidenceEntityType.finding,
            col(EvidenceNode.project_id) == uuid.UUID(project_id),
        )
    ).all()
    assert len(nodes) == 1
    assert nodes[0].entity_id == finding["id"]
    assert nodes[0].label == finding["title"]

    update = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"title": "Renamed claim"},
        headers=headers,
    )
    assert update.status_code == 200, update.text
    refreshed = session.get(EvidenceNode, nodes[0].id)
    assert refreshed is not None
    assert refreshed.label == "Renamed claim"

    assert (
        client.delete(
            f"/api/v1/findings/{finding['id']}", headers=headers
        ).status_code
        == 204
    )
    assert session.get(EvidenceNode, nodes[0].id) is None


def test_finding_provenance_events_recorded(client, session):
    headers = _user(client, session, prefix="audit")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )

    edit = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"title": "Restated after internal review"},
        headers=headers,
    )
    assert edit.status_code == 200, edit.text

    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/publish", headers=headers
        ).status_code
        == 200
    )
    assert (
        client.post(
            f"/api/v1/findings/{finding['id']}/retract", headers=headers
        ).status_code
        == 200
    )

    events = session.exec(
        select(ProvenanceEvent).where(
            col(ProvenanceEvent.project_id) == uuid.UUID(project_id),
            col(ProvenanceEvent.entity_type) == "finding",
        )
    ).all()
    actions = {event.action for event in events}
    assert {
        "finding.created",
        "finding.updated",
        "finding.published",
        "finding.retracted",
        "finding.evidence_added",
    } <= actions

    # A retracted claim cannot be re-published: the refusal carries no new
    # finding.* provenance state change beyond the retraction itself.
    attempt = client.post(
        f"/api/v1/findings/{finding['id']}/publish", headers=headers
    )
    assert attempt.status_code == 422


def test_list_findings_is_project_scoped_and_sorted(client, session):
    headers = _user(client, session, prefix="list")
    project_id, _ = _make_hierarchy(client, headers)
    first = _create_finding(client, headers, project_id)
    second = _create_finding(
        client, headers, project_id, title="Second claim", summary="Later."
    )

    response = client.get(
        f"/api/v1/projects/{project_id}/findings", headers=headers
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == 2
    assert [f["id"] for f in body["data"]] == [second["id"], first["id"]]


def test_evidence_row_removal_direct(client, session):
    headers = _user(client, session, prefix="evidence-remove")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "supporting",
            }
        ],
    )
    # Bad evidence id owned by nothing → rule breach (the route maps to 422).
    assert (
        client.delete(
            f"/api/v1/findings/{finding['id']}/evidence/{uuid.uuid4()}",
            headers=headers,
        ).status_code
        == 422
    )

    created = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "document",
            "target_id": document["id"],
            "role": "primary",
        },
        headers=headers,
    )
    assert created.status_code == 200, created.text
    remove = client.delete(
        f"/api/v1/findings/{finding['id']}/evidence/{created.json()['id']}",
        headers=headers,
    )
    assert remove.status_code == 204, remove.text
    remaining = client.get(
        f"/api/v1/findings/{finding['id']}", headers=headers
    ).json()
    # The original inline supporting reference stays; only the removed row
    # is gone.
    assert len(remaining["evidence"]) == 1
    assert remaining["evidence"][0]["role"] == "supporting"


def test_validation_run_persists_issue_rows_after_revalidation(client, session):
    headers = _user(client, session, prefix="persist")
    project_id, document = _make_hierarchy(client, headers)
    finding = _create_finding(
        client,
        headers,
        project_id,
        evidence=[
            {
                "target_type": "document",
                "target_id": document["id"],
                "role": "primary",
            }
        ],
    )
    first = client.post(
        f"/api/v1/findings/{finding['id']}/validate", headers=headers
    )
    assert first.json()["validation_state_after"] == "validated"

    subject_id = uuid.UUID(finding["id"])
    runs = session.exec(
        select(ValidationRun)
        .where(
            col(ValidationRun.subject_type) == ValidationSubjectType.finding,
            col(ValidationRun.subject_id) == subject_id,
        )
        .order_by(col(ValidationRun.started_at))
    ).all()
    assert len(runs) == 1
    assert len(runs[0].issues) == 0

    # Add contradicting material and revalidate: a new run with an error row.
    add = client.post(
        f"/api/v1/findings/{finding['id']}/evidence",
        json={
            "target_type": "document",
            "target_id": document["id"],
            "role": "contradicting",
        },
        headers=headers,
    )
    assert add.status_code == 200, add.text
    second = client.post(
        f"/api/v1/findings/{finding['id']}/validate", headers=headers
    )
    body = second.json()
    assert "finding.contradicting_evidence" in [
        issue["code"] for issue in body["issues"]
    ]

    runs = session.exec(
        select(ValidationRun)
        .where(
            col(ValidationRun.subject_type) == ValidationSubjectType.finding,
            col(ValidationRun.subject_id) == subject_id,
        )
        .order_by(col(ValidationRun.started_at))
    ).all()
    assert len(runs) == 2
    assert runs[0].issues == []
    assert any(
        issue.severity == ValidationSeverity.error
        for issue in runs[-1].issues
    )


def test_updated_at_moves_on_content_edit(client, session):
    headers = _user(client, session, prefix="timestamps")
    project_id, _ = _make_hierarchy(client, headers)
    finding = _create_finding(client, headers, project_id)
    before = datetime.fromisoformat(finding["updated_at"].split("+")[0])

    edit = client.patch(
        f"/api/v1/findings/{finding['id']}",
        json={"summary": "Updated summary for the timestamp check."},
        headers=headers,
    )
    assert edit.status_code == 200, edit.text
    after = datetime.fromisoformat(edit.json()["updated_at"].split("+")[0])
    assert after > before
