from __future__ import annotations

from app.validation.base import Issue, ValidationContext, Validator
from app.validation.bed import BEDValidator
from app.validation.matrix import MatrixValidator
from app.validation.registry import ValidatorRegistry
from app.validation.vcf import VCFValidator


class DocumentPresenceValidator(Validator):
    name = "document_presence"

    def applies_to(self, ctx: ValidationContext) -> bool:
        return True

    def run(self, ctx: ValidationContext) -> list[Issue]:
        if ctx.document is None:
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


class AssemblyDeclarationValidator(Validator):
    name = "assembly_declaration"

    def applies_to(self, ctx: ValidationContext) -> bool:
        return True

    def run(self, ctx: ValidationContext) -> list[Issue]:
        if getattr(ctx, "assembly_declared", False):
            return [
                Issue(
                    code="META-ASSEMBLY-001",
                    severity="info",
                    message=f"Genome assembly declared: {ctx.assembly}",
                )
            ]
        return [
            Issue(
                code="META-ASSEMBLY-002",
                severity="skipped",
                message="Assembly-dependent checks skipped",
                detail="assembly not declared",
                suggestion=(
                    "Declare the genome assembly in the dataset metadata so "
                    "assembly-dependent checks can run"
                ),
            )
        ]


def register_default_validators(registry: ValidatorRegistry) -> None:
    registry.register(DocumentPresenceValidator())
    registry.register(AssemblyDeclarationValidator())
    registry.register(VCFValidator())
    registry.register(BEDValidator())
    registry.register(MatrixValidator())
