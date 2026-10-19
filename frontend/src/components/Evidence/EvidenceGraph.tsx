import type { CSSProperties } from "react"
import { useId, useMemo, useState } from "react"

import {
  AnalysisGlyph,
  DnaGlyph,
  ExpressionGlyph,
  FindingGlyph,
  type IconComponent,
  MethylationGlyph,
  MicrobiomeGlyph,
  type OmicsToken,
  omicsClasses,
  PeakGlyph,
  ProteinGlyph,
  ReportGlyph,
  SampleGlyph,
} from "@/components/Common/ScientificIcons"
import type {
  EvidenceCertainty,
  EvidenceEdgeKind,
  EvidenceNodeKind,
  EvidenceStage,
  FixtureGraphEdge,
  FixtureGraphNode,
} from "@/fixtures/dashboard"
import { cn } from "@/lib/utils"

const STAGES: { id: EvidenceStage; label: string; caption: string }[] = [
  { id: "omics", label: "Omics layers", caption: "Observed data" },
  { id: "samples", label: "Samples", caption: "Study design" },
  { id: "analysis", label: "Analysis runs", caption: "Derived results" },
  { id: "findings", label: "Findings", caption: "Inferred" },
  { id: "reports", label: "Reports", caption: "Cited output" },
]

const NODE_META: Record<
  EvidenceNodeKind,
  { label: string; token: OmicsToken; Icon: IconComponent }
> = {
  variants: { label: "Variants", token: "--omics-variants", Icon: DnaGlyph },
  expression: {
    label: "Expression",
    token: "--omics-expression",
    Icon: ExpressionGlyph,
  },
  methylation: {
    label: "Methylation",
    token: "--omics-methylation",
    Icon: MethylationGlyph,
  },
  peaks: { label: "Peaks", token: "--omics-peaks", Icon: PeakGlyph },
  proteomics: {
    label: "Proteomics",
    token: "--omics-proteomics",
    Icon: ProteinGlyph,
  },
  microbiome: {
    label: "Microbiome",
    token: "--omics-microbiome",
    Icon: MicrobiomeGlyph,
  },
  sample: { label: "Samples", token: "--omics-sample", Icon: SampleGlyph },
  analysis: {
    label: "Analysis run",
    token: "--omics-analysis",
    Icon: AnalysisGlyph,
  },
  finding: {
    label: "Candidate finding",
    token: "--omics-finding",
    Icon: FindingGlyph,
  },
  report: { label: "Report", token: "--omics-document", Icon: ReportGlyph },
}

const EDGE_META: Record<
  EvidenceEdgeKind,
  { label: string; stroke: string; dash?: string; note: string }
> = {
  membership: {
    label: "Membership",
    stroke: "var(--border-strong)",
    note: "data belongs to a sample or experiment",
  },
  provenance: {
    label: "Provenance",
    stroke: "var(--omics-analysis)",
    note: "result produced by an analysis run",
  },
  support: {
    label: "Support",
    stroke: "var(--omics-finding)",
    dash: "6 4",
    note: "evidence that supports a finding",
  },
  citation: {
    label: "Citation",
    stroke: "var(--muted-foreground)",
    dash: "2 4",
    note: "finding cited by a report",
  },
}

const CERTAINTY_META: Record<
  EvidenceCertainty,
  { label: string; border: string; note: string }
> = {
  observed: {
    label: "Observed",
    border: "border-solid",
    note: "measured directly from data",
  },
  derived: {
    label: "Derived",
    border: "border-dashed",
    note: "computed by an analysis run",
  },
  inferred: {
    label: "Inferred",
    border: "border-dotted",
    note: "a candidate interpretation, not yet validated",
  },
}

const GHOST_KINDS: Record<EvidenceStage, EvidenceNodeKind[]> = {
  omics: ["variants", "expression", "methylation", "peaks", "proteomics"],
  samples: ["sample"],
  analysis: ["analysis"],
  findings: ["finding"],
  reports: ["report"],
}

const VB_W = 760
const VB_H = 440
const COL_X = [0.1, 0.3, 0.5, 0.7, 0.9]
const BAND_TOP = 0.16
const BAND_BOTTOM = 0.84

type PositionedNode = FixtureGraphNode & {
  xPct: number
  yPct: number
  x: number
  y: number
}

function layout(nodes: FixtureGraphNode[]): PositionedNode[] {
  return STAGES.flatMap((stage, columnIndex) => {
    const stageNodes = nodes.filter((node) => node.stage === stage.id)
    if (stageNodes.length === 0) return []
    const center = (BAND_TOP + BAND_BOTTOM) / 2
    return stageNodes.map((node, index) => {
      const yPct =
        stageNodes.length <= 1
          ? center
          : BAND_TOP +
            (index / (stageNodes.length - 1)) * (BAND_BOTTOM - BAND_TOP)
      const xPct = COL_X[columnIndex] ?? center
      return {
        ...node,
        xPct: xPct * 100,
        yPct: yPct * 100,
        x: xPct * VB_W,
        y: yPct * VB_H,
      }
    })
  })
}

