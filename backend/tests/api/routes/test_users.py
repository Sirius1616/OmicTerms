import uuid

import pytest

from app.core.security import hash_password
from app.models import User
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


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


def test_non_admin_cannot_patch_other_user(client, session):
    attacker = User(
        email="attacker@example.com",
        hashed_password=hash_password("testpass123"),
        is_active=True,
        is_admin=False,
    )
    victim = User(
        email="victim@example.com",
        hashed_password=hash_password("testpass123"),
        is_active=True,
        is_admin=False,
    )
    session.add(attacker)
    session.add(victim)
    session.commit()
    session.refresh(victim)

    login_res = client.post(
        "/api/v1/login/access-token",
        data={"username": "attacker@example.com", "password": "testpass123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]

    res = client.patch(
        f"/api/v1/users/{victim.id}",
        json={"full_name": "Compromised"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert res.status_code == 403


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


def test_signup_login_me_roundtrip(client, session):
    email = _email("signup")
    response = client.post(
        "/api/v1/users/signup",
        json={"email": email, "password": "testpass123", "full_name": "Signup User"},
    )
    assert response.status_code == 201, response.text

    headers = login_headers(client, email)
    response = client.get("/api/v1/users/me", headers=headers)
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == email
    assert body["full_name"] == "Signup User"
    assert body["is_active"] is True


def test_admin_user_crud(client, session):
    admin_email = _email("admin")
    create_user(session, admin_email, is_admin=True)
    admin = login_headers(client, admin_email)

    created_email = _email("created")
    response = client.post(
        "/api/v1/users/",
        json={
            "email": created_email,
            "password": "testpass123",
            "full_name": "Created User",
            "is_admin": False,
        },
        headers=admin,
    )
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]

    response = client.get("/api/v1/users/", headers=admin)
    assert response.status_code == 201
    assert any(user["id"] == user_id for user in response.json()["data"])

    assert client.get(f"/api/v1/users/{user_id}", headers=admin).status_code == 201

    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={"full_name": "Renamed User"},
        headers=admin,
    )
    assert response.status_code == 200
    assert response.json()["full_name"] == "Renamed User"

    assert client.delete(f"/api/v1/users/{user_id}", headers=admin).status_code == 200


def test_admin_update_user_password_rotates_credential(client, session):
    admin_email = _email("admin")
    create_user(session, admin_email, is_admin=True)
    admin = login_headers(client, admin_email)

    created_email = _email("created")
    response = client.post(
        "/api/v1/users/",
        json={
            "email": created_email,
            "password": "testpass123",
            "full_name": "Pw User",
            "is_admin": False,
        },
        headers=admin,
    )
    assert response.status_code == 201, response.text
    user_id = response.json()["id"]

    response = client.patch(
        f"/api/v1/users/{user_id}",
        json={"password": "rotatedpass456"},
        headers=admin,
    )
    assert response.status_code == 200, response.text

    form_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    new_login = client.post(
        "/api/v1/login/access-token",
        data={"username": created_email, "password": "rotatedpass456"},
        headers=form_headers,
    )
    assert new_login.status_code == 200, new_login.text

    stale_login = client.post(
        "/api/v1/login/access-token",
        data={"username": created_email, "password": "testpass123"},
        headers=form_headers,
    )
    assert stale_login.status_code == 401


def test_non_admin_cannot_use_admin_user_endpoints(client, session):
    email = _email("regular")
    create_user(session, email)
    headers = login_headers(client, email)

    response = client.post(
        "/api/v1/users/",
        json={"email": _email("sneaky"), "password": "testpass123"},
        headers=headers,
    )
    assert response.status_code == 403
    assert client.get("/api/v1/users/", headers=headers).status_code == 403
