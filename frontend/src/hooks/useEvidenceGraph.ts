import { useQuery } from "@tanstack/react-query"

import type { DashboardFixtures } from "@/fixtures/dashboard"
import { isFixtureModeEnabled } from "@/lib/fixtures"
import { useDevFixtures } from "./useDevFixtures"

async function loadEvidenceFixtures(): Promise<DashboardFixtures | null> {
  if (!import.meta.env.DEV) return null
  if (!isFixtureModeEnabled()) return null
  const mod = await import("@/fixtures/dashboard")
  return mod.dashboardFixtures
}

export function useEvidenceGraph() {
  const { enabled } = useDevFixtures()

  return useQuery({
    queryKey: ["fixtures", "evidence"],
    queryFn: loadEvidenceFixtures,
    enabled,
  })
}
