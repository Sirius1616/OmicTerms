"""Background extraction job triggered after a document upload."""

import json
import uuid
from pathlib import Path

from sqlmodel import Session

import app as app_pkg
from app.core.config import settings
from app.crud import engine
from app.models import Document, ExtractionStatus
from app.services.classification import classify
from app.services.extraction import extract_text

APP_ROOT = Path(app_pkg.__file__).resolve().parent.parent


def upload_dir() -> Path:
    """Repo-root uploads/ directory, mirroring how the upload route stores it."""
    return APP_ROOT / settings.UPLOAD_DIR


def run_document_extraction(document_id: uuid.UUID) -> None:
    """Extract a stored document and persist the result.

    Runs in a *fresh* session: FastAPI's BackgroundTasks executes this after the
    response has already been sent, at which point the request session is closed.
    """
    with Session(engine) as session:
        document = session.get(Document, document_id)
        if not document:
            return

        try:
            file_id = Path(document.file_url).name
            result = extract_text(str(upload_dir() / file_id))

            if result.structure is not None:
                payload: dict = result.structure
            else:
                payload = {"kind": result.kind, "text": result.text}

            document.raw_extracted_json = json.dumps(payload)
            document.extraction_status = ExtractionStatus.success

            if document.data_type is None:
                document.data_type = classify(
                    document.filename or "",
                    result.kind,
                    result.structure,
                )
        except Exception as exc:  # noqa: BLE001 - any failure must mark the doc failed
            document.extraction_status = ExtractionStatus.failed
            document.raw_extracted_json = json.dumps({"error": str(exc)})

        session.add(document)
        session.commit()