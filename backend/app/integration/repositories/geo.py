"""GEO (Gene Expression Omnibus) repository adapter.

Pilot: import one authentic public GEO series (GSE100001) with its study
metadata and a processed supplementary file. Data is fetched over HTTPS from
the public NCBI FTP mirror, checksummed on arrival, and mapped into the
Project -> Experiment -> Sample hierarchy. Repository responses are preserved
verbatim wherever possible; nothing is invented.
"""

from __future__ import annotations

import gzip
import hashlib
import json
import re
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

import httpx
from sqlmodel import Session, select

from app.core.config import settings
from app.models import (
    DataType,
    Document,
    Experiment,
    ExternalRepoType,
    ImportJob,
    Project,
    Sample,
)
from app.services import import_jobs as jobsvc
from app.services import provenance

GEO_BASE = "https://ftp.ncbi.nlm.nih.gov/geo/series/"
_RATE_INTERVAL_SECONDS = 0.34
_ACCESSION_RE = re.compile(r"^GSE\d+$")
_PROCESSED_RE = re.compile(r"\.(tsv|csv|txt)(\.gz)?$|fpkm", re.IGNORECASE)


class GeoImportError(Exception):
    """Raised when GEO content cannot be fetched, parsed, or imported."""


@dataclass
class GeoSample:
    accession: str
    title: str


@dataclass
class GeoSeries:
    accession: str
    title: str
    summary: str
    organism: str
    platform_id: str
    pubmed_id: str | None
    supplementary_files: list[str] = field(default_factory=list)
    samples: list[GeoSample] = field(default_factory=list)


def series_prefix(accession: str) -> str:
    """GSE100001 -> GSE100nnn (NCBI FTP family directory)."""
    digits = accession[3:]
    return f"{accession[: len(accession) - len(digits)]}{digits[:-3]}nnn"


def to_https_url(geo_url: str) -> str:
    if geo_url.startswith("ftp://ftp.ncbi.nlm.nih.gov/"):
        return "https://ftp.ncbi.nlm.nih.gov/" + geo_url[len("ftp://ftp.ncbi.nlm.nih.gov/") :]
    return geo_url


class GeoClient:
    """HTTPS client for the public GEO FTP mirror with a local rate cap."""

    def __init__(self, transport: httpx.BaseTransport | None = None) -> None:
        self._http = httpx.Client(
            base_url=GEO_BASE,
            timeout=httpx.Timeout(30.0, read=120.0),
            transport=transport,
            follow_redirects=True,
        )
        self._last_request = 0.0

    def _respect_rate_cap(self) -> None:
        elapsed = time.monotonic() - self._last_request
        if elapsed < _RATE_INTERVAL_SECONDS:
            time.sleep(_RATE_INTERVAL_SECONDS - elapsed)
        self._last_request = time.monotonic()

    def get(self, path: str) -> httpx.Response:
        self._respect_rate_cap()
        response = self._http.get(path)
        response.raise_for_status()
        return response

    def fetch_series_matrix(self, accession: str) -> str:
        response = self.get(
            f"{series_prefix(accession)}/{accession}"
            f"/matrix/{accession}_series_matrix.txt.gz"
        )
        try:
            return gzip.decompress(response.content).decode("utf-8", errors="replace")
        except (OSError, UnicodeError) as exc:
            raise GeoImportError(f"Cannot decompress series matrix: {exc}") from exc

    def download_file(self, url: str, dest: Path, max_bytes: int) -> tuple[str, int]:
        local_path = url.removeprefix(GEO_BASE)
        digest = hashlib.sha256()
        size = 0
        dest.parent.mkdir(parents=True, exist_ok=True)
        with self._http.stream("GET", local_path) as response:
            response.raise_for_status()
            content_length = response.headers.get("content-length")
            if content_length and int(content_length) > max_bytes:
                raise GeoImportError(
                    f"Remote file too large: {content_length} > {max_bytes} bytes"
                )
            with dest.open("wb") as buffer:
                for chunk in response.iter_bytes(chunk_size=1024 * 1024):
                    size += len(chunk)
                    if size > max_bytes:
                        buffer.close()
                        dest.unlink(missing_ok=True)
                        raise GeoImportError("Download exceeded size cap")
                    buffer.write(chunk)
                    digest.update(chunk)
        return digest.hexdigest(), size


