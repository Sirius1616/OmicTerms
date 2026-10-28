import type {
  DataType,
  DocumentPublic,
  DocumentsPublic,
  ProjectTreePublic,
} from "@/client"
import type {
  EvidenceEdgeKind,
  EvidenceNodeKind,
  FixtureGraphEdge,
  FixtureGraphNode,
} from "@/fixtures/dashboard"

/**
 * Real-data builder for the Multi-Omics Evidence Map.
 *
 * Every node and edge here is a direct projection of an existing backend
 * record: projects/experiments/samples from the project tree, documents from
 * the documents listing, edges from real foreign keys only. Nothing is
 * inferred, invented, or imported from fixtures.
 */

export type RealGraphResult = {
  graph: {
    nodes: FixtureGraphNode[]
    edges: FixtureGraphEdge[]
  }
  truncated: boolean
  /** Small honest summary, e.g. "3 projects · 2 experiments · 6 documents". */
  summary: string
}

const NODE_CAP = 500

const NODE_KIND_BY_DATA_TYPE: Record<DataType, EvidenceNodeKind> = {
  variants: "variants",
  expression: "expression",
  methylation: "methylation",
  peaks: "peaks",
  document: "dataset",
}

function projectNode(project: {
  id: string
  name: string
  description?: string | null
}): FixtureGraphNode {
  return {
    id: `project:${project.id}`,
    label: project.name,
    kind: "project",
    stage: "studies",
    certainty: "observed",
    detail: project.description || undefined,
    href: `/projects/${project.id}`,
  }
}

function experimentNode(experiment: {
  id: string
  name: string
  project_id: string
}): FixtureGraphNode {
  return {
    id: `experiment:${experiment.id}`,
    label: experiment.name,
    kind: "experiment",
    stage: "samples",
    certainty: "observed",
    href: `/projects/${experiment.project_id}`,
  }
}

function sampleNode(sample: { id: string; name: string }): FixtureGraphNode {
  return {
    id: `sample:${sample.id}`,
    label: sample.name,
    kind: "sample",
    stage: "samples",
    certainty: "observed",
  }
}

function documentNode(document: DocumentPublic): FixtureGraphNode {
  const kind =
    document.data_type != null
      ? NODE_KIND_BY_DATA_TYPE[document.data_type]
      : "dataset"
  const facts: string[] = []
  if (document.extraction_status === "failed") facts.push("extraction failed")
  else if (document.extraction_status === "pending")
    facts.push("extraction pending")
  if (document.sha256) facts.push(`sha256 ${document.sha256.slice(0, 12)}…`)
  if (document.size_bytes != null)
    facts.push(`${document.size_bytes.toLocaleString()} bytes`)
  if (document.source_repo) facts.push(`imported from ${document.source_repo}`)
  return {
    id: `document:${document.id}`,
    label: document.filename || "Untitled document",
    kind,
    stage: "omics",
    certainty: "observed",
    detail: facts.length > 0 ? facts.join(" · ") : undefined,
    href: `/documents/${document.id}`,
  }
}

function edge(
  id: string,
  from: string,
  to: string,
  kind: EvidenceEdgeKind,
  label: string,
): FixtureGraphEdge {
  return { id, from, to, kind, label }
}

export function buildRealGraph(
  tree: ProjectTreePublic | undefined,
  documents: DocumentsPublic | undefined,
): RealGraphResult {
  const nodes: FixtureGraphNode[] = []
  const edges: FixtureGraphEdge[] = []
  const seenDocuments = new Set<string>()

  let projectCount = 0
  let experimentCount = 0
  let sampleCount = 0
  let documentCount = 0
  let truncated = false

  const documentsBySample = new Map<string, DocumentPublic[]>()
  for (const document of documents?.data ?? []) {
    const sampleId = document.sample_id
    if (!documentsBySample.has(sampleId)) documentsBySample.set(sampleId, [])
    documentsBySample.get(sampleId)?.push(document)
  }

  const pushNode = (node: FixtureGraphNode): boolean => {
    if (nodes.length >= NODE_CAP) {
      truncated = true
      return false
    }
    nodes.push(node)
    return true
  }

  for (const project of tree?.data ?? []) {
    if (!pushNode(projectNode(project))) break
    projectCount += 1
    for (const experiment of project.experiments ?? []) {
      if (!pushNode(experimentNode(experiment))) break
      experimentCount += 1
      for (const sample of experiment.samples ?? []) {
        if (!pushNode(sampleNode(sample))) break
        sampleCount += 1
        edges.push(
          edge(
            `sample:${sample.id}->experiment:${experiment.id}`,
            `sample:${sample.id}`,
            `experiment:${experiment.id}`,
            "membership",
            "in",
          ),
        )
        for (const document of documentsBySample.get(sample.id) ?? []) {
          const documentNodeResult = documentNode(document)
          if (!pushNode(documentNodeResult)) break
          seenDocuments.add(document.id)
          documentCount += 1
          edges.push(
            edge(
              `document:${document.id}->sample:${sample.id}`,
              `document:${document.id}`,
              `sample:${sample.id}`,
              "membership",
              "belongs to",
            ),
          )
        }
      }
      edges.push(
        edge(
          `experiment:${experiment.id}->project:${project.id}`,
          `experiment:${experiment.id}`,
          `project:${project.id}`,
          "membership",
          "in",
        ),
      )
    }
  }

  // Documents whose sample cannot be found in the tree (e.g. sample deleted)
  // still belong to the map — they are real user records with a real sample
  // id — but get no drawn edge rather than a fabricated one.
  for (const [sampleId, sampleDocuments] of documentsBySample) {
    if (nodes.some((node) => node.id === `sample:${sampleId}`)) continue
    for (const document of sampleDocuments) {
      if (seenDocuments.has(document.id)) continue
      if (!pushNode(documentNode(document))) break
      seenDocuments.add(document.id)
      documentCount += 1
    }
  }

  const parts: string[] = []
  if (projectCount > 0) parts.push(`${projectCount} projects`)
  if (experimentCount > 0) parts.push(`${experimentCount} experiments`)
  if (sampleCount > 0) parts.push(`${sampleCount} samples`)
  if (documentCount > 0) parts.push(`${documentCount} documents`)
  const summary = parts.join(" · ")

  return { graph: { nodes, edges }, truncated, summary }
}
