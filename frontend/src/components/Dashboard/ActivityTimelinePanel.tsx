import { useQuery } from "@tanstack/react-query"
import { Activity, RotateCcw } from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import {
  ProvenanceTimeline,
  TimelineRow,
} from "@/components/Provenance/Timeline"
import { Button } from "@/components/ui/button"
import type { ProvenanceEventPublic } from "@/services/provenance"
import { provenanceApi } from "@/services/provenance"

const MAX_DASHBOARD_EVENTS = 10

/**
 * Dashboard activity: real provenance events from the user's projects,
 * merged newest-first. Dev fixtures only appear when the API returned
 * nothing (never mixed with real data).
 */
export function ActivityTimelinePanel({
  projects,
  actorName,
  fixtureEvents,
}: {
  projects: { id: string; name: string }[]
  actorName: string
  fixtureEvents: ProvenanceEventPublic[]
}) {
  const projectIds = projects.slice(0, 5).map((project) => project.id)

  const eventsQuery = useQuery({
    queryKey: ["provenance-dashboard", projectIds],
    queryFn: async () => {
      const results = await Promise.all(
        projectIds.map((id) =>
          provenanceApi.listProjectEvents(id, { limit: MAX_DASHBOARD_EVENTS }),
        ),
      )
      return results
        .flatMap((result) => result.data)
        .sort(
          (a, b) =>
            new Date(b.occurred_at).getTime() -
            new Date(a.occurred_at).getTime(),
        )
        .slice(0, MAX_DASHBOARD_EVENTS)
    },
    enabled: projectIds.length > 0,
  })

  const events = eventsQuery.data ?? []
  const showFixtures = events.length === 0 && fixtureEvents.length > 0

  return (
    <Panel
      id="activity"
      tabIndex={-1}
      title="Recent activity"
      subtitle="Provenance events across your projects."
      icon={<Activity className="size-4 text-muted-foreground" />}
      className="xl:col-span-8"
      bodyClassName="p-0 focus:outline-none"
    >
      {eventsQuery.isPending ? (
        <div className="flex flex-col gap-2 p-4" aria-busy="true">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-10 rounded-lg bg-muted/60" />
          ))}
        </div>
      ) : eventsQuery.isError ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
          <span>Could not load activity.</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => eventsQuery.refetch()}
          >
            <RotateCcw className="size-4" />
            Retry
          </Button>
        </div>
      ) : showFixtures ? (
        <ol className="flex flex-col divide-y">
          {fixtureEvents.slice(0, MAX_DASHBOARD_EVENTS).map((event) => (
            <TimelineRow key={event.id} event={event} actorName={actorName} />
          ))}
        </ol>
      ) : events.length === 0 ? (
        <EmptyState
          icon={Activity}
          compact
          title="No activity yet"
          body="Every upload, rename, and validation lands here as a provenance event."
        />
      ) : (
        <ProvenanceTimeline events={events} actorName={actorName} />
      )}
    </Panel>
  )
}
