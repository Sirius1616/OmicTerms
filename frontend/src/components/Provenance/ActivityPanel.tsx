import { useInfiniteQuery } from "@tanstack/react-query"
import { Activity, RotateCcw } from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import {
  ACTION_CATEGORIES,
  ProvenanceTimeline,
} from "@/components/Provenance/Timeline"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { ProvenanceEventPublic } from "@/services/provenance"
import { provenanceApi } from "@/services/provenance"

const PAGE_SIZE = 50

export function useProjectEventsInfinite(projectId: string, action?: string) {
  return useInfiniteQuery({
    queryKey: ["project-events", projectId, action ?? null],
    queryFn: ({ pageParam }) =>
      provenanceApi.listProjectEvents(projectId, {
        action,
        skip: pageParam as number,
        limit: PAGE_SIZE,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.data.length === PAGE_SIZE
        ? allPages.length * PAGE_SIZE
        : undefined,
  })
}

const CATEGORY_LABELS: Record<(typeof ACTION_CATEGORIES)[number], string> = {
  project: "Projects",
  experiment: "Experiments",
  sample: "Samples",
  document: "Documents",
  metadata: "Metadata",
  extraction: "Extraction",
  validation: "Validation",
  import: "Imports",
}

export function ActionFilterBar({
  value,
  onChange,
}: {
  value: string | undefined
  onChange: (value: string | undefined) => void
}) {
  return (
    <fieldset
      aria-label="Filter by action category"
      className="m-0 flex flex-wrap gap-2 border-0 p-0"
    >
      <FilterChip
        active={value === undefined}
        label="All"
        onClick={() => onChange(undefined)}
      />
      {ACTION_CATEGORIES.map((category) => (
        <FilterChip
          key={category}
          active={value === category}
          label={CATEGORY_LABELS[category]}
          onClick={() => onChange(category)}
        />
      ))}
    </fieldset>
  )
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </button>
  )
}

export function TimelineStates({
  isPending,
  isError,
  refetch,
}: {
  isPending: boolean
  isError: boolean
  refetch: () => void
}) {
  if (isPending) {
    return (
      <div className="flex flex-col gap-2 p-4" aria-busy="true">
        {Array.from({ length: 5 }).map((_, index) => (
          <Skeleton key={index} className="h-10 rounded-lg" />
        ))}
      </div>
    )
  }
  if (isError) {
    return (
      <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
        <span>Could not load activity.</span>
        <Button variant="outline" size="sm" onClick={refetch}>
          <RotateCcw className="size-4" />
          Retry
        </Button>
      </div>
    )
  }
  return null
}

export function EmptyActivity() {
  return (
    <EmptyState
      icon={Activity}
      compact
      title="No activity yet"
      body="Every upload, rename, and validation lands here as a provenance event."
    />
  )
}

export function flattenPages(
  pages: { data: ProvenanceEventPublic[] }[] | undefined,
) {
  return (pages ?? []).flatMap((page) => page.data)
}

/**
 * Self-contained panel used by the project activity page: infinite fetch,
 * category filter, load-more.
 */
export function ProjectActivityPanel({
  projectId,
  action,
}: {
  projectId: string
  action?: string
}) {
  const query = useProjectEventsInfinite(projectId, action)
  const events = flattenPages(query.data?.pages)

  return (
    <Panel
      id="activity"
      tabIndex={-1}
      title="Activity"
      subtitle="Provenance events for this project — who did what to what, and when."
      icon={<Activity className="size-4 text-muted-foreground" />}
      bodyClassName="p-0 focus:outline-none"
    >
      {TimelineStates({
        isPending: query.isPending,
        isError: query.isError,
        refetch: () => query.refetch(),
      }) ??
        (events.length === 0 ? (
          <EmptyActivity />
        ) : (
          <div className="flex flex-col divide-y">
            <ProvenanceTimeline events={events} actorName="You" />
            {query.hasNextPage && (
              <div className="flex justify-center p-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => query.fetchNextPage()}
                  disabled={query.isFetchingNextPage}
                >
                  {query.isFetchingNextPage ? "Loading…" : "Load more"}
                </Button>
              </div>
            )}
          </div>
        ))}
    </Panel>
  )
}
