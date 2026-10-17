import { Info, ShieldCheck } from "lucide-react"

import { Panel } from "@/components/Common/Panel"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { IntegrityMetric } from "@/hooks/useDashboardData"

function MetricRow({
  label,
  metric,
  measurement,
  format,
}: {
  label: string
  metric: IntegrityMetric
  measurement: string
  format: (metric: IntegrityMetric) => string
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="flex items-center gap-1.5">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`How ${label} is measured`}
              className="text-muted-foreground/70 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Info className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">{measurement}</TooltipContent>
        </Tooltip>
      </div>
      <div className="text-right">
        <span className="readout text-sm font-semibold tabular-nums">
          {format(metric)}
        </span>
        <span className="block text-[11px] text-muted-foreground">
          {metric.context}
        </span>
      </div>
    </div>
  )
}

export function EvidenceQualityPanel({
  integrity,
}: {
  integrity: Record<string, IntegrityMetric>
}) {
  return (
    <Panel
      title="Evidence quality"
      icon={<ShieldCheck className="size-4 text-muted-foreground" />}
      bodyClassName="divide-y py-1"
    >
      <MetricRow
        label="Datasets with checksums"
        metric={integrity.checksums}
        measurement="Share of uploaded files whose SHA-256 checksum has been recorded. Checksums arrive in milestone M2."
        format={(metric) =>
          `${metric.numerator ?? 0} / ${metric.denominator ?? 0}`
        }
      />
      <MetricRow
        label="Validation runs"
        metric={integrity.validationRuns}
        measurement="Number of format and cross-file validation runs recorded against your datasets. The validation engine lands in milestone M2."
        format={(metric) =>
          metric.value === null ? "—" : String(metric.value)
        }
      />
      <MetricRow
        label="Provenance coverage"
        metric={integrity.provenanceCoverage}
        measurement="Share of datasets with a complete provenance trail. The provenance log arrives in milestone M2."
        format={(metric) =>
          metric.value === null ? "—" : `${Math.round(metric.value * 100)}%`
        }
      />
    </Panel>
  )
}
