from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from fastapi.security import OAuth2PasswordRequestForm

from app import crud
from app.api.deps import CurrentUser, SessionDep
from app.core.config import settings
from app.core.security import create_access_token
from app.models import AuthMessage, NewPassword, Token, UserPublic, UserUpdate
from app.utils import (
    create_password_reset_token,
    generate_password_reset_email,
    send_email,
    validate_password_reset_token,
)

router = APIRouter(tags=["auth"])


@router.post("/login/access-token", response_model=Token)
def login_access_token(session: SessionDep, form_data: Annotated[OAuth2PasswordRequestForm, Depends()]):
    user = crud.authenticate(session=session, email=form_data.username, password=form_data.password)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User is inactive")
    sub = user.email
    token = create_access_token(sub=sub, exp=timedelta(seconds=settings.ACCESS_TOKEN_EXPIRE))
    return Token(access_token=token)


@router.post("/login/test-token", response_model=UserPublic)
def test_token(current_user: CurrentUser) -> UserPublic:

    return UserPublic.model_validate(current_user)


@router.post("/password-recovery/{email}")
def recover_password(email: str, session: SessionDep) -> AuthMessage:
    user = crud.get_user_by_email(session=session, email=email)
    if user:
        token = create_password_reset_token(email=email)
        email_data = generate_password_reset_email(email=email, 
                                                   email_to=user.email, 
                                                   token=token)
        send_email(email_to=user.email,
                   subject=email_data.subject,
                   html_content=email_data.html_content)
        return AuthMessage(message="Reset token is sent to your mail")
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND, detail="User does not exist"
    )


@router.post("/reset-password")
def reset_password(session: SessionDep, password_update: NewPassword) -> AuthMessage:
    user_email = validate_password_reset_token(token=password_update.token)
    if not user_email:
        raise HTTPException(status_code=404, detail="Invalid token")
    user = crud.get_user_by_email(session, user_email)
    if not user:
        raise HTTPException(status_code=404, detail="Invalid token")
    user_in = UserUpdate(password=password_update.new_password)
    crud.user_update(session=session, 
                     user_in=user_in, 
                     db_user=user)
    return AuthMessage(message="Password updated successfully")


@router.post("/password-recovery-html-content/{email}")
def recover_password_html(email: str, session: SessionDep) -> HTMLResponse:
    user = crud.get_user_by_email(email=email, session=session)
    if not user:
        raise HTTPException(status_code=404, detail="User does not exist on the server")
    token = create_password_reset_token(email=email)
    email_data = generate_password_reset_email(email=email, email_to=user.email, token=token)
    return HTMLResponse(content=email_data.html_content, 
                        headers={"subject": email_data.subject})

