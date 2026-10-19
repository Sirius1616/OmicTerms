from datetime import UTC, datetime, timedelta
from typing import Any

import jwt
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher
from pwdlib.hashers.bcrypt import BcryptHasher

from app.core.config import settings

hasher = PasswordHash(
    (
        Argon2Hasher(),
        BcryptHasher(),
    )
)


def hash_password(password: str) -> str:
    return hasher.hash(password)


def verify_password(
    plain_password: str, hashed_password: str
) -> tuple[bool, str | None]:
    return hasher.verify_and_update(plain_password, hashed_password)


def create_access_token(sub: str | Any, exp: timedelta) -> str:
    expire = exp + datetime.now(UTC)
    payload = {"sub": str(sub), "exp": expire}
    token = jwt.encode(
        payload=payload, algorithm=settings.ALGORITHM, key=settings.SECRET_KEY
    )
    return token
