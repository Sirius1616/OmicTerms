import { useQuery } from "@tanstack/react-query"

import type { MergedGraphResult } from "@/components/Evidence/mergeGraph"
import { mergeProjectGraphs } from "@/components/Evidence/mergeGraph"
import type { DashboardFixtures } from "@/fixtures/dashboard"
import { isFixtureModeEnabled } from "@/lib/fixtures"
import { documentsApi } from "@/services/documents"
import { evidenceGraphApi } from "@/services/evidenceGraph"
import { hierarchyApi } from "@/services/hierarchy"
import { useDevFixtures } from "./useDevFixtures"

async function loadEvidenceFixtures(): Promise<DashboardFixtures | null> {
  if (!import.meta.env.DEV) return null
  if (!isFixtureModeEnabled()) return null
  const mod = await import("@/fixtures/dashboard")
  return mod.dashboardFixtures
}

export type EvidenceGraphMode = "real" | "fixture" | "none"

export type EvidenceGraphData = {
  mode: EvidenceGraphMode
  /** Real workspace graph when mode==="real", fixture graph when "fixture". */
  graph: MergedGraphResult["graph"] | DashboardFixtures["graph"] | null
  /**
   * Notice shown under the canvas. Real data gets a factual line;
   * fixtures get the mandatory synthetic-data label.
   */
  notice?: string
  truncated?: boolean
  summary?: string
  isLoading: boolean
}

async function loadRealEvidenceGraph(): Promise<{
  merged: MergedGraphResult
}> {
  const documents = await documentsApi.listDocuments({ limit: 500 })
  const tree = await hierarchyApi.listProjectsTree()
  const projectIds = (tree.data ?? []).map((project) => project.id)
  const graphs = await Promise.all(
    projectIds.map((projectId) =>
      evidenceGraphApi.getProjectGraph(projectId).then((graph) => ({
        projectId,
        graph,
      })),
    ),
  )
  return {
    merged: mergeProjectGraphs(
      graphs.map((result) => result.graph),
      documents,
    ),
  }
}

export function useEvidenceGraph(): EvidenceGraphData {
  const { enabled: fixturesEnabled } = useDevFixtures()

  const projectsQuery = useQuery({
    queryKey: ["projectsTree", "evidence"],
    queryFn: () => hierarchyApi.listProjectsTree(),
  })

  const hasProjects = (projectsQuery.data?.data ?? []).length > 0

  const graphsQuery = useQuery({
    queryKey: ["evidenceGraphs"],
    queryFn: loadRealEvidenceGraph,
    enabled: hasProjects,
  })

  const fixturesQuery = useQuery({
    queryKey: ["fixtures", "evidence"],
    queryFn: loadEvidenceFixtures,
    enabled: fixturesEnabled,
  })

  const isLoading =
    projectsQuery.isLoading || (hasProjects && graphsQuery.isLoading)

  const real = graphsQuery.data?.merged ?? null

  if (real && real.graph.nodes.length > 0) {
    return {
      mode: "real",
      graph: real.graph,
      notice: `Real workspace data — ${real.summary}. Structure only: analysis runs and findings land with the Analysis and Findings milestones.`,
      truncated: real.truncated,
      summary: real.summary,
      isLoading,
    }
  }

  const fixtures = fixturesQuery.data ?? null
  if (fixtures) {
    return {
      mode: "fixture",
      graph: fixtures.graph,
      notice: fixtures.notice,
      isLoading,
    }
  }

  return {
    mode: "none",
    graph: null,
    isLoading,
  }
}
