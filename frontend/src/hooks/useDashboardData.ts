import { useQuery } from "@tanstack/react-query"

import type { DashboardFixtures } from "@/fixtures/dashboard"
import { isFixtureModeEnabled } from "@/lib/fixtures"
import { documentsApi } from "@/services/documents"
import { hierarchyApi } from "@/services/hierarchy"
import type { DocumentPublic } from "@/types/documents"
import { useDevFixtures } from "./useDevFixtures"

export type ActivityEvent = {
  id: string
  kind: "upload" | "failed" | "validation" | "analysis" | "finding"
  text: string
  timestamp: string
  href?: string
  isFixture?: boolean
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

function buildActivity(documents: DocumentPublic[]): ActivityEvent[] {
  const events: ActivityEvent[] = []

  for (const document of documents) {
    const name =
      document.filename || document.file_url.split("/").pop() || "file"
    events.push({
      id: `${document.id}-upload`,
      kind: "upload",
      text: `You uploaded ${name}`,
      timestamp: document.uploaded_at,
      href: `/documents/${document.id}`,
    })
    if (document.extraction_status === "failed") {
      events.push({
        id: `${document.id}-failed`,
        kind: "failed",
        text: `Extraction failed for ${name}`,
        timestamp: document.uploaded_at,
        href: `/documents/${document.id}`,
      })
    }
  }

  return events
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    .slice(0, 10)
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

  const activity = buildActivity(documents)

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
          context: "checksums arrive in M2",
        },
    validationRuns: fixtures
      ? { value: fixtures.integrity.validationRuns, context: "fixture data" }
      : { value: null, context: "validation engine lands in M2" },
    provenanceCoverage: fixtures
      ? {
          value: fixtures.integrity.provenanceCoverage,
          context: "fixture data",
        }
      : { value: null, context: "provenance log arrives in M2" },
  }

  return {
    documents,
    documentsQuery,
    projects,
    projectsQuery,
    fixtures,
    fixturesEnabled,
    counts: {
      projects: projectsCount,
      experiments: experimentsCount,
      samples: samplesCount,
      documents: documentCount,
      extracting: extractingCount,
      failed: failedCount,
    },
    recentFiles,
    activity,
    integrity,
  }
}