def parse_series_matrix(text: str) -> GeoSeries:
    if not text.lstrip().startswith("!"):
        raise GeoImportError("Not a GEO series matrix file")
    series_fields: dict[str, str] = {}
    supplementary: list[str] = []
    sample_accessions: list[str] = []
    sample_titles: list[str] = []
    organism = ""
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("!"):
            continue
        if stripped in ("!series_matrix_table_begin", "!series_matrix_table_end",
                        "!sample_table_begin", "!sample_table_end"):
            continue
        parts = stripped[1:].split("\t")
        key = parts[0]
        values = [v.strip().strip('"').strip() for v in parts[1:]]
        key = key.removeprefix("!")
        if key == "Series_supplementary_file":
            supplementary.extend(v for v in values if v and v != "NONE")
        elif key in ("Series_geo_accession", "Series_title", "Series_summary",
                     "Series_platform_id", "Series_pubmed_id"):
            series_fields[key] = values[0] if values else ""
        elif key == "Sample_geo_accession":
            sample_accessions.extend(v for v in values if v)
        elif key == "Sample_title":
            sample_titles.extend(v for v in values if v)
        elif key == "Sample_organism_ch1" and not organism and values:
            organism = values[0]
    accession = series_fields.get("Series_geo_accession", "")
    if not accession:
        raise GeoImportError("Series matrix missing accession")
    if not sample_accessions:
        raise GeoImportError("Series matrix missing sample accessions")
    return GeoSeries(
        accession=accession,
        title=series_fields.get("Series_title", ""),
        summary=series_fields.get("Series_summary", ""),
        organism=organism,
        platform_id=series_fields.get("Series_platform_id", ""),
        pubmed_id=series_fields.get("Series_pubmed_id") or None,
        supplementary_files=[to_https_url(u) for u in supplementary],
        samples=[
            GeoSample(
                accession=acc,
                title=sample_titles[i] if i < len(sample_titles) else acc,
            )
            for i, acc in enumerate(sample_accessions)
        ],
    )


def select_processed_file(series: GeoSeries) -> str | None:
    candidates = [u for u in series.supplementary_files if _PROCESSED_RE.search(u)]
    if candidates:
        return candidates[0]
    return series.supplementary_files[0] if series.supplementary_files else None


def _upload_root(upload_dir: str | None) -> Path:
    root = Path(upload_dir or settings.UPLOAD_DIR)
    if not root.is_absolute():
        root = Path(__file__).resolve().parents[2] / root
    return root


def _hierarchy_for(
    session: Session, owner_id: uuid.UUID, series: GeoSeries, project_id: uuid.UUID | None
) -> tuple[Project, Experiment]:
    project: Project | None = None
    if project_id is not None:
        statement = (
            select(Project)
            .where(Project.id == project_id)
            .where(Project.user_id == owner_id)
        )
        project = session.exec(statement).first()
        if project is None:
            raise GeoImportError("Project not found for owner")
    if project is None:
        project = Project(
            user_id=owner_id,
            name=series.accession,
            description=series.title or None,
        )
        session.add(project)
        session.flush()
    experiment_name = f"{series.accession} {series.title}".strip() or series.accession
    experiment = session.exec(
        select(Experiment)
        .where(Experiment.project_id == project.id)
        .where(Experiment.name == experiment_name)
    ).first()
    if experiment is None:
        experiment = Experiment(project_id=project.id, name=experiment_name)
        session.add(experiment)
        session.flush()
    return project, experiment


def _samples_for(
    session: Session, experiment: Experiment, series: GeoSeries
) -> list[Sample]:
    existing = session.exec(
        select(Sample).where(Sample.experiment_id == experiment.id)
    ).all()
    by_name = {s.name: s for s in existing}
    samples: list[Sample] = []
    for geo_sample in series.samples:
        name = geo_sample.accession
        sample = by_name.get(name)
        if sample is None:
            sample = Sample(experiment_id=experiment.id, name=name)
            session.add(sample)
            session.flush()
        samples.append(sample)
    return samples


