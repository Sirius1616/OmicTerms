import { useQuery } from "@tanstack/react-query"

import type { FindingPublic } from "@/client"
import { findingsApi } from "@/services/findings"
import { hierarchyApi } from "@/services/hierarchy"

/** One merged row for panel/list rendering. */
export type FindingsPanelRow = {
  finding: FindingPublic
  projectName: string
}

/**
 * Story 31 — all findings across the current user's projects, flattened and
 * sorted newest-first. The project tree is consumed only to scope the query;
 * the panel and findings list render the merged result.
 */
export async function loadAllFindings(): Promise<FindingsPanelRow[]> {
  const projects = await hierarchyApi.listProjectsTree()
  const panels = await Promise.all(
    (projects.data ?? []).map(async (project) => {
      const projectFindings = await findingsApi.listProjectFindings(project.id)
      return (projectFindings.data ?? []).map((finding) => ({
        finding,
        projectName: project.name,
      }))
    }),
  )
  return panels
    .flat()
    .sort(
      (a, b) =>
        new Date(b.finding.updated_at).getTime() -
        new Date(a.finding.updated_at).getTime(),
    )
}

export function useAllFindings() {
  return useQuery({
    queryKey: ["findings", "all"],
    queryFn: loadAllFindings,
  })
}
