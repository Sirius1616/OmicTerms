import uuid
from datetime import datetime, UTC
from enum import Enum
from pydantic import BaseModel

from pydantic import EmailStr
from sqlmodel import SQLModel, Relationship, Field


class ExtractionStatus(str, Enum):
    pending = "pending"
    success = "success"
    failed = "failed"


class MessageRole(str, Enum):
    user = "user"
    assistant = "assistant"



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
    raw_extracted_json: str | None = None

    sample: Sample = Relationship(back_populates="documents")
    explanation: "Explanation" = Relationship(back_populates="document")
    conversations: list["Conversation"] = Relationship(back_populates="document")


class DocumentCreate(DocumentBase):
    pass


class DocumentUpdate(SQLModel):
    filename: str | None = Field(default=None, min_length=3, max_length=128)


class DocumentPublic(DocumentBase):
    id: uuid.UUID
    filename: str | None = None
    uploaded_at: datetime
    extraction_status: ExtractionStatus


class DocumentsPublic(SQLModel):
    data: list[DocumentPublic]
    count: int



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
    messages: list["Message"] = Relationship(back_populates="conversation")


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


class Project(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    user_id: uuid.UUID = Field(foreign_key="user.id", index=True)
    name: str = Field(max_length=128, min_length=3)
    created_at: datetime = Field(default_factory=lambda:datetime.now(UTC))
    description: str | None = Field(default=None)

    user: User = Relationship(back_populates="projects")
    experiments: list[Experiment] = Relationship(back_populates="project")

class Experiment(SQLModel, table=True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    name: str = Field(max_length=128, min_length=3)
    project_id: uuid.UUID = Field(foreign_key="project.id", index=True)
    created_at: datetime = Field(default_factory=lambda:datetime.now(UTC))

    project: Project = Relationship(back_populates="experiments")
    samples: list[Sample] = Relationship(back_populates="experiment")

class Sample(SQLModel, table= True):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True, index=True)
    name: str = Field(max_length=128, min_length=3)
    created_at: datetime = Field(default_factory=lambda:datetime.now(UTC))
    experiment_id: uuid.UUID = Field(foreign_key="experiment.id", index=True)

    experiment: Experiment = Relationship(back_populates="samples")
    documents: list[Document] = Relationship(back_populates="sample")


