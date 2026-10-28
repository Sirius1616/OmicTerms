import { Handle, type NodeProps, Position } from "@xyflow/react"
import { memo } from "react"
import {
  AnalysisGlyph,
  DnaGlyph,
  ExperimentGlyph,
  ExpressionGlyph,
  FindingGlyph,
  GraphGlyph,
  MethylationGlyph,
  MicrobiomeGlyph,
  omicsClasses,
  PeakGlyph,
  ProteinGlyph,
  ReportGlyph,
  SampleGlyph,
} from "@/components/Common/ScientificIcons"
import type { EvidenceNodeKind } from "@/fixtures/dashboard"
import { cn } from "@/lib/utils"

/** Kinds that are structural facts, not measured or computed results. */
const STRUCTURAL_KINDS: ReadonlySet<EvidenceNodeKind> = new Set([
  "project",
  "experiment",
  "sample",
])

const KIND_META: Record<
  EvidenceNodeKind,
  {
    label: string
    token:
      | "--omics-variants"
      | "--omics-expression"
      | "--omics-methylation"
      | "--omics-peaks"
      | "--omics-proteomics"
      | "--omics-microbiome"
      | "--omics-sample"
      | "--omics-project"
      | "--omics-experiment"
      | "--omics-analysis"
      | "--omics-finding"
      | "--omics-document"
    Icon: typeof DnaGlyph
    chip: string
  }
> = {
  variants: {
    label: "Variants",
    token: "--omics-variants",
    Icon: DnaGlyph,
    chip: "GEN",
  },
  expression: {
    label: "Expression",
    token: "--omics-expression",
    Icon: ExpressionGlyph,
    chip: "EXP",
  },
  methylation: {
    label: "Methylation",
    token: "--omics-methylation",
    Icon: MethylationGlyph,
    chip: "MET",
  },
  peaks: {
    label: "Peaks",
    token: "--omics-peaks",
    Icon: PeakGlyph,
    chip: "CHIP",
  },
  proteomics: {
    label: "Proteomics",
    token: "--omics-proteomics",
    Icon: ProteinGlyph,
    chip: "PROT",
  },
  microbiome: {
    label: "Microbiome",
    token: "--omics-microbiome",
    Icon: MicrobiomeGlyph,
    chip: "MIC",
  },
  sample: {
    label: "Samples",
    token: "--omics-sample",
    Icon: SampleGlyph,
    chip: "SMPL",
  },
  project: {
    label: "Project",
    token: "--omics-project",
    Icon: GraphGlyph,
    chip: "PRJ",
  },
  experiment: {
    label: "Experiment",
    token: "--omics-experiment",
    Icon: ExperimentGlyph,
    chip: "EXPT",
  },
  dataset: {
    label: "Document file",
    token: "--omics-document",
    Icon: ReportGlyph,
    chip: "DOC",
  },
  analysis: {
    label: "Analysis Run",
    token: "--omics-analysis",
    Icon: AnalysisGlyph,
    chip: "RUN",
  },
  finding: {
    label: "Candidate Finding",
    token: "--omics-finding",
    Icon: FindingGlyph,
    chip: "FIND",
  },
  report: {
    label: "Report",
    token: "--omics-document",
    Icon: ReportGlyph,
    chip: "RPT",
  },
}

const CERTAINTY_STYLE: Record<string, string> = {
  observed: "ring-1 ring-emerald-400/70",
  derived: "ring-1 ring-cyan-400/70",
  inferred: "ring-1 ring-amber-400/70",
}

export type EvidenceNodeData = {
  label: string
  kind: EvidenceNodeKind
  certainty: "observed" | "derived" | "inferred"
  detail?: string
  stage?: string
  /** In-app route to the source record, set for real-data nodes. */
  href?: string
}

function EvidenceNodeComponent({ data, selected }: NodeProps) {
  const nodeData = data as EvidenceNodeData
  const meta = KIND_META[nodeData.kind]
  const classes = omicsClasses(meta.token)
  const certaintyRing = STRUCTURAL_KINDS.has(nodeData.kind)
    ? ""
    : CERTAINTY_STYLE[nodeData.certainty] || ""

  return (
    <div
      data-testid="evidence-node"
      className={cn(
        "group relative flex w-[240px] items-center gap-3 rounded-lg border px-3 py-2 shadow-[0_10px_60px_-30px_var(--evidence-glow-strong)] transition-all",
        classes.border,
        classes.bg,
        selected
          ? "shadow-[0_0_0_1px_var(--evidence-glow-ring),0_30px_80px_-40px_var(--evidence-glow-strong)]"
          : "hover:shadow-[0_0_0_1px_var(--evidence-glow-soft)]",
        selected ? certaintyRing : "",
      )}
      style={{
        borderColor:
          "color-mix(in oklch, var(--accent-omics) 42%, transparent)",
        backgroundColor:
          "color-mix(in oklch, var(--accent-omics) 10%, transparent)",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-cyan-400/80 !border-cyan-200/60"
      />
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-md border",
          classes.border,
          classes.bg,
        )}
      >
        <meta.Icon className={cn("size-4", classes.text)} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="truncate text-sm font-medium text-foreground">
            {nodeData.label}
          </p>
          <span
            className={cn(
              "rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide",
              classes.text,
            )}
          >
            {meta.chip}
          </span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {meta.label}
        </p>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!bg-cyan-400/80 !border-cyan-200/60"
      />
    </div>
  )
}

export const EvidenceNode = memo(EvidenceNodeComponent)
