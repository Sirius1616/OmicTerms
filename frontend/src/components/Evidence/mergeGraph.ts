import type {
  DocumentPublic,
  DocumentsPublic,
  EvidenceGraphPublic,
} from "@/client"
import type {
  EvidenceNodeKind,
  FixtureGraphEdge,
  FixtureGraphNode,
} from "@/fixtures/dashboard"

/**
 * Story 29 — evidence map adapter for the Story 28 graph endpoint.
 *
 * Nodes and edges come straight from `GET /projects/{id}/graph`: ids switch
 * to the readable `entity_type:entity_id` form while every edge remains a
 * 1:1 projection of a server-side `EvidenceEdge`. The documents listing is
 * consulted only for document-kind identity (`data_type`) and inspector
 * facts — never for structure, which the graph endpoint owns.
 */

export type MergedGraphResult = {
  graph: { nodes: FixtureGraphNode[]; edges: FixtureGraphEdge[] }
  truncated: boolean
  summary: string
}

const NODE_KIND_BY_ENTITY_TYPE: Record<string, EvidenceNodeKind> = {
  project: "project",
  experiment: "experiment",
  sample: "sample",
  document: "dataset", // replaced by the data_type-based kind when known
  run: "analysis",
  finding: "finding",
  report: "report",
  artifact: "dataset",
}

const NODE_KIND_BY_DATA_TYPE: Record<string, EvidenceNodeKind> = {
  variants: "variants",
  expression: "expression",
  methylation: "methylation",
  peaks: "peaks",
  document: "dataset",
}

/** Backend relation → approved edge-kind styling group. */
const EDGE_KIND_BY_RELATION: Record<
  string,
  "membership" | "provenance" | "support" | "citation"
> = {
  belongs_to: "membership",
  same_sample_as: "membership",
  derived_from: "provenance",
  produced_by: "provenance",
  input_to: "provenance",
  supports: "support",
  contradicts: "support",
  reports_on: "citation",
}

function nodeId(entityType: string, entityId: string): string {
  return `${entityType}:${entityId}`
}

function documentKind(document: DocumentPublic | undefined): EvidenceNodeKind {
  const dataType = document?.data_type
  if (dataType && dataType in NODE_KIND_BY_DATA_TYPE) {
    return NODE_KIND_BY_DATA_TYPE[dataType]
  }
  return "dataset"
}

function documentFacts(document: DocumentPublic): string[] {
  const facts: string[] = []
  if (document.extraction_status === "failed") facts.push("extraction failed")
  else if (document.extraction_status === "pending")
    facts.push("extraction pending")
  if (document.sha256) facts.push(`sha256 ${document.sha256.slice(0, 12)}…`)
  if (document.size_bytes != null)
    facts.push(`${document.size_bytes.toLocaleString()} bytes`)
  if (document.source_repo) facts.push(`imported from ${document.source_repo}`)
  return facts
}

export function mergeProjectGraphs(
  graphs: EvidenceGraphPublic[],
  documents: DocumentsPublic | undefined,
): MergedGraphResult {
  const documentsById = new Map<string, DocumentPublic>()
  for (const document of documents?.data ?? []) {
    documentsById.set(document.id, document)
  }

  const nodes: FixtureGraphNode[] = []
  const edges: FixtureGraphEdge[] = []
  const seenNodes = new Set<string>()
  const seenEdges = new Set<string>()
  let truncated = false

  const counts: Record<string, number> = {}

  for (const result of graphs) {
    if (result.truncated) truncated = true
    for (const node of result.nodes ?? []) {
      const id = nodeId(node.entity_type, node.entity_id)
      if (seenNodes.has(id)) continue
      seenNodes.add(id)

      let kind = NODE_KIND_BY_ENTITY_TYPE[node.entity_type] ?? "dataset"
      let detail: string | undefined
      if (node.entity_type === "document") {
        const document = documentsById.get(node.entity_id)
        kind = documentKind(document)
        if (document) detail = documentFacts(document).join(" · ")
      }
      nodes.push({
        id,
        label: node.label,
        kind,
        stage:
          kind === "project"
            ? "studies"
            : kind === "experiment" || kind === "sample"
              ? "samples"
              : "omics",
        certainty: "observed",
        detail,
        href:
          node.entity_type === "document"
            ? `/documents/${node.entity_id}`
            : node.entity_type === "project"
              ? `/projects/${node.entity_id}`
              : undefined,
      })
      counts[kind] = (counts[kind] ?? 0) + 1
    }
    for (const edge of result.edges ?? []) {
      if (seenEdges.has(edge.id)) continue
      seenEdges.add(edge.id)
      // Edges are consumed as-is from the API; endpoints must exist in the
      // merged node set or they cannot be drawn (no decorative edges).
      edges.push({
        id: edge.id,
        from: serverNodeIdToClientId(edge.source_id, graphs),
        to: serverNodeIdToClientId(edge.target_id, graphs),
        kind: EDGE_KIND_BY_RELATION[edge.relation] ?? "membership",
        label: edge.relation,
        manual: edge.relation === "supports" || edge.relation === "contradicts",
      })
    }
  }

  // Discard edges whose endpoints were dropped by the node cap — an edge
  // without both nodes cannot be drawn and must never appear as decoration.
  const drawable = new Set(seenNodes)
  const keptEdges = edges.filter(
    (edge) => drawable.has(edge.from) && drawable.has(edge.to),
  )

  const parts: string[] = []
  if (counts.project) parts.push(`${counts.project} projects`)
  if (counts.experiment) parts.push(`${counts.experiment} experiments`)
  if (counts.sample) parts.push(`${counts.sample} samples`)
  if (counts.dataset) parts.push(`${counts.dataset} documents`)
  const summary = parts.join(" · ")

  return { graph: { nodes, edges: keptEdges }, truncated, summary }
}

/**
 * Server edge rows reference nodes by UUID; the client-side node ids carry
 * the `entity_type:` prefix. Both halves live in the same project snapshot,
 * so resolve via the node tables gathered there.
 */
function serverNodeIdToClientId(
  serverId: string,
  graphs: EvidenceGraphPublic[],
): string {
  for (const result of graphs) {
    for (const node of result.nodes ?? []) {
      if (node.id === serverId) {
        return nodeId(node.entity_type, node.entity_id)
      }
    }
  }
  return serverId
}
