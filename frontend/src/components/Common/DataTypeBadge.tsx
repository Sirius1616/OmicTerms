import { CircleAlert, CircleCheck, LoaderCircle } from "lucide-react"

import { cn } from "@/lib/utils"
import type { DataType, ExtractionStatus } from "@/types/documents"
import { DATA_TYPE_META, omicsClasses } from "./ScientificIcons"
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

const STATUS_ICONS: Record<ExtractionStatus, typeof CircleCheck> = {
  pending: LoaderCircle,
  success: CircleCheck,
  failed: CircleAlert,
}

export function ExtractionStatusBadge({
  status,
  className,
}: {
  status: ExtractionStatus
  className?: string
}) {
  const Icon = STATUS_ICONS[status]
  return (
    <StatusBadge variant={STATUS_VARIANTS[status]} className={className}>
      <Icon className={cn(status === "pending" && "animate-spin")} />
      {STATUS_LABELS[status]}
    </StatusBadge>
  )
}

/**
 * Data-type identity badge. Colour + glyph encode *what kind of data* this is,
 * never a validity signal — those live on ExtractionStatusBadge / StatusBadge.
 */
export function DataTypeBadge({
  dataType,
  className,
}: {
  dataType?: DataType | null
  className?: string
}) {
  if (!dataType) {
    return (
      <span
        className={cn(
          "inline-flex w-fit items-center rounded-full border border-border px-2 py-0.5 text-[11px] font-medium text-muted-foreground",
          className,
        )}
      >
        Detecting…
      </span>
    )
  }

  const meta = DATA_TYPE_META[dataType]
  const classes = omicsClasses(meta.token)

  return (
    <span
      title={meta.meaning}
      className={cn(
        "inline-flex w-fit items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap",
        classes.border,
        classes.bg,
        classes.text,
        className,
      )}
    >
      <meta.Icon className="size-3" />
      {meta.label}
    </span>
  )
}

export function DataTypeDot({
  dataType,
  className,
}: {
  dataType?: DataType | null
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block size-2 rounded-full",
        dataType
          ? omicsClasses(DATA_TYPE_META[dataType].token).dot
          : "bg-muted-foreground",
        className,
      )}
    />
  )
}