function edgePath(from: PositionedNode, to: PositionedNode): string {
  const dx = to.x - from.x
  if (Math.abs(dx) < 1) {
    const bulge = 52
    return `M ${from.x} ${from.y} C ${from.x + bulge} ${from.y}, ${to.x + bulge} ${to.y}, ${to.x} ${to.y}`
  }
  const cx = dx * 0.5
  return `M ${from.x} ${from.y} C ${from.x + cx} ${from.y}, ${to.x - cx} ${to.y}, ${to.x} ${to.y}`
}

function StageHeaders() {
  return (
    <div className="grid grid-cols-5 gap-2 px-1">
      {STAGES.map((stage) => (
        <div key={stage.id} className="text-center">
          <div className="text-[11px] font-medium text-foreground">
            {stage.label}
          </div>
          <div className="text-[10px] text-muted-foreground">
            {stage.caption}
          </div>
        </div>
      ))}
    </div>
  )
}

function CertaintyLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-medium text-foreground">Certainty</span>
      {Object.entries(CERTAINTY_META).map(([key, meta]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5"
          title={meta.note}
        >
          <span
            className={cn(
              "size-3 rounded-sm border border-muted-foreground/60 bg-card",
              meta.border,
            )}
          />
          {meta.label}
        </span>
      ))}
    </div>
  )
}

function EdgeLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <span className="font-medium text-foreground">Links</span>
      {Object.entries(EDGE_META).map(([key, meta]) => (
        <span
          key={key}
          className="inline-flex items-center gap-1.5"
          title={meta.note}
        >
          <svg width="20" height="6" aria-hidden="true">
            <line
              x1="0"
              y1="3"
              x2="20"
              y2="3"
              stroke={meta.stroke}
              strokeWidth="1.5"
              strokeDasharray={meta.dash}
            />
          </svg>
          {meta.label}
        </span>
      ))}
    </div>
  )
}

function IdentityLegend({ kinds }: { kinds: EvidenceNodeKind[] }) {
  if (kinds.length === 0) return null
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span className="font-medium text-foreground">Layers</span>
      {kinds.map((kind) => {
        const meta = NODE_META[kind]
        const classes = omicsClasses(meta.token)
        return (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <meta.Icon className={cn("size-3.5", classes.text)} />
            {meta.label}
          </span>
        )
      })}
    </div>
  )
}

