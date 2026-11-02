import type {
  FindingCreate,
  FindingEvidenceCreate,
  FindingEvidencePublic,
  FindingPublic,
  FindingStatus,
  FindingsPublic,
  FindingValidationResult,
  FindingVersionPublic,
  FindingVersionsPublic,
} from "@/client"
import { FindingsService } from "@/client"

export type {
  FindingCreate,
  FindingEvidenceCreate,
  FindingEvidencePublic,
  FindingPublic,
  FindingStatus,
  FindingValidationResult,
  FindingVersionPublic,
}

/**
 * Story 30 findings endpoints + Story 31 UI surface. Rule errors from the
 * backend (422) carry the applicable rule in `detail` and are surfaced inline.
 */
export const findingsApi = {
  listProjectFindings(projectId: string): Promise<FindingsPublic> {
    return FindingsService.listProjectFindings({
      projectId,
      limit: 200,
    })
  },
  readFinding(findingId: string): Promise<FindingPublic> {
    return FindingsService.readFinding({ findingId })
  },
  listFindingVersions(findingId: string): Promise<FindingVersionsPublic> {
    return FindingsService.listFindingVersions({ findingId })
  },
  createFinding(
    projectId: string,
    payload: FindingCreate,
  ): Promise<FindingPublic> {
    return FindingsService.createFinding({ projectId, requestBody: payload })
  },
  updateFinding(
    findingId: string,
    payload: Parameters<typeof FindingsService.updateFinding>[0]["requestBody"],
  ): Promise<FindingPublic> {
    return FindingsService.updateFinding({ findingId, requestBody: payload })
  },
  addEvidence(
    findingId: string,
    payload: FindingEvidenceCreate,
  ): Promise<FindingEvidencePublic> {
    return FindingsService.addFindingEvidence({
      findingId,
      requestBody: payload,
    })
  },
  removeEvidence(findingId: string, evidenceId: string): Promise<void> {
    return FindingsService.removeFindingEvidence({ findingId, evidenceId })
  },
  validateFinding(findingId: string): Promise<FindingValidationResult> {
    return FindingsService.validateFinding({ findingId })
  },
  publishFinding(findingId: string): Promise<FindingPublic> {
    return FindingsService.publishFinding({ findingId })
  },
  retractFinding(findingId: string): Promise<FindingPublic> {
    return FindingsService.retractFinding({ findingId })
  },
}
