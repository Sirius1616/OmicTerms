from __future__ import annotations

import logging

from .base import Issue, ValidationContext, Validator

logger = logging.getLogger(__name__)


class ValidatorRegistry:
    def __init__(self) -> None:
        self._validators: list[Validator] = []

    def register(self, validator: Validator) -> None:
        self._validators.append(validator)

    def get_validators(self) -> list[Validator]:
        return list(self._validators)

    def run_all(self, ctx: ValidationContext) -> list[Issue]:
        issues: list[Issue] = []
        for validator in self._validators:
            try:
                if not validator.applies_to(ctx):
                    continue
                issues.extend(validator.run(ctx))
            except Exception as exc:
                logger.exception("Validator %s failed", getattr(validator, "name", validator))
                issues.append(
                    Issue(
                        code="VAL-INTERNAL-001",
                        severity="skipped",
                        message="Validator execution skipped due to internal error",
                        detail=str(exc),
                        suggestion="Re-run validation; if this persists, check logs",
                    )
                )
        return issues


_REGISTRY: ValidatorRegistry | None = None


def get_registry() -> ValidatorRegistry:
    global _REGISTRY
    if _REGISTRY is None:
        _REGISTRY = ValidatorRegistry()
        from .validators import register_default_validators

        register_default_validators(_REGISTRY)
    return _REGISTRY
