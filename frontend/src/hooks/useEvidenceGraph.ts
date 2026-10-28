import { useQuery } from "@tanstack/react-query"
import type { RealGraphResult } from "@/components/Evidence/realGraph"
import { buildRealGraph } from "@/components/Evidence/realGraph"
import type { DashboardFixtures } from "@/fixtures/dashboard"
import { isFixtureModeEnabled } from "@/lib/fixtures"
import { documentsApi } from "@/services/documents"
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
  graph: RealGraphResult["graph"] | DashboardFixtures["graph"] | null
  /**
   * Notice shown under the canvas. Real data gets a factual line;
   * fixtures get the mandatory synthetic-data label.
   */
  notice?: string
  truncated?: boolean
  summary?: string
  isLoading: boolean
}

export function useEvidenceGraph(): EvidenceGraphData {
  const { enabled: fixturesEnabled } = useDevFixtures()

  const documentsQuery = useQuery({
    queryKey: ["documents", "evidence"],
    queryFn: () => documentsApi.listDocuments({ limit: 500 }),
  })

  const projectsQuery = useQuery({
    queryKey: ["projectsTree", "evidence"],
    queryFn: () => hierarchyApi.listProjectsTree(),
  })

  const fixturesQuery = useQuery({
    queryKey: ["fixtures", "evidence"],
    queryFn: loadEvidenceFixtures,
    enabled: fixturesEnabled,
  })

  const isLoading =
    documentsQuery.isLoading ||
    projectsQuery.isLoading ||
    fixturesQuery.isLoading

  const real = buildRealGraph(projectsQuery.data, documentsQuery.data)

  if (real.graph.nodes.length > 0) {
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
