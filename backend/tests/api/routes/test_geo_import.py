"""GEO adapter (Story 65).

Unit tests exercise the parser and the full import flow against recorded
real-response fixtures (GSE100001). Fixtures are real fetched content, not
invented data. The gated live test runs against the actual NCBI endpoint when
OMICTERMS_LIVE_GEO=1 and was verified live during implementation.
"""

import gzip
import os
import uuid
from pathlib import Path

import httpx
import pytest
from sqlmodel import select

from app.core.config import settings
from app.integration.repositories import geo
from app.models import (
    Experiment,
    ImportJob,
    Project,
    RepositoryImport,
    RepositoryImportStatus,
    Sample,
)
from tests.utils.user import create_user, login_headers

pytestmark = pytest.mark.integration

FIXTURES = Path(__file__).resolve().parents[2] / "fixtures"
MATRIX_FIXTURE = FIXTURES / "GSE100001_series_matrix.txt"
FPKM_FIXTURE = FIXTURES / "GSE100001_fpkm_head50.txt.gz"


def _email(prefix: str) -> str:
    return f"{prefix}-{uuid.uuid4().hex[:8]}@example.com"


def _user(client, session):
    email = _email("geo")
    create_user(session, email)
    headers = login_headers(client, email)
    return headers, email


@pytest.fixture()
def upload_env(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
    monkeypatch.setattr(
        "app.api.routes.documents.run_extraction_job", lambda job_id: None
    )
    return tmp_path


def _mock_client() -> geo.GeoClient:
    """Serves the recorded real GSE100001 responses (fixtures)."""
    matrix_bytes = gzip.compress(MATRIX_FIXTURE.read_bytes())
    fpkm_bytes = FPKM_FIXTURE.read_bytes()

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url.path)
        if "/matrix/" in url and url.endswith("series_matrix.txt.gz"):
            return httpx.Response(200, content=matrix_bytes)
        if url.endswith("GSE100001_genes-2.fpkm_tracking.gz"):
            return httpx.Response(200, content=fpkm_bytes)
        return httpx.Response(404)

    return geo.GeoClient(transport=httpx.MockTransport(handler))


def test_parse_series_matrix_on_real_fixture():
    series = geo.parse_series_matrix(MATRIX_FIXTURE.read_text())
    assert series.accession == "GSE100001"
    assert series.title.startswith("mRNA expression profiling")
    assert series.organism == "Rattus"
    assert series.platform_id == "GPL23576"
    assert series.pubmed_id == "29568121"
    assert len(series.samples) == 6
    assert series.samples[0].accession == "GSM2667647"
    assert series.samples[0].title == "NC1"
    assert series.samples[-1].accession == "GSM2667652"
    assert len(series.supplementary_files) == 1
    assert series.supplementary_files[0].startswith("https://ftp.ncbi.nlm.nih.gov/")
    assert series.supplementary_files[0].endswith("GSE100001_genes-2.fpkm_tracking.gz")


def test_parse_rejects_non_matrix_content():
    with pytest.raises(geo.GeoImportError):
        geo.parse_series_matrix("html error page")


def test_select_processed_file_prefers_tabular():
    series = geo.parse_series_matrix(MATRIX_FIXTURE.read_text())
    url = geo.select_processed_file(series)
    assert url is not None
    assert "fpkm_tracking" in url


def test_invalid_accession_rejected():
    with pytest.raises(geo.GeoImportError):
        geo.import_geo_series(
            session=None,  # type: ignore[arg-type]
            owner_id=uuid.uuid4(),
            accession="not-a-gse",
        )


def test_series_mismatch_fails_job(upload_env, session):
    owner_id = _create_user_row(session).id
    client = _mock_client()
    with pytest.raises(geo.GeoImportError):
        geo.import_geo_series(
            session,
            owner_id=owner_id,
            accession="GSE222222",
            http=client,
            upload_dir=str(upload_env),
        )
    imp = (
        session.exec(
            select(RepositoryImport).where(RepositoryImport.owner_id == owner_id)
        )
    ).one()
    assert imp.status == RepositoryImportStatus.failed
    job = session.exec(
        select(ImportJob).where(ImportJob.import_id == imp.id)
    ).one()
    assert job.status == "failed"
    assert "Series mismatch" in (job.last_error or "")


def test_http_error_fails_job(upload_env, session):
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    owner_id = _create_user_row(session).id
    with pytest.raises(geo.GeoImportError):
        geo.import_geo_series(
            session,
            owner_id=owner_id,
            accession="GSE100001",
            http=geo.GeoClient(transport=httpx.MockTransport(handler)),
            upload_dir=str(upload_env),
        )
    imp = (
        session.exec(
            select(RepositoryImport).where(RepositoryImport.owner_id == owner_id)
        )
    ).one()
    assert imp.status == RepositoryImportStatus.failed


