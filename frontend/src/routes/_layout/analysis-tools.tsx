import { createFileRoute } from "@tanstack/react-router"
import { Wrench } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/analysis-tools")({
  component: () => (
    <PlaceholderPage
      icon={Wrench}
      title="Analysis Tools"
      milestone="M3"
      description="Run analyses such as differential expression and PCA against your datasets, with every run recorded as provenance so you can see exactly how a result was produced."
    />
  ),
  head: () => ({ meta: [{ title: "Analysis Tools - OmicTerms" }] }),
})
