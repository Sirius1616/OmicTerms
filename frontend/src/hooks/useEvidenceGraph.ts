import { useQuery } from "@tanstack/react-query"

import type { DashboardFixtures } from "@/fixtures/dashboard"
import { isFixtureModeEnabled } from "@/lib/fixtures"
import { useDevFixtures } from "./useDevFixtures"

async function loadEvidenceFixtures(): Promise<DashboardFixtures | null> {
  // Statically-analysable DEV guard keeps the fixture module out of prod bundles.
  if (!import.meta.env.DEV) return null
  if (!isFixtureModeEnabled()) return null
  const mod = await import("@/fixtures/dashboard")
  return mod.dashboardFixtures
}

/**
 * Evidence-page fixture loader. Mirrors the dashboard loader but only pulls the
 * synthetic graph payload, so the planned M3 structure can be previewed without
 * a backend.
 */
export function useEvidenceGraph() {
  const { enabled } = useDevFixtures()

  return useQuery({
    queryKey: ["fixtures", "evidence"],
    queryFn: loadEvidenceFixtures,
    enabled,
  })
}
