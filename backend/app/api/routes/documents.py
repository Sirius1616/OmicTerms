import os
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Form, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.models import (
    Document,
    DocumentPublic,
    DocumentsPublic,
    DocumentUpdate,
    Experiment,
    Filter,
    Project,
    Sample,
)
from app.services.extraction_job import run_document_extraction

router = APIRouter(prefix="/documents", tags=["documents"])
upload_router = APIRouter(prefix="/uploads", tags=["uploads"])

Filters = Annotated[Filter, Query()]


def _to_public(doc: Document, names: tuple[str, str, str] | None) -> DocumentPublic:
    project_name, experiment_name, sample_name = names if names else (None, None, None)
    return DocumentPublic(
        id=doc.id,
        file_url=doc.file_url,
        filename=doc.filename,
        sample_id=doc.sample_id,
        uploaded_at=doc.uploaded_at,
        extraction_status=doc.extraction_status,
        project_name=project_name,
        experiment_name=experiment_name,
        sample_name=sample_name,
    )


def _doc_names(
    session: SessionDep, sample_id: uuid.UUID
) -> tuple[str, str, str] | None:
    return session.exec(
        select(Project.name, Experiment.name, Sample.name)
        .join(Experiment, Experiment.id == Sample.experiment_id)
        .join(Project, Project.id == Experiment.project_id)
        .where(Sample.id == sample_id)
    ).first()


def _doc_names_map(
    session: SessionDep, documents: list[Document]
) -> dict[uuid.UUID, tuple[str, str, str]]:
    if not documents:
        return {}
    sample_ids = {doc.sample_id for doc in documents}
    rows = session.exec(
        select(Sample.id, Project.name, Experiment.name, Sample.name)
        .join(Experiment, Experiment.id == Sample.experiment_id)
        .join(Project, Project.id == Experiment.project_id)
        .where(Sample.id.in_(sample_ids))
    ).all()
    return {row[0]: (row[1], row[2], row[3]) for row in rows}


@router.post("/", response_model=DocumentPublic, status_code=201)
async def create_document(
    session: SessionDep,
    current_user: CurrentUser,
    file: UploadFile,
    sample_id: Annotated[str, Form()],
    background_tasks: BackgroundTasks,
) -> DocumentPublic:

    MAGIC = {
        b"%PDF-": "pdf",  # PDF
        b"\x89PNG\r": "png",  # PNG
        b"\xff\xd8\xff": "jpeg",  # JPEG
        b"PK\x03\x04": "zip",  # docx / xlsx are zips
    }
    await file.seek(0)
    sample = await file.read(1024)
    await file.seek(0)
    matched_sig = next((sig for sig in MAGIC if sample.startswith(sig)), None)

    TEXT_EXT = {".txt", ".eml", ".tsv", ".csv", ".vcf", ".bed"}
    stored_ext = os.path.splitext(file.filename)[1].lower()
    is_text = stored_ext in TEXT_EXT and b"\x00" not in sample
    if matched_sig is None and not is_text:
        raise HTTPException(status_code=415, detail="Invalid file format")

    try:
        sample_uuid = uuid.UUID(sample_id)
    except ValueError:
        raise HTTPException(status_code=422, detail="Invalid sample id")

    owned_sample = crud.get_sample_owned_by(session, current_user.id, sample_uuid)
    if not owned_sample:
        raise HTTPException(status_code=403, detail="Sample not found")

    ext = f".{MAGIC[matched_sig]}" if matched_sig else stored_ext

    file_id = f"{uuid.uuid4()}{ext}"

    filepath = (
        Path(__file__).parent.parent.parent.parent / f"{settings.UPLOAD_DIR}/{file_id}"
    )
    filepath.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    with filepath.open("wb") as buffer:
        while chunk := await file.read(1024 * 1024):
            buffer.write(chunk)
            size += len(chunk)
            if size > settings.UPLOAD_MAX_SIZE:
                break
        if size > settings.UPLOAD_MAX_SIZE:
            filepath.unlink(missing_ok=True)
            raise HTTPException(status_code=413, detail="File too large")

    file_url = f"{settings.API_V1_STR}/{settings.UPLOAD_DIR}/{file_id}"

    document = Document(
        file_url=file_url, sample_id=sample_uuid, filename=file.filename
    )

    session.add(document)
    session.commit()
    session.refresh(document)
    background_tasks.add_task(run_document_extraction, document.id)
    return _to_public(document, _doc_names(session, document.sample_id))


