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

/** Left-to-right evidence pipeline the map lays out in columns. */
export type EvidenceStage =
  | "omics"
  | "samples"
  | "analysis"
  | "findings"
  | "reports"

/** What a node represents. Drives its colour identity and scientific glyph. */
export type EvidenceNodeKind =
  | "variants"
  | "expression"
  | "methylation"
  | "peaks"
  | "proteomics"
  | "microbiome"
  | "sample"
  | "analysis"
  | "finding"
  | "report"

/**
 * Epistemic status, never fabricated:
 * - observed: measured directly from a dataset
 * - derived: computed by an analysis run
 * - inferred: a candidate interpretation, not yet validated
 */
export type EvidenceCertainty = "observed" | "derived" | "inferred"

/** How two nodes relate, used for edge styling and the legend. */
export type EvidenceEdgeKind =
  | "membership"
  | "provenance"
  | "support"
  | "citation"

export type FixtureGraphNode = {
  id: string
  label: string
  kind: EvidenceNodeKind
  stage: EvidenceStage
  certainty: EvidenceCertainty
  detail: string
}

export type FixtureGraphEdge = {
  id: string
  from: string
  to: string
  kind: EvidenceEdgeKind
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
        id: "variants",
        label: "Variant calls",
        kind: "variants",
        stage: "omics",
        certainty: "observed",
        detail: "Fixture VCF variant calls (synthetic).",
      },
      {
        id: "expression",
        label: "Expression matrix",
        kind: "expression",
        stage: "omics",
        certainty: "observed",
        detail: "Fixture gene expression matrix (synthetic).",
      },
      {
        id: "methylation",
        label: "Methylation matrix",
        kind: "methylation",
        stage: "omics",
        certainty: "observed",
        detail: "Fixture CpG methylation matrix (synthetic).",
      },
      {
        id: "peaks",
        label: "Peak calls",
        kind: "peaks",
        stage: "omics",
        certainty: "observed",
        detail: "Fixture ChIP/ATAC peak calls (synthetic).",
      },
      {
        id: "proteomics",
        label: "Protein abundance",
        kind: "proteomics",
        stage: "omics",
        certainty: "observed",
        detail: "Fixture protein abundance table (synthetic).",
      },
      {
        id: "sample-1",
        label: "Study samples",
        kind: "sample",
        stage: "samples",
        certainty: "observed",
        detail: "Fixture study design — sample group (synthetic).",
      },
      {
        id: "analysis-1",
        label: "Differential expression run",
        kind: "analysis",
        stage: "analysis",
        certainty: "derived",
        detail: "Fixture differential-expression run (synthetic).",
      },
      {
        id: "finding-1",
        label: "Candidate finding",
        kind: "finding",
        stage: "findings",
        certainty: "inferred",
        detail: "Fixture candidate finding (synthetic, not a real result).",
      },
      {
        id: "report-1",
        label: "Report draft",
        kind: "report",
        stage: "reports",
        certainty: "derived",
        detail: "Fixture report draft (synthetic).",
      },
    ],
    edges: [
      {
        id: "e1",
        from: "variants",
        to: "sample-1",
        kind: "membership",
        label: "belongs to",
      },
      {
        id: "e2",
        from: "expression",
        to: "sample-1",
        kind: "membership",
        label: "belongs to",
      },
      {
        id: "e3",
        from: "methylation",
        to: "sample-1",
        kind: "membership",
        label: "belongs to",
      },
      {
        id: "e4",
        from: "peaks",
        to: "sample-1",
        kind: "membership",
        label: "belongs to",
      },
      {
        id: "e5",
        from: "proteomics",
        to: "sample-1",
        kind: "membership",
        label: "belongs to",
      },
      {
        id: "e6",
        from: "sample-1",
        to: "analysis-1",
        kind: "provenance",
        label: "processed by",
      },
      {
        id: "e7",
        from: "analysis-1",
        to: "finding-1",
        kind: "provenance",
        label: "produced",
      },
      {
        id: "e8",
        from: "sample-1",
        to: "finding-1",
        kind: "support",
        label: "supports",
      },
      {
        id: "e9",
        from: "finding-1",
        to: "report-1",
        kind: "citation",
        label: "cited by",
      },
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
