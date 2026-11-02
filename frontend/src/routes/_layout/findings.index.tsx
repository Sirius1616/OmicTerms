import { createFileRoute, Link } from "@tanstack/react-router"
import { Plus, Target } from "lucide-react"
import { useState } from "react"
import { EmptyState } from "@/components/Common/EmptyState"
import { PageHeader } from "@/components/Common/PageHeader"
import { CreateFindingDialog } from "@/components/Findings/CreateFindingDialog"
import {
  FindingEvidenceCountChip,
  FindingStatusChip,
  FindingValidationChip,
} from "@/components/Findings/chips"
import { Button } from "@/components/ui/button"
import { useAllFindings } from "@/hooks/useFindings"

export const Route = createFileRoute("/_layout/findings/")({
  component: FindingsList,
  head: () => ({
    meta: [
      {
        title: "Findings - OmicTerms",
      },
    ],
  }),
})

function FindingsList() {
  const findings = useAllFindings()
  const [createOpen, setCreateOpen] = useState(false)

  const rows = findings.data ?? []

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Findings"
        description="Research claims tied to their supporting material — nothing is a finding until it is backed by data."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="gap-1"
            onClick={() => setCreateOpen(true)}
            data-testid="new-finding-button"
          >
            <Plus className="size-3.5" />
            New finding
          </Button>
        }
      />

      {findings.isPending ? (
        <div
          className="flex flex-col gap-2"
          data-testid="findings-list-loading"
        >
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="h-20 animate-pulse rounded-xl border border-border/70 bg-card"
            />
          ))}
        </div>
      ) : findings.isError ? (
        <EmptyState
          icon={Target}
          title="Findings could not be loaded"
          body={String(findings.error)}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => findings.refetch()}
            >
              Retry
            </Button>
          }
        />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Target}
          title="No findings yet"
          body="Record a claim and attach the material that supports it. Publishing requires at least one primary reference, so a claim is never free-floating text."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              New finding
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3" data-testid="findings-list">
          {rows.map(({ finding, projectName }) => (
            <li
              key={finding.id}
              data-testid="findings-list-row"
              className="rounded-xl border border-border/70 bg-card p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <Link
                  to="/findings/$findingId"
                  params={{ findingId: finding.id }}
                  className="text-sm font-medium hover:underline"
                >
                  {finding.title}
                </Link>
                <div className="flex flex-wrap items-center gap-1.5">
                  <FindingValidationChip state={finding.validation_state} />
                  <FindingStatusChip status={finding.status} />
                  <FindingEvidenceCountChip finding={finding} />
                </div>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {finding.summary}
              </p>
              <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{projectName}</span>
                <span>
                  updated{" "}
                  {new Date(finding.updated_at).toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}

      <CreateFindingDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
