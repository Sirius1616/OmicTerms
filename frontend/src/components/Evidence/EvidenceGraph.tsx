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
import { Link } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ExternalLink,
  Network as NetworkIcon,
  RefreshCcw,
  Search,
  Table as TableIcon,
} from "lucide-react"
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
  project: { label: "Project", token: "--omics-project", Icon: GraphGlyph },
  experiment: {
    label: "Experiment",
    token: "--omics-experiment",
    Icon: ExperimentGlyph,
  },
  dataset: {
    label: "Document file",
    token: "--omics-document",
    Icon: ReportGlyph,
  },
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

const STRUCTURAL_KINDS: ReadonlySet<string> = new Set([
  "project",
  "experiment",
  "sample",
])

/**
 * Node-link renderer component mapping the node's href (an in-app route
 * written by the graph builder, so always internal) to typed router links.
 */
function ComponentLink({ href }: { href: string }) {
  const documentIdMatch = href.match(/^\/documents\/([^/]+)$/)
  const projectIdMatch = href.match(/^\/projects\/([^/]+)$/)
  if (documentIdMatch) {
    return (
      <Link
        to="/documents/$documentId"
        params={{ documentId: documentIdMatch[1] }}
        className="inline-flex items-center gap-1.5"
      >
        <ExternalLink className="size-3.5" />
        Open source
      </Link>
    )
  }
  if (projectIdMatch) {
    return (
      <Link
        to="/projects/$projectId"
        params={{ projectId: projectIdMatch[1] }}
        className="inline-flex items-center gap-1.5"
      >
        <ExternalLink className="size-3.5" />
        Open project
      </Link>
    )
  }
  return (
    <Link to={href as never} className="inline-flex items-center gap-1.5">
      <ExternalLink className="size-3.5" />
      Open source
    </Link>
  )
}

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
      href: node.href,
    },
    position: { x: 0, y: 0 },
  }))
}

