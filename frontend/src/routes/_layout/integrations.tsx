import { createFileRoute } from "@tanstack/react-router"
import { Plug } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/integrations")({
  component: () => (
    <PlaceholderPage
      icon={Plug}
      title="Integrations"
      milestone="M3"
      description="A registry of analysis tools and formats, with adapters that translate each tool's output into a common internal representation so results can be compared and re-used across your project."
    />
  ),
  head: () => ({ meta: [{ title: "Integrations - OmicTerms" }] }),
})
