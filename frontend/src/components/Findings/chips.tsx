import type {
  FindingEvidenceRole,
  FindingPublic,
  FindingStatus,
  FindingValidationState,
} from "@/client"
import { StatusBadge } from "@/components/Common/StatusBadge"

/**
 * Story 31 — chips for findings. Epistemic statuses are states only: no
 * confidence numbers are shown anywhere because none are methodologically
 * backed (product integrity rule).
 */

const VALIDATION_CHIP: Record<
  FindingValidationState,
  { variant: "warning" | "valid" | "error"; label: string }
> = {
  unvalidated: { variant: "warning", label: "unvalidated" },
  validated: { variant: "valid", label: "validated" },
  disputed: { variant: "error", label: "disputed" },
}

export function FindingValidationChip({
  state,
  className,
}: {
  state: FindingValidationState
  className?: string
}) {
  const chip = VALIDATION_CHIP[state]
  return (
    <StatusBadge
      variant={chip.variant}
      className={className}
      title={`Validation state: ${state}`}
    >
      {chip.label}
    </StatusBadge>
  )
}

const STATUS_CHIP: Record<
  FindingStatus,
  { variant: "neutral" | "pending" | "valid" | "error"; label: string }
> = {
  draft: { variant: "neutral", label: "draft" },
  review: { variant: "pending", label: "in review" },
  published: { variant: "valid", label: "published" },
  retracted: { variant: "error", label: "retracted" },
}

export function FindingStatusChip({
  status,
  className,
}: {
  status: FindingStatus
  className?: string
}) {
  const chip = STATUS_CHIP[status]
  return (
    <StatusBadge variant={chip.variant} className={className}>
      {chip.label}
    </StatusBadge>
  )
}

const ROLE_CHIP: Record<
  FindingEvidenceRole,
  { variant: "valid" | "info" | "error" }
> = {
  primary: { variant: "valid" },
  supporting: { variant: "info" },
  contradicting: { variant: "error" },
}

export function FindingEvidenceRoleChip({
  role,
  className,
}: {
  role: FindingEvidenceRole
  className?: string
}) {
  const chip = ROLE_CHIP[role]
  return (
    <StatusBadge variant={chip.variant} className={className}>
      {role}
    </StatusBadge>
  )
}

export function FindingEvidenceCountChip({
  finding,
  className,
}: {
  finding: FindingPublic
  className?: string
}) {
  const count = finding.evidence?.length ?? 0
  return (
    <StatusBadge variant="neutral" className={className}>
      {count === 1 ? "1 evidence ref" : `${count} evidence refs`}
    </StatusBadge>
  )
}
