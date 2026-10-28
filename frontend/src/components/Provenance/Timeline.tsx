import {
  Activity,
  Bot,
  Cog,
  Database,
  Download,
  FileText,
  FolderKanban,
  Microscope,
  ShieldCheck,
  TestTube,
  User as UserIcon,
} from "lucide-react"
import type { ProvenanceEventPublic } from "@/client"
import { StatusBadge } from "@/components/Common/StatusBadge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { formatDate, formatRelativeTime, formatTime } from "@/utils/format"

/** Categories derived from the backend's closed action registry prefixes. */
export const ACTION_CATEGORIES = [
  "project",
  "experiment",
  "sample",
  "document",
  "metadata",
  "extraction",
  "validation",
  "import",
] as const

export type ActionCategory = (typeof ACTION_CATEGORIES)[number]

export function actionCategory(action: string): ActionCategory {
  const prefix = action.split(".")[0]
  if ((ACTION_CATEGORIES as readonly string[]).includes(prefix)) {
    return prefix as ActionCategory
  }
  return "document"
}

const CATEGORY_ICON: Record<ActionCategory, typeof Activity> = {
  project: FolderKanban,
  experiment: Microscope,
  sample: TestTube,
  document: FileText,
  metadata: Database,
  extraction: Cog,
  validation: ShieldCheck,
  import: Download,
}

const ACTION_ICON: Record<string, typeof Activity> = {
  "extraction.failed": Activity,
  "import.failed": Download,
}

function fieldsList(payload: Record<string, unknown>): string {
  const fields = payload.fields
  if (Array.isArray(fields) && fields.every((f) => typeof f === "string")) {
    return (fields as string[]).join(", ")
  }
  return "no fields shown"
}

/** A human, payload-grounded message per action code. */
export function describeEvent(event: ProvenanceEventPublic): string {
  const payload: Record<string, unknown> = event.payload ?? {}
  // Dev-fixture rows carry their display text; real payloads never contain it.
  if (typeof payload.fixtureText === "string" && payload.fixtureText) {
    return payload.fixtureText
  }
  const name = (key: string, fallback = "—") => {
    const value = payload[key]
    return typeof value === "string" && value ? value : fallback
  }

  switch (event.action) {
    case "project.created":
      return `created project “${name("name")}”`
    case "project.updated":
      return `updated project (${fieldsList(payload)})`
    case "project.deleted":
      return `deleted project “${name("name")}”`
    case "experiment.created":
      return `created experiment “${name("name")}”`
    case "experiment.updated":
      return payload.before
        ? `renamed experiment “${payload.before}” → “${name("after")}”`
        : "updated experiment"
    case "experiment.deleted":
      return `deleted experiment “${name("name")}”`
    case "sample.created":
      return `created sample “${name("name")}”`
    case "sample.updated":
      return payload.before
        ? `renamed sample “${payload.before}” → “${name("after")}”`
        : "updated sample"
    case "sample.deleted":
      return `deleted sample “${name("name")}”`
    case "document.uploaded":
      return `uploaded ${name("filename")}`
    case "document.renamed":
      return payload.before
        ? `renamed document “${payload.before}” → “${name("after")}”`
        : "updated document name"
    case "document.deleted":
      return `deleted document ${name("filename")}`
    case "metadata.updated":
      return `declared dataset metadata (${fieldsList(payload)})`
    case "extraction.started":
      return "text extraction started"
    case "extraction.succeeded":
      return "text extraction succeeded"
    case "extraction.failed":
      return payload.error
        ? `extraction failed — ${payload.error}`
        : "extraction failed"
    case "validation.run": {
      const total = typeof payload.total === "number" ? payload.total : null
      return total === null
        ? "validation run executed"
        : `validation run found ${total} issue${total === 1 ? "" : "s"}`
    }
    case "import.origin":
      return `imported from ${String(payload.repo ?? "public repository").toUpperCase()} (${name("accession")})`
    case "import.succeeded":
      return "repository import succeeded"
    case "import.failed":
      return payload.error
        ? `repository import failed — ${payload.error}`
        : "repository import failed"
    case "user.updated":
      return `updated profile (${fieldsList(payload)})`
    case "user.password_changed":
      return "changed password"
    default:
      return event.action
  }
}

