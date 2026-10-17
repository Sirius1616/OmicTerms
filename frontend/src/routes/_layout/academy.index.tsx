import { createFileRoute } from "@tanstack/react-router"
import { GraduationCap } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/academy/")({
  component: () => (
    <PlaceholderPage
      icon={GraduationCap}
      title="OmicTerms Academy"
      milestone="M4"
      description="Guided learning for software engineers entering genomics: biology foundations, data literacy, and practical Python. You'll start with a short onboarding assessment that recommends a personal path."
    />
  ),
  head: () => ({ meta: [{ title: "Academy - OmicTerms" }] }),
})
