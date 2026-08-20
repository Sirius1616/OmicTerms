import uuid
from sqlalchemy import create_engine
from sqlmodel import Session, select
from app.core.config import settings
from collections.abc import Generator
from app.models import (UserCreate, User, UserPublic,
                        UserUpdate, UserUpdateMe, Document, 
                        Sample, Experiment, Project)
from pydantic import EmailStr
from typing import Annotated
from fastapi import Depends
from sqlmodel import create_engine
from app.core.security import hash_password, verify_password


engine = create_engine(str(settings.DATABASE_URI))

def get_session() -> Generator[Session]:
    with Session(engine) as session:
        yield session

SessionDep = Annotated[Session, Depends(get_session)]


DUMMY_HASH = "$argon2id$v=19$m=65536,t=3,p=4$MjQyZWE1MzBjYjJlZTI0Yw$YTU4NGM5ZTZmYjE2NzZlZjY0ZWY3ZGRkY2U2OWFjNjk"

def get_user_by_email(session: SessionDep, 
                      email: EmailStr
                      ) -> User:
    user = session.exec(select(User).where(User.email == email)).first()
    if not user:
        return None
    return user


def create_user(create_user: UserCreate, 
                session: SessionDep
                ) -> UserPublic:
    password_hash = hash_password(create_user.password)
    extra_data = {"hashed_password": password_hash}
    new_user = User.model_validate(create_user, update=extra_data)
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


def update_user_me(session: SessionDep, 
                   user_in: UserUpdateMe, db_user: User, 
                   ) -> UserPublic:
    update_data = user_in.model_dump(exclude_unset=True)
    user_update = db_user.sqlmodel_update(
        update_data
    )
    session.add(user_update)
    session.commit()
    session.refresh(user_update)
    return user_update


def user_update(session: SessionDep, 
                user_in: UserUpdate, db_user: User, 
                ) -> UserPublic:
    update_data = user_in.model_dump(exclude_unset=True)
    user_update = db_user.sqlmodel_update(
        update_data
        )
    session.add(user_update)
    session.commit()
    session.refresh(user_update)
    return user_update


def delete_user(session: SessionDep, email: EmailStr) -> None:
    user = get_user_by_email(session, email)
    if not user:
        return None
    session.delete(user)
    session.commit()


def authenticate(session: SessionDep, 
                 email: EmailStr, 
                 password: str) -> User:
    user = get_user_by_email(session, email)
    if not user:
        check_password = verify_password(password, DUMMY_HASH)
        return None
    db_hashed = user.hashed_password
    _verified, updated_password_hash = verify_password(password, db_hashed)
    if not _verified:
        return None
    if updated_password_hash:
        user.hashed_password = updated_password_hash
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def get_sample_owned_by(session: Session, user_id: uuid.UUID, sample_id: uuid.UUID) -> Sample | None:
    statement = (select(Sample)
                        .join(Experiment, Experiment.id == Sample.experiment_id)
                        .join(Project, Project.id == Experiment.project_id)
                        .where(Sample.id == sample_id)
                        .where(Project.user_id == user_id)
                        )
    sample = session.exec(statement).first()
    return sample


def get_doc_owned_by(session: Session, user_id: uuid.UUID, doc: Document) -> bool:
    return get_sample_owned_by(session, user_id, doc.sample_id)


def get_sample_owned_by(session: Session, user_id: uuid.UUID, sample_id: uuid.UUID) -> Sample | None:
    statement = (select(Sample)
                        .join(Experiment, Experiment.id == Sample.experiment_id)
                        .join(Project, Project.id == Experiment.project_id)
                        .where(Sample.id == sample_id)
                        .where(Project.user_id == user_id)
                        )
    sample = session.exec(statement).first()
    return sample



