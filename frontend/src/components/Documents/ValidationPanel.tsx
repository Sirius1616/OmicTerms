import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Loader2, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react"
import { useState } from "react"
import type {
  ValidationIssuePublic,
  ValidationRunPublic,
  ValidationSeverity,
} from "@/client"
import { StatusBadge } from "@/components/Common/StatusBadge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import useCustomToast from "@/hooks/useCustomToast"
import { cn } from "@/lib/utils"
import { validationCodeDocUrl, validationsApi } from "@/services/validations"
import { handleError } from "@/utils"

const SEVERITY_ORDER: ValidationSeverity[] = [
  "error",
  "warning",
  "info",
  "skipped",
]

const SEVERITY_LABELS: Record<ValidationSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
  skipped: "Skipped",
}

const SEVERITY_VARIANTS: Record<
  ValidationSeverity,
  "error" | "warning" | "info" | "neutral"
> = {
  error: "error",
  warning: "warning",
  info: "info",
  skipped: "neutral",
}

function runCounts(run: ValidationRunPublic) {
  const counts: Record<ValidationSeverity, number> & { total: number } = {
    error: 0,
    warning: 0,
    info: 0,
    skipped: 0,
    total: run.issues?.length ?? 0,
  }
  for (const issue of run.issues ?? []) {
    if (issue.severity in counts) {
      counts[issue.severity as ValidationSeverity] += 1
    }
  }
  return counts
}

function SeverityChip({
  severity,
  count,
}: {
  severity: ValidationSeverity
  count: number
}) {
  return (
    <StatusBadge variant={SEVERITY_VARIANTS[severity]}>
      {SEVERITY_LABELS[severity]}: {count}
    </StatusBadge>
  )
}