const EDGE_MARKER_COLORS: Record<string, string> = {
  membership: "var(--evidence-edge-membership)",
  provenance: "var(--evidence-edge-provenance)",
  support: "var(--evidence-edge-support)",
  citation: "var(--evidence-edge-citation)",
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
      manual: (edge as { manual?: boolean }).manual === true,
    },
    markerEnd: {
      type: "arrowclosed" as const,
      color: EDGE_MARKER_COLORS[edge.kind] || EDGE_MARKER_COLORS.membership,
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
  /** Accessibility text alternative to the canvas (Story 29 AC 5). */
  const [tableView, setTableView] = useState(false)

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

  // Small graphs fit the whole snapshot into view (React Flow's dimension
  // aware fitView fires once nodes are measured); very large ones rely on
  // canvas virtualization and start at default zoom — fitting 500 painted
  // nodes pushed big snapshots past the 3s render budget.
  const shouldFit = useMemo(
    () => nodes.length > 0 && nodes.length <= 200,
    [nodes],
  )
  const fitNow = useCallback(() => {
    reactFlowInstance.current?.fitView({ padding: 0.25, maxZoom: 0.9 })
  }, [])

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
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={fitNow}
        >
          <Expand className="size-3.5" />
          Fit view
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 text-xs"
          aria-pressed={tableView}
          onClick={() => setTableView((prev) => !prev)}
        >
          {tableView ? (
            <NetworkIcon className="size-3.5" />
          ) : (
            <TableIcon className="size-3.5" />
          )}
          {tableView ? "Graph view" : "Table view"}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          asChild
          variant={filterType === "all" ? "default" : "outline"}
          className="text-[10px] uppercase"
        >
          <button
            type="button"
            aria-pressed={filterType === "all"}
            onClick={() => setFilterType("all")}
          >
            All types
          </button>
        </Badge>
        {nodeKindSet.map((kind) => (
          <Badge
            key={kind}
            asChild
            variant={filterType === kind ? "default" : "outline"}
            className="text-[10px] uppercase"
          >
            <button
              type="button"
              aria-pressed={filterType === kind}
              onClick={() => setFilterType(kind)}
            >
              {(NODE_META as any)[kind]?.label || kind}
            </button>
          </Badge>
        ))}
        <div className="ml-2 flex flex-wrap items-center gap-1.5">
          {(
            ["all", "membership", "provenance", "support", "citation"] as const
          ).map((edgeKind) => (
            <Badge
              key={edgeKind}
              asChild
              variant={filterEdge === edgeKind ? "secondary" : "outline"}
              className="text-[10px] uppercase"
            >
              <button
                type="button"
                aria-pressed={filterEdge === edgeKind}
                onClick={() => setFilterEdge(edgeKind as any)}
              >
                {edgeKind === "all"
                  ? "All links"
                  : (EDGE_META as any)[edgeKind]?.label}
              </button>
            </Badge>
          ))}
        </div>
      </div>

      <div className="relative flex flex-1 min-h-0 overflow-hidden rounded-xl border border-border/70 bg-[var(--evidence-surface)] shadow-[inset_0_1px_0_var(--evidence-highlight-soft),0_40px_120px_-60px_var(--evidence-glow-strong)]">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-violet-400/30 to-transparent" />
        {tableView ? (
          <div
            data-testid="evidence-graph-table"
            className="min-h-0 flex-1 overflow-auto p-4 text-xs text-muted-foreground"
          >
            <p className="mb-3 text-[11px]">
              Text alternative:{" "}
              <span className="font-medium text-foreground">
                {filteredNodes.length} nodes, {filteredEdges.length} edges
              </span>{" "}
              (filtered from {nodes.length} nodes and {edges.length} edges).
            </p>
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Evidence graph nodes</caption>
              <thead>
                <tr className="border-b border-border/70">
                  <th
                    scope="col"
                    className="py-1 pr-3 font-medium text-foreground"
                  >
                    Label
                  </th>
                  <th
                    scope="col"
                    className="py-1 pr-3 font-medium text-foreground"
                  >
                    Type
                  </th>
                  <th scope="col" className="py-1 font-medium text-foreground">
                    Stage
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredNodes.map((node) => {
                  const data = node.data as any
                  return (
                    <tr key={node.id} className="border-b border-border/40">
                      <td className="py-1 pr-3 text-foreground">
                        {data.label}
                      </td>
                      <td className="py-1 pr-3">
                        {(NODE_META as any)[data.kind]?.label || data.kind}
                      </td>
                      <td className="py-1">{data.stage}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <table className="mt-4 w-full border-collapse text-left">
              <caption className="sr-only">Evidence graph relations</caption>
              <thead>
                <tr className="border-b border-border/70">
                  <th
                    scope="col"
                    className="py-1 pr-3 font-medium text-foreground"
                  >
                    From
                  </th>
                  <th
                    scope="col"
                    className="py-1 pr-3 font-medium text-foreground"
                  >
                    To
                  </th>
                  <th scope="col" className="py-1 font-medium text-foreground">
                    Relation
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEdges.map((edge) => {
                  const labelOf = (nodeId: string) =>
                    (nodes.find((n) => n.id === nodeId)?.data as any)?.label ??
                    nodeId
                  return (
                    <tr key={edge.id} className="border-b border-border/40">
                      <td className="py-1 pr-3 text-foreground">
                        {labelOf(edge.source)}
                      </td>
                      <td className="py-1 pr-3 text-foreground">
                        {labelOf(edge.target)}
                      </td>
                      <td className="py-1">{(edge.data as any)?.label}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
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
              onlyRenderVisibleElements={nodes.length > 200}
              fitView={shouldFit}
              fitViewOptions={{ padding: 0.25, maxZoom: 0.9 }}
              minZoom={0.3}
              maxZoom={1.2}
              proOptions={{ hideAttribution: true }}
              attributionPosition="bottom-left"
              className="bg-gradient-to-br from-[var(--evidence-surface)] via-[var(--evidence-surface-alt)] to-[var(--evidence-surface)]"
            >
              <Background
                variant={BackgroundVariant.Lines}
                gap={32}
                size={1}
                color="var(--evidence-grid-line)"
              />
              <Controls className="bg-card/80 border-border/70" />
              <MiniMap
                className="bg-card/80 border-border/70"
                maskColor="var(--evidence-minimap-mask)"
              />
            </ReactFlow>
          </div>
        )}

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
                  {selectedNode.certainty &&
                  !STRUCTURAL_KINDS.has(selectedNode.kind) ? (
                    <div>
                      <span className="text-muted-foreground">Certainty:</span>{" "}
                      <span className="text-foreground">
                        {(CERTAINTY_META as any)[selectedNode.certainty]?.label}
                      </span>
                    </div>
                  ) : null}
                  {selectedNode.detail ? (
                    <p className="text-muted-foreground">
                      {selectedNode.detail}
                    </p>
                  ) : null}
                  {selectedNode.href ? (
                    <Button
                      asChild
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 text-xs"
                    >
                      <ComponentLink href={selectedNode.href} />
                    </Button>
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
