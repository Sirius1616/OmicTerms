import { Link } from "@tanstack/react-router"
import { ArrowLeft, type LucideIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface PlaceholderPageProps {
  icon: LucideIcon
  title: string
  /** Milestone in which the real feature lands, e.g. "M3". */
  milestone: string
  description: string
  className?: string
}

export function PlaceholderPage({
  icon: Icon,
  title,
  milestone,
  description,
  className,
}: PlaceholderPageProps) {
  return (
    <div
      data-slot="placeholder-page"
      className={cn(
        "flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center",
        className,
      )}
    >
      <div className="rounded-2xl border border-dashed border-border-strong bg-muted/30 p-5">
        <Icon className="size-8 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-2">
        <h1>{title}</h1>
        <p className="max-w-lg text-sm text-muted-foreground">{description}</p>
      </div>
      <span className="rounded-full border border-border px-3 py-1 text-[11px] font-medium text-muted-foreground">
        Planned for milestone {milestone} — not yet implemented
      </span>
      <Button variant="outline" size="sm" asChild>
        <Link to="/">
          <ArrowLeft className="size-4" />
          Back to Home
        </Link>
      </Button>
    </div>
  )
}
