import type {
  EvidenceCertainty,
  EvidenceEdgeKind,
  EvidenceNodeKind,
  EvidenceStage,
  FixtureGraphEdge,
  FixtureGraphNode,
} from "@/fixtures/dashboard"

export type EvidenceEntity = FixtureGraphNode & {
  type: EvidenceNodeKind
  stage?: EvidenceStage
  certainty: EvidenceCertainty
  metadata?: Record<string, unknown>
}

export type EvidenceRelation = FixtureGraphEdge & {
  type: EvidenceEdgeKind
}

export function getNodeIdentity(node: FixtureGraphNode): {
  kind: EvidenceNodeKind
  stage: EvidenceStage
  certainty: EvidenceCertainty
} {
  return {
    kind: node.kind,
    stage: node.stage,
    certainty: node.certainty,
  }
}
