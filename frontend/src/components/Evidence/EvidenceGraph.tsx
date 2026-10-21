import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import "@xyflow/react/dist/style.css"
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  RefreshCcw,
  Search,
} from "lucide-react"
import {
  AnalysisGlyph,
  DnaGlyph,
  ExpressionGlyph,
  FindingGlyph,
  MethylationGlyph,
  MicrobiomeGlyph,
  omicsClasses,
  PeakGlyph,
  ProteinGlyph,
  ReportGlyph,
  SampleGlyph,
} from "@/components/Common/ScientificIcons"
import { EvidenceEdge } from "@/components/Evidence/EvidenceEdge"
import { EvidenceNode } from "@/components/Evidence/EvidenceNode"
import { getLayoutedElements } from "@/components/Evidence/layout"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type {
  EvidenceCertainty,
  EvidenceEdgeKind,
  EvidenceNodeKind,
  FixtureGraphEdge,
  FixtureGraphNode,
} from "@/fixtures/dashboard"
import { cn } from "@/lib/utils"

const NODE_TYPES = {
  evidence: EvidenceNode,
}
const EDGE_TYPES = {
  evidence: EvidenceEdge,
}

type GraphData = {
  nodes: FixtureGraphNode[]
  edges: FixtureGraphEdge[]
}

const NODE_META = {
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
} as const

const EDGE_META = {
  membership: {
    label: "Membership",
    note: "data belongs to sample/experiment",
  },
  provenance: { label: "Provenance", note: "result produced by analysis run" },
  support: { label: "Support", note: "evidence supporting a finding" },
  citation: { label: "Citation", note: "finding cited by a report" },
} as const

const CERTAINTY_META = {
  observed: { label: "Observed", note: "measured directly from data" },
  derived: { label: "Derived", note: "computed by analysis run" },
  inferred: {
    label: "Inferred",
    note: "candidate interpretation, not yet validated",
  },
} as const

function buildNodes(graph: GraphData | null): Node[] {
  if (!graph) return []
  return graph.nodes.map((node) => ({
    id: node.id,
    type: "evidence",
    data: {
      label: node.label,
      kind: node.kind,
      certainty: node.certainty,
      detail: node.detail,
      stage: node.stage,
    },
    position: { x: 0, y: 0 },
  }))
}

function buildEdges(graph: GraphData | null): Edge[] {
  if (!graph) return []
  return graph.edges.map((edge) => ({
    id: edge.id,
    type: "evidence",
    source: edge.from,
    target: edge.to,
    data: {
      kind: edge.kind,
      label: edge.label,
    },
    markerEnd: {
      type: "arrowclosed" as const,
      color: "rgba(148,167,196,0.8)",
    },
  }))
}

interface EvidenceGraphProps {
  graph: GraphData | null
  notice?: string
  full?: boolean
  className?: string
}

