import { Link, useRouterState } from "@tanstack/react-router"
import { ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

/** Human labels for known route segments. */
const SEGMENT_LABELS: Record<string, string> = {
  projects: "Projects",
  documents: "Data Sources",
  integrations: "Integrations",
  "analysis-tools": "Analysis Tools",
  evidence: "Evidence Graph",
  reports: "Reports",
  academy: "OmicTerms Academy",
  path: "Learning Path",
  concepts: "Concept Explorer",
  labs: "Interactive Labs",
  progress: "My Progress",
  settings: "Settings",
  admin: "Admin",
}

function labelFor(segment: string): string {
  return (
    SEGMENT_LABELS[segment] ??
    segment.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  )
}

const MAX_LEVELS = 3

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })

  const segments = pathname.split("/").filter(Boolean).slice(-MAX_LEVELS)

  const crumbs = [
    { label: "Home", href: "/" },
    ...segments.map((segment, index) => ({
      label: labelFor(segment),
      href: `/${segments.slice(0, index + 1).join("/")}`,
    })),
  ]

  return (
    <nav aria-label="Breadcrumb" className={cn("min-w-0", className)}>
      <ol className="flex items-center gap-1 text-sm text-muted-foreground">
        {crumbs.map((crumb, index) => {
          const isLast = index === crumbs.length - 1
          return (
            <li key={crumb.href} className="flex items-center gap-1">
              {index > 0 ? (
                <ChevronRight className="size-3.5 shrink-0 opacity-60" />
              ) : null}
              {isLast ? (
                <span
                  aria-current="page"
                  className="truncate font-medium text-foreground"
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  to={crumb.href}
                  className="truncate rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {crumb.label}
                </Link>
              )}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
