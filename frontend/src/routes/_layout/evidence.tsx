import { createFileRoute } from "@tanstack/react-router"
import { Network } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/evidence")({
  component: () => (
    <PlaceholderPage
      icon={Network}
      title="Evidence Graph"
      milestone="M3"
      description="The evidence graph links your datasets, analysis runs, and findings so every claim can be traced back to the data that supports it. Nothing becomes a finding until it is connected to evidence."
    />
  ),
  head: () => ({ meta: [{ title: "Evidence Graph - OmicTerms" }] }),
})
