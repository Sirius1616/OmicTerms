"""Story 22 — AnalysisRun execution records.

Status transitions are compare-and-set guarded: only legal moves are accepted
and the ``WHERE status = <expected>`` clause rejects the loser of any race, so
two completers can never both flip the same run. Refs (inputs/outputs) carry
document ids plus sha256 values from upload integrity, giving every run a
verifiable chain to its source artifacts.
"""

import uuid
from datetime import UTC, datetime
from typing import Any, cast

from sqlalchemy import CursorResult, update
from sqlmodel import Session, col

from app.models import (
    AnalysisRun,
    AnalysisRunStatus,
    Project,
    ProvenanceActorType,
)
from app.services import provenance

# Legal lifecycle moves. Anything else — including direct jumps to terminal
# states — is rejected at the service boundary.
_ALLOWED_TRANSITIONS: dict[AnalysisRunStatus, set[AnalysisRunStatus]] = {
    AnalysisRunStatus.queued: {
        AnalysisRunStatus.running,
        AnalysisRunStatus.cancelled,
    },
    AnalysisRunStatus.running: {
        AnalysisRunStatus.succeeded,
        AnalysisRunStatus.failed,
        AnalysisRunStatus.cancelled,
    },
}


def _now() -> datetime:
    return datetime.now(UTC)


def create_run(
    session: Session,
    project: Project,
    *,
    tool_name: str,
    tool_version: str | None,
    adapter_id: str | None,
    parameters: dict[str, Any],
    config_hash: str | None,
    input_refs: list[dict[str, Any]],
    output_refs: list[dict[str, Any]] | None = None,
    actor_user_id: uuid.UUID | None,
    actor_type: ProvenanceActorType = ProvenanceActorType.user,
    runtime_info: dict[str, Any] | None = None,
    notes: str | None = None,
) -> AnalysisRun:
    run = AnalysisRun(
        project_id=project.id,
        tool_name=tool_name,
        tool_version=tool_version,
        adapter_id=adapter_id,
        parameters=parameters,
        config_hash=config_hash,
        input_refs=input_refs,
        output_refs=output_refs or [],
        actor_user_id=actor_user_id,
        runtime_info=runtime_info,
        notes=notes,
    )
    session.add(run)
    session.commit()
    session.refresh(run)

    from app.services import evidence

    evidence.materialise_run(session, run)
    provenance.record(
        session,
        project_id=project.id,
        action="run.created",
        entity_type="analysis_run",
        entity_id=str(run.id),
        actor_type=actor_type,
        actor_id=actor_user_id,
        payload={
            "tool_name": tool_name,
            "input_refs": [ref.get("document_id") for ref in input_refs],
        },
    )
    return run


def transition(
    session: Session,
    run: AnalysisRun,
    from_status: AnalysisRunStatus,
    to_status: AnalysisRunStatus,
    *,
    finished_at: datetime | None = None,
) -> bool:
    """Attempt ``run: from_status → to_status`` as a compare-and-set.

    Returns ``True`` when the run moved, ``False`` when the move is illegal
    (e.g. ``queued → succeeded``) or lost to a race (status no longer
    ``from_status``). Never raises for a rejected move.
    """
    if to_status not in _ALLOWED_TRANSITIONS.get(from_status, set()):
        return False
    values: dict[str, Any] = {"status": to_status}
    if to_status == AnalysisRunStatus.running:
        values["started_at"] = _now()
    if finished_at is not None or to_status in _TERMINAL:
        values["finished_at"] = finished_at or _now()
    result = cast(
        CursorResult[Any],
        session.execute(
            update(AnalysisRun)
            .where(
                col(AnalysisRun.id) == run.id,
                col(AnalysisRun.status) == from_status,
            )
            .values(**values),
        ),
    )
    session.commit()
    return result.rowcount == 1


_TERMINAL = {
    AnalysisRunStatus.succeeded,
    AnalysisRunStatus.failed,
    AnalysisRunStatus.cancelled,
}


def start_run(
    session: Session,
    run: AnalysisRun,
    *,
    actor_id: uuid.UUID | None = None,
    actor_type: ProvenanceActorType = ProvenanceActorType.job,
) -> bool:
    moved = transition(session, run, AnalysisRunStatus.queued, AnalysisRunStatus.running)
    if moved:
        _record_status_event(
            session, run, "run.started", actor_id=actor_id, actor_type=actor_type
        )
    return moved


def complete_run(
    session: Session,
    run: AnalysisRun,
    *,
    output_refs: list[dict[str, Any]] | None = None,
    actor_id: uuid.UUID | None = None,
    actor_type: ProvenanceActorType = ProvenanceActorType.job,
) -> AnalysisRun | None:
    """Move running → succeeded, attach output refs, emit the produced edges."""
    moved = transition(
        session,
        run,
        AnalysisRunStatus.running,
        AnalysisRunStatus.succeeded,
    )
    if not moved:
        return None
    if output_refs is not None:
        run.output_refs = output_refs
        session.add(run)
        session.commit()
        session.refresh(run)
    from app.services import evidence

    evidence.materialise_run_outputs(session, run)
    _record_status_event(
        session, run, "run.succeeded", actor_id=actor_id, actor_type=actor_type
    )
    return run


def fail_run(
    session: Session,
    run: AnalysisRun,
    *,
    actor_id: uuid.UUID | None = None,
    actor_type: ProvenanceActorType = ProvenanceActorType.job,
) -> bool:
    moved = transition(session, run, AnalysisRunStatus.running, AnalysisRunStatus.failed)
    if moved:
        _record_status_event(
            session, run, "run.failed", actor_id=actor_id, actor_type=actor_type
        )
    return moved


def cancel_run(
    session: Session,
    run: AnalysisRun,
    actor_id: uuid.UUID | None = None,
) -> AnalysisRun:
    """Cooperative cancel from queued or running; no process is killed."""
    if not transition(session, run, run.status, AnalysisRunStatus.cancelled):
        return run
    _record_status_event(
        session,
        run,
        "run.cancelled",
        actor_id=actor_id,
        actor_type=ProvenanceActorType.user,
    )
    return run


def _record_status_event(
    session: Session,
    run: AnalysisRun,
    action: str,
    *,
    actor_id: uuid.UUID | None,
    actor_type: ProvenanceActorType = ProvenanceActorType.user,
) -> None:
    provenance.record(
        session,
        project_id=run.project_id,
        action=action,
        entity_type="analysis_run",
        entity_id=str(run.id),
        actor_type=actor_type,
        actor_id=actor_id,
        payload={"status": run.status.value},
    )
