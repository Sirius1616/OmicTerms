"""Story 20 — registry seed data.

Single source of truth for the tool/format registry rows: the Alembic seed
migration and the CI truth-check test both consume these constants, so the
registry can only drift out of sync in one place — and any drift fails tests.

``FORMATS``/``TOOLS`` hold exactly what exists today (see
``app/services/extraction.py`` constants). Planned tools carry ``planned``
status and never invent capabilities.
"""

from __future__ import annotations

import uuid

from sqlmodel import Session, select

from app.models import FormatDefinition, ToolDefinition

FORMATS: list[dict[str, object]] = [
    {
        "extension": ".vcf",
        "media_type": "text/plain",
        "description": (
            "Variant Call Format: header meta lines plus the CHROM/POS/ID/"
            "REF/ALT/QUAL/FILTER/INFO/FORMAT columns; validated structurally "
            "and sniffed for variant structure."
        ),
        "parser_id": "vcf",
        "examples": ["chroms.vcf", "calls.vcf"],
    },
    {
        "extension": ".bed",
        "media_type": "text/plain",
        "description": (
            "Browser Extensible Data interval format: chrom/start/end with "
            "optional additional columns; track lines ignored."
        ),
        "parser_id": "bed",
        "examples": ["peaks.bed"],
    },
    {
        "extension": ".tsv",
        "media_type": "text/plain",
        "description": (
            "Tab-separated value matrix: expression/methylation counts keyed "
            "by feature id with sample columns; sniffed as a matrix."
        ),
        "parser_id": "matrix",
        "examples": ["counts.tsv"],
    },
    {
        "extension": ".csv",
        "media_type": "text/plain",
        "description": (
            "Comma-separated value matrix: the same structure contract as "
            ".tsv with comma delimiters."
        ),
        "parser_id": "matrix",
        "examples": ["counts.csv"],
    },
    {
        "extension": ".txt",
        "media_type": "text/plain",
        "description": (
            "Free plain text; kept as text content (the sniffers may still "
            "recognise a structured matrix/columns layout)."
        ),
        "parser_id": "text",
        "examples": ["notes.txt"],
    },
    {
        "extension": ".pdf",
        "media_type": "application/pdf",
        "description": "PDF documents: text extracted per page with pypdf.",
        "parser_id": "pdf",
        "examples": ["report.pdf"],
    },
    {
        "extension": ".docx",
        "media_type": (
            "application/vnd.openxmlformats-officedocument."
            "wordprocessingml.document"
        ),
        "description": (
            "Word documents: paragraphs and table cells extracted as text "
            "(also accepted when wrapped in a ZIP archive)."
        ),
        "parser_id": "docx",
        "examples": ["protocol.docx"],
    },
    {
        "extension": ".eml",
        "media_type": "message/rfc822",
        "description": "RFC 822 e-mail messages: the plain-text body is extracted.",
        "parser_id": "email",
        "examples": ["pipeline.eml"],
    },
    {
        "extension": ".png",
        "media_type": "image/png",
        "description": (
            "Raster images: OCR (tesseract) extracts text; also serves as "
            "the upload magic-byte contract for images."
        ),
        "parser_id": "image",
        "examples": ["scan.png"],
    },
    {
        "extension": ".jpg",
        "media_type": "image/jpeg",
        "description": "JPEG images: OCR (tesseract) extracts text.",
        "parser_id": "image",
        "examples": ["scan.jpg"],
    },
]

TOOLS: list[dict[str, object]] = [
    {
        "name": "OmicTerms extraction pipeline",
        "version_policy": "routes on the uploaded extension",
        "category": "extraction",
        "website_url": None,
        "docs_url": None,
        "input_formats": [
            ".pdf",
            ".png",
            ".jpg",
            ".jpeg",
            ".docx",
            ".eml",
            ".txt",
            ".tsv",
            ".csv",
            ".vcf",
            ".bed",
        ],
        "output_formats": ["text", "structured JSON"],
        "internal_representation_mapping_id": "extraction-pipeline:v1",
        "support_status": "supported",
        "notes": (
            "pypdf/tesseract/python-docx extractors plus the omics sniffers "
            "(VCF/BED/matrix)."
        ),
    },
    {
        "name": "OmicTerms format validators",
        "version_policy": "validator set version pinned per run",
        "category": "validation",
        "website_url": None,
        "docs_url": None,
        "input_formats": [".vcf", ".bed", ".tsv", ".csv"],
        "output_formats": ["validation issues"],
        "internal_representation_mapping_id": "validators:v1",
        "support_status": "supported",
        "notes": (
            "VCF/BED/matrix structural validators plus cross-file checks at "
            "experiment scope."
        ),
    },
    {
        "name": "NanoVar",
        "version_policy": "tool release pinned on import",
        "category": "variant-caller",
        "website_url": None,
        "docs_url": None,
        "input_formats": [".bam"],
        "output_formats": [".vcf"],
        "internal_representation_mapping_id": None,
        "support_status": "planned",
        "notes": "Planned long-read variant-caller support; not installed today.",
    },
    {
        "name": "MethMotif",
        "version_policy": "database snapshot pinned per import",
        "category": "methylation",
        "website_url": None,
        "docs_url": None,
        "input_formats": [],
        "output_formats": ["motif table"],
        "internal_representation_mapping_id": None,
        "support_status": "planned",
        "notes": "Planned TF-methylation reference import; not available yet.",
    },
    {
        "name": "TFregulomeR",
        "version_policy": "database snapshot pinned per import",
        "category": "tf-binding",
        "website_url": None,
        "docs_url": None,
        "input_formats": [],
        "output_formats": ["peak table"],
        "internal_representation_mapping_id": None,
        "support_status": "planned",
        "notes": "Planned regulatory reference import; not available yet.",
    },
    {
        "name": "forkedTF",
        "version_policy": "tool release pinned on import",
        "category": "tf-binding",
        "website_url": None,
        "docs_url": None,
        "input_formats": [],
        "output_formats": ["peak table"],
        "internal_representation_mapping_id": None,
        "support_status": "planned",
        "notes": "Planned footprinting/chip tooling support; not available yet.",
    },
]

FORMAT_ROWS = [dict(row) for row in FORMATS]
TOOL_ROWS = [dict(row) for row in TOOLS]


def seed_registry(session: Session) -> None:
    """Insert the seed rows (idempotent: skips rows that already exist)."""
    for row in FORMAT_ROWS:
        format_row = session.exec(
            select(FormatDefinition).where(
                FormatDefinition.extension == row["extension"]
            )
        ).first()
        if format_row is None:
            session.add(FormatDefinition(id=uuid.uuid4(), **row))
    for row in TOOL_ROWS:
        tool_row = session.exec(
            select(ToolDefinition).where(ToolDefinition.name == row["name"])
        ).first()
        if tool_row is None:
            session.add(ToolDefinition(id=uuid.uuid4(), **row))
    session.commit()
