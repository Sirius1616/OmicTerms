"""Validation engine lifecycle and isolation (Story 15)."""

import uuid

from app.validation.base import Issue, ValidationContext
from app.validation.registry import ValidatorRegistry


class _Pass:
    name = "pass"

    def applies_to(self, ctx):
        return True

    def run(self, ctx):
        return [Issue(code="PASS-001", severity="info", message="ok")]


class _Boom:
    name = "boom"

    def applies_to(self, ctx):
        return True

    def run(self, ctx):
        raise RuntimeError("validator exploded")


class _Skip:
    name = "skip"

    def applies_to(self, ctx):
        return True

    def run(self, ctx):
        return [
            Issue(
                code="SKIP-001",
                severity="skipped",
                message="not applicable",
                detail="reason: assembly not declared",
            )
        ]


def _ctx():
    return ValidationContext(document_id=str(uuid.uuid4()))


def test_registry_runs_validators_in_registration_order():
    registry = ValidatorRegistry()
    registry.register(_Pass())
    registry.register(_Skip())

    issues = registry.run_all(_ctx())

    assert [issue.code for issue in issues] == ["PASS-001", "SKIP-001"]


def test_registry_isolates_raising_validator_and_records_reason():
    registry = ValidatorRegistry()
    registry.register(_Boom())
    registry.register(_Pass())

    issues = registry.run_all(_ctx())

    assert [issue.code for issue in issues] == ["VAL-INTERNAL-001", "PASS-001"]
    internal = issues[0]
    assert internal.severity == "skipped"
    assert internal.detail is not None
    assert "boom" in internal.detail
    assert "validator exploded" in internal.detail


def test_registry_skips_validators_that_do_not_apply():
    class _Never:
        name = "never"

        def applies_to(self, ctx):
            return False

        def run(self, ctx):
            raise AssertionError("should not run")

    registry = ValidatorRegistry()
    registry.register(_Never())
    registry.register(_Pass())

    issues = registry.run_all(_ctx())

    assert [issue.code for issue in issues] == ["PASS-001"]