@router.get("/", response_model=DocumentsPublic)
def read_documents(
    session: SessionDep, current_user: CurrentUser, filters: Filters
) -> DocumentsPublic:
    count = session.exec(
        select(func.count())
        .select_from(Document)
        .join(Sample, Sample.id == Document.sample_id)
        .join(Experiment, Experiment.id == Sample.experiment_id)
        .join(Project, Project.id == Experiment.project_id)
        .where(Project.user_id == current_user.id)
    ).one()
    statement = (
        select(Document)
        .join(Sample, Sample.id == Document.sample_id)
        .join(Experiment, Experiment.id == Sample.experiment_id)
        .join(Project, Project.id == Experiment.project_id)
        .where(Project.user_id == current_user.id)
        .order_by(col(Document.uploaded_at).desc())
        .offset(filters.skip)
        .limit(filters.limit)
    )
    documents = session.exec(statement).all()
    names_map = _doc_names_map(session, documents)
    docs = [_to_public(doc, names_map.get(doc.sample_id)) for doc in documents]
    return DocumentsPublic(data=docs, count=count)


@upload_router.get("/{file_id}")
def read_document(
    session: SessionDep, current_user: CurrentUser, file_id: str
) -> FileResponse:
    upload_dir = (
        Path(__file__).parent.parent.parent.parent / settings.UPLOAD_DIR
    ).resolve()
    file_path = (upload_dir / file_id).resolve()

    if not file_path.is_relative_to(upload_dir):
        raise HTTPException(status_code=404, detail="Invalid file path")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_url = f"{settings.API_V1_STR}/{settings.UPLOAD_DIR}/{file_id}"
    file = session.exec(select(Document).where(Document.file_url == file_url)).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found on the server")
    if not crud.get_doc_owned_by(session, current_user.id, file):
        raise HTTPException(status_code=403, detail="Forbidden")
    return FileResponse(path=file_path)


@router.delete("/{id}", status_code=204)
def delete_file(session: SessionDep, current_user: CurrentUser, id: str) -> None:
    doc = session.get(Document, uuid.UUID(id)) if is_valid_uuid(id) else None
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    if not crud.get_doc_owned_by(session, current_user.id, doc):
        raise HTTPException(status_code=403, detail="Forbidden")

    upload_dir = (
        Path(__file__).parent.parent.parent.parent / settings.UPLOAD_DIR
    ).resolve()
    file_id = Path(doc.file_url).name

    file_path = (upload_dir / file_id).resolve()
    if not file_path.is_relative_to(upload_dir):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if file_path.exists():
        file_path.unlink()

    crud.delete_documents(session, [doc.id])
    session.commit()


@router.patch("/{id}", response_model=DocumentPublic)
def change_filename(
    session: SessionDep,
    current_user: CurrentUser,
    id: uuid.UUID,
    document_in: DocumentUpdate,
) -> DocumentPublic:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Requested document not found")
    if not crud.get_doc_owned_by(session, current_user.id, doc):
        raise HTTPException(status_code=403, detail="Forbidden")
    document_data = document_in.model_dump(exclude_unset=True)
    document = doc.sqlmodel_update(document_data)
    session.add(document)
    session.commit()
    session.refresh(document)
    return _to_public(document, _doc_names(session, document.sample_id))


@router.get("/{id}", response_model=DocumentPublic)
def read_doc(
    session: SessionDep, current_user: CurrentUser, id: uuid.UUID
) -> DocumentPublic:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="document not found")
    if not crud.get_doc_owned_by(session, current_user.id, doc):
        raise HTTPException(status_code=403, detail="Forbidden")
    return _to_public(doc, _doc_names(session, doc.sample_id))


def is_valid_uuid(value: str) -> bool:
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False
