from __future__ import annotations

from dataclasses import dataclass
from typing import Protocol


@dataclass(slots=True)
class Issue:
    code: str
    severity: str  # error|warning|info|skipped
    message: str
    detail: str | None = None
    field: str | None = None
    path: str | None = None
    suggestion: str | None = None
    dedup_key: str | None = None


@dataclass(slots=True)
class ValidationContext:
    document_id: str
    document: object | None = None
    session: object | None = None
    trigger: str = "manual"
    assembly_declared: bool = False
    assembly: str | None = None


class Validator(Protocol):
    name: str

    def applies_to(self, ctx: ValidationContext) -> bool: ...

    def run(self, ctx: ValidationContext) -> list[Issue]: ...
