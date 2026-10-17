import { Link } from "@tanstack/react-router"
import { Network } from "lucide-react"
import { useState } from "react"

import { EmptyState } from "@/components/Common/EmptyState"
import { Panel } from "@/components/Common/Panel"
import { Button } from "@/components/ui/button"
import type {
  DashboardFixtures,
  FixtureGraphNode,
  FixtureGraphNodeType,
} from "@/fixtures/dashboard"
import { cn } from "@/lib/utils"

const NODE_TYPE_LABELS: Record<FixtureGraphNodeType, string> = {
  genomics: "Genomics",
  transcriptomics: "Transcriptomics",
  epigenomics: "Epigenomics",
  proteomics: "Proteomics",
  microbiome: "Microbiome",
  samples: "Samples & Experiments",
  tools: "Analysis Tools",
  findings: "Candidate Findings",
  reports: "Reports",
}

const NODE_TYPE_CLASSES: Record<FixtureGraphNodeType, string> = {
  genomics: "border-primary/40 bg-primary/10 text-primary",
  transcriptomics: "border-accent-cyan/40 bg-accent-cyan/10 text-accent-cyan",
  epigenomics: "border-valid/40 bg-valid/10 text-valid",
  proteomics: "border-warning/40 bg-warning/10 text-warning",
  microbiome: "border-learning/40 bg-learning/10 text-learning",
  samples: "border-border-strong bg-muted text-foreground",
  tools: "border-border-strong bg-muted text-foreground",
  findings: "border-learning/40 bg-learning/10 text-learning",
  reports: "border-border-strong bg-muted text-foreground",
}

const PREVIEW_TYPES = Object.keys(NODE_TYPE_LABELS) as FixtureGraphNodeType[]

function StaticPreview() {
  return (
    <div className="relative">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {PREVIEW_TYPES.map((type) => (
          <div
            key={type}
            className={cn(
              "rounded-lg border px-3 py-2 text-xs font-medium",
              NODE_TYPE_CLASSES[type],
            )}
          >
            {NODE_TYPE_LABELS[type]}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-xs text-muted-foreground">
        Node types the evidence graph will connect once datasets are linked.
      </p>
    </div>
  )
}

function FixtureGraph({ fixtures }: { fixtures: DashboardFixtures }) {
  const [selected, setSelected] = useState<FixtureGraphNode | null>(null)
  const { nodes, edges } = fixtures.graph

  const nodeById = (id: string) => nodes.find((node) => node.id === id)

  return (
    <div className="flex flex-col gap-3">
      <div className="relative h-80 w-full overflow-hidden rounded-lg border bg-background/40">
        <svg
          viewBox="0 0 380 380"
          preserveAspectRatio="none"
          aria-hidden="true"
          className="absolute inset-0 h-full w-full"
        >
          {edges.map((edge) => {
            const from = nodeById(edge.from)
            const to = nodeById(edge.to)
            if (!from || !to) return null
            return (
              <g key={edge.id}>
                <line
                  x1={from.x}
                  y1={from.y}
                  x2={to.x}
                  y2={to.y}
                  style={{ stroke: "var(--border-strong)" }}
                  strokeWidth="1"
                  vectorEffect="non-scaling-stroke"
                />
                <text
                  x={(from.x + to.x) / 2}
                  y={(from.y + to.y) / 2}
                  style={{ fill: "var(--muted-foreground)" }}
                  fontSize="8"
                  textAnchor="middle"
                >
                  {edge.label}
                </text>
              </g>
            )
          })}
        </svg>
        {nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            onClick={() => setSelected(node)}
            style={{
              left: `${(node.x / 380) * 100}%`,
              top: `${(node.y / 380) * 100}%`,
            }}
            className={cn(
              "absolute -translate-x-1/2 -translate-y-1/2 rounded-md border px-2 py-1 text-[11px] font-medium shadow-sm transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              NODE_TYPE_CLASSES[node.type],
            )}
          >
            {node.label}
          </button>
        ))}
      </div>

      {selected ? (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs">
          <div className="font-medium">{selected.label}</div>
          <p className="mt-1 text-muted-foreground">{selected.detail}</p>
          <p className="mt-1 font-medium text-warning">
            {fixtures.notice} — this node and its links are synthetic.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Select a node to inspect it. {fixtures.notice}.
        </p>
      )}
    </div>
  )
}

interface EvidenceMapPanelProps {
  fixtures: DashboardFixtures | null
}

export function EvidenceMapPanel({ fixtures }: EvidenceMapPanelProps) {
  return (
    <Panel
      title="Multi-Omics Evidence Map"
      subtitle="How your datasets, runs, and findings connect"
      icon={<Network className="size-4 text-muted-foreground" />}
      className="xl:col-span-8"
    >
      {fixtures ? (
        <FixtureGraph fixtures={fixtures} />
      ) : (
        <div className="flex flex-col gap-3">
          <StaticPreview />
          <EmptyState
            icon={Network}
            compact
            title="Your evidence graph will appear here"
            body="Once datasets are linked, this map will show how data, analysis runs, and findings connect. Planned for milestone M3."
            action={
              <Button variant="outline" size="sm" asChild>
                <Link to="/evidence">Learn about the evidence graph</Link>
              </Button>
            }
          />
        </div>
      )}
    </Panel>
  )
}