export function EvidenceGraph({
  graph,
  notice,
  full = false,
  className,
}: EvidenceGraphProps) {
  const [search, setSearch] = useState("")
  const [filterType, setFilterType] = useState<EvidenceNodeKind | "all">("all")
  const [filterEdge, setFilterEdge] = useState<EvidenceEdgeKind | "all">("all")
  const [filterCertainty, setFilterCertainty] = useState<
    EvidenceCertainty | "all"
  >("all")
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const reactFlowInstance = useRef<any>(null)
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])

  const nodeTypes = useMemo(() => NODE_TYPES, [])
  const edgeTypes = useMemo(() => EDGE_TYPES, [])

  useEffect(() => {
    const baseNodes = buildNodes(graph)
    const baseEdges = buildEdges(graph)
    if (baseNodes.length === 0) {
      setNodes([])
      setEdges([])
      return
    }
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      baseNodes,
      baseEdges,
      "LR",
    )
    setNodes(layoutedNodes)
    setEdges(layoutedEdges)
    setSelectedId(null)
    setInspectorOpen(false)
  }, [graph, setNodes, setEdges])

  useEffect(() => {
    if (selectedId) {
      setInspectorOpen(true)
    }
  }, [selectedId])

  const filteredNodes = useMemo(() => {
    return nodes.filter((node) => {
      const data = node.data as any
      const matchesSearch = search
        ? data.label?.toLowerCase().includes(search.toLowerCase())
        : true
      const matchesType = filterType === "all" || data.kind === filterType
      const matchesCertainty =
        filterCertainty === "all" || data.certainty === filterCertainty
      return matchesSearch && matchesType && matchesCertainty
    })
  }, [nodes, search, filterType, filterCertainty])

  const filteredEdges = useMemo(() => {
    if (filterEdge === "all") return edges
    return edges.filter((edge) => (edge.data as any)?.kind === filterEdge)
  }, [edges, filterEdge])

  const selectedNode = useMemo(() => {
    const node = nodes.find((n) => n.id === selectedId)
    return node ? (node.data as any) : null
  }, [nodes, selectedId])

  const nodeKindSet = useMemo(
    () =>
      Array.from(
        new Set(nodes.map((n) => (n.data as any).kind as EvidenceNodeKind)),
      ),
    [nodes],
  )

  const onSelectNode = useCallback((_event: any, node: Node) => {
    setSelectedId((prev) => (prev === node.id ? null : node.id))
  }, [])

  const resetFilters = useCallback(() => {
    setSearch("")
    setFilterType("all")
    setFilterEdge("all")
    setFilterCertainty("all")
    setSelectedId(null)
    setInspectorOpen(false)
  }, [])

  return (
    <div
      className={cn("flex h-[32rem] flex-col gap-3 lg:h-[38rem]", className)}
      data-testid="evidence-graph"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border/70 bg-card/60 px-2 py-1 shadow-sm backdrop-blur">
          <Search className="size-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search entities..."
            className="h-7 border-0 bg-transparent px-1 text-xs shadow-none focus-visible:ring-0"
          />
        </div>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={resetFilters}
        >
          <RefreshCcw className="size-3.5" />
          Reset
        </Button>
        <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
          <Expand className="size-3.5" />
          Fit view
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          variant={filterType === "all" ? "default" : "outline"}
          className="cursor-pointer text-[10px] uppercase"
          onClick={() => setFilterType("all")}
        >
          All types
        </Badge>
        {nodeKindSet.map((kind) => (
          <Badge
            key={kind}
            variant={filterType === kind ? "default" : "outline"}
            className="cursor-pointer text-[10px] uppercase"
            onClick={() => setFilterType(kind)}
          >
            {(NODE_META as any)[kind]?.label || kind}
          </Badge>
        ))}
        <div className="ml-2 flex flex-wrap items-center gap-1.5">
          {(
            ["all", "membership", "provenance", "support", "citation"] as const
          ).map((edgeKind) => (
            <Badge
              key={edgeKind}
              variant={filterEdge === edgeKind ? "secondary" : "outline"}
              className="cursor-pointer text-[10px] uppercase"
              onClick={() => setFilterEdge(edgeKind as any)}
            >
              {edgeKind === "all"
                ? "All links"
                : (EDGE_META as any)[edgeKind]?.label}
            </Badge>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden rounded-xl border border-border/70 bg-[#070B18] shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_40px_120px_-60px_rgba(66,217,245,0.9)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        <div className="flex-1 min-h-0" data-testid="evidence-graph-canvas">
          <ReactFlow
            nodes={filteredNodes}
            edges={filteredEdges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={onSelectNode}
            onInit={(instance) => {
              reactFlowInstance.current = instance
            }}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
            minZoom={0.3}
            maxZoom={1.2}
            proOptions={{ hideAttribution: true }}
            attributionPosition="bottom-left"
            className="bg-gradient-to-br from-[#070B18] via-[#0B1224] to-[#070B18]"
          >
            <Background
              variant={BackgroundVariant.Lines}
              gap={32}
              size={1}
              color="rgba(148,167,196,0.08)"
            />
            <Controls className="bg-card/80 border-border/70" />
            <MiniMap
              className="bg-card/80 border-border/70"
              maskColor="rgba(11,18,36,0.6)"
            />
          </ReactFlow>
        </div>

        <div
          className={cn(
            "absolute right-0 top-0 z-10 h-full w-full max-w-sm transform border-l border-border/70 bg-card/95 shadow-xl backdrop-blur transition-transform duration-200 lg:static lg:z-0",
            inspectorOpen
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0 lg:hidden",
          )}
        >
          <div className="flex items-center justify-between border-b border-border/70 px-4 py-2">
            <h3 className="text-sm font-medium">Entity Details</h3>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 lg:hidden"
              onClick={() => setInspectorOpen(false)}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
          <div className="h-[calc(100%-41px)] overflow-y-auto p-4">
            {selectedNode ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  {(() => {
                    const meta = (NODE_META as any)[selectedNode.kind]
                    const classes = meta ? omicsClasses(meta.token) : null
                    const Icon = meta?.Icon
                    return (
                      <>
                        {meta && Icon && classes ? (
                          <div
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md border",
                              classes.border,
                              classes.bg,
                            )}
                          >
                            <Icon className={cn("size-4", classes.text)} />
                          </div>
                        ) : null}
                        <div>
                          <p className="text-sm font-medium">
                            {selectedNode.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {meta?.label}
                          </p>
                        </div>
                      </>
                    )
                  })()}
                </div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">Type:</span>{" "}
                    <span className="text-foreground">{selectedNode.kind}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Stage:</span>{" "}
                    <span className="text-foreground">
                      {selectedNode.stage}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Certainty:</span>{" "}
                    <span className="text-foreground">
                      {(CERTAINTY_META as any)[selectedNode.certainty]?.label}
                    </span>
                  </div>
                  {selectedNode.detail ? (
                    <p className="text-muted-foreground">
                      {selectedNode.detail}
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-center">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">
                    Select an entity
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Click any node to inspect details
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        {selectedId && (
          <Button
            variant="outline"
            size="icon"
            className="absolute right-2 top-2 z-10 h-8 w-8 lg:hidden"
            onClick={() => setInspectorOpen(true)}
          >
            <ChevronLeft className="size-4" />
          </Button>
        )}
      </div>

      {full && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">Certainty</span>
            {Object.entries(CERTAINTY_META).map(([key, meta]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-muted-foreground/40" />
                {meta.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-foreground">Links</span>
            {Object.entries(EDGE_META).map(([key, meta]) => (
              <span key={key} className="inline-flex items-center gap-1.5">
                {meta.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {notice && (
        <p className="text-[11px] text-muted-foreground">
          <span className="text-amber-400/90">
            Fixture — not real scientific data
          </span>
          {notice ? ` — ${notice}` : ""}
        </p>
      )}
    </div>
  )
}