export function eventHref(event: ProvenanceEventPublic): string | undefined {
  if (event.entity_type === "document" && event.action !== "document.deleted") {
    return `/documents/${event.entity_id}`
  }
  return undefined
}

function dayKey(timestamp: string): string {
  const date = new Date(timestamp)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const same = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  if (same(date, today)) return "Today"
  if (same(date, yesterday)) return "Yesterday"
  return formatDate(timestamp)
}

function EventIcon({ event }: { event: ProvenanceEventPublic }) {
  const action = event.action
  const Icon =
    ACTION_ICON[action] ?? CATEGORY_ICON[actionCategory(action)] ?? Activity
  const failed =
    action.endsWith(".failed") ||
    (action === "validation.run" &&
      typeof event.payload?.errors === "number" &&
      event.payload.errors > 0)
  return (
    <Icon
      className={
        failed ? "size-4 text-destructive" : "size-4 text-muted-foreground/70"
      }
      aria-hidden
    />
  )
}

export function EventActor({
  event,
  actorName,
}: {
  event: ProvenanceEventPublic
  actorName: string
}) {
  if (event.actor_type === "user") {
    return (
      <span className="flex items-center gap-2">
        <Avatar className="size-7 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            {actorName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <span className="text-sm">{actorName}</span>
      </span>
    )
  }
  const isJob = event.actor_type === "job"
  return (
    <span
      className="flex items-center gap-2"
      data-testid={`event-actor-${event.actor_type}`}
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-accent-cyan/40 bg-accent-cyan/10">
        {isJob ? (
          <Cog className="size-3.5 text-accent-cyan" aria-hidden />
        ) : (
          <Bot className="size-3.5 text-accent-cyan" aria-hidden />
        )}
      </span>
      <StatusBadge variant="pending">{event.actor_type}</StatusBadge>
    </span>
  )
}

export function TimelineRow({
  event,
  actorName,
}: {
  event: ProvenanceEventPublic
  actorName: string
}) {
  const href = eventHref(event)
  const timestamp = event.occurred_at
  return (
    <li
      data-testid="provenance-row"
      data-action={event.action}
      className="flex items-start gap-3 px-4 py-3 sm:items-center"
    >
      <EventIcon event={event} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <EventActor event={event} actorName={actorName} />
          <span className="text-sm text-muted-foreground">
            {describeEvent(event)}
          </span>
          {event.payload?.fixtureText ? (
            <span className="text-[11px] font-medium text-warning">
              fixture
            </span>
          ) : null}
        </div>
        <span className="block text-xs text-muted-foreground sm:hidden">
          {formatRelativeTime(timestamp)}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <time
          dateTime={timestamp}
          title={`${formatDate(timestamp)} ${formatTime(timestamp)}`}
          className="readout hidden text-xs text-muted-foreground sm:block"
        >
          {formatRelativeTime(timestamp)}
        </time>
        {href ? (
          <a
            href={href}
            className="text-xs text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            View
          </a>
        ) : (
          <UserIcon className="size-4 opacity-0" aria-hidden />
        )}
      </div>
    </li>
  )
}

/**
 * Timeline grouped by day (Today / Yesterday / date). Purely presentational:
 * data and pagination are owned by the callers (dashboard panel and the
 * project activity page share this component).
 */
export function ProvenanceTimeline({
  events,
  actorName,
}: {
  events: ProvenanceEventPublic[]
  actorName: string
}) {
  const groups: { label: string; events: ProvenanceEventPublic[] }[] = []
  for (const event of events) {
    const label = dayKey(event.occurred_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.events.push(event)
    } else {
      groups.push({ label, events: [event] })
    }
  }
  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h4 className="border-b px-4 py-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {group.label}
          </h4>
          <ol className="flex flex-col divide-y">
            {group.events.map((event) => (
              <TimelineRow key={event.id} event={event} actorName={actorName} />
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}
