"""Story 30 — Findings: research claims tied to supporting material.

Integrity rules enforced here (never in the UI, never by any AI path):

- ``validated`` is reachable only through the deterministic checks in
  :func:`validate_finding`. The endpoint takes no body, so no caller — human
  or AI-assisted drafting (Story 63) — can state the result.
- Publishing requires at least one ``primary`` evidence row; publishing bumps
  the version and snapshots the claim into ``history`` for retrieval.
- Published findings are world-visible claims: they are *retracted*, never
  erased, and their evidence set is frozen until retraction.
- Evidence targets must exist inside the claim's own project — cross-project
  references are rejected, matching ownership rules everywhere else.
- No confidence percentage exists anywhere: ``validation_state`` is a state,
  not a fabricated number.

Deterministic check outcomes persist as ordinary ``ValidationRun`` /
``ValidationIssue`` rows (``subject_type=finding``), so the validation history
and future validation UI treat findings like any other subject.
"""

from __future__ import annotations

import uuid
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from sqlmodel import Session, col, select

from app.models import (
    AnalysisRun,
    Document,
    EvidenceEdge,
    EvidenceNode,
    Finding,
    FindingEvidence,
    FindingEvidencePublic,
    FindingEvidenceRole,
    FindingEvidenceTarget,
    FindingPublic,
    FindingStatus,
    FindingValidationIssuePublic,
    FindingValidationResult,
    FindingValidationState,
    FindingVersionPublic,
    ProvenanceActorType,
    ValidationIssue,
    ValidationRun,
    ValidationSeverity,
    ValidationSubjectType,
    ValidationTrigger,
)
from app.services import provenance

VALIDATOR_SET_VERSION = "findings-1.0"


class FindingRuleError(ValueError):
    """A business-rule violation the routes map to HTTP 422."""


@dataclass
class FindingCheckIssue:
    code: str
    severity: ValidationSeverity
    message: str
    detail: str | None = None
    path: str | None = None
    field: str | None = None
    suggestion: str | None = None


FindingValidator = Callable[[Session, Finding], list[FindingCheckIssue]]


#  ----------  EVIDENCE TARGET RESOLUTION  ----------


def resolve_evidence_target(
    session: Session,
    finding: Finding,
    target_type: FindingEvidenceTarget,
    target_id: str,
) -> str:
    """Verify the referenced material exists inside the finding's project.

    Returns the human-readable label for resolved targets. Raises
    :class:`FindingRuleError` when the target does not exist, points outside
    the project, or is a record type the backend cannot resolve yet
    (``artifact`` / ``report_passage`` — their models arrive with Story 25's
    artifacts and Story 36's reports, and inventing a placeholder reference
    would break traceability).
    """
    if target_type == FindingEvidenceTarget.document:
        document = session.get(Document, uuid.UUID(target_id))
        if document is None:
            raise FindingRuleError("Referenced document does not exist")
        project_id = provenance.project_id_for_document(session, document.id)
        if project_id != finding.project_id:
            raise FindingRuleError(
                "Cross-project evidence links are rejected: the document "
                "belongs to a different project"
            )
        return document.filename or document.file_url

    if target_type == FindingEvidenceTarget.run:
        run = session.get(AnalysisRun, uuid.UUID(target_id))
        if run is None:
            raise FindingRuleError("Referenced analysis run does not exist")
        if run.project_id != finding.project_id:
            raise FindingRuleError(
                "Cross-project evidence links are rejected: the run belongs "
                "to a different project"
            )
        return run.tool_name

    if target_type == FindingEvidenceTarget.graph_edge:
        edge = session.get(EvidenceEdge, uuid.UUID(target_id))
        if edge is None:
            raise FindingRuleError("Referenced evidence edge does not exist")
        node = session.get(EvidenceNode, edge.source_id)
        if node is None or node.project_id != finding.project_id:
            raise FindingRuleError(
                "Cross-project evidence links are rejected: the edge is not "
                "in this project's evidence graph"
            )
        if edge.note:
            return f"evidence edge: {edge.note}"
        return f"evidence edge ({edge.relation.value})"

    raise FindingRuleError(
        f"{target_type.value} targets cannot be resolved yet — artifact "
        "references arrive with Story 25, report passages with Story 36; "
        "nothing is invented in the meantime"
    )


