/**
 * Development-only dashboard fixtures.
 *
 * This module is imported dynamically behind an `import.meta.env.DEV` guard so
 * it is excluded from production bundles. Every payload embeds a notice making
 * clear it is synthetic content, never real scientific data.
 */

export const FIXTURE_NOTICE = "Fixture — not real scientific data"

export type FixtureFinding = {
  id: string
  title: string
  summary: string
  sourceDatasets: string[]
  /** Story 1 never fabricates a confidence number. */
  evidenceStrength: "not_assessed"
  validation: "unvalidated"
}

export type FixtureGraphNodeType =
  | "genomics"
  | "transcriptomics"
  | "epigenomics"
  | "proteomics"
  | "microbiome"
  | "samples"
  | "tools"
  | "findings"
  | "reports"

export type FixtureGraphNode = {
  id: string
  label: string
  type: FixtureGraphNodeType
  x: number
  y: number
  detail: string
}

export type FixtureGraphEdge = {
  id: string
  from: string
  to: string
  label: string
}

export type FixtureActivityEvent = {
  id: string
  kind: "validation" | "analysis" | "finding"
  text: string
  timestamp: string
}

export type FixtureAcademy = {
  percent: number
  completedModules: number
  totalModules: number
}

export type FixtureDataIntegrity = {
  datasetsWithChecksums: { have: number; total: number }
  validationRuns: number
  provenanceCoverage: number
}

export type DashboardFixtures = {
  notice: string
  findings: FixtureFinding[]
  keyFindingsCount: number
  graph: {
    nodes: FixtureGraphNode[]
    edges: FixtureGraphEdge[]
  }
  activity: FixtureActivityEvent[]
  academy: FixtureAcademy
  integrity: FixtureDataIntegrity
}

const hoursAgo = (hours: number) =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

export const dashboardFixtures: DashboardFixtures = {
  notice: FIXTURE_NOTICE,
  keyFindingsCount: 3,
  integrity: {
    datasetsWithChecksums: { have: 4, total: 5 },
    validationRuns: 7,
    provenanceCoverage: 0.8,
  },
  academy: {
    percent: 42,
    completedModules: 2,
    totalModules: 3,
  },
  findings: [
    {
      id: "fixture-finding-1",
      title: "Differential expression between treated and control",
      summary:
        "Fixture summary: a small set of immune-response genes appears upregulated in the treated condition. Not traceable to real data.",
      sourceDatasets: ["fixture-expression-1.tsv"],
      evidenceStrength: "not_assessed",
      validation: "unvalidated",
    },
    {
      id: "fixture-finding-2",
      title: "Promoter hypomethylation near a candidate locus",
      summary:
        "Fixture summary: methylation signal is lower in the treatment group near a promoter. Synthetic example only.",
      sourceDatasets: ["fixture-methylation-1.csv"],
      evidenceStrength: "not_assessed",
      validation: "unvalidated",
    },
    {
      id: "fixture-finding-3",
      title: "Peak enrichment at a regulatory region",
      summary:
        "Fixture summary: a ChIP-seq peak overlaps a regulatory region of interest. Illustrative content, not a real result.",
      sourceDatasets: ["fixture-peaks-1.bed"],
      evidenceStrength: "not_assessed",
      validation: "unvalidated",
    },
  ],
  graph: {
    nodes: [
      {
        id: "genomics",
        label: "Genomics",
        type: "genomics",
        x: 60,
        y: 60,
        detail: "Fixture variant/coverage dataset",
      },
      {
        id: "transcriptomics",
        label: "Transcriptomics",
        type: "transcriptomics",
        x: 320,
        y: 60,
        detail: "Fixture expression matrix",
      },
      {
        id: "epigenomics",
        label: "Epigenomics",
        type: "epigenomics",
        x: 60,
        y: 200,
        detail: "Fixture methylation matrix",
      },
      {
        id: "proteomics",
        label: "Proteomics",
        type: "proteomics",
        x: 320,
        y: 200,
        detail: "Fixture protein abundance table",
      },
      {
        id: "samples",
        label: "Samples & Experiments",
        type: "samples",
        x: 190,
        y: 130,
        detail: "Fixture study design",
      },
      {
        id: "tools",
        label: "Analysis Tools",
        type: "tools",
        x: 60,
        y: 340,
        detail: "Fixture analysis run",
      },
      {
        id: "finding-1",
        label: "Candidate Finding",
        type: "findings",
        x: 190,
        y: 300,
        detail: "Fixture candidate finding (not real)",
      },
      {
        id: "report-1",
        label: "Report",
        type: "reports",
        x: 320,
        y: 340,
        detail: "Fixture report draft",
      },
    ],
    edges: [
      { id: "e1", from: "genomics", to: "samples", label: "belongs to" },
      { id: "e2", from: "transcriptomics", to: "samples", label: "belongs to" },
      { id: "e3", from: "epigenomics", to: "samples", label: "belongs to" },
      { id: "e4", from: "proteomics", to: "samples", label: "belongs to" },
      { id: "e5", from: "samples", to: "finding-1", label: "supports" },
      { id: "e6", from: "tools", to: "finding-1", label: "produced" },
      { id: "e7", from: "finding-1", to: "report-1", label: "cited by" },
    ],
  },
  activity: [
    {
      id: "fixture-activity-1",
      kind: "validation",
      text: "Validation run completed for fixture-expression-1.tsv",
      timestamp: hoursAgo(3),
    },
    {
      id: "fixture-activity-2",
      kind: "analysis",
      text: "Analysis run: PCA on fixture-expression-1.tsv",
      timestamp: hoursAgo(6),
    },
    {
      id: "fixture-activity-3",
      kind: "finding",
      text: "Candidate finding recorded (fixture)",
      timestamp: hoursAgo(9),
    },
  ],
}
