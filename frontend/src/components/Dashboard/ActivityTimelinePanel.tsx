import {
  Activity,
  AlertTriangle,
  FileUp,
  FlaskConical,
  RotateCcw,
} from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import type { DashboardFixtures } from "@/fixtures/dashboard"
import type { ActivityEvent } from "@/hooks/useDashboardData"
import { formatDate, formatRelativeTime, formatTime } from "@/utils/format"

const KIND_ICON = {
  upload: FileUp,
  failed: AlertTriangle,
  validation: Activity,
  analysis: Activity,
  finding: Activity,
} as const

function mergeActivity(
  events: ActivityEvent[],
  fixtures: DashboardFixtures | null,
): ActivityEvent[] {
  const fixtureEvents: ActivityEvent[] = (fixtures?.activity ?? []).map(
    (event) => ({
      id: event.id,
      kind: event.kind,
      text: event.text,
      timestamp: event.timestamp,
      isFixture: true,
    }),
  )

  return [...events, ...fixtureEvents]
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 10)
}

interface ActivityTimelinePanelProps {
  events: ActivityEvent[]
  actorName: string
  fixtures: DashboardFixtures | null
  error?: boolean
  onRetry?: () => void
}

export function ActivityTimelinePanel({
  events,
  actorName,
  fixtures,
  error,
  onRetry,
}: ActivityTimelinePanelProps) {
  const merged = mergeActivity(events, fixtures)
  const initials = actorName.slice(0, 2).toUpperCase()

  return (
    <Panel
      id="activity"
      tabIndex={-1}
      title="Recent activity"
      subtitle="Uploads and processing events. Full provenance lands in M2."
      icon={<Activity className="size-4 text-muted-foreground" />}
      className="xl:col-span-8"
      bodyClassName="p-0 focus:outline-none"
    >
      {error ? (
        <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-sm text-muted-foreground">
          <span>Could not load activity.</span>
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="size-4" />
            Retry
          </Button>
        </div>
      ) : merged.length === 0 ? (
        <EmptyState
          icon={Activity}
          compact
          title="No activity yet"
          body="Activity appears here as soon as you upload data."
        />
      ) : (
        <ol className="flex flex-col divide-y">
          {merged.map((event) => {
            const Icon = KIND_ICON[event.kind]
            const isFailed = event.kind === "failed"
            return (
              <li
                key={event.id}
                className="flex items-start gap-3 px-4 py-3 sm:items-center"
              >
                <Avatar className="size-7 shrink-0">
                  {event.isFixture ? (
                    <AvatarFallback className="bg-warning/20 text-warning">
                      <FlaskConical className="size-3.5" />
                    </AvatarFallback>
                  ) : (
                    <AvatarFallback className="bg-muted text-muted-foreground">
                      {initials}
                    </AvatarFallback>
                  )}
                </Avatar>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span
                      className={
                        isFailed
                          ? "text-sm font-medium text-destructive"
                          : "text-sm"
                      }
                    >
                      {event.text}
                    </span>
                    {event.isFixture ? (
                      <span className="text-[11px] font-medium text-warning">
                        fixture
                      </span>
                    ) : null}
                  </div>
                  <span className="block text-xs text-muted-foreground sm:hidden">
                    {formatRelativeTime(event.timestamp)}
                  </span>
                </div>

                <div className="flex shrink-0 items-center gap-3">
                  <time
                    dateTime={event.timestamp}
                    title={`${formatDate(event.timestamp)} ${formatTime(
                      event.timestamp,
                    )}`}
                    className="readout hidden text-xs text-muted-foreground sm:block"
                  >
                    {formatRelativeTime(event.timestamp)}
                  </time>
                  {event.href ? (
                    <a
                      href={event.href}
                      className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      View
                    </a>
                  ) : (
                    <Icon className="size-4 text-muted-foreground/50" />
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      )}
    </Panel>
  )
}
