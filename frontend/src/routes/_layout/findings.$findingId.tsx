import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { createFileRoute, Link as RouterLink } from "@tanstack/react-router"
import {
  ArrowLeft,
  CircleAlert,
  FileText,
  History,
  Link2,
  Pencil,
  ScrollText,
  ShieldCheck,
} from "lucide-react"
import { useState } from "react"

import type {
  FindingEvidencePublic,
  FindingPublic,
  FindingValidationResult,
  ProvenanceEventPublic,
} from "@/client"
import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import {
  FindingEvidenceRoleChip,
  FindingStatusChip,
  FindingValidationChip,
} from "@/components/Findings/chips"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { LoadingButton } from "@/components/ui/loading-button"
import useCustomToast from "@/hooks/useCustomToast"
import { findingsApi } from "@/services/findings"
import { provenanceApi } from "@/services/provenance"

export const Route = createFileRoute("/_layout/findings/$findingId")({
  component: FindingDetail,
  head: () => ({
    meta: [
      {
        title: "Finding - OmicTerms",
      },
    ],
  }),
})

/** Where an evidence reference can deep-link in this product state. */
function evidenceHref(row: FindingEvidencePublic): string | null {
  switch (row.target_type) {
    case "document":
      return `/documents/${row.target_id}`
    case "graph_edge":
      return "/evidence"
    default:
      // Runs get their own detail surface with the analysis module (Story
      // 25/26); report passages arrive with Story 36. No fabricated links.
      return null
  }
}

function EvidenceQuote({ row }: { row: FindingEvidencePublic }) {
  const quote = row.quote_or_field?.quote
  const field = row.quote_or_field?.field
  if (typeof quote === "string" && quote.trim() !== "") {
    return (
      <p className="truncate rounded border border-border/60 bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground">
        quote: {quote}
      </p>
    )
  }
  if (typeof field === "string" && field.trim() !== "") {
    return (
      <p className="truncate rounded border border-border/60 bg-muted/40 px-2 py-1 font-mono text-[11px] text-muted-foreground">
        field: {field}
      </p>
    )
  }
  return null
}

function findingActivityText(event: ProvenanceEventPublic): string {
  const payload = (event.payload ?? {}) as Record<string, unknown>
  if (event.action === "finding.evidence_added") {
    return `evidence attached (${String(payload.target ?? "reference")})`
  }
  const fields = payload.fields_changed
  if (Array.isArray(fields) && fields.length > 0) {
    return fields.join(", ")
  }
  return event.action
}

