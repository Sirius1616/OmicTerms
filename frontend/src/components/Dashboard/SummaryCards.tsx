import { Link } from "@tanstack/react-router"
import {
  FileText,
  FolderKanban,
  GraduationCap,
  RotateCcw,
  ShieldCheck,
  Target,
} from "lucide-react"

import { MetricCard } from "@/components/Common/MetricCard"
import { Button } from "@/components/ui/button"
import type { DashboardFixtures } from "@/fixtures/dashboard"

interface SummaryCardsProps {
  loading: boolean
  error: boolean
  onRetry: () => void
  counts: {
    projects: number
    experiments: number
    samples: number
    documents: number
    extracting: number
    failed: number
  }
  integrityTotal: number
  fixtures: DashboardFixtures | null
}

export function SummaryCards({
  loading,
  error,
  onRetry,
  counts,
  integrityTotal,
  fixtures,
}: SummaryCardsProps) {
  if (error) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
        <span>Could not load summary metrics.</span>
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="size-4" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
      <MetricCard
        label="Active projects"
        icon={FolderKanban}
        state={loading ? "loading" : "value"}
        value={counts.projects}
        context={`${counts.experiments} experiments · ${counts.samples} samples`}
        footer={
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            asChild
          >
            <Link to="/projects">View projects</Link>
          </Button>
        }
      />

      <MetricCard
        label="Data files"
        icon={FileText}
        state={loading ? "loading" : "value"}
        value={counts.documents}
        context={`${counts.extracting} extracting · ${counts.failed} failed`}
        footer={
          <Button
            variant="link"
            size="sm"
            className="h-auto p-0 text-xs"
            asChild
          >
            <Link to="/documents">Open data sources</Link>
          </Button>
        }
      />

      {fixtures ? (
        <MetricCard
          label="Data integrity"
          icon={ShieldCheck}
          state="value"
          value={`${fixtures.integrity.datasetsWithChecksums.have} / ${
            fixtures.integrity.datasetsWithChecksums.total
          }`}
          context="fixture data — checksums recorded"
        />
      ) : (
        <MetricCard
          label="Data integrity"
          icon={ShieldCheck}
          state="unavailable"
          unavailableReason={`Validation engine lands in M2 (${integrityTotal} files pending)`}
        />
      )}

      {fixtures ? (
        <MetricCard
          label="Key findings"
          icon={Target}
          state="value"
          value={fixtures.keyFindingsCount}
          context="fixture data"
          footer={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              asChild
            >
              <Link to="/evidence">Inspect evidence</Link>
            </Button>
          }
        />
      ) : (
        <MetricCard
          label="Key findings"
          icon={Target}
          state="empty"
          context="No findings yet — findings will link claims to their evidence."
          footer={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              asChild
            >
              <Link to="/evidence">About evidence</Link>
            </Button>
          }
        />
      )}

      {fixtures ? (
        <MetricCard
          label="Learning progress"
          icon={GraduationCap}
          state="value"
          value={`${fixtures.academy.percent}%`}
          context={`${fixtures.academy.completedModules} of ${fixtures.academy.totalModules} modules (fixture)`}
          footer={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              asChild
            >
              <Link to="/academy">Open Academy</Link>
            </Button>
          }
        />
      ) : (
        <MetricCard
          label="Learning progress"
          icon={GraduationCap}
          state="empty"
          context="Start the Academy path"
          footer={
            <Button
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              asChild
            >
              <Link to="/academy">Start learning</Link>
            </Button>
          }
        />
      )}
    </div>
  )
}
