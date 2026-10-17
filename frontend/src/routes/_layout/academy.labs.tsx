import { createFileRoute } from "@tanstack/react-router"
import { FlaskConical } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/academy/labs")({
  component: () => (
    <PlaceholderPage
      icon={FlaskConical}
      title="Interactive Labs"
      milestone="M4"
      description="Hands-on exercises with real bioinformatics file formats. The execution environment (in-browser or server-side) is still being decided, so nothing runs here yet."
    />
  ),
  head: () => ({ meta: [{ title: "Interactive Labs - OmicTerms" }] }),
})
