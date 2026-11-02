"""Story 20 — tool and format registry endpoints.

Metadata only, paginated, no ownership model: any authenticated user can
read the registry (guest read is not exposed by default). The registry's
``supported`` claims are CI-checked against the extraction pipeline, so the
endpoints never promise a capability the code can't exercise.
"""

from fastapi import APIRouter, Query
from sqlmodel import col, func, select

from app.api.deps import CurrentUser, SessionDep
from app.models import (
    FormatDefinition,
    FormatDefinitionPublic,
    FormatsPublic,
    RegistrySupportStatus,
    ToolDefinition,
    ToolDefinitionPublic,
    ToolsPublic,
)
from app.services.registry_seed import seed_registry

router = APIRouter(prefix="/registry", tags=["registry"])

STATUS_QUERY = Query(default=None)


@router.get("/tools", response_model=ToolsPublic)
def list_tools(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
    status: RegistrySupportStatus | None = STATUS_QUERY,
) -> ToolsPublic:
    """Seed once on first read so a fresh deployment reports real rows."""
    query = select(ToolDefinition)
    if session.exec(select(func.count()).select_from(ToolDefinition)).one() == 0:
        seed_registry(session)
    if status is not None:
        query = query.where(col(ToolDefinition.support_status) == status)
    count = session.exec(
        select(func.count()).select_from(query.subquery())
    ).one()
    statement = (
        query.order_by(
            (col(ToolDefinition.support_status) == RegistrySupportStatus.supported).desc(),
            (col(ToolDefinition.support_status) == RegistrySupportStatus.experimental).desc(),
            col(ToolDefinition.name),
        )
        .offset(skip)
        .limit(limit)
    )
    data = [
        ToolDefinitionPublic.model_validate(tool)
        for tool in session.exec(statement).all()
    ]
    return ToolsPublic(data=data, count=count)


@router.get("/formats", response_model=FormatsPublic)
def list_formats(
    session: SessionDep,
    current_user: CurrentUser,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=200),
) -> FormatsPublic:
    if session.exec(select(func.count()).select_from(FormatDefinition)).one() == 0:
        seed_registry(session)
    count = session.exec(
        select(func.count()).select_from(FormatDefinition)
    ).one()
    statement = (
        select(FormatDefinition)
        .order_by(col(FormatDefinition.extension))
        .offset(skip)
        .limit(limit)
    )
    data = [
        FormatDefinitionPublic.model_validate(fmt)
        for fmt in session.exec(statement).all()
    ]
    return FormatsPublic(data=data, count=count)
