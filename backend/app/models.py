import uuid
from datetime import UTC, datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, EmailStr
from sqlalchemy import JSON, Column, Index
from sqlmodel import Field, Relationship, SQLModel


class ExtractionStatus(str, Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class DataType(str, Enum):
    expression = "expression"
    methylation = "methylation"
    variants = "variants"
    peaks = "peaks"
    document = "document"


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"


class ExtractionJobStatus(str, Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"


class ValidationSeverity(str, Enum):
    error = "error"
    warning = "warning"
    info = "info"
    skipped = "skipped"


class ValidationSubjectType(str, Enum):
    document = "document"
    dataset = "dataset"
    report = "report"
    experiment = "experiment"


class ValidationTrigger(str, Enum):
    upload = "upload"
    manual = "manual"
    dependency = "dependency"


class ExternalRepoType(str, Enum):
    geo = "geo"
    ena = "ena"
    sra = "sra"
    pride = "pride"


class RepositoryImportStatus(str, Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class ImportJobStatus(str, Enum):
    pending = "pending"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class ProvenanceActorType(str, Enum):
    user = "user"
    system = "system"
    job = "job"


class EvidenceEntityType(str, Enum):
    """What kind of record an evidence-graph node represents.

    ``run``, ``finding``, ``report`` and ``artifact`` are declared up front so
    the graph substrate is stable, but they are only materialised when their
    owning models exist (Stories 25, 30, 36). ``project`` is appended beyond
    the original Story 28 set because acceptance criterion (1) requires
    project nodes to auto-materialise and the enum could not represent them.
    """

    document = "document"
    run = "run"
    sample = "sample"
    experiment = "experiment"
    finding = "finding"
    report = "report"
    artifact = "artifact"
    project = "project"


class EvidenceRelation(str, Enum):
    """Relations used by evidence-graph edges; each has one meaning only.

    The first seven are Story 28's contract. ``belongs_to`` is the structural
    containment edge (document→sample, sample→experiment, experiment→project):
    Story 28's acceptance criteria require auto-materialised containment edges
    on upload, which the original relation set could not express without
    misusing ``derived_from``. Only ``supports`` and ``contradicts`` may be
    created manually by users.
    """

    derived_from = "derived_from"
    produced_by = "produced_by"
    supports = "supports"
    contradicts = "contradicts"
    reports_on = "reports_on"
    same_sample_as = "same_sample_as"
    input_to = "input_to"
    belongs_to = "belongs_to"


class EvidenceNode(SQLModel, table=True):
    """Materialised graph node for one scientific record (Story 28).

    Mirror rows: creation/removal happens in ``app/services/evidence.py``
    hooks, never by direct writes elsewhere. No foreign key to the entity
    tables — nodes and edges are derivable substrate, and the audit trail for
    deleted entities stays in ``provenanceevent``.
    """

    __table_args__ = (
        Index(
            "ix_evidencenode_entity_type_entity_id",
            "entity_type",
            "entity_id",
            unique=True,
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    entity_type: EvidenceEntityType
    entity_id: str = Field(max_length=64)
    label: str = Field(max_length=256)
    project_id: uuid.UUID | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class EvidenceEdge(SQLModel, table=True):
    """Typed relation between two evidence nodes (Story 28).

    Automatic edges (``belongs_to`` and the future run hooks) are structural;
    ``supports``/``contradicts`` are user-created, require an ``evidence_ref``
    and a note, and audit ``created_by``.
    """

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    source_id: uuid.UUID = Field(foreign_key="evidencenode.id", index=True)
    target_id: uuid.UUID = Field(foreign_key="evidencenode.id", index=True)
    relation: EvidenceRelation
    evidence_ref: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    created_by: uuid.UUID | None = Field(default=None, index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    note: str | None = Field(default=None, max_length=512)


class EvidenceNodePublic(SQLModel):
    id: uuid.UUID
    entity_type: EvidenceEntityType
    entity_id: str
    label: str
    project_id: uuid.UUID | None = None
    created_at: datetime


#  ------  ANALYSIS RUNS (Story 22)  --------


class AnalysisRunStatus(str, Enum):
    queued = "queued"
    running = "running"
    succeeded = "succeeded"
    failed = "failed"
    cancelled = "cancelled"


class AnalysisRun(SQLModel, table=True):
    """Execution record: what ran, with what, on what, producing what.

    Provenance backbone for the analysis module: ``input_refs``/``output_refs``
    carry document ids and sha256 hashes so any run's chain can be verified
    against upload integrity (Story 14). Missing metadata stays ``None`` —
    never a fake default — so later missing-provenance checks (Story 35) can
    flag it truthfully.

    Lifecycle is transition-guarded (see ``app/services/runs.py``): illegal
    state changes are rejected at the service boundary and races reject the
    loser via compare-and-set.
    """

    __table_args__ = (
        Index("ix_analysisrun_project_created", "project_id", "created_at"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    tool_name: str = Field(max_length=128)
    tool_version: str | None = Field(default=None, max_length=64)
    adapter_id: str | None = Field(default=None, max_length=128)
    parameters: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    config_hash: str | None = Field(default=None, max_length=64)
    input_refs: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    output_refs: list[dict[str, Any]] = Field(
        default_factory=list, sa_column=Column(JSON, nullable=False)
    )
    status: AnalysisRunStatus = AnalysisRunStatus.queued
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
    actor_user_id: uuid.UUID | None = Field(default=None, foreign_key="user.id")
    runtime_info: dict[str, Any] | None = Field(
        default=None, sa_column=Column(JSON, nullable=True)
    )
    notes: str | None = Field(default=None, max_length=512)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    project: Project = Relationship()


class AnalysisRunPublic(SQLModel):
    id: uuid.UUID
    project_id: uuid.UUID
    tool_name: str
    tool_version: str | None = None
    adapter_id: str | None = None
    parameters: dict[str, Any] = {}
    config_hash: str | None = None
    input_refs: list[dict[str, Any]] = []
    output_refs: list[dict[str, Any]] = []
    status: AnalysisRunStatus
    started_at: datetime | None = None
    finished_at: datetime | None = None
    actor_user_id: uuid.UUID | None = None
    runtime_info: dict[str, Any] | None = None
    notes: str | None = None
    created_at: datetime


class AnalysisRunCreate(SQLModel):
    """Run-record creation; no compute is triggered by this endpoint."""

    tool_name: str = Field(max_length=128)
    tool_version: str | None = Field(default=None, max_length=64)
    adapter_id: str | None = Field(default=None, max_length=128)
    parameters: dict[str, Any] = Field(default_factory=dict)
    config_hash: str | None = Field(default=None, max_length=64)
    input_refs: list[dict[str, Any]] = Field(default_factory=list)
    notes: str | None = Field(default=None, max_length=512)


class AnalysisRunsPublic(SQLModel):
    data: list[AnalysisRunPublic]
    count: int


class EvidenceGraphEdgePublic(SQLModel):
    id: uuid.UUID
    source_id: uuid.UUID
    target_id: uuid.UUID
    relation: EvidenceRelation
    evidence_ref: dict[str, Any] | None = None
    created_by: uuid.UUID | None = None
    created_at: datetime
    note: str | None = None


class EvidenceGraphPublic(SQLModel):
    """Bounded snapshot: the node cap is enforced server-side.

    ``truncated`` is true when the project has more nodes than fit into the
    response — callers must not silently assume they see everything.
    """

    nodes: list[EvidenceNodePublic] = []
    edges: list[EvidenceGraphEdgePublic] = []
    truncated: bool = False


class EvidenceEdgeCreate(SQLModel):
    """Manual linking between two existing nodes of the same project."""

    source_id: uuid.UUID
    target_id: uuid.UUID
    relation: EvidenceRelation
    note: str = Field(max_length=512, min_length=1)
    evidence_ref: dict[str, Any] | None = None


class ProvenanceEvent(SQLModel, table=True):
    """Append-only audit record of who did what to what, and when.

    ``project_id`` is intentionally a plain indexed UUID, not a foreign key:
    the audit trail must survive deletion of the project (and of users, whose
    ``actor_id`` is anonymised rather than history rewritten). Rows are never
    updated or deleted through the API; retention is documented in Story 61.
    """

    __table_args__ = (
        Index("ix_provenanceevent_project_occurred", "project_id", "occurred_at"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    project_id: uuid.UUID | None = Field(default=None, index=True)
    actor_type: ProvenanceActorType
    actor_id: uuid.UUID | None = Field(default=None, index=True)
    action: str = Field(max_length=64)
    entity_type: str = Field(max_length=64)
    entity_id: str = Field(max_length=64)
    payload: dict[str, Any] = Field(
        default_factory=dict, sa_column=Column(JSON, nullable=False)
    )
    occurred_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    request_id: str | None = Field(default=None, max_length=64)


class ProvenanceEventPublic(SQLModel):
    id: uuid.UUID
    project_id: uuid.UUID | None = None
    actor_type: ProvenanceActorType
    actor_id: uuid.UUID | None = None
    action: str
    entity_type: str
    entity_id: str
    payload: dict[str, Any] = {}
    occurred_at: datetime
    request_id: str | None = None


class ProvenanceEventsPublic(SQLModel):
    data: list[ProvenanceEventPublic]
    count: int


# ------ USER   --------


class UserBase(SQLModel):
    email: EmailStr = Field(unique=True, index=True, max_length=128, min_length=8)
    full_name: str | None = Field(default=None, max_length=128)
    is_active: bool = True
    is_admin: bool = False


class User(UserBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    hashed_password: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    projects: list[Project] = Relationship(back_populates="user")


# ---- inputs ----


class UserRegister(SQLModel):
    full_name: str | None = Field(default=None, max_length=128)
    email: EmailStr = Field(max_length=128, min_length=8)
    password: str = Field(min_length=8, max_length=128)


class UserCreate(UserBase):
    password: str = Field(min_length=8, max_length=128)


class UserUpdate(SQLModel):
    email: EmailStr | None = Field(default=None, max_length=128, min_length=8)
    full_name: str | None = Field(default=None, max_length=128)
    password: str | None = Field(default=None, min_length=8, max_length=128)
    is_admin: bool | None = None
    is_active: bool | None = None


class UserUpdateMe(SQLModel):
    full_name: str | None = Field(default=None, max_length=128)
    email: EmailStr | None = Field(default=None, max_length=128, min_length=8)


class UpdatePassword(SQLModel):
    current_password: str = Field(max_length=128, min_length=8)
    new_password: str = Field(min_length=8, max_length=128)


class NewPassword(SQLModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class UserPublic(UserBase):
    id: uuid.UUID
    created_at: datetime


class UsersPublic(SQLModel):
    data: list[UserPublic]
    count: int


#  ------  DOCUMENT  --------


class DocumentBase(SQLModel):
    file_url: str


class Document(DocumentBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    filename: str = Field(nullable=True, max_length=128, min_length=3)
    sample_id: uuid.UUID = Field(foreign_key="sample.id", index=True)
    uploaded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    extraction_status: ExtractionStatus = ExtractionStatus.pending
    data_type: DataType | None = None
    raw_extracted_json: str | None = None
    sha256: str | None = Field(nullable=True, max_length=64, min_length=64)
    size_bytes: int | None = Field(nullable=True, ge=0)
    source_repo: ExternalRepoType | None = None
    source_id: str | None = Field(default=None, max_length=256)
    source_url: str | None = Field(default=None, max_length=1024)
    fetched_at: datetime | None = Field(default=None)

    sample: Sample = Relationship(back_populates="documents")
    explanation: Explanation = Relationship(back_populates="document")
    conversations: list[Conversation] = Relationship(back_populates="document")
    validation_runs: list[ValidationRun] = Relationship(back_populates="document")


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(SQLModel):
    filename: str | None = Field(default=None, min_length=3, max_length=128)


class DocumentPublic(DocumentBase):
    id: uuid.UUID
    filename: str | None = None
    sample_id: uuid.UUID
    uploaded_at: datetime
    extraction_status: ExtractionStatus
    data_type: DataType | None = None
    sample_name: str | None = None
    experiment_name: str | None = None
    project_name: str | None = None
    sha256: str | None = None
    size_bytes: int | None = None
    source_repo: ExternalRepoType | None = None
    source_id: str | None = None
    source_url: str | None = None
    fetched_at: datetime | None = None


class DocumentsPublic(SQLModel):
    data: list[DocumentPublic]
    count: int


#  ------  VALIDATION  --------


class ValidationRun(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    subject_type: ValidationSubjectType = ValidationSubjectType.document
    subject_id: uuid.UUID = Field(index=True)
    document_id: uuid.UUID | None = Field(default=None, foreign_key="document.id", index=True)
    trigger: ValidationTrigger = ValidationTrigger.upload
    started_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    finished_at: datetime | None = Field(default=None)
    status: str = "succeeded"
    validator_set_version: str = "1.0"

    document: Document | None = Relationship(back_populates="validation_runs")
    issues: list[ValidationIssue] = Relationship(back_populates="run")


class ValidationIssue(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    run_id: uuid.UUID = Field(foreign_key="validationrun.id", index=True)
    code: str = Field(max_length=64)
    severity: ValidationSeverity = ValidationSeverity.info
    message: str
    detail: str | None = Field(default=None)
    field: str | None = Field(default=None)
    path: str | None = Field(default=None)
    suggestion: str | None = Field(default=None)
    dedup_key: str | None = Field(default=None, index=True)

    run: ValidationRun = Relationship(back_populates="issues")


class ValidationIssuePublic(SQLModel):
    id: uuid.UUID
    code: str
    severity: ValidationSeverity
    message: str
    detail: str | None = None
    field: str | None = None
    path: str | None = None
    suggestion: str | None = None
    dedup_key: str | None = None


class ValidationRunPublic(SQLModel):
    id: uuid.UUID
    subject_type: ValidationSubjectType
    subject_id: uuid.UUID
    document_id: uuid.UUID | None = None
    trigger: ValidationTrigger
    started_at: datetime
    finished_at: datetime | None = None
    status: str
    validator_set_version: str
    issues: list[ValidationIssuePublic] = []


class ValidationRunSummary(SQLModel):
    run_id: uuid.UUID | None = None
    errors: int = 0
    warnings: int = 0
    info: int = 0
    skipped: int = 0
    total: int = 0


class ValidationRunsPublic(SQLModel):
    data: list[ValidationRunPublic]
    count: int
    latest_summary: ValidationRunSummary | None = None


#  ------  EXTRACTION JOB  --------


class ExtractionJob(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    document_id: uuid.UUID = Field(foreign_key="document.id", index=True)
    status: ExtractionJobStatus = ExtractionJobStatus.pending
    attempts: int = 0
    last_error: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)


class ExtractionJobPublic(SQLModel):
    id: uuid.UUID
    document_id: uuid.UUID
    status: ExtractionJobStatus
    attempts: int
    last_error: str | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None


class ExtractionJobsPublic(SQLModel):
    data: list[ExtractionJobPublic]
    count: int


class ExtractionJobStats(SQLModel):
    pending: int = 0
    running: int = 0
    succeeded: int = 0
    failed: int = 0
    total: int = 0


# ------  EXPLANATION  --------


class Explanation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    document_id: uuid.UUID = Field(foreign_key="document.id", unique=True)
    summary_text: str
    generated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    document: Document = Relationship(back_populates="explanation")


class ExplanationPublic(SQLModel):
    id: uuid.UUID
    summary_text: str
    generated_at: datetime


#  ------ CONVERSATION  ------


class Conversation(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    document_id: uuid.UUID = Field(foreign_key="document.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    document: Document = Relationship(back_populates="conversations")
    messages: list[Message] = Relationship(back_populates="conversation")


class ConversationPublic(SQLModel):
    id: uuid.UUID
    document_id: uuid.UUID
    created_at: datetime


class ConversationsPublic(SQLModel):
    data: list[ConversationPublic]
    count: int


# ------ Message  -------


class Message(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    conversation_id: uuid.UUID = Field(foreign_key="conversation.id", index=True)
    role: MessageRole
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    conversation: Conversation = Relationship(back_populates="messages")


class MessageCreate(SQLModel):
    content: str


class MessagePublic(SQLModel):
    id: uuid.UUID
    role: MessageRole
    content: str
    created_at: datetime


# ------  Auth  -------


class Token(SQLModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(SQLModel):
    sub: str | None = None


class ResetToken(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id")
    is_used: bool = False


class AuthMessage(SQLModel):
    message: str


class Filter(BaseModel):
    skip: int = Field(default=0, ge=0)
    limit: int = Field(default=5, ge=1, le=100)
    order_by: str | None = None
    search: str | None = None
    descending: bool = False
    sha256: str | None = None


class Project(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    name: str = Field(max_length=128, min_length=3)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    description: str | None = Field(default=None)

    user: User = Relationship(back_populates="projects")
    experiments: list[Experiment] = Relationship(back_populates="project")


class Experiment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    name: str = Field(max_length=128, min_length=3)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    project: Project = Relationship(back_populates="experiments")
    samples: list[Sample] = Relationship(back_populates="experiment")


class Sample(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    name: str = Field(max_length=128, min_length=3)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    experiment_id: uuid.UUID = Field(foreign_key="experiment.id", index=True)

    experiment: Experiment = Relationship(back_populates="samples")
    documents: list[Document] = Relationship(back_populates="sample")


#  ------  PROJECT/EXPERIMENT/SAMPLE SCHEMAS  --------


class ProjectCreate(SQLModel):
    name: str = Field(max_length=128, min_length=3)
    description: str | None = Field(default=None)


class ProjectUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=128, min_length=3)
    description: str | None = Field(default=None)


class ProjectPublic(SQLModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    created_at: datetime


class ProjectsPublic(SQLModel):
    data: list[ProjectPublic]
    count: int


class ExperimentCreate(SQLModel):
    name: str = Field(max_length=128, min_length=3)


class ExperimentUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=128, min_length=3)


class ExperimentPublic(SQLModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    created_at: datetime


class ExperimentsPublic(SQLModel):
    data: list[ExperimentPublic]
    count: int


class SampleCreate(SQLModel):
    name: str = Field(max_length=128, min_length=3)


class SampleUpdate(SQLModel):
    name: str | None = Field(default=None, max_length=128, min_length=3)


class SamplePublic(SQLModel):
    id: uuid.UUID
    experiment_id: uuid.UUID
    name: str
    created_at: datetime


class SamplesPublic(SQLModel):
    data: list[SamplePublic]
    count: int


class SampleTreeNode(SQLModel):
    id: uuid.UUID
    name: str
    created_at: datetime


class ExperimentTreeNode(SQLModel):
    id: uuid.UUID
    project_id: uuid.UUID
    name: str
    created_at: datetime
    samples: list[SampleTreeNode] = []


class ProjectTreeNode(SQLModel):
    id: uuid.UUID
    name: str
    description: str | None = None
    created_at: datetime
    experiments: list[ExperimentTreeNode] = []


class ProjectTreePublic(SQLModel):
    data: list[ProjectTreeNode]
    count: int


#  ------  DATASET METADATA  --------


class CoordinateSystem(str, Enum):
    zero_based = "0-based"
    one_based = "1-based"
    unknown = "unknown"


class DatasetMetadataBase(SQLModel):
    genome_assembly: str | None = Field(
        default=None, max_length=64
    )
    coordinate_system: CoordinateSystem = CoordinateSystem.unknown
    source_tool: str | None = Field(default=None, max_length=128)
    source_tool_version: str | None = Field(default=None, max_length=64)
    reference_database: str | None = Field(default=None, max_length=128)
    declared_by: uuid.UUID | None = None


class DatasetMetadata(DatasetMetadataBase, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    document_id: uuid.UUID = Field(foreign_key="document.id", unique=True, index=True)
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    document: Document = Relationship()


class DatasetMetadataCreate(DatasetMetadataBase):
    pass


class DatasetMetadataUpdate(SQLModel):
    genome_assembly: str | None = Field(
        default=None, max_length=64
    )
    coordinate_system: CoordinateSystem | None = None
    source_tool: str | None = Field(default=None, max_length=128)
    source_tool_version: str | None = Field(default=None, max_length=64)
    reference_database: str | None = Field(default=None, max_length=128)


class DatasetMetadataPublic(DatasetMetadataBase):
    id: uuid.UUID
    document_id: uuid.UUID
    recorded_at: datetime
    declared_by: uuid.UUID | None = None


#  ------  PUBLIC REPOSITORY IMPORT  --------


class RepositoryImport(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    owner_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    project_id: uuid.UUID | None = Field(default=None, foreign_key="project.id", index=True)
    experiment_id: uuid.UUID | None = Field(default=None, foreign_key="experiment.id", index=True)
    repo: ExternalRepoType
    accession: str = Field(max_length=256)
    query: str | None = Field(default=None, max_length=512)
    status: RepositoryImportStatus = RepositoryImportStatus.pending
    metadata_json: str | None = Field(default=None)
    provenance_json: str | None = Field(default=None)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    owner: User = Relationship()
    project: Project | None = Relationship()
    experiment: Experiment | None = Relationship()
    import_jobs: list[ImportJob] = Relationship(back_populates="import_")


class ImportJob(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    import_id: uuid.UUID = Field(foreign_key="repositoryimport.id", index=True)
    status: ImportJobStatus = ImportJobStatus.pending
    attempts: int = Field(default=0, ge=0)
    last_error: str | None = Field(default=None)
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
    downloaded_bytes: int = Field(default=0, ge=0)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

    import_: RepositoryImport = Relationship(back_populates="import_jobs")


class RepositoryImportPublic(SQLModel):
    id: uuid.UUID
    owner_id: uuid.UUID
    project_id: uuid.UUID | None = None
    experiment_id: uuid.UUID | None = None
    repo: ExternalRepoType
    accession: str
    query: str | None = None
    status: RepositoryImportStatus
    metadata_json: str | None = None
    provenance_json: str | None = None
    created_at: datetime
    updated_at: datetime


class RepositoryImportsPublic(SQLModel):
    data: list[RepositoryImportPublic]
    count: int


class ImportJobPublic(SQLModel):
    id: uuid.UUID
    import_id: uuid.UUID
    status: ImportJobStatus
    attempts: int
    last_error: str | None = None
    started_at: datetime | None = None
    finished_at: datetime | None = None
    downloaded_bytes: int
    created_at: datetime


class ImportJobsPublic(SQLModel):
    data: list[ImportJobPublic]
    count: int
