import type { ReactNode } from "react"

import { cn } from "@/lib/utils"

interface PanelProps {
  title: string
  subtitle?: string
  actions?: ReactNode
  icon?: ReactNode
  className?: string
  bodyClassName?: string
  id?: string
  tabIndex?: number
  children: ReactNode
}

export function Panel({
  title,
  subtitle,
  actions,
  icon,
  className,
  bodyClassName,
  id,
  tabIndex,
  children,
}: PanelProps) {
  return (
    <section
      id={id}
      tabIndex={tabIndex}
      data-slot="panel"
      className={cn(
        "flex flex-col rounded-xl border bg-card text-card-foreground",
        className,
      )}
    >
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div className="flex min-w-0 items-start gap-2">
          {icon ? <span className="mt-0.5">{icon}</span> : null}
          <div className="min-w-0">
            <h2 className="truncate">{title}</h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </header>
      <div className={cn("flex-1 p-4", bodyClassName)}>{children}</div>
    </section>
  )
}
