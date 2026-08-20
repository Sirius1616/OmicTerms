from app.models import (DocumentPublic, Document, ExtractionStatus, DocumentsPublic, 
                        Filter, DocumentUpdate, Sample, Experiment, Project)
from fastapi import UploadFile, Form, APIRouter, HTTPException, Query
from app.api.deps import SessionDep, CurrentUser
from fastapi.responses import FileResponse
from sqlmodel import select, func, col
from app.core.config import settings
from typing import Annotated
from pathlib import Path
import shutil
import uuid
import os


router = APIRouter(prefix="/documents", tags=["documents"])
upload_router = APIRouter(prefix="/uploads", tags=["uploads"])

Filters = Annotated[Filter, Query()]


@router.post("/", response_model=DocumentPublic, status_code=201)
async def create_document(
    session: SessionDep, 
    current_user: CurrentUser, 
    file: UploadFile,
    ) -> DocumentPublic:
    
    MAGIC = {
        b"%PDF-": "pdf",          # PDF
        b"\x89PNG\r": "png",      # PNG
        b"\xff\xd8\xff": "jpeg",  # JPEG
        b"PK\x03\x04": "zip",     # docx / xlsx are zips
        }
    await file.seek(0)
    sample = await file.read(1024)
    await file.seek(0)
    matched_sig = next((sig for sig in MAGIC if sample.startswith(sig)), None)

    TEXT_EXT = {".txt", ".eml"}
    stored_ext = os.path.splitext(file.filename)[1].lower()
    is_text = stored_ext in TEXT_EXT and b"\x00" not in sample
    if matched_sig is None and not is_text:
        raise HTTPException(status_code=415, detail="Invalid file format")

    ext = f".{MAGIC[matched_sig]}" if matched_sig else stored_ext 

    file_id = f"{uuid.uuid4()}{ext}"
    
    filepath = Path(__file__).parent.parent.parent.parent/f"{settings.UPLOAD_DIR}/{file_id}"
    filepath.parent.mkdir(parents=True, exist_ok=True)

    size = 0
    with filepath.open("wb") as buffer:
        while chunk := await file.read(1024*1024):
            buffer.write(chunk)
            size += len(chunk)
            if size > settings.UPLOAD_MAX_SIZE:
                break
        if size > settings.UPLOAD_MAX_SIZE:
            filepath.unlink(missing_ok=True)
            raise HTTPException(status_code=413, detail="File too large")

    file_url = f"{settings.API_V1_STR}/{settings.UPLOAD_DIR}/{file_id}"

    samples = session.exec(select(Sample))

    document = Document(file_url=file_url, 
                        sample_id=Document.sample.id,
                        filename=file.filename
                        )

    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.get("/", response_model=DocumentsPublic)
def read_documents(session: SessionDep, current_user: CurrentUser, filters: Filters) -> DocumentsPublic:
    count = session.exec(select(func.count()).select_from(Document).where(Document.user_id == current_user.id)).one()
    statement = select(Document).order_by(col(Document.uploaded_at).desc()).offset(
         filters.skip).limit(filters.limit).where(Document.user_id == current_user.id)
    document = session.exec(statement=statement).all()
    docs = [DocumentPublic.model_validate(doc) for doc in document]
    documents = DocumentsPublic(data=docs, count=count)

    return documents


@upload_router.get("/{file_id}")
def read_document(session: SessionDep, current_user: CurrentUser, file_id: str) -> FileResponse:
    upload_dir = (Path(__file__).parent.parent.parent.parent/settings.UPLOAD_DIR).resolve()
    file_path = (upload_dir/file_id).resolve()

    if not file_path.is_relative_to(upload_dir):
        raise HTTPException(status_code=404, detail="Invalid file path")
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_url = f"{settings.API_V1_STR}/{settings.UPLOAD_DIR}/{file_id}"
    file = session.exec(select(Document).where(Document.file_url == file_url
                                               ).where(Document.user_id == current_user.id)).first()
    if not file:
        raise HTTPException(status_code=404, detail="File not found on the server")
    return FileResponse(path=file_path)


@router.delete("/{id}", status_code=204)
def delete_file(session: SessionDep, current_user: CurrentUser, id: str) -> None:
    doc = session.exec(select(Document).
                       where(Document.id == id).
                       where(Document.user_id == current_user.id)).first()
    if not doc:
        raise HTTPException(status_code=404, detail="File not found")
    
    upload_dir = (Path(__file__).parent.parent.parent.parent/settings.UPLOAD_DIR).resolve()
    file_id = Path(doc.file_url).name

    file_path = (upload_dir/file_id).resolve()
    if not file_path.is_relative_to(upload_dir):
        raise HTTPException(status_code=400, detail="Invalid filename")

    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File path does not exist")
    file_path.unlink()

    session.delete(doc)
    session.commit()

@router.patch("/{id}", response_model=DocumentPublic)
def change_filename(session: SessionDep, 
                    current_user: CurrentUser, 
                    id: uuid.UUID, document_in: DocumentUpdate) -> DocumentPublic:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="Requested document not found")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")
    document_data = document_in.model_dump(exclude_unset=True)
    document = doc.sqlmodel_update(document_data)
    session.add(document)
    session.commit()
    session.refresh(document)
    return document


@router.get("/{id}", response_model=DocumentPublic)
def read_doc(session: SessionDep, current_user: CurrentUser, id: uuid.UUID) -> DocumentPublic:
    doc = session.get(Document, id)
    if not doc:
        raise HTTPException(status_code=404, detail="document not found")
    if doc.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="forbidden")
    return doc