def import_geo_series(
    session: Session,
    *,
    owner_id: uuid.UUID,
    accession: str,
    project_id: uuid.UUID | None = None,
    http: GeoClient | None = None,
    upload_dir: str | None = None,
    max_bytes: int | None = None,
) -> Document:
    """Import a public GEO series into OmicTerms.

    Fetches the series matrix and one processed supplementary file, stores the
    metadata in RepositoryImport.metadata_json, maps the series into the
    Project -> Experiment -> Sample hierarchy, records the file as a Document
    with checksum and repository origin, and completes the ImportJob.
    """
    if not _ACCESSION_RE.match(accession or ""):
        raise GeoImportError("Invalid GEO accession")
    client = http or GeoClient()
    cap = (
        max_bytes
        if max_bytes is not None
        else min(settings.UPLOAD_MAX_SIZE, 20 * 1024 * 1024)
    )

    imp = jobsvc.create_import(
        session, owner_id=owner_id, repo=ExternalRepoType.geo, accession=accession
    )
    job = session.exec(
        select(ImportJob).where(ImportJob.import_id == imp.id)
    ).first()
    if job is None:
        raise GeoImportError("Import job missing")
    claimed = jobsvc.claim_job(session, job.id)
    if claimed is None:
        raise GeoImportError("Import job cannot be claimed")

    try:
        matrix_text = client.fetch_series_matrix(accession)
        series = parse_series_matrix(matrix_text)
        if series.accession != accession:
            raise GeoImportError(
                f"Series mismatch: requested {accession}, fetched {series.accession}"
            )

        fetched_at = datetime.now(UTC).isoformat()
        imp.metadata_json = json.dumps(
            {
                "accession": series.accession,
                "title": series.title,
                "summary": series.summary,
                "organism": series.organism,
                "platform_id": series.platform_id,
                "pubmed_id": series.pubmed_id,
                "samples": [s.accession for s in series.samples],
                "supplementary_files": series.supplementary_files,
                "matrix_url": (
                    f"{GEO_BASE}{series_prefix(accession)}/{accession}"
                    f"/matrix/{accession}_series_matrix.txt.gz"
                ),
                "fetched_at": fetched_at,
                "source": "geo-series-matrix",
            },
            ensure_ascii=False,
        )
        imp.updated_at = datetime.now(UTC)
        session.add(imp)
        session.commit()

        _, experiment = _hierarchy_for(session, owner_id, series, project_id)
        samples = _samples_for(session, experiment, series)
        if not samples:
            raise GeoImportError("No samples mapped")

        processed_url = select_processed_file(series)
        if processed_url is None:
            raise GeoImportError("No processed supplementary file listed")
        root = _upload_root(upload_dir)
        filename = processed_url.rsplit("/", 1)[-1]
        dest = root / f"{uuid.uuid4()}-{filename}"
        sha256, size = client.download_file(processed_url, dest, cap)

        file_url = f"{settings.API_V1_STR}/{settings.UPLOAD_DIR}/{dest.name}"
        document = Document(
            file_url=file_url,
            sample_id=samples[0].id,
            filename=filename,
            data_type=DataType.expression,
            sha256=sha256,
            size_bytes=size,
            source_repo=ExternalRepoType.geo,
            source_id=series.accession,
            source_url=processed_url,
            fetched_at=datetime.now(UTC),
        )
        session.add(document)
        imp.provenance_json = json.dumps(
            {
                "type": "import.origin",
                "repo": "geo",
                "accession": series.accession,
                "source_urls": [processed_url],
                "fetched_at": fetched_at,
            },
            ensure_ascii=False,
        )
        session.add(imp)
        session.commit()
        session.refresh(document)

        downloaded_bytes = jobsvc.complete_job(session, job.id, downloaded_bytes=size)
        if downloaded_bytes is None:
            raise GeoImportError("Import job could not be completed")

        provenance.record_import_origin(
            repo="geo",
            accession=series.accession,
            source_urls=[processed_url],
            import_id=str(imp.id),
            job_id=str(job.id),
            fetched_at=fetched_at,
        )
        return document
    except GeoImportError as exc:
        jobsvc.fail_job(session, job.id, str(exc))
        raise
    except httpx.HTTPError as exc:
        jobsvc.fail_job(session, job.id, f"HTTP error: {exc}")
        raise GeoImportError(f"HTTP error: {exc}") from exc
