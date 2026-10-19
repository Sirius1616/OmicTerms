import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlmodel import col, func, select

from app import crud
from app.api.deps import CurrentUser, SessionDep, get_current_admin_user
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.models import (
    AuthMessage,
    Filter,
    UpdatePassword,
    User,
    UserCreate,
    UserPublic,
    UserRegister,
    UsersPublic,
    UserUpdate,
    UserUpdateMe,
)
from app.utils import generete_new_account_email, send_email

router = APIRouter(prefix="/users", tags=["user"])

Filters = Annotated[Filter, Query()]


@router.post(
    "/",
    response_model=UserPublic,
    dependencies=[Depends(get_current_admin_user)],
    status_code=201,
)
def create_user(session: SessionDep, user_in: UserCreate) -> UserPublic:
    db_user = session.exec(select(User).where(User.email == user_in.email)).first()
    if db_user:
        raise HTTPException(status_code=302, detail="user already exist, please login")
    new_user = crud.create_user(create_user=user_in, session=session)
    if settings.enable_email and user_in.email:
        email_data = generete_new_account_email(
            email_to=user_in.email, password=user_in.password, username=user_in.email
        )
        send_email(
            email_to=user_in.email,
            subject=email_data.subject,
            html_content=email_data.html_content,
        )
    return new_user


@router.post("/signup", response_model=UserPublic, status_code=201)
def register_new_user(session: SessionDep, user_in: UserRegister) -> UserPublic:
    db_user = crud.get_user_by_email(session=session, email=user_in.email)
    if db_user:
        raise HTTPException(
            status_code=302, detail="email already exist, please go to login"
        )
    new_user = UserCreate.model_validate(user_in)
    user = crud.create_user(new_user, session)
    return UserPublic.model_validate(user)


@router.get(
    "/",
    dependencies=[Depends(get_current_admin_user)],
    response_model=UsersPublic,
    status_code=201,
)
def read_users(session: SessionDep, filters: Filters) -> UsersPublic:
    count = session.exec(select(func.count()).select_from(User)).one()
    statement = (
        select(User)
        .order_by(col(User.created_at).desc())
        .offset(filters.skip)
        .limit(filters.limit)
    )
    db_users = session.exec(statement).all()
    users = [UserPublic.model_validate(user) for user in db_users]
    return UsersPublic(data=users, count=count)


@router.get("/me", status_code=201, response_model=UserPublic)
def read_me(current_user: CurrentUser) -> UserPublic:

    return UserPublic.model_validate(current_user)


@router.patch("/me", response_model=UserPublic)
def update_user_me(
    session: SessionDep, user_in: UserUpdateMe, current_user: CurrentUser
) -> UserPublic:
    if user_in.email:
        db_user = session.exec(select(User).where(User.email == user_in.email)).first()
        if db_user and db_user.id != current_user.id:
            raise HTTPException(
                status_code=302, detail="user with this email already exist!"
            )
    user_data = user_in.model_dump(exclude_unset=True)
    user_update = current_user.sqlmodel_update(user_data)
    session.add(user_update)
    session.commit()
    session.refresh(user_update)
    return UserPublic.model_validate(user_update)


@router.get("/{user_id}", status_code=201, response_model=UserPublic)
def read_user_by_id(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> UserPublic:
    user = session.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="user not found")
    if user_id == current_user.id:
        return UserPublic.model_validate(user)
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="You cannot access this resource")
    return UserPublic.model_validate(user)


@router.patch(
    "/{user_id}",
    response_model=UserPublic,
    dependencies=[Depends(get_current_admin_user)],
)
def update_user(
    session: SessionDep,
    user_id: uuid.UUID,
    user_in: UserUpdate,
) -> UserPublic:
    user_in_db = session.get(User, user_id)
    if not user_in_db:
        raise HTTPException(status_code=404, detail="user not found")
    if user_in.email:
        existing_user = crud.get_user_by_email(session, user_in.email)
        if existing_user and existing_user.id != user_id:
            raise HTTPException(status_code=302, detail="email belongs to another user")
    updated_user = crud.user_update(
        session=session, user_in=user_in, db_user=user_in_db
    )
    return updated_user


@router.patch("/me/password", response_model=AuthMessage)
def update_password(
    session: SessionDep, password_data: UpdatePassword, current_user: CurrentUser
) -> AuthMessage:

    verified, _ = verify_password(
        plain_password=password_data.current_password,
        hashed_password=current_user.hashed_password,
    )
    if not verified:
        raise HTTPException(status_code=401, detail="Password incorrect")
    if password_data.current_password == password_data.new_password:
        raise HTTPException(status_code=403, detail="Please enter a different password")
    hashed_password = hash_password(password_data.new_password)
    new_data = {"hashed_password": hashed_password}
    user = current_user.sqlmodel_update(new_data)
    session.add(user)
    session.commit()
    session.refresh(user)
    return AuthMessage(message="Password updated successfully")


@router.delete("/me", status_code=200)
def delete_user_me(session: SessionDep, current_user: CurrentUser) -> AuthMessage:
    if current_user.is_admin:
        raise HTTPException(
            status_code=403, detail="Superuser is not allowed to delete themselves"
        )
    session.delete(current_user)
    session.commit()
    return AuthMessage(message="User deleted successfully")


@router.delete(
    "/{user_id}", dependencies=[Depends(get_current_admin_user)], status_code=200
)
def delete_user(
    session: SessionDep, current_user: CurrentUser, user_id: uuid.UUID
) -> AuthMessage:
    db_user = session.get(User, user_id)
    if not db_user:
        raise HTTPException(status_code=404, detail="User with cannot be found")
    if db_user.id == current_user.id:
        raise HTTPException(
            status_code=403, detail="A superuser cannot delete themselves"
        )
    session.delete(db_user)
    session.commit()
    return AuthMessage(message="User deleted successfully")
