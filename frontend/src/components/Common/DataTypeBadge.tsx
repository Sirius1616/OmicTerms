import { cn } from "@/lib/utils"
import type { DataType, ExtractionStatus } from "@/types/documents"
import { StatusBadge, type StatusBadgeVariant } from "./StatusBadge"

const STATUS_LABELS: Record<ExtractionStatus, string> = {
  pending: "Extracting",
  success: "Processed",
  failed: "Failed",
}

const STATUS_VARIANTS: Record<ExtractionStatus, StatusBadgeVariant> = {
  pending: "pending",
  success: "valid",
  failed: "error",
}

export function ExtractionStatusBadge({
  status,
  className,
}: {
  status: ExtractionStatus
  className?: string
}) {
  return (
    <StatusBadge variant={STATUS_VARIANTS[status]} className={className}>
      {STATUS_LABELS[status]}
    </StatusBadge>
  )
}

const DATA_TYPE_VARIANTS: Record<DataType, StatusBadgeVariant> = {
  expression: "info",
  methylation: "pending",
  variants: "warning",
  peaks: "valid",
  document: "neutral",
}

export function DataTypeBadge({
  dataType,
  className,
}: {
  dataType?: DataType | null
  className?: string
}) {
  if (!dataType) {
    return (
      <StatusBadge variant="neutral" className={className}>
        detecting
      </StatusBadge>
    )
  }

  return (
    <StatusBadge variant={DATA_TYPE_VARIANTS[dataType]} className={className}>
      {dataType}
    </StatusBadge>
  )
}

export function DataTypeDot({
  dataType,
  className,
}: {
  dataType?: DataType | null
  className?: string
}) {
  const color: Record<DataType, string> = {
    expression: "bg-primary",
    methylation: "bg-accent-cyan",
    variants: "bg-warning",
    peaks: "bg-valid",
    document: "bg-muted-foreground",
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full",
        dataType ? color[dataType] : "bg-muted-foreground",
        className,
      )}
    />
  )
}
