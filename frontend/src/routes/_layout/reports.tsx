import { createFileRoute } from "@tanstack/react-router"
import { FileBarChart } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/reports")({
  component: () => (
    <PlaceholderPage
      icon={FileBarChart}
      title="Reports"
      milestone="M3"
      description="Build structured reports from your findings and their evidence. Reports are checked for consistency and coverage, and each version records the evidence snapshot it was built from."
    />
  ),
  head: () => ({ meta: [{ title: "Reports - OmicTerms" }] }),
})
