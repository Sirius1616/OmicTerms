import { createFileRoute } from "@tanstack/react-router"
import { Network } from "lucide-react"

import { PageHeader } from "@/components/Common/PageHeader"
import { Panel } from "@/components/Common/Panel"
import { EvidenceGraph } from "@/components/Evidence/EvidenceGraph"
import { useEvidenceGraph } from "@/hooks/useEvidenceGraph"

export const Route = createFileRoute("/_layout/evidence")({
  component: EvidencePage,
  head: () => ({ meta: [{ title: "Evidence Graph - OmicTerms" }] }),
})

const STAGE_NOTES: { title: string; body: string }[] = [
  {
    title: "Omics layers",
    body: "Measured data — variants, expression, methylation, peaks, proteomics — as observed in your files.",
  },
  {
    title: "Samples",
    body: "The study design the measurements belong to.",
  },
  {
    title: "Analysis runs",
    body: "Results derived from the data by a tool, with its inputs recorded.",
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
  const { data: fixtures } = useEvidenceGraph()

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Evidence Graph"
        description="Datasets, analysis runs, and findings, connected so every claim can be traced back to the data that supports it."
      />

      <div className="grid gap-4 xl:grid-cols-12">
        <Panel
          title="Multi-Omics Evidence Map"
          subtitle="Layered left to right: data → samples → analysis → findings → reports"
          icon={<Network className="size-4 text-muted-foreground" />}
          className="xl:col-span-8"
        >
          <EvidenceGraph
            graph={fixtures?.graph ?? null}
            notice={fixtures?.notice}
            full
          />
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
            <p className="mt-3 rounded-lg border border-dashed bg-muted/30 p-2 text-[11px] text-muted-foreground">
              Interactive linking lands in milestone M3. Until then this map
              shows the planned structure; enable dev fixtures to preview it
              with clearly-labelled synthetic data.
            </p>
          </Panel>
        </div>
      </div>
    </div>
  )
}
