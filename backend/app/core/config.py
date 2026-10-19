import warnings
from typing import Annotated, Literal, Self

from pydantic import (
    AnyUrl,
    BeforeValidator,
    EmailStr,
    HttpUrl,
    PostgresDsn,
    computed_field,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict


def parse_cors(v: str) -> list[str] | str:
    if isinstance(v, str) and not v.startswith("[]"):
        return [i.strip() for i in v.split(",") if i.strip()]
    if isinstance(v, list | str):
        return v
    else:
        raise TypeError


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_ignore_empty=True, extra="ignore"
    )

    PROJECT_NAME: str = "OmicTerms"
    API_V1_STR: str = "/api/v1"
    UPLOAD_MAX_SIZE: int = 1024 * 1024 * 10
    UPLOAD_DIR: str = "uploads"
    ENVIRONMENT: Literal["local", "development", "production"] = "local"
    BACKEND_CORS_ORIGIN: Annotated[list[AnyUrl] | str, BeforeValidator(parse_cors)] = []
    FRONTEND_HOST: str = "http://localhost:5173"
    SENTRY_DSN: HttpUrl | None = None
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE: int = 60 * 60 * 24 * 8
    RESET_TOKEN_EXPIRE: int = 60 * 15

    @computed_field
    @property
    def all_cors_origin(self) -> list[str]:
        return [str(origin).rstrip("/") for origin in self.BACKEND_CORS_ORIGIN] + [
            self.FRONTEND_HOST
        ]

    DATABASE_PORT: int = 5432
    DATABASE_HOST: str
    DATABASE_USERNAME: str
    DATABASE_PASSWORD: str
    DATABASE_NAME: str

    @computed_field
    @property
    def DATABASE_URI(self) -> PostgresDsn:
        return PostgresDsn.build(
            scheme="postgresql+psycopg",
            host=self.DATABASE_HOST,
            username=self.DATABASE_USERNAME,
            password=self.DATABASE_PASSWORD,
            port=self.DATABASE_PORT,
            path=self.DATABASE_NAME,
        )

    SMTP_SSL: bool = True
    SMTP_TLS: bool = False
    SMTP_HOST: str | None = None
    SMTP_PORT: str | None = None
    SMTP_USER: str | None = None
    SMTP_PASSWORD: str | None = None
    EMAIL_FROM_EMAIL: EmailStr | None = None
    EMAIL_FROM_NAME: str | None = None

    @model_validator(mode="after")
    def _set_default_email(self) -> Self:
        if not self.EMAIL_FROM_NAME:
            self.EMAIL_FROM_NAME = self.PROJECT_NAME
        return self

    @computed_field
    @property
    def enable_email(self) -> bool:
        return bool(self.SMTP_HOST and self.EMAIL_FROM_EMAIL)

    EMAIL_TEST_USER: EmailStr = "test@example.com"
    FIRST_SUPERUSER: EmailStr
    FIRST_SUPERUSER_PASSWORD: str

    def _check_default_secret(self, var_name: str, value: str | None) -> None:
        if value == "change this":
            message = (
                f'The value of {var_name} is "change this"'
                "for security please change it, at least for deployment"
            )
            if self.ENVIRONMENT == "local":
                warnings.warn(message=message, stacklevel=1)
            else:
                raise TypeError(message)

    @model_validator(mode="after")
    def _enforce_non_default_secrets(self) -> Self:
        self._check_default_secret("SECRET_KEY", self.SECRET_KEY)
        self._check_default_secret("DATABASE_PASSWORD", self.DATABASE_PASSWORD)
        self._check_default_secret(
            "FIRST_SUPERUSER_PASSWORD", self.FIRST_SUPERUSER_PASSWORD
        )

        return self


settings = Settings()
