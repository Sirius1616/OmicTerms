import { Link } from "@tanstack/react-router"
import { Target } from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import { StatusBadge } from "@/components/Common/StatusBadge"
import { Button } from "@/components/ui/button"
import type { DashboardFixtures } from "@/fixtures/dashboard"

interface KeyFindingsPanelProps {
  fixtures: DashboardFixtures | null
}

export function KeyFindingsPanel({ fixtures }: KeyFindingsPanelProps) {
  return (
    <Panel
      title="Key Findings"
      icon={<Target className="size-4 text-muted-foreground" />}
      className="xl:col-span-4"
      bodyClassName="p-0"
      actions={
        <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
          <Link to="/evidence">Open evidence</Link>
        </Button>
      }
    >
      {fixtures ? (
        <ul className="flex flex-col divide-y">
          {fixtures.findings.map((finding) => (
            <li key={finding.id} className="flex flex-col gap-2 p-4">
              <span className="text-sm font-medium">{finding.title}</span>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {finding.summary}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <StatusBadge variant="neutral">
                  evidence: not assessed
                </StatusBadge>
                <StatusBadge variant="warning">unvalidated</StatusBadge>
                {finding.sourceDatasets.map((dataset) => (
                  <StatusBadge key={dataset} variant="neutral">
                    {dataset}
                  </StatusBadge>
                ))}
              </div>
              <div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  title="Inspect arrives with Story 31"
                  className="cursor-not-allowed opacity-55"
                >
                  Inspect
                </Button>
              </div>
            </li>
          ))}
          <li className="px-4 py-2 text-[11px] font-medium text-warning">
            {fixtures.notice}
          </li>
        </ul>
      ) : (
        <EmptyState
          icon={Target}
          compact
          title="No findings yet"
          body="Findings will appear here with links to their supporting evidence. Nothing is a finding until it is backed by data."
          action={
            <Button variant="outline" size="sm" asChild>
              <Link to="/evidence">About evidence</Link>
            </Button>
          }
        />
      )}
    </Panel>
  )
}
