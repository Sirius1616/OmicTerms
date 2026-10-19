from sqlmodel import Session, select

from app import crud
from app.core.config import settings
from app.models import User, UserCreate, UserPublic


def create_super_user(session: Session) -> UserPublic:
    user = session.exec(select(User).where(User.email == settings.FIRST_SUPERUSER)).first()
    if user:
        return UserPublic.model_validate(user)
    new_user = UserCreate(
        email=settings.FIRST_SUPERUSER,
        password=settings.FIRST_SUPERUSER_PASSWORD,
        is_admin=True,
    )
    return crud.create_user(new_user, session)

