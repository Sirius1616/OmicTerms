import { Link } from "@tanstack/react-router"
import { GraduationCap } from "lucide-react"

import { StatusBadge } from "@/components/Common/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { DashboardFixtures } from "@/fixtures/dashboard"

const MODULES = [
  "Biology foundations",
  "Genomics data literacy",
  "Python for bioinformatics",
]

interface AcademyPanelProps {
  fixtures: DashboardFixtures | null
}

export function AcademyPanel({ fixtures }: AcademyPanelProps) {
  const percent = fixtures ? fixtures.academy.percent : 0

  return (
    <section
      data-slot="academy-panel"
      className="flex flex-col gap-4 rounded-xl border bg-card p-5 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex items-center gap-4">
        <div className="rounded-xl border border-learning/40 bg-learning/10 p-3">
          <GraduationCap className="size-6 text-learning" />
        </div>
        <div>
          <h2 className="flex items-center gap-2">
            OmicTerms Academy
            {fixtures ? (
              <span className="text-[11px] font-medium text-warning">
                fixture
              </span>
            ) : null}
          </h2>
          <p className="mt-0.5 max-w-md text-sm text-muted-foreground">
            Learn the biology and the tooling behind your data — pathways for
            software engineers entering genomics.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2 lg:min-w-72">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">
            {fixtures ? "Fixture progress" : "No path started"}
          </span>
          <span className="readout font-medium tabular-nums">{percent}%</span>
        </div>
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Academy progress"
        >
          <div
            className="h-full rounded-full bg-learning"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {MODULES.map((module, index) => {
            const completed =
              fixtures !== null && index < fixtures.academy.completedModules
            return (
              <StatusBadge
                key={module}
                variant={completed ? "valid" : "neutral"}
              >
                {module}
                {completed ? " · done" : " · not started"}
              </StatusBadge>
            )
          })}
        </div>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex">
            <Button size="sm" variant="secondary" asChild>
              <Link to="/academy">Start onboarding</Link>
            </Button>
          </span>
        </TooltipTrigger>
        <TooltipContent>Onboarding ships in M4, Story 48</TooltipContent>
      </Tooltip>
    </section>
  )
}