def _evidence_label(
    session: Session,
    finding: Finding,
    evidence: FindingEvidence,
) -> str | None:
    """Best-effort label for previously stored evidence rows (never raises)."""
    try:
        return resolve_evidence_target(
            session, finding, evidence.target_type, evidence.target_id
        )
    except (FindingRuleError, ValueError):
        return None


#  ----------  DETERMINISTIC CHECKS  ----------


def _check_content_presents_a_claim(
    session: Session, finding: Finding
) -> list[FindingCheckIssue]:
    issues: list[FindingCheckIssue] = []
    if not finding.title.strip():
        issues.append(
            FindingCheckIssue(
                code="finding.content_missing",
                severity=ValidationSeverity.error,
                message="Finding title is empty",
                field="title",
            )
        )
    if not finding.summary.strip():
        issues.append(
            FindingCheckIssue(
                code="finding.content_missing",
                severity=ValidationSeverity.error,
                message="Finding summary is empty",
                field="summary",
            )
        )
    return issues


def _check_primary_evidence_present(
    session: Session, finding: Finding
) -> list[FindingCheckIssue]:
    primaries = session.exec(
        select(FindingEvidence).where(
            col(FindingEvidence.finding_id) == finding.id,
            col(FindingEvidence.role) == FindingEvidenceRole.primary,
        )
    ).all()
    if not primaries:
        return [
            FindingCheckIssue(
                code="finding.no_primary_evidence",
                severity=ValidationSeverity.error,
                message=(
                    "No primary evidence: a validated claim needs at least "
                    "one primary supporting reference"
                ),
                suggestion="Add evidence with role 'primary' first",
            )
        ]
    return []


def _check_evidence_targets_resolvable(
    session: Session, finding: Finding
) -> list[FindingCheckIssue]:
    """Documents and runs must still resolve (they may have been deleted)."""
    evidence = _ordered_evidence(session, finding)
    issues: list[FindingCheckIssue] = []
    for row in evidence:
        try:
            resolve_evidence_target(
                session, finding, row.target_type, row.target_id
            )
        except FindingRuleError as error:
            issues.append(
                FindingCheckIssue(
                    code="finding.evidence_unresolved",
                    severity=ValidationSeverity.error,
                    message=f"Evidence reference no longer resolves: {error}",
                    detail=str(row.id),
                    path=f"evidence/{row.id}",
                )
            )
        except ValueError:
            issues.append(
                FindingCheckIssue(
                    code="finding.evidence_unresolved",
                    severity=ValidationSeverity.error,
                    message=(
                        "Evidence reference target id is not a valid identifier"
                    ),
                    detail=str(row.id),
                    path=f"evidence/{row.id}",
                )
            )
    return issues


def _check_contradicting_evidence(
    session: Session, finding: Finding
) -> list[FindingCheckIssue]:
    contradicting = session.exec(
        select(FindingEvidence).where(
            col(FindingEvidence.finding_id) == finding.id,
            col(FindingEvidence.role) == FindingEvidenceRole.contradicting,
        )
    ).all()
    if contradicting:
        return [
            FindingCheckIssue(
                code="finding.contradicting_evidence",
                severity=ValidationSeverity.error,
                message=(
                    "Contradicting evidence is attached: a claim with "
                    "contradicting material must stay in human review rather "
                    "than be auto-validated"
                ),
                path=f"evidence/{contradicting[0].id}",
            )
        ]
    return []


# Registry order matters only for deterministic issue ordering.
FINDING_VALIDATORS: Sequence[FindingValidator] = (
    _check_content_presents_a_claim,
    _check_primary_evidence_present,
    _check_evidence_targets_resolvable,
    _check_contradicting_evidence,
)


