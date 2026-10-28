import { createFileRoute, Link } from "@tanstack/react-router"
import { FileText, Network, ServerCrash } from "lucide-react"

import { EmptyState } from "@/components/Common/EmptyState"
import { PageHeader } from "@/components/Common/PageHeader"
import { Panel } from "@/components/Common/Panel"
import { EvidenceGraph } from "@/components/Evidence/EvidenceGraph"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useEvidenceGraph } from "@/hooks/useEvidenceGraph"

export const Route = createFileRoute("/_layout/evidence")({
  component: EvidencePage,
  head: () => ({ meta: [{ title: "Evidence Graph - OmicTerms" }] }),
})

const STAGE_NOTES: { title: string; body: string }[] = [
  {
    title: "Omics layers",
    body: "Measured data — variants, expression, methylation, peaks — as observed in your uploaded files.",
  },
  {
    title: "Samples",
    body: "The study design the measurements belong to: samples, experiments, projects.",
  },
  {
    title: "Analysis runs",
    body: "Results derived from the data by a tool, with its inputs recorded. Landing with the Analysis milestone.",
  },
  {
    title: "Findings",
    body: "Candidate interpretations. They stay inferred until validation evidence is attached.",
  },
  {
    title: "Reports",
    body: "Output that cites the findings and the evidence snapshot it was built from.",
  },
]

function EvidencePage() {
  const evidence = useEvidenceGraph()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Multi-Omics Evidence Map"
        description="Trace how your data, study structure, analysis runs, and findings connect across omics layers with a clear, provenance-first view."
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          title="Multi-Omics Evidence Map"
          subtitle="Real workspace graph: data → samples → experiments → projects"
          icon={<Network className="size-4 text-muted-foreground" />}
          className="xl:col-span-8"
        >
          {evidence.isLoading ? (
            <div className="flex h-[32rem] flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="min-h-0 flex-1 rounded-xl" />
            </div>
          ) : evidence.graph ? (
            <div className="flex flex-col gap-2">
              <EvidenceGraph
                graph={evidence.graph}
                notice={evidence.notice}
                full
              />
              {evidence.truncated ? (
                <p className="rounded-lg border border-dashed bg-muted/30 p-2 text-[11px] text-muted-foreground">
                  Graph truncated — showing the first {500} entities to keep the
                  map responsive.
                </p>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={Network}
              title="No evidence structure yet"
              body="The map shows your real projects, samples, and uploaded documents. Create a project, then upload linked documents under a sample to grow the graph. Nothing is shown here until real records exist."
              action={
                <Button size="sm" asChild>
                  <Link to="/documents">
                    <FileText className="mr-1.5 size-3.5" />
                    Go to Data Sources
                  </Link>
                </Button>
              }
            />
          )}
        </Panel>

        <div className="flex flex-col gap-4 xl:col-span-4">
          <Panel
            title="How to read this map"
            subtitle="Structure, certainty, and link types"
          >
            <ol className="flex flex-col gap-3">
              {STAGE_NOTES.map((stage, index) => (
                <li key={stage.title} className="flex gap-3">
                  <span className="readout mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[11px] text-muted-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-foreground">
                      {stage.title}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {stage.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Panel>

          <Panel title="Certainty" subtitle="What the data lets us claim">
            <dl className="flex flex-col gap-2 text-xs">
              <div>
                <dt className="font-medium text-foreground">Observed</dt>
                <dd className="text-muted-foreground">
                  Solid outline — measured directly from a dataset.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Derived</dt>
                <dd className="text-muted-foreground">
                  Dashed outline — computed by an analysis run.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Inferred</dt>
                <dd className="text-muted-foreground">
                  Dotted outline — a candidate interpretation, not yet
                  validated.
                </dd>
              </div>
            </dl>
            <p className="mt-3 flex items-start gap-2 rounded-lg border border-dashed bg-muted/30 p-2 text-[11px] text-muted-foreground">
              <ServerCrash className="mt-0.5 size-3.5 shrink-0" />
              Analysis runs and findings are not yet modelled in the backend, so
              they never appear in the real graph. Dev fixtures (preview mode)
              remain clearly labelled synthetic data, never mixed with real
              records.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
