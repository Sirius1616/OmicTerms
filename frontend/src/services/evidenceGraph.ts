import type { EvidenceGraphPublic } from "@/client"
import { EvidenceService } from "@/client"

export type { EvidenceGraphPublic }

export type ProjectGraphResult = {
  projectId: string
  graph: EvidenceGraphPublic
}

/** Story 28 evidence-graph endpoints (one bounded snapshot per project). */
export const evidenceGraphApi = {
  async getProjectGraph(projectId: string): Promise<EvidenceGraphPublic> {
    return EvidenceService.readProjectGraph({ projectId })
  },
}
