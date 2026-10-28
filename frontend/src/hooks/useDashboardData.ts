import { useQuery } from "@tanstack/react-query"

import type { DashboardFixtures } from "@/fixtures/dashboard"
import { isFixtureModeEnabled } from "@/lib/fixtures"
import { documentsApi } from "@/services/documents"
import { hierarchyApi } from "@/services/hierarchy"
import type { ProvenanceEventPublic } from "@/services/provenance"
import { useDevFixtures } from "./useDevFixtures"

const FIXTURE_ACTION_BY_KIND: Record<string, string> = {
  upload: "document.uploaded",
  failed: "extraction.failed",
  validation: "validation.run",
  analysis: "extraction.started",
  finding: "metadata.updated",
}

function fixtureEvents(
  fixtures: DashboardFixtures | null,
): ProvenanceEventPublic[] {
  if (!fixtures) return []
  return fixtures.activity.map((event) => ({
    id: event.id,
    project_id: null,
    actor_type: "system",
    actor_id: null,
    action: FIXTURE_ACTION_BY_KIND[event.kind] ?? "metadata.updated",
    entity_type: "document",
    entity_id: "",
    payload: { fixtureText: event.text },
    occurred_at: event.timestamp,
    request_id: null,
  }))
}

export type IntegrityMetric = {
  /** Numeric value when known, else null (rendered as an honest dash). */
  value: number | null
  /** Optional ratio for "have / total" style metrics. */
  numerator?: number
  denominator?: number
  context: string
}

async function loadDashboardFixtures(): Promise<DashboardFixtures | null> {
  // Guarded by a statically-analysable DEV check so the  fixture module is
  // dropped from production bundles.
  if (!import.meta.env.DEV) return null
  if (!isFixtureModeEnabled()) return null
  const mod = await import("@/fixtures/dashboard")
  return mod.dashboardFixtures
}

export function useDashboardData() {
  const { enabled: fixturesEnabled } = useDevFixtures()

  const documentsQuery = useQuery({
    queryKey: ["documents"],
    queryFn: () => documentsApi.listDocuments(),
  })

  const projectsQuery = useQuery({
    queryKey: ["projectsTree"],
    queryFn: () => hierarchyApi.listProjectsTree(),
  })

  const fixturesQuery = useQuery({
    queryKey: ["fixtures", "dashboard"],
    queryFn: loadDashboardFixtures,
    enabled: fixturesEnabled,
  })

  const documents = documentsQuery.data?.data ?? []
  const projects = projectsQuery.data?.data ?? []

  const documentCount = documentsQuery.data?.count ?? 0
  const extractingCount = documents.filter(
    (document) => document.extraction_status === "pending",
  ).length
  const failedCount = documents.filter(
    (document) => document.extraction_status === "failed",
  ).length

  const projectsCount = projectsQuery.data?.count ?? projects.length
  const experimentsCount = projects.reduce(
    (total, project) => total + (project.experiments?.length ?? 0),
    0,
  )
  const samplesCount = projects.reduce(
    (total, project) =>
      total +
      (project.experiments ?? []).reduce(
        (inner, experiment) => inner + (experiment.samples?.length ?? 0),
        0,
      ),
    0,
  )

  const recentFiles = [...documents]
    .sort(
      (a, b) =>
        new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
    )
    .slice(0, 5)

  const fixtures = fixturesQuery.data ?? null

  const integrity: Record<string, IntegrityMetric> = {
    checksums: fixtures
      ? {
          value: fixtures.integrity.datasetsWithChecksums.have,
          numerator: fixtures.integrity.datasetsWithChecksums.have,
          denominator: fixtures.integrity.datasetsWithChecksums.total,
          context: "fixture data",
        }
      : {
          value: 0,
          numerator: 0,
          denominator: documentCount,
          context: "checksums recorded on upload",
        },
    validationRuns: fixtures
      ? { value: fixtures.integrity.validationRuns, context: "fixture data" }
      : { value: null, context: "validation runs recorded on document" },
    provenanceCoverage: fixtures
      ? {
          value: fixtures.integrity.provenanceCoverage,
          context: "fixture data",
        }
      : { value: null, context: "provenance coverage tracking planned" },
  }

  return {
    documents,
    documentsQuery,
    projects,
    projectsQuery,
    fixtures,
    fixturesEnabled,
    fixtureActivity: fixtureEvents(fixtures),
    counts: {
      projects: projectsCount,
      experiments: experimentsCount,
      samples: samplesCount,
      documents: documentCount,
      extracting: extractingCount,
      failed: failedCount,
    },
    recentFiles,
    integrity,
  }
}
