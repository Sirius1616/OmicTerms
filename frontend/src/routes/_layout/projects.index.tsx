import { createFileRoute } from "@tanstack/react-router"

import { ProjectsHierarchy } from "@/components/Projects/HierarchyTree"

export const Route = createFileRoute("/_layout/projects/")({
  component: ProjectsHierarchy,
  head: () => ({
    meta: [{ title: "Projects - OmicTerms" }],
  }),
})
