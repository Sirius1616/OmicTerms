import os
from collections.abc import Generator

os.environ.setdefault("EXTRACTION_POLLER_ENABLED", "false")

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, SQLModel, create_engine
from sqlmodel.pool import StaticPool

from app.crud import get_session
from app.main import app

DATABASE_URL = os.getenv("TEST_DATABASE_URL") or "sqlite:///:memory:"

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(
    DATABASE_URL, connect_args=connect_args, poolclass=StaticPool, echo=False
)


@pytest.fixture(scope="session", autouse=True)
def create_db_and_tables() -> Generator[None]:
    SQLModel.metadata.create_all(engine)
    yield
    SQLModel.metadata.drop_all(engine)


@pytest.fixture()
def session() -> Generator[Session]:
    with Session(engine) as session:
        yield session


@pytest.fixture()
def client(session: Session) -> Generator[TestClient]:
    def get_session_override():
        yield session

    app.dependency_overrides[get_session] = get_session_override
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
