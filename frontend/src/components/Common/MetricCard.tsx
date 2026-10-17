import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

export type MetricCardState = "value" | "empty" | "loading" | "unavailable"

interface MetricCardProps {
  label: string
  icon?: LucideIcon
  value?: ReactNode
  context?: ReactNode
  footer?: ReactNode
  state?: MetricCardState
  /** Shown when state is "unavailable" — explains why the value is missing. */
  unavailableReason?: string
  className?: string
}

export function MetricCard({
  label,
  icon: Icon,
  value,
  context,
  footer,
  state = "value",
  unavailableReason,
  className,
}: MetricCardProps) {
  return (
    <div
      data-slot="metric-card"
      data-state={state}
      className={cn(
        "flex flex-col gap-2 rounded-xl border bg-card px-4 py-3",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="size-4 text-muted-foreground" /> : null}
        <span className="overline text-muted-foreground">{label}</span>
      </div>

      {state === "loading" ? (
        <div className="flex flex-col gap-2" aria-hidden="true">
          <div className="h-7 w-16 animate-pulse rounded-md bg-muted" />
          <div className="h-3 w-28 animate-pulse rounded bg-muted" />
        </div>
      ) : null}

      {state === "value" ? (
        <>
          <span className="readout text-2xl font-semibold tabular-nums">
            {value}
          </span>
          {context ? (
            <span className="text-xs text-muted-foreground">{context}</span>
          ) : null}
        </>
      ) : null}

      {state === "empty" ? (
        <>
          <span className="text-2xl font-semibold text-muted-foreground">
            —
          </span>
          {context ? (
            <span className="text-xs text-muted-foreground">{context}</span>
          ) : null}
        </>
      ) : null}

      {state === "unavailable" ? (
        <>
          <span className="text-sm font-medium text-muted-foreground">
            Unavailable
          </span>
          <span className="text-xs text-muted-foreground">
            {unavailableReason}
          </span>
        </>
      ) : null}

      {footer ? <div className="mt-auto pt-1">{footer}</div> : null}
    </div>
  )
}
