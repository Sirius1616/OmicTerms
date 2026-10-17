import { createFileRoute } from "@tanstack/react-router"
import { BookOpen } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/academy/concepts")({
  component: () => (
    <PlaceholderPage
      icon={BookOpen}
      title="Concept Explorer"
      milestone="M4"
      description="A searchable glossary of omics concepts that explains terms in plain language and links them to the lessons and labs where they are used."
    />
  ),
  head: () => ({ meta: [{ title: "Concept Explorer - OmicTerms" }] }),
})
