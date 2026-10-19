import logging
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

import emails
import jwt
from jinja2 import Template
from jwt.exceptions import InvalidTokenError

from app.core.config import settings

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class EmailData:
    html_content: str
    subject: str


def render_email_template(template_name: str, context: dict[str, Any]) -> str:
    template_str = (
        Path(__file__).parent / "email-templates" / "build" / template_name
    ).read_text()
    html_content = Template(template_str).render(context)
    return html_content


def send_email(email_to: str, subject: str = "", html_content: str = "") -> None:
    assert settings.EMAIL_FROM_EMAIL
    assert settings.enable_email

    message = emails.message.Message(
        subject=subject,
        html=html_content,
        mail_from=(settings.EMAIL_FROM_NAME, settings.EMAIL_FROM_EMAIL),
    )
    smtp_options: dict[str, Any] = {}
    if settings.SMTP_HOST:
        smtp_options["host"] = settings.SMTP_HOST
    if settings.SMTP_PORT:
        smtp_options["port"] = settings.SMTP_PORT
    if settings.SMTP_SSL:
        smtp_options["ssl"] = True
    elif settings.SMTP_TLS:
        smtp_options["tls"] = True
    if settings.SMTP_USER:
        smtp_options["user"] = settings.SMTP_USER
    if settings.SMTP_PASSWORD:
        smtp_options["password"] = settings.SMTP_PASSWORD

    response = message.send(to=email_to, smtp=smtp_options)
    logger.info(f"send email result: {response}")


def generate_test_email(email_to: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - Test email"
    html_content = render_email_template(
        template_name="test_email.html",
        context={"project_name": project_name, "email": email_to},
    )
    return EmailData(html_content=html_content, subject=subject)


def generete_new_account_email(email_to: str, password: str, username: str):
    project_name = settings.PROJECT_NAME
    subject = f"{project_name} - New account for {username}"
    context = {"project_name": project_name, "username": username, "password": password}
    html_content = render_email_template(
        template_name="new_account.html", context=context
    )
    return EmailData(html_content=html_content, subject=subject)


def generate_password_reset_email(email: str, email_to: str, token: str) -> EmailData:
    project_name = settings.PROJECT_NAME
    template_name = "reset_password.html"
    subject = f"{project_name} - Password reset for {email}"
    link = f"{settings.FRONTEND_HOST}/reset-password?token={token}"
    context = {
        "project_name": project_name,
        "username": email,
        "email": email_to,
        "valid_hours": settings.RESET_TOKEN_EXPIRE,
        "link": link,
    }
    html_content = render_email_template(template_name=template_name, context=context)
    return EmailData(html_content=html_content, subject=subject)


def create_password_reset_token(email: str) -> str:
    now = datetime.now(UTC)
    expire = timedelta(minutes=settings.RESET_TOKEN_EXPIRE) + now
    payload = {"sub": email, "exp": expire, "nbf": now, "purpose": "password_reset"}
    token = jwt.encode(
        payload=payload, algorithm=settings.ALGORITHM, key=settings.SECRET_KEY
    )
    return token


def validate_password_reset_token(token: str) -> str | None:
    try:
        payload = jwt.decode(
            token, algorithms=settings.ALGORITHM, key=settings.SECRET_KEY
        )
        if payload.get("purpose") != "password_reset":
            return None
        sub = payload.get("sub")
        if not sub:
            return None
        return str(sub)
    except InvalidTokenError:
        return None