def test_download_size_cap_enforced(upload_env, session):
    big_payload = b"x" * (settings.UPLOAD_MAX_SIZE + 10)

    def handler(request: httpx.Request) -> httpx.Response:
        path = str(request.url.path)
        if "matrix" in path:
            return httpx.Response(
                200, content=gzip.compress(MATRIX_FIXTURE.read_bytes())
            )
        return httpx.Response(200, content=big_payload)

    owner_id = _create_user_row(session).id
    with pytest.raises(geo.GeoImportError):
        geo.import_geo_series(
            session,
            owner_id=owner_id,
            accession="GSE100001",
            http=geo.GeoClient(transport=httpx.MockTransport(handler)),
            upload_dir=str(upload_env),
        )
    imp = (
        session.exec(
            select(RepositoryImport).where(RepositoryImport.owner_id == owner_id)
        )
    ).one()
    assert imp.status == RepositoryImportStatus.failed
    job = session.exec(
        select(ImportJob).where(ImportJob.import_id == imp.id)
    ).one()
    assert "size cap" in (job.last_error or "") or "too large" in (job.last_error or "")


def test_import_creates_project_experiment_samples_document(upload_env, session):
    user = _create_user_row(session)
    owner_id = user.id
    client = _mock_client()
    document = geo.import_geo_series(
        session,
        owner_id=owner_id,
        accession="GSE100001",
        http=client,
        upload_dir=str(upload_env),
    )

    assert document.source_repo == "geo"
    assert document.source_id == "GSE100001"
    assert document.source_url.endswith("GSE100001_genes-2.fpkm_tracking.gz")
    assert document.fetched_at is not None
    assert document.sha256
    assert document.size_bytes and document.size_bytes > 0

    imp = (
        session.exec(
            select(RepositoryImport).where(RepositoryImport.owner_id == owner_id)
        )
    ).one()
    assert imp.status == RepositoryImportStatus.succeeded
    assert imp.accession == "GSE100001"
    assert imp.metadata_json and "GSE100001" in imp.metadata_json
    assert imp.provenance_json and "import.origin" in imp.provenance_json

    job = session.exec(
        select(ImportJob).where(ImportJob.import_id == imp.id)
    ).one()
    assert job.status == "succeeded"
    assert job.downloaded_bytes == document.size_bytes

    project = (
        session.exec(select(Project).where(Project.user_id == owner_id))
    ).one()
    assert project.user_id == owner_id
    assert project.name == "GSE100001"

    experiment = (
        session.exec(
            select(Experiment).where(Experiment.project_id == project.id)
        )
    ).one()
    assert experiment.project_id == project.id
    assert experiment.name.startswith("GSE100001")

    samples = session.exec(
        select(Sample).where(Sample.experiment_id == experiment.id)
    ).all()
    sample_names = {s.name for s in samples}
    assert sample_names == {
        "GSM2667647",
        "GSM2667648",
        "GSM2667649",
        "GSM2667650",
        "GSM2667651",
        "GSM2667652",
    }
    assert document.sample_id in {s.id for s in samples}


def test_import_reuses_owned_project(upload_env, session):
    user = _create_user_row(session)
    project = Project(user_id=user.id, name="MyProject")
    session.add(project)
    session.commit()
    session.refresh(project)

    client = _mock_client()
    geo.import_geo_series(
        session,
        owner_id=user.id,
        accession="GSE100001",
        project_id=project.id,
        http=client,
        upload_dir=str(upload_env),
    )
    projects = session.exec(
        select(Project).where(Project.user_id == user.id)
    ).all()
    assert len(projects) == 1
    assert projects[0].name == "MyProject"
    experiment = (
        session.exec(
            select(Experiment).where(Experiment.project_id == project.id)
        )
    ).one()
    assert experiment.project_id == project.id


def _create_user_row(session):
    from app.core.security import hash_password
    from app.models import User

    email = _email("geo-owner")
    user = User(
        email=email,
        full_name="Geo Owner",
        hashed_password=hash_password("changethis123"),
        is_superuser=False,
    )
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


@pytest.mark.skipif(
    os.environ.get("OMICTERMS_LIVE_GEO") != "1",
    reason="Live repository access gated: set OMICTERMS_LIVE_GEO=1 to verify "
    "against the real NCBI endpoint (verified live during Story 65).",
)
def test_live_gse100001_import(upload_env, session):
    user = _create_user_row(session)
    document = geo.import_geo_series(
        session,
        owner_id=user.id,
        accession="GSE100001",
        upload_dir=str(upload_env),
    )
    assert document.source_id == "GSE100001"
    assert document.size_bytes and document.size_bytes > 0