#  ----------  INTERNAL HELPERS  ----------


def _now() -> datetime:
    return datetime.now(UTC)


def _ordered_evidence(
    session: Session, finding: Finding
) -> list[FindingEvidence]:
    statement = (
        select(FindingEvidence)
        .where(col(FindingEvidence.finding_id) == finding.id)
        .order_by(col(FindingEvidence.created_at))
    )
    return list(session.exec(statement).all())


def _history_entry(
    finding: Finding,
    *,
    status: FindingStatus,
    recorded: datetime,
    published_by: uuid.UUID | None,
) -> dict[str, Any]:
    return {
        "version": finding.version,
        "status": status.value,
        "title": finding.title,
        "summary": finding.summary,
        "validation_state": finding.validation_state.value,
        "recorded_at": recorded.isoformat(),
        "published_by": str(published_by) if published_by else None,
    }


def get_owned_finding(
    session: Session, finding_id: uuid.UUID, owner_user_id: uuid.UUID
) -> Finding | None:
    """Ownership walk: the finding belongs to the caller's project."""
    from app.models import Project

    finding = session.get(Finding, finding_id)
    if finding is None:
        return None
    project = session.get(Project, finding.project_id)
    if project is None or project.user_id != owner_user_id:
        return None
    return finding


def evidence_to_public(
    session: Session,
    finding: Finding,
    row: FindingEvidence,
) -> FindingEvidencePublic:
    return FindingEvidencePublic(
        id=row.id,
        finding_id=row.finding_id,
        target_type=row.target_type,
        target_id=row.target_id,
        quote_or_field=row.quote_or_field,
        role=row.role,
        added_by=row.added_by,
        created_at=row.created_at,
        label=_evidence_label(session, finding, row),
    )


def finding_to_public(
    session: Session, finding: Finding
) -> FindingPublic:
    evidence = [
        evidence_to_public(session, finding, row)
        for row in _ordered_evidence(session, finding)
    ]
    return FindingPublic(
        id=finding.id,
        project_id=finding.project_id,
        title=finding.title,
        summary=finding.summary,
        status=finding.status,
        validation_state=finding.validation_state,
        created_by=finding.created_by,
        supersedes_id=finding.supersedes_id,
        version=finding.version,
        created_at=finding.created_at,
        updated_at=finding.updated_at,
        evidence=evidence,
    )


def _upsert_finding_node(session: Session, finding: Finding) -> None:
    from app.services import evidence

    evidence.materialise_finding(session, finding)


#  ----------  LIFECYCLE  ----------


def create_finding(
    session: Session,
    project_id: uuid.UUID,
    *,
    title: str,
    summary: str,
    supersedes_id: uuid.UUID | None,
    evidence_refs: Sequence[tuple[FindingEvidenceTarget, str, dict[str, Any] | None, FindingEvidenceRole]],
    actor_user_id: uuid.UUID | None,
) -> Finding:
    violating_supersedes = None
    if supersedes_id is not None:
        violating_supersedes = session.get(Finding, supersedes_id)
        if violating_supersedes is None:
            raise FindingRuleError("Superseded finding does not exist")
        if violating_supersedes.project_id != project_id:
            raise FindingRuleError(
                "Cross-project evidence links are rejected: the superseded "
                "finding belongs to a different project"
            )

    finding = Finding(
        project_id=project_id,
        title=title,
        summary=summary,
        supersedes_id=supersedes_id,
        created_by=actor_user_id,
        status=FindingStatus.draft,
        validation_state=FindingValidationState.unvalidated,
        version=1,
        history=[],
    )
    session.add(finding)
    session.commit()
    session.refresh(finding)

    evidence_rows: list[FindingEvidence] = []
    for target_type, target_id, quote_or_field, role in evidence_refs:
        evidence_rows.append(
            add_evidence(
                session,
                finding,
                target_type=target_type,
                target_id=target_id,
                quote_or_field=quote_or_field,
                role=role,
                actor_user_id=actor_user_id,
            )
        )

    _upsert_finding_node(session, finding)
    provenance.record(
        session,
        project_id=project_id,
        action="finding.created",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={
            "status": FindingStatus.draft.value,
            "supersedes_id": str(supersedes_id) if supersedes_id else None,
            "evidence_ids": [str(row.id) for row in evidence_rows],
        },
    )
    return finding


