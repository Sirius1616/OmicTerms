from fastapi import APIRouter, Depends
from sqlmodel import col, func, select

from app.api.deps import SessionDep, get_current_admin_user
from app.models import (
    ExtractionJob,
    ExtractionJobStats,
    ExtractionJobStatus,
)

router = APIRouter(prefix="/jobs", tags=["jobs"])


def _count(session: SessionDep, status: ExtractionJobStatus) -> int:
    return session.exec(
        select(func.count())
        .select_from(ExtractionJob)
        .where(col(ExtractionJob.status) == status)
    ).one()


@router.get(
    "/stats",
    response_model=ExtractionJobStats,
    dependencies=[Depends(get_current_admin_user)],
)
def read_job_stats(session: SessionDep) -> ExtractionJobStats:
    pending = _count(session, ExtractionJobStatus.pending)
    running = _count(session, ExtractionJobStatus.running)
    succeeded = _count(session, ExtractionJobStatus.succeeded)
    failed = _count(session, ExtractionJobStatus.failed)
    return ExtractionJobStats(
        pending=pending,
        running=running,
        succeeded=succeeded,
        failed=failed,
        total=pending + running + succeeded + failed,
    )
