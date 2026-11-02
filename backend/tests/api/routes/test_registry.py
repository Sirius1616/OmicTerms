"""Story 20 — tool and format registry.

The registry is a promise sheet: ``supported`` rows must have a working
parser (CI-checked against the extraction pipeline), ``planned`` rows must
exist without inventing capabilities, and the endpoints are paginated,
metadata-only, and available to every authenticated user.
"""

import uuid

import pytest
from sqlmodel import col, select

from app.models import (
    FormatDefinition,
    FormatDefinitionPublic,
    RegistrySupportStatus,
    ToolDefinition,
    ToolDefinitionPublic,
)
from app.services import extraction
from app.services.registry_seed import FORMAT_ROWS, TOOL_ROWS, seed_registry
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


@pytest.fixture()
def owner_headers(client, session):
    email = _email("registry")
    create_user(session, email)
    return login_headers(client, email)


@pytest.fixture()
def registry_seeded(session):
    seed_registry(session)


def test_registry_matches_extraction_reality(registry_seeded, session):
    """AC1 + integrity rule: ``supported`` claims match the real dispatch."""
    supported_parsers = {
        fmt.parser_id
        for fmt in session.exec(select(FormatDefinition)).all()
        if fmt.parser_id in extraction.SUPPORTED_PARSER_IDS
    }
    assert supported_parsers == set(extraction.SUPPORTED_PARSER_IDS)

    formats = session.exec(select(FormatDefinition)).all()
    for fmt in formats:
        assert fmt.parser_id in extraction.SUPPORTED_PARSER_IDS, fmt.extension
        assert fmt.extension in extraction.SUPPORTED_EXTENSIONS, fmt.extension

    supported_tools = session.exec(
        select(ToolDefinition).where(
            col(ToolDefinition.support_status) == RegistrySupportStatus.supported
        )
    ).all()
    for tool in supported_tools:
        for fmt in tool.input_formats:
            assert fmt in extraction.SUPPORTED_EXTENSIONS, (tool.name, fmt)


def test_tools_endpoint_paginated_and_status_filtered(owner_headers, client, registry_seeded):
    response = client.get("/api/v1/registry/tools", headers=owner_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == len(TOOL_ROWS)

    statuses = {tool["support_status"] for tool in body["data"]}
    assert "supported" in statuses
    assert "planned" in statuses

    planned = client.get(
        "/api/v1/registry/tools", headers=owner_headers, params={"status": "planned"}
    )
    assert planned.status_code == 200
    planned_body = planned.json()
    planned_names = {tool["name"] for tool in planned_body["data"]}
    assert planned_names == {"NanoVar", "MethMotif", "TFregulomeR", "forkedTF"}
    # Planned rows are promises: no invented input formats.
    for tool in planned_body["data"]:
        if tool["name"] != "NanoVar":
            assert tool["input_formats"] == []
            assert tool["internal_representation_mapping_id"] is None

    paged = client.get(
        "/api/v1/registry/tools",
        headers=owner_headers,
        params={"skip": 0, "limit": 2},
    )
    assert paged.status_code == 200
    assert len(paged.json()["data"]) == 2

    all_tools = client.get(
        "/api/v1/registry/tools", headers=owner_headers, params={"limit": 200}
    )
    rows = all_tools.json()["data"]
    # Deterministic across databases: supported first, then planned/
    # experimental; name-sorted within each group.
    statuses = [tool["support_status"] for tool in rows]
    assert statuses == sorted(
        statuses,
        key=lambda status: {"supported": 0, "experimental": 1, "planned": 2}[
            status
        ],
    )
    supported_names = [
        tool["name"] for tool in rows if tool["support_status"] == "supported"
    ]
    assert supported_names == sorted(supported_names)


def test_formats_endpoint_paginated(owner_headers, client, registry_seeded):
    response = client.get("/api/v1/registry/formats", headers=owner_headers)
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["count"] == len(FORMAT_ROWS)
    extensions = [fmt["extension"] for fmt in body["data"]]
    assert extensions == sorted(extensions)

    paged = client.get(
        "/api/v1/registry/formats",
        headers=owner_headers,
        params={"limit": 3},
    )
    assert len(paged.json()["data"]) == 3

    for fmt in body["data"]:
        FormatDefinitionPublic.model_validate(fmt)
    for tool in client.get(
        "/api/v1/registry/tools", headers=owner_headers
    ).json()["data"]:
        ToolDefinitionPublic.model_validate(tool)


def test_registry_requires_authentication(client):
    assert client.get("/api/v1/registry/tools").status_code in (401, 403)
    assert client.get("/api/v1/registry/formats").status_code in (401, 403)


def test_first_read_seeds_idempotently(owner_headers, client, session):
    """A fresh DB auto-seeds on first read; reads never duplicate rows."""
    first = client.get("/api/v1/registry/formats", headers=owner_headers)
    assert first.status_code == 200
    assert first.json()["count"] == len(FORMAT_ROWS)

    again = client.get("/api/v1/registry/formats", headers=owner_headers)
    assert again.json()["count"] == len(FORMAT_ROWS)

    assert (
        session.exec(
            select(FormatDefinition).where(
                col(FormatDefinition.extension) == ".vcf"
            )
        ).first()
        is not None
    )