function EmptyGraph() {
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[760px]">
        <StageHeaders />
        <div className="mt-3 grid grid-cols-5 gap-2 rounded-lg border border-dashed bg-background/40 p-3">
          {STAGES.map((stage) => (
            <div key={stage.id} className="flex flex-col gap-2">
              {GHOST_KINDS[stage.id].map((kind) => {
                const meta = NODE_META[kind]
                return (
                  <div
                    key={kind}
                    className="flex items-center gap-1.5 rounded-lg border border-dashed px-2 py-1.5 text-[11px] text-muted-foreground"
                  >
                    <meta.Icon className="size-3.5 shrink-0" />
                    <span className="truncate">{meta.label}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

interface EvidenceGraphProps {
  graph: { nodes: FixtureGraphNode[]; edges: FixtureGraphEdge[] } | null
  notice?: string
  /** Show the full identity legend (used on the dedicated evidence page). */
  full?: boolean
  className?: string
}

export function EvidenceGraph({
  graph,
  notice,
  full = false,
  className,
}: EvidenceGraphProps) {
  const rawId = useId()
  const uid = rawId.replace(/[^a-zA-Z0-9]/g, "")
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const positioned = useMemo(() => (graph ? layout(graph.nodes) : []), [graph])
  const byId = useMemo(
    () => new Map(positioned.map((node) => [node.id, node])),
    [positioned],
  )
  const kinds = useMemo(
    () =>
      graph
        ? (Array.from(
            new Set(graph.nodes.map((n) => n.kind)),
          ) as EvidenceNodeKind[])
        : [],
    [graph],
  )

  if (!graph) {
    return (
      <div
        className={cn("w-full text-muted-foreground", className)}
        data-testid="evidence-graph"
      >
        <EmptyGraph />
        <div className="mt-3 text-[10px]">
          <CertaintyLegend />
        </div>
      </div>
    )
  }

  const selected = selectedId ? (byId.get(selectedId) ?? null) : null

  const connectedEdges = selected
    ? graph.edges.filter(
        (edge) => edge.from === selected.id || edge.to === selected.id,
      )
    : []

  const connectedNodeIds = new Set<string>()
  if (selected) {
    connectedNodeIds.add(selected.id)
    for (const edge of connectedEdges) {
      connectedNodeIds.add(edge.from)
      connectedNodeIds.add(edge.to)
    }
  }

  return (
    <div className={cn("w-full", className)} data-testid="evidence-graph">
      <div className="overflow-x-auto pb-1">
        <div className="min-w-[760px]">
          <StageHeaders />
          <div
            className="relative mt-3 h-[22rem] w-full rounded-lg border bg-background/40 xl:h-[24rem]"
            data-testid="evidence-graph-canvas"
          >
            <svg
              viewBox={`0 0 ${VB_W} ${VB_H}`}
              preserveAspectRatio="none"
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
            >
              <defs>
                {Object.entries(EDGE_META).map(([kind, meta]) => (
                  <marker
                    key={kind}
                    id={`${uid}-arrow-${kind}`}
                    viewBox="0 0 10 10"
                    refX="8"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    markerUnits="userSpaceOnUse"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 1 L 8 5 L 0 9 z" fill={meta.stroke} />
                  </marker>
                ))}
              </defs>
              {graph.edges.map((edge) => {
                const from = byId.get(edge.from)
                const to = byId.get(edge.to)
                if (!from || !to) return null
                const meta = EDGE_META[edge.kind]
                const isActive =
                  selected?.id === edge.from || selected?.id === edge.to
                return (
                  <path
                    key={edge.id}
                    d={edgePath(from, to)}
                    fill="none"
                    stroke={meta.stroke}
                    strokeWidth={isActive ? 2 : 1.25}
                    strokeDasharray={meta.dash}
                    strokeOpacity={selected && !isActive ? 0.25 : 0.9}
                    vectorEffect="non-scaling-stroke"
                    markerEnd={`url(#${uid}-arrow-${edge.kind})`}
                  />
                )
              })}
            </svg>

            {selected
              ? connectedEdges.map((edge) => {
                  const from = byId.get(edge.from)
                  const to = byId.get(edge.to)
                  if (!from || !to) return null
                  return (
                    <span
                      key={edge.id}
                      style={{
                        left: `${(from.xPct + to.xPct) / 2}%`,
                        top: `${(from.yPct + to.yPct) / 2}%`,
                      }}
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 rounded border bg-card/95 px-1 text-[9px] whitespace-nowrap text-muted-foreground"
                    >
                      {edge.label}
                    </span>
                  )
                })
              : null}

            {positioned.map((node) => {
              const meta = NODE_META[node.kind]
              const classes = omicsClasses(meta.token)
              const certainty = CERTAINTY_META[node.certainty]
              const isSelected = selectedId === node.id
              const dimmed = selected ? !connectedNodeIds.has(node.id) : false
              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(isSelected ? null : node.id)}
                  aria-pressed={isSelected}
                  title={`${node.label} · ${meta.label} · ${certainty.label}`}
                  style={
                    {
                      left: `${node.xPct}%`,
                      top: `${node.yPct}%`,
                      "--accent-omics": `var(${meta.token})`,
                    } as CSSProperties
                  }
                  className={cn(
                    "absolute flex w-28 -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-lg border bg-card px-2 py-1.5 text-left text-[11px] font-medium shadow-sm transition hover:scale-[1.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    classes.border,
                    certainty.border,
                    isSelected &&
                      "ring-2 ring-ring ring-offset-1 ring-offset-background",
                    dimmed && "opacity-45",
                  )}
                >
                  <meta.Icon
                    className={cn("size-3.5 shrink-0", classes.text)}
                  />
                  <span className="truncate text-foreground">{node.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2 text-[10px] text-muted-foreground">
        <CertaintyLegend />
        <EdgeLegend />
        {full ? <IdentityLegend kinds={kinds} /> : null}
      </div>

      {selected ? (
        <div className="mt-3 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="flex items-center gap-2">
            {(() => {
              const meta = NODE_META[selected.kind]
              const classes = omicsClasses(meta.token)
              return (
                <>
                  <meta.Icon className={cn("size-4", classes.text)} />
                  <span className="font-medium text-foreground">
                    {selected.label}
                  </span>
                  <span
                    className={cn(
                      "ml-auto rounded-full border px-2 py-0.5 text-[10px]",
                      classes.border,
                      classes.text,
                    )}
                  >
                    {meta.label}
                  </span>
                </>
              )
            })()}
          </div>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-muted-foreground">
            <dt>Stage</dt>
            <dd className="text-foreground">
              {STAGES.find((stage) => stage.id === selected.stage)?.label}
            </dd>
            <dt>Certainty</dt>
            <dd className="text-foreground">
              {CERTAINTY_META[selected.certainty].label} —{" "}
              {CERTAINTY_META[selected.certainty].note}
            </dd>
          </dl>
          <p className="mt-2 text-muted-foreground">{selected.detail}</p>
          {connectedEdges.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {connectedEdges.map((edge) => {
                const outgoing = edge.from === selected.id
                const other = byId.get(outgoing ? edge.to : edge.from)
                return (
                  <li
                    key={edge.id}
                    className="flex items-center gap-1.5 text-muted-foreground"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: EDGE_META[edge.kind].stroke }}
                    />
                    <span className="font-medium text-foreground">
                      {edge.label}
                    </span>
                    <span aria-hidden="true">{outgoing ? "→" : "←"}</span>
                    <span className="truncate">
                      {other?.label ?? "unknown"}
                    </span>
                  </li>
                )
              })}
            </ul>
          ) : null}
          {notice ? (
            <p className="mt-2 font-medium text-warning">
              {notice} — this graph is synthetic.
            </p>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-muted-foreground">
          Select a node to trace its links. {notice ? `${notice}.` : ""}
        </p>
      )}
    </div>
  )
}
