import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  body?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "gap-2 py-6" : "gap-3 py-10",
        className,
      )}
    >
      {Icon ? (
        <div className="rounded-full bg-muted p-3">
          <Icon className="size-5 text-muted-foreground" />
        </div>
      ) : null}
      <h3 className="font-semibold">{title}</h3>
      {body ? (
        <p className="max-w-md text-sm text-muted-foreground">{body}</p>
      ) : null}
      {action ? (
        <div className="mt-1 flex items-center gap-2">{action}</div>
      ) : null}
    </div>
  )
}
