"""Admin job-stats endpoint (Story 13 AC: GET /jobs/stats)."""

import uuid

import pytest

from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration

COUNT_KEYS = ("pending", "running", "succeeded", "failed")


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def test_job_stats_admin_counts_and_non_admin_denied(client, session):
    admin_email = _email("admin")
    create_user(session, admin_email, is_admin=True)
    admin = login_headers(client, admin_email)

    response = client.get("/api/v1/jobs/stats", headers=admin)
    assert response.status_code == 200, response.text
    body = response.json()
    for key in (*COUNT_KEYS, "total"):
        assert isinstance(body[key], int)
    assert body["total"] == sum(body[key] for key in COUNT_KEYS)

    user_email = _email("user")
    create_user(session, user_email)
    user = login_headers(client, user_email)
    assert client.get("/api/v1/jobs/stats", headers=user).status_code == 403
    assert client.get("/api/v1/jobs/stats").status_code in (401, 403)
