import pytest

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
