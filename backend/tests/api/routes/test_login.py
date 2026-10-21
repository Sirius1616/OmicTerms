import uuid

import pytest

from app.utils import create_password_reset_token
from tests.utils.user import DEFAULT_PASSWORD, create_user

pytestmark = pytest.mark.integration


def test_password_reset_rejects_wrong_purpose(client):
    # create a bad token with purpose other
    import time
    from datetime import UTC, datetime, timedelta

    import jwt

    from app.core import config as cfg

    now = datetime.now(UTC)
    payload = {
        "sub": "bad@example.com",
        "exp": now + timedelta(hours=1),
        "nbf": now - timedelta(seconds=5),
        "purpose": "other",
    }
    bad = jwt.encode(
        payload, key=cfg.settings.SECRET_KEY, algorithm=cfg.settings.ALGORITHM
    )
    time.sleep(0.1)
    res = client.post(
        "/api/v1/reset-password", json={"token": bad, "new_password": "newpass123"}
    )
    assert res.status_code == 400  # wrong-purpose token rejected


def test_invalid_access_token_is_401(client):
    # Unverifiable credentials are "unauthorized", never "forbidden", so the
    # client can tell "log out" (401) apart from "not allowed here" (403).
    res = client.get(
        "/api/v1/users/me", headers={"Authorization": "Bearer not-a-real-token"}
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Credentials cannot be verified"


def test_password_reset_actually_changes_password(client, session):
    # The endpoint reports success, so afterwards the new password must
    # authenticate and the old one must not.
    email = f"reset-{uuid.uuid4().hex[:8]}@example.com"
    create_user(session, email)

    token = create_password_reset_token(email=email)
    res = client.post(
        "/api/v1/reset-password",
        json={"token": token, "new_password": "brandnewpass123"},
    )
    assert res.status_code == 200, res.text
    assert res.json()["message"] == "Password updated successfully"

    form_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    old_login = client.post(
        "/api/v1/login/access-token",
        data={"username": email, "password": DEFAULT_PASSWORD},
        headers=form_headers,
    )
    assert old_login.status_code == 401

    new_login = client.post(
        "/api/v1/login/access-token",
        data={"username": email, "password": "brandnewpass123"},
        headers=form_headers,
    )
    assert new_login.status_code == 200, new_login.text
    assert new_login.json()["access_token"]
