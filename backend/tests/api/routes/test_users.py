import pytest

from app.core.security import hash_password
from app.models import User

pytestmark = pytest.mark.integration


def test_update_user_me(client, session):
    # create user
    user = User(
        email="test@example.com",
        hashed_password=hash_password("testpass123"),
        full_name="Test User",
        is_active=True,
        is_admin=False,
    )
    session.add(user)
    session.commit()

    # login
    login_res = client.post(
        "/api/v1/login/access-token",
        data={"username": "test@example.com", "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    # update me
    res = client.patch(
        "/api/v1/users/me",
        json={"full_name": "Updated Name"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
    assert res.json()["full_name"] == "Updated Name"


def test_patch_me_as_normal_user_does_not_422(client, session):
    user = User(
        email="u2@example.com",
        hashed_password=hash_password("testpass123"),
        full_name="U2",
        is_active=True,
        is_admin=False,
    )
    session.add(user)
    session.commit()
    login_res = client.post(
        "/api/v1/login/access-token",
        data={"username": "u2@example.com", "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    res = client.patch(
        "/api/v1/users/me",
        json={"full_name": "U2"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 200
