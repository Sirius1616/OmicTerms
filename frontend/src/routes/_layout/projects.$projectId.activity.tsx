import { useSuspenseQuery } from "@tanstack/react-query"
import { createFileRoute, Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Suspense } from "react"
import {
  ActionFilterBar,
  ProjectActivityPanel,
} from "@/components/Provenance/ActivityPanel"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { hierarchyApi } from "@/services/hierarchy"

type ActivitySearch = {
  action?: string
}

export const Route = createFileRoute("/_layout/projects/$projectId/activity")({
  component: ProjectActivity,
  validateSearch: (search: Record<string, unknown>): ActivitySearch => ({
    action:
      typeof search.action === "string" && search.action.length > 0
        ? search.action
        : undefined,
  }),
  head: () => ({
    meta: [{ title: "Project activity - OmicTerms" }],
  }),
})

function ActivityContent() {
  const { projectId } = Route.useParams()
  const { action } = Route.useSearch()
  const navigate = Route.useNavigate()

  const { data: project } = useSuspenseQuery({
    queryKey: ["project-tree", projectId],
    queryFn: () => hierarchyApi.getProjectTree(projectId),
  })

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link to="/projects" aria-label="Back to projects">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{project?.name}</h1>
          <p className="text-xs text-muted-foreground">Project activity</p>
        </div>
      </div>

      <ActionFilterBar
        value={action}
        onChange={(next) =>
          navigate({
            search: (prev: ActivitySearch) => ({ ...prev, action: next }),
          })
        }
      />

      <ProjectActivityPanel projectId={projectId} action={action} />
    </div>
  )
}

function ProjectActivity() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      }
    >
      <ActivityContent />
    </Suspense>
  )
}
