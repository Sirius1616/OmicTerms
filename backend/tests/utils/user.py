"""Shared helpers for creating and authenticating users in integration tests."""

from fastapi.testclient import TestClient
from sqlmodel import Session

from app.core.security import hash_password
from app.models import User

DEFAULT_PASSWORD = "testpass123"


def create_user(
    session: Session,
    email: str,
    password: str = DEFAULT_PASSWORD,
    *,
    is_admin: bool = False,
    full_name: str | None = None,
) -> User:
    user = User(
        email=email,
        hashed_password=hash_password(password),
        full_name=full_name,
        is_active=True,
        is_admin=is_admin,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def login_headers(
    client: TestClient, email: str, password: str = DEFAULT_PASSWORD
) -> dict[str, str]:
    response = client.post(
        "/api/v1/login/access-token",
        data={"username": email, "password": password},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert response.status_code == 200, response.text
    return {"Authorization": f"Bearer {response.json()['access_token']}"}
