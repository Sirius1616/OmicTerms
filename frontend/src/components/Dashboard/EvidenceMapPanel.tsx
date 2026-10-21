import { Link } from "@tanstack/react-router"
import { Network } from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import { EvidenceGraph } from "@/components/Evidence/EvidenceGraph"
import { Button } from "@/components/ui/button"
import type { DashboardFixtures } from "@/fixtures/dashboard"

interface EvidenceMapPanelProps {
  fixtures: DashboardFixtures | null
}

export function EvidenceMapPanel({ fixtures }: EvidenceMapPanelProps) {
  return (
    <Panel
      title="Multi-Omics Evidence Map"
      subtitle="How your datasets, runs, and findings connect"
      icon={<Network className="size-4 text-muted-foreground" />}
      className="xl:col-span-8"
    >
      {fixtures ? (
        <EvidenceGraph graph={fixtures.graph} notice={fixtures.notice} />
      ) : (
        <div className="flex flex-col gap-3">
          <EvidenceGraph graph={null} />
          <EmptyState
            icon={Network}
            compact
            title="Your evidence graph will appear here"
            body="Once datasets are linked, this map will show how data, analysis runs, and findings connect. Planned for milestone M3."
            action={
              <Button size="sm" asChild>
                <Link to="/documents">Go to Data Sources</Link>
              </Button>
            }
          />
        </div>
      )}
    </Panel>
  )
}