def update_finding(
    session: Session,
    finding: Finding,
    *,
    title: str | None = None,
    summary: str | None = None,
    supersedes_id: uuid.UUID | None = None,
    disputed: bool | None = None,
    status: FindingStatus | None = None,
    actor_user_id: uuid.UUID | None,
) -> Finding:
    """Content edit + explicit human dispute/status handling.

    ``disputed=True`` is a human action that moves ``validation_state`` to
    ``disputed`` from anywhere. ``disputed=False`` returns a disputed finding
    to ``unvalidated``; it never touches ``validated`` — only deterministic
    checks can produce a validated state, and undoing a dispute re-earns it.

    ``status="review"`` is the only status accepted here: the deliberate step
    that returns a **retracted** claim into review for a corrected edition.
    A retracted finding is never silently re-published this way.
    """
    if finding.status == FindingStatus.published:
        raise FindingRuleError(
            "Published findings are frozen until retraction"
        )

    if status is not None and status != FindingStatus.review:
        raise FindingRuleError(
            "This endpoint only moves a retracted finding back to review; "
            "use the publish endpoint to publish"
        )
    if status == FindingStatus.review and finding.status != (
        FindingStatus.retracted
    ):
        raise FindingRuleError(
            "Only a retracted finding can be returned to review"
        )
    if status == FindingStatus.review and finding.status == (
        FindingStatus.retracted
    ):
        finding.status = FindingStatus.review
        finding.updated_at = _now()
    if title is not None:
        finding.title = title
    if summary is not None:
        finding.summary = summary
    if supersedes_id is not None and supersedes_id != finding.supersedes_id:
        superseded = session.get(Finding, supersedes_id)
        if superseded is None:
            raise FindingRuleError("Superseded finding does not exist")
        if superseded.project_id != finding.project_id:
            raise FindingRuleError(
                "Cross-project evidence links are rejected: the superseded "
                "finding belongs to a different project"
            )
        finding.supersedes_id = supersedes_id

    fields_changed = [
        name
        for name, value in (
            ("title", title),
            ("summary", summary),
            ("supersedes_id", supersedes_id),
            ("status", status),
        )
        if value is not None
    ]

    state_before = finding.validation_state
    if disputed is True:
        finding.validation_state = FindingValidationState.disputed
        fields_changed.append("validation_state")
    elif (
        disputed is False
        and state_before == FindingValidationState.disputed
    ):
        finding.validation_state = FindingValidationState.unvalidated
        fields_changed.append("validation_state")

    finding.updated_at = _now()
    session.add(finding)
    session.commit()
    session.refresh(finding)

    if finding.validation_state != state_before:
        provenance.record(
            session,
            project_id=finding.project_id,
            action="finding.disputed",
            entity_type="finding",
            entity_id=str(finding.id),
            actor_type=ProvenanceActorType.user,
            actor_id=actor_user_id,
            payload={
                "validation_state_before": state_before.value,
                "validation_state_after": finding.validation_state.value,
            },
        )

    _upsert_finding_node(session, finding)
    provenance.record(
        session,
        project_id=finding.project_id,
        action="finding.updated",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={"fields_changed": fields_changed},
    )
    return finding


