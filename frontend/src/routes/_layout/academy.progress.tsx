import { createFileRoute } from "@tanstack/react-router"
import { TrendingUp } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/academy/progress")({
  component: () => (
    <PlaceholderPage
      icon={TrendingUp}
      title="My Progress"
      milestone="M4"
      description="Track completed lessons, assessment scores, and the concepts you have mastered. Progress will also appear as a panel on your dashboard."
    />
  ),
  head: () => ({ meta: [{ title: "My Progress - OmicTerms" }] }),
})
