import { Link } from "@tanstack/react-router"
import { ChevronRight, Plus, Target } from "lucide-react"

import type { FindingPublic } from "@/client"
import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import {
  FindingEvidenceCountChip,
  FindingStatusChip,
  FindingValidationChip,
} from "@/components/Findings/chips"
import { Button } from "@/components/ui/button"
import type { DashboardFixtures } from "@/fixtures/dashboard"

/**
 * Story 31 — the dashboard Key Findings panel on real data: one entry per
 * claim across the current user's projects, newest first. Fixture mode only
 * produces content when the user has no real findings yet (demo retain only),
 * and every fixture entry keeps its synthetic wording from the fixture module.
 */
export interface FindingsPanelRow {
  finding: FindingPublic
  projectName: string
}

interface KeyFindingsPanelProps {
  rows: FindingsPanelRow[] | undefined
  isLoading: boolean
  fixtures: DashboardFixtures | null
  onCreate: () => void
}

export function KeyFindingsPanel({
  rows,
  isLoading,
  fixtures,
  onCreate,
}: KeyFindingsPanelProps) {
  const showFixtures = !rows?.length && Boolean(fixtures)
  return (
    <Panel
      title="Key Findings"
      icon={<Target className="size-4 text-muted-foreground" />}
      className="xl:col-span-4"
      bodyClassName="p-0"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={onCreate}
            data-testid="new-finding-button"
          >
            <Plus className="size-3" />
            New finding
          </Button>
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            asChild
          >
            <Link to="/findings">All findings</Link>
          </Button>
        </div>
      }
    >
      {rows?.length ? (
        <ul
          className="flex flex-col divide-y"
          data-testid="findings-panel-list"
        >
          {rows.slice(0, 5).map(({ finding, projectName }) => (
            <li key={finding.id} className="flex flex-col gap-2 p-4">
              <Link
                to="/findings/$findingId"
                params={{ findingId: finding.id }}
                className="text-sm font-medium hover:underline"
              >
                {finding.title}
              </Link>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {finding.summary}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <FindingValidationChip state={finding.validation_state} />
                <FindingStatusChip status={finding.status} />
                <FindingEvidenceCountChip finding={finding} />
                {projectName ? (
                  <span className="text-[11px] text-muted-foreground">
                    {projectName}
                  </span>
                ) : null}
                <span className="ml-auto text-muted-foreground">
                  <ChevronRight className="size-3.5" />
                </span>
              </div>
            </li>
          ))}
          <li className="px-4 py-2 text-[11px] text-muted-foreground">
            <Link to="/findings" className="hover:underline">
              Inspect every claim with its evidence — {rows.length} total
            </Link>
          </li>
        </ul>
      ) : showFixtures && fixtures ? (
        <ul
          className="flex flex-col divide-y"
          data-testid="findings-panel-fixtures"
        >
          {fixtures.findings.map((fixtureFinding) => (
            <li key={fixtureFinding.id} className="flex flex-col gap-2 p-4">
              <span className="text-sm font-medium">
                {fixtureFinding.title}
              </span>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {fixtureFinding.summary}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-warning">
                  evidence: not assessed
                </span>
                <span className="text-[11px] font-medium text-warning">
                  unvalidated
                </span>
                {fixtureFinding.sourceDatasets.map((dataset) => (
                  <span
                    key={dataset}
                    className="rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground"
                  >
                    {dataset}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ul>
      ) : isLoading ? (
        <div
          className="flex flex-col gap-2 p-4"
          data-testid="findings-panel-loading"
        >
          <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
          <div className="h-3 w-full animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        </div>
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