def publish_finding(
    session: Session,
    finding: Finding,
    *,
    actor_user_id: uuid.UUID | None,
) -> Finding:
    """Publish requires ≥1 primary evidence; version bumps on every publish.

    A reverted finding returns through ``review`` — retracting is terminal for
    the *claim as published*, but a corrected edition must go back through
    review rather than reactivate straight away.
    """
    if finding.status not in (FindingStatus.draft, FindingStatus.review):
        raise FindingRuleError(
            "Only draft or review findings can be published (a retracted "
            "claim first returns through review)"
        )
    primaries = session.exec(
        select(FindingEvidence).where(
            col(FindingEvidence.finding_id) == finding.id,
            col(FindingEvidence.role) == FindingEvidenceRole.primary,
        )
    ).all()
    if not primaries:
        raise FindingRuleError(
            "Publishing requires at least one primary evidence reference"
        )

    finding.version += 1
    recorded_at = _now()
    finding.history = list(finding.history) + [
        _history_entry(
            finding,
            status=FindingStatus.published,
            recorded=recorded_at,
            published_by=actor_user_id,
        )
    ]
    finding.status = FindingStatus.published
    finding.updated_at = recorded_at
    session.add(finding)
    session.commit()
    session.refresh(finding)

    _upsert_finding_node(session, finding)
    provenance.record(
        session,
        project_id=finding.project_id,
        action="finding.published",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={"version": finding.version},
    )
    return finding


def retract_finding(
    session: Session,
    finding: Finding,
    *,
    actor_user_id: uuid.UUID | None,
    reason: str | None = None,
) -> Finding:
    """Retraction is a human action; the claim becomes *retracted* — visible,
    historic, never erased. A corrected edition returns through review via an
    explicit PATCH (``status=review``) and a fresh publish bump."""
    if finding.status != FindingStatus.published:
        raise FindingRuleError("Only published findings can be retracted")
    finding.status = FindingStatus.retracted
    finding.updated_at = _now()
    session.add(finding)
    session.commit()
    session.refresh(finding)

    provenance.record(
        session,
        project_id=finding.project_id,
        action="finding.retracted",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={"reason": reason} if reason else {},
    )
    return finding


def delete_finding(
    session: Session,
    finding: Finding,
    *,
    actor_user_id: uuid.UUID | None,
) -> None:
    """Deletes drafts and review items; retracted may be purged on request.

    Published findings cannot be deleted — they are public claims that may
    only be retracted. Deleting a finding may also delete its evidence
    reference rows: they are pointers, not primary records.
    """
    if finding.status == FindingStatus.published:
        raise FindingRuleError(
            "Published findings are retracted, never deleted"
        )

    for row in _ordered_evidence(session, finding):
        session.delete(row)

    from app.services import evidence

    evidence.remove_finding_node(session, finding.id)

    session.delete(finding)
    session.commit()
    provenance.record(
        session,
        project_id=finding.project_id,
        action="finding.deleted",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={"title": finding.title},
    )


#  ----------  EVIDENCE REFERENCES  ----------


def add_evidence(
    session: Session,
    finding: Finding,
    *,
    target_type: FindingEvidenceTarget,
    target_id: str,
    quote_or_field: dict[str, Any] | None,
    role: FindingEvidenceRole,
    actor_user_id: uuid.UUID | None,
) -> FindingEvidence:
    if finding.status == FindingStatus.published:
        raise FindingRuleError(
            "Discoveries about a published finding do not attach here; "
            "retract first, or raise a dispute"
        )
    label = resolve_evidence_target(session, finding, target_type, target_id)
    row = FindingEvidence(
        finding_id=finding.id,
        target_type=target_type,
        target_id=target_id,
        quote_or_field=quote_or_field,
        role=role,
        added_by=actor_user_id,
    )
    session.add(row)
    session.commit()
    session.refresh(row)

    finding.updated_at = _now()
    session.add(finding)
    session.commit()

    provenance.record(
        session,
        project_id=finding.project_id,
        action="finding.evidence_added",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={"evidence_id": str(row.id), "role": role.value, "target": label},
    )
    return row