function FindingDetail() {
  const { findingId } = Route.useParams()
  const queryClient = useQueryClient()
  const { showSuccessToast, showErrorToast } = useCustomToast()
  const [publishOpen, setPublishOpen] = useState(false)
  const [retractOpen, setRetractOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editTitle, setEditTitle] = useState("")
  const [editSummary, setEditSummary] = useState("")
  const [validationResult, setValidationResult] =
    useState<FindingValidationResult | null>(null)

  const findingQuery = useQuery({
    queryKey: ["finding", findingId],
    queryFn: () => findingsApi.readFinding(findingId),
    retry: false,
  })
  const finding: FindingPublic | undefined = findingQuery.data

  const versionsQuery = useQuery({
    queryKey: ["finding", findingId, "versions"],
    queryFn: () => findingsApi.listFindingVersions(findingId),
    enabled: Boolean(finding),
  })

  const activityQuery = useQuery({
    queryKey: ["finding", findingId, "activity"],
    queryFn: async () => {
      if (!finding) return []
      const events = await provenanceApi.listProjectEvents(finding.project_id, {
        limit: 200,
      })
      return (events.data ?? []).filter(
        (event) =>
          event.entity_type === "finding" && event.entity_id === finding.id,
      )
    },
    enabled: Boolean(finding),
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["finding", findingId] })
    queryClient.invalidateQueries({ queryKey: ["findings"] })
  }

  const validateMutation = useMutation({
    mutationFn: () => findingsApi.validateFinding(findingId),
    onSuccess: (result) => {
      setValidationResult(result)
      invalidate()
    },
  })

  const publishMutation = useMutation({
    mutationFn: () => findingsApi.publishFinding(findingId),
    onSuccess: (updated) => {
      showSuccessToast(`Finding published (v${updated.version})`)
      setPublishOpen(false)
      invalidate()
    },
    onError: (error) => {
      // The server owns the claim-to-evidence rule; surface it inline and let
      // the researcher act on the claim again.
      setPublishOpen(false)
      showErrorToast(`Publishing refused: ${String(error)}`)
    },
  })

  const retractMutation = useMutation({
    mutationFn: () => findingsApi.retractFinding(findingId),
    onSuccess: () => {
      showSuccessToast("Finding retracted — the claim is withdrawn, not erased")
      setRetractOpen(false)
      invalidate()
    },
    onError: (error) => {
      showErrorToast(`Retraction refused: ${String(error)}`)
    },
  })

  const editMutation = useMutation({
    mutationFn: () =>
      findingsApi.updateFinding(findingId, {
        title: editTitle.trim(),
        summary: editSummary.trim(),
      }),
    onSuccess: () => {
      showSuccessToast("Finding updated")
      setEditOpen(false)
      invalidate()
    },
    onError: (error) => {
      showErrorToast(`Edit refused: ${String(error)}`)
    },
  })

  const removeEvidenceMutation = useMutation({
    mutationFn: (evidenceId: string) =>
      findingsApi.removeEvidence(findingId, evidenceId),
    onSuccess: () => {
      showSuccessToast("Evidence reference removed")
      invalidate()
    },
    onError: (error) => {
      showErrorToast(`Removal refused: ${String(error)}`)
    },
  })

  if (findingQuery.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <div className="h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (findingQuery.isError || !finding) {
    return (
      <EmptyState
        icon={CircleAlert}
        title="Finding not found"
        body={findingQuery.isError ? String(findingQuery.error) : undefined}
        action={
          <Button variant="outline" size="sm" asChild>
            <RouterLink to="/findings">Back to findings</RouterLink>
          </Button>
        }
      />
    )
  }

  const isPublished = finding.status === "published"

  const openEdit = () => {
    setEditTitle(finding.title)
    setEditSummary(finding.summary)
    setEditOpen(true)
  }

  return (
    <div className="flex flex-col gap-4" data-testid="finding-detail">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <RouterLink to="/findings" aria-label="Back to findings">
            <ArrowLeft className="size-4" />
          </RouterLink>
        </Button>
        <div className="flex min-w-0 flex-col">
          <h1
            className="text-2xl font-bold tracking-tight"
            data-testid="finding-title"
          >
            {finding.title}
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <FindingStatusChip status={finding.status} />
            <FindingValidationChip
              state={
                validationResult?.validation_state_after ??
                finding.validation_state
              }
            />
            <span className="text-[11px] text-muted-foreground">
              v{finding.version} · updated{" "}
              {new Date(finding.updated_at).toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </span>
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={openEdit}
            disabled={isPublished}
            data-testid="edit-finding"
          >
            <Pencil className="size-3" />
            Edit
          </Button>
          <LoadingButton
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setPublishOpen(true)}
            disabled={isPublished || finding.status === "retracted"}
            data-testid="publish-finding"
          >
            <ShieldCheck className="size-3" />
            Publish
          </LoadingButton>
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setRetractOpen(true)}
            disabled={!isPublished}
            data-testid="retract-finding"
          >
            Retract
          </Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Panel
            title="Claim"
            icon={<FileText className="size-4 text-muted-foreground" />}
          >
            <p
              className="text-sm whitespace-pre-wrap"
              data-testid="finding-summary"
            >
              {finding.summary}
            </p>
            {finding.status === "retracted" ? (
              <p
                className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                data-testid="retraction-notice"
              >
                This claim was retracted. It stays visible for the record; a
                corrected edition returns through review and publishes as a new
                version.
              </p>
            ) : null}
          </Panel>

          <div
            className="rounded-xl border border-border/70 bg-card p-4"
            data-testid="validation-controls"
          >
            <p className="text-xs text-muted-foreground">
              Validation is decided by the server only: the button runs the
              deterministic checks against the attached evidence — nothing here
              can mark a claim validated by hand.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <LoadingButton
                variant="outline"
                size="sm"
                loading={validateMutation.isPending}
                onClick={() => validateMutation.mutate()}
                data-testid="validate-finding"
              >
                <ShieldCheck className="size-3" />
                Run validation checks
              </LoadingButton>
              {validationResult ? (
                <FindingValidationChip
                  state={validationResult.validation_state_after}
                />
              ) : null}
            </div>

            {validationResult ? (
              <div
                className={
                  validationResult.issues &&
                  validationResult.issues.length === 0
                    ? "mt-3 rounded-md border border-valid/40 bg-valid/10 px-3 py-2 text-xs text-valid"
                    : "mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive"
                }
                data-testid="validation-result-banner"
              >
                <p className="font-medium">
                  {validationResult.validation_state_after === "validated"
                    ? "All deterministic checks passed."
                    : "Checks did not pass — the claim stays put until the gaps are fixed."}
                </p>
                {validationResult.issues &&
                validationResult.issues.length > 0 ? (
                  <ul className="mt-1 list-disc space-y-0.5 pl-4">
                    {validationResult.issues.map((issue) => (
                      <li key={issue.code}>
                        {issue.code}: {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </div>

          <EvidenceSection
            rows={finding.evidence ?? []}
            frozen={isPublished}
            onRemove={(evidenceId) => removeEvidenceMutation.mutate(evidenceId)}
          />
        </div>

        <div className="flex flex-col gap-4">
          <Panel
            title="Activity history"
            icon={<History className="size-4 text-muted-foreground" />}
          >
            {activityQuery.isPending ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : (activityQuery.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">
                No recorded activity yet.
              </p>
            ) : (
              <ul
                className="flex flex-col divide-y"
                data-testid="finding-activity"
              >
                {(activityQuery.data ?? []).map((event) => (
                  <li key={event.id} className="py-2 text-xs">
                    <span className="font-medium">
                      {findingActivityText(event)}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {new Date(event.occurred_at).toLocaleString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel
            title="Published history"
            icon={<ScrollText className="size-4 text-muted-foreground" />}
          >
            {(versionsQuery.data?.count ?? 0) > 0 ? (
              <ul
                className="flex flex-col divide-y"
                data-testid="finding-versions"
              >
                {(versionsQuery.data?.data ?? []).map((entry) => (
                  <li key={entry.version} className="py-2 text-xs">
                    <span className="font-medium">
                      v{entry.version} · {entry.status}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {entry.title}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      ({new Date(entry.recorded_at).toLocaleDateString()})
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">
                Not published yet — every publish records the claim as it stood,
                so past versions stay reviewable.
              </p>
            )}
          </Panel>
        </div>
      </div>

      <Dialog open={publishOpen} onOpenChange={setPublishOpen}>
        <DialogContent data-testid="publish-confirm">
          <DialogHeader>
            <DialogTitle>Publish this claim?</DialogTitle>
            <DialogDescription>
              Publishing records the claim as it stands — it becomes versioned
              history. The claim must already carry at least one primary
              reference; the server refuses otherwise.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setPublishOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={publishMutation.isPending}
              onClick={() => publishMutation.mutate()}
            >
              Publish
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={retractOpen} onOpenChange={setRetractOpen}>
        <DialogContent data-testid="retract-confirm">
          <DialogHeader>
            <DialogTitle>Retract this claim?</DialogTitle>
            <DialogDescription>
              Retraction withdraws the claim from any further use. The record is
              kept — retracted claims stay visible as retracted, never silently
              deleted. A corrected edition can be published later as a new
              version.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setRetractOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => retractMutation.mutate()}
              data-testid="retract-confirm-button"
            >
              Retract claim
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent
          className="sm:max-w-lg"
          data-testid="edit-finding-dialog"
        >
          <DialogHeader>
            <DialogTitle>Edit finding</DialogTitle>
            <DialogDescription>
              Content edits are recorded in the activity history; publishing
              later snapshots the claim as a new version.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid gap-1.5">
              <Label htmlFor="edit-finding-title">Title</Label>
              <Input
                id="edit-finding-title"
                data-testid="edit-finding-title"
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                maxLength={256}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-finding-summary">Summary</Label>
              <textarea
                id="edit-finding-summary"
                data-testid="edit-finding-summary"
                className="flex min-h-16 w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={editSummary}
                onChange={(event) => setEditSummary(event.target.value)}
                rows={3}
                maxLength={4000}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <LoadingButton
              loading={editMutation.isPending}
              onClick={() => editMutation.mutate()}
              disabled={!editTitle.trim() || !editSummary.trim()}
            >
              Save changes
            </LoadingButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function EvidenceSection({
  rows,
  frozen,
  onRemove,
}: {
  rows: FindingEvidencePublic[]
  frozen: boolean
  onRemove: (evidenceId: string) => void
}) {
  return (
    <Panel
      title="Evidence"
      icon={<Link2 className="size-4 text-muted-foreground" />}
    >
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No references attached yet — a claim without material cannot be
          published or auto-validated.
        </p>
      ) : (
        <ul className="flex flex-col divide-y" data-testid="finding-evidence">
          {rows.map((row) => {
            const href = evidenceHref(row)
            return (
              <li key={row.id} className="flex flex-col gap-1 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <FindingEvidenceRoleChip role={row.role} />
                  <span className="text-[11px] text-muted-foreground uppercase tracking-wide">
                    {row.target_type}
                  </span>
                  {href ? (
                    <RouterLink
                      to={href}
                      className="text-xs font-medium hover:underline"
                      data-testid={`evidence-link-${row.id}`}
                    >
                      {row.label ?? row.target_id} →
                    </RouterLink>
                  ) : (
                    <span
                      className="text-xs font-medium"
                      data-testid={`evidence-label-${row.id}`}
                    >
                      {row.label ?? row.target_id}
                    </span>
                  )}
                  {!frozen ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto h-6 px-2 text-[11px] text-destructive"
                      onClick={() => onRemove(row.id)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
                <EvidenceQuote row={row} />
              </li>
            )
          })}
        </ul>
      )}
      {frozen ? (
        <p className="mt-3 text-[11px] text-muted-foreground">
          Published claims keep their evidence set frozen until retraction.
        </p>
      ) : null}
    </Panel>
  )
}