function IssueRow({ issue }: { issue: ValidationIssuePublic }) {
  return (
    <li
      data-testid={`validation-issue-${issue.severity}`}
      className={cn(
        "flex flex-col gap-1 rounded-lg border p-3",
        issue.severity === "error" && "border-destructive/30 bg-destructive/5",
        issue.severity === "warning" && "border-warning/30 bg-warning/5",
        issue.severity === "info" && "border-primary/20 bg-primary/5",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge variant={SEVERITY_VARIANTS[issue.severity]}>
          {issue.code}
        </StatusBadge>
        <span className="text-sm font-medium">{issue.message}</span>
      </div>
      {issue.detail && (
        <p className="text-xs text-muted-foreground">{issue.detail}</p>
      )}
      {issue.suggestion && (
        <p className="text-xs">
          <span className="font-medium">Suggestion: </span>
          {issue.suggestion}
        </p>
      )}
      <a
        href={validationCodeDocUrl(issue.code)}
        target="_blank"
        rel="noreferrer"
        className="text-xs text-primary underline-offset-4 hover:underline"
      >
        What does {issue.code} mean?
      </a>
    </li>
  )
}

function IssueGroups({ issues }: { issues: ValidationIssuePublic[] }) {
  return (
    <div className="flex flex-col gap-4">
      {SEVERITY_ORDER.map((severity) => {
        const group = issues.filter((issue) => issue.severity === severity)
        if (group.length === 0) return null
        return (
          <section
            key={severity}
            aria-label={SEVERITY_LABELS[severity]}
            className="flex flex-col gap-2"
          >
            <h4 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              {SEVERITY_LABELS[severity]}
            </h4>
            <ul className="flex flex-col gap-2">
              {group.map((issue) => (
                <IssueRow key={issue.id} issue={issue} />
              ))}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function runLabel(run: ValidationRunPublic, index: number, total: number) {
  const counts = runCounts(run)
  const time = new Date(run.started_at).toLocaleString()
  const parts: string[] = []
  if (counts.error) parts.push(`${counts.error} errors`)
  if (counts.warning) parts.push(`${counts.warning} warnings`)
  if (counts.info) parts.push(`${counts.info} info`)
  if (counts.skipped) parts.push(`${counts.skipped} skipped`)
  const latestTag = index === 0 ? " · latest" : ""
  return `Run ${total - index} of ${total}${latestTag} · ${time} · ${
    parts.length ? parts.join(", ") : "no issues"
  }`
}

function formatRunTime(run: ValidationRunPublic): string {
  const started = new Date(run.started_at).getTime()
  const finished = run.finished_at
    ? new Date(run.finished_at).getTime()
    : started
  const seconds = Math.max(0, (finished - started) / 1000)
  return seconds < 1 ? "<1 s" : `${seconds.toFixed(1)} s`
}

interface ValidationPanelProps {
  documentId: string
  extractionPending: boolean
}

export function ValidationPanel({
  documentId,
  extractionPending,
}: ValidationPanelProps) {
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["document-validations", documentId],
    queryFn: () => validationsApi.listDocumentValidations(documentId),
    refetchInterval: extractionPending ? 3000 : false,
  })

  const revalidate = useMutation({
    mutationFn: () => validationsApi.revalidateDocument(documentId),
    onSuccess: (run) => {
      queryClient.invalidateQueries({
        queryKey: ["document-validations", documentId],
      })
      queryClient.invalidateQueries({
        queryKey: ["document-cross-validations", documentId],
      })
      setSelectedRunId(run.id)
      showSuccessToast("Validation run completed")
    },
    onError: handleError.bind(showErrorToast),
  })

  const runs = data?.data ?? []
  const latestRun = runs[0] ?? null
  const selectedRun = runs.find((run) => run.id === selectedRunId) ?? latestRun

  const counts = selectedRun ? runCounts(selectedRun) : null
  const isLatest = Boolean(
    selectedRun && latestRun && selectedRun.id === latestRun.id,
  )

  return (
    <Card data-testid="data-integrity">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-muted-foreground" />
            <CardTitle>Data integrity</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => revalidate.mutate()}
            disabled={revalidate.isPending || extractionPending}
          >
            {revalidate.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="size-4" aria-hidden />
            )}
            Revalidate
          </Button>
        </div>
        <CardDescription>
          Deterministic checks on this file. Errors must be resolved before the
          data is used in analysis or reports; skipped checks explain why they
          did not run.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <TriangleAlert className="size-5 text-warning" aria-hidden />
            <p className="text-sm text-muted-foreground">
              Could not load validation results.
            </p>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        ) : !latestRun ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="text-sm text-muted-foreground">Not yet validated.</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => revalidate.mutate()}
              disabled={revalidate.isPending || extractionPending}
            >
              Run validation
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-4" aria-live="polite">
            <div className="flex flex-wrap items-center gap-2">
              {counts &&
                SEVERITY_ORDER.map((severity) =>
                  counts[severity] > 0 ? (
                    <SeverityChip
                      key={severity}
                      severity={severity}
                      count={counts[severity]}
                    />
                  ) : null,
                )}
              {counts && counts.total === 0 && (
                <StatusBadge variant="valid">No issues</StatusBadge>
              )}
              <span className="text-xs text-muted-foreground">
                {formatRunTime(selectedRun!)} · trigger: {selectedRun!.trigger}
                {!isLatest && " (historical run)"}
              </span>
            </div>

            {runs.length > 1 && (
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="validation-run-history"
                  className="text-xs text-muted-foreground"
                >
                  Run history
                </label>
                <Select
                  value={selectedRun?.id ?? undefined}
                  onValueChange={setSelectedRunId}
                >
                  <SelectTrigger id="validation-run-history" className="w-full">
                    <SelectValue placeholder="Select a run" />
                  </SelectTrigger>
                  <SelectContent>
                    {runs.map((run, index) => (
                      <SelectItem key={run.id} value={run.id}>
                        {runLabel(run, index, runs.length)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {selectedRun && (selectedRun.issues?.length ?? 0) > 0 ? (
              <IssueGroups issues={selectedRun.issues ?? []} />
            ) : (
              <p className="text-sm text-muted-foreground">
                This run found no issues.
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CrossValidationBanner({ documentId }: { documentId: string }) {
  const { data } = useQuery({
    queryKey: ["document-cross-validations", documentId],
    queryFn: () => validationsApi.listDocumentCrossValidations(documentId),
  })

  const latest = data?.data?.[0]
  if (!latest) return null
  const counts = runCounts(latest)

  return (
    <div
      data-testid="cross-validation-banner"
      role="status"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm"
    >
      <span className="font-medium">Cross-file checks</span>
      {SEVERITY_ORDER.map((severity) =>
        counts[severity] > 0 ? (
          <SeverityChip
            key={severity}
            severity={severity}
            count={counts[severity]}
          />
        ) : null,
      )}
      <span className="text-xs text-muted-foreground">
        Latest experiment-level run ·{" "}
        {new Date(latest.started_at).toLocaleString()}
      </span>
    </div>
  )
}

export default ValidationPanel