def remove_evidence(
    session: Session,
    finding: Finding,
    evidence_id: uuid.UUID,
    *,
    actor_user_id: uuid.UUID | None,
) -> None:
    row = session.get(FindingEvidence, evidence_id)
    if row is None or row.finding_id != finding.id:
        raise FindingRuleError("Evidence reference does not belong to this finding")
    if finding.status == FindingStatus.published:
        raise FindingRuleError(
            "The evidence set of a published finding is frozen until retraction"
        )
    session.delete(row)
    session.commit()

    finding.updated_at = _now()
    session.add(finding)
    session.commit()

    provenance.record(
        session,
        project_id=finding.project_id,
        action="finding.evidence_removed",
        entity_type="finding",
        entity_id=str(finding.id),
        actor_type=ProvenanceActorType.user,
        actor_id=actor_user_id,
        payload={"evidence_id": str(evidence_id)},
    )


#  ----------  VALIDATION  ----------


def _persist_check_run(
    session: Session,
    finding: Finding,
    issues: Sequence[FindingCheckIssue],
) -> ValidationRun:
    run = ValidationRun(
        subject_type=ValidationSubjectType.finding,
        subject_id=finding.id,
        document_id=None,
        trigger=ValidationTrigger.manual,
        started_at=_now(),
        finished_at=_now(),
        status="succeeded",
        validator_set_version=VALIDATOR_SET_VERSION,
    )
    session.add(run)
    session.flush()
    for item in issues:
        session.add(
            ValidationIssue(
                run_id=run.id,
                code=item.code,
                severity=item.severity,
                message=item.message,
                detail=item.detail,
                path=item.path,
            )
        )
    session.commit()
    session.refresh(run)
    return run


def validate_finding(
    session: Session,
    finding: Finding,
    *,
    actor_user_id: uuid.UUID | None,
) -> tuple[Finding, FindingValidationResult]:
    """Run the deterministic checks; ``validated`` only when zero errors.

    Failures keep the previous state — a state machine edge, never a silent
    notice: the refused attempt and the issues that caused it come back in
    the result, and they persist as ``ValidationRun``/``ValidationIssue`` rows
    with ``subject_type=finding``.
    """
    issues: list[FindingCheckIssue] = []
    for validator in FINDING_VALIDATORS:
        issues.extend(validator(session, finding))

    state_before = finding.validation_state
    has_errors = any(issue.severity == ValidationSeverity.error for issue in issues)
    if not has_errors and state_before != FindingValidationState.validated:
        finding.validation_state = FindingValidationState.validated
        session.add(finding)
        session.commit()
        session.refresh(finding)
    # A failing revalidation keeps ``validated`` (product rule: failures keep
    # state; humans then either fix the gaps or dispute).
    state_after = finding.validation_state

    run = _persist_check_run(session, finding, issues)

    if not has_errors:
        provenance.record(
            session,
            project_id=finding.project_id,
            action="finding.validated",
            entity_type="finding",
            entity_id=str(finding.id),
            actor_type=ProvenanceActorType.user,
            actor_id=actor_user_id,
            payload={
                "run_id": str(run.id),
                "issue_count": len(issues),
            },
        )

    result = FindingValidationResult(
        finding=finding_to_public(session, finding),
        validation_state_before=state_before,
        validation_state_after=state_after,
        issues=[
            FindingValidationIssuePublic(
                code=issue.code,
                severity=issue.severity,
                message=issue.message,
            )
            for issue in issues
        ],
    )
    return finding, result


def list_finding_versions(
    session: Session, finding: Finding
) -> tuple[list[FindingVersionPublic], int]:
    entries = list(finding.history or [])
    versions = [
        FindingVersionPublic(
            version=entry.get("version", 0),
            status=FindingStatus(str(entry.get("status", "published"))),
            title=entry.get("title", ""),
            summary=entry.get("summary", ""),
            validation_state=FindingValidationState(
                entry.get("validation_state", "unvalidated")
            ),
            recorded_at=datetime.fromisoformat(entry["recorded_at"]),
            published_by=uuid.UUID(entry["published_by"])
            if entry.get("published_by")
            else None,
        )
        for entry in entries
    ]
    versions.reverse()
    return versions, len(versions)

