"""Cross-file validation (Story 18).

Covers experiment-scoped comparability: sample identity, duplicates, assembly
compatibility, mixed identifier namespaces, and the Story-22 placeholder
behaving as a skipped issue with reason.
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
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )
    return tmp_path


def _setup_experiment(client, session):
    email = _email("cross")
    create_user(session, email)
    headers = login_headers(client, email)
    project = client.post(
        "/api/v1/projects/", json={"name": f"P-{uuid.uuid4().hex[:6]}"}, headers=headers
    ).json()
    experiment = client.post(
        f"/api/v1/projects/{project['id']}/experiments",
        json={"name": "Expr"},
        headers=headers,
    ).json()
    return headers, experiment


def _upload_to_sample(client, headers, sample_id, filename, content):
    return client.post(
        "/api/v1/documents/",
        files={"file": (filename, content, "text/plain")},
        data={"sample_id": sample_id},
        headers=headers,
    ).json()


def test_single_doc_produces_not_applicable_info(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sample-A"},
        headers=headers,
    ).json()
    _upload_to_sample(client, headers, sample["id"], "counts.tsv", b"gene\tSampleA\nTP53\t1\n")

    response = client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    codes = {(i["code"], i["severity"]) for i in issues}
    assert ("CROSS-APPLICABLE-001", "info") in codes
    assert ("CROSS-IO-001", "skipped") in codes


def test_near_match_sample_name_produces_warning_with_suggestion(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample1 = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sample_A"},
        headers=headers,
    ).json()
    sample2 = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sample_B"},
        headers=headers,
    ).json()
    _upload_to_sample(client, headers, sample1["id"], "a.tsv", b"gene\tSample-A\nTP53\t1\n")
    _upload_to_sample(client, headers, sample2["id"], "b.tsv", b"gene\tSample_B\nTP53\t2\n")

    response = client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    warnings = [i for i in issues if i["severity"] == "warning" and i["code"] == "CROSS-SAMPLE-001"]
    assert warnings
    assert any(w.get("suggestion") for w in warnings)


def test_assembly_mismatch_produces_error_naming_files(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample1 = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam1"},
        headers=headers,
    ).json()
    sample2 = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam2"},
        headers=headers,
    ).json()
    doc1 = _upload_to_sample(client, headers, sample1["id"], "a.tsv", b"gene\tS1\nTP53\t1\n")
    doc2 = _upload_to_sample(client, headers, sample2["id"], "b.tsv", b"gene\tS2\nTP53\t2\n")
    client.put(
        f"/api/v1/documents/{doc1['id']}/metadata",
        json={"genome_assembly": "GRCh38"},
        headers=headers,
    )
    client.put(
        f"/api/v1/documents/{doc2['id']}/metadata",
        json={"genome_assembly": "hg19"},
        headers=headers,
    )

    response = client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    errors = [i for i in issues if i["severity"] == "error" and i["code"] == "CROSS-ASSEMBLY-001"]
    assert errors
    assert "GRCh38" in (errors[0].get("detail") or "").lower() or "hg19" in (errors[0].get("detail") or "").lower()


def test_identical_reupload_produces_info_dedup(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam1"},
        headers=headers,
    ).json()
    body = b"gene\tS1\nTP53\t1\n"
    _upload_to_sample(client, headers, sample["id"], "a.tsv", body)
    _upload_to_sample(client, headers, sample["id"], "b.tsv", body)

    response = client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    assert any(i["code"] == "CROSS-DUP-001" and i["severity"] == "info" for i in issues)


def test_mixed_namespaces_warning(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample1 = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam1"},
        headers=headers,
    ).json()
    sample2 = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam2"},
        headers=headers,
    ).json()
    _upload_to_sample(client, headers, sample1["id"], "a.tsv", b"gene\tS1\nENSG00000141510\t1\n")
    _upload_to_sample(client, headers, sample2["id"], "b.tsv", b"gene\tS2\nTP53\t2\n")

    response = client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=headers,
    )
    assert response.status_code == 200, response.text
    issues = response.json()["issues"]
    assert any(i["code"] == "CROSS-ID-NS-001" and i["severity"] == "warning" for i in issues)


def test_cross_user_denied(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam1"},
        headers=headers,
    ).json()
    _upload_to_sample(client, headers, sample["id"], "a.tsv", b"gene\tS1\nTP53\t1\n")
    _upload_to_sample(client, headers, sample["id"], "b.tsv", b"gene\tS1\nTP53\t2\n")

    e = _email("intruder")
    create_user(session, e)
    intruder = login_headers(client, e)

    r = client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=intruder,
    )
    assert r.status_code == 403


def test_cross_results_listable(upload_env, client, session):
    headers, experiment = _setup_experiment(client, session)
    sample = client.post(
        f"/api/v1/experiments/{experiment['id']}/samples",
        json={"name": "Sam1"},
        headers=headers,
    ).json()
    _upload_to_sample(client, headers, sample["id"], "a.tsv", b"gene\tS1\nTP53\t1\n")
    _upload_to_sample(client, headers, sample["id"], "b.tsv", b"gene\tS1\nTP53\t2\n")

    client.post(
        f"/api/v1/documents/experiments/{experiment['id']}/validate-cross",
        headers=headers,
    )
    r = client.get(
        f"/api/v1/documents/experiments/{experiment['id']}/validations-cross",
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["count"] >= 1
    assert r.json()["data"][0]["subject_type"] == "experiment"
