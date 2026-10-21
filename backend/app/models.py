import uuid
from datetime import UTC, datetime
from enum import Enum

from pydantic import BaseModel, EmailStr
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


class ValidationTrigger(str, Enum):
    upload = "upload"
    manual = "manual"
    dependency = "dependency"


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

    sample: Sample = Relationship(back_populates="documents")
    explanation: Explanation = Relationship(back_populates="document")
    conversations: list[Conversation] = Relationship(back_populates="document")
    validation_runs: list["ValidationRun"] = Relationship(back_populates="document")


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
    issues: list["ValidationIssue"] = Relationship(back_populates="run")


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


class ValidationRunsPublic(SQLModel):
    data: list[ValidationRunPublic]
    count: int


class ValidationRunSummary(SQLModel):
    run_id: uuid.UUID | None = None
    errors: int = 0
    warnings: int = 0
    info: int = 0
    skipped: int = 0
    total: int = 0


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
