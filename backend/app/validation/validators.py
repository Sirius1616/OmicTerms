from __future__ import annotations

from .base import Issue, ValidationContext, Validator
from .registry import ValidatorRegistry
from .vcf import VCFValidator
from .bed import BEDValidator
from .matrix import MatrixValidator


class DocumentPresenceValidator(Validator):
    name = "document_presence"

    def applies_to(self, ctx: ValidationContext) -> bool:
        return ctx.document is not None

    def run(self, ctx: ValidationContext) -> list[Issue]:
        document = ctx.document
        if document is None:
            return [
                Issue(
                    code="DOC-MISSING-001",
                    severity="error",
                    message="Document not found",
                    suggestion="Ensure the document exists and you have access",
                )
            ]
        return [
            Issue(
                code="DOC-OK-001",
                severity="info",
                message="Document present and accessible for validation",
            )
        ]


def register_default_validators(registry: ValidatorRegistry) -> None:
    registry.register(DocumentPresenceValidator())
    registry.register(VCFValidator())
    registry.register(BEDValidator())
    registry.register(MatrixValidator())
