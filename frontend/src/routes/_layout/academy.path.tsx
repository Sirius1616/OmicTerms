import { createFileRoute } from "@tanstack/react-router"
import { Route as RouteIcon } from "lucide-react"

import { PlaceholderPage } from "@/components/Common/PlaceholderPage"

export const Route = createFileRoute("/_layout/academy/path")({
  component: () => (
    <PlaceholderPage
      icon={RouteIcon}
      title="Learning Path"
      milestone="M4"
      description="An ordered path of lessons and exercises tailored to your assessment results, so you can move from concepts to hands-on work at a pace that suits you."
    />
  ),
  head: () => ({ meta: [{ title: "Learning Path - OmicTerms" }] }),
})
