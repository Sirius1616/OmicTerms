import type { ProvenanceEventPublic, ProvenanceEventsPublic } from "@/client"
import { ProjectsService } from "@/client"

export type { ProvenanceEventPublic, ProvenanceEventsPublic }

export const provenanceApi = {
  async listProjectEvents(
    projectId: string,
    params?: { action?: string; skip?: number; limit?: number },
  ): Promise<ProvenanceEventsPublic> {
    return ProjectsService.readProjectEvents({
      projectId,
      action: params?.action,
      skip: params?.skip,
      limit: params?.limit,
    })
  },
}
