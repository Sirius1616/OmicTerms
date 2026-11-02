export type HelpDocsLink =
  | {
      label: string
      href: string
    }
  | {
      label: string
      pending: true
    }

export type HelpTopic = {
  title: string
  summary: string
  paragraphs: string[]
  /** Existing in-repo/godocs targets only; missing pages render disabled. */
  docs: HelpDocsLink[]
}

const DOCS_BASE = "https://github.com/Sirius1616/OmicTerms/blob/main/docs"

/**
 * Story 12 — contextual help: the topic follows the route. Content is static
 * and bundled in-repo; docs links exist only when the page exists (otherwise
 * disabled with a "coming with the docs story" hint).
 */
export const HELP_TOPICS: Record<string, HelpTopic> = {
  documents: {
    title: "How upload validation works",
    summary: "What gets checked when a dataset file arrives.",
    paragraphs: [
      "When a file is uploaded OmicTerms snaps its content type from the " +
        "file bytes (magic numbers), records a SHA-256 checksum so its " +
        "integrity can always be re-verified later, and extracts the text " +
        "as a durable background job.",
      "Format validators then run against real structures: VCF headers and " +
        "coordinates, BED intervals, and expression/methylation matrix " +
        "headers and values. Samples are re-checked at experiment level in " +
        "cross-file validation.",
    ],
    docs: [
      {
        label: "Validation issue codes",
        href: `${DOCS_BASE}/validation-codes.md`,
      },
    ],
  },
  projects: {
    title: "Organising projects, experiments, samples",
    summary: "The research hierarchy and who owns it.",
    paragraphs: [
      "A project groups experiments, which group samples; documents always " +
        "belong to a sample. Deleting a level cascades with an explicit " +
        "confirmation that states how many records follow.",
      "Everything you create is owned by your account: other users cannot " +
        "read, mutate, or delete your records — the backend enforces the " +
        "walk from project to document on every request.",
    ],
    docs: [{ label: "Project layout reference", pending: true }],
  },
  findings: {
    title: "Claims need evidence",
    summary: "How findings, validation, and publishing work.",
    paragraphs: [
      "A finding is a research claim tied to the material that supports it: " +
        "documents, analysis runs, or links in the evidence graph. " +
        "Publishing requires at least one primary reference — the server " +
        "refuses anything else.",
      "Validation runs deterministic checks only; nobody, human or AI, can " +
        "declare a claim validated by hand. Published claims are versioned " +
        "history: they are retracted rather than erased.",
    ],
    docs: [{ label: "Finding lifecycle reference", pending: true }],
  },
  evidence: {
    title: "Reading the evidence map",
    summary: "Node kinds, links, and what is drawn where.",
    paragraphs: [
      "The map renders exactly the graph the server returns: layered from " +
        "omics records through samples and analysis runs to findings. " +
        "Dashed links are manual supports; everything else is derived from " +
        "real foreign keys.",
      "Selecting a row in the accessibility table view navigates the same " +
        "facts the canvas shows; the inspector carries checksums and links " +
        "to source records.",
    ],
    docs: [{ label: "Evidence graph reference", pending: true }],
  },
  learning: {
    title: "Learning with real data",
    summary: "What the Academy covers today and what is coming.",
    paragraphs: [
      "The Academy is under construction: learning pages are honest " +
        "placeholders while the content stories (biology foundations, " +
        "data literacy, exercises) land.",
    ],
    docs: [{ label: "Academy curriculum", pending: true }],
  },
  account: {
    title: "Account and security",
    summary: "Profile, password, and access.",
    paragraphs: [
      "Change your name and email in My profile; reset a lost password via " +
        "a 15-minute reset link sent to your inbox. Delete Account is a " +
        "two-step destructive action.",
    ],
    docs: [{ label: "Authentication reference", pending: true }],
  },
  welcome: {
    title: "Getting started",
    summary: "Where things live in OmicTerms.",
    paragraphs: [
      "Start from Data Sources to upload datasets into a project " +
        "→ experiment → sample hierarchy. The Evidence Graph shows how " +
        "your records relate; Findings collect claims with their " +
        "supporting material.",
    ],
    docs: [
      {
        label: "Documentation",
        href: "https://github.com/Sirius1616/OmicTerms/docs",
      },
    ],
  },
}

const TOPIC_BY_PREFIX: Array<[string, HelpTopic]> = [
  ["/documents", HELP_TOPICS.documents],
  ["/projects", HELP_TOPICS.projects],
  ["/findings", HELP_TOPICS.findings],
  ["/evidence", HELP_TOPICS.evidence],
  ["/settings", HELP_TOPICS.account],
  ["/academy", HELP_TOPICS.learning],
]

export function helpTopicForPath(path: string): HelpTopic {
  for (const [prefix, topic] of TOPIC_BY_PREFIX) {
    if (path === prefix || path.startsWith(`${prefix}/`)) {
      return topic
    }
  }
  return HELP_TOPICS.welcome
}